/* A story save's deck as the shared deck-selection screen draws it.

   The verdict is not recomputed here: `pre-battle-decks.ts` already decided
   which of the save's decks may start an encounter and why the others cannot,
   and this only dresses that answer. Splitting them that way is what keeps the
   refusal a rule rather than a tile — the screen shows what the gate said.

   The option and the record are matched by id rather than merged upstream
   because the two reach the screen as separate props and flush separately. A
   record that has not arrived for an option costs the tile its cover, never
   its name or its verdict. */

import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";
import type { DeckTileModel } from "../../deck-select/index.ts";
import type { StoryDeck } from "../model/story-state.ts";
import { deckCoverImageUrl } from "../../decks/deck-cover.ts";
import type { PreBattleDeckOption } from "./pre-battle-decks.ts";

/** What the briefing knows about the save beyond the one deck being drawn. */
export interface PreBattleTileContext {
  readonly catalog: ReadonlyMap<number, DeckBuilderCardView>;
  readonly defaultDeckId: string | null;
}

export function preBattleDeckTile(
  option: PreBattleDeckOption,
  record: StoryDeck | undefined,
  context: Readonly<PreBattleTileContext>,
): DeckTileModel {
  return {
    key: option.id,
    name: option.name,
    /* The tile's one line of prose. An illegal deck spends it on why, which is
       the fact the player is on this screen to act on; a legal one says what
       it is, because a save's decks are the save's rather than bundled. */
    meta: option.issue ?? "Save deck",
    coverImageUrl:
      record === undefined ? null : deckCoverImageUrl(record, context.catalog),
    legal: option.legal,
    blockReason: option.issue,
    bundled: false,
    lockedBy: null,
    isDefault: option.id === context.defaultDeckId,
    /* Deleting a save's deck is the story deck editor's, reached from this
       screen rather than performed on it. */
    deletable: false,
    updatedAt: record?.updatedAt ?? null,
  };
}
