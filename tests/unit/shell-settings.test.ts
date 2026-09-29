import { get } from "svelte/store";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createShellSettingsStore } from "../../src/shell/settings/shell-settings-store.ts";
import {
  DEFAULT_SHELL_SETTINGS,
  type ShellSettings,
} from "../../src/shell/settings/shell-settings.ts";
import { sqliteStoryReader } from "../fixtures/sqlite-story-reader.ts";

const fixtures: ReturnType<typeof sqliteStoryReader>[] = [];
afterEach(async () => {
  for (const fixture of fixtures.splice(0)) await fixture.close();
});
function fixture(fault?: (point: string) => void) {
  const value = sqliteStoryReader(fault);
  fixtures.push(value);
  return value;
}

const VALUE: ShellSettings = {
  ...DEFAULT_SHELL_SETTINGS,
  rotationNoticeDismissed: true,
  display: { ...DEFAULT_SHELL_SETTINGS.display, showZoneOutlines: false },
  freePlayPairing: { player: "preset:nekroz", opponent: "local:mine:4" },
  freePlayOpponentId: "blaze-circuit",
};

const malformed = [
  ["unknown version", { ...VALUE, version: 9 }],
  ...["rotationNoticeDismissed", "freePlayPairing", "freePlayOpponentId"].map<
    readonly [string, unknown]
  >((key) => [
    `missing ${key}`,
    Object.fromEntries(Object.entries(VALUE).filter(([name]) => name !== key)),
  ]),
  ...[
    ["a missing seat", { player: "preset:nekroz" }],
    ["a seat that is not a string", { player: "preset:nekroz", opponent: 7 }],
    ["an empty seat", { player: "", opponent: "preset:shaddoll" }],
    ["an array", ["preset:nekroz", "preset:shaddoll"]],
    ["a string", "preset:nekroz"],
  ].map<readonly [string, unknown]>(([name, freePlayPairing]) => [
    `pairing with ${name}`,
    { ...VALUE, freePlayPairing },
  ]),
  ...[7, "", { id: "blaze-circuit" }].map<readonly [string, unknown]>(
    (freePlayOpponentId) => [
      `opponent ${JSON.stringify(freePlayOpponentId)}`,
      { ...VALUE, freePlayOpponentId },
    ],
  ),
  ...[["preset:nekroz", "preset:shaddoll"], "preset:nekroz"].map<
    readonly [string, unknown]
  >((freePlayPresetFavouriteIds) => [
    `obsolete favourites ${JSON.stringify(freePlayPresetFavouriteIds)}`,
    { ...VALUE, freePlayPresetFavouriteIds },
  ]),
] as const;

