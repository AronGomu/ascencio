import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { canonicalJson } from "./lib/json-content/compile-snapshot.ts";
import { compileSource } from "./lib/json-content/compile-source.ts";
import { createSnapshotCatalog } from "../src/storage/snapshot/snapshot-catalog.ts";
import { queryContent } from "../src/storage/runtime/content-query-runtime.ts";
import type { CriticalSnapshot } from "../src/storage/contracts/critical-snapshot.ts";
import type {
  ContentQuery,
  PackageStack,
} from "../src/storage/contracts/storage-client.ts";
import type {
  RuntimeFileStore,
  RuntimeDatabase,
} from "../src/storage/runtime/runtime-ports.ts";
import type { SqliteValue } from "../src/storage/schema/package-database.ts";
import type { ChapterConfig } from "../src/storage/contracts/package-payloads.ts";

const sourceRoot = path.resolve(
  process.argv[2] ?? "generated/readable-content-v1",
);
const legacyRoot = path.resolve(
  process.argv[3] ?? "src-tauri/resources/game-content",
);
const ids = ["duel-core", "card-library", "freeplay", "chapter-01"] as const;
try {
  const snapshots: CriticalSnapshot[] = [];
  const packages: PackageStack["packages"][number][] = [];
  for (const id of ids) {
    const root = path.join(sourceRoot, id);
    const before = await readFile(path.join(root, "critical.json"), "utf8");
    const compiled = await compileSource(root, root);
    if (before !== compiled.source)
      throw new Error(`NONDETERMINISTIC_SNAPSHOT: ${id}`);
    snapshots.push(compiled.snapshot);
    packages.push({
      ...compiled.snapshot.manifest,
      bytes: compiled.bytes,
      sha256: compiled.sha256,
      fileKey: id,
    });
  }
  const stack: PackageStack = { generation: 1, packages };
  const files = {
    openDatabase(key: string) {
      const db = new DatabaseSync(path.join(legacyRoot, `${key}.sqlite`), {
        readOnly: true,
      });
      return {
        all(sql: string, parameters: readonly SqliteValue[] = []) {
          return db.prepare(sql).all(...parameters);
        },
        close() {
          db.close();
        },
      } as unknown as RuntimeDatabase;
    },
  } as RuntimeFileStore;
  const resident = createSnapshotCatalog(
    snapshots,
    async () => null,
    new Map(),
  );
  const signal = new AbortController().signal;
  let comparisons = 0;
  async function check(request: ContentQuery) {
    const old = queryContent(request, stack, signal, files, () => {});
    const current = await resident.query(request, signal);
    if (canonicalJson(old) !== canonicalJson(current))
      throw new Error(`PARITY_MISMATCH: ${JSON.stringify(request)}`);
    comparisons++;
    return current;
  }
  for (const snapshot of snapshots) {
    const packageId = snapshot.manifest.packageId;
    await check({ kind: "config", packageId });
    if (snapshot.manifest.packageType === "card-library") {
      for (const locale of new Set(
        snapshot.cards.flatMap((c) => c.texts.map((t) => t.locale)),
      )) {
        let afterCode = 0;
        while (true) {
          const page = await check({
            kind: "cards",
            locale,
            afterCode,
            limit: 500,
          });
          if (
            page.kind !== "ok" ||
            !Array.isArray(page.value) ||
            page.value.length < 500
          )
            break;
          afterCode = (page.value.at(-1) as { code: number }).code;
        }
        const names = snapshot.cards.flatMap((c) =>
          c.texts.filter((t) => t.locale === locale).map((t) => t.name),
        );
        for (const prefix of [
          ...new Set([
            "",
            "%",
            "_",
            "\\",
            "Blue",
            "Ａ",
            ...names.filter((_, i) => i % 101 === 0).map((n) => n.slice(0, 4)),
          ]),
        ])
          await check({ kind: "card-search", locale, prefix, limit: 100 });
      }
      let afterName = "";
      while (true) {
        const page = await check({ kind: "scripts", afterName, limit: 500 });
        if (
          page.kind !== "ok" ||
          !Array.isArray(page.value) ||
          page.value.length < 500
        )
          break;
        afterName = (page.value.at(-1) as { name: string }).name;
      }
      await check({ kind: "sets", packageId: "card-library" });
    }
    if (
      snapshot.manifest.packageType === "freeplay" ||
      snapshot.manifest.packageType === "chapter"
    ) {
      await check({ kind: "decks", packageId });
      await check({ kind: "opponents", packageId });
      await check({ kind: "limits", packageId });
      if (snapshot.manifest.packageType === "chapter")
        await check({
          kind: "story",
          packageId,
          contentId:
            (snapshot.config as ChapterConfig).storyContentId ?? "missing",
        });
    }
  }
  console.log(
    `Parity passed: ${comparisons} queries; ${snapshots.reduce((n, p) => n + p.cards.length, 0)} cards; ${snapshots.reduce((n, p) => n + p.scripts.length, 0)} scripts. Repeat compilation produced identical bytes.`,
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
