import type {
  ChapterId,
  LatestContentPointer,
  ProgressiveManifest,
  ReleaseFile,
} from "../contracts/progressive-release.ts";
import type {
  DownloadJob,
  DownloadProgress,
  DownloadRequest,
  ProgressiveContentStore,
  StagedContent,
} from "../contracts/progressive-content-store.ts";
import { progressivePath } from "../parsers/progressive-file.ts";
import { compare } from "../parsers/schema.ts";
import { persistedDownloadJob } from "./persisted-download-job.ts";
import { ownedProgressiveCacheKey } from "./progressive-cache-ownership.ts";
import {
  openProgressiveContentDatabase,
  type ProgressiveReceiptRow,
} from "./content-database.ts";
import {
  PROGRESSIVE_CONTENT_CACHE_NAME,
  progressiveFileKey,
} from "./content-cache.ts";
import {
  chapterClosure,
  decodeJson,
  digest,
  fail,
  fileIdentity,
  guarded,
  immutableJob,
  mapped,
  normalizedRequest,
  parsedManifest,
  parsedPointer,
  responseBytes,
  same,
  selectedFiles,
  throwIfAborted,
  validFileRow,
  validHash,
} from "./progressive-storage-validation.ts";

const MAX_MANIFEST_BYTES = 32 * 1024 * 1024;
const MAX_FILE_BYTES = 256 * 1024 * 1024;
const DOWNLOAD_CONCURRENCY = 4;
const downloadJobLock = (jobId: string): string =>
  `ygo-content-download-job-v1:${jobId}`;

type ProgressiveDatabase = Awaited<
  ReturnType<typeof openProgressiveContentDatabase>
>;

class BrowserProgressiveContentStore implements ProgressiveContentStore {
  readonly db: ProgressiveDatabase;
  readonly cache: Cache;
  readonly baseUrl: string | null;
  readonly controllers = new Map<string, AbortController>();
  readonly activeJobs = new Set<string>();
  closed = false;

  constructor(db: ProgressiveDatabase, cache: Cache, baseUrl: string | null) {
    this.db = db;
    this.cache = cache;
    this.baseUrl = baseUrl;
  }

  private assertOpen(): void {
    if (this.closed) fail("CONTENT_STORAGE_UNAVAILABLE");
  }

