import { createHash } from "node:crypto";
import path from "node:path";
import type { ExportReceipt } from "../../../src/storage/contracts/package-build.ts";
import type { SetRow } from "../../../src/storage/contracts/package-payloads.ts";
import { parseCardSetSource } from "../content-setup.ts";
import { mapRarity } from "../shop-set-fold.ts";
import {
  normalizedJson,
  NormalizedSourceFailure,
  type NormalizedMediaSource,
} from "./normalized-package-source.ts";

const SOURCE = "authoring/card-set-source.json";
interface Printing {
  readonly printingCode: string;
  readonly sourceRarity: string;
  readonly sourceRarityCode: string;
}
interface SetCard extends Printing {
  readonly setId: string;
  readonly cardCode: number;
  readonly rarity: string;
}

/** Global source is not chapter-corrected or era-filtered. */
export async function loadGlobalSets(
  root: string,
  codes: readonly number[],
  media: readonly NormalizedMediaSource[],
) {
  const raw = await normalizedJson(root, SOURCE, "card-library");
  const source = parseCardSetSource(Buffer.from(JSON.stringify(raw)));
  if (!source) invalid();
  const shop = await normalizedJson(
    root,
    "authoring/shop-sets.v1.json",
    "card-library",
  );
  if (!record(shop) || !Array.isArray(shop.sets)) invalid();
  const byName = new Map<string, string>();
  const used = new Map<string, string>();
  for (const set of shop.sets) {
    if (
      !record(set) ||
      !text(set.name) ||
      !text(set.id) ||
      !/^[A-Za-z0-9_-]+$/.test(set.id) ||
      byName.has(set.name) ||
      used.has(set.id)
    )
      invalid();
    byName.set(set.name, set.id);
    used.set(set.id, set.name);
  }
  const catalog = new Set(codes);
  const sets: SetRow[] = [];
  const setCards: SetCard[] = [];
  const assets: NormalizedMediaSource[] = [];
  const excludedSetMemberships: ExportReceipt["excludedSetMemberships"][number][] =
    [];
  const rarityWarnings = new Map<
    string,
    ExportReceipt["rarityWarnings"][number]
  >();
  const tiers = new Map<string, string>();
  for (const set of source.sets) {
    if (!(set.code === null || text(set.code))) invalid();
    // Same existing-name/hash identity rule as chapterSetIdentities; no date synthesis.
    const id =
      byName.get(set.name) ??
      `set-${createHash("sha256").update(set.name, "utf8").digest("hex").slice(0, 16)}`;
    if (used.has(id) && used.get(id) !== set.name) invalid();
    used.set(id, set.name);
    const images = media.filter(
      (asset) =>
        asset.path.startsWith("sets/") &&
        path.posix.parse(asset.path).name === id,
    );
    if (images.length > 1) invalid();
    const image = images[0] ?? {
      path: `sets/${id}.jpg`,
      source: `images/sets/${id}.jpg`,
      mime: "image/jpeg",
      optional: true,
    };
    assets.push(image);
    const releaseYear =
      set.tcgReleaseDate === null
        ? null
        : Number(set.tcgReleaseDate.slice(0, 4));
    if (releaseYear !== null && (releaseYear < 1 || releaseYear > 9999))
      invalid();
    sets.push({ id, name: set.name, releaseYear, imageAssetPath: image.path });
    for (const card of set.cards) {
      if (
        !text(card.name) ||
        !Array.isArray(card.printings) ||
        card.printings.length === 0
      )
        invalid();
      const identities = new Set<string>();
      const printings: Printing[] = card.printings
        .map((printing: unknown) => {
          if (
            !record(printing) ||
            !text(printing.code) ||
            !text(printing.rarity) ||
            !text(printing.rarityCode, true)
          )
            invalid();
          const identity = JSON.stringify([
            printing.code,
            printing.rarity,
            printing.rarityCode,
          ]);
          if (identities.has(identity)) invalid();
          identities.add(identity);
          return {
            printingCode: printing.code,
            sourceRarity: printing.rarity,
            sourceRarityCode: printing.rarityCode,
          };
        })
        .sort(comparePrintings);
      if (!catalog.has(card.id)) {
        excludedSetMemberships.push({
          setId: id,
          setName: set.name,
          sourceSetCode: set.code,
          cardCode: card.id,
          sourceCardName: card.name,
          reason: "missing-catalog-card",
          printings,
        });
        continue;
      }
      for (const printing of printings) {
        let rarity = tiers.get(printing.sourceRarity);
        if (rarity === undefined) {
          rarity = mapRarity(printing.sourceRarity);
          tiers.set(printing.sourceRarity, rarity);
          if (
            printing.sourceRarity !==
            {
              common: "Common",
              rare: "Rare",
              "super-rare": "Super Rare",
              "ultra-rare": "Ultra Rare",
              "secret-rare": "Secret Rare",
              "ultimate-rare": "Ultimate Rare",
              "ghost-rare": "Ghost Rare",
            }[rarity]
          )
            rarityWarnings.set(printing.sourceRarity, {
              sourceRarity: printing.sourceRarity,
              rarity,
              reason: "lossy-presentation-tier",
            });
        }
        setCards.push({ setId: id, cardCode: card.id, ...printing, rarity });
      }
    }
  }
  return {
    sets: sets.sort((a, b) => compare(a.id, b.id)),
    setCards: setCards.sort(
      (a, b) =>
        compare(a.setId, b.setId) ||
        a.cardCode - b.cardCode ||
        comparePrintings(a, b),
    ),
    assets,
    excludedSetMemberships: excludedSetMemberships.sort(
      (a, b) => compare(a.setId, b.setId) || a.cardCode - b.cardCode,
    ),
    rarityWarnings: [...rarityWarnings.values()].sort((a, b) =>
      compare(a.sourceRarity, b.sourceRarity),
    ),
  };
}
function comparePrintings(a: Printing, b: Printing): number {
  return (
    compare(a.printingCode, b.printingCode) ||
    compare(a.sourceRarity, b.sourceRarity) ||
    compare(a.sourceRarityCode, b.sourceRarityCode)
  );
}
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown, empty = false): value is string {
  return (
    typeof value === "string" &&
    (empty || value.trim().length > 0) &&
    value.length <= 512 &&
    ![...value].some((character) => character.charCodeAt(0) < 32)
  );
}
function invalid(): never {
  throw new NormalizedSourceFailure("card-library", SOURCE);
}
