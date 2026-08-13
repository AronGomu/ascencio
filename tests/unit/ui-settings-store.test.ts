import { get } from "svelte/store";
import { describe, expect, it } from "vitest";
import {
  createUiSettingsStore,
  DEFAULT_UI_SETTINGS,
} from "../../src/app/stores/ui-settings-store.ts";

describe("createUiSettingsStore", () => {
  it("defaults hide both panels and enable both automations", () => {
    const store = createUiSettingsStore();
    expect(get(store)).toEqual({
      showDuelHud: false,
      showWorkspace: false,
      autoPlaceCards: true,
      autoResolveTrivialPrompts: true,
      showZoneOutlines: true,
      showZoneCounts: true,
    });
  });

  it("setShowDuelHud flips only its own flag", () => {
    const store = createUiSettingsStore();
    store.setShowDuelHud(true);
    expect(get(store)).toEqual({
      showDuelHud: true,
      showWorkspace: false,
      autoPlaceCards: true,
      autoResolveTrivialPrompts: true,
      showZoneOutlines: true,
      showZoneCounts: true,
    });
  });

  it("setShowWorkspace flips only its own flag", () => {
    const store = createUiSettingsStore();
    store.setShowWorkspace(true);
    expect(get(store)).toEqual({
      showDuelHud: false,
      showWorkspace: true,
      autoPlaceCards: true,
      autoResolveTrivialPrompts: true,
      showZoneOutlines: true,
      showZoneCounts: true,
    });
  });

  it("setAutoPlaceCards flips only its own flag", () => {
    const store = createUiSettingsStore();
    store.setAutoPlaceCards(false);
    expect(get(store)).toEqual({
      showDuelHud: false,
      showWorkspace: false,
      autoPlaceCards: false,
      autoResolveTrivialPrompts: true,
      showZoneOutlines: true,
      showZoneCounts: true,
    });
  });

  it("setAutoResolveTrivialPrompts flips only its own flag", () => {
    const store = createUiSettingsStore();
    store.setAutoResolveTrivialPrompts(false);
    expect(get(store)).toEqual({
      showDuelHud: false,
      showWorkspace: false,
      autoPlaceCards: true,
      autoResolveTrivialPrompts: false,
      showZoneOutlines: true,
      showZoneCounts: true,
    });
  });

  it("sets each UI display flag independently", () => {
    const store = createUiSettingsStore();
    store.setShowZoneOutlines(false);
    expect(get(store)).toMatchObject({
      showZoneOutlines: false,
      showZoneCounts: true,
    });
    expect(Object.isFrozen(get(store))).toBe(true);
    store.setShowZoneCounts(false);
    expect(get(store)).toMatchObject({
      showZoneOutlines: false,
      showZoneCounts: false,
    });
  });

  it("reset returns to defaults", () => {
    const store = createUiSettingsStore();
    store.setShowDuelHud(true);
    store.setShowWorkspace(true);
    store.reset();
    expect(get(store)).toEqual(DEFAULT_UI_SETTINGS);
  });
});
