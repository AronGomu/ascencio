import {
  AUTO_SPEED_MAX_SECONDS,
  AUTO_SPEED_MIN_SECONDS,
} from "./story-playback.ts";
import type { StoryPlaybackSettings } from "./story-playback-settings.ts";

export function isStoryPlaybackSettings(
  value: unknown,
): value is StoryPlaybackSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).sort().join("\n") ===
      ["autoSpeedSeconds", "skipUnread", "autoFlip"].sort().join("\n") &&
    typeof record.autoSpeedSeconds === "number" &&
    Number.isInteger(record.autoSpeedSeconds) &&
    record.autoSpeedSeconds >= AUTO_SPEED_MIN_SECONDS &&
    record.autoSpeedSeconds <= AUTO_SPEED_MAX_SECONDS &&
    typeof record.skipUnread === "boolean" &&
    typeof record.autoFlip === "boolean"
  );
}
