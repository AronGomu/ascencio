import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CardImageLease,
  CardImageSource,
} from "../../src/cards/images/index.ts";
import { createCardImageSourceLibrary } from "../../src/battle/app/images/card-image-cache.ts";

const acquire = vi.fn<CardImageSource["acquire"]>();
const source: CardImageSource = { acquire };
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const create = (codes = [1, 2, 3], signal?: AbortSignal) =>
  createCardImageSourceLibrary(
    source,
    codes,
    "a".repeat(64),
    "b".repeat(64),
    undefined,
    signal,
  );
function lease(url = "blob:installed"): CardImageLease {
  return { url, release: vi.fn() };
}
beforeEach(() => acquire.mockReset());

describe("semantic battle image teardown", () => {
  it("never acquires catalog images before a mounted lease exists", async () => {
    acquire.mockImplementation(async () => lease());
    const library = await create();
    expect(acquire).not.toHaveBeenCalled();
    library.dispose();
  });

  it("releases underlying art immediately after the last mounted owner", async () => {
    const acquired = lease();
    acquire.mockResolvedValue(acquired);
    const library = await create([1]);
    const first = library.lease(1);
    const second = library.lease(1);
    await settle();
    expect(acquire).toHaveBeenCalledOnce();
    first.release();
    expect(acquired.release).not.toHaveBeenCalled();
    second.release();
    expect(acquired.release).toHaveBeenCalledOnce();
    library.dispose();
    expect(acquired.release).toHaveBeenCalledOnce();
  });

  it("releases a deferred acquired lease after mount abort", async () => {
    const pending = Promise.withResolvers<CardImageLease | null>();
    acquire.mockReturnValueOnce(pending.promise);
    const controller = new AbortController();
    const library = await create([1], controller.signal);
    const handle = library.lease(1);
    const changed = vi.fn();
    handle.subscribe!(changed);
    controller.abort();
    expect(acquire.mock.calls[0]![2].aborted).toBe(true);
    const acquired = lease();
    pending.resolve(acquired);
    await settle();
    expect(acquired.release).toHaveBeenCalledOnce();
    expect(changed.mock.calls).toEqual([[library.placeholderUrl]]);
    expect(handle.url).toBe(library.placeholderUrl);
    expect(acquire).toHaveBeenCalledOnce();
  });

  it("drains late sibling successes after a source failure and disposal", async () => {
    const pending = Array.from({ length: 4 }, () =>
      Promise.withResolvers<CardImageLease | null>(),
    );
    for (const entry of pending) acquire.mockReturnValueOnce(entry.promise);
    const library = await create([1, 2, 3, 4, 5]);
    for (const code of [1, 2, 3, 4]) library.lease(code);
    expect(acquire).toHaveBeenCalledTimes(4);
    pending[0]!.reject(new Error("acquire failed"));
    await settle();
    expect(library.diagnostics).toEqual([
      {
        code: 1,
        status: "missing",
        source: "semantic-card-image-source",
        detail: "acquire failed",
      },
    ]);
    library.dispose();
    const leases = pending.slice(1).map(() => lease());
    for (const [index, entry] of pending.slice(1).entries())
      entry.resolve(leases[index]!);
    await settle();
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
    const library = await create();
    const handles = [1, 2, 3].map((code) => library.lease(code));
    await settle();
    expect(leases).toHaveLength(3);
    library.dispose();
    library.dispose();
    for (const handle of handles) handle.release();
    for (const acquired of leases)
      expect(acquired.release).toHaveBeenCalledOnce();
  });

  it("delivers an immediate snapshot then readiness without notifying released or unsubscribed owners", async () => {
    const pending = Promise.withResolvers<CardImageLease | null>();
    acquire.mockReturnValue(pending.promise);
    const library = await create([1]);
    const first = library.lease(1);
    const second = library.lease(1);
    const third = library.lease(1);
    const firstChanged = vi.fn(),
      secondChanged = vi.fn(),
      thirdChanged = vi.fn();
    expect(first.url).toBe(library.placeholderUrl);
    first.subscribe!(firstChanged);
    second.subscribe!(secondChanged);
    const unsubscribe = third.subscribe!(thirdChanged);
    unsubscribe();
    unsubscribe();
    second.release();
    second.release();
    pending.resolve(lease());
    await settle();
    expect(firstChanged.mock.calls).toEqual([
      [library.placeholderUrl],
      ["blob:installed"],
    ]);
    expect(secondChanged.mock.calls).toEqual([[library.placeholderUrl]]);
    expect(thirdChanged.mock.calls).toEqual([[library.placeholderUrl]]);
    const afterReady = vi.fn();
    first.subscribe!(afterReady);
    expect(afterReady).toHaveBeenCalledExactlyOnceWith("blob:installed");
    first.release();
    first.subscribe!(afterReady);
    expect(afterReady).toHaveBeenCalledOnce();
    library.dispose();
  });

  it("counts obsolete unresolved acquisitions toward four and cancels obsolete queued work", async () => {
    const pending = Array.from({ length: 5 }, () =>
      Promise.withResolvers<CardImageLease | null>(),
    );
    for (const entry of pending) acquire.mockReturnValueOnce(entry.promise);
    const library = await create([1, 2, 3, 4, 5, 6]);
    const handles = [1, 2, 3, 4, 5].map((code) => library.lease(code));
    expect(acquire).toHaveBeenCalledTimes(4);
    for (const handle of handles) handle.release();
    library.lease(6);
    expect(acquire).toHaveBeenCalledTimes(4);
    expect(acquire.mock.calls.every(([, , signal]) => signal.aborted)).toBe(
      true,
    );
    const late = lease("blob:late");
    pending[0]!.resolve(late);
    await settle();
    expect(late.release).toHaveBeenCalledOnce();
    expect(acquire.mock.calls.map(([code]) => Number(code))).toEqual([
      1, 2, 3, 4, 6,
    ]);
    library.dispose();
    for (const entry of pending.slice(1)) entry.resolve(null);
    await settle();
  });

  it("shares four acquisition slots across replacement libraries without sharing leases", async () => {
    const pending = Array.from({ length: 5 }, () =>
      Promise.withResolvers<CardImageLease | null>(),
    );
    for (const entry of pending) acquire.mockReturnValueOnce(entry.promise);
    const old = await create([1, 2, 3, 4]);
    for (const code of [1, 2, 3, 4]) old.lease(code);
    old.dispose();
    const fresh = await create([1]);
    const handle = fresh.lease(1);
    expect(acquire).toHaveBeenCalledTimes(4);
    const obsolete = lease("blob:old");
    pending[0]!.resolve(obsolete);
    await settle();
    expect(acquire).toHaveBeenCalledTimes(5);
    expect(obsolete.release).toHaveBeenCalledOnce();
    const current = lease("blob:current");
    pending[4]!.resolve(current);
    for (const item of pending.slice(1, 4)) item.resolve(null);
    await settle();
    expect(handle.url).toBe("blob:current");
    expect(current.release).not.toHaveBeenCalled();
    fresh.dispose();
    expect(current.release).toHaveBeenCalledOnce();
  });

  it("reacquires only after the final owner leaves and cannot publish an old result into its replacement", async () => {
    const old = Promise.withResolvers<CardImageLease | null>();
    const fresh = Promise.withResolvers<CardImageLease | null>();
    acquire.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const library = await create([1]);
    const previous = library.lease(1);
    previous.release();
    const current = library.lease(1);
    const changed = vi.fn();
    current.subscribe!(changed);
    const obsolete = lease("blob:obsolete");
    old.resolve(obsolete);
    fresh.resolve(lease("blob:fresh"));
    await settle();
    expect(obsolete.release).toHaveBeenCalledOnce();
    expect(changed.mock.calls).toEqual([
      [library.placeholderUrl],
      ["blob:fresh"],
    ]);
    expect(current.url).toBe("blob:fresh");
    library.dispose();
  });

  it("uses deterministic placeholders for missing/error/unknown codes without network fallback", async () => {
    acquire
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("cache unavailable"));
    const library = await create();
    const missing = library.lease(1),
      failed = library.lease(2),
      unknown = library.lease(99);
    await settle();
    expect([missing.url, failed.url, unknown.url]).toEqual(
      Array(3).fill(library.placeholderUrl),
    );
    expect(acquire).toHaveBeenCalledTimes(2);
    expect(
      library.diagnostics.map(({ code, status }) => ({ code, status })),
    ).toEqual([
      { code: 1, status: "missing" },
      { code: 2, status: "missing" },
    ]);
    library.dispose();
    library.lease(3);
    expect(acquire).toHaveBeenCalledTimes(2);
  });

  it("rejects an already aborted factory without source work", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(create([1], controller.signal)).rejects.toThrow(
      "This operation was aborted",
    );
    expect(acquire).not.toHaveBeenCalled();
  });
});
