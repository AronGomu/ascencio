import { bytesToHex } from "@noble/hashes/utils.js";
import type { MediaMapping } from "../contracts/critical-snapshot.ts";
import type { PackageId } from "../contracts/package.ts";
import type { QueryMap } from "../contracts/storage-client.ts";

/** One bounded byte transport for Vite and the native content protocol. */
export class GameContentReader {
  readonly #base: URL;
  constructor(base: string) {
    this.#base = new URL(base, globalThis.location?.href);
    if (!this.#base.pathname.endsWith("/"))
      throw new Error("CONTENT_BASE_INVALID");
  }

  async read(
    path: string,
    signal: AbortSignal,
    maximum: number,
  ): Promise<Uint8Array> {
    if (
      !/^[a-zA-Z0-9_/-]+(?:\.[a-z]+)?$/.test(path) ||
      path.startsWith("/") ||
      path.split("/").some((part) => !part || part === ".." || part === ".")
    )
      throw new Error("CONTENT_PATH_INVALID");
    const response = await fetch(new URL(path, this.#base), {
      signal,
      cache: "no-store",
      credentials: "omit",
    });
    if (!response.ok)
      throw new Error(`CONTENT_HTTP_${response.status}: ${path}`);
    const declared = response.headers.get("content-length");
    if (
      declared !== null &&
      (!/^\d+$/.test(declared) || Number(declared) > maximum)
    ) {
      await response.body?.cancel();
      throw new Error(`CONTENT_TOO_LARGE: ${path}`);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error(`CONTENT_BODY_MISSING: ${path}`);
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        signal.throwIfAborted();
        const next = await reader.read();
        if (next.done) break;
        total += next.value.byteLength;
        if (total > maximum) throw new Error(`CONTENT_TOO_LARGE: ${path}`);
        chunks.push(next.value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }

  async json(
    path: string,
    signal: AbortSignal,
    maximum: number,
  ): Promise<unknown> {
    const bytes = await this.read(path, signal, maximum);
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  }

  async media(
    packageId: PackageId,
    mapping: MediaMapping,
    signal: AbortSignal,
  ): Promise<QueryMap["asset"]> {
    try {
      const bytes = await this.read(
        this.#mediaPath("media", packageId, mapping),
        signal,
        64 * 1024 * 1024,
      );
      return { mime: mapping.mime, bytes };
    } catch (error) {
      if (signal.aborted) throw error;
      return null;
    }
  }

  async revision(
    packageId: PackageId,
    mapping: MediaMapping,
    signal: AbortSignal,
  ): Promise<string | null> {
    const value = await this.json(
      this.#mediaPath("revision", packageId, mapping),
      signal,
      4096,
    );
    if (value === null || typeof value === "string") return value;
    throw new Error("MEDIA_REVISION_INVALID");
  }

  #mediaPath(
    kind: "media" | "revision",
    packageId: PackageId,
    mapping: MediaMapping,
  ): string {
    return `${kind}/${packageId}/${bytesToHex(new TextEncoder().encode(mapping.id))}`;
  }
}
