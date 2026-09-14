import type { InstalledGameplay } from "../../content/index.ts";
import { cardCode, createCards } from "../../cards/index.ts";
/** Read-only legacy free-play projection. Never assigns a Story release/save binding. */
export function legacyCollectionInputs(gameplay: InstalledGameplay) {
  const cards = createCards(
    gameplay.cards.map(({ code, record, text }) => ({
      ...record,
      ...text,
      code: cardCode(code),
      scope: record.ot,
      images: {
        full: { code: cardCode(code), variant: "full" as const },
        cropped: { code: cardCode(code), variant: "cropped" as const },
      },
    })),
  );
  const sets = gameplay.sets.map((set) => ({
    id: set.id,
    name: set.name,
    releaseYear: set.releaseYear,
    cards: set.cards.map((c) => ({ ...c, code: cardCode(c.code) })),
  }));
  return { cards, sets };
}
