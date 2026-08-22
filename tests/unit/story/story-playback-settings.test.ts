import { describe, expect, it } from "vitest";
import {
  DEFAULT_STORY_PLAYBACK_SETTINGS,
  readStoryPlaybackSettings,
  STORY_PLAYBACK_SETTINGS_KEY,
  writeStoryPlaybackSettings,
} from "../../../src/story/playback/story-playback-settings.ts";
import { createStoryPlaybackSettingsStore } from "../../../src/story/playback/story-playback-settings-store.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("story playback settings", () => {
  it("defaults when nothing is stored and round-trips what is", () => {
    expect(readStoryPlaybackSettings(memoryStorage())).toEqual(
      DEFAULT_STORY_PLAYBACK_SETTINGS,
    );
    const storage = memoryStorage();
    writeStoryPlaybackSettings(
      { autoSpeedSeconds: 5, skipUnread: true, autoFlip: true },
      storage,
    );
    expect(readStoryPlaybackSettings(storage)).toEqual({
      autoSpeedSeconds: 5,
      skipUnread: true,
      autoFlip: true,
    });
  });

  it("clamps an out-of-range speed and rejects a non-boolean skip flag", () => {
    expect(
      readStoryPlaybackSettings(
        memoryStorage({
          [STORY_PLAYBACK_SETTINGS_KEY]: JSON.stringify({
            autoSpeedSeconds: 99,
            skipUnread: "yes",
          }),
        }),
      ),
      /* A payload from before the reveal screen carries no `autoFlip` at all,
         which is the same absence as a tampered one and reads as the default. */
    ).toEqual({ autoSpeedSeconds: 8, skipUnread: false, autoFlip: false });
    expect(
      readStoryPlaybackSettings(
        memoryStorage({ [STORY_PLAYBACK_SETTINGS_KEY]: "{" }),
      ),
    ).toEqual(DEFAULT_STORY_PLAYBACK_SETTINGS);
  });

  it("store persists every setter and restores the defaults on reset", () => {
    const storage = memoryStorage();
    const store = createStoryPlaybackSettingsStore(storage);
    store.setAutoSpeedSeconds(6);
    store.setSkipUnread(true);
    store.setAutoFlip(true);
    expect(readStoryPlaybackSettings(storage)).toEqual({
      autoSpeedSeconds: 6,
      skipUnread: true,
      autoFlip: true,
    });
    let seen = DEFAULT_STORY_PLAYBACK_SETTINGS;
    const unsubscribe = store.subscribe((value) => (seen = value));
    expect(seen.autoSpeedSeconds).toBe(6);
    store.reset();
    expect(seen).toEqual(DEFAULT_STORY_PLAYBACK_SETTINGS);
    expect(readStoryPlaybackSettings(storage)).toEqual(
      DEFAULT_STORY_PLAYBACK_SETTINGS,
    );
    unsubscribe();
  });

  it("still serves settings when there is no storage at all", () => {
    const store = createStoryPlaybackSettingsStore(null);
    let seen: unknown = null;
    const unsubscribe = store.subscribe((value) => (seen = value));
    store.setSkipUnread(true);
    expect(seen).toEqual({
      ...DEFAULT_STORY_PLAYBACK_SETTINGS,
      skipUnread: true,
    });
    unsubscribe();
  });
});
