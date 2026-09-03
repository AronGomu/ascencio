// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { HOME_ROUTE } from "../../src/shell/routes.ts";
import {
  createShellStore,
  writeLocationHash,
} from "../../src/shell/shell-store.ts";

describe("createShellStore", () => {
  it("starts with no previous route", () => {
    const setHash = vi.fn();
    const store = createShellStore("#/free-play", setHash);
    const seen: Array<readonly [string, string | null]> = [];
    store.subscribe((state) =>
      seen.push([state.route.kind, state.previousRoute?.kind ?? null]),
    );
    expect(seen).toEqual([["free-play", null]]);
    expect(setHash).not.toHaveBeenCalled();
  });

  it("remembers the route a navigation left", () => {
    const setHash = vi.fn();
    const store = createShellStore("#/", setHash);
    const seen: Array<readonly [string, string | null]> = [];
    store.subscribe((state) =>
      seen.push([state.route.kind, state.previousRoute?.kind ?? null]),
    );
    store.navigate({ kind: "free-play-decks" });
    expect(setHash).toHaveBeenCalledTimes(1);
    expect(setHash).toHaveBeenCalledWith("#/free-play/decks", false);
    expect(seen).toEqual([
      ["home", null],
      ["free-play-decks", "home"],
    ]);
  });

  it("does not overwrite the previous route on same-route navigation", () => {
    const store = createShellStore("#/", vi.fn());
    let previousRoute: string | null = null;
    store.subscribe(
      (state) => (previousRoute = state.previousRoute?.kind ?? null),
    );

    store.navigate({ kind: "free-play-decks" });
    store.navigate({ kind: "free-play-decks" });
    store.syncFromHash("#/free-play/decks");

    expect(previousRoute).toBe("home");
  });

  /* A route the player did not ask for — the correction a finished or
     unresumable duel makes — must not become an entry Back can return to. */
  it("remembers origin when replacement navigation is a correction", () => {
    const setHash = vi.fn();
    const store = createShellStore("#/free-play", setHash);
    const seen: Array<readonly [string, string | null]> = [];
    store.subscribe((state) =>
      seen.push([state.route.kind, state.previousRoute?.kind ?? null]),
    );
    store.navigate({ kind: "story" }, { replace: true });
    expect(setHash).toHaveBeenCalledWith("#/story", true);
    expect(seen).toEqual([
      ["free-play", null],
      ["story", "free-play"],
    ]);
  });

  it("remembers browser-driven hash transitions without writing them back", () => {
    const setHash = vi.fn();
    const store = createShellStore("#/", setHash);
    const seen: Array<readonly [string, string | null]> = [];
    store.subscribe((state) =>
      seen.push([state.route.kind, state.previousRoute?.kind ?? null]),
    );
    store.navigate({ kind: "free-play" });
    setHash.mockClear();
    store.syncFromHash("#/");
    expect(seen).toEqual([
      ["home", null],
      ["free-play", "home"],
      ["home", "free-play"],
    ]);
    expect(setHash).not.toHaveBeenCalled();
  });

  it("falls back to home for an unknown hash", () => {
    const store = createShellStore("#/nope", vi.fn());
    let route = null as unknown as { kind: string };
    store.subscribe((state) => (route = state.route));
    expect(route).toEqual(HOME_ROUTE);
  });

  /* The story opens on the screen the menu entry asked for, so the intent has
     to survive the `hashchange` the navigation itself provokes. */
  it("records which menu entry sent the player into the story", () => {
    const setHash = vi.fn();
    const store = createShellStore("#/", setHash);
    const seen: (string | null)[] = [];
    store.subscribe((state) => seen.push(state.storyEntryIntent));

    store.enterStory("new");
    store.syncFromHash("#/story");

    expect(setHash).toHaveBeenCalledWith("#/story", false);
    expect(seen).toEqual([null, "new"]);
  });

  it("does not overwrite the previous route on an intent-only change", () => {
    const store = createShellStore("#/", vi.fn());
    let previousRoute: string | null = null;
    store.subscribe(
      (state) => (previousRoute = state.previousRoute?.kind ?? null),
    );

    store.enterStory("continue");
    store.enterStory("new");

    expect(previousRoute).toBe("home");
  });

  /* Otherwise Back into the story replays the menu entry instead of resuming
     where the player left it. */
  it("drops the entry intent once the player leaves the story", () => {
    const store = createShellStore("#/", vi.fn());
    const seen: (string | null)[] = [];
    store.subscribe((state) => seen.push(state.storyEntryIntent));

    store.enterStory("continue");
    store.navigate({ kind: "free-play" });

    expect(seen).toEqual([null, "continue", null]);
  });

  it("stops notifying after unsubscribe", () => {
    const store = createShellStore("#/", vi.fn());
    const seen: string[] = [];
    const unsubscribe = store.subscribe((state) => seen.push(state.route.kind));
    unsubscribe();
    store.syncFromHash("#/free-play");
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
