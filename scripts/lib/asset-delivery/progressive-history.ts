import { progressiveFail } from "./progressive-error.ts";

// 11+ years of daily releases; bounded offline verification, not a lifetime sequence cap.
export const MAX_HISTORY_RELEASES = 4096;
export const MAX_HISTORY_BYTES = 64 * 1024 * 1024 * 1024;

export function visitReleaseHistory(
  history: { readonly runs: Set<string>; sequence: number; bytes: number },
  run: string,
  sequence: number,
  bytes: number,
): void {
  if (
    history.runs.has(run) ||
    history.runs.size >= MAX_HISTORY_RELEASES ||
    sequence >= history.sequence ||
    !Number.isSafeInteger(bytes) ||
    bytes < 0 ||
    bytes > MAX_HISTORY_BYTES - history.bytes
  )
    progressiveFail("CONTENT_INVALID_MANIFEST");
  history.runs.add(run);
  history.sequence = sequence;
  history.bytes += bytes;
}
