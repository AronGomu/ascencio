import {
  quantityLimit,
  PROTOTYPE_RULESET,
} from "../../src/decks/validation/index.ts";
import { DECK_CATALOG } from "../../src/battle/duel/presets/deck-catalog.ts";
import { PROTOTYPE_CATALOG } from "./catalog.ts";
import { installedGameplayFromCatalog } from "./installed-gameplay.ts";

export function installedDuelGameplayFixture() {
  // Installed fixtures must not depend on retired JS-bundled deck payloads.
  const mainCodes = PROTOTYPE_CATALOG.filter(
    (card) =>
      card.canonicalZone === "main" &&
      quantityLimit(PROTOTYPE_RULESET, card.code) === 3,
  ).map((card) => card.code);
  const main = Array.from(
    { length: 40 },
    (_, index) => mainCodes[index % mainCodes.length]!,
  );
  const decks = DECK_CATALOG.map((deck) => ({
    id: deck.id,
    name: deck.name,
    main,
    extra: [],
    side: [],
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
