import type { ProgressiveContentStore } from "../../content/index.ts";
import type {
  GenerationSaveRepository,
  StoryMigrationPort,
} from "../../story/saves/index.ts";
import { acquireDomainSession } from "./application-locks.ts";
import type {
  ApplicationSelection,
  ApplicationSelector,
} from "./application-selector.ts";
import { prepareRelease, type PreparedRelease } from "./prepared-release.ts";

export interface ReadyApplicationSession {
  readonly selection: ApplicationSelection;
  readonly prepared: PreparedRelease;
  readonly saves: GenerationSaveRepository;
  close(): Promise<void>;
}
export function createApplicationReadiness(options: {
  readonly selector: ApplicationSelector;
  readonly locks: LockManager;
  readonly store: ProgressiveContentStore;
  readonly saves: StoryMigrationPort;
  readonly coreContentApiVersion: number;
  readonly prepare?: typeof prepareRelease;
}) {
  let cached: { generation: number; promise: Promise<PreparedRelease> } | null =
    null;
  function clear(): void {
    const previous = cached;
    cached = null;
    if (previous)
      void previous.promise
        .then(
          (value) => value.dispose(),
          // acquire already reports preparation failure; there is nothing to dispose.
          () => undefined,
        )
        .catch(() => console.warn("APP_DISPOSAL_FAILED"));
  }
  return {
    clear,
    async acquire(signal: AbortSignal): Promise<ReadyApplicationSession> {
      const lease = await acquireDomainSession(signal, options);
      try {
        const { selection } = lease;
        if (!selection.content || !selection.storyGenerationId)
          throw new Error("APP_CONTENT_REQUIRED");
        if (cached?.generation !== selection.generation) {
          clear();
          const content = selection.content;
          const promise = (async () => {
            const manifest = await options.store.readManifest(
              content.manifestVersion,
            );
            if (
              manifest.coreRange.min > options.coreContentApiVersion ||
              options.coreContentApiVersion >= manifest.coreRange.maxExclusive
            )
              throw new Error("APP_CORE_INCOMPATIBLE");
            return (options.prepare ?? prepareRelease)(
              options.store,
              content,
              signal,
            );
          })();
          cached = { generation: selection.generation, promise };
        }
        const prepared = await cached.promise;
        // Mutable save slots no longer equal their original preparation seal.
        await options.saves.verifyActiveGeneration(
          selection.storyGenerationId,
          prepared.story,
        );
        signal.throwIfAborted();
        const repository = options.saves.repository(
          selection.storyGenerationId,
        );
        const pending = new Set<Promise<unknown>>();
        let closed = false;
        let closing: Promise<void> | null = null;
        const run = <T>(work: () => Promise<T>): Promise<T> => {
          if (closed) return Promise.reject(new Error("APP_SESSION_CLOSED"));
          const result = work();
          pending.add(result);
          void result.then(
            () => pending.delete(result),
            () => pending.delete(result),
          );
          return result;
        };
        return {
          selection,
          prepared,
          saves: {
            read: (slot) => run(() => repository.read(slot)),
            write: (...args) => run(() => repository.write(...args)),
            list: () => run(() => repository.list()),
            clear: (slot) => run(() => repository.clear(slot)),
          },
          close() {
            closed = true;
            return (closing ??= Promise.allSettled([...pending]).then(() =>
              lease.release(),
            ));
          },
        };
      } catch (error) {
        clear();
        lease.release();
        throw error;
      }
    },
  };
}
