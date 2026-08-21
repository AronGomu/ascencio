/* The deck a story encounter hands the duel.

   `pre-battle-decks.ts` decides which of a save's decks the briefing offers;
   this turns the one that was chosen into the `ValidatedDeckSnapshot` the
   `BattleRequest` carries. Both read the same three inputs — the live catalog,
   the pinned ruleset and the save's own ownership — so a deck the briefing
   refused can never resolve here, and the gate is a rule rather than a screen.

   The catalog is read rather than passed in: the encounter can be started from
   the briefing, which has already awaited it, and from the retry on the outcome
   screen, which is a fresh mount of this domain that has not. Resolving against
   an empty catalog calls every card missing, so both callers have to hold the
   real one. `runtimeCatalog()` is read at most once per page. */

import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../decks/catalog/pinned-ruleset.ts";
import { runtimeCatalog } from "../../decks/catalog/runtime-catalog.ts";
import { emptyDeckHistory } from "../../decks/deck-history.ts";
import { resolveDeck, type ValidatedDeckSnapshot } from "../../decks/index.ts";
import type { StoryState } from "../model/story-state.ts";
import { storyCardOwnership } from "./card-ownership.ts";

/**
 * The save's chosen deck as the duel takes it, or `null` when it cannot be
 * fielded.
 *
 * One `null` for every reason — no default, a default naming a deck the save
 * no longer has, a deck that breaks a build rule, a deck built from cards the
 * save has since sold. The caller's answer is the same in all four: this
 * encounter does not start, and the player is sent back to choose again.
 */
export async function encounterDeck(
  state: StoryState,
): Promise<ValidatedDeckSnapshot | null> {
  const chosen = state.decks.find(({ id }) => id === state.defaultDeckId);
  if (chosen === undefined) return null;
  const catalog = catalogByCode(await runtimeCatalog());
  /* A reader over the save rather than the story's own `DeckRepository`: this
     resolves one deck and writes nothing, and the repository's other half is a
     dispatch-and-persist loop no read has any business holding. */
  const resolved = await resolveDeck(
    chosen.id,
    {
      load: () =>
        Promise.resolve({ deck: chosen, history: emptyDeckHistory() }),
    },
    catalog,
    PROTOTYPE_RULESET,
    storyCardOwnership(state),
  );
  return resolved.type === "ready" ? resolved.deck : null;
}
