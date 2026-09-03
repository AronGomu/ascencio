/* Which of a story save's decks may start an encounter, and why the ones that
   cannot are refused.

   The verdict is recomputed here rather than read off `deck.validation`. That
   field is a cache built with an empty catalog — `starter-grant.ts` writes
   `errors` into every new save for exactly that reason — so trusting it would
   refuse the one deck a first-time player owns. The same three inputs the deck
   library revalidates its rows from are used instead: the live catalog, the
   pinned ruleset and the save's own ownership, so this screen and the editor
   cannot disagree about a deck (ADR-050).

   Illegal means errors, never warnings. The granted starter deck has no Extra
   and no Side deck and so validates to `warnings`; a gate that asked for a
   clean verdict would lock every fresh save out of its first duel. */

import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";
import { PROTOTYPE_RULESET } from "../../decks/catalog/pinned-ruleset.ts";
import { validateDeckDraft } from "../../decks/deck-validation.ts";
import type { StoryState } from "../model/story-state.ts";
import { storyCardOwnership } from "./card-ownership.ts";

/** One deck as the pre-battle screen offers it. */
export interface PreBattleDeckOption {
  readonly id: string;
  readonly name: string;
  /** Whether an encounter may start on this deck. */
  readonly legal: boolean;
  /** Bundled presets can duel but have no editor record. */
  readonly bundled: boolean;
  /** The first thing wrong with it, or null while nothing is. Errors only:
      warnings are not worth stopping a duel for and not worth the space. */
  readonly issue: string | null;
}

/** Why Start refuses, and which way out to offer. `build` is a save holding no
    decks at all, which the deck editor answers with a new one; `repair` is a
    deck that exists and cannot be fielded. */
export interface PreBattleBlock {
  readonly reason: string;
  readonly action: "build" | "repair";
}

/** Every deck the save holds, in the order the save holds them, each with the
    verdict this build's catalog gives it. */
export function preBattleDeckOptions(
  state: StoryState,
  catalog: ReadonlyMap<number, DeckBuilderCardView>,
): readonly PreBattleDeckOption[] {
  const ownership = storyCardOwnership(state);
  return state.decks.map((deck) => {
    const { issues } = validateDeckDraft(
      { ...deck, storedRulesetRevision: deck.validation.rulesetRevision },
      catalog,
      PROTOTYPE_RULESET,
      ownership,
    );
    const error = issues.find(({ severity }) => severity === "error");
    return Object.freeze({
      id: deck.id,
      name: deck.name,
      legal: error === undefined,
      bundled: false,
      issue: error?.message ?? null,
    });
  });
}

/**
 * The deck the screen opens on.
 *
 * The save's default wins even when it is the broken one: a player whose
 * default deck stopped working has to be told, and quietly starting them on
 * some other deck hides the problem behind a duel they did not choose the deck
 * for. Every legal deck is one click away on the same screen, so this costs a
 * click rather than a way forward. The fallback covers a save with no default
 * and one whose default names a deck it no longer has.
 */
export function preBattleSelection(
  options: readonly PreBattleDeckOption[],
  defaultDeckId: string | null,
): string | null {
  if (options.some(({ id }) => id === defaultDeckId)) return defaultDeckId;
  return options.find(({ legal }) => legal)?.id ?? null;
}

/** Why this save cannot start the encounter on `selectedId`, or null when it
    can. */
export function preBattleBlock(
  options: readonly PreBattleDeckOption[],
  selectedId: string | null,
): PreBattleBlock | null {
  if (options.length === 0)
    return Object.freeze({
      reason: "This save has no decks yet. Build one to duel with.",
      action: "build",
    });
  const selected = options.find(({ id }) => id === selectedId);
  if (selected === undefined)
    return Object.freeze({
      reason: "None of this save's decks can be used. Repair one to duel.",
      action: "repair",
    });
  if (selected.legal) return null;
  return Object.freeze({
    reason: `${selected.name} cannot be used: ${selected.issue ?? "it is not legal."}`,
    action: "repair",
  });
}
