import { selectStoryModule } from "./story-module-selection.ts";
import { chapterTransition } from "../../story/saves/index.ts";
import {
  createApplicationAdmission,
  type ApplicationAdmission,
} from "./application-admission.ts";
import type {
  LocalStorageClient,
  MediaWarning,
  ModeReadiness,
  StorageFailure,
  StorageResult,
} from "../../storage/index.ts";
import {
  closeFreeplayInputs as closeLoadedFreeplayInputs,
  loadFreeplayInputs as loadSqliteFreeplayInputs,
} from "../adapters/sqlite-freeplay-inputs.ts";
import {
  closeStoryInputs as closeLoadedStoryInputs,
  loadStoryInputs as loadSqliteStoryInputs,
} from "../adapters/sqlite-story-inputs.ts";
import { packageReadiness } from "../adapters/package-readiness.ts";
import type {
  FreeplayInputs,
  SessionByMode,
  ShellApplication,
  StoryInputs,
  StorySessionRequest,
} from "../core/shell-application.ts";
import type { ShellUserServices } from "../core/user-services.ts";

export interface SqliteApplicationStatus {
  readonly warnings: readonly MediaWarning[];
}

export interface SqliteApplicationService {
  readonly application: ShellApplication;
  readonly status: SqliteApplicationStatus;
  readiness(): Promise<ModeReadiness & { readonly generation: number }>;
  sessionActive(): boolean;
  subscribeStatus(
    listener: (status: SqliteApplicationStatus) => void,
  ): () => void;
  dispose(): Promise<void>;
}

