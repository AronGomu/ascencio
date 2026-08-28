import { get } from "svelte/store";
import { describe, expect, it, vi } from "vitest";
import { PERSISTED_UI_STATE_KEY } from "../../src/battle/app/stores/persisted-ui-state.ts";
import { createShellSettingsStore } from "../../src/shell/settings/shell-settings-store.ts";
import {
  DEFAULT_SHELL_SETTINGS,
  migrateFromV2,
  readShellSettings,
  SHELL_SETTINGS_KEY,
  writeShellSettings,
  type ShellSettings,
} from "../../src/shell/settings/shell-settings.ts";

function storageOf(entries: Record<string, string>): Pick<Storage, "getItem"> {
  return { getItem: (key: string) => entries[key] ?? null };
}

function liveStorage(): Pick<Storage, "getItem" | "setItem"> {
  const entries: Record<string, string> = {};
  return {
    getItem: (key: string) => entries[key] ?? null,
    setItem: (key: string, value: string) => {
      entries[key] = value;
    },
  };
}

describe("shell settings", () => {
  it("defaults when storage is empty", () => {
    expect(readShellSettings(storageOf({}))).toEqual(DEFAULT_SHELL_SETTINGS);
  });

  it("migrates v2 display settings forward", () => {
    const v2 = JSON.stringify({
      version: 2,
      windows: { zoneList: null, confirm: null },
      decks: {},
      settings: { showZoneOutlines: false, showZoneCounts: false },
    });
    const settings = readShellSettings(
      storageOf({ [PERSISTED_UI_STATE_KEY]: v2 }),
    );
    expect(settings.version).toBe(3);
    expect(settings.display).toEqual({
      showZoneOutlines: false,
      showZoneCounts: false,
    });
    expect(migrateFromV2(v2)).toEqual(settings);
  });

  it("falls back to defaults for an unknown version", () => {
    expect(
      readShellSettings(storageOf({ [SHELL_SETTINGS_KEY]: '{"version":9}' })),
    ).toEqual(DEFAULT_SHELL_SETTINGS);
    expect(migrateFromV2('{"version":9}')).toEqual(DEFAULT_SHELL_SETTINGS);
    expect(migrateFromV2(null)).toEqual(DEFAULT_SHELL_SETTINGS);
  });

  it("ignores malformed JSON", () => {
    expect(readShellSettings(storageOf({ [SHELL_SETTINGS_KEY]: "{" }))).toEqual(
      DEFAULT_SHELL_SETTINGS,
    );
  });

  it("round-trips a written value", () => {
    const entries: Record<string, string> = {};
    const value: ShellSettings = {
      version: 3,
      rotationNoticeDismissed: true,
      display: { showZoneOutlines: false, showZoneCounts: true },
      freePlayPairing: { player: "preset:nekroz", opponent: "local:mine:4" },
      freePlayOpponentId: "blaze-circuit",
      freePlayPresetFavouriteIds: ["preset:nekroz"],
    };
    writeShellSettings(
      {
        setItem: (key, serialized) => {
          entries[key] = serialized;
        },
      },
      value,
    );
    expect(readShellSettings(storageOf(entries))).toEqual(value);
  });

  /* T15: the duel's one-time rotation notice. A payload written before this
     flag existed must keep showing the notice once rather than crash or
     suppress it, so the parser defaults it rather than requiring it. */
  it("defaults the rotation notice to undismissed, including on an older v3 payload", () => {
    expect(DEFAULT_SHELL_SETTINGS.rotationNoticeDismissed).toBe(false);
    expect(readShellSettings(storageOf({})).rotationNoticeDismissed).toBe(
      false,
    );
    const withoutFlag = JSON.stringify({
      version: 3,
      display: { showZoneOutlines: true, showZoneCounts: true },
    });
    expect(
      readShellSettings(storageOf({ [SHELL_SETTINGS_KEY]: withoutFlag }))
        .rotationNoticeDismissed,
    ).toBe(false);
    expect(migrateFromV2(null).rotationNoticeDismissed).toBe(false);
  });

  /* T17: the free-play pairing. A payload written before it existed parses as
     no pairing rather than as a broken one, which is what lets the match setup
     open on the bundled defaults for an existing profile. */
  it("defaults the free-play pairing to none, including on an older v3 payload", () => {
    expect(DEFAULT_SHELL_SETTINGS.freePlayPairing).toBeNull();
    const withoutPairing = JSON.stringify({
      version: 3,
      rotationNoticeDismissed: true,
      display: { showZoneOutlines: true, showZoneCounts: true },
    });
    expect(
      readShellSettings(storageOf({ [SHELL_SETTINGS_KEY]: withoutPairing })),
    ).toEqual({ ...DEFAULT_SHELL_SETTINGS, rotationNoticeDismissed: true });
    expect(migrateFromV2(null).freePlayPairing).toBeNull();
  });

  /* Half a remembered match is a seat the player never chose, so a pairing
     that is not two keys is dropped whole rather than half-adopted. */
  it.each([
    ["a missing seat", { player: "preset:nekroz" }],
    ["a seat that is not a string", { player: "preset:nekroz", opponent: 7 }],
    ["an empty seat", { player: "", opponent: "preset:shaddoll" }],
    ["an array", ["preset:nekroz", "preset:shaddoll"]],
    ["a string", "preset:nekroz"],
  ])("drops a free-play pairing with %s", (_name, freePlayPairing) => {
    const serialized = JSON.stringify({
      version: 3,
      display: { showZoneOutlines: true, showZoneCounts: true },
      freePlayPairing,
    });
    expect(
      readShellSettings(storageOf({ [SHELL_SETTINGS_KEY]: serialized }))
        .freePlayPairing,
    ).toBeNull();
  });

  /* T19: the chosen AI opponent and the preset decks starred beside it. A
     payload written before either existed reads as "no persona remembered" and
     "nothing starred" rather than as a broken roster, so an existing profile
     opens on the default persona — whose deck is the opponent seat the duel
     menu has always fixed. */
  it("defaults the free-play opponent and preset favourites, including on an older v3 payload", () => {
    expect(DEFAULT_SHELL_SETTINGS.freePlayOpponentId).toBeNull();
    expect(DEFAULT_SHELL_SETTINGS.freePlayPresetFavouriteIds).toEqual([]);
    const withoutRoster = JSON.stringify({
      version: 3,
      rotationNoticeDismissed: true,
      display: { showZoneOutlines: true, showZoneCounts: true },
    });
    expect(
      readShellSettings(storageOf({ [SHELL_SETTINGS_KEY]: withoutRoster })),
    ).toEqual({ ...DEFAULT_SHELL_SETTINGS, rotationNoticeDismissed: true });
    expect(migrateFromV2(null).freePlayOpponentId).toBeNull();
    expect(migrateFromV2(null).freePlayPresetFavouriteIds).toEqual([]);
  });

  /* Whether a persona id still names a persona is the roster's question, not
     this one — but a shape that is not a string, or a favourites list that is
     not a list of keys, is dropped here rather than handed to a screen. */
  it.each([
    ["a number", 7, null],
    ["an empty string", "", null],
    ["an object", { id: "blaze-circuit" }, null],
  ])("drops a free-play opponent id that is %s", (_name, id, expected) => {
    const serialized = JSON.stringify({
      version: 3,
      display: { showZoneOutlines: true, showZoneCounts: true },
      freePlayOpponentId: id,
    });
    expect(
      readShellSettings(storageOf({ [SHELL_SETTINGS_KEY]: serialized }))
        .freePlayOpponentId,
    ).toBe(expected);
  });

  it("keeps only the string keys of a stored preset favourites list", () => {
    const serialized = JSON.stringify({
      version: 3,
      display: { showZoneOutlines: true, showZoneCounts: true },
      freePlayPresetFavouriteIds: ["preset:nekroz", 7, "", "preset:shaddoll"],
    });
    expect(
      readShellSettings(storageOf({ [SHELL_SETTINGS_KEY]: serialized }))
        .freePlayPresetFavouriteIds,
    ).toEqual(["preset:nekroz", "preset:shaddoll"]);
    const notAList = JSON.stringify({
      version: 3,
      display: { showZoneOutlines: true, showZoneCounts: true },
      freePlayPresetFavouriteIds: "preset:nekroz",
    });
    expect(
      readShellSettings(storageOf({ [SHELL_SETTINGS_KEY]: notAList }))
        .freePlayPresetFavouriteIds,
    ).toEqual([]);
  });

  it("prefers the v3 payload over a stale v2 payload", () => {
    const entries = {
      [PERSISTED_UI_STATE_KEY]: JSON.stringify({
        version: 2,
        settings: { showZoneOutlines: false, showZoneCounts: false },
      }),
      [SHELL_SETTINGS_KEY]: JSON.stringify({
        version: 3,
        display: { showZoneOutlines: true, showZoneCounts: true },
      }),
    };
    const settings = readShellSettings(storageOf(entries));
    expect(settings.display.showZoneOutlines).toBe(true);
  });

  it("freezes the result", () => {
    expect(Object.isFrozen(readShellSettings(storageOf({})))).toBe(true);
  });

  it("swallows a storage failure", () => {
    const setItem = vi.fn(() => {
      throw new Error("quota");
    });
    expect(() =>
      writeShellSettings({ setItem }, DEFAULT_SHELL_SETTINGS),
    ).not.toThrow();
    expect(setItem).toHaveBeenCalledOnce();
  });

  it("swallows a read failure", () => {
    expect(
      readShellSettings({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toEqual(DEFAULT_SHELL_SETTINGS);
  });
});

/* T19: the two free-play choices the roster screen persists. Both go through
   the same `persist()` the pairing uses, so a storage write and the live store
   never disagree about what was chosen. */
describe("the shell settings store", () => {
  it("remembers a chosen free-play opponent across a reload", () => {
    const storage = liveStorage();
    const store = createShellSettingsStore(storage);
    expect(get(store).freePlayOpponentId).toBeNull();
    store.rememberFreePlayOpponent("blaze-circuit");
    expect(get(store).freePlayOpponentId).toBe("blaze-circuit");
    expect(readShellSettings(storage).freePlayOpponentId).toBe("blaze-circuit");
    expect(get(createShellSettingsStore(storage)).freePlayOpponentId).toBe(
      "blaze-circuit",
    );
  });

  it("adds and removes a preset deck favourite", () => {
    const storage = liveStorage();
    const store = createShellSettingsStore(storage);
    store.setPresetDeckFavourite("preset:nekroz", true);
    expect(get(store).freePlayPresetFavouriteIds).toEqual(["preset:nekroz"]);
    store.setPresetDeckFavourite("preset:nekroz", true);
    expect(get(store).freePlayPresetFavouriteIds).toEqual(["preset:nekroz"]);
    expect(readShellSettings(storage).freePlayPresetFavouriteIds).toEqual([
      "preset:nekroz",
    ]);
    store.setPresetDeckFavourite("preset:nekroz", false);
    expect(get(store).freePlayPresetFavouriteIds).toEqual([]);
    expect(readShellSettings(storage).freePlayPresetFavouriteIds).toEqual([]);
  });

  it("keeps working without storage", () => {
    const store = createShellSettingsStore(null);
    store.rememberFreePlayOpponent("practice-bot");
    store.setPresetDeckFavourite("preset:shaddoll", true);
    expect(get(store).freePlayOpponentId).toBe("practice-bot");
    expect(get(store).freePlayPresetFavouriteIds).toEqual(["preset:shaddoll"]);
  });
});
