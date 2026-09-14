import type {
  DownloadJob,
  DownloadProgress,
  LatestContentPointer,
  ProgressiveContentStore,
  ProgressiveManifest,
  StagedContent,
} from "../../content/index.ts";
import type { PreparedRelease } from "./prepared-release.ts";
import { prepareRelease } from "./prepared-release.ts";
import type {
  ActivationResult,
  ApplicationSelector,
  ApplicationSelection,
} from "./application-selector.ts";
import {
  APPLICATION_LIFECYCLE_LOCK,
  CONTENT_DOWNLOAD_LOCK,
} from "./application-locks.ts";
import { clearSelectedContent } from "./application-state.ts";
import {
  parseCoreCandidate,
  writeCoreApproval,
  type CoreCandidate,
} from "./core-update-approval.ts";

export type { CoreApproval, CoreCandidate } from "./core-update-approval.ts";

export interface ContentActionsView {
  readonly phase:
    | "idle"
    | "checking"
    | "downloading"
    | "paused"
    | "ready"
    | "blocked"
    | "failed";
  readonly message: string;
  readonly completedBytes: number;
  readonly totalBytes: number;
  readonly missingMedia: number;
  readonly canInstall: boolean;
  readonly canActivate: boolean;
  readonly canDownloadMedia: boolean;
  readonly canDeleteAssets: boolean;
  readonly canApproveCore: boolean;
  readonly coreCandidate: CoreCandidate | null;
  readonly resumableJobs: readonly DownloadJob[];
}

export interface ContentActions {
  check(signal: AbortSignal): Promise<void>;
  installRequired(signal: AbortSignal): Promise<void>;
  resume(jobId: string, signal: AbortSignal): Promise<void>;
  activate(signal: AbortSignal): Promise<void>;
  downloadMedia(signal: AbortSignal): Promise<void>;
  deleteUnusedAssets(): Promise<void>;
  deleteAllAssets(): Promise<void>;
  approveCore(candidate: CoreCandidate): Promise<void>;
}

export interface ContentActionsController extends ContentActions {
  readonly view: ContentActionsView;
  subscribe(listener: (view: ContentActionsView) => void): () => void;
  refresh(): Promise<void>;
  cancel(): void;
  dispose(): void;
}

const initialView: ContentActionsView = Object.freeze({
  phase: "idle",
  message: "Installed content remains available offline.",
  completedBytes: 0,
  totalBytes: 0,
  missingMedia: 0,
  canInstall: false,
  canActivate: false,
  canDownloadMedia: false,
  canDeleteAssets: true,
  canApproveCore: false,
  coreCandidate: null,
  resumableJobs: Object.freeze([]),
});

function copyFor(error: unknown): string {
  const code =
    error instanceof Error
      ? "code" in error && typeof error.code === "string"
        ? error.code
        : error.message
      : "";
  switch (code) {
    case "APP_SESSION_ACTIVE":
      return "Return all game tabs to Main Menu before updating.";
    case "APP_DOWNLOAD_ACTIVE":
      return "Another download is active. Pause it before cleanup.";
    case "APP_CORE_INCOMPATIBLE":
    case "CORE_CONTENT_INCOMPATIBLE":
      return "This CORE update is incompatible with installed content.";
    case "CORE_UPDATE_PENDING":
      return "Approved CORE update is waiting. Close all app tabs, then reopen.";
    case "CONTENT_CANCELLED":
      return "Download paused. Resume it when ready.";
    case "CONTENT_NETWORK_FAILED":
    case "CONTENT_MISSING":
      return "Update check failed. Installed offline content remains available.";
    case "CONTENT_QUOTA_EXCEEDED":
      return "Storage is full. Delete unused assets, then retry.";
    default:
      return "Content action failed. Retry from Main Menu.";
  }
}

function coreReleaseUrl(baseUrl: string): string {
  return new URL("core-release.json", baseUrl).href;
}

