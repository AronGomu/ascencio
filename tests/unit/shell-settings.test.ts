import { describe, expect, it, vi } from "vitest";
import { PERSISTED_UI_STATE_KEY } from "../../src/battle/app/stores/persisted-ui-state.ts";
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

describe("shell settings", () => {
  it("defaults when storage is empty", () => {
    const settings = readShellSettings(storageOf({}));
    expect(settings).toEqual(DEFAULT_SHELL_SETTINGS);
    expect(settings.fullscreenPreferred).toBe(false);
    expect(settings.fullscreenTipDismissed).toBe(false);
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
    expect(settings.fullscreenPreferred).toBe(false);
    expect(settings.fullscreenTipDismissed).toBe(false);
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
      fullscreenPreferred: true,
      fullscreenTipDismissed: true,
      rotationNoticeDismissed: true,
      display: { showZoneOutlines: false, showZoneCounts: true },
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
      fullscreenPreferred: true,
      fullscreenTipDismissed: true,
      display: { showZoneOutlines: true, showZoneCounts: true },
    });
    expect(
      readShellSettings(storageOf({ [SHELL_SETTINGS_KEY]: withoutFlag }))
        .rotationNoticeDismissed,
    ).toBe(false);
    expect(migrateFromV2(null).rotationNoticeDismissed).toBe(false);
  });

  it("prefers the v3 payload over a stale v2 payload", () => {
    const entries = {
      [PERSISTED_UI_STATE_KEY]: JSON.stringify({
        version: 2,
        settings: { showZoneOutlines: false, showZoneCounts: false },
      }),
      [SHELL_SETTINGS_KEY]: JSON.stringify({
        version: 3,
        fullscreenPreferred: true,
        fullscreenTipDismissed: false,
        display: { showZoneOutlines: true, showZoneCounts: true },
      }),
    };
    const settings = readShellSettings(storageOf(entries));
    expect(settings.fullscreenPreferred).toBe(true);
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
