import type { DeckBuilderCardView } from "../../src/decks/catalog/ocg-card-mapper.ts";
import { PROTOTYPE_CATALOG } from "../../src/deck-editor/fixtures/catalog.ts";

/**
 * Generates `count` synthetic `DeckBuilderCardView` entries by cloning the
 * prototype cards round-robin, assigning unique codes and suffixed names.
 * Used in performance tests and differential tests.
 */
export function syntheticCatalog(
  count: number,
): readonly DeckBuilderCardView[] {
  const proto = PROTOTYPE_CATALOG;
  return Array.from({ length: count }, (_, i) => {
    const base = proto[i % proto.length]!;
    return {
      ...base,
      code: base.code + i * 1_000_000,
      name: `${base.name} ${i}`,
    };
  });
}