async function fetchCoreCandidate(
  fetcher: typeof fetch,
  baseUrl: string,
  signal: AbortSignal,
): Promise<CoreCandidate> {
  let response: Response;
  try {
    response = await fetcher(coreReleaseUrl(baseUrl), {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      signal,
    });
  } catch (cause) {
    throw new Error("CORE_UPDATE_DISCOVERY_FAILED", { cause });
  }
  const length = Number(response.headers.get("Content-Length") ?? "0");
  if (
    !response.ok ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > 4096
  ) {
    await response.body?.cancel();
    throw new Error("CORE_UPDATE_DISCOVERY_FAILED");
  }
  if (response.body === null) throw new Error("CORE_UPDATE_DISCOVERY_FAILED");
  const reader = response.body.getReader();
  const bytes = new Uint8Array(4096);
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > bytes.byteLength - size)
        throw new Error("CORE_UPDATE_DISCOVERY_FAILED");
      bytes.set(value, size);
      size += value.byteLength;
    }
    return parseCoreCandidate(
      JSON.parse(new TextDecoder().decode(bytes.subarray(0, size))),
    );
  } catch (cause) {
    await reader.cancel();
    throw new Error("CORE_UPDATE_DISCOVERY_FAILED", { cause });
  } finally {
    reader.releaseLock();
  }
}

