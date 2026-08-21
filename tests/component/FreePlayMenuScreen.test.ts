// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import FreePlayMenuScreen from "../../src/shell/screens/FreePlayMenuScreen.svelte";
import {
  createShellStore,
  type ShellState,
} from "../../src/shell/shell-store.ts";

function query(selector: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${selector}"]`);
}

function entryOrder(): readonly string[] {
  return [...query("free-play-menu-entries")!.querySelectorAll("button")].map(
    (button) => button.dataset.cy ?? "",
  );
}

function renderMenu() {
  const hashes: string[] = [];
  const record: ShellState[] = [];
  const onstartmatch = vi.fn();
  const store = createShellStore("#/free-play", (hash) => hashes.push(hash));
  store.subscribe((state) => record.push(state));
  render(FreePlayMenuScreen, { store, onstartmatch });
  return { hashes, onstartmatch, state: () => record[record.length - 1]! };
}

afterEach(() => {
  cleanup();
});

describe("FreePlayMenuScreen", () => {
  it("renders three entries", () => {
    renderMenu();

    expect(query("free-play-menu-screen")).not.toBeNull();
    expect(entryOrder()).toEqual([
      "free-play-start-match",
      "free-play-deck-builder",
      "free-play-return",
    ]);
  });

  it("navigates to the free-play decks from Deck builder", async () => {
    const menu = renderMenu();

    await fireEvent.click(query("free-play-deck-builder")!);

    expect(menu.hashes).toEqual(["#/free-play/decks"]);
    expect(menu.state().route).toStrictEqual({ kind: "free-play-decks" });
  });

  it("goes back to the main menu from Return", async () => {
    const menu = renderMenu();

    await fireEvent.click(query("free-play-return")!);

    expect(menu.hashes).toEqual(["#/"]);
    expect(menu.state().route).toStrictEqual({ kind: "home" });
  });

  /* The match is a state of this menu rather than a route of its own, so the
     screen asks its host to start one and the hash stays where it is. */
  it("asks its host to start a match, leaving the route alone", async () => {
    const menu = renderMenu();

    await fireEvent.click(query("free-play-start-match")!);

    expect(menu.onstartmatch).toHaveBeenCalledTimes(1);
    expect(menu.hashes).toEqual([]);
    expect(menu.state().route).toStrictEqual({ kind: "free-play" });
  });
});
