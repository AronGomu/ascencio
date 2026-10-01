import { validOpenedPackSizes } from "../model/opened-pack-sizes.ts";
import { validFacts, stableReference } from "../../modules/index.ts";
import type {
  PersistedStoryState,
  PersistedStoryEnvelope,
  StoredStoryReadResult,
} from "./persisted-story-contracts.ts";
import { STORY_SCREENS } from "../model/story-state.ts";
import { isStoryDeck } from "./story-save-contracts.ts";
import type { StorySlotKey } from "./generation-contracts.ts";

const ENVELOPE_KEYS = [
  "schemaVersion",
  "slot",
  "revision",
  "savedAt",
  "state",
  "story",
] as const;
const STATE_KEYS = [
  "screen",
  "previousScreen",
  "savedScreen",
  "progressExists",
  "narrativeIndex",
  "lastInputId",
  "choice",
  "choiceResponse",
  "laterAcknowledgment",
  "locations",
  "outcome",
  "outcomeScene",
  "rewardGranted",
  "rewardAcknowledged",
  "objective",
  "encounterId",
  "pendingHandoffId",
  "dp",
  "boosters",
  "collection",
  "decks",
  "defaultDeckId",
  "shopReturnScreen",
  "shopSetId",
  "openedCards",
  "openingMode",
] as const;
const STORY_KEYS = [
  "chapterId",
  "contentId",
  "revision",
  "completedChapterIds",
] as const;
const SCREEN_SET = new Set<string>(STORY_SCREENS);
const OUTCOME_SET = new Set<unknown>([null, "win", "loss", "abort", "failure"]);
const RARITY_SET = new Set([
  "common",
  "rare",
  "super-rare",
  "ultra-rare",
  "secret-rare",
  "ultimate-rare",
  "ghost-rare",
]);

export function isPersistableStoryState(
  value: unknown,
): value is PersistedStoryState {
  if (
    !exactRecord(value, [
      ...STATE_KEYS,
      ...(typeof value === "object" &&
      value !== null &&
      Object.hasOwn(value, "openedPackSizes")
        ? ["openedPackSizes"]
        : []),
    ])
  )
    return false;
  if (
    !hasString(SCREEN_SET, value.screen) ||
    !(
      value.previousScreen === null ||
      hasString(SCREEN_SET, value.previousScreen)
    ) ||
    !hasString(SCREEN_SET, value.savedScreen) ||
    typeof value.progressExists !== "boolean" ||
    !count(value.narrativeIndex) ||
    !(value.lastInputId === null || count(value.lastInputId)) ||
    !nullableReference(value.choice) ||
    !nullableString(value.choiceResponse) ||
    !nullableString(value.laterAcknowledgment) ||
    !OUTCOME_SET.has(value.outcome) ||
    !nullableString(value.outcomeScene) ||
    typeof value.rewardGranted !== "boolean" ||
    typeof value.rewardAcknowledged !== "boolean" ||
    typeof value.objective !== "string" ||
    !nullableReference(value.encounterId) ||
    !nullableReference(value.pendingHandoffId) ||
    !count(value.dp) ||
    !countRecord(value.boosters, false) ||
    !countRecord(value.collection, true) ||
    !denseArray(value.decks) ||
    !value.decks.every(validDeck) ||
    !nullableReference(value.defaultDeckId) ||
    !(
      value.shopReturnScreen === null ||
      hasString(SCREEN_SET, value.shopReturnScreen)
    ) ||
    !nullableReference(value.shopSetId) ||
    !validOpenedCards(value.openedCards) ||
    !validOpenedPackSizes(value.openedPackSizes, value.openedCards) ||
    ![null, "sequential", "all"].includes(value.openingMode as null | string)
  )
    return false;
  if (!denseArray(value.locations)) return false;
  const locations = new Set<string>();
  for (const location of value.locations) {
    if (
      !exactRecord(location, ["id", "access", "completed"]) ||
      !reference(location.id) ||
      locations.has(location.id) ||
      typeof location.access !== "string" ||
      !["available", "locked", "hidden"].includes(location.access) ||
      typeof location.completed !== "boolean"
    )
      return false;
    locations.add(location.id);
  }
  return jsonValue(value);
}

