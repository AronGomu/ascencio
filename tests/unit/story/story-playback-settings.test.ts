import { get } from "svelte/store";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clampAutoSpeed,
  DEFAULT_STORY_PLAYBACK_SETTINGS,
} from "../../../src/story/playback/story-playback-settings.ts";
import { isStoryPlaybackSettings } from "../../../src/story/playback/playback-contracts.ts";
import { createStoryPlaybackSettingsStore } from "../../../src/story/playback/story-playback-settings-store.ts";
import { sqliteStoryReader } from "../../fixtures/sqlite-story-reader.ts";

const fixtures: ReturnType<typeof sqliteStoryReader>[] = [];
afterEach(async () => {
  for (const fixture of fixtures.splice(0)) await fixture.close();
});
function fixture(fault?: (point: string) => void) {
  const value = sqliteStoryReader(fault);
  fixtures.push(value);
  return value;
}

describe("story playback settings", () => {
  it("defaults when nothing is stored and round-trips through SQLite", async () => {
    const { runtime, preferences } = fixture();
    const port = preferences.storyPlayback;
    expect(await port.read()).toEqual(DEFAULT_STORY_PLAYBACK_SETTINGS);
    const value = { autoSpeedSeconds: 5, skipUnread: true, autoFlip: true };
    expect(await port.update(value)).toEqual({ kind: "ok", value });
    expect(await port.read()).toEqual(value);
    expect(
      await runtime.readUser("preferences", "story-playback"),
    ).toMatchObject({
      kind: "ok",
      value: { revision: 1, payload: value },
    });
  });

  it("clamps slider values and strictly rejects malformed persisted settings", async () => {
    expect(clampAutoSpeed(99)).toBe(8);
    expect(clampAutoSpeed(-1)).toBe(1);
    expect(clampAutoSpeed(4.6)).toBe(5);
    expect(clampAutoSpeed(Number.NaN)).toBe(3);
    expect(clampAutoSpeed("5")).toBe(3);
    const { runtime, preferences } = fixture();
    for (const payload of [
      { autoSpeedSeconds: 99, skipUnread: "yes" },
      { autoSpeedSeconds: 3, skipUnread: false },
      { ...DEFAULT_STORY_PLAYBACK_SETTINGS, autoFlip: "yes" },
    ]) {
      expect(isStoryPlaybackSettings(payload)).toBe(false);
      expect(
        await runtime.writeUser([
          {
            kind: "put",
            namespace: "preferences",
            key: "story-playback",
            expectedRevision: null,
            payload,
          },
        ]),
      ).toEqual({ kind: "failed", error: { code: "USER_DATA_INVALID" } });
    }
    expect(isStoryPlaybackSettings(DEFAULT_STORY_PLAYBACK_SETTINGS)).toBe(true);
    expect(await preferences.storyPlayback.read()).toEqual(
      DEFAULT_STORY_PLAYBACK_SETTINGS,
    );
  });

  it("store persists every setter and restores the defaults on reset", async () => {
    const { preferences, runtime } = fixture();
    const port = preferences.storyPlayback;
    const store = createStoryPlaybackSettingsStore(await port.read(), port);
    store.setAutoSpeedSeconds(6);
    store.setSkipUnread(true);
    store.setAutoFlip(true);
    expect(await port.flush()).toEqual({ kind: "ok", value: undefined });
    expect(await port.read()).toEqual({
      autoSpeedSeconds: 6,
      skipUnread: true,
      autoFlip: true,
    });
    expect(
      await runtime.readUser("preferences", "story-playback"),
    ).toMatchObject({
      kind: "ok",
      value: { revision: 3, payload: get(store) },
    });
    expect(get(store).autoSpeedSeconds).toBe(6);
    store.reset();
    expect(get(store)).toEqual(DEFAULT_STORY_PLAYBACK_SETTINGS);
    expect(await port.flush()).toEqual({ kind: "ok", value: undefined });
    expect(
      await runtime.readUser("preferences", "story-playback"),
    ).toMatchObject({
      kind: "ok",
      value: { revision: 4, payload: DEFAULT_STORY_PLAYBACK_SETTINGS },
    });
  });

  it("still serves settings when there is no storage at all", () => {
    const store = createStoryPlaybackSettingsStore();
    store.setSkipUnread(true);
    expect(get(store)).toEqual({
      ...DEFAULT_STORY_PLAYBACK_SETTINGS,
      skipUnread: true,
    });
  });

  it("reports a rolled-back write without publishing failed preferences", async () => {
    const { preferences, database } = fixture((point) => {
      if (point === "write-after-first")
        throw new Error("injected write failure");
    });
    const port = preferences.storyPlayback;
    const failed = vi.fn();
    const store = createStoryPlaybackSettingsStore(
      await port.read(),
      port,
      failed,
    );
    store.setAutoFlip(true);
    const result = await port.flush();
    expect(result).toEqual({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
    await vi.waitFor(() =>
      expect(failed).toHaveBeenCalledWith({ code: "STORAGE_UNAVAILABLE" }),
    );
    expect(await port.read()).toEqual(DEFAULT_STORY_PLAYBACK_SETTINGS);
    expect(database.prepare("SELECT * FROM user_records").all()).toEqual([]);
    expect(
      database.prepare("SELECT revision FROM user_data_meta").get(),
    ).toEqual({ revision: 0 });
  });
});
