import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CardImageLease,
  CardImageSource,
} from "../../src/cards/images/index.ts";
import { createCardImageSourceLibrary } from "../../src/battle/app/images/card-image-cache.ts";

const acquire = vi.fn<CardImageSource["acquire"]>();
const source: CardImageSource = { acquire };

function deferred<T>() {
  return Promise.withResolvers<T>();
}

function lease(): CardImageLease {
  return { url: "blob:installed", release: vi.fn() };
}

beforeEach(() => acquire.mockReset());

describe("semantic battle image teardown", () => {
  it("registers a deferred acquired lease before checking abort", async () => {
    const pending = deferred<CardImageLease | null>();
    acquire.mockReturnValueOnce(pending.promise);
    const controller = new AbortController();
    const loading = createCardImageSourceLibrary(
      source,
      [1],
      "a".repeat(64),
      "b".repeat(64),
      undefined,
      controller.signal,
    );
    const rejected = expect(loading).rejects.toThrow(
      "This operation was aborted",
    );
    controller.abort();
    const acquired = lease();
    pending.resolve(acquired);
    await rejected;
    expect(acquired.release).toHaveBeenCalledOnce();
    expect(acquire).toHaveBeenCalledOnce();
  });

  it("drains late sibling successes after a source failure", async () => {
    const pending = Array.from({ length: 4 }, () =>
      deferred<CardImageLease | null>(),
    );
    for (const entry of pending) acquire.mockReturnValueOnce(entry.promise);
    const loading = createCardImageSourceLibrary(
      source,
      [1, 2, 3, 4, 5],
      "a".repeat(64),
      "b".repeat(64),
    );
    let settled = false;
    const result = loading.catch((error: unknown) => {
      settled = true;
      return error;
    });
    expect(acquire).toHaveBeenCalledTimes(4);
    pending[0]!.reject(new Error("acquire failed"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const settledBeforeDrain = settled;
    const leases = pending.slice(1).map(() => lease());
    for (const [index, entry] of pending.slice(1).entries())
      entry.resolve(leases[index]!);
    expect(await result).toEqual(new Error("acquire failed"));
    expect(settledBeforeDrain).toBe(false);
    expect(acquire).toHaveBeenCalledTimes(4);
    for (const acquired of leases)
      expect(acquired.release).toHaveBeenCalledOnce();
  });

  it("releases every successful acquisition exactly once on repeated disposal", async () => {
    const leases: CardImageLease[] = [];
    acquire.mockImplementation(async () => {
      const acquired = lease();
      leases.push(acquired);
      return acquired;
    });
    const library = await createCardImageSourceLibrary(
      source,
      [1, 2, 3],
      "a".repeat(64),
      "b".repeat(64),
    );
    library.dispose();
    library.dispose();
    for (const acquired of leases)
      expect(acquired.release).toHaveBeenCalledOnce();
  });
});
