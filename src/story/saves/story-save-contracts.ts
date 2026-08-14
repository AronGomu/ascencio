/* The shape of everything the story writes to disk, in one place, so the
   repository and any test fixture can never create two different versions of
   the same record. A save is the only story artefact a player cannot
   reconstruct by replaying, so every read is a parse that can fail loudly
   rather than a cast that fails silently three screens later. */

import { PROLOGUE } from "../content/prologue.ts";
import {
  STORY_SCREENS,
  type StoryScreen,
  type StoryState,
} from "../model/story-state.ts";

export const STORY_SAVES_DATABASE_NAME = "ygo-story-saves";
export const STORY_SAVES_DATABASE_VERSION = 1;
export const STORY_SAVES_STORE_NAME = "saves";
export const STORY_SAVE_SCHEMA_VERSION = 1;

export type StorySlotKey =
  `manual:${1 | 2 | 3}` | "autosave" | "checkpoint:pre-duel";

/** Every slot the store recognises. A key outside this list is never written,
    so a forged or future key reads as empty instead of resurrecting a record
    the current build cannot interpret. */
export const STORY_SLOT_KEYS: readonly StorySlotKey[] = Object.freeze([
  "manual:1",
  "manual:2",
  "manual:3",
  "autosave",
  "checkpoint:pre-duel",
] as const);

export function isStorySlotKey(value: unknown): value is StorySlotKey {
  return (
    typeof value === "string" &&
    (STORY_SLOT_KEYS as readonly string[]).includes(value)
  );
}

export interface StorySaveEnvelope {
  readonly schemaVersion: 1;
  readonly slot: StorySlotKey;
  readonly revision: number;
  readonly savedAt: number;
  readonly state: StoryState;
}

export interface StorySaveSummary {
  readonly slot: StorySlotKey;
  readonly revision: number;
  readonly savedAt: number;
  readonly chapterLabel: string;
}

export type StorySaveReadResult =
  | { readonly kind: "empty"; readonly slot: StorySlotKey }
  | { readonly kind: "ready"; readonly envelope: StorySaveEnvelope }
  | {
      readonly kind: "incompatible";
      readonly slot: StorySlotKey;
      readonly found: number;
    }
  | {
      readonly kind: "corrupt";
      readonly slot: StorySlotKey;
      readonly reason: string;
    };

export type StorySaveWriteResult =
  | { readonly kind: "written"; readonly revision: number }
  | { readonly kind: "stale"; readonly currentRevision: number }
  | {
      readonly kind: "failed";
      readonly reason: "quota" | "unavailable" | "unknown";
    };

/** The schema, in one place. One store keyed by slot, so a repeated save
    overwrites its slot rather than growing an append-only log.

    The key is out-of-line rather than a `keyPath` on the envelope: an in-line
    key would make a record without a readable `slot` field unstorable, and a
    store that cannot physically hold a corrupt record is a store whose read
    path can never be shown to survive one. The envelope keeps its own `slot`
    field, which `parseStorySaveEnvelope` checks against the key it was filed
    under. */
export function createStorySaveStores(database: IDBDatabase): void {
  database.createObjectStore(STORY_SAVES_STORE_NAME);
}

const ENVELOPE_KEYS = [
  "revision",
  "savedAt",
  "schemaVersion",
  "slot",
  "state",
] as const;

/**
 * Turns whatever came back from the store into a result the story can act on.
 *
 * The states a player can arrive in, and what each resolves to:
 *
 * - nothing stored under the slot — a fresh player, or a cleared slot: `empty`.
 * - a record whose `schemaVersion` this build does not know — `incompatible`,
 *   carrying the version found, so a downgrade reports the truth instead of
 *   silently discarding a newer save.
 * - a record that is not an envelope, is keyed under a different slot, or
 *   carries a story state that no longer parses — `corrupt`. The caller shows
 *   the reason and continues from memory; it never resumes from a half-record.
 * - anything else — `ready`.
 */
