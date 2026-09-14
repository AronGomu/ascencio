import type { CardDefinition } from "./contracts.ts";
import { createCards } from "./create-cards.ts";

export function validateCardConsistency(
  chapter: readonly CardDefinition[],
  runtime: readonly CardDefinition[],
): void {
  const expected = createCards(runtime);
  for (const definition of createCards(chapter).all()) {
    if (
      JSON.stringify(definition) !==
      JSON.stringify(expected.get(definition.code))
    )
      throw new Error("CARDS_INVALID_DEFINITION");
  }
}
