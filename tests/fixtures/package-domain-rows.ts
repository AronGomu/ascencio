import { projectChapterStories } from "../../scripts/lib/sqlite-content/chapter-story-source.ts";
import { readFileSync } from "node:fs";
import { PROTOTYPE_RULESET } from "../../src/decks/catalog/pinned-ruleset.ts";
import type { PackageId } from "../../src/storage/index.ts";
import { loadGlobalSets } from "../../scripts/lib/sqlite-content/global-set-source.ts";
import { normalizedMedia } from "../../scripts/lib/sqlite-content/normalized-package-source.ts";
import type { loadChapterOneContentSource } from "../../scripts/lib/chapter-content-source.ts";
import type { NodePackageDatabase } from "./node-package-database.ts";

/** Pin existing domain scenarios to chapter decks, not current shipping presets. */
export async function seedDomainRows(
  fixtures: ReadonlyMap<PackageId, NodePackageDatabase>,
  codes: readonly number[],
  chapter: Awaited<ReturnType<typeof loadChapterOneContentSource>>,
) {
  const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
  const root = "assets/content/card-library";
  const media = await normalizedMedia(root, "card-library", codes);
  const global = await loadGlobalSets(root, codes, media);
  const library = fixtures.get("card-library")!.database;
  library.exec("BEGIN; DELETE FROM sets;");
  const set = library.prepare("INSERT INTO sets VALUES (?, ?)");
  const member = library.prepare(
    "INSERT INTO set_cards VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const row of global.sets) set.run(row.id, JSON.stringify(row));
  for (const row of global.setCards)
    member.run(
      row.setId,
      row.cardCode,
      row.printingCode,
      row.rarity,
      row.sourceRarity,
      row.sourceRarityCode,
    );
  library.exec("COMMIT");
  const config = json("assets/content/chapter-01/config.json");
  const decks = json("assets/content/chapter-01/decks.json") as {
    id: string;
    name: string;
    cards: unknown;
  }[];
  const opponents = json("assets/content/chapter-01/opponents.json") as {
    id: string;
    name: string;
    line: string;
    deckId: string;
    policyId: string;
  }[];
  const allowed = new Set(chapter.normalized.cardCodes);
  for (const id of ["freeplay", "chapter-01"] as const) {
    const db = fixtures.get(id)!.database;
    const limits =
      id === "freeplay" ? "freeplay_card_limits" : "chapter_card_limits";
    db.exec(
      `BEGIN; DELETE FROM opponents; DELETE FROM decks; DELETE FROM ${limits};`,
    );
    db.prepare("UPDATE package_meta SET value_json=? WHERE key='config'").run(
      JSON.stringify(
        id === "freeplay"
          ? {
              title: "Domain fixture",
              defaults: config.defaults,
              rulesetId: PROTOTYPE_RULESET.id,
            }
          : config,
      ),
    );
    const deck = db.prepare("INSERT INTO decks VALUES (?, ?, ?)");
    for (const row of decks)
      deck.run(row.id, row.name, JSON.stringify(row.cards));
    const opponent = db.prepare("INSERT INTO opponents VALUES (?, ?, ?, ?, ?)");
    for (const row of opponents)
      opponent.run(row.id, row.name, row.line, row.deckId, row.policyId);
    const limit = db.prepare(`INSERT INTO ${limits} VALUES (?, ?)`);
    for (const code of codes) {
      const quantity =
        id === "chapter-01" && !allowed.has(code)
          ? 0
          : (PROTOTYPE_RULESET.quantityByCode.get(code) ?? 3);
      if (quantity < 3) limit.run(code, quantity);
    }
    if (id === "chapter-01") {
      db.exec("DELETE FROM story_documents");
      const story = db.prepare("INSERT INTO story_documents VALUES (?, ?)");
      for (const document of projectChapterStories(
        json("assets/content/chapter-01/story-documents.json"),
        "chapter-01",
        config,
        await normalizedMedia("assets/content/chapter-01", "chapter-01"),
      ).stories)
        story.run(document.contentId, JSON.stringify(document));
    }
    db.exec("COMMIT");
  }
  return { media: [...media, ...global.assets], sets: global.sets };
}