export function parseStorySaveEnvelope(
  slot: StorySlotKey,
  value: unknown,
): StorySaveReadResult {
  if (value === undefined || value === null) return { kind: "empty", slot };
  if (typeof value !== "object" || Array.isArray(value))
    return corrupt(slot, "Save record is not an object");

  const record = value as Record<string, unknown>;
  /* The version gate comes before the shape gate on purpose: a newer build is
     free to have changed the shape, and reporting that as corruption would
     invite the player to delete a save this build simply cannot read. */
  const schemaVersion = record.schemaVersion;
  if (!isCount(schemaVersion) || schemaVersion < 1)
    return corrupt(slot, "Save record has no usable schema version");
  if (schemaVersion !== STORY_SAVE_SCHEMA_VERSION)
    return { kind: "incompatible", slot, found: schemaVersion };

  if (!hasExactKeys(record, ENVELOPE_KEYS))
    return corrupt(slot, "Save record does not have the expected fields");
  if (record.slot !== slot)
    return corrupt(slot, `Save record belongs to another slot`);
  if (!isCount(record.revision) || record.revision < 1)
    return corrupt(slot, "Save record has no usable revision");
  if (!isCount(record.savedAt))
    return corrupt(slot, "Save record has no usable timestamp");
  if (!isStoryState(record.state))
    return corrupt(slot, "Saved story state is invalid");

  return { kind: "ready", envelope: value as StorySaveEnvelope };
}

export function summarizeStorySave(
  envelope: StorySaveEnvelope,
): StorySaveSummary {
  return Object.freeze({
    slot: envelope.slot,
    revision: envelope.revision,
    savedAt: envelope.savedAt,
    chapterLabel: storyChapterLabel(envelope.state),
  });
}

const SCREEN_LABELS: Readonly<Record<StoryScreen, string>> = Object.freeze({
  title: "Title",
  load: "Load",
  narrative: "Prologue",
  map: "City map",
  "pre-battle": "Old Arena",
  "battle-mock": "Duel",
  outcome: "Outcome",
  reward: "Reward",
  end: "End of the prologue",
});

/** Where a save resumes from, in the player's words. Derived rather than
    stored, so a chapter rename never has to migrate existing records. */
export function storyChapterLabel(state: StoryState): string {
  return `${PROLOGUE.title} · ${SCREEN_LABELS[state.savedScreen]}`;
}

function corrupt(slot: StorySlotKey, reason: string): StorySaveReadResult {
  return { kind: "corrupt", slot, reason };
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function hasExactKeys(value: object, expected: readonly string[]): boolean {
  return (
    Object.keys(value).sort().join("\n") === [...expected].sort().join("\n")
  );
}

/* Carried over unchanged from the browser-storage record this replaced: a save
   is only resumable if every screen, beat index and map node in it is one the
   current content actually has. */
function isStoryState(value: unknown): value is StoryState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Record<string, unknown>;
  const screens = new Set<string>(STORY_SCREENS);
  const choices = new Set([
    null,
    "trust-rin",
    "challenge-rin",
    "observe-first",
  ]);
  const outcomes = new Set([null, "win", "loss", "abort", "failure"]);
  if (
    typeof state.screen !== "string" ||
    !screens.has(state.screen) ||
    typeof state.savedScreen !== "string" ||
    !screens.has(state.savedScreen) ||
    typeof state.progressExists !== "boolean" ||
    !Number.isSafeInteger(state.narrativeIndex) ||
    (state.narrativeIndex as number) < 0 ||
    (state.narrativeIndex as number) >= PROLOGUE.beats.length ||
    !(
      state.lastInputId === null ||
      (Number.isSafeInteger(state.lastInputId) &&
        (state.lastInputId as number) >= 0)
    ) ||
    !choices.has(state.choice as null | string) ||
    !(
      state.choiceResponse === null || typeof state.choiceResponse === "string"
    ) ||
    !(
      state.laterAcknowledgment === null ||
      typeof state.laterAcknowledgment === "string"
    ) ||
    !outcomes.has(state.outcome as null | string) ||
    !(state.outcomeScene === null || typeof state.outcomeScene === "string") ||
    typeof state.rewardGranted !== "boolean" ||
    typeof state.rewardAcknowledged !== "boolean" ||
    typeof state.objective !== "string" ||
    !Array.isArray(state.locations)
  )
    return false;
  const locationIds = new Set<string>();
  const validLocations = state.locations.every((location) => {
    if (typeof location !== "object" || location === null) return false;
    const item = location as Record<string, unknown>;
    if (typeof item.id !== "string" || locationIds.has(item.id)) return false;
    locationIds.add(item.id);
    return (
      ["old-arena", "archive", "hidden-gate"].includes(item.id) &&
      typeof item.access === "string" &&
      ["available", "locked", "hidden"].includes(item.access) &&
      typeof item.completed === "boolean"
    );
  });
  return (
    validLocations && state.locations.length === 3 && locationIds.size === 3
  );
}
