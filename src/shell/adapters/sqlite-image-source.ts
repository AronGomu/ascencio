import type {
  CardImageLease,
  CardImageSource,
} from "../../cards/images/index.ts";
import type { CardCode, CardImageVariant } from "../../cards/index.ts";
import type {
  ContentQueries,
  ContentQuery,
  QueryMap,
  StorageFailure,
} from "../../storage/index.ts";

const MAXIMUM_UNLEASED_BYTES = 64 * 1024 * 1024;

interface CacheEntry {
  readonly path: string;
  readonly url: string;
  readonly bytes: number;
  leases: number;
  lastUsed: number;
  revoked: boolean;
}

interface PendingRead {
  readonly controller: AbortController;
  promise: Promise<CacheEntry | null>;
  waiters: number;
  settled: boolean;
}

export interface SqliteCardImageSource extends CardImageSource {
  close(): void;
}

export function createSqliteCardImageSource(
  content: ContentQueries,
  pool = new SqliteImageLeasePool(content),
): SqliteCardImageSource {
  return Object.freeze({
    acquire: async (
      code: CardCode,
      variant: CardImageVariant,
      signal: AbortSignal,
    ) => {
      const path = `cards/${variant}/${code}.jpg`;
      const lease = await pool.acquire(
        `card-library:${path}`,
        { kind: "asset", packageId: "card-library", path },
        signal,
      );
      if (lease !== null || variant !== "cropped") return lease;
      const fullPath = `cards/full/${code}.jpg`;
      return await pool.acquire(
        `card-library:${fullPath}`,
        { kind: "asset", packageId: "card-library", path: fullPath },
        signal,
      );
    },
    close: () => pool.close(),
  });
}

type ImageQuery = Extract<
  ContentQuery,
  { readonly kind: "asset" | "set-image" }
>;

export class SqliteImageLeasePool {
  readonly #content: ContentQueries;
  readonly #cache = new Map<string, CacheEntry>();
  readonly #pending = new Map<string, PendingRead>();
  #unleasedBytes = 0;
  #sequence = 0;
  #closed = false;

  constructor(content: ContentQueries) {
    this.#content = content;
  }

  async acquire(
    key: string,
    request: ImageQuery,
    signal: AbortSignal,
  ): Promise<CardImageLease | null> {
    if (this.#closed) throw new Error("SQLITE_IMAGE_SOURCE_CLOSED");
    throwIfAborted(signal);
    const cached = this.#cache.get(key);
    if (cached !== undefined) return this.#lease(cached);

    let pending = this.#pending.get(key);
    if (pending === undefined) {
      const controller = new AbortController();
      const created: PendingRead = {
        controller,
        waiters: 0,
        settled: false,
        promise: Promise.resolve(null),
      };
      created.promise = this.#load(key, request, controller.signal).finally(
        () => {
          created.settled = true;
          if (this.#pending.get(key) === created) this.#pending.delete(key);
        },
      );
      pending = created;
      this.#pending.set(key, created);
    }

    pending.waiters += 1;
    let entry: CacheEntry | null;
    let received = false;
    try {
      entry = await abortable(pending.promise, signal);
      received = true;
    } finally {
      pending.waiters -= 1;
      if (pending.waiters === 0) {
        if (!pending.settled) pending.controller.abort();
        else if (!received) this.#trim();
      }
    }
    if (this.#closed) {
      if (entry !== null) this.#evict(entry);
      throw new Error("SQLITE_IMAGE_SOURCE_CLOSED");
    }
    throwIfAborted(signal);
    return entry === null ? null : this.#lease(entry);
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    for (const pending of this.#pending.values()) pending.controller.abort();
    this.#pending.clear();
    for (const entry of this.#cache.values()) this.#revoke(entry);
    this.#cache.clear();
    this.#unleasedBytes = 0;
  }

  async #load(
    key: string,
    request: ImageQuery,
    signal: AbortSignal,
  ): Promise<CacheEntry | null> {
    const result = await this.#content.query(request, signal);
    if (result.kind === "failed") throw storageError(result.error);
    throwIfAborted(signal);
    const asset = result.value as QueryMap["asset"];
    if (asset === null) return null;
    const blob = new Blob([asset.bytes.slice()], { type: asset.mime });
    throwIfAborted(signal);
    if (this.#closed) throw abortError();
    const entry: CacheEntry = {
      path: key,
      url: URL.createObjectURL(blob),
      bytes: asset.bytes.byteLength,
      leases: 0,
      lastUsed: ++this.#sequence,
      revoked: false,
    };
    this.#cache.set(key, entry);
    this.#unleasedBytes += entry.bytes;
    return entry;
  }

  #lease(entry: CacheEntry): CardImageLease {
    if (entry.revoked || this.#closed)
      throw new Error("SQLITE_IMAGE_SOURCE_CLOSED");
    if (entry.leases === 0) this.#unleasedBytes -= entry.bytes;
    entry.leases += 1;
    entry.lastUsed = ++this.#sequence;
    let released = false;
    return Object.freeze({
      url: entry.url,
      release: () => {
        if (released) return;
        released = true;
        entry.leases -= 1;
        if (entry.leases === 0 && !entry.revoked) {
          entry.lastUsed = ++this.#sequence;
          this.#unleasedBytes += entry.bytes;
          this.#trim();
        }
      },
    });
  }

  #trim(): void {
    while (this.#unleasedBytes > MAXIMUM_UNLEASED_BYTES) {
      let oldest: CacheEntry | undefined;
      for (const entry of this.#cache.values())
        if (
          entry.leases === 0 &&
          !entry.revoked &&
          (oldest === undefined || entry.lastUsed < oldest.lastUsed)
        )
          oldest = entry;
      if (oldest === undefined) return;
      this.#evict(oldest);
    }
  }

  #evict(entry: CacheEntry): void {
    if (entry.revoked) return;
    if (entry.leases === 0) this.#unleasedBytes -= entry.bytes;
    this.#cache.delete(entry.path);
    this.#revoke(entry);
  }

  #revoke(entry: CacheEntry): void {
    if (entry.revoked) return;
    entry.revoked = true;
    URL.revokeObjectURL(entry.url);
  }
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(abortError());
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
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
