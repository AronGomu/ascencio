import type { DeckId } from "./deck-catalog.ts";
import { parseYdk } from "./deck-parser.ts";

/** Union of every bundled deck's main and extra codes. Replaces the hand-listed MVP pool. */
export function reviewedCardPool(
  sources: ReadonlyMap<DeckId, string>,
): ReadonlySet<number> {
  const codes = new Set<number>();
  for (const source of sources.values()) {
    const deck = parseYdk(source);
    for (const code of [...deck.main, ...deck.extra, ...deck.side]) {
      codes.add(code);
    }
  }
  return codes;
}
