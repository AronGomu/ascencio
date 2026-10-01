import path from "node:path";
import type { CanonicalSet } from "../../../src/modules/commerce/content.ts";
import { validCanonicalSet } from "../../../src/modules/commerce/validation.ts";
import { readEntities } from "./commerce-source.ts";
import {
  NormalizedSourceFailure,
  type NormalizedMediaSource,
} from "./normalized-package-source.ts";
/** Canonical entities already carry stable IDs and normalized printing identities. */
export async function loadGlobalSets(
  root: string,
  codes: readonly number[],
  media: readonly NormalizedMediaSource[],
  compiled?: readonly CanonicalSet[],
) {
  const raw = compiled ?? (await readEntities(root, "sets"));
  if (!raw.every(validCanonicalSet))
    throw new NormalizedSourceFailure("card-library", "sets");
  const catalog = new Set(codes);
  const sets = [],
    setCards = [],
    assets: NormalizedMediaSource[] = [];
  for (const set of raw) {
    const { cards, ...metadata } = set;
    sets.push(metadata);
    if (set.imageAssetPath !== null) {
      const matches = media.filter(
        (asset) => asset.path === set.imageAssetPath,
      );
      if (matches.length > 1)
        throw new NormalizedSourceFailure("card-library", "sets");
      assets.push(
        matches[0] ?? {
          path: set.imageAssetPath,
          source: `images/${set.imageAssetPath}`,
          mime:
            (
              {
                ".png": "image/png",
                ".webp": "image/webp",
                ".svg": "image/svg+xml",
              } as Record<string, string>
            )[path.extname(set.imageAssetPath)] ?? "image/jpeg",
          optional: true,
        },
      );
    }
    for (const card of cards) {
      if (!catalog.has(card.cardCode))
        throw new NormalizedSourceFailure(
          "card-library",
          `sets/${set.id}.json`,
        );
      setCards.push({ setId: set.id, ...card });
    }
  }
  return {
    sets: sets.sort((a, b) => a.id.localeCompare(b.id, "en")),
    setCards: setCards.sort(
      (a, b) =>
        a.setId.localeCompare(b.setId, "en") ||
        a.cardCode - b.cardCode ||
        a.printingCode.localeCompare(b.printingCode, "en") ||
        a.sourceRarity.localeCompare(b.sourceRarity, "en") ||
        a.sourceRarityCode.localeCompare(b.sourceRarityCode, "en"),
    ),
    assets,
    excludedSetMemberships: [],
    rarityWarnings: [],
  };
}
