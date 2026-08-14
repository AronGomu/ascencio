// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createShellStore } from "../../src/shell/shell-store.ts";
import {
  createShellSettingsStore,
  type ShellSettingsStore,
} from "../../src/shell/settings/shell-settings-store.ts";
import type { ShellSettings } from "../../src/shell/settings/shell-settings.ts";
import HomeScreen from "../../src/shell/screens/HomeScreen.svelte";

afterEach(() => {
  cleanup();
});

function memoryStorage(seed: ShellSettings | null) {
  const entries = new Map<string, string>();
  if (seed !== null) entries.set("ygo.ui.v3", JSON.stringify(seed));
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    entries,
  };
}

function settingsOf(seed: Partial<ShellSettings>): {
  settings: ShellSettingsStore;
  storage: ReturnType<typeof memoryStorage>;
} {
  const storage = memoryStorage({
    version: 3,
    fullscreenPreferred: false,
    fullscreenTipDismissed: false,
    rotationNoticeDismissed: false,
    display: { showZoneOutlines: true, showZoneCounts: true },
    ...seed,
  });
  return { settings: createShellSettingsStore(storage), storage };
}

function query(selector: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${selector}"]`);
}

describe("HomeScreen", () => {
  it("renders the title and four entries", () => {
    const { settings } = settingsOf({});
    render(HomeScreen, {
      store: createShellStore("#/", () => {}),
      settings,
    });
    expect(query("home-title")).not.toBeNull();
    for (const entry of ["story", "decks", "duel", "settings"])
      expect(query(`home-entry-${entry}`)).not.toBeNull();
  });

  it("navigates when an entry is clicked", async () => {
    const hashes: string[] = [];
    const store = createShellStore("#/", (hash) => hashes.push(hash));
    const { settings } = settingsOf({});
    render(HomeScreen, { store, settings });

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
    const { settings } = settingsOf({});
    render(HomeScreen, {
      store: createShellStore("#/", (hash) => hashes.push(hash)),
      settings,
    });
    await fireEvent.click(query("home-entry-story")!);
    await fireEvent.click(query("home-entry-decks")!);
    expect(hashes).toEqual(["#/story", "#/decks"]);
  });

  it("opens the settings dialog from the settings entry", async () => {
    const { settings } = settingsOf({});
    render(HomeScreen, {
      store: createShellStore("#/", () => {}),
      settings,
    });
    expect(query("shell-settings-dialog")).toBeNull();
    await fireEvent.click(query("home-entry-settings")!);
    expect(query("shell-settings-dialog")).not.toBeNull();
  });

  it("persists the fullscreen preference from the settings dialog", async () => {
    const { settings, storage } = settingsOf({});
    render(HomeScreen, {
      store: createShellStore("#/", () => {}),
      settings,
    });
    await fireEvent.click(query("home-entry-settings")!);
    await fireEvent.click(query("shell-settings-fullscreen")!);
    expect(
      JSON.parse(storage.entries.get("ygo.ui.v3")!).fullscreenPreferred,
    ).toBe(true);
    await fireEvent.click(query("shell-settings-close")!);
    expect(query("shell-settings-dialog")).toBeNull();
  });

  it("hides the tip when the preference is off", () => {
    const { settings } = settingsOf({ fullscreenPreferred: false });
    render(HomeScreen, {
      store: createShellStore("#/", () => {}),
      settings,
    });
    expect(query("home-fullscreen-tip")).toBeNull();
  });

  it("shows the tip once and applies fullscreen when accepted", async () => {
    const { settings, storage } = settingsOf({ fullscreenPreferred: true });
    const requestFullscreen = vi.fn(async () => true);
    render(HomeScreen, {
      store: createShellStore("#/", () => {}),
      settings,
      requestFullscreen,
    });
    expect(query("home-fullscreen-tip")).not.toBeNull();

    await fireEvent.click(query("home-fullscreen-apply")!);
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(
      JSON.parse(storage.entries.get("ygo.ui.v3")!).fullscreenTipDismissed,
    ).toBe(true);
    expect(query("home-fullscreen-tip")).toBeNull();
  });

  it("dismisses the tip without applying fullscreen", async () => {
    const { settings, storage } = settingsOf({ fullscreenPreferred: true });
    const requestFullscreen = vi.fn(async () => true);
    render(HomeScreen, {
      store: createShellStore("#/", () => {}),
      settings,
      requestFullscreen,
    });
    await fireEvent.click(query("home-fullscreen-dismiss")!);
    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(
      JSON.parse(storage.entries.get("ygo.ui.v3")!).fullscreenTipDismissed,
    ).toBe(true);
    expect(query("home-fullscreen-tip")).toBeNull();
  });

  it("keeps the tip hidden once dismissed", () => {
    const { settings } = settingsOf({
      fullscreenPreferred: true,
      fullscreenTipDismissed: true,
    });
    render(HomeScreen, {
      store: createShellStore("#/", () => {}),
      settings,
    });
    expect(query("home-fullscreen-tip")).toBeNull();
  });
});
