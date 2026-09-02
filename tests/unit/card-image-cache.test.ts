import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  CardImageCache,
  type ActiveImageManifest,
} from "../../src/battle/app/images/card-image-cache.ts";

const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x01, 0x03, 0x01,
  0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9,
]);

class FakeCache {
  readonly values = new Map<string, Response>();
  failWrites = false;
  failReads = false;

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    if (this.failReads) throw new Error("cache read failed");
    return this.values.get(String(request))?.clone();
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    if (this.failWrites)
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    this.values.set(String(request), response.clone());
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    return this.values.delete(String(request));
  }
}

class FakeCacheStorage {
  readonly values = new Map<string, FakeCache>();

  async open(name: string): Promise<Cache> {
    let cache = this.values.get(name);
    if (cache === undefined) {
      cache = new FakeCache();
      this.values.set(name, cache);
    }
    return cache as unknown as Cache;
  }

  async keys(): Promise<string[]> {
    return [...this.values.keys()];
  }

  async delete(name: string): Promise<boolean> {
    return this.values.delete(name);
  }
}

function imageResponse(bytes = JPEG, status = 200): Response {
  return new Response(bytes.slice(), {
    status,
    headers: { "content-type": "image/jpeg" },
  });
}

/* Creating a library also probes the packaged card back, so request counts
   assert image requests rather than every fetch the cache made. */
function imageRequests(fetch: {
  readonly mock: { readonly calls: readonly unknown[][] };
}): readonly unknown[][] {
  return fetch.mock.calls.filter(
    (call) => !String(call[0]).endsWith("card-back.jpg"),
  );
}

function fixture(
  snapshotCharacter: string,
  code = 97590747,
): { readonly manifest: ActiveImageManifest; readonly digest: string } {
  const manifest: ActiveImageManifest = {
    schemaVersion: 1,
    snapshotId: snapshotCharacter.repeat(64),
    provider: "bundled-archive",
    redistributionApproved: false,
    files: [
      {
        code,
        path: `${code}.jpg`,
        bytes: JPEG.byteLength,
        sha256: createHash("sha256").update(JPEG).digest("hex"),
      },
    ],
    missing: [],
  };
  return {
    manifest,
    digest: createHash("sha256")
      .update(`${JSON.stringify(manifest, null, 2)}\n`)
      .digest("hex"),
  };
}

