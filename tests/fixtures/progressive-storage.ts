import { deleteDB, openDB } from "idb";

export const PROGRESSIVE_DATABASE_NAME = "ygo-content-files-v1";
export const PROGRESSIVE_CACHE_NAME = "ygo-content-files-v1";

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export class TestCache {
  readonly entries = new Map<string, Response>();
  failAfterPut = false;
  failedPutKey: string | null = null;

  async match(input: RequestInfo | URL): Promise<Response | undefined> {
    return this.entries.get(requestUrl(input))?.clone();
  }

  async put(input: RequestInfo | URL, response: Response): Promise<void> {
    const key = requestUrl(input);
    this.entries.set(key, response.clone());
    if (this.failAfterPut) {
      this.failAfterPut = false;
      this.failedPutKey = key;
      throw new DOMException("fixture quota", "QuotaExceededError");
    }
  }

  async delete(input: RequestInfo | URL): Promise<boolean> {
    return this.entries.delete(requestUrl(input));
  }

  async keys(): Promise<readonly Request[]> {
    return [...this.entries.keys()].map((url) => new Request(url));
  }
}

export class TestLockManager {
  readonly requests: string[] = [];
  readonly held = new Set<string>();

  hold(name: string): () => void {
    this.held.add(name);
    return () => this.held.delete(name);
  }

  async request<T>(
    name: string,
    options: LockOptions,
    callback: (lock: Lock | null) => T | PromiseLike<T>,
  ): Promise<T> {
    this.requests.push(name);
    if (this.held.has(name)) {
      if (options.ifAvailable) return callback(null);
      throw new Error("Test lock wait not supported");
    }
    this.held.add(name);
    try {
      return await callback({ name, mode: options.mode ?? "exclusive" });
    } finally {
      this.held.delete(name);
    }
  }
}

export class TestCacheStorage {
  readonly stores = new Map<string, TestCache>();

  async open(name: string): Promise<Cache> {
    let cache = this.stores.get(name);
    if (!cache) {
      cache = new TestCache();
      this.stores.set(name, cache);
    }
    return cache as unknown as Cache;
  }

  async delete(name: string): Promise<boolean> {
    return this.stores.delete(name);
  }

  cache(name = PROGRESSIVE_CACHE_NAME): TestCache {
    const cache = this.stores.get(name);
    if (!cache) throw new Error(`Cache not open: ${name}`);
    return cache;
  }
}

export async function resetProgressiveStorage(
  cacheStorage: TestCacheStorage,
): Promise<void> {
  await deleteDB(PROGRESSIVE_DATABASE_NAME);
  await cacheStorage.delete(PROGRESSIVE_CACHE_NAME);
}

export async function progressiveDatabaseSnapshot(): Promise<{
  readonly stores: readonly string[];
  readonly manifests: readonly unknown[];
  readonly files: readonly unknown[];
  readonly jobs: readonly unknown[];
  readonly receipts: readonly unknown[];
}> {
  const db = await openDB(PROGRESSIVE_DATABASE_NAME);
  try {
    return {
      stores: [...db.objectStoreNames].sort(),
      manifests: await db.getAll("manifests"),
      files: await db.getAll("files"),
      jobs: await db.getAll("jobs"),
      receipts: await db.getAll("receipts"),
    };
  } finally {
    db.close();
  }
}
