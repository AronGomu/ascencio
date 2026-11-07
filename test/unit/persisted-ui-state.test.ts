import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PERSISTED_UI_STATE,
  type PersistedUiState,
} from "../../src/battle/app/stores/persisted-ui-state.ts";
import { sqliteStoryReader } from "../fixtures/sqlite-story-reader.ts";

function validState(): PersistedUiState {
  return {
    version: 2,
    windows: { zoneList: { x: 12, y: 34 }, confirm: { x: 56, y: 78 } },
    decks: { playerKey: "preset:nekroz", opponentKey: "local:built-deck:3" },
    settings: {
      showZoneOutlines: false,
      showZoneCounts: true,
      showCardShadows: false,
      showZoneLabels: false,
    },
  };
}
const fixtures: ReturnType<typeof sqliteStoryReader>[] = [];
afterEach(async () => {
  for (const fixture of fixtures.splice(0)) await fixture.close();
});
function fixture() {
  const value = sqliteStoryReader();
  fixtures.push(value);
  return value;
}

const malformed = [
  ["wrong version", { ...validState(), version: 4 }],
  ["legacy v1", { ...validState(), version: 1 }],
  [
    "malformed settings",
    {
      ...validState(),
      settings: { showZoneOutlines: "no", showZoneCounts: false },
    },
  ],
  [
    "legacy deck IDs",
    { ...validState(), decks: { player: "burning-abyss", opponent: "nekroz" } },
  ],
  [
    "missing deck key",
    { ...validState(), decks: { opponentKey: "local:built-deck:3" } },
  ],
  [
    "non-numeric position",
    {
      ...validState(),
      windows: { zoneList: null, confirm: { x: 10, y: "NaN" } },
    },
  ],
  [
    "missing display leaves",
    {
      ...validState(),
      settings: { showZoneOutlines: false, showZoneCounts: false },
    },
  ],
  [
    "malformed display leaves",
    {
      ...validState(),
      settings: {
        ...validState().settings,
        showCardShadows: "no",
        showZoneLabels: 1,
      },
    },
  ],
] as const;

describe("persisted UI state", () => {
  it("returns defaults only when the SQLite record is absent", async () => {
    const { runtime, preferences } = fixture();
    expect(await preferences.battle.read()).toEqual(DEFAULT_PERSISTED_UI_STATE);
    expect(await runtime.readUser("preferences", "battle-ui")).toEqual({
      kind: "ok",
      value: null,
    });
  });

  it.each(["{", ...malformed.map(([, payload]) => JSON.stringify(payload))])(
    "rejects malformed current records without fallback or mutation: %s",
    async (serialized) => {
      const { database, preferences } = fixture();
      database
        .prepare(
          "INSERT INTO user_records VALUES ('preferences', 'battle-ui', 1, ?)",
        )
        .run(serialized);
      const before = database.prepare("SELECT * FROM user_records").all();
      await expect(preferences.battle.read()).rejects.toThrow(
        "USER_DATA_INVALID",
      );
      expect(await preferences.battle.update(validState())).toEqual({
        kind: "failed",
        error: { code: "USER_DATA_INVALID" },
      });
      expect(database.prepare("SELECT * FROM user_records").all()).toEqual(
        before,
      );
      expect(
        database.prepare("SELECT revision FROM user_data_meta").get(),
      ).toEqual({ revision: 0 });
    },
  );

  it.each(malformed)(
    "rejects malformed writes before mutation: %s",
    async (_name, payload) => {
      const { runtime, preferences, database } = fixture();
      expect(
        await runtime.writeUser([
          {
            kind: "put",
            namespace: "preferences",
            key: "battle-ui",
            expectedRevision: null,
            payload,
          },
        ]),
      ).toEqual({ kind: "failed", error: { code: "USER_DATA_INVALID" } });
      expect(await preferences.battle.read()).toEqual(
        DEFAULT_PERSISTED_UI_STATE,
      );
      expect(database.prepare("SELECT * FROM user_records").all()).toEqual([]);
      expect(
        database.prepare("SELECT revision FROM user_data_meta").get(),
      ).toEqual({ revision: 0 });
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite coordinates rather than dropping the window: %s",
    async (y) => {
      const { preferences } = fixture();
      expect(
        await preferences.battle.update({
          windows: { zoneList: null, confirm: { x: 10, y } },
        }),
      ).toEqual({ kind: "failed", error: { code: "USER_DATA_INVALID" } });
      expect(await preferences.battle.read()).toEqual(
        DEFAULT_PERSISTED_UI_STATE,
      );
    },
  );

  it("keeps a deck key it cannot interpret", async () => {
    const { preferences, runtime } = fixture();
    const decks = {
      playerKey: "local:deleted-deck:9",
      opponentKey: "preset:x",
    };
    expect(await preferences.battle.update({ decks })).toMatchObject({
      kind: "ok",
      value: { decks },
    });
    expect((await preferences.battle.read()).decks).toEqual(decks);
    expect(await runtime.readUser("preferences", "battle-ui")).toMatchObject({
      kind: "ok",
      value: { payload: { decks } },
    });
  });

  it("round-trips a valid state", async () => {
    const { runtime, preferences } = fixture();
    const state = validState();
    expect(await preferences.battle.update(state)).toEqual({
      kind: "ok",
      value: state,
    });
    expect(await preferences.battle.read()).toEqual(state);
    expect(await runtime.readUser("preferences", "battle-ui")).toMatchObject({
      kind: "ok",
      value: { revision: 1, payload: state },
    });
  });

  it("surfaces unavailable storage rather than reporting an absent record", async () => {
    const { runtime, preferences } = fixture();
    await runtime.close();
    await expect(preferences.battle.read()).rejects.toThrow(
      "STORAGE_UNAVAILABLE",
    );
    expect(await preferences.battle.update(validState())).toEqual({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
  });
});
