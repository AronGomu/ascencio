import type {
  DownloadJob,
  DownloadRequest,
} from "../contracts/progressive-content-store.ts";
import type { ProgressiveManifest } from "../contracts/progressive-release.ts";
import {
  fail,
  immutableJob,
  mapped,
  normalizedRequest,
  same,
  selectedFiles,
  validHash,
} from "./progressive-storage-validation.ts";

function fields(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    fail("CONTENT_INTEGRITY_FAILED");
  return value as Record<string, unknown>;
}

/** IDB rows are untrusted; never repair corrupt identity or progress on read. */
export async function persistedDownloadJob(
  value: unknown,
  key: unknown,
  readManifest: (version: string) => Promise<ProgressiveManifest>,
): Promise<DownloadJob> {
  const row = fields(value, ["request", "progress"]);
  const request = fields(row.request, [
    "jobId",
    "manifestVersion",
    "chapterIds",
    "kind",
  ]);
  const progress = fields(row.progress, [
    "jobId",
    "phase",
    "completedFiles",
    "totalFiles",
    "completedBytes",
    "totalBytes",
  ]);
  if (
    typeof request.jobId !== "string" ||
    request.jobId !== key ||
    !validHash(request.manifestVersion) ||
    progress.jobId !== request.jobId ||
    typeof progress.phase !== "string" ||
    !["running", "paused", "complete", "failed"].includes(progress.phase)
  )
    fail("CONTENT_INTEGRITY_FAILED");
  let manifest: ProgressiveManifest;
  let normalized: DownloadRequest;
  try {
    manifest = await readManifest(request.manifestVersion);
    normalized = normalizedRequest(
      request as unknown as DownloadRequest,
      manifest,
    );
  } catch (error) {
    const contentError = mapped(error);
    if (
      contentError.code === "CONTENT_INVALID_MANIFEST" ||
      contentError.code === "CONTENT_MISSING"
    )
      fail("CONTENT_INTEGRITY_FAILED");
    throw contentError;
  }
  if (!same(request.chapterIds, normalized.chapterIds))
    fail("CONTENT_INTEGRITY_FAILED");
  const files = selectedFiles(manifest, normalized.chapterIds, normalized.kind);
  const bytes = files.reduce((total, file) => total + file.bytes, 0);
  const { completedFiles, totalFiles, completedBytes, totalBytes } = progress;
  for (const value of [completedFiles, totalFiles, completedBytes, totalBytes])
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
      fail("CONTENT_INTEGRITY_FAILED");
  if (
    totalFiles !== files.length ||
    totalBytes !== bytes ||
    (completedFiles as number) > files.length ||
    (completedBytes as number) > bytes ||
    (completedFiles === 0 && completedBytes !== 0) ||
    (completedFiles === totalFiles && completedBytes !== totalBytes) ||
    (progress.phase === "complete" && completedFiles !== totalFiles)
  )
    fail("CONTENT_INTEGRITY_FAILED");
  return immutableJob({
    request: normalized,
    progress: progress as unknown as DownloadJob["progress"],
  });
}
