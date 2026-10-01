// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { AtomicPackageRuntime } from "../../../src/storage/runtime/atomic-package-runtime.ts";
import { createModuleCatalogQueries } from "../../../src/storage/modules/catalog-queries.ts";
import {
  createImportablePackageFixture,
  insertAsset,
} from "./sqlite-fixtures.ts";
import { createRuntimeFixture, fixtureFile } from "./runtime-fixtures.ts";
import type {
  PackageId,
  StorageResult,
} from "../../../src/storage/contracts/package.ts";
import type { PackageStack } from "../../../src/storage/contracts/storage-client.ts";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { writePackageArchive } from "../../../scripts/lib/sqlite-content/package-archive.ts";
import type { ExportReceipt } from "../../../src/storage/contracts/package-build.ts";

const signal = new AbortController().signal;
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0)) close();
});
function value<T>(result: StorageResult<T>): T {
  expect(result.kind).toBe("ok");
  if (result.kind !== "ok") throw new Error(JSON.stringify(result.error));
  return result.value;
}
function packageFile(id: PackageId): File {
  const f = createImportablePackageFixture(id);
  f.database.close();
  cleanup.push(() => rmSync(f.file));
  return fixtureFile(f.file);
}
function addon(conflict = false): File {
  const f = createImportablePackageFixture("card-library");
  f.database.exec(
    "PRAGMA foreign_keys=OFF; DELETE FROM set_cards; DELETE FROM sets;",
  );
  f.database
    .prepare("UPDATE package_manifest SET package_id=?, dependencies_json=?")
    .run(
      "card-pack-extra",
      JSON.stringify([
        { packageId: "card-library", requirement: "minimum", version: "1.0.0" },
      ]),
    );
  if (conflict)
    f.database.exec("UPDATE card_texts SET name='Conflicting identity'");
  else {
    f.database.exec(
      "UPDATE cards SET code=999, definition_json=json_set(definition_json,'$.code',999); UPDATE card_texts SET card_code=999,name='Extra Card'; UPDATE card_search SET card_code=999, normalized_name='extra card'; UPDATE scripts SET name='c999.lua' WHERE name='c1.lua'; UPDATE package_meta SET value_json=json_set(value_json,'$.requiredScripts.cards',json('[\"c999.lua\"]'));",
    );
    insertAsset(
      f.database,
      "cards/full/999.jpg",
      "image/jpeg",
      new Uint8Array([4, 5, 6]),
    );
  }
  f.database.close();
  cleanup.push(() => rmSync(f.file));
  return fixtureFile(f.file);
}
function chapter(useAddon: boolean, declareAddon: boolean): File {
  const f = createImportablePackageFixture("chapter-01");
  const deps = [
    { packageId: "card-library", requirement: "minimum", version: "1.0.0" },
    ...(declareAddon
      ? [
          {
            packageId: "card-pack-extra",
            requirement: "minimum",
            version: "1.0.0",
          },
        ]
      : []),
  ];
  f.database
    .prepare(
      "UPDATE package_manifest SET package_id='chapter-02',dependencies_json=?",
    )
    .run(JSON.stringify(deps));
  f.database.exec(
    "UPDATE package_meta SET value_json=json_set(value_json,'$.chapterNumber',2)",
  );
  if (useAddon)
    f.database.exec(
      "UPDATE decks SET cards_json=json_set(cards_json,'$.main',json('[999]'))",
    );
  f.database.close();
  cleanup.push(() => rmSync(f.file));
  return fixtureFile(f.file);
}
function setup() {
  const f = createRuntimeFixture();
  const runtime = new AtomicPackageRuntime({
    registry: f.registry,
    files: f.files,
    now: () => new Date().toISOString(),
    randomId: () => crypto.randomUUID(),
  });
  cleanup.push(() => {
    f.registry.close();
    rmSync(f.registryFixture.file);
    rmSync(f.files.root, { recursive: true });
  });
  const catalog = createModuleCatalogQueries(
    { query: (request, abort) => runtime.query(request, abort) },
    () => runtime.current(),
  );
  const install = async (
    files: File[],
    generation = 0,
  ): Promise<PackageStack> =>
    value(await runtime.importPackages(files, generation, signal, () => {}));
  return { runtime, catalog, install };
}
describe("modular content lifecycle", () => {
  it("imports the default stack plus an add-on as raw files or a single five-module archive", async () => {
    const ids: PackageId[] = [
      "duel-core",
      "card-library",
      "freeplay",
      "chapter-01",
      "card-pack-extra",
    ];
    const files = [...ids.slice(0, 4).map(packageFile), addon()];
    expect((await setup().install(files)).packages).toHaveLength(5);
    const root = path.resolve(
      ".tmp",
      `five-module-archive-${crypto.randomUUID()}`,
    );
    mkdirSync(root);
    cleanup.push(() => rmSync(root, { recursive: true }));
    const receipts: ExportReceipt[] = [];
    for (const [index, file] of files.entries()) {
      const name = `${ids[index]}.sqlite`;
      writeFileSync(
        path.join(root, name),
        new Uint8Array(await file.arrayBuffer()),
      );
      receipts.push({
        packageId: ids[index]!,
        version: "1.0.0",
        path: name,
        bytes: file.size,
        sha256: "a".repeat(64),
        missingOptionalMedia: [],
        excludedSetMemberships: [],
        inventoryOnlyScripts: [],
        rarityWarnings: [],
      });
    }
    const archive = await writePackageArchive(root, receipts);
    expect(
      (
        await setup().install([
          fixtureFile(path.join(root, archive.path), "modules.zip"),
        ])
      ).packages,
    ).toHaveLength(5);
  });
  it("installs a later chapter without installing previous chapters", async () => {
    const f = setup();
    const stack = await f.install([
      chapter(false, false),
      packageFile("card-library"),
      packageFile("duel-core"),
    ]);
    expect(stack.packages.map((p) => p.packageId)).toEqual([
      "duel-core",
      "card-library",
      "chapter-02",
    ]);
    expect(
      value(await f.runtime.removePackage("chapter-02", stack.generation)).stack
        .packages,
    ).toHaveLength(2);
  });
  it("merges card packs, finds their previews directly, and invalidates the catalog after removal", async () => {
    const f = setup();
    const stack = await f.install([
      packageFile("duel-core"),
      packageFile("card-library"),
      addon(),
    ]);
    const preview = value(
      await f.catalog.query(
        {
          kind: "asset",
          packageId: "card-library",
          path: "cards/full/999.jpg",
        },
        signal,
      ),
    );
    expect(preview?.bytes).toEqual(new Uint8Array([4, 5, 6]));
    expect(
      value(
        await f.catalog.query(
          { kind: "cards", locale: "en", afterCode: 0, limit: 10 },
          signal,
        ),
      ).map((c) => c.code),
    ).toEqual([1, 999]);
    expect(
      value(
        await f.catalog.query(
          { kind: "card-search", locale: "en", prefix: "Extra", limit: 10 },
          signal,
        ),
      ),
    ).toEqual([999]);
    expect(
      value(
        await f.catalog.query(
          { kind: "scripts", afterName: "", limit: 10 },
          signal,
        ),
      ).map((s) => s.name),
    ).toEqual(["c1.lua", "c999.lua", "utility.lua"]);
    value(await f.runtime.removePackage("card-pack-extra", stack.generation));
    expect(
      value(
        await f.catalog.query(
          { kind: "cards", locale: "en", afterCode: 0, limit: 10 },
          signal,
        ),
      ).map((c) => c.code),
    ).toEqual([1]);
  });
  it("rejects a conflicting card identity before changing the active generation", async () => {
    const f = setup();
    const before = await f.install([
      packageFile("duel-core"),
      packageFile("card-library"),
    ]);
    expect(
      await f.runtime.importPackages(
        [addon(true)],
        before.generation,
        signal,
        () => {},
      ),
    ).toMatchObject({
      kind: "failed",
      error: { code: "PACKAGE_IDENTITY_CONFLICT" },
    });
    expect(value(await f.runtime.current())).toEqual(before);
  });
  it("requires declared dependencies for cross-module card references and protects referenced modules", async () => {
    const f = setup();
    const before = await f.install([
      packageFile("duel-core"),
      packageFile("card-library"),
      addon(),
    ]);
    expect(
      await f.runtime.importPackages(
        [chapter(true, false)],
        before.generation,
        signal,
        () => {},
      ),
    ).toMatchObject({
      kind: "failed",
      error: { code: "PACKAGE_SOURCE_INCOMPLETE" },
    });
    const installed = await f.install([chapter(true, true)], before.generation);
    expect(
      await f.runtime.removePackage("card-pack-extra", installed.generation),
    ).toMatchObject({ kind: "failed", error: { code: "PACKAGE_REFERENCED" } });
    expect(value(await f.runtime.current())).toEqual(installed);
  });
});