  private async fetchObject(
    path: string,
    maximum: number,
    expected: number | null,
    signal: AbortSignal,
  ): Promise<Uint8Array> {
    this.assertOpen();
    throwIfAborted(signal);
    if (this.baseUrl === null) fail("CONTENT_NETWORK_FAILED");
    let url: URL;
    try {
      const base = this.baseUrl.endsWith("/")
        ? this.baseUrl
        : `${this.baseUrl}/`;
      url = new URL(path, base);
    } catch {
      fail("CONTENT_NETWORK_FAILED");
    }
    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        credentials: "omit",
        redirect: "error",
        signal,
      });
    } catch (error) {
      if (signal.aborted) fail("CONTENT_CANCELLED");
      if (error instanceof DOMException && error.name === "AbortError")
        fail("CONTENT_CANCELLED");
      fail("CONTENT_NETWORK_FAILED");
    }
    if (!response.ok)
      fail(
        response.status === 404 ? "CONTENT_MISSING" : "CONTENT_NETWORK_FAILED",
      );
    try {
      return await responseBytes(response, maximum, expected, signal);
    } catch (error) {
      if (signal.aborted) fail("CONTENT_CANCELLED");
      const contentError = mapped(error);
      if (
        contentError.code === "CONTENT_INTEGRITY_FAILED" ||
        contentError.code === "CONTENT_CANCELLED"
      )
        throw contentError;
      fail("CONTENT_NETWORK_FAILED");
    }
  }

  async fetchLatest(signal: AbortSignal): Promise<LatestContentPointer> {
    return guarded(async () => {
      const bytes = await this.fetchObject(
        "content/latest.json",
        MAX_MANIFEST_BYTES,
        null,
        signal,
      );
      return parsedPointer(decodeJson(bytes));
    });
  }

  async cacheManifest(
    input: LatestContentPointer,
    signal: AbortSignal,
  ): Promise<ProgressiveManifest> {
    return guarded(async () => {
      this.assertOpen();
      const pointer = parsedPointer(input);
      const bytes = await this.fetchObject(
        `content/manifests/${pointer.manifest.version}.json`,
        MAX_MANIFEST_BYTES,
        pointer.manifest.bytes,
        signal,
      );
      if ((await digest(bytes)) !== pointer.manifest.version)
        fail("CONTENT_INTEGRITY_FAILED");
      const manifest = parsedManifest(bytes);
      if (manifest.releaseSequence !== pointer.releaseSequence)
        fail("CONTENT_INVALID_MANIFEST");
      await this.db.put(
        "manifests",
        { version: pointer.manifest.version, bytes: bytes.slice() },
        pointer.manifest.version,
      );
      return manifest;
    });
  }

  async readManifest(version: string): Promise<ProgressiveManifest> {
    return guarded(async () => {
      this.assertOpen();
      if (!validHash(version)) fail("CONTENT_INVALID_MANIFEST");
      const row = await this.db.get("manifests", version);
      if (!row) fail("CONTENT_MISSING");
      if (
        row.version !== version ||
        !(row.bytes instanceof Uint8Array) ||
        row.bytes.byteLength > MAX_MANIFEST_BYTES ||
        (await digest(row.bytes)) !== version
      )
        fail("CONTENT_INTEGRITY_FAILED");
      return parsedManifest(row.bytes);
    });
  }

  private async cachedBytes(
    file: ReleaseFile,
    signal: AbortSignal,
  ): Promise<Uint8Array | null> {
    throwIfAborted(signal);
    const row = await this.db.get("files", [file.path, file.version]);
    if (!row) return null;
    if (!validFileRow(row, file)) fail("CONTENT_INTEGRITY_FAILED");
    const response = await this.cache.match(row.cacheKey);
    if (!response) fail("CONTENT_INTEGRITY_FAILED");
    const bytes = await responseBytes(response, file.bytes, file.bytes, signal);
    if ((await digest(bytes)) !== file.version)
      fail("CONTENT_INTEGRITY_FAILED");
    return bytes;
  }

  async readFile(
    manifestVersion: string,
    path: string,
    signal: AbortSignal,
  ): Promise<Uint8Array | null> {
    return guarded(async () => {
      this.assertOpen();
      try {
        progressivePath(path);
      } catch {
        fail("CONTENT_INVALID_MANIFEST");
      }
      const manifest = await this.readManifest(manifestVersion);
      const file = manifest.files.find((candidate) => candidate.path === path);
      if (!file) fail("CONTENT_INVALID_MANIFEST");
      const bytes = await this.cachedBytes(file, signal);
      return bytes?.slice() ?? null;
    });
  }

  private async canReuse(
    file: ReleaseFile,
    signal: AbortSignal,
  ): Promise<boolean> {
    try {
      return (await this.cachedBytes(file, signal)) !== null;
    } catch (error) {
      const contentError = mapped(error);
      if (contentError.code === "CONTENT_INTEGRITY_FAILED") return false;
      throw contentError;
    }
  }

  async download(
    input: DownloadRequest,
    signal: AbortSignal,
    onProgress: (value: DownloadProgress) => void,
  ): Promise<void> {
    if (this.activeJobs.has(input.jobId)) fail("CONTENT_JOB_CONFLICT");
    this.activeJobs.add(input.jobId);
    try {
      if (!globalThis.navigator?.locks)
        return await this.performDownload(input, signal, onProgress);
      return await guarded(() =>
        navigator.locks.request(
          downloadJobLock(input.jobId),
          { mode: "exclusive", ifAvailable: true },
          (lock) => {
            if (!lock) fail("CONTENT_JOB_CONFLICT");
            return this.performDownload(input, signal, onProgress);
          },
        ),
      );
    } finally {
      this.activeJobs.delete(input.jobId);
    }
  }

  private async performDownload(
    input: DownloadRequest,
    signal: AbortSignal,
    onProgress: (value: DownloadProgress) => void,
  ): Promise<void> {
    return guarded(async () => {
      this.assertOpen();
      const manifest = await this.readManifest(input.manifestVersion);
      const request = normalizedRequest(input, manifest);
      const existing = await this.db.get("jobs", request.jobId);
      if (existing !== undefined) {
        const job = await persistedDownloadJob(
          existing,
          request.jobId,
          (version) => this.readManifest(version),
        );
        if (!same(job.request, request)) fail("CONTENT_JOB_CONFLICT");
      }
      if (this.controllers.has(request.jobId)) fail("CONTENT_JOB_CONFLICT");
      const files = selectedFiles(manifest, request.chapterIds, request.kind);
      const totalBytes = files.reduce((total, file) => total + file.bytes, 0);
      if (!Number.isSafeInteger(totalBytes)) fail("CONTENT_INVALID_MANIFEST");
      let progress: DownloadProgress = {
        jobId: request.jobId,
        phase: "running",
        completedFiles: 0,
        totalFiles: files.length,
        completedBytes: 0,
        totalBytes,
      };
      let job: DownloadJob = { request, progress };
      const persist = async (): Promise<void> => {
        job = { request, progress };
        await this.db.put("jobs", job, request.jobId);
      };
      await persist();
      onProgress(immutableJob(job).progress);
      const controller = new AbortController();
      const cancel = () => controller.abort();
      signal.addEventListener("abort", cancel, { once: true });
      if (signal.aborted) cancel();
      this.controllers.set(request.jobId, controller);
      const runSignal = controller.signal;
      let firstError: unknown;
      let next = 0;
      let persistence = Promise.resolve();
      const update = (file: ReleaseFile): Promise<void> => {
        persistence = persistence.then(async () => {
          progress = {
            ...progress,
            completedFiles: progress.completedFiles + 1,
            completedBytes: progress.completedBytes + file.bytes,
          };
          await persist();
          onProgress(Object.freeze({ ...progress }));
        });
        return persistence;
      };
      const worker = async (): Promise<void> => {
        while (firstError === undefined) {
          const index = next++;
          const file = files[index];
          if (!file) return;
          try {
            throwIfAborted(runSignal);
            if (!(await this.canReuse(file, runSignal))) {
              const bytes = await this.fetchObject(
                `content/files/${file.version}/${file.path}`,
                MAX_FILE_BYTES,
                file.bytes,
                runSignal,
              );
              if ((await digest(bytes)) !== file.version)
                fail("CONTENT_INTEGRITY_FAILED");
              const cacheKey = progressiveFileKey(file.path, file.version);
              await this.cache.put(
                cacheKey,
                new Response(bytes.slice(), {
                  headers: { "Content-Type": file.mediaType },
                }),
              );
              await this.db.put(
                "files",
                {
                  path: file.path,
                  version: file.version,
                  bytes: file.bytes,
                  cacheKey,
                },
                [file.path, file.version],
              );
            }
            await update(file);
          } catch (error) {
            if (firstError === undefined) {
              firstError = error;
              controller.abort();
            }
          }
        }
      };
      try {
        await Promise.all(
          Array.from(
            { length: Math.min(DOWNLOAD_CONCURRENCY, files.length) },
            () => worker(),
          ),
        );
        await persistence;
        if (firstError !== undefined) throw firstError;
        throwIfAborted(runSignal);
        progress = { ...progress, phase: "complete" };
        await persist();
        throwIfAborted(runSignal);
        onProgress(Object.freeze({ ...progress }));
      } catch (error) {
        const contentError = mapped(error);
        progress = {
          ...progress,
          phase:
            signal.aborted || contentError.code === "CONTENT_CANCELLED"
              ? "paused"
              : "failed",
        };
        await persist();
        onProgress(Object.freeze({ ...progress }));
        throw contentError;
      } finally {
        signal.removeEventListener("abort", cancel);
        this.controllers.delete(request.jobId);
        if (this.closed && this.controllers.size === 0) this.db.close();
      }
    });
  }

  private async requiredFiles(
    manifestVersion: string,
    chapterIds: readonly ChapterId[],
  ): Promise<{
    readonly manifest: ProgressiveManifest;
    readonly chapterIds: readonly ChapterId[];
    readonly files: readonly ReleaseFile[];
  }> {
    const manifest = await this.readManifest(manifestVersion);
    const closed = chapterClosure(manifest, chapterIds);
    return {
      manifest,
      chapterIds: closed,
      files: selectedFiles(manifest, closed, "required"),
    };
  }

  private async receiptId(files: readonly ReleaseFile[]): Promise<string> {
    const identity = files
      .map(fileIdentity)
      .sort((left, right) => compare(left.path, right.path))
      .map((file) => `${file.path}\0${file.version}\0${file.bytes}\n`)
      .join("");
    return digest(new TextEncoder().encode(identity));
  }

  async sealRequired(
    manifestVersion: string,
    chapterIds: readonly ChapterId[],
  ): Promise<StagedContent> {
    return guarded(async () => {
      const selected = await this.requiredFiles(manifestVersion, chapterIds);
      const signal = new AbortController().signal;
      for (const file of selected.files) {
        const bytes = await this.cachedBytes(file, signal);
        if (bytes === null) fail("CONTENT_MISSING");
      }
      const receiptId = await this.receiptId(selected.files);
      const receipt: ProgressiveReceiptRow = {
        receiptId,
        files: selected.files
          .map(fileIdentity)
          .sort((left, right) => compare(left.path, right.path)),
      };
      await this.db.put("receipts", receipt, receiptId);
      return {
        receiptId,
        manifestVersion,
        releaseSequence: selected.manifest.releaseSequence,
        chapterIds: selected.chapterIds,
      };
    });
  }

  async verifyRequired(
    content: StagedContent,
    signal: AbortSignal,
  ): Promise<void> {
    return guarded(async () => {
      if (
        !content ||
        typeof content !== "object" ||
        !validHash(content.receiptId) ||
        !validHash(content.manifestVersion) ||
        !Number.isSafeInteger(content.releaseSequence) ||
        content.releaseSequence < 1
      )
        fail("CONTENT_INVALID_MANIFEST");
      const selected = await this.requiredFiles(
        content.manifestVersion,
        content.chapterIds,
      );
      if (
        content.releaseSequence !== selected.manifest.releaseSequence ||
        !same(content.chapterIds, selected.chapterIds) ||
        content.receiptId !== (await this.receiptId(selected.files))
      )
        fail("CONTENT_INVALID_MANIFEST");
      const receipt = await this.db.get("receipts", content.receiptId);
      const identities = selected.files
        .map(fileIdentity)
        .sort((left, right) => compare(left.path, right.path));
      if (!receipt) fail("CONTENT_MISSING");
      if (
        receipt.receiptId !== content.receiptId ||
        !same(receipt.files, identities)
      )
        fail("CONTENT_INTEGRITY_FAILED");
      for (const file of selected.files) {
        throwIfAborted(signal);
        const bytes = await this.cachedBytes(file, signal);
        if (bytes === null) fail("CONTENT_MISSING");
      }
    });
  }

  async listJobs(): Promise<readonly DownloadJob[]> {
    return guarded(async () => {
      this.assertOpen();
      const tx = this.db.transaction("jobs");
      const [rows, keys] = await Promise.all([
        tx.store.getAll(),
        tx.store.getAllKeys(),
        tx.done,
      ]);
      const jobs = await Promise.all(
        rows.map((row, index) =>
          persistedDownloadJob(row, keys[index], (version) =>
            this.readManifest(version),
          ),
        ),
      );
      return Object.freeze(
        jobs.sort((left, right) =>
          compare(left.request.jobId, right.request.jobId),
        ),
      );
    });
  }

  /** Caller holds application-exclusive, then download-exclusive locks. */
  async deleteFilesOutside(manifestVersion: string): Promise<void> {
    return guarded(async () => {
      const manifest = await this.readManifest(manifestVersion);
      const allowed = new Set(
        manifest.files.map((file) =>
          progressiveFileKey(file.path, file.version),
        ),
      );
      const stale = (await this.db.getAll("files")).filter(
        (file) => !allowed.has(progressiveFileKey(file.path, file.version)),
      );
      for (const request of await this.cache.keys()) {
        const key = ownedProgressiveCacheKey(request);
        if (key !== null && !allowed.has(key)) await this.cache.delete(key);
      }
      const tx = this.db.transaction(["files", "receipts"], "readwrite");
      await Promise.all([
        tx.done,
        (async () => {
          for (const file of stale)
            await tx.objectStore("files").delete([file.path, file.version]);
          for (const receipt of await tx.objectStore("receipts").getAll())
            if (
              receipt.files.some(
                (file) =>
                  !allowed.has(progressiveFileKey(file.path, file.version)),
              )
            )
              await tx.objectStore("receipts").delete(receipt.receiptId);
        })(),
      ]);
    });
  }

  /** Caller holds application-exclusive, then download-exclusive locks. */
  async deleteAllDownloaded(): Promise<void> {
    return guarded(async () => {
      this.assertOpen();
      for (const request of await this.cache.keys()) {
        const key = ownedProgressiveCacheKey(request);
        if (key !== null) await this.cache.delete(key);
      }
      const tx = this.db.transaction(
        ["manifests", "files", "jobs", "receipts"],
        "readwrite",
      );
      await Promise.all([
        tx.done,
        (async () => {
          await tx.objectStore("manifests").clear();
          await tx.objectStore("files").clear();
          await tx.objectStore("jobs").clear();
          await tx.objectStore("receipts").clear();
        })(),
      ]);
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const controller of this.controllers.values()) controller.abort();
    if (this.controllers.size === 0) this.db.close();
  }
}

