import type {
  ProgressiveContentStore,
  DownloadRequest,
  DownloadProgress,
} from "../../content/index.ts";
import { createStoryMigrationPort } from "../../story/saves/index.ts";
import type {
  ShellApplication,
  ShellDomainSession,
} from "../core/shell-application.ts";
import {
  createApplicationSelector,
  type ActivationResult,
} from "./application-selector.ts";
import { createApplicationReadiness } from "./application-readiness.ts";
import { withContentDownloadLock } from "./application-locks.ts";
import type { PreparedRelease } from "./prepared-release.ts";
import { selectedGameplay } from "./selected-gameplay.ts";

/** T10's operational seam. Content DTOs remain within Shell application/adapters. */
export function createApplicationService(options: {
  readonly factory: IDBFactory;
  readonly locks: LockManager;
  readonly store: ProgressiveContentStore;
  readonly coreContentApiVersion: number;
  readonly isHome: () => boolean;
}) {
  const listeners = new Set<() => void>();
  const channel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel("ygo-application-state-v1");
  const refresh = () => {
    for (const listener of listeners) listener();
  };
  if (channel) channel.onmessage = refresh;
  const selector = createApplicationSelector({
    ...options,
    notify: () => {
      channel?.postMessage("changed");
      refresh();
    },
    notificationError: () => console.warn("APP_NOTIFICATION_FAILED"),
  });
  const saves = createStoryMigrationPort(options.factory);
  const readiness = createApplicationReadiness({ ...options, selector, saves });
  let gameplay: {
    generation: number;
    promise: ReturnType<typeof selectedGameplay>;
  } | null = null;
  function clear() {
    readiness.clear();
    gameplay = null;
  }
  const application: ShellApplication = {
    async acquire(signal): Promise<ShellDomainSession> {
      const session = await readiness.acquire(signal);
      try {
        if (gameplay?.generation !== session.selection.generation)
          gameplay = {
            generation: session.selection.generation,
            promise: selectedGameplay(session.prepared, signal),
          };
        const installed = await gameplay.promise;
        signal.throwIfAborted();
        return {
          generation: session.selection.generation,
          gameplay: installed,
          storyRelease: session.prepared.story,
          storyCards: session.prepared.cards,
          storyMedia: session.prepared.storyMedia,
          images: session.prepared.images,
          saves: session.saves,
          close: () => session.close(),
        };
      } catch (error) {
        await session.close();
        clear();
        throw error;
      }
    },
    clear,
    close() {
      clear();
      channel?.close();
      options.store.close();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    application,
    selector,
    async activate(
      expectedGeneration: number,
      prepared: PreparedRelease,
      signal: AbortSignal,
    ): Promise<ActivationResult> {
      if (!options.isHome())
        return { kind: "blocked", code: "APP_SESSION_ACTIVE" };
      // The next locked acquire invalidates by generation. Clearing here could
      // dispose a new session already granted a shared lock after commit.
      return selector.activate(expectedGeneration, prepared, saves, signal);
    },
    download(
      request: DownloadRequest,
      signal: AbortSignal,
      onProgress: (value: DownloadProgress) => void,
    ) {
      return withContentDownloadLock(options.locks, () =>
        options.store.download(request, signal, onProgress),
      );
    },
  };
}
