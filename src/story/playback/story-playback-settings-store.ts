import { writable, type Readable } from "svelte/store";
import type {
  AsyncPreferencePort,
  StorageFailure,
} from "../../storage/index.ts";
import {
  clampAutoSpeed,
  DEFAULT_STORY_PLAYBACK_SETTINGS,
  type StoryPlaybackSettings,
} from "./story-playback-settings.ts";

export interface StoryPlaybackSettingsStore extends Readable<StoryPlaybackSettings> {
  setAutoSpeedSeconds(seconds: number): void;
  setSkipUnread(skipUnread: boolean): void;
  setAutoFlip(autoFlip: boolean): void;
  reset(): void;
}

export function createStoryPlaybackSettingsStore(
  initial: StoryPlaybackSettings = DEFAULT_STORY_PLAYBACK_SETTINGS,
  persistence: AsyncPreferencePort<StoryPlaybackSettings> | null = null,
  onFailure: (error: StorageFailure) => void = (error) =>
    console.warn("USER_PERSISTENCE_FAILED", error),
): StoryPlaybackSettingsStore {
  const { subscribe, update } = writable<StoryPlaybackSettings>(initial);

  function persist(patch: Partial<StoryPlaybackSettings>): void {
    update((state) => Object.freeze({ ...state, ...patch }));
    if (persistence === null) return;
    void persistence.update(patch).then(
      (result) => {
        if (result.kind === "failed") onFailure(result.error);
      },
      () => onFailure({ code: "STORAGE_UNAVAILABLE" }),
    );
  }

  return {
    subscribe,
    setAutoSpeedSeconds(seconds: number): void {
      persist({ autoSpeedSeconds: clampAutoSpeed(seconds) });
    },
    setSkipUnread(skipUnread: boolean): void {
      persist({ skipUnread });
    },
    setAutoFlip(autoFlip: boolean): void {
      persist({ autoFlip });
    },
    reset(): void {
      persist(DEFAULT_STORY_PLAYBACK_SETTINGS);
    },
  };
}
