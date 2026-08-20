/** What the narrative screen is doing without the player: nothing, advancing
    on a timer, or fast-forwarding through text. The mode is UI state rather
    than story state — a save records where the story is, never whether the
    reader was holding skip when it was written. */
export type PlaybackMode = "off" | "auto" | "skip";

/** Bounds of the auto-speed setting, in seconds spent on one beat. */
export const AUTO_SPEED_MIN_SECONDS = 1;
export const AUTO_SPEED_MAX_SECONDS = 8;

/** One skip step. Fast enough to read as fast-forward, slow enough that every
    beat is still rendered and recorded in history rather than jumped over. */
export const SKIP_STEP_MS = 60;

/** Why playback gave the scene back to the player. Every stop is one of these,
    so the screen can always say what happened instead of going quiet. */
export type PlaybackStop = "choice" | "unread" | "end";

export interface PlaybackContext {
  readonly hasChoices: boolean;
  readonly atLastBeat: boolean;
  /** Whether the beat playback would advance *into* has been read before. */
  readonly nextBeatRead: boolean;
  readonly skipUnread: boolean;
}

/** The reason playback must stop before the next beat, or null to continue.
    Skip refuses unread text by default, which is the whole point of skip —
    it fast-forwards what the player already read, and hands back control at
    the edge of what they have not. */
export function playbackHalt(
  mode: PlaybackMode,
  context: PlaybackContext,
): PlaybackStop | null {
  if (mode === "off") return null;
  if (context.hasChoices) return "choice";
  if (context.atLastBeat) return "end";
  if (mode === "skip" && !context.skipUnread && !context.nextBeatRead)
    return "unread";
  return null;
}

/** How long the current beat stays on screen before playback advances it. */
export function playbackDelayMs(
  mode: PlaybackMode,
  autoSpeedSeconds: number,
): number {
  if (mode !== "auto") return SKIP_STEP_MS;
  const seconds = Number.isFinite(autoSpeedSeconds)
    ? Math.min(
        Math.max(autoSpeedSeconds, AUTO_SPEED_MIN_SECONDS),
        AUTO_SPEED_MAX_SECONDS,
      )
    : AUTO_SPEED_MIN_SECONDS;
  return seconds * 1000;
}

/** What the player is told when playback stops on its own. A stop with no
    visible reason is indistinguishable from a dead button. */
export function playbackNotice(mode: PlaybackMode, stop: PlaybackStop): string {
  const subject = mode === "skip" ? "Skip" : "Auto";
  switch (stop) {
    case "choice":
      return `${subject} stopped: choose a response to continue.`;
    case "end":
      return `${subject} stopped at the end of the scene.`;
    case "unread":
      return "Skip stopped at text you have not read yet. Turn on “Skip unread text” in Settings to skip it anyway.";
  }
}
