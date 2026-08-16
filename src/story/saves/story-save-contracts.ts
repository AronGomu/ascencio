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
export const STORY_SAVE_SCHEMA_VERSION = 2;

/** The oldest schema this build can still read. Version 1 predates the shop:
    it carries no economy, and `migrateStorySaveState` completes it. */
const OLDEST_READABLE_SCHEMA_VERSION = 1;

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
  readonly schemaVersion: 2;
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
  if (!isCount(schemaVersion) || schemaVersion < OLDEST_READABLE_SCHEMA_VERSION)
    return corrupt(slot, "Save record has no usable schema version");
  if (schemaVersion > STORY_SAVE_SCHEMA_VERSION)
    return { kind: "incompatible", slot, found: schemaVersion };

  if (!hasExactKeys(record, ENVELOPE_KEYS))
    return corrupt(slot, "Save record does not have the expected fields");
  if (record.slot !== slot)
    return corrupt(slot, `Save record belongs to another slot`);
  if (!isCount(record.revision) || record.revision < 1)
    return corrupt(slot, "Save record has no usable revision");
  if (!isCount(record.savedAt))
    return corrupt(slot, "Save record has no usable timestamp");
  const state = migrateStorySaveState(record.state, schemaVersion);
  if (state === null) return corrupt(slot, "Saved story state is invalid");

  /* Rebuilt rather than cast, so a `ready` envelope always describes itself as
     the version this build actually returns: an older record reaches the story
     already migrated, and nothing downstream has to ask which version it came
     from. The state object is passed through untouched when it is already v2,
     so a round-trip preserves it exactly. */
  return {
    kind: "ready",
    envelope: {
      schemaVersion: STORY_SAVE_SCHEMA_VERSION,
      slot,
      revision: record.revision,
      savedAt: record.savedAt,
      state,
    },
  };
}

/** What a save written before the shop existed is missing. Every field is a
    fresh player's: a returning save resumes funded, owning nothing, with no
    shop visit half-open.

    Built per call rather than shared, so two migrated saves never end up
    pointing at one inventory object. */
function economyDefaults(): Record<string, unknown> {
  return {
    dp: 1000,
    boosters: {},
    collection: {},
    shopReturnScreen: null,
    shopSetId: null,
    openedCards: null,
    openingMode: null,
  };
}

/**
 * Brings a stored story state up to the shape this build runs on, or answers
 * `null` when it cannot be read at all.
 *
 * Version 2 is validated as-is. Version 1 has the economy spread in *under*
 * the stored fields, so a value the record already carries always wins over
 * the default, and the completed state is then validated exactly like a
 * version 2 one — a v1 record with a broken beat index stays corrupt rather
 * than being laundered by the migration. Any other version answers `null`;
 * the caller has already separated "too new" from "unreadable".
 */
export function migrateStorySaveState(
  raw: unknown,
  schemaVersion: number,
): StoryState | null {
  if (schemaVersion !== 1 && schemaVersion !== 2) return null;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return null;
  const candidate =
    schemaVersion === 1 ? { ...economyDefaults(), ...raw } : raw;
  return isStoryState(candidate) ? candidate : null;
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
  "shop-greeting": "Card shop",
  "shop-browse": "Card shop",
  "shop-cards": "Card shop",
  "shop-sell": "Card shop",
  "shop-opening": "Card shop",
  "shop-results": "Card shop",
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

/* The wallet, what the player owns, and the shop visit in progress. A stored
   balance that is not a whole non-negative number, or an inventory holding
   something other than counts, is a record this build must not resume from:
   the economy is the one part of the state a player could otherwise forge. */
function isEconomy(state: Record<string, unknown>): boolean {
  const screens = new Set<string>(STORY_SCREENS);
  const rarities = new Set<string>([
    "common",
    "rare",
    "super-rare",
    "ultra-rare",
    "secret-rare",
    "ultimate-rare",
    "ghost-rare",
  ]);
  return (
    isCount(state.dp) &&
    isCountRecord(state.boosters) &&
    isCountRecord(state.collection) &&
    (state.shopReturnScreen === null ||
      (typeof state.shopReturnScreen === "string" &&
        screens.has(state.shopReturnScreen))) &&
    (state.shopSetId === null || typeof state.shopSetId === "string") &&
    (state.openedCards === null ||
      (Array.isArray(state.openedCards) &&
        state.openedCards.every((card) => {
          if (typeof card !== "object" || card === null) return false;
          const opened = card as Record<string, unknown>;
          return (
            isCount(opened.code) &&
            typeof opened.rarity === "string" &&
            rarities.has(opened.rarity)
          );
        }))) &&
    (state.openingMode === null ||
      state.openingMode === "sequential" ||
      state.openingMode === "all")
  );
}

function isCountRecord(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(isCount)
  );
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
  /* Both handoff fields accept `undefined` as well as `null`: a save written
     before the duel handoff existed carries neither key, and reading that as
     corruption would cost a player progress this build can resume perfectly
     well. `restoreStoryState` normalises them on the way back in. */
  const encounters = new Set([
    undefined,
    null,
    "old-arena",
    "archive",
    "hidden-gate",
  ]);
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
    !encounters.has(state.encounterId as undefined | null | string) ||
    !(
      state.pendingHandoffId === null ||
      state.pendingHandoffId === undefined ||
      typeof state.pendingHandoffId === "string"
    ) ||
    !Array.isArray(state.locations) ||
    !isEconomy(state)
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