export function createSqliteApplicationService(options: {
  readonly admission?: ApplicationAdmission;
  readonly storage: LocalStorageClient;
  readonly users: ShellUserServices;
  readonly flushUserWrites: () => Promise<StorageResult<void>>;
  readonly loadFreeplayInputs?: (
    storage: LocalStorageClient,
    users: ShellUserServices,
    signal: AbortSignal,
  ) => Promise<FreeplayInputs>;
  readonly closeFreeplayInputs?: (inputs: FreeplayInputs) => void;
  readonly loadStoryInputs?: (
    storage: LocalStorageClient,
    users: ShellUserServices,
    chapterId: `chapter-${string}`,
    signal: AbortSignal,
  ) => Promise<StoryInputs>;
  readonly closeStoryInputs?: (inputs: StoryInputs) => void;
}): SqliteApplicationService {
  const admission = options.admission ?? createApplicationAdmission();
  const loadFreeplayInputs =
    options.loadFreeplayInputs ?? loadSqliteFreeplayInputs;
  const closeFreeplayInputs =
    options.closeFreeplayInputs ?? closeLoadedFreeplayInputs;
  const loadStoryInputs = options.loadStoryInputs ?? loadSqliteStoryInputs;
  const closeStoryInputs = options.closeStoryInputs ?? closeLoadedStoryInputs;
  const listeners = new Set<() => void>();
  const statusListeners = new Set<(status: SqliteApplicationStatus) => void>();
  const warnings: MediaWarning[] = [];
  const rootAbort = new AbortController();
  const acquiring = new Set<Promise<unknown>>();
  const closing = new Set<Promise<void>>();
  const sessions = new Set<SessionByMode[keyof SessionByMode]>();
  let disposed = false;
  let disposePromise: Promise<void> | null = null;

  const status = (): SqliteApplicationStatus =>
    Object.freeze({ warnings: Object.freeze([...warnings]) });
  const unsubscribeWarnings = options.storage.subscribeMediaWarnings(
    (warning) => {
      if (disposed) return;
      warnings.push(Object.freeze({ ...warning }));
      const current = status();
      for (const listener of statusListeners) listener(current);
    },
  );

  async function readiness(): Promise<
    ModeReadiness & { readonly generation: number }
  > {
    if (disposed) throw new Error("APP_STORAGE_UNAVAILABLE");
    const current = await options.storage.packages.current();
    if (current.kind === "failed") throw storageError(current.error);
    return Object.freeze({
      generation: current.value.generation,
      ...packageReadiness(current.value),
    });
  }

  async function acquireMode<M extends keyof SessionByMode>(
    mode: M,
    signal: AbortSignal,
    releaseAdmission: () => void,
    storyRequest?: StorySessionRequest,
  ): Promise<SessionByMode[M]> {
    throwIfAborted(signal);
    if (disposed) throw abortError();
    const linked = new AbortController();
    const abort = () => linked.abort();
    signal.addEventListener("abort", abort, { once: true });
    rootAbort.signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted || rootAbort.signal.aborted) linked.abort();
    let lease: {
      readonly generation: number;
      release(): Promise<void>;
    } | null = null;
    let inputs: FreeplayInputs | StoryInputs | null = null;
    try {
      throwIfAborted(linked.signal);
      const acquired = await options.storage.packages.acquireSession();
      if (acquired.kind === "failed") throw storageError(acquired.error);
      lease = acquired.value;
      throwIfAborted(linked.signal);
      const current = await options.storage.packages.current();
      if (current.kind === "failed") throw storageError(current.error);
      if (current.value.generation !== lease.generation)
        throw new Error("APP_CONTENT_GENERATION_CHANGED");
      const readiness = packageReadiness(current.value);
      const selected =
        mode === "story" && storyRequest !== undefined
          ? await selectStoryModule(
              options.storage,
              current.value,
              storyRequest,
              linked.signal,
            )
          : null;
      const ready =
        mode === "freeplay"
          ? readiness.freeplay
          : selected !== null
            ? readiness.freeplay
            : readiness.newGame;
      if (!ready) {
        const required =
          mode === "freeplay"
            ? new Set(["duel-core", "card-library", "freeplay"])
            : new Set(["duel-core", "card-library", "freeplay", "chapter-01"]);
        const missing = readiness.missing
          .filter((packageId) => required.has(packageId))
          .join(",");
        throw new Error(`APP_CONTENT_REQUIRED:${missing}`);
      }
      inputs =
        mode === "freeplay"
          ? await loadFreeplayInputs(
              options.storage,
              options.users,
              linked.signal,
            )
          : await loadStoryInputs(
              options.storage,
              options.users,
              selected?.chapterId ?? "chapter-01",
              linked.signal,
            );
      if (
        mode === "story" &&
        selected?.previous &&
        (selected.advancing || storyRequest?.intent === "continue")
      ) {
        const storyInputs = inputs as StoryInputs;
        const autosave = await storyInputs.saves.read("autosave");
        if (autosave.kind === "corrupt" || autosave.kind === "incompatible")
          throw new Error("STORY_SAVE_UNAVAILABLE");
        const entry = selected.advancing
          ? chapterTransition(selected.previous, storyInputs.release)
          : {
              state: {
                ...selected.previous.state,
                screen: selected.previous.state.savedScreen,
              },
              story: selected.previous.story,
            };
        inputs = Object.freeze({
          ...storyInputs,
          entry: {
            ...entry,
            autosaveRevision:
              autosave.kind === "ready" ? autosave.envelope.revision : 0,
          },
        });
      }
      throwIfAborted(linked.signal);
      let closePromise: Promise<void> | null = null;
      const session = Object.freeze({
        kind: mode,
        generation: lease.generation,
        inputs,
        close(): Promise<void> {
          if (closePromise !== null) return closePromise;
          sessions.delete(session as SessionByMode[keyof SessionByMode]);
          closePromise = closeModeSession(
            mode,
            inputs!,
            lease!,
            options.flushUserWrites,
            closeFreeplayInputs,
            closeStoryInputs,
          ).finally(releaseAdmission);
          closing.add(closePromise);
          // Tracker observes settlement only; caller retains original rejection.
          void closePromise.then(
            () => closing.delete(closePromise!),
            () => closing.delete(closePromise!),
          );
          return closePromise;
        },
      }) as unknown as SessionByMode[M];
      sessions.add(session as SessionByMode[keyof SessionByMode]);
      return session;
    } catch (error) {
      let cleanupFailure: unknown = null;
      try {
        if (inputs !== null) {
          if (mode === "freeplay")
            closeFreeplayInputs(inputs as FreeplayInputs);
          else closeStoryInputs(inputs as StoryInputs);
        }
      } catch (cleanupError) {
        cleanupFailure = cleanupError;
      }
      try {
        if (lease !== null) await lease.release();
      } catch (cleanupError) {
        cleanupFailure ??= cleanupError;
      }
      throwIfAborted(linked.signal);
      if (cleanupFailure !== null)
        throw new AggregateError(
          [error, cleanupFailure],
          "APP_SESSION_STARTUP_CLEANUP_FAILED",
        );
      throw error;
    } finally {
      signal.removeEventListener("abort", abort);
      rootAbort.signal.removeEventListener("abort", abort);
    }
  }

  const acquire: ShellApplication["acquire"] = <M extends keyof SessionByMode>(
    mode: M,
    signal: AbortSignal,
    storyRequest?: StorySessionRequest,
  ): Promise<SessionByMode[M]> => {
    const releaseAdmission = admission.enter("session");
    if (releaseAdmission === null)
      return Promise.reject(new Error("APP_SESSION_ACTIVE"));
    const started = acquireMode(mode, signal, releaseAdmission, storyRequest);
    void started.catch(releaseAdmission);
    acquiring.add(started);
    // Tracker observes settlement only; acquire caller retains original rejection.
    void started.then(
      () => acquiring.delete(started),
      () => acquiring.delete(started),
    );
    return started;
  };
  const application: ShellApplication = {
    acquire,
    clear() {
      for (const listener of listeners) listener();
    },
    close() {
      if (disposed) return;
      disposed = true;
      rootAbort.abort();
      unsubscribeWarnings();
      for (const listener of listeners) listener();
      listeners.clear();
      statusListeners.clear();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return {
    application,
    get status() {
      return status();
    },
    readiness,
    sessionActive: () =>
      sessions.size > 0 || acquiring.size > 0 || closing.size > 0,
    subscribeStatus(listener) {
      statusListeners.add(listener);
      listener(status());
      return () => statusListeners.delete(listener);
    },
    dispose() {
      if (disposePromise !== null) return disposePromise;
      application.close();
      disposePromise = (async () => {
        await Promise.allSettled([...acquiring]);
        const closingActive = [...sessions].map((session) => session.close());
        const closed = await Promise.allSettled([...closingActive, ...closing]);
        const failed = closed.find(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        );
        if (failed !== undefined) throw failed.reason;
      })();
      return disposePromise;
    },
  };
}

async function closeModeSession(
  mode: keyof SessionByMode,
  inputs: FreeplayInputs | StoryInputs,
  lease: { release(): Promise<void> },
  flushUserWrites: () => Promise<StorageResult<void>>,
  closeFreeplayInputs: (inputs: FreeplayInputs) => void,
  closeStoryInputs: (inputs: StoryInputs) => void,
): Promise<void> {
  let failure: unknown = null;
  try {
    const flushed = await flushUserWrites();
    if (flushed.kind === "failed") failure = storageError(flushed.error);
  } catch (error) {
    failure = error;
  }
  try {
    if (mode === "freeplay") closeFreeplayInputs(inputs as FreeplayInputs);
    else closeStoryInputs(inputs as StoryInputs);
  } catch (error) {
    failure ??= error;
  }
  try {
    await lease.release();
  } catch (error) {
    failure ??= error;
  }
  if (failure !== null) throw failure;
}

function storageError(error: StorageFailure): Error {
  if (error.code === "OPERATION_CANCELLED") return abortError();
  return new Error(error.code, { cause: error });
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError();
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}
