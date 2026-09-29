import { afterEach, expect, it, vi } from "vitest";
import { cardCode } from "../../src/cards/index.ts";
import { createSqliteCardImageSource } from "../../src/shell/adapters/sqlite-image-source.ts";
import { imageQueryFixture } from "../fixtures/sqlite-image-query.ts";

afterEach(() => vi.restoreAllMocks());
it("verified media stays local; cached leases share one query and revoke once on session close", async () => {
  const { query, content } = imageQueryFixture();
  query.mockResolvedValue({
    kind: "ok",
    value: { mime: "image/jpeg", bytes: new Uint8Array([1]) },
  });
  const fetch = vi.spyOn(globalThis, "fetch");
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const source = createSqliteCardImageSource(content),
    signal = new AbortController().signal;
  const first = await source.acquire(cardCode(1), "full", signal);
  const second = await source.acquire(cardCode(1), "full", signal);
  expect(first?.url).toBe("blob:local");
  expect(query).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
  source.close();
  first!.release();
  second!.release();
  expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:local");
});
it("closed old session cannot publish a late URL or revoke a new session lease", async () => {
  const old = imageQueryFixture(),
    current = imageQueryFixture();
  const pending =
    Promise.withResolvers<Awaited<ReturnType<typeof old.query>>>();
  old.query.mockReturnValue(pending.promise);
  current.query.mockResolvedValue({
    kind: "ok",
    value: { mime: "image/jpeg", bytes: new Uint8Array([1]) },
  });
  const url = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:current");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const previous = createSqliteCardImageSource(old.content),
    next = createSqliteCardImageSource(current.content);
  const read = previous.acquire(
    cardCode(1),
    "full",
    new AbortController().signal,
  );
  const failed = expect(read).rejects.toMatchObject({ name: "AbortError" });
  previous.close();
  const lease = await next.acquire(
    cardCode(1),
    "full",
    new AbortController().signal,
  );
  pending.resolve({
    kind: "ok",
    value: { mime: "image/jpeg", bytes: new Uint8Array([1]) },
  });
  await failed;
  expect(url).toHaveBeenCalledOnce();
  expect(revoke).not.toHaveBeenCalled();
  lease!.release();
  next.close();
  expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:current");
});
