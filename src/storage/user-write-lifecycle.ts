import type { StorageFailure, StorageResult } from "./contracts/package.ts";
import type { UserDataStore } from "./contracts/user-data.ts";

const lifecycles = new WeakMap<UserDataStore, UserWriteLifecycle>();

export interface UserWriteBarrier {
  release(): void;
}

/** Adapter admission, not a lock around arbitrary raw UserDataStore calls.
 * Admit the whole queued operation once; its nested storage calls stay raw. */
export function userWriteLifecycle(store: UserDataStore): UserWriteLifecycle {
  let lifecycle = lifecycles.get(store);
  if (lifecycle === undefined) {
    lifecycle = new UserWriteLifecycle();
    lifecycles.set(store, lifecycle);
  }
  return lifecycle;
}

class UserWriteLifecycle {
  readonly #pending = new Set<Promise<void>>();
  #failure: StorageFailure | null = null;
  #barrier: Promise<unknown> | null = null;
  #closed = false;
  #closing: Promise<void> | null = null;

  run<T>(
    operation: () => Promise<T>,
    failure: (value: T) => StorageFailure | null = () => null,
  ): Promise<T> {
    if (this.#closed || this.#barrier !== null)
      return Promise.reject(
        new Error(this.#closed ? "STORAGE_UNAVAILABLE" : "STORAGE_CONFLICT"),
      );
    let result: Promise<T>;
    try {
      result = operation();
    } catch (error) {
      result = Promise.reject(error);
    }
    const pending = result
      .then(
        (value) => {
          this.#failure ??= failure(value);
        },
        (error: unknown) => {
          this.#failure ??= writeFailure(error);
        },
      )
      .then(() => {
        this.#pending.delete(pending);
      });
    this.#pending.add(pending);
    return result;
  }

  /** Reports the first unacknowledged admitted failure, including detached autosaves.
   * Calling flush acknowledges reported failures; later writes can recover. */
  async flush(): Promise<StorageResult<void>> {
    await Promise.all([...this.#pending]);
    const failure = this.#failure;
    this.#failure = null;
    return failure === null
      ? { kind: "ok", value: undefined }
      : { kind: "failed", error: failure };
  }

  /** Installs admission barrier synchronously, then drains accepted writes.
   * Caller may retain it across a failed post-restore refresh; release is idempotent. */
  async acquireBarrier(): Promise<StorageResult<UserWriteBarrier>> {
    if (this.#closed || this.#barrier !== null)
      return {
        kind: "failed",
        error: {
          code: this.#closed ? "STORAGE_UNAVAILABLE" : "STORAGE_CONFLICT",
        },
      };
    const completion = Promise.withResolvers<void>();
    this.#barrier = completion.promise;
    const release = (): void => {
      if (this.#barrier !== completion.promise) return;
      this.#barrier = null;
      completion.resolve();
    };
    const flushed = await this.flush();
    if (flushed.kind === "failed") {
      release();
      return flushed;
    }
    return { kind: "ok", value: Object.freeze({ release }) };
  }

  quiesce<T>(
    operation: () => Promise<StorageResult<T>>,
  ): Promise<StorageResult<T>> {
    return this.acquireBarrier().then(async (acquired) => {
      if (acquired.kind === "failed") return acquired;
      try {
        return await operation();
      } catch (error) {
        return { kind: "failed", error: writeFailure(error) };
      } finally {
        acquired.value.release();
      }
    });
  }

  close(terminate: () => Promise<void>): Promise<void> {
    if (this.#closing !== null) return this.#closing;
    this.#closed = true;
    const barrier = this.#barrier;
    return (this.#closing = (async () => {
      await barrier;
      const flushed = await this.flush();
      // Transport termination must run even when an accepted write failed.
      await terminate();
      if (flushed.kind === "failed")
        throw new Error(flushed.error.code, { cause: flushed.error });
    })());
  }
}

function writeFailure(error: unknown): StorageFailure {
  const cause: unknown = error instanceof Error ? error.cause : null;
  const code =
    typeof cause === "object" && cause !== null && "code" in cause
      ? cause.code
      : error instanceof Error
        ? error.message
        : null;
  switch (code) {
    case "STORAGE_CONFLICT":
    case "STORAGE_QUOTA_EXCEEDED":
    case "USER_DATA_INVALID":
    case "USER_DATA_TOO_LARGE":
    case "SQLITE_UNAVAILABLE":
      return { code };
    default:
      return { code: "STORAGE_UNAVAILABLE" };
  }
}