describe("CardImageCache", () => {
  it("verifies active images, reuses the revisioned cache, and revokes object URLs", async () => {
    const storage = new FakeCacheStorage();
    const fetch = vi.fn<typeof globalThis.fetch>(async () => imageResponse());
    const revoke = vi.fn();
    let objectUrl = 0;
    const cache = new CardImageCache({
      applicationBaseUrl: "https://example.test/game/",
      fetch,
      cacheStorage: storage as unknown as CacheStorage,
      createObjectUrl: () => `blob:image-${++objectUrl}`,
      revokeObjectUrl: revoke,
      decodeImage: async () => undefined,
    });
    const { manifest, digest } = fixture("a");
    const first = await cache.preload(manifest, digest);
    const second = await cache.preload(manifest, digest);
    const fallback = await cache.preloadCachedSnapshot(
      manifest.snapshotId,
      digest,
    );

    expect(imageRequests(fetch)).toHaveLength(1);
    expect(first.diagnostics[0]?.status).toBe("cache-miss");
    expect(second.diagnostics[0]?.status).toBe("cache-hit");
    expect(fallback.diagnostics[0]?.status).toBe("cache-hit");
    expect(objectUrl).toBe(0);
    const firstLease = first.lease(97590747);
    const duplicateLease = first.lease(97590747);
    const sharedSnapshotLease = second.lease(97590747);
    expect(firstLease.url).toBe("blob:image-1");
    expect(duplicateLease.url).toBe(firstLease.url);
    expect(sharedSnapshotLease.url).toBe(firstLease.url);
    expect(objectUrl).toBe(1);

    firstLease.release();
    duplicateLease.release();
    expect(revoke).not.toHaveBeenCalled();
    first.dispose();
    first.dispose();
    expect(revoke).not.toHaveBeenCalled();
    sharedSnapshotLease.release();
    expect(revoke).toHaveBeenCalledTimes(1);
    second.dispose();
    fallback.dispose();
  });

  it("keeps snapshot generations isolated and revokes the replaced generation", async () => {
    const revoke = vi.fn();
    let objectUrl = 0;
    const cache = new CardImageCache({
      applicationBaseUrl: "https://example.test/game/",
      fetch: vi.fn(async () => imageResponse()),
      cacheStorage: new FakeCacheStorage() as unknown as CacheStorage,
      createObjectUrl: () => `blob:generation-${++objectUrl}`,
      revokeObjectUrl: revoke,
      decodeImage: async () => undefined,
    });
    const oldFixture = fixture("a");
    const newFixture = fixture("b");
    const oldLibrary = await cache.preload(
      oldFixture.manifest,
      oldFixture.digest,
    );
    const newLibrary = await cache.preload(
      newFixture.manifest,
      newFixture.digest,
    );
    const oldLease = oldLibrary.lease(97590747);
    const newLease = newLibrary.lease(97590747);

    expect(oldLease.url).toBe("blob:generation-1");
    expect(newLease.url).toBe("blob:generation-2");
    oldLibrary.dispose();
    expect(revoke).toHaveBeenCalledWith("blob:generation-1");
    expect(revoke).not.toHaveBeenCalledWith("blob:generation-2");
    oldLease.release();
    newLease.release();
    expect(revoke).toHaveBeenCalledWith("blob:generation-2");
  });

  it("deduplicates concurrent revision requests", async () => {
    const storage = new FakeCacheStorage();
    let release: ((response: Response) => void) | undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetch = vi.fn<typeof globalThis.fetch>(() => pending);
    const cache = new CardImageCache({
      applicationBaseUrl: "https://example.test/game/",
      fetch,
      cacheStorage: storage as unknown as CacheStorage,
      createObjectUrl: () => "blob:shared",
      revokeObjectUrl: vi.fn(),
      decodeImage: async () => undefined,
    });
    const { manifest, digest } = fixture("b");
    const first = cache.preload(manifest, digest);
    const second = cache.preload(manifest, digest);
    release?.(imageResponse());
    await Promise.all([first, second]);
    expect(imageRequests(fetch)).toHaveLength(1);
  });

  it("lets one concurrent subscriber abort without cancelling the shared fetch", async () => {
    let release: ((response: Response) => void) | undefined;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const cache = new CardImageCache({
      applicationBaseUrl: "https://example.test/game/",
      fetch: vi.fn(() => pending),
      cacheStorage: new FakeCacheStorage() as unknown as CacheStorage,
      createObjectUrl: () => "blob:shared",
      revokeObjectUrl: vi.fn(),
      decodeImage: async () => undefined,
    });
    const { manifest, digest } = fixture("b");
    const controller = new AbortController();
    const first = cache.preload(
      manifest,
      digest,
      () => undefined,
      controller.signal,
    );
    const second = cache.preload(manifest, digest);
    controller.abort(new DOMException("cancel first", "AbortError"));
    release?.(imageResponse());

    await expect(first).rejects.toThrow(/cancel first/);
    await expect(second).resolves.toMatchObject({
      snapshotId: manifest.snapshotId,
    });
  });

  it("evicts an invalid cached response and replaces it only after verification", async () => {
    const storage = new FakeCacheStorage();
    const { manifest, digest } = fixture("c");
    const cacheName = `ygo-card-images-v1-${manifest.snapshotId}-${digest}`;
    const stored = new FakeCache();
    const source = "https://example.test/game/runtime/images/97590747.jpg";
    stored.values.set(
      source,
      imageResponse(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])),
    );
    storage.values.set(cacheName, stored);
    const fetch = vi.fn<typeof globalThis.fetch>(async () => imageResponse());
    const cache = new CardImageCache({
      applicationBaseUrl: "https://example.test/game/",
      fetch,
      cacheStorage: storage as unknown as CacheStorage,
      createObjectUrl: () => "blob:verified",
      revokeObjectUrl: vi.fn(),
      decodeImage: async () => undefined,
    });

    const library = await cache.preload(manifest, digest);
    expect(imageRequests(fetch)).toHaveLength(1);
    const lease = library.lease(97590747);
    expect(lease.url).toBe("blob:verified");
    lease.release();
    expect(
      new Uint8Array(await (await stored.match(source))!.arrayBuffer()),
    ).toEqual(JPEG);
  });

  it("does not persist bytes until image decoding succeeds", async () => {
    const storage = new FakeCacheStorage();
    const { manifest, digest } = fixture("d");
    const fetch = vi.fn<typeof globalThis.fetch>(async () => imageResponse());
    const cache = new CardImageCache({
      applicationBaseUrl: "https://example.test/game/",
      fetch,
      cacheStorage: storage as unknown as CacheStorage,
      createObjectUrl: () => "blob:unused",
      revokeObjectUrl: vi.fn(),
      decodeImage: async () => {
        throw new Error("decode failed");
      },
    });

    const library = await cache.preload(manifest, digest);
    const cacheName = `ygo-card-images-v1-${manifest.snapshotId}-${digest}`;
    const source = "https://example.test/game/runtime/images/97590747.jpg";
    expect(library.diagnostics[0]).toMatchObject({ status: "missing" });
    await expect(
      storage.values.get(cacheName)?.match(source),
    ).resolves.toBeUndefined();
  });

  it("uses placeholders for declared missing images and provider failures", async () => {
    const { manifest, digest } = fixture("d");
    const missingManifest: ActiveImageManifest = {
      ...manifest,
      files: [],
      missing: [97590747],
    };
    const missingDigest = createHash("sha256")
      .update(`${JSON.stringify(missingManifest, null, 2)}\n`)
      .digest("hex");
    const noFetch = vi.fn<typeof globalThis.fetch>();
    const missingCache = new CardImageCache({
      applicationBaseUrl: "https://example.test/game/",
      fetch: noFetch,
      cacheStorage: new FakeCacheStorage() as unknown as CacheStorage,
      createObjectUrl: () => "blob:unused",
      revokeObjectUrl: vi.fn(),
      decodeImage: async () => undefined,
    });
    const missing = await missingCache.preload(missingManifest, missingDigest);
    expect(imageRequests(noFetch)).toHaveLength(0);
    const missingLease = missing.lease(97590747);
    expect(missingLease.url).toBe(missing.placeholderUrl);
    missingLease.release();

    const providerCache = new CardImageCache({
      applicationBaseUrl: "https://example.test/game/",
      fetch: vi.fn(async () => imageResponse(JPEG, 404)),
      cacheStorage: new FakeCacheStorage() as unknown as CacheStorage,
      createObjectUrl: () => "blob:unused",
      revokeObjectUrl: vi.fn(),
      decodeImage: async () => undefined,
    });
    const failed = await providerCache.preload(manifest, digest);
    expect(failed.diagnostics[0]).toMatchObject({ status: "missing" });
    const failedLease = failed.lease(97590747);
    expect(failedLease.url).toBe(failed.placeholderUrl);
    failedLease.release();
  });

  it("uses the network when an image cache read fails", async () => {
    const storage = new FakeCacheStorage();
    const { manifest, digest } = fixture("e");
    const name = `ygo-card-images-v1-${manifest.snapshotId}-${digest}`;
    const fake = new FakeCache();
    fake.failReads = true;
    storage.values.set(name, fake);
    const fetch = vi.fn(async () => imageResponse());
    const cache = new CardImageCache({
      applicationBaseUrl: "https://example.test/game/",
      fetch,
      cacheStorage: storage as unknown as CacheStorage,
      createObjectUrl: () => "blob:network-fallback",
      revokeObjectUrl: vi.fn(),
      decodeImage: async () => undefined,
    });

    const library = await cache.preload(manifest, digest);
    expect(imageRequests(fetch)).toHaveLength(1);
    const lease = library.lease(97590747);
    expect(lease.url).toBe("blob:network-fallback");
    lease.release();
  });

  it("continues with verified bytes when Cache Storage quota is exhausted", async () => {
    const storage = new FakeCacheStorage();
    const { manifest, digest } = fixture("e");
    const name = `ygo-card-images-v1-${manifest.snapshotId}-${digest}`;
    const fake = new FakeCache();
    fake.failWrites = true;
    storage.values.set(name, fake);
    const cache = new CardImageCache({
      applicationBaseUrl: "https://example.test/game/",
      fetch: vi.fn(async () => imageResponse()),
      cacheStorage: storage as unknown as CacheStorage,
      createObjectUrl: () => "blob:quota-fallback",
      revokeObjectUrl: vi.fn(),
      decodeImage: async () => undefined,
    });
    const library = await cache.preload(manifest, digest);
    const lease = library.lease(97590747);
    expect(lease.url).toBe("blob:quota-fallback");
    lease.release();
    expect(library.diagnostics[0]?.detail).toContain("Quota exceeded");
  });

  it("rejects a tampered manifest and aborts bounded preload work", async () => {
    const { manifest, digest } = fixture("f");
    const cache = new CardImageCache({
      applicationBaseUrl: "https://example.test/game/",
      fetch: vi.fn(async () => new Promise<Response>(() => undefined)),
      cacheStorage: new FakeCacheStorage() as unknown as CacheStorage,
      createObjectUrl: () => "blob:unused",
      revokeObjectUrl: vi.fn(),
      decodeImage: async () => undefined,
      imageTimeoutMs: 10,
    });
    await expect(
      cache.preload({ ...manifest, missing: [1] }, digest),
    ).rejects.toThrow("manifest digest mismatch");
    const controller = new AbortController();
    const pending = cache.preload(
      manifest,
      digest,
      undefined,
      controller.signal,
    );
    controller.abort(new DOMException("cancelled", "AbortError"));
    await expect(pending).rejects.toThrow("cancelled");
  });

  it("serves the packaged card back when the runtime asset responds", async () => {
    const { manifest, digest } = fixture("0");
    const fetch = vi.fn<typeof globalThis.fetch>(async () => imageResponse());
    const cache = new CardImageCache({
      applicationBaseUrl: "https://example.test/game/",
      fetch,
      cacheStorage: new FakeCacheStorage() as unknown as CacheStorage,
      createObjectUrl: () => "blob:unused",
      revokeObjectUrl: vi.fn(),
      decodeImage: async () => undefined,
    });

    const library = await cache.preload(manifest, digest);
    expect(library.cardBackUrl).toBe(
      "https://example.test/game/runtime/images/card-back.jpg",
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://example.test/game/runtime/images/card-back.jpg",
      expect.objectContaining({ method: "HEAD" }),
    );
  });

  it("keeps the drawn card back when the runtime asset is absent", async () => {
    const { manifest, digest } = fixture("9");
    const cache = new CardImageCache({
      applicationBaseUrl: "https://example.test/game/",
      fetch: vi.fn<typeof globalThis.fetch>(async (source) =>
        String(source).endsWith("card-back.jpg")
          ? new Response("", { status: 404 })
          : imageResponse(),
      ),
      cacheStorage: new FakeCacheStorage() as unknown as CacheStorage,
      createObjectUrl: () => "blob:unused",
      revokeObjectUrl: vi.fn(),
      decodeImage: async () => undefined,
    });

    const library = await cache.preload(manifest, digest);
    expect(library.cardBackUrl.startsWith("data:image/svg+xml,")).toBe(true);
  });

  it("keeps the drawn card back when the availability probe fails", async () => {
    const { manifest, digest } = fixture("8");
    const cache = new CardImageCache({
      applicationBaseUrl: "https://example.test/game/",
      fetch: vi.fn<typeof globalThis.fetch>(async (source) => {
        if (String(source).endsWith("card-back.jpg"))
          throw new TypeError("offline");
        return imageResponse();
      }),
      cacheStorage: new FakeCacheStorage() as unknown as CacheStorage,
      createObjectUrl: () => "blob:unused",
      revokeObjectUrl: vi.fn(),
      decodeImage: async () => undefined,
    });

    const library = await cache.preload(manifest, digest);
    expect(library.cardBackUrl.startsWith("data:image/svg+xml,")).toBe(true);
  });
});
