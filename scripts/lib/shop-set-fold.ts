/* The fold from YGOPRODeck printings to the one rarity a set sells a card at.
   Extracted out of `scripts/generate-shop-sets.ts` so the rule is unit-testable
   without a network call. */

export type ShopRarity =
  | "common"
  | "rare"
  | "super-rare"
  | "ultra-rare"
  | "secret-rare"
  | "ultimate-rare"
  | "ghost-rare";

export const RARITY_RANK: Record<ShopRarity, number> = {
  common: 0,
  rare: 1,
  "super-rare": 2,
  "ultra-rare": 3,
  "secret-rare": 4,
  "ultimate-rare": 5,
  "ghost-rare": 6,
};

export interface SetPrinting {
  readonly set_name: string;
  readonly set_rarity: string;
}

export interface CardEntry {
  readonly id: number;
  readonly name: string;
  readonly card_sets: readonly SetPrinting[];
}

export interface FoldedCard {
  readonly code: number;
  readonly name: string;
  readonly rarity: ShopRarity;
}

export function mapRarity(raw: string): ShopRarity {
  switch (raw) {
    case "Common":
      return "common";
    case "Rare":
      return "rare";
    case "Super Rare":
      return "super-rare";
    case "Ultra Rare":
      return "ultra-rare";
    case "Secret Rare":
      return "secret-rare";
    case "Ultimate Rare":
      return "ultimate-rare";
    case "Ghost Rare":
      return "ghost-rare";
    // Short Prints → common
    case "Short Print":
    case "Super Short Print":
    case "Duel Terminal Normal Parallel Rare":
      return "common";
    // Parallel variants → base rarity
    case "Parallel Rare":
    case "Duel Terminal Rare Parallel Rare":
    case "Mosaic Rare":
    case "Shatterfoil Rare":
      return "rare";
    case "Super Parallel Rare":
    case "Duel Terminal Super Parallel Rare":
      return "super-rare";
    case "Gold Rare":
    case "Premium Gold Rare":
    case "Ultra Parallel Rare":
    case "Duel Terminal Ultra Parallel Rare":
    case "Ultra Rare (Pharaoh's Rare)":
      return "ultra-rare";
    case "Secret Parallel Rare":
    case "Duel Terminal Secret Parallel Rare":
    case "Starlight Rare":
    case "Collector's Rare":
    case "Prismatic Secret Rare":
    case "Gold Secret Rare":
    case "Platinum Secret Rare":
    case "Extra Secret Rare":
      return "secret-rare";
    case "Quarter Century Secret Rare":
      return "secret-rare";
    default:
      console.warn(`  ⚠ unknown rarity "${raw}" — mapped to common`);
      return "common";
  }
}

/* Printings that are the same card in a fancier finish. A set's Ultimate,
   Ghost, Parallel and Gold runs reprint cards it already sells at a base
   rarity, so they are not a second slot — and "highest printing wins" over
   them priced ten whole sets at their foil tier, which is audit F4 (issue #4):
   every non-common in those sets came out `ultimate-rare` at 500 DP each and a
   150 DP pack sold back for ≈580 DP. Kept as raw upstream strings rather than
   mapped tiers because `Ultimate Rare` and `Ghost Rare` have tiers of their
   own, which a card printed as nothing else still deserves. */
export const VARIANT_PRINTINGS: ReadonlySet<string> = new Set([
  "Ultimate Rare",
  "Ghost Rare",
  "Parallel Rare",
  "Super Parallel Rare",
  "Ultra Parallel Rare",
  "Secret Parallel Rare",
  "Duel Terminal Normal Parallel Rare",
  "Duel Terminal Rare Parallel Rare",
  "Duel Terminal Super Parallel Rare",
  "Duel Terminal Ultra Parallel Rare",
  "Duel Terminal Secret Parallel Rare",
  "Mosaic Rare",
  "Shatterfoil Rare",
  "Starlight Rare",
  "Collector's Rare",
  "Prismatic Secret Rare",
  "Gold Rare",
  "Premium Gold Rare",
  "Gold Secret Rare",
  "Platinum Secret Rare",
  "Extra Secret Rare",
  "Quarter Century Secret Rare",
  "Ultra Rare (Pharaoh's Rare)",
]);

/** The one rarity a set sells a card at, given every rarity that set printed
    it as. Base printings decide it; the highest of them wins, so a genuine
    two-tier printing still ranks. A card with no base printing keeps its
    variant, because that is the only thing the set ever sold. */
export function foldPrintings(
  rawRarities: readonly string[],
): ShopRarity | null {
  if (rawRarities.length === 0) return null;
  const base = rawRarities.filter((raw) => !VARIANT_PRINTINGS.has(raw));
  const considered = base.length > 0 ? base : rawRarities;
  let best: ShopRarity | null = null;
  for (const raw of considered) {
    const rarity = mapRarity(raw);
    if (best === null || RARITY_RANK[rarity] > RARITY_RANK[best]) best = rarity;
  }
  return best;
}

/** Folds one set's worth of API card entries into the shipped card list.
    Printings from other sets are ignored, and a card this set never printed is
    dropped. Output order follows the order upstream listed the cards in. */
export function foldSetCards(
  cards: readonly CardEntry[],
  apiName: string,
): FoldedCard[] {
  const byCode = new Map<number, { name: string; printings: string[] }>();
  for (const card of cards) {
    for (const printing of card.card_sets) {
      if (printing.set_name !== apiName) continue;
      const entry = byCode.get(card.id);
      if (entry === undefined)
        byCode.set(card.id, {
          name: card.name,
          printings: [printing.set_rarity],
        });
      else entry.printings.push(printing.set_rarity);
    }
  }
  const folded: FoldedCard[] = [];
  for (const [code, { name, printings }] of byCode) {
    const rarity = foldPrintings(printings);
    if (rarity !== null) folded.push({ code, name, rarity });
  }
  return folded;
}
