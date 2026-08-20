// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import { createShellStore } from "../../src/shell/shell-store.ts";
import HomeScreen from "../../src/shell/screens/HomeScreen.svelte";

afterEach(() => {
  cleanup();
});

function query(selector: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${selector}"]`);
}

describe("HomeScreen", () => {
  it("renders the title and four entries", () => {
    render(HomeScreen, { store: createShellStore("#/", () => {}) });
    expect(query("home-title")).not.toBeNull();
    for (const entry of ["story", "decks", "duel", "settings"])
      expect(query(`home-entry-${entry}`)).not.toBeNull();
  });

  it("navigates when an entry is clicked", async () => {
    const hashes: string[] = [];
    const store = createShellStore("#/", (hash) => hashes.push(hash));
    render(HomeScreen, { store });

    await fireEvent.click(query("home-entry-duel")!);
    expect(hashes).toEqual(["#/duel"]);
    let route = "";
    store.subscribe((state) => {
      route = state.route.kind;
    })();
    expect(route).toBe("duel");
  });

  it("navigates to story and decks before those domains land", async () => {
    const hashes: string[] = [];
    render(HomeScreen, {
      store: createShellStore("#/", (hash) => hashes.push(hash)),
    });
    await fireEvent.click(query("home-entry-story")!);
    await fireEvent.click(query("home-entry-decks")!);
    expect(hashes).toEqual(["#/story", "#/decks"]);
  });

  it("opens the settings dialog from the settings entry", async () => {
    render(HomeScreen, { store: createShellStore("#/", () => {}) });
    expect(query("shell-settings-dialog")).toBeNull();
    await fireEvent.click(query("home-entry-settings")!);
    expect(query("shell-settings-dialog")).not.toBeNull();
    await fireEvent.click(query("shell-settings-close")!);
    expect(query("shell-settings-dialog")).toBeNull();
  });

  /* The browser owns fullscreen now: the menu and the settings dialog only
     point at F11 rather than offering an in-app request. */
  it("points at F11 in the menu and in the settings dialog", async () => {
    render(HomeScreen, { store: createShellStore("#/", () => {}) });
    expect(query("home-fullscreen-hint")!.textContent).toContain("F11");
    await fireEvent.click(query("home-entry-settings")!);
    expect(query("shell-settings-fullscreen-hint")!.textContent).toContain(
      "F11",
    );
  });
});
