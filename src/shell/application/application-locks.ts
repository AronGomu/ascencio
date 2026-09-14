import {
  selectionTransaction,
  type ApplicationSelection,
} from "./application-state.ts";

export const APPLICATION_LIFECYCLE_LOCK = "ygo-application-lifecycle-v1";
export const CONTENT_DOWNLOAD_LOCK = "ygo-content-download-v1";
export interface DomainSession {
  readonly selection: ApplicationSelection;
  release(): void;
}
export function applicationLocks(): LockManager {
  if (!globalThis.navigator?.locks) throw new Error("APP_STORAGE_UNAVAILABLE");
  return globalThis.navigator.locks;
}

/** Acquire before selector/readiness. Caller releases only after domain disposal and pending saves. */
export async function acquireDomainSession(
  signal: AbortSignal,
  options?: {
    readonly locks: LockManager;
    readonly selector: { read(): Promise<ApplicationSelection> };
  },
): Promise<DomainSession> {
  const locks = options?.locks ?? applicationLocks();
  const read =
    options?.selector.read ??
    (async () => (await selectionTransaction(globalThis.indexedDB))!);
  const entered = Promise.withResolvers<DomainSession>();
  const held = Promise.withResolvers<void>();
  void locks
    .request(
      APPLICATION_LIFECYCLE_LOCK,
      { mode: "shared", signal },
      async () => {
        try {
          const selection = await read();
          signal.throwIfAborted();
          entered.resolve(
            Object.freeze({ selection, release: () => held.resolve() }),
          );
          await held.promise;
        } catch (error) {
          entered.reject(error);
        }
      },
    )
    .catch((error: unknown) => entered.reject(error));
  return entered.promise;
}

export async function withContentDownloadLock<T>(
  locks: LockManager,
  work: () => Promise<T>,
): Promise<T> {
  return locks.request(
    CONTENT_DOWNLOAD_LOCK,
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      if (!lock) throw new Error("APP_DOWNLOAD_ACTIVE");
      return await work();
    },
  );
}