async function pauseInterruptedJobs(
  store: BrowserProgressiveContentStore,
): Promise<void> {
  const db = store.db;
  const running = (await store.listJobs()).filter(
    (job) => job.progress.phase === "running",
  );
  for (const job of running) {
    const pause = async (): Promise<void> => {
      const row = await db.get("jobs", job.request.jobId);
      if (row === undefined) return;
      const observed = await persistedDownloadJob(
        row,
        job.request.jobId,
        (version) => store.readManifest(version),
      );
      if (observed.progress.phase === "running")
        await db.put(
          "jobs",
          {
            ...observed,
            progress: { ...observed.progress, phase: "paused" },
          },
          observed.request.jobId,
        );
    };
    if (!globalThis.navigator?.locks) await pause();
    else
      await navigator.locks.request(
        downloadJobLock(job.request.jobId),
        { mode: "exclusive", ifAvailable: true },
        async (lock) => {
          if (lock) await pause();
        },
      );
  }
}

export async function openProgressiveContentStore(
  baseUrl: string | null,
): Promise<ProgressiveContentStore> {
  return guarded(async () => {
    if (!globalThis.indexedDB || !globalThis.caches || !crypto.subtle)
      fail("CONTENT_STORAGE_UNAVAILABLE");
    if (baseUrl !== null && typeof baseUrl !== "string")
      fail("CONTENT_NETWORK_FAILED");
    const db = await openProgressiveContentDatabase();
    try {
      const cache = await caches.open(PROGRESSIVE_CONTENT_CACHE_NAME);
      const store = new BrowserProgressiveContentStore(db, cache, baseUrl);
      await pauseInterruptedJobs(store);
      return store;
    } catch (error) {
      db.close();
      throw error;
    }
  });
}
