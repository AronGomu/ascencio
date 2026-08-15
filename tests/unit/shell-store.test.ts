// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { HOME_ROUTE } from "../../src/shell/routes.ts";
import {
  createShellStore,
  writeLocationHash,
} from "../../src/shell/shell-store.ts";

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
    expect(setHash).toHaveBeenCalledWith("#/decks", false);
    expect(seen).toEqual(["home", "decks"]);
  });

  /* A route the player did not ask for — the correction a finished or
     unresumable duel makes — must not become an entry Back can return to. */
  it("asks for a replacement when the navigation is a correction", () => {
    const setHash = vi.fn();
    const store = createShellStore("#/duel", setHash);
    const seen: string[] = [];
    store.subscribe((state) => seen.push(state.route.kind));
    store.navigate({ kind: "story" }, { replace: true });
    expect(setHash).toHaveBeenCalledWith("#/story", true);
    expect(seen).toEqual(["duel", "story"]);
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

describe("writeLocationHash", () => {
  it("pushes an entry the player can come back from", () => {
    const before = globalThis.history.length;
    writeLocationHash("#/duel", false);
    expect(globalThis.location.hash).toBe("#/duel");
    expect(globalThis.history.length).toBe(before + 1);
  });

  /* Without this, every correction back to the story stacks another entry on
     top of the session route, so Back re-enters the route that sent the player
     here and the entry before the duel is never reachable again. */
  it("replaces the entry it corrects instead of stacking another one", () => {
    writeLocationHash("#/story", false);
    writeLocationHash("#/duel/session/x", false);
    const before = globalThis.history.length;

    writeLocationHash("#/story", true);

    expect(globalThis.location.hash).toBe("#/story");
    expect(globalThis.history.length).toBe(before);
  });
});
