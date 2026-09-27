/* Current slot vocabulary, save labels and strict Story/deck predicates.
   Structural user-envelope validation lives in stored-story-envelope.ts. */

import { PROLOGUE } from "../content/prologue.ts";
import {
  STORY_SCREENS,
  type StoryScreen,
  type StoryState,
} from "../model/story-state.ts";

import type { StorySlotKey } from "./generation-contracts.ts";

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
    isCountRecord(state.boosters, isSetIdKey) &&
    isCountRecord(state.collection, isCardCodeKey) &&
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

/* The decks this save owns, and which one it duels with. A deck the editor
   cannot open is a deck the player built and then lost, so each record is
   checked field by field like the economy — and two decks under one id are
   refused outright, because every command that edits or deletes a deck
   addresses it by id and one of the pair would be unreachable.

   `defaultDeckId` is checked as an id, not as a pointer: a default naming a
   deck this save no longer has costs one pick screens ignore, while calling
   that record corrupt costs the player the save. */
function isDeckLibrary(state: Record<string, unknown>): boolean {
  const decks = state.decks;
  if (!Array.isArray(decks) || !decks.every(isStoryDeck)) return false;
  if (new Set(decks.map((deck) => deck.id)).size !== decks.length) return false;
  return (
    state.defaultDeckId === null || typeof state.defaultDeckId === "string"
  );
}

/** Exported so the deck repository can refuse a record before it is written:
    a deck this predicate rejects makes the whole save unreadable, and the
    editor's own validator is stricter in ways the save does not care about. */
export function isStoryDeck(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const deck = value as Record<string, unknown>;
  return (
    deck.schemaVersion === 1 &&
    typeof deck.id === "string" &&
    deck.id.length > 0 &&
    isCount(deck.revision) &&
    typeof deck.name === "string" &&
    typeof deck.createdAt === "string" &&
    typeof deck.updatedAt === "string" &&
    typeof deck.importedNeedsReview === "boolean" &&
    (deck.illustrationCardCode === undefined ||
      deck.illustrationCardCode === null ||
      isCount(deck.illustrationCardCode)) &&
    isCardCodeList(deck.main) &&
    isCardCodeList(deck.extra) &&
    isCardCodeList(deck.side) &&
    isDeckValidation(deck.validation)
  );
}

function isCardCodeList(value: unknown): boolean {
  return Array.isArray(value) && value.every(isCount);
}

/* The stored verdict is a cache rather than an authority — the editor
   recomputes it against the pinned ruleset — so only its shape is checked
   here. A verdict this build would now compute differently costs a
   revalidation, not a save. */
function isDeckValidation(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const summary = value as Record<string, unknown>;
  return (
    (summary.status === "valid" ||
      summary.status === "warnings" ||
      summary.status === "errors") &&
    Array.isArray(summary.issues) &&
    typeof summary.rulesetRevision === "string"
  );
}

/* Keys as well as values: an inventory is a record, and a key outside its
   own vocabulary is a record the screens cannot render. `Number("a")` is
   `NaN`, and two such keys collide into one `NaN` row, which takes the sell
   screen down mid-visit rather than at the door. */
function isCountRecord(
  value: unknown,
  isKey: (key: string) => boolean,
): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.entries(value).every(([key, count]) => isKey(key) && isCount(count))
  );
}

/** A card code, written the one way `Object.keys` gives it back. */
function isCardCodeKey(key: string): boolean {
  const code = Number(key);
  return Number.isSafeInteger(code) && code >= 0 && String(code) === key;
}

/** A shop set id. Unknown ids are refused when a pack is opened rather than
    here: a data file that drops a set must not cost a player their save. */
function isSetIdKey(key: string): boolean {
  return key.length > 0;
}

/* Carried over unchanged from the browser-storage record this replaced: a save
   is only resumable if every screen, beat index and map node in it is one the
   current content actually has. */
export function isStoryState(
  value: unknown,
  beatCount = PROLOGUE.beats.length,
): value is StoryState {
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
    !(
      state.previousScreen === null ||
      (typeof state.previousScreen === "string" &&
        screens.has(state.previousScreen))
    ) ||
    typeof state.savedScreen !== "string" ||
    !screens.has(state.savedScreen) ||
    typeof state.progressExists !== "boolean" ||
    !Number.isSafeInteger(state.narrativeIndex) ||
    (state.narrativeIndex as number) < 0 ||
    (state.narrativeIndex as number) >= beatCount ||
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
    !isEconomy(state) ||
    !isDeckLibrary(state)
  )
    return false;
  const VALID_LOCATION_IDS = new Set([
    "old-arena",
    "archive",
    "hidden-gate",
    "card-shop",
  ]);
  const REQUIRED_LOCATION_IDS = ["old-arena", "archive", "hidden-gate"];
  const locationIds = new Set<string>();
  const validLocations = state.locations.every((location) => {
    if (typeof location !== "object" || location === null) return false;
    const item = location as Record<string, unknown>;
    if (typeof item.id !== "string" || locationIds.has(item.id)) return false;
    locationIds.add(item.id);
    return (
      VALID_LOCATION_IDS.has(item.id) &&
      typeof item.access === "string" &&
      ["available", "locked", "hidden"].includes(item.access) &&
      typeof item.completed === "boolean"
    );
  });
  return (
    validLocations &&
    REQUIRED_LOCATION_IDS.every((id) => locationIds.has(id)) &&
    locationIds.size === state.locations.length
  );
}