describe("shell settings", () => {
  it("defaults when the SQLite row is absent without writing it", async () => {
    const { preferences, runtime } = fixture();
    expect(await preferences.shell.read()).toEqual(DEFAULT_SHELL_SETTINGS);
    expect(DEFAULT_SHELL_SETTINGS).toMatchObject({
      rotationNoticeDismissed: false,
      freePlayPairing: null,
      freePlayOpponentId: null,
    });
    expect(await runtime.readUser("preferences", "shell")).toEqual({
      kind: "ok",
      value: null,
    });
  });

  it("round-trips a written value through SQLite", async () => {
    const { preferences, runtime } = fixture();
    expect(await preferences.shell.update(VALUE)).toEqual({
      kind: "ok",
      value: VALUE,
    });
    expect(await preferences.shell.flush()).toEqual({
      kind: "ok",
      value: undefined,
    });
    expect(await preferences.shell.read()).toEqual(VALUE);
    expect(await runtime.readUser("preferences", "shell")).toMatchObject({
      kind: "ok",
      value: { revision: 1, payload: VALUE },
    });
  });

  it.each(malformed)(
    "rejects malformed current payload: %s",
    async (_name, payload) => {
      const { runtime, preferences, database } = fixture();
      expect(
        await runtime.writeUser([
          {
            kind: "put",
            namespace: "preferences",
            key: "shell",
            expectedRevision: null,
            payload,
          },
        ]),
      ).toEqual({ kind: "failed", error: { code: "USER_DATA_INVALID" } });
      expect(await preferences.shell.read()).toEqual(DEFAULT_SHELL_SETTINGS);
      expect(database.prepare("SELECT * FROM user_records").all()).toEqual([]);
      expect(
        database.prepare("SELECT revision FROM user_data_meta").get(),
      ).toEqual({ revision: 0 });
    },
  );

  it.each(["{", ...malformed.map(([, payload]) => JSON.stringify(payload))])(
    "rejects corrupt current rows without silently defaulting: %s",
    async (serialized) => {
      const { preferences, database } = fixture();
      database
        .prepare(
          "INSERT INTO user_records VALUES ('preferences', 'shell', 1, ?)",
        )
        .run(serialized);
      const before = database.prepare("SELECT * FROM user_records").all();
      await expect(preferences.shell.read()).rejects.toThrow(
        "USER_DATA_INVALID",
      );
      expect(
        await preferences.shell.update({ rotationNoticeDismissed: true }),
      ).toEqual({ kind: "failed", error: { code: "USER_DATA_INVALID" } });
      expect(database.prepare("SELECT * FROM user_records").all()).toEqual(
        before,
      );
      expect(
        database.prepare("SELECT revision FROM user_data_meta").get(),
      ).toEqual({ revision: 0 });
    },
  );

  it("freezes defaults and isolates mutable read snapshots", async () => {
    const { preferences } = fixture();
    expect(Object.isFrozen(DEFAULT_SHELL_SETTINGS)).toBe(true);
    expect(Object.isFrozen(DEFAULT_SHELL_SETTINGS.display)).toBe(true);
    await preferences.shell.update(VALUE);
    const read = await preferences.shell.read();
    Object.assign(read.display, { showZoneOutlines: true });
    Object.assign(read.freePlayPairing!, { player: "changed" });
    expect(await preferences.shell.read()).toEqual(VALUE);
  });

  it("surfaces unavailable SQLite reads instead of hiding failure", async () => {
    const { runtime, preferences } = fixture();
    await runtime.close();
    await expect(preferences.shell.read()).rejects.toThrow(
      "STORAGE_UNAVAILABLE",
    );
  });
});

describe("the shell settings store", () => {
  it("remembers a chosen free-play opponent across a reload", async () => {
    const { preferences, runtime } = fixture();
    const port = preferences.shell;
    const store = createShellSettingsStore(await port.read(), port);
    expect(get(store).freePlayOpponentId).toBeNull();
    store.rememberFreePlayOpponent("blaze-circuit");
    expect(get(store).freePlayOpponentId).toBe("blaze-circuit");
    expect(await port.flush()).toEqual({ kind: "ok", value: undefined });
    expect(await runtime.readUser("preferences", "shell")).toMatchObject({
      kind: "ok",
      value: { payload: { freePlayOpponentId: "blaze-circuit" } },
    });
    expect(
      get(createShellSettingsStore(await port.read(), port)).freePlayOpponentId,
    ).toBe("blaze-circuit");
  });

  it("persists pairing and rotation dismissal without losing the opponent", async () => {
    const { preferences, runtime } = fixture();
    const port = preferences.shell;
    const store = createShellSettingsStore(await port.read(), port);
    store.rememberFreePlayOpponent("blaze-circuit");
    store.rememberFreePlayPairing(VALUE.freePlayPairing!);
    store.dismissRotationNotice();
    expect(await port.flush()).toEqual({ kind: "ok", value: undefined });
    expect(await runtime.readUser("preferences", "shell")).toMatchObject({
      kind: "ok",
      value: { revision: 3, payload: get(store) },
    });
  });

  it("reports rolled-back writes while keeping session settings usable", async () => {
    const { preferences, database } = fixture((point) => {
      if (point === "write-after-first")
        throw new Error("injected write failure");
    });
    const port = preferences.shell;
    const failed = vi.fn();
    const store = createShellSettingsStore(await port.read(), port, failed);
    store.rememberFreePlayOpponent("blaze-circuit");
    expect(await port.flush()).toEqual({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
    await vi.waitFor(() =>
      expect(failed).toHaveBeenCalledWith({ code: "STORAGE_UNAVAILABLE" }),
    );
    expect(get(store).freePlayOpponentId).toBe("blaze-circuit");
    expect(await port.read()).toEqual(DEFAULT_SHELL_SETTINGS);
    expect(database.prepare("SELECT * FROM user_records").all()).toEqual([]);
    expect(
      database.prepare("SELECT revision FROM user_data_meta").get(),
    ).toEqual({ revision: 0 });
  });

  it("keeps working without storage", () => {
    const store = createShellSettingsStore();
    store.rememberFreePlayOpponent("practice-bot");
    expect(get(store).freePlayOpponentId).toBe("practice-bot");
  });
});