export function createContentActions(options: {
  readonly factory: IDBFactory;
  readonly locks: LockManager;
  readonly store: ProgressiveContentStore;
  readonly selector: ApplicationSelector;
  readonly activate: (
    expectedGeneration: number,
    prepared: PreparedRelease,
    signal: AbortSignal,
  ) => Promise<ActivationResult>;
  readonly isHome: () => boolean;
  readonly coreBaseUrl: string;
  readonly currentBuildId: string;
  readonly fetch?: typeof fetch;
  readonly requestServiceWorkerUpdate: () => Promise<void>;
  readonly now?: () => number;
  readonly prepare?: typeof prepareRelease;
  readonly changed?: () => void;
}): ContentActionsController {
  const listeners = new Set<(view: ContentActionsView) => void>();
  let current = initialView;
  let latest: LatestContentPointer | null = null;
  let latestManifest: ProgressiveManifest | null = null;
  let prepared: PreparedRelease | null = null;
  let operation: AbortController | null = null;
  let disposed = false;
  let epoch = 0;
  let localRefresh = 0;

  const isCurrent = (expected: number): boolean =>
    !disposed && expected === epoch;
  const invalidate = (): number => {
    operation?.abort();
    return ++epoch;
  };

  const publish = (patch: Partial<ContentActionsView>): void => {
    if (disposed) return;
    current = Object.freeze({ ...current, ...patch });
    for (const listener of listeners) listener(current);
  };
  const requireHome = (): void => {
    if (!options.isHome()) throw new Error("APP_SESSION_ACTIVE");
  };
  const start = (signal: AbortSignal): AbortSignal => {
    invalidate();
    const controller = new AbortController();
    operation = controller;
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) controller.abort();
    return controller.signal;
  };
  const selectedChapters = async (
    manifest: ProgressiveManifest,
  ): Promise<readonly ProgressiveManifest["chapters"][number]["id"][]> => {
    const selection = await options.selector.read();
    if (selection.content !== null) return selection.content.chapterIds;
    const first = manifest.chapters[0];
    if (first === undefined) throw new Error("CONTENT_INVALID_MANIFEST");
    return [first.id];
  };
  const inspectMissingMedia = async (
    content: StagedContent | null,
  ): Promise<number> => {
    if (content === null) return 0;
    let manifest: ProgressiveManifest;
    try {
      manifest = await options.store.readManifest(content.manifestVersion);
    } catch {
      return 0;
    }
    let missing = 0;
    const signal = new AbortController().signal;
    // Staged chapterIds are already dependency-closed by sealRequired.
    const packs = new Set<string>(["runtime", ...content.chapterIds]);
    for (const file of manifest.files) {
      if (file.role !== "media" || !file.packIds.some((id) => packs.has(id)))
        continue;
      try {
        if (
          (await options.store.readFile(
            content.manifestVersion,
            file.path,
            signal,
          )) === null
        )
          missing++;
      } catch {
        missing++;
      }
    }
    return missing;
  };
  const refreshLocal = async (
    expected = epoch,
  ): Promise<ApplicationSelection | null> => {
    const refreshId = ++localRefresh;
    while (isCurrent(expected) && refreshId === localRefresh) {
      const [selection, jobs] = await Promise.all([
        options.selector.read(),
        options.store.listJobs(),
      ]);
      const missingMedia = await inspectMissingMedia(selection.content);
      const final = await options.selector.read();
      if (!isCurrent(expected) || refreshId !== localRefresh) return null;
      if (final.generation !== selection.generation) continue;
      const resumable = Object.freeze(
        jobs.filter(
          ({ progress }) =>
            progress.phase === "paused" || progress.phase === "failed",
        ),
      );
      publish({
        missingMedia,
        canDeleteAssets: true,
        canInstall:
          latest !== null &&
          prepared?.content.manifestVersion !== latest.manifest.version &&
          (final.content === null ||
            latest.releaseSequence > final.content.releaseSequence),
        canActivate: prepared !== null,
        canDownloadMedia: final.content !== null && missingMedia > 0,
        resumableJobs: resumable,
        phase: resumable.length > 0 ? "paused" : current.phase,
      });
      return final;
    }
    return null;
  };
  const progress = (value: DownloadProgress): void => {
    publish({
      phase:
        value.phase === "complete"
          ? "ready"
          : value.phase === "running"
            ? "downloading"
            : value.phase,
      message:
        value.phase === "paused"
          ? "Download paused. Resume it when ready."
          : value.phase === "failed"
            ? "Download failed. Retry from Main Menu."
            : value.phase === "complete"
              ? "Download complete."
              : "Downloading selected content…",
      completedBytes: value.completedBytes,
      totalBytes: value.totalBytes,
    });
  };
  const runDownload = async (
    request: DownloadJob["request"],
    signal: AbortSignal,
    expected: number,
    complete?: (signal: AbortSignal) => Promise<void>,
  ): Promise<void> => {
    const activeSignal = signal;
    if (!isCurrent(expected)) return;
    publish({ phase: "downloading", message: "Downloading selected content…" });
    try {
      await options.locks.request(
        CONTENT_DOWNLOAD_LOCK,
        { mode: "exclusive", ifAvailable: true },
        async (lock) => {
          if (!lock) throw new Error("APP_DOWNLOAD_ACTIVE");
          await options.store.download(request, activeSignal, (value) => {
            if (isCurrent(expected)) progress(value);
          });
          if (isCurrent(expected) && !activeSignal.aborted)
            await complete?.(activeSignal);
        },
      );
      await refreshLocal(expected);
      if (isCurrent(expected)) options.changed?.();
    } catch (error) {
      if (!isCurrent(expected)) return;
      publish({
        phase:
          error instanceof Error &&
          (error.message === "CONTENT_CANCELLED" ||
            ("code" in error && error.code === "CONTENT_CANCELLED"))
            ? "paused"
            : "failed",
        message: copyFor(error),
      });
      throw error;
    }
  };
  const withCleanupLocks = async (work: () => Promise<void>): Promise<void> => {
    requireHome();
    await options.locks.request(
      APPLICATION_LIFECYCLE_LOCK,
      { mode: "exclusive", ifAvailable: true },
      async (applicationLock) => {
        if (!applicationLock) throw new Error("APP_SESSION_ACTIVE");
        await options.locks.request(
          CONTENT_DOWNLOAD_LOCK,
          { mode: "exclusive", ifAvailable: true },
          async (downloadLock) => {
            if (!downloadLock) throw new Error("APP_DOWNLOAD_ACTIVE");
            const jobs = await options.store.listJobs();
            if (jobs.some(({ progress }) => progress.phase === "running"))
              throw new Error("APP_DOWNLOAD_ACTIVE");
            await work();
          },
        );
      },
    );
  };
  const failVisible = async (
    expected: number,
    work: () => Promise<void>,
  ): Promise<void> => {
    try {
      await work();
    } catch (error) {
      if (isCurrent(expected))
        publish({ phase: "failed", message: copyFor(error) });
      throw error;
    }
  };

  const controller: ContentActionsController = {
    get view() {
      return current;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(current);
      return () => listeners.delete(listener);
    },
    async refresh() {
      const expected = invalidate();
      prepared?.dispose();
      prepared = null;
      publish({
        phase: "idle",
        message: "Installed content changed. Local status refreshed.",
        canActivate: false,
      });
      await failVisible(expected, async () => {
        await refreshLocal(expected);
      });
    },
    cancel() {
      operation?.abort();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      operation?.abort();
      prepared?.dispose();
      prepared = null;
      listeners.clear();
    },
    async check(signal) {
      requireHome();
      const activeSignal = start(signal);
      publish({ phase: "checking", message: "Checking for updates…" });
      const expected = epoch;
      await refreshLocal(expected);
      if (!isCurrent(expected) || activeSignal.aborted) return;
      const [contentResult, coreResult] = await Promise.allSettled([
        (async () => {
          const pointer = await options.store.fetchLatest(activeSignal);
          const manifest = await options.store.cacheManifest(
            pointer,
            activeSignal,
          );
          return { pointer, manifest };
        })(),
        fetchCoreCandidate(
          options.fetch ?? globalThis.fetch,
          options.coreBaseUrl,
          activeSignal,
        ),
      ]);
      if (!isCurrent(expected) || activeSignal.aborted) return;
      const installed = await refreshLocal(expected);
      if (installed === null || !isCurrent(expected) || activeSignal.aborted)
        return;
      if (contentResult.status === "fulfilled") {
        latest = contentResult.value.pointer;
        latestManifest = contentResult.value.manifest;
      }
      const candidate =
        coreResult.status === "fulfilled" ? coreResult.value : null;
      const newerContent =
        contentResult.status === "fulfilled" &&
        latest !== null &&
        (installed.content === null ||
          latest.releaseSequence > installed.content.releaseSequence);
      const newerCore =
        candidate !== null && candidate.buildId !== options.currentBuildId;
      if (
        contentResult.status === "rejected" &&
        coreResult.status === "rejected"
      ) {
        publish({
          phase: "failed",
          message:
            "Update check failed. Installed offline content remains available.",
          coreCandidate: null,
          canApproveCore: false,
          canInstall: false,
        });
        return;
      }
      const failedChannel =
        contentResult.status === "rejected"
          ? "Content"
          : coreResult.status === "rejected"
            ? "CORE"
            : null;
      publish({
        phase: failedChannel === null ? "idle" : "failed",
        message:
          failedChannel !== null
            ? `${failedChannel} update check failed. Installed offline content remains available. Retry the failed check; other actions remain available.`
            : newerContent || newerCore
              ? "Updates found. Choose each download separately."
              : "Installed content is up to date.",
        coreCandidate: candidate,
        canApproveCore: newerCore,
        canInstall:
          newerContent &&
          prepared?.content.manifestVersion !== latest?.manifest.version,
      });
    },
    async installRequired(signal) {
      requireHome();
      if (latest === null || latestManifest === null)
        throw new Error("CONTENT_NETWORK_FAILED");
      const activeSignal = start(signal);
      const expected = epoch;
      const pointer = latest;
      const chapterIds = await selectedChapters(latestManifest);
      if (!isCurrent(expected)) return;
      const request = {
        jobId: crypto.randomUUID(),
        manifestVersion: pointer.manifest.version,
        chapterIds,
        kind: "required" as const,
      };
      await runDownload(
        request,
        activeSignal,
        expected,
        async (activeSignal) => {
          const staged = await options.store.sealRequired(
            request.manifestVersion,
            chapterIds,
          );
          const result = await (options.prepare ?? prepareRelease)(
            options.store,
            staged,
            activeSignal,
          );
          if (!isCurrent(expected) || activeSignal.aborted) {
            result.dispose();
            return;
          }
          prepared?.dispose();
          prepared = result;
          publish({
            phase: "ready",
            message: "Required content is ready to activate.",
            canInstall: false,
            canActivate: true,
          });
        },
      );
    },
    async resume(jobId, signal) {
      requireHome();
      const activeSignal = start(signal);
      const expected = epoch;
      const job = (await options.store.listJobs()).find(
        ({ request }) => request.jobId === jobId,
      );
      if (!isCurrent(expected)) return;
      if (!job) throw new Error("CONTENT_JOB_CONFLICT");
      await runDownload(
        job.request,
        activeSignal,
        expected,
        job.request.kind === "required"
          ? async (activeSignal) => {
              const staged = await options.store.sealRequired(
                job.request.manifestVersion,
                job.request.chapterIds,
              );
              const result = await (options.prepare ?? prepareRelease)(
                options.store,
                staged,
                activeSignal,
              );
              if (!isCurrent(expected) || activeSignal.aborted) {
                result.dispose();
                return;
              }
              prepared?.dispose();
              prepared = result;
              publish({
                phase: "ready",
                message: "Required content is ready to activate.",
                canActivate: true,
              });
            }
          : undefined,
      );
    },
    async activate(signal) {
      requireHome();
      if (prepared === null) throw new Error("APP_REQUIRED_INPUT_FAILED");
      const activeSignal = start(signal);
      const expected = epoch;
      const candidate = prepared;
      const selection = await options.selector.read();
      if (!isCurrent(expected)) return;
      const result = await options.activate(
        selection.generation,
        candidate,
        activeSignal,
      );
      if (!isCurrent(expected)) return;
      if (result.kind !== "activated") {
        const error = new Error(result.code);
        publish({
          phase: result.kind === "blocked" ? "blocked" : "failed",
          message: copyFor(error),
        });
        throw error;
      }
      prepared = null;
      publish({
        phase: "ready",
        message: "Content activated.",
        canActivate: false,
        canDownloadMedia: true,
        canDeleteAssets: true,
      });
      options.changed?.();
      await refreshLocal(expected);
    },
    async downloadMedia(signal) {
      requireHome();
      const activeSignal = start(signal);
      const expected = epoch;
      const selection = await options.selector.read();
      if (!isCurrent(expected)) return;
      if (selection.content === null) throw new Error("CONTENT_MISSING");
      await runDownload(
        {
          jobId: crypto.randomUUID(),
          manifestVersion: selection.content.manifestVersion,
          chapterIds: selection.content.chapterIds,
          kind: "media",
        },
        activeSignal,
        expected,
      );
    },
    async deleteUnusedAssets() {
      const expected = invalidate();
      await failVisible(expected, () =>
        withCleanupLocks(async () => {
          const selection = await options.selector.read();
          if (selection.content === null) throw new Error("CONTENT_MISSING");
          await options.store.deleteFilesOutside(
            selection.content.manifestVersion,
          );
          if (isCurrent(expected))
            publish({ phase: "ready", message: "Unused assets deleted." });
          await refreshLocal(expected);
        }),
      );
    },
    async deleteAllAssets() {
      const expected = invalidate();
      await failVisible(expected, () =>
        withCleanupLocks(async () => {
          const selection = await options.selector.read();
          if (selection.content !== null) {
            const cleared = await clearSelectedContent(
              options.factory,
              selection.generation,
            );
            if (cleared === null) throw new Error("APP_ACTIVATION_CONFLICT");
            options.changed?.();
          }
          prepared?.dispose();
          prepared = null;
          latest = null;
          latestManifest = null;
          if (isCurrent(expected))
            publish({
              canActivate: false,
              canInstall: false,
              canDownloadMedia: false,
              missingMedia: 0,
            });
          await options.store.deleteAllDownloaded();
          if (!isCurrent(expected)) return;
          publish({
            phase: "ready",
            message:
              "Downloaded assets deleted. Saves and settings were retained.",
            missingMedia: 0,
            canInstall: false,
            canActivate: false,
            canDownloadMedia: false,
            canDeleteAssets: true,
            resumableJobs: Object.freeze([]),
          });
        }),
      );
    },
    async approveCore(input) {
      const expected = invalidate();
      await failVisible(expected, async () => {
        requireHome();
        const candidate = parseCoreCandidate(input);
        await options.locks.request(
          APPLICATION_LIFECYCLE_LOCK,
          { mode: "exclusive", ifAvailable: true },
          async (lock) => {
            if (!lock) throw new Error("APP_SESSION_ACTIVE");
            const selection = await options.selector.read();
            if (selection.content !== null) {
              const manifest = await options.store.readManifest(
                selection.content.manifestVersion,
              );
              if (
                manifest.coreRange.min > candidate.coreContentApiVersion ||
                manifest.coreRange.maxExclusive <=
                  candidate.coreContentApiVersion
              )
                throw new Error("CORE_CONTENT_INCOMPATIBLE");
            }
            await writeCoreApproval(
              options.factory,
              candidate,
              selection.generation,
              options.currentBuildId,
              (options.now ?? Date.now)(),
            );
          },
        );
        await options.requestServiceWorkerUpdate();
        if (!isCurrent(expected)) return;
        publish({
          phase: "ready",
          message:
            "CORE update approved. Close all app tabs, then reopen after installation completes.",
          canApproveCore: false,
        });
      });
    },
  };
  const initialEpoch = epoch;
  void refreshLocal(initialEpoch).catch((error: unknown) => {
    if (!isCurrent(initialEpoch)) return;
    publish({ phase: "failed", message: copyFor(error) });
  });
  return Object.freeze(controller);
}
