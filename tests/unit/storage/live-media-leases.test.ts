import { afterEach, expect, it, vi } from "vitest";
import { SqliteImageLeasePool } from "../../../src/shell/adapters/sqlite-image-source.ts";
import type { ContentQueries } from "../../../src/storage/index.ts";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("refreshes visible replacements and missing media without reloading gameplay or leaking URLs", async () => {
  vi.useFakeTimers();
  let revision: string | null = "one";
  let id = 0;
  const create = vi
    .spyOn(URL, "createObjectURL")
    .mockImplementation(() => `blob:${++id}`);
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const query = vi.fn(async () => ({
    kind: "ok",
    value:
      revision === null
        ? null
        : {
            mime: "image/png",
            bytes: new Uint8Array([
              137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0,
              0, 0, 1, 0, 0, 0, 1,
            ]),
          },
  }));
  const stat = vi.fn(async () => revision);
  const pool = new SqliteImageLeasePool({
    query,
    mediaRevision: stat,
  } as ContentQueries);
  const lease = await pool.acquire(
    "chapter-01:map",
    { kind: "asset", packageId: "chapter-01", path: "map.png" },
    new AbortController().signal,
  );
  expect(lease?.subscribe).toBeTypeOf("function");
  const seen: string[] = [];
  const unsubscribe = lease!.subscribe!((url) => seen.push(url));
  expect(lease?.url).toBe("blob:1");
  revision = "two";
  await vi.advanceTimersByTimeAsync(2500);
  expect(lease?.url).toBe("blob:2");
  expect(revoke).toHaveBeenCalledWith("blob:1");
  revision = null;
  await vi.advanceTimersByTimeAsync(2500);
  expect(lease?.url).toBe("");
  revision = "corrected";
  await vi.advanceTimersByTimeAsync(10000);
  expect(lease?.url).toBe("blob:3");
  expect(seen).toEqual(["blob:1", "blob:2", "", "blob:3"]);
  unsubscribe();
  lease?.release();
  pool.close();
  const calls = stat.mock.calls.length;
  await vi.advanceTimersByTimeAsync(20000);
  expect(stat).toHaveBeenCalledTimes(calls);
  expect(create).toHaveBeenCalledTimes(3);
  expect(revoke).toHaveBeenCalledTimes(3);
});