export function parseStoredStoryEnvelope(
  slot: StorySlotKey,
  value: unknown,
): StoredStoryReadResult {
  if (value === undefined) return { kind: "empty", slot };
  const corrupt = (): StoredStoryReadResult => ({
    kind: "corrupt",
    slot,
    reason: "Saved story envelope is invalid",
  });
  if (!plainRecord(value)) return corrupt();
  if (count(value.schemaVersion) && value.schemaVersion !== 6)
    return { kind: "incompatible", slot, found: value.schemaVersion };
  if (
    !exactRecord(value, ENVELOPE_KEYS) ||
    value.schemaVersion !== 6 ||
    value.slot !== slot ||
    !positive(value.revision) ||
    !count(value.savedAt) ||
    !validStoryBinding(value.story) ||
    !isPersistableStoryState(value.state)
  )
    return corrupt();
  return {
    kind: "ready",
    envelope: structuredClone(value) as unknown as PersistedStoryEnvelope,
  };
}

function validStoryBinding(
  value: unknown,
): value is PersistedStoryEnvelope["story"] {
  if (
    !plainRecord(value) ||
    !exactRecord(value, [
      ...STORY_KEYS,
      ...["facts", "factsSchemaVersion", "beatId"].filter((key) =>
        Object.hasOwn(value, key),
      ),
    ])
  )
    return false;
  if (
    (value.facts !== undefined && !validFacts(value.facts)) ||
    (value.factsSchemaVersion !== undefined &&
      value.factsSchemaVersion !== 1) ||
    (value.beatId !== undefined && !stableReference(value.beatId))
  )
    return false;
  if (
    !reference(value.chapterId) ||
    !reference(value.contentId) ||
    !count(value.revision) ||
    !denseArray(value.completedChapterIds) ||
    !value.completedChapterIds.every((id) => reference(id))
  )
    return false;
  return (
    new Set(value.completedChapterIds).size === value.completedChapterIds.length
  );
}

function validDeck(value: unknown): boolean {
  if (!isStoryDeck(value) || !plainRecord(value)) return false;
  if (
    !denseArray(value.main) ||
    !denseArray(value.extra) ||
    !denseArray(value.side)
  )
    return false;
  if (!plainRecord(value.validation) || !denseArray(value.validation.issues))
    return false;
  return true;
}

function validOpenedCards(value: unknown): boolean {
  if (value === null) return true;
  if (!denseArray(value)) return false;
  return value.every(
    (card) =>
      exactRecord(card, ["code", "rarity"]) &&
      count(card.code) &&
      typeof card.rarity === "string" &&
      RARITY_SET.has(card.rarity),
  );
}

function countRecord(value: unknown, numericKeys: boolean): boolean {
  if (!plainRecord(value)) return false;
  return Object.entries(value).every(([key, item]) => {
    if (!count(item)) return false;
    if (!numericKeys) return reference(key);
    const numeric = Number(key);
    return count(numeric) && String(numeric) === key;
  });
}

function jsonValue(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    if (!denseArray(value)) return false;
    return value.every((item) => jsonValue(item, seen));
  }
  if (!plainRecord(value)) return false;
  return Object.values(value).every(
    (item) => item !== undefined && jsonValue(item, seen),
  );
}

function nullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}
function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function positive(value: unknown): value is number {
  return count(value) && value > 0;
}
function plainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function exactRecord<K extends string>(
  value: unknown,
  keys: readonly K[],
): value is Record<K, unknown> {
  if (!plainRecord(value)) return false;
  const own = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    own.length === expected.length &&
    own.every((key, index) => key === expected[index])
  );
}
function denseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1)
    if (!Object.hasOwn(value, index)) return false;
  return true;
}
function hasString(
  values: ReadonlySet<string>,
  value: unknown,
): value is string {
  return typeof value === "string" && values.has(value);
}

function reference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    !value.includes("\0")
  );
}
function nullableReference(value: unknown): boolean {
  return value === null || reference(value);
}
