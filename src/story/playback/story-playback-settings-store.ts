import { writable, type Readable } from "svelte/store";
import {
  clampAutoSpeed,
  DEFAULT_STORY_PLAYBACK_SETTINGS,
  readStoryPlaybackSettings,
  writeStoryPlaybackSettings,
  type StoryPlaybackSettings,
} from "./story-playback-settings.ts";

export interface StoryPlaybackSettingsStore extends Readable<StoryPlaybackSettings> {
  setAutoSpeedSeconds(seconds: number): void;
  setSkipUnread(skipUnread: boolean): void;
  setAutoFlip(autoFlip: boolean): void;
  reset(): void;
}

/* One live owner of the reader preferences: the settings overlay writes them
   and the narrative screen's timer reads them, so both see the same value
   without either persisting on its own. */
export function createStoryPlaybackSettingsStore(
  storage: Pick<Storage, "getItem" | "setItem"> | null = defaultStorage(),
): StoryPlaybackSettingsStore {
  const { subscribe, update } = writable<StoryPlaybackSettings>(
    storage === null
      ? DEFAULT_STORY_PLAYBACK_SETTINGS
      : readStoryPlaybackSettings(storage),
  );

  function persist(
    next: (state: StoryPlaybackSettings) => StoryPlaybackSettings,
  ): void {
    update((state) => {
      const value = next(state);
      if (storage !== null) writeStoryPlaybackSettings(value, storage);
      return value;
    });
  }

  return {
    subscribe,
    setAutoSpeedSeconds(seconds: number): void {
      persist((state) =>
        Object.freeze({ ...state, autoSpeedSeconds: clampAutoSpeed(seconds) }),
      );
    },
    setSkipUnread(skipUnread: boolean): void {
      persist((state) => Object.freeze({ ...state, skipUnread }));
    },
    setAutoFlip(autoFlip: boolean): void {
      persist((state) => Object.freeze({ ...state, autoFlip }));
    },
    reset(): void {
      persist(() => DEFAULT_STORY_PLAYBACK_SETTINGS);
    },
  };
}

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
