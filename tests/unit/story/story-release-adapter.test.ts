import { afterEach, expect, it, vi } from "vitest";
import { SqliteImageLeasePool } from "../../../src/shell/adapters/sqlite-image-source.ts";
import { createSqliteStoryMedia } from "../../../src/shell/adapters/sqlite-story-media.ts";
import { imageQueryFixture } from "../../fixtures/sqlite-image-query.ts";

afterEach(() => vi.restoreAllMocks());
it("Shell maps chapter/set media to exact package queries; missing bytes never gate Story", async () => {
  const { query, content } = imageQueryFixture();
  const pool = new SqliteImageLeasePool(content),
    signal = new AbortController().signal;
  const media = createSqliteStoryMedia(
    pool,
    "chapter-01",
    "map.svg",
    new Set(["installed-set"]),
  );
  expect(await media.acquireMap("chapter-02", signal)).toBeNull();
  expect(await media.acquireSetImage("unknown", signal)).toBeNull();
  expect(query).not.toHaveBeenCalled();
  expect(await media.acquireMap("chapter-01", signal)).toBeNull();
  expect(await media.acquireSetImage("installed-set", signal)).toBeNull();
  expect(query.mock.calls.map(([request]) => request)).toEqual([
    { kind: "asset", packageId: "chapter-01", path: "map.svg" },
    { kind: "set-image", setId: "installed-set" },
  ]);
  pool.close();
});
it("Shell media preserves SVG MIME, idempotent leases and canonical abort", async () => {
  const { query, content } = imageQueryFixture();
  query.mockResolvedValue({
    kind: "ok",
    value: {
      mime: "image/svg+xml",
      bytes: new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg"/>',
      ),
    },
  });
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:map"),
    revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const pool = new SqliteImageLeasePool(content),
    media = createSqliteStoryMedia(pool, "chapter-01", "map.svg", new Set());
  const lease = await media.acquireMap(
    "chapter-01",
    new AbortController().signal,
  );
  expect(create.mock.calls[0]![0]).toHaveProperty("type", "image/svg+xml");
  const aborted = new AbortController();
  aborted.abort("caller reason");
  await expect(media.acquireMap("chapter-01", aborted.signal)).rejects.toEqual(
    new DOMException("The operation was aborted.", "AbortError"),
  );
  pool.close();
  lease!.release();
  lease!.release();
  expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:map");
});
