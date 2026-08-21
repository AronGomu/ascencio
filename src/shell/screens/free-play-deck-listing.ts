import type { SelectableDeck } from "../../battle/index.ts";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../decks/catalog/pinned-ruleset.ts";
import { runtimeCatalog } from "../../decks/catalog/runtime-catalog.ts";
import { IndexedDbDeckRepository } from "../../decks/indexeddb-deck-repository.ts";
import type { BattleDeckModule } from "../domain-loaders.ts";

/**
 * Every deck a free-play seat may be given: the bundled list this build ships,
 * plus the decks in the free-play library that this build can actually play.
 *
 * The battle entry owns which decks qualify — `listSelectableDecks` drops a
 * local deck the pinned ruleset refuses or the card snapshot cannot draw — so
 * the shell only supplies the library and the catalog it is validated against.
 *
 * Nothing here writes. A library that will not open is answered with the
 * bundled decks alone rather than an error: they are compiled into this build,
 * so a match is still one click away, and the deck editor is where a library
 * is repaired.
 */
export async function loadFreePlayDecks(
  battle: BattleDeckModule,
): Promise<readonly SelectableDeck[]> {
  let repository: IndexedDbDeckRepository | null = null;
  try {
    /* Both before the library opens: each is a read the listing needs anyway,
       and the catalog is what every local deck's codes are resolved against. */
    const [supportedCodes, cards] = await Promise.all([
      battle.supportedDuelCardCodes(),
      runtimeCatalog(),
    ]);
    repository = await IndexedDbDeckRepository.open();
    return await battle.listSelectableDecks(
      battle.DECK_CATALOG,
      repository,
      catalogByCode(cards),
      PROTOTYPE_RULESET,
      supportedCodes,
    );
  } catch {
    return battle.presetSelectableDecks(battle.DECK_CATALOG);
  } finally {
    repository?.close();
  }
}
