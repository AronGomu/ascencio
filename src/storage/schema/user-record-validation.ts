import { isPersistedUiState } from "../../battle/ports/index.ts";
import {
  isDeckAutosaveRecord,
  isStoredDeck,
} from "../../decks/contracts/index.ts";
import { isShellSettings } from "../../shell/settings/index.ts";
import { isStoryPlaybackSettings } from "../../story/playback/index.ts";
import {
  parseStoredStoryEnvelope,
  type StorySlotKey,
} from "../../story/saves/index.ts";
import type { StorageResult } from "../contracts/package.ts";

export const USER_DATA_MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;
const USER_NAMESPACES = new Set([
  "decks",
  "deck-meta",
  "deck-autosaves",
  "story",
  "preferences",
  "story-read-log",
]);
const STORY_SLOTS = new Set([
  "manual:1",
  "manual:2",
  "manual:3",
  "autosave",
  "checkpoint:pre-duel",
]);

export function validateUserRecordPayload(
  namespace: unknown,
  key: unknown,
  payload: unknown,
): StorageResult<unknown> {
  if (
    typeof namespace !== "string" ||
    !USER_NAMESPACES.has(namespace) ||
    typeof key !== "string" ||
    key.length === 0 ||
    key.length > 256 ||
    key.includes("\0")
  )
    return invalid();
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    return invalid();
  }
  if (serialized === undefined) return invalid();
  if (
    new TextEncoder().encode(serialized).byteLength >
    USER_DATA_MAX_PAYLOAD_BYTES
  )
    return { kind: "failed", error: { code: "USER_DATA_TOO_LARGE" } };

  let valid = false;
  if (namespace === "decks") valid = isStoredDeck(payload);
  if (namespace === "deck-autosaves") valid = isDeckAutosaveRecord(payload);
  if (namespace === "deck-meta")
    valid =
      (key === "lastOpened" || key === "defaultDeck") &&
      (payload === null || (typeof payload === "string" && payload.length > 0));
  if (namespace === "story")
    valid =
      STORY_SLOTS.has(key) &&
      parseStoredStoryEnvelope(key as StorySlotKey, payload).kind === "ready";
  if (namespace === "preferences") {
    if (key === "shell") valid = isShellSettings(payload);
    if (key === "battle-ui") valid = isPersistedUiState(payload);
    if (key === "story-playback") valid = isStoryPlaybackSettings(payload);
  }
  if (namespace === "story-read-log")
    valid = key === "read" && readLog(payload);
  return valid ? { kind: "ok", value: payload } : invalid();
}

function readLog(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join("\n") !==
      ["version", "beats"].sort().join("\n") ||
    record.version !== 1 ||
    !Array.isArray(record.beats)
  )
    return false;
  for (let index = 0; index < record.beats.length; index += 1)
    if (
      !Object.hasOwn(record.beats, index) ||
      typeof record.beats[index] !== "string" ||
      record.beats[index].length === 0
    )
      return false;
  return new Set(record.beats).size === record.beats.length;
}
function invalid(): StorageResult<never> {
  return { kind: "failed", error: { code: "USER_DATA_INVALID" } };
}
