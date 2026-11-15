/** Bounded validation cache. Every access verifies evidence before trusting an entry. */
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
export interface FindingsValidationInputs {
  packetSha256: string;
  /** Include every authoritative source, proposal and context dependency. */
  sourceHashes: Record<string, string>;
  report: unknown;
  vocabularyVersion: string;
  /** Include validator implementation identity when a cache survives code reloads. */
  validatorIdentity: string;
}
export class FindingsValidationCache {
  #entries = new Map<string, { value: unknown; bytes: number }>();
  #bytes = 0;
  readonly maxEntries: number;
  readonly maxBytes: number;
  constructor(maxEntries = 32, maxBytes = 8 * 1024 * 1024) {
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    if (
      !Number.isSafeInteger(maxEntries) ||
      maxEntries < 1 ||
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1
    )
      throw Error("Invalid findings cache bounds");
  }
  async validate<T>(
    inputs: FindingsValidationInputs,
    verify: () => Promise<Record<string, string>>,
    validate: () => Promise<T> | T,
  ): Promise<{ value: T; reused: boolean }> {
    if (
      !/^[a-f0-9]{64}$/.test(inputs.packetSha256) ||
      !inputs.vocabularyVersion ||
      !inputs.validatorIdentity ||
      !Object.keys(inputs.sourceHashes).length ||
      Object.values(inputs.sourceHashes).some(
        (hash) => !/^[a-f0-9]{64}$/.test(hash),
      )
    )
      throw Error("Findings cache requires complete pinned identities");
    const expected = Object.fromEntries(
      Object.entries(inputs.sourceHashes).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    );
    const verified = Object.fromEntries(
      Object.entries(await verify()).sort(([a], [b]) => a.localeCompare(b)),
    );
    if (!isDeepStrictEqual(expected, verified))
      throw Error("Findings cache evidence integrity mismatch");
    const key = createHash("sha256")
      .update(JSON.stringify({ ...inputs, sourceHashes: expected }))
      .digest("hex");
    const existing = this.#entries.get(key);
    if (existing) {
      this.#entries.delete(key);
      this.#entries.set(key, existing);
      return { value: structuredClone(existing.value) as T, reused: true };
    }
    const value = await validate();
    const encoded = JSON.stringify(value);
    if (encoded === undefined) return { value, reused: false };
    const bytes = Buffer.byteLength(encoded);
    if (bytes <= this.maxBytes) {
      const concurrent = this.#entries.get(key);
      if (concurrent) {
        this.#bytes -= concurrent.bytes;
        this.#entries.delete(key);
      }
      while (
        this.#entries.size >= this.maxEntries ||
        this.#bytes + bytes > this.maxBytes
      ) {
        const oldest = this.#entries.keys().next().value!;
        this.#bytes -= this.#entries.get(oldest)!.bytes;
        this.#entries.delete(oldest);
      }
      this.#entries.set(key, { value: structuredClone(value), bytes });
      this.#bytes += bytes;
    }
    return { value, reused: false };
  }
  clear() {
    this.#entries.clear();
    this.#bytes = 0;
  }
  get size() {
    return this.#entries.size;
  }
  get bytes() {
    return this.#bytes;
  }
}
export const findingsValidationCache = new FindingsValidationCache();
