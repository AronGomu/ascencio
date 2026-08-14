import { describe, expect, it, vi } from "vitest";
import { HOME_ROUTE } from "../../src/shell/routes.ts";
import { createShellStore } from "../../src/shell/shell-store.ts";

describe("createShellStore", () => {
  it("starts on the route parsed from the initial hash", () => {
    const setHash = vi.fn();
    const store = createShellStore("#/duel", setHash);
    const seen: string[] = [];
    store.subscribe((state) => seen.push(state.route.kind));
    expect(seen).toEqual(["duel"]);
    expect(setHash).not.toHaveBeenCalled();
  });

  it("navigates by writing the hash and updating state once", () => {
    const setHash = vi.fn();
    const store = createShellStore("#/", setHash);
    const seen: string[] = [];
    store.subscribe((state) => seen.push(state.route.kind));
    store.navigate({ kind: "decks" });
    expect(setHash).toHaveBeenCalledTimes(1);
    expect(setHash).toHaveBeenCalledWith("#/decks");
    expect(seen).toEqual(["home", "decks"]);
  });

  it("syncs from a hash without writing it back", () => {
    const setHash = vi.fn();
    const store = createShellStore("#/", setHash);
    const seen: string[] = [];
    store.subscribe((state) => seen.push(state.route.kind));
    store.syncFromHash("#/duel");
    expect(seen).toEqual(["home", "duel"]);
    expect(setHash).not.toHaveBeenCalled();
  });

  it("falls back to home for an unknown hash", () => {
    const store = createShellStore("#/nope", vi.fn());
    let route = null as unknown as { kind: string };
    store.subscribe((state) => (route = state.route));
    expect(route).toEqual(HOME_ROUTE);
  });

  it("stops notifying after unsubscribe", () => {
    const store = createShellStore("#/", vi.fn());
    const seen: string[] = [];
    const unsubscribe = store.subscribe((state) => seen.push(state.route.kind));
    unsubscribe();
    store.syncFromHash("#/duel");
    expect(seen).toEqual(["home"]);
  });
});
