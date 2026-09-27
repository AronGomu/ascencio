import { get } from "svelte/store";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PERSISTED_UI_STATE,
  type PersistedUiState,
} from "../../src/battle/app/stores/persisted-ui-state.ts";
import { createPersistedUiStore } from "../../src/battle/app/stores/persisted-ui-store.ts";
import { sqliteStoryReader } from "../fixtures/sqlite-story-reader.ts";

const SEED: PersistedUiState = {
  version: 2,
  windows: { zoneList: { x: 12, y: 34 }, confirm: { x: 56, y: 78 } },
  decks: { playerKey: "preset:nekroz", opponentKey: "preset:shaddoll" },
  settings: {
    showZoneOutlines: false,
    showZoneCounts: true,
    showCardShadows: true,
    showZoneLabels: true,
  },
};

const fixtures: ReturnType<typeof sqliteStoryReader>[] = [];
afterEach(async () => {
  for (const fixture of fixtures.splice(0)) await fixture.close();
});
async function fixture(
  seed: PersistedUiState | null = SEED,
  fault?: (point: string) => void,
) {
  const value = sqliteStoryReader(fault);
  fixtures.push(value);
  const port = value.preferences.battle;
  if (seed !== null)
    expect(await port.update(seed)).toMatchObject({ kind: "ok" });
  const failed = vi.fn();
  const store = createPersistedUiStore(await port.read(), port, failed);
  return { ...value, port, store, failed };
}

async function expectStored(
  value: Awaited<ReturnType<typeof fixture>>,
  revision: number,
) {
  expect(await value.port.flush()).toEqual({ kind: "ok", value: undefined });
  expect(
    await value.runtime.readUser("preferences", "battle-ui"),
  ).toMatchObject({
    kind: "ok",
    value: { revision, payload: get(value.store) },
  });
  expect(await value.port.read()).toEqual(get(value.store));
}

describe("persisted UI store", () => {
  it("initializes from the persisted reader", async () => {
    const value = await fixture();
    expect(get(value.store)).toEqual(SEED);
    await expectStored(value, 1);
  });

  it("initializes to defaults when no persistence port is injected", () => {
    expect(get(createPersistedUiStore())).toEqual(DEFAULT_PERSISTED_UI_STATE);
  });

  it("setDecks preserves both window positions and writes once", async () => {
    const value = await fixture();
    value.store.setDecks("preset:shaddoll", "local:built-deck:2");
    expect(get(value.store).decks).toEqual({
      playerKey: "preset:shaddoll",
      opponentKey: "local:built-deck:2",
    });
    expect(get(value.store).windows).toEqual(SEED.windows);
    await expectStored(value, 2);
  });

  it("setWindowPosition preserves the deck pair and the other window", async () => {
    const value = await fixture();
    value.store.setWindowPosition("zoneList", { x: 5, y: 6 });
    expect(get(value.store).windows).toEqual({
      zoneList: { x: 5, y: 6 },
      confirm: { x: 56, y: 78 },
    });
    expect(get(value.store).decks).toEqual(SEED.decks);
    await expectStored(value, 2);
  });

  it("setDisplaySettings preserves decks and windows and writes once", async () => {
    const value = await fixture();
    const settings = {
      showZoneOutlines: true,
      showZoneCounts: false,
      showCardShadows: false,
      showZoneLabels: false,
    };
    value.store.setDisplaySettings(settings);
    expect(get(value.store).settings).toEqual(settings);
    expect(get(value.store).decks).toEqual(SEED.decks);
    expect(get(value.store).windows).toEqual(SEED.windows);
    await expectStored(value, 2);
  });

  it("each window keeps its own position", async () => {
    const value = await fixture(null);
    value.store.setWindowPosition("confirm", { x: 1, y: 2 });
    value.store.setWindowPosition("zoneList", { x: 3, y: 4 });
    expect(get(value.store).windows).toEqual({
      zoneList: { x: 3, y: 4 },
      confirm: { x: 1, y: 2 },
    });
    await expectStored(value, 2);
  });

  it("clears a window position back to null", async () => {
    const value = await fixture();
    value.store.setWindowPosition("confirm", null);
    expect(get(value.store).windows).toEqual({
      zoneList: { x: 12, y: 34 },
      confirm: null,
    });
    await expectStored(value, 2);
  });

  it("writes the complete v2 state on every setter", async () => {
    const value = await fixture(null);
    value.store.setWindowPosition("zoneList", { x: 7, y: 8 });
    expect(get(value.store)).toEqual({
      ...DEFAULT_PERSISTED_UI_STATE,
      windows: { zoneList: { x: 7, y: 8 }, confirm: null },
    });
    await expectStored(value, 1);
  });

  it("reports failed SQLite writes without publishing failed durable state", async () => {
    const value = await fixture(null, (point) => {
      if (point === "write-after-first")
        throw new Error("injected write failure");
    });
    value.store.setDecks("preset:nekroz", "preset:shaddoll");
    value.store.setWindowPosition("zoneList", { x: 1, y: 1 });
    expect(await value.port.flush()).toEqual({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
    await vi.waitFor(() => expect(value.failed).toHaveBeenCalledTimes(2));
    expect(value.failed).toHaveBeenCalledWith({ code: "STORAGE_UNAVAILABLE" });
    expect(get(value.store).decks).toEqual({
      playerKey: "preset:nekroz",
      opponentKey: "preset:shaddoll",
    });
    expect(await value.port.read()).toEqual(DEFAULT_PERSISTED_UI_STATE);
    expect(
      get(createPersistedUiStore(await value.port.read(), value.port)),
    ).toEqual(DEFAULT_PERSISTED_UI_STATE);
    expect(value.database.prepare("SELECT * FROM user_records").all()).toEqual(
      [],
    );
    expect(
      value.database.prepare("SELECT revision FROM user_data_meta").get(),
    ).toEqual({ revision: 0 });
  });
});
