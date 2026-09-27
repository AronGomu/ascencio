import { afterEach, expect, it, vi } from "vitest";
import { cardCode } from "../../src/cards/index.ts";
import { createSqliteCardImageSource } from "../../src/shell/adapters/sqlite-image-source.ts";
import { imageQueryFixture } from "../fixtures/sqlite-image-query.ts";

afterEach(() => vi.restoreAllMocks());
it("pre-aborted acquire never queries; missing unknown card uses package placeholder without fallback", async () => {
  const { query, content } = imageQueryFixture(),
    source = createSqliteCardImageSource(content);
  const aborted = new AbortController();
  aborted.abort("caller reason");
  await expect(
    source.acquire(cardCode(1), "full", aborted.signal),
  ).rejects.toEqual(
    new DOMException("The operation was aborted.", "AbortError"),
  );
  expect(query).not.toHaveBeenCalled();
  expect(
    await source.acquire(
      cardCode(999),
      "cropped",
      new AbortController().signal,
    ),
  ).toBeNull();
  expect(query).toHaveBeenCalledExactlyOnceWith(
    { kind: "asset", packageId: "card-library", path: "cards/cropped/999.jpg" },
    expect.any(AbortSignal),
  );
  source.close();
});
it("required query errors remain visible instead of degrading storage failure to missing media", async () => {
  const { query, content } = imageQueryFixture(),
    source = createSqliteCardImageSource(content);
  query.mockResolvedValue({
    kind: "failed",
    error: { code: "STORAGE_UNAVAILABLE" },
  });
  await expect(
    source.acquire(cardCode(1), "full", new AbortController().signal),
  ).rejects.toThrow("STORAGE_UNAVAILABLE");
  source.close();
});
it("available media returns a local lease without fetching", async () => {
  const { query, content } = imageQueryFixture(),
    source = createSqliteCardImageSource(content);
  const fetch = vi.spyOn(globalThis, "fetch");
  query.mockResolvedValue({
    kind: "ok",
    value: { mime: "image/jpeg", bytes: new Uint8Array([1]) },
  });
  const lease = await source.acquire(
    cardCode(1),
    "full",
    new AbortController().signal,
  );
  expect(lease?.url).toMatch(/^blob:/);
  expect(fetch).not.toHaveBeenCalled();
  lease!.release();
  source.close();
});
