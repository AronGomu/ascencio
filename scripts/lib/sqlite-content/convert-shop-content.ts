import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { hashFile } from "./asset-restructure.ts";
import {
  reference,
  validCanonicalSet,
} from "../../../src/modules/commerce/validation.ts";
import { COMMERCE_RARITIES } from "../../../src/modules/commerce/content.ts";
/** Conversion is explicit, offline and read-only against release-pinned packages. */
export async function convertShopContent(
  root: string,
  releaseFile: string,
  destination: string,
): Promise<void> {
  const release = JSON.parse(await readFile(releaseFile, "utf8")) as {
    packages: {
      packageId: string;
      version: string;
      bytes: number;
      sha256: string;
    }[];
  };
  const files = new Map<string, string>();
  for (const id of ["card-library", "chapter-01"]) {
    const entry = release.packages.find((p) => p.packageId === id);
    if (!entry || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(entry.version))
      throw new Error("SOURCE_RELEASE_INVALID");
    const file = path.join(
      root,
      "generated/content-packages",
      `${id}-${entry.version}.sqlite`,
    );
    if (
      (await stat(file)).size !== entry.bytes ||
      (await hashFile(file)) !== entry.sha256
    )
      throw new Error("SOURCE_INTEGRITY_FAILED");
    files.set(id, file);
  }
  const library = new DatabaseSync(files.get("card-library")!, {
    readOnly: true,
  });
  const chapter = new DatabaseSync(files.get("chapter-01")!, {
    readOnly: true,
  });
  const outputs = new Map<string, unknown>();
  try {
    const printings = library.prepare(
      "SELECT card_code,printing_code,rarity,source_rarity,source_rarity_code FROM set_cards WHERE set_id=? ORDER BY card_code,printing_code,source_rarity,source_rarity_code",
    );
    for (const row of library
      .prepare("SELECT id,metadata_json FROM sets ORDER BY id")
      .all()) {
      const set = JSON.parse(String(row.metadata_json));
      if (!reference(row.id) || set.id !== row.id)
        throw new Error("SOURCE_SET_INVALID");
      outputs.set(`sets/${row.id}.json`, {
        ...set,
        cards: printings.all(row.id!).map((p) => ({
          cardCode: p.card_code,
          printingCode: p.printing_code,
          rarity: p.rarity,
          sourceRarity: p.source_rarity,
          sourceRarityCode: p.source_rarity_code,
        })),
      });
      outputs.set(`boosters/${row.id}.json`, {
        id: row.id,
        name: set.name,
        setId: row.id,
        replacement: "with",
        slots: [
          {
            count: 8,
            rarities: [{ rarity: "common", weight: 1 }],
            fallback: "all",
          },
          {
            count: 1,
            rarities: COMMERCE_RARITIES.filter((r) => r !== "common").map(
              (rarity) => ({ rarity, weight: 1 }),
            ),
            fallback: "all",
          },
        ],
      });
    }
    outputs.set("economies/base.json", {
      id: "base",
      sellPrices: {
        common: 1,
        rare: 2,
        "super-rare": 5,
        "ultra-rare": 20,
        "secret-rare": 50,
        "ultimate-rare": 50,
        "ghost-rare": 50,
      },
      singlesMultiplier: 4,
      maxPackResale: 21,
    });
    const config = JSON.parse(
      String(
        chapter
          .prepare("SELECT value_json FROM package_meta WHERE key='config'")
          .get()!.value_json,
      ),
    );
    outputs.set("shops/chapter-01.json", {
      id: "chapter-01",
      economyId: "base",
      offers: config.setIds.map((boosterId: string) => ({
        boosterId,
        priceDp: 100,
        enabled: true,
        requiresProgress: [],
      })),
      singles: true,
    });
    const banned = new Set(
      chapter
        .prepare("SELECT card_code FROM chapter_card_limits WHERE deck_limit=0")
        .all()
        .map((r) => Number(r.card_code)),
    );
    const allowedCardCodes = library
      .prepare("SELECT code FROM cards ORDER BY code")
      .all()
      .map((r) => Number(r.code))
      .filter((code) => !banned.has(code));
    outputs.set("chapters/chapter-01.json", {
      shopId: "chapter-01",
      allowedCardCodes,
    });
  } finally {
    library.close();
    chapter.close();
  }
  for (const [file, value] of outputs)
    if (file.startsWith("sets/") && !validCanonicalSet(value))
      throw new Error("SOURCE_SET_INVALID");
  // A new destination prevents accidentally replacing hand-authored changes.
  await mkdir(destination, { recursive: false });
  for (const [relative, value] of outputs) {
    const file = path.join(destination, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, {
      flag: "wx",
    });
  }
}
