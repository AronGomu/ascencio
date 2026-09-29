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
  /** Whether a booster pack turns its own cards over instead of waiting to be
      clicked. Off by default: the reveal is the point of opening a pack, and a
      player who wants it done for them says so once and is remembered. */
  readonly autoFlip: boolean;
}

export const DEFAULT_STORY_PLAYBACK_SETTINGS: StoryPlaybackSettings =
  Object.freeze({ autoSpeedSeconds: 3, skipUnread: false, autoFlip: false });

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
