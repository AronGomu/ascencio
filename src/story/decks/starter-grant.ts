/* The deck a new story save opens with, and the cards behind it.

   `StoryApp` selects installed starter deck before dispatching synchronous
   `new-game`. Grant construction uses no catalog because stored validation is
   cache, not authority: `resolveDeck` plus editor library recompute it against
   same installed gameplay union before use. Save layer checks record shape. */

import {
  LEGACY_STARTER_DECK_LIST as legacyStarterYdk,
  applyDeckCommand,
  createBlankDeck,
  STARTER_DECK_LIST,
  STARTER_DECK_NAME,
  importYdk,
} from "../../decks/editing/index.ts";
import type { StoryRelease } from "../ports/story-release.ts";
import type { DeckBuilderCardView } from "../../decks/catalog/index.ts";
import {
  PROTOTYPE_RULESET,
  validateDeckDraft,
} from "../../decks/validation/index.ts";
import type { DeckCardLists } from "../../decks/contracts/index.ts";
import type { StoryDeck } from "../model/story-state.ts";

const EMPTY_CATALOG: ReadonlyMap<number, DeckBuilderCardView> = new Map();

/* Fixed rather than generated, so two new games produce the same deck byte for
   byte and a save can be diffed against another without the identifiers moving
   underneath. Only one save ever holds this id, because a grant only happens
   where there is no library yet. */
const STARTER_DECK_ID = "story-starter-deck";
const STARTER_DECK_STAMP = "2026-08-20T00:00:00.000Z";

export interface StarterGrant {
  readonly deck: StoryDeck;
  /** Owned count per card code, in the shape the save's collection uses. */
  readonly collection: Readonly<Record<number, number>>;
}

export function buildStarterGrant(): StarterGrant {
  return grantFromList(STARTER_DECK_LIST, STARTER_DECK_NAME);
}

export function buildInstalledStarterGrant(
  chapter: StoryRelease["chapters"][number],
): StarterGrant {
  const installed = chapter.decks.find(
    ({ id }) => id === chapter.defaults.starterDeckId,
  );
  if (installed === undefined)
    throw new Error("Installed starter deck is unavailable");
  return grantFromCards(installed, installed.name);
}

/** Old-schema reads must not grant a different historical deck after an update. */
export function buildLegacyStarterGrant(): StarterGrant {
  return grantFromList(legacyStarterYdk, "Starter Deck");
}

function grantFromList(source: string, name: string): StarterGrant {
  const imported = importYdk(source);
  /* Unreachable in a build that shipped — the list is compiled in, not player
     input — and refused rather than swallowed, because a save granted half a
     deck is worse than a new game that will not start. */
  if (imported.type !== "ready")
    throw new Error(`Starter deck list is unreadable: ${imported.message}`);
  return grantFromCards(imported.cards, name);
}

function grantFromCards(lists: DeckCardLists, name: string): StarterGrant {
  const draft = createBlankDeck(name, EMPTY_CATALOG, PROTOTYPE_RULESET, {
    id: STARTER_DECK_ID,
    now: new Date(STARTER_DECK_STAMP),
  });
  const result = applyDeckCommand(
    draft,
    { type: "import", cards: lists },
    EMPTY_CATALOG,
    PROTOTYPE_RULESET,
  );
  if (result.type === "rejected") throw new Error(result.reason);
  /* Not flagged for import review: the player did not import this list, the
     build granted it, and a review banner on a deck nobody chose is noise. */
  const cards = { ...result.cards, importedNeedsReview: false };
  return Object.freeze({
    deck: Object.freeze({
      ...draft,
      ...cards,
      validation: validateDeckDraft(cards, EMPTY_CATALOG, PROTOTYPE_RULESET),
    }),
    collection: Object.freeze(copiesByCode(result.cards)),
  });
}

/* Every copy the deck uses, credited to the collection: a deck built from cards
   the save does not own is a deck the ownership rule refuses at the first duel,
   which is the whole point of granting the two together.

   Counts only, and no rarity: the collection is code to count, and what a card
   sells for is decided at sell time by `resolveCardRarity` from the shop's own
   set data. The grant cannot price what it gives away; capping that belongs
   to the economy and the save schema, not here. */
function copiesByCode(cards: DeckCardLists): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const code of [...cards.main, ...cards.extra, ...cards.side])
    counts[code] = (counts[code] ?? 0) + 1;
  return counts;
}
