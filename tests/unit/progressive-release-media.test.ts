import { afterEach, expect, it, vi } from "vitest";
import { SqliteImageLeasePool } from "../../src/shell/adapters/sqlite-image-source.ts";
import { createSqliteStoryMedia } from "../../src/shell/adapters/sqlite-story-media.ts";
import { imageQueryFixture } from "../fixtures/sqlite-image-query.ts";

afterEach(() => vi.restoreAllMocks());
it("cancels an in-flight SQLite media query when the session closes", async () => {
  const { query, content } = imageQueryFixture();
  const pending = Promise.withResolvers<Awaited<ReturnType<typeof query>>>();
  query.mockReturnValue(pending.promise);
  const pool = new SqliteImageLeasePool(content);
  const media = createSqliteStoryMedia(
    pool,
    "chapter-01",
    "map.svg",
    new Set(),
  );
  const create = vi.spyOn(URL, "createObjectURL");
  const read = media.acquireMap("chapter-01", new AbortController().signal);
  const failure = expect(read).rejects.toMatchObject({ name: "AbortError" });
  pool.close();
  expect(query.mock.calls[0]![1].aborted).toBe(true);
  pending.resolve({
    kind: "ok",
    value: { mime: "image/svg+xml", bytes: new Uint8Array([1]) },
  });
  await failure;
  expect(create).not.toHaveBeenCalled();
});
