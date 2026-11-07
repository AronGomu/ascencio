import { afterEach, describe, expect, it, vi } from "vitest";
import { cardCode } from "../../../src/cards/index.ts";
import { createSqliteCardImageSource } from "../../../src/shell/adapters/sqlite-image-source.ts";
import type {
  ContentQueries,
  ContentQuery,
  QueryMap,
  StorageResult,
} from "../../../src/storage/index.ts";

function ok<T>(value: T): StorageResult<T> {
  return { kind: "ok", value };
}

function contentQuery(
  query: (
    request: ContentQuery,
    signal: AbortSignal,
  ) => Promise<StorageResult<unknown>>,
): ContentQueries {
  return { query } as ContentQueries;
}

function asset(bytes: number): QueryMap["asset"] {
  return { mime: "image/jpeg", bytes: new Uint8Array(bytes) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

afterEach(() => vi.restoreAllMocks());

describe("SQLite card image source", () => {
  it("loads no media until acquire and maps card variants to package paths", async () => {
    const query = vi.fn(async (request: ContentQuery) => {
      expect(request).toEqual({
        kind: "asset",
        packageId: "card-library",
        path: "cards/cropped/42.jpg",
      });
      return ok(asset(4));
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:card-42");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const source = createSqliteCardImageSource(contentQuery(query));

    expect(query).not.toHaveBeenCalled();
    const lease = await source.acquire(
      cardCode(42),
      "cropped",
      new AbortController().signal,
    );
    expect(lease?.url).toBe("blob:card-42");
    expect(query).toHaveBeenCalledTimes(1);
    expect(revoke).not.toHaveBeenCalled();

    lease?.release();
    source.close();
    expect(revoke).toHaveBeenCalledOnce();
  });

  it("shares one pending read while cancellation only removes its caller", async () => {
    const pending = deferred<StorageResult<QueryMap["asset"]>>();
    const query = vi.fn((_request: ContentQuery, signal: AbortSignal) => {
      expect(signal.aborted).toBe(false);
      return pending.promise;
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:shared");
    const source = createSqliteCardImageSource(contentQuery(query));
    const first = new AbortController();
    const second = new AbortController();

    const cancelled = source.acquire(cardCode(7), "full", first.signal);
    const retained = source.acquire(cardCode(7), "full", second.signal);
    first.abort();
    pending.resolve(ok(asset(3)));

    await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
    const lease = await retained;
    expect(lease?.url).toBe("blob:shared");
    expect(query).toHaveBeenCalledTimes(1);
    lease?.release();
    source.close();
  });

  it("starts a fresh shared read after every prior caller cancels, despite a delayed native reply", async () => {
    const oldReply = deferred<StorageResult<QueryMap["asset"]>>();
    const freshReply = deferred<StorageResult<QueryMap["asset"]>>();
    const signals: AbortSignal[] = [];
    const query = vi.fn((_request: ContentQuery, signal: AbortSignal) => {
      signals.push(signal);
      // Native IPC can complete after its caller's signal has been aborted.
      return signals.length === 1 ? oldReply.promise : freshReply.promise;
    });
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:fresh");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const source = createSqliteCardImageSource(contentQuery(query));
    const first = new AbortController();
    const cancelled = source.acquire(cardCode(7), "full", first.signal);
    first.abort();
    await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
    expect(signals[0]?.aborted).toBe(true);

    const fresh = Promise.allSettled([
      source.acquire(cardCode(7), "full", new AbortController().signal),
      source.acquire(cardCode(7), "full", new AbortController().signal),
    ]);
    const readsBeforeOldReply = query.mock.calls.length;
    oldReply.resolve(ok(asset(3)));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const urlsAfterOldReply = create.mock.calls.length;

    // The old read's finally must not remove the replacement pending read.
    const later = Promise.allSettled([
      source.acquire(cardCode(7), "full", new AbortController().signal),
    ]);
    freshReply.resolve(ok(asset(4)));
    const results = [...(await fresh), ...(await later)];
    for (const result of results)
      if (result.status === "fulfilled") result.value?.release();
    source.close();

    expect(readsBeforeOldReply).toBe(2);
    expect(query).toHaveBeenCalledTimes(2);
    expect(signals[1]?.aborted).toBe(false);
    expect(urlsAfterOldReply).toBe(0);
    expect(results).toEqual(
      Array.from({ length: 3 }, () => ({
        status: "fulfilled",
        value: { url: "blob:fresh", release: expect.any(Function) },
      })),
    );
    expect(create).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:fresh");
  });

  it("bounds unleased cache to 64 MiB and never evicts active leases", async () => {
    let created = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(
      () => `blob:${++created}`,
    );
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const query = vi.fn(async (request: ContentQuery) =>
      ok(
        asset(
          request.kind === "asset" && request.path.includes("/1.")
            ? 40 * 1024 * 1024
            : 30 * 1024 * 1024,
        ),
      ),
    );
    const source = createSqliteCardImageSource(contentQuery(query));
    const first = await source.acquire(
      cardCode(1),
      "full",
      new AbortController().signal,
    );
    first?.release();
    const second = await source.acquire(
      cardCode(2),
      "full",
      new AbortController().signal,
    );

    expect(revoke).not.toHaveBeenCalled();
    second?.release();
    expect(revoke).toHaveBeenCalledWith("blob:1");
    expect(revoke).not.toHaveBeenCalledWith("blob:2");

    const loadedAgain = await source.acquire(
      cardCode(1),
      "full",
      new AbortController().signal,
    );
    expect(query).toHaveBeenCalledTimes(3);
    loadedAgain?.release();
    source.close();
  });

  it("returns null for optional missing media without creating a URL", async () => {
    const create = vi.spyOn(URL, "createObjectURL");
    const source = createSqliteCardImageSource(
      contentQuery(async () => ok(null)),
    );
    await expect(
      source.acquire(cardCode(9), "full", new AbortController().signal),
    ).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
    source.close();
  });

  it("aborts pending reads and revokes active URLs on mode close", async () => {
    const query = vi.fn(
      (_request: ContentQuery, signal: AbortSignal) =>
        new Promise<StorageResult<QueryMap["asset"]>>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () =>
              reject(
                new DOMException("The operation was aborted.", "AbortError"),
              ),
            { once: true },
          );
        }),
    );
    const source = createSqliteCardImageSource(contentQuery(query));
    const acquiring = source.acquire(
      cardCode(11),
      "full",
      new AbortController().signal,
    );
    source.close();
    await expect(acquiring).rejects.toMatchObject({ name: "AbortError" });
    await expect(
      source.acquire(cardCode(11), "full", new AbortController().signal),
    ).rejects.toThrow("SQLITE_IMAGE_SOURCE_CLOSED");
  });
});

it("keeps a missing cropped illustration missing even when full art exists", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:full-fallback");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const query = vi.fn(async (request: ContentQuery) =>
    ok(
      request.kind === "asset" && request.path.includes("/full/")
        ? asset(8)
        : null,
    ),
  );
  const source = createSqliteCardImageSource(contentQuery(query));
  const lease = await source.acquire(
    cardCode(42),
    "cropped",
    new AbortController().signal,
  );
  expect(lease).toBeNull();
  expect(
    query.mock.calls.map(([request]) =>
      request.kind === "asset" ? request.path : null,
    ),
  ).toEqual(["cards/cropped/42.jpg"]);
  lease?.release();
  source.close();
});
