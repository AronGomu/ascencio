import type { CardCode, CardDefinition, Cards } from "./contracts.ts";
import { parseCardDefinitions } from "./parse-card-definitions.ts";

export function createCards(definitions: readonly CardDefinition[]): Cards {
  const byCode = new Map<CardCode, CardDefinition>();
  for (const definition of parseCardDefinitions(definitions)) {
    const previous = byCode.get(definition.code);
    if (
      previous !== undefined &&
      JSON.stringify(previous) !== JSON.stringify(definition)
    )
      throw new Error("CARDS_INVALID_DEFINITION");
    byCode.set(definition.code, definition);
  }
  const all = Object.freeze(
    [...byCode.values()].sort((a, b) => a.code - b.code),
  );
  return Object.freeze({
    get: (code: CardCode) => byCode.get(code),
    all: () => all,
  });
}
