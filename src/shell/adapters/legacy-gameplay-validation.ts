import type { InstalledGameplay } from "../../content/index.ts";
import type { CardDefinition } from "../../cards/index.ts";

export async function validateLegacyGameplay(
  gameplay: InstalledGameplay,
): Promise<void> {
  try {
    const [
      { cardCode, createCards },
      { PROTOTYPE_RULESET, validatePublishedDecks },
    ] = await Promise.all([
      import("../../cards/index.ts"),
      import("../../decks/validation/index.ts"),
    ]);
    const definitions: CardDefinition[] = gameplay.cards.map((card) => {
      const code = cardCode(card.code);
      return {
        code,
        alias: card.record.alias,
        setcodes: card.record.setcodes,
        type: card.record.type,
        level: card.record.level,
        attribute: card.record.attribute,
        race: card.record.race,
        attack: card.record.attack,
        defense: card.record.defense,
        lscale: card.record.lscale,
        rscale: card.record.rscale,
        linkMarker: card.record.linkMarker,
        scope: card.record.ot,
        name: card.text.name,
        description: card.text.description,
        strings: card.text.strings,
        images: {
          full: { code, variant: "full" },
          cropped: { code, variant: "cropped" },
        },
      };
    });
    validatePublishedDecks(
      gameplay.decks,
      createCards(definitions),
      PROTOTYPE_RULESET,
    );
  } catch (cause) {
    throw new Error("APP_REQUIRED_INPUT_FAILED", { cause });
  }
}
