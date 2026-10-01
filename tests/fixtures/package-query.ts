import { createHash } from "node:crypto";
import {
  readFileSync,
  unlinkSync,
  rmdirSync,
  mkdtempSync,
  mkdirSync,
} from "node:fs";
import { loadNormalizedCatalog } from "../../scripts/lib/sqlite-content/normalized-package-source.ts";
import { loadChapterOneContentSource } from "../../scripts/lib/chapter-content-source.ts";
import { seedDomainRows } from "./package-domain-rows.ts";
import { queryContent } from "../../src/storage/runtime/content-query-runtime.ts";
import type {
  ActivePackage,
  CardLibraryConfig,
  ContentQueries,
  DuelCoreConfig,
  PackageId,
} from "../../src/storage/index.ts";
import {
  nodePackageDatabase,
  insertFixtureAsset as insertAsset,
  readOnlyPackageFiles,
  type NodePackageDatabase,
} from "./node-package-database.ts";

/** Test-owned normalized SQLite content. No package importer/exporter. */
export async function packageQueryFixture() {
  const normalized = await loadNormalizedCatalog(
    "assets/content/card-library",
    ["en"],
  );
  const chapter = await loadChapterOneContentSource(process.cwd());
  const json = (path: string): unknown =>
    JSON.parse(readFileSync(path, "utf8"));
  const core = json("content/duel-core/config.json") as DuelCoreConfig;
  const authoredLibrary = json(
    "assets/content/card-library/config.json",
  ) as CardLibraryConfig;
  const codes = new Set(normalized.cards.map(({ code }) => code));
  const library: CardLibraryConfig = {
    ...authoredLibrary,
    requiredScripts: {
      ...authoredLibrary.requiredScripts,
      cards: authoredLibrary.requiredScripts.cards.filter((name) =>
        codes.has(Number(/^c([1-9]\d*)\.lua$/.exec(name)?.[1])),
      ),
    },
  };
  mkdirSync(".tmp", { recursive: true });
  const root = mkdtempSync(".tmp/domain-queries-");
  const ids = ["duel-core", "card-library", "freeplay", "chapter-01"] as const;
  const fixtures = new Map<PackageId, NodePackageDatabase>();
  const files = readOnlyPackageFiles(fixtures);
  const close = () => {
    for (const fixture of fixtures.values()) {
      fixture.database.close();
      unlinkSync(fixture.file);
    }
    rmdirSync(root);
  };
  try {
    ids.forEach((id, index) =>
      fixtures.set(id, nodePackageDatabase(root, id, ids[index - 1] ?? null)),
    );
    const coreDb = fixtures.get("duel-core")!.database;
    coreDb
      .prepare("UPDATE package_meta SET value_json=? WHERE key='config'")
      .run(JSON.stringify(core));
    insertAsset(
      coreDb,
      core.wasmPath,
      "application/wasm",
      readFileSync("vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm"),
    );
    insertAsset(
      coreDb,
      core.vendorManifestPath,
      "application/json",
      readFileSync("vendor/ocgcore-wasm/0.1.2/vendor-manifest.json"),
    );
    const db = fixtures.get("card-library")!.database;
    db.exec(
      "BEGIN; DELETE FROM set_cards; DELETE FROM card_search; DELETE FROM card_texts; DELETE FROM cards; DELETE FROM scripts;",
    );
    db.prepare("UPDATE package_meta SET value_json=? WHERE key='config'").run(
      JSON.stringify(library),
    );
    const card = db.prepare("INSERT INTO cards VALUES (?, ?)");
    const text = db.prepare("INSERT INTO card_texts VALUES (?, ?, ?, ?, ?)");
    const script = db.prepare("INSERT INTO scripts VALUES (?, ?, ?)");
    for (const row of normalized.cards) card.run(row.code, JSON.stringify(row));
    for (const row of normalized.texts)
      text.run(
        row.cardCode,
        row.locale,
        row.name,
        row.description,
        JSON.stringify(row.strings),
      );
    for (const row of normalized.scripts)
      script.run(row.name, row.source, row.sha256);
    db.exec("COMMIT");
    const domain = await seedDomainRows(
      fixtures,
      normalized.cards.map(({ code }) => code),
      chapter,
    );
    const packages: ActivePackage[] = [...fixtures.values()].map((fixture) => {
      const bytes = readFileSync(fixture.file);
      return {
        ...fixture.manifest,
        fileKey: fixture.manifest.packageId,
        bytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    });
    const content: ContentQueries = {
      async query(request, signal) {
        return queryContent(
          request,
          { generation: 1, packages },
          signal,
          files,
          () => {
            // Missing optional media is a supported domain input.
          },
        );
      },
    };
    return {
      content,
      packages,
      core,
      library,
      chapter,
      codes,
      domain,
      root,
      close,
    };
  } catch (error) {
    close();
    throw error;
  }
}
