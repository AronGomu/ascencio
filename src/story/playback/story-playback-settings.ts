import {
  AUTO_SPEED_MAX_SECONDS,
  AUTO_SPEED_MIN_SECONDS,
} from "./story-playback.ts";

/** Reader preferences for automatic advance. Persisted beside the read log
    rather than inside a save, for the same reason: they describe the reader,
    not the run. */
export interface StoryPlaybackSettings {
  /** Seconds one beat stays on screen while Auto runs. */
  readonly autoSpeedSeconds: number;
  /** Whether Skip is allowed past text this player has never read. */
  readonly skipUnread: boolean;
}

export const STORY_PLAYBACK_SETTINGS_KEY = "ygo.story.playback.v1";

export const DEFAULT_STORY_PLAYBACK_SETTINGS: StoryPlaybackSettings =
  Object.freeze({ autoSpeedSeconds: 3, skipUnread: false });

export function readStoryPlaybackSettings(
  storage: Pick<Storage, "getItem"> | null = defaultStorage(),
): StoryPlaybackSettings {
  if (storage === null) return DEFAULT_STORY_PLAYBACK_SETTINGS;
  try {
    const serialized = storage.getItem(STORY_PLAYBACK_SETTINGS_KEY);
    if (serialized === null) return DEFAULT_STORY_PLAYBACK_SETTINGS;
    const parsed: unknown = JSON.parse(serialized);
    if (typeof parsed !== "object" || parsed === null)
      return DEFAULT_STORY_PLAYBACK_SETTINGS;
    const record = parsed as Record<string, unknown>;
    return Object.freeze({
      autoSpeedSeconds: clampAutoSpeed(record.autoSpeedSeconds),
      skipUnread:
        typeof record.skipUnread === "boolean"
          ? record.skipUnread
          : DEFAULT_STORY_PLAYBACK_SETTINGS.skipUnread,
    });
  } catch {
    return DEFAULT_STORY_PLAYBACK_SETTINGS;
  }
}

export function writeStoryPlaybackSettings(
  settings: StoryPlaybackSettings,
  storage: Pick<Storage, "setItem"> | null = defaultStorage(),
): void {
  if (storage === null) return;
  try {
    storage.setItem(STORY_PLAYBACK_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Best-effort: a rejected write costs the preference, never the session.
  }
}

/** Keeps the slider's range authoritative over whatever is on disk: a value
    from a tampered or older payload resolves to a speed the UI can show. */
export function clampAutoSpeed(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    return DEFAULT_STORY_PLAYBACK_SETTINGS.autoSpeedSeconds;
  return Math.min(
    Math.max(Math.round(value), AUTO_SPEED_MIN_SECONDS),
    AUTO_SPEED_MAX_SECONDS,
  );
}

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
