import starterYdk from "./starter-deck.ydk?raw";
import type { DeckRecord } from "./deck-contracts.ts";
import type { DeckBuilderCardView } from "./catalog/ocg-card-mapper.ts";
import type { PinnedDeckRuleset } from "./catalog/pinned-ruleset.ts";
import type { DeckRepository } from "./deck-repository.ts";
import { emptyDeckHistory } from "./deck-history.ts";
import { applyDeckCommand, createBlankDeck } from "./deck-model.ts";
import { validateDeckDraft } from "./deck-validation.ts";
import { importYdk } from "./ydk-adapter.ts";

/* Deliberately not exported from `src/decks/index.ts`: that entry is reached
   eagerly from `src/shell/routes.ts`, so exporting this module would put the
   raw starter list in the entry chunk. Callers import this path directly,
   which ADR-022 allows for the shared deck-data library. */

export const STARTER_DECK_NAME = "Starter Deck";

/* The list itself, so free play and a story save are granted one deck rather
   than two that drift. It sits beside this module instead of among the duel's
   presets because the seeding is what reads it: the preset `player.ydk` is the
   duel's own opening hand, pinned by the recorded programmed-duel transcripts,
   and a copy limit the deck editor enforces is not its concern. */
export const STARTER_DECK_LIST: string = starterYdk;

/**
 * Gives a player who has never built a deck one to duel with.
 *
 * Free play only: it grants a deck and no cards, so a story save it seeded
 * would hold forty cards it does not own (ADR-050). A story save is granted its
 * deck and the collection behind it together, by `new-game` and nowhere else.
 *
 * Called on every such mount, so it is idempotent by construction and
 * best-effort by design: it short-circuits on a default that already exists,
 * adopts a starter deck the player already has rather than making a second
 * one, and answers any failure with a warning. Storage that cannot be seeded
 * must still open the editor, because the player's own decks are in it.
 *
 * `source` exists so a test can seed from a list of catalog codes it controls.
 */
export async function ensureStarterDeck(
  repository: DeckRepository,
  catalog: ReadonlyMap<number, DeckBuilderCardView>,
  ruleset: PinnedDeckRuleset,
  source: string = starterYdk,
): Promise<void> {
  try {
    if ((await repository.getDefaultDeck()) !== null) return;
    const existing = (await repository.list()).find(
      ({ name }) => name === STARTER_DECK_NAME,
    );
    if (existing !== undefined) {
      await repository.setDefaultDeck(existing.id);
      return;
    }
    const imported = importYdk(source);
    if (imported.type !== "ready")
      throw new Error(`Starter deck list is unreadable: ${imported.message}`);
    const draft = createBlankDeck(STARTER_DECK_NAME, catalog, ruleset);
    const result = applyDeckCommand(
      draft,
      { type: "import", cards: imported.cards },
      catalog,
      ruleset,
    );
    if (result.type === "rejected") throw new Error(result.reason);
    /* Not flagged for import review: the player did not import this list, the
       build shipped it, and a review banner on a deck nobody chose is noise. */
    const record: DeckRecord = Object.freeze({
      ...draft,
      ...result.cards,
      importedNeedsReview: false,
      validation: validateDeckDraft(
        { ...result.cards, importedNeedsReview: false },
        catalog,
        ruleset,
      ),
    });
    await repository.create(record, emptyDeckHistory());
    await repository.setDefaultDeck(record.id);
  } catch (error) {
    console.warn("Starter deck was not seeded", error);
  }
}
