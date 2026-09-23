import type {
  ChapterId,
  LatestContentPointer,
  ProgressiveManifest,
  ReleaseFile,
} from "../contracts/progressive-release.ts";
import type {
  ContentError,
  ContentErrorCode,
  DownloadJob,
  DownloadRequest,
} from "../contracts/progressive-content-store.ts";
import { parseLatestContentPointer } from "../parsers/latest-content-pointer.ts";
import { parseProgressiveManifest } from "../parsers/progressive-release.ts";
import { compare } from "../parsers/schema.ts";
import type {
  ProgressiveFileRow,
  ProgressiveReceiptRow,
} from "./content-database.ts";
import { progressiveFileKey } from "./content-cache.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH = /^[a-f0-9]{64}$/;

class StoreContentError extends Error implements ContentError {
  readonly code: ContentErrorCode;

  constructor(code: ContentErrorCode) {
    super(code);
    this.name = "ContentError";
    this.code = code;
  }
}

export function fail(code: ContentErrorCode): never {
  throw new StoreContentError(code);
}

export function mapped(error: unknown): ContentError {
  if (
    error instanceof Error &&
    error.name === "ContentError" &&
    "code" in error &&
    typeof error.code === "string"
  )
    return error as ContentError;
  if (error instanceof DOMException && error.name === "QuotaExceededError")
    return new StoreContentError("CONTENT_QUOTA_EXCEEDED");
  if (
    error instanceof DOMException &&
    ["AbortError", "TimeoutError"].includes(error.name)
  )
    return new StoreContentError("CONTENT_CANCELLED");
  if (error instanceof Error && error.message === "CONTENT_INVALID_MANIFEST")
    return new StoreContentError("CONTENT_INVALID_MANIFEST");
  return new StoreContentError("CONTENT_STORAGE_UNAVAILABLE");
}

export async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw mapped(error);
  }
}

export async function digest(bytes: Uint8Array): Promise<string> {
  const value = await crypto.subtle.digest("SHA-256", bytes.slice());
  return Array.from(new Uint8Array(value), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function validHash(value: unknown): value is string {
  return typeof value === "string" && HASH.test(value);
}

export function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new StoreContentError("CONTENT_CANCELLED");
}

export function decodeJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail("CONTENT_INVALID_MANIFEST");
  }
}

export async function responseBytes(
  response: Response,
  maximum: number,
  expected: number | null,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const declared = response.headers.get("Content-Length");
  if (declared !== null) {
    const length = Number(declared);
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > maximum ||
      (expected !== null && length !== expected)
    )
      fail("CONTENT_INTEGRITY_FAILED");
  }
  if (!response.body) fail("CONTENT_INTEGRITY_FAILED");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      throwIfAborted(signal);
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > maximum || (expected !== null && length > expected))
        fail("CONTENT_INTEGRITY_FAILED");
      chunks.push(chunk.value);
    }
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      console.warn("CONTENT_RESPONSE_CANCEL_FAILED");
    }
    if (signal.aborted) throw new StoreContentError("CONTENT_CANCELLED");
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (expected !== null && length !== expected)
    fail("CONTENT_INTEGRITY_FAILED");
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function parsedManifest(bytes: Uint8Array): ProgressiveManifest {
  try {
    return parseProgressiveManifest(decodeJson(bytes));
  } catch (error) {
    throw mapped(error);
  }
}

export function parsedPointer(value: unknown): LatestContentPointer {
  try {
    return parseLatestContentPointer(value);
  } catch (error) {
    throw mapped(error);
  }
}

export function chapterClosure(
  manifest: ProgressiveManifest,
  chapterIds: readonly ChapterId[],
): readonly ChapterId[] {
  if (
    !Array.isArray(chapterIds) ||
    chapterIds.length === 0 ||
    new Set(chapterIds).size !== chapterIds.length
  )
    fail("CONTENT_INVALID_MANIFEST");
  const chapters = new Map(
    manifest.chapters.map((chapter) => [chapter.id, chapter]),
  );
  const closed = new Set<ChapterId>();
  const visit = (id: ChapterId): void => {
    const chapter = chapters.get(id);
    if (!chapter) fail("CONTENT_INVALID_MANIFEST");
    if (closed.has(id)) return;
    for (const dependency of chapter.depends) visit(dependency);
    closed.add(id);
  };
  for (const id of chapterIds) visit(id);
  return [...closed].sort(compare);
}

export function selectedFiles(
  manifest: ProgressiveManifest,
  chapterIds: readonly ChapterId[],
  kind: DownloadRequest["kind"],
): readonly ReleaseFile[] {
  const packs = new Set<"runtime" | ChapterId>(["runtime", ...chapterIds]);
  return manifest.files.filter(
    (file) =>
      (kind === "required" ? file.required : file.role === "media") &&
      file.packIds.some((id) => packs.has(id)),
  );
}

export function normalizedRequest(
  value: DownloadRequest,
  manifest: ProgressiveManifest,
): DownloadRequest {
  if (
    !value ||
    typeof value !== "object" ||
    !UUID.test(value.jobId) ||
    !validHash(value.manifestVersion) ||
    (value.kind !== "required" && value.kind !== "media")
  )
    fail("CONTENT_INVALID_MANIFEST");
  return {
    jobId: value.jobId,
    manifestVersion: value.manifestVersion,
    chapterIds: chapterClosure(manifest, value.chapterIds),
    kind: value.kind,
  };
}

export function immutableJob(job: DownloadJob): DownloadJob {
  const chapterIds = Object.freeze([...job.request.chapterIds]);
  const request = Object.freeze({ ...job.request, chapterIds });
  const progress = Object.freeze({ ...job.progress });
  return Object.freeze({ request, progress });
}

export function validFileRow(
  value: ProgressiveFileRow | undefined,
  file: ReleaseFile,
): value is ProgressiveFileRow {
  return (
    value !== undefined &&
    value.path === file.path &&
    value.version === file.version &&
    value.bytes === file.bytes &&
    value.cacheKey === progressiveFileKey(file.path, file.version)
  );
}

export function fileIdentity(
  file: ReleaseFile,
): ProgressiveReceiptRow["files"][number] {
  return { path: file.path, version: file.version, bytes: file.bytes };
}
