import { expect, it, vi } from "vitest";
import { LiveMediaLeases } from "../../../src/shell/adapters/live-media-leases.ts";
import type { ContentQueries } from "../../../src/storage/index.ts";
it("cancels one owner promptly while another owner retains the pending media read", async () => {
  const pending = Promise.withResolvers<string | null>();
  const query = vi.fn(async () => ({ kind: "ok", value: null }));
  const pool = new LiveMediaLeases({
    query,
    mediaRevision: () => pending.promise,
  } as ContentQueries);
  const controller = new AbortController();
  const request = {
    kind: "asset",
    packageId: "chapter-01",
    path: "map.png",
  } as const;
  const cancelled = pool.acquire("map", request, controller.signal);
  const retained = pool.acquire("map", request, new AbortController().signal);
  controller.abort();
  await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
  expect(query).not.toHaveBeenCalled();
  pending.resolve(null);
  const lease = await retained;
  expect(lease?.url).toBe("");
  lease?.release();
  pool.close();
});
