import type {
  ChapterId,
  LatestContentPointer,
  ProgressiveManifest,
} from "./progressive-release.ts";

export type ContentErrorCode =
  | "CONTENT_INVALID_MANIFEST"
  | "CONTENT_INTEGRITY_FAILED"
  | "CONTENT_MISSING"
  | "CONTENT_NETWORK_FAILED"
  | "CONTENT_STORAGE_UNAVAILABLE"
  | "CONTENT_QUOTA_EXCEEDED"
  | "CONTENT_CANCELLED"
  | "CONTENT_JOB_CONFLICT";

export interface ContentError extends Error {
  readonly code: ContentErrorCode;
}

export interface StagedContent {
  readonly receiptId: string;
  readonly manifestVersion: string;
  readonly releaseSequence: number;
  readonly chapterIds: readonly ChapterId[];
}

export interface DownloadProgress {
  readonly jobId: string;
  readonly phase: "running" | "paused" | "complete" | "failed";
  readonly completedFiles: number;
  readonly totalFiles: number;
  readonly completedBytes: number;
  readonly totalBytes: number;
}

export interface DownloadRequest {
  readonly jobId: string;
  readonly manifestVersion: string;
  readonly chapterIds: readonly ChapterId[];
  readonly kind: "required" | "media";
}

export interface DownloadJob {
  readonly request: DownloadRequest;
  readonly progress: DownloadProgress;
}

export interface ContentReader {
  readManifest(version: string): Promise<ProgressiveManifest>;
  readFile(
    manifestVersion: string,
    path: string,
    signal: AbortSignal,
  ): Promise<Uint8Array | null>;
  verifyRequired(content: StagedContent, signal: AbortSignal): Promise<void>;
}

export interface ProgressiveContentStore extends ContentReader {
  fetchLatest(signal: AbortSignal): Promise<LatestContentPointer>;
  cacheManifest(
    pointer: LatestContentPointer,
    signal: AbortSignal,
  ): Promise<ProgressiveManifest>;
  download(
    request: DownloadRequest,
    signal: AbortSignal,
    onProgress: (value: DownloadProgress) => void,
  ): Promise<void>;
  sealRequired(
    manifestVersion: string,
    chapterIds: readonly ChapterId[],
  ): Promise<StagedContent>;
  listJobs(): Promise<readonly DownloadJob[]>;
  deleteFilesOutside(manifestVersion: string): Promise<void>;
  deleteAllDownloaded(): Promise<void>;
  close(): void;
}
