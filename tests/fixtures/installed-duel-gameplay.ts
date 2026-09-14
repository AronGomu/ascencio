import { presetSelectableDecks } from "../../src/battle/decks/selectable-decks.ts";
import { DECK_CATALOG } from "../../src/battle/duel/presets/deck-catalog.ts";
import { PROTOTYPE_CATALOG } from "./catalog.ts";
import { installedGameplayFromCatalog } from "./installed-gameplay.ts";

export function installedDuelGameplayFixture() {
  const decks = presetSelectableDecks(DECK_CATALOG).map((deck) => ({
    id: deck.key.slice("preset:".length),
    name: deck.label,
    main: deck.lists.main,
    extra: deck.lists.extra,
    side: deck.lists.side,
  }));
  return installedGameplayFromCatalog(PROTOTYPE_CATALOG, {
    decks: Object.freeze(decks),
    opponents: Object.freeze([
      {
        id: "installed-opponent",
        name: "Installed opponent",
        line: "Installed chapter opponent",
        deckId: "chapter-one-practice",
        policyId: "basic",
      },
    ]),
    defaults: Object.freeze({
      starterDeckId: "chapter-one-starter",
      opponentId: "installed-opponent",
    }),
  });
}
