// @vitest-environment node
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { exportPackages } from "../../../scripts/lib/sqlite-content/index.ts";
import { loadCommerceSource } from "../../../scripts/lib/sqlite-content/commerce-source.ts";
import { AtomicPackageRuntime } from "../../../src/storage/runtime/atomic-package-runtime.ts";
import { createModuleCatalogQueries } from "../../../src/storage/modules/catalog-queries.ts";
import {
  createRuntimeFixture,
  fixtureFile,
} from "../storage/runtime-fixtures.ts";
import { commerceFixture } from "../../fixtures/commerce.ts";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const action of cleanup.splice(0)) await action();
});
async function setup() {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/commerce-export-"));
  cleanup.push(() => rm(root, { recursive: true }));
  await cp("tests/fixtures/sqlite", path.join(root, "tests/fixtures/sqlite"), {
    recursive: true,
  });
  const json = async (file: string, value: unknown) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), JSON.stringify(value));
  };
  const spec = JSON.parse(
    await readFile(
      path.join(root, "tests/fixtures/sqlite/packages.json"),
      "utf8",
    ),
  );
  const base = commerceFixture();
  base.boosters[0]!.setId = "fixture-set";
  const set = JSON.parse(
    await readFile(
      path.join(root, "tests/fixtures/sqlite/sources/card-library/sets.json"),
      "utf8",
    ),
  )[0];
  const rows = JSON.parse(
    await readFile(
      path.join(
        root,
        "tests/fixtures/sqlite/sources/card-library/set-cards.json",
      ),
      "utf8",
    ),
  );
  await json("canonical/sets/fixture-set.json", {
    ...set,
    cards: rows.map((value: Record<string, unknown>) => {
      const row = { ...value };
      delete row.setId;
      return row;
    }),
  });
  for (const kind of ["economies", "boosters", "shops"] as const)
    for (const entity of base[kind])
      await json(`canonical/${kind}/${entity.id}.json`, entity);
  await json("canonical/source.json", {
    schemaVersion: 1,
    baseVersion: "1.0.0",
    sets: ["canonical/sets"],
    economies: ["canonical/economies"],
    boosters: ["canonical/boosters"],
    shops: ["canonical/shops"],
    mods: [],
  });
  Object.assign(spec.packages[1], {
    sourceManifest: "canonical/source.json",
    sourceVersion: "1.0.0",
  });
  const addon = "tests/fixtures/sqlite/sources/card-pack-shop";
  await json(`${addon}/config.json`, {
    defaultLocale: "en",
    locales: ["en"],
    revisions: { babelCdb: "fixture", cardScripts: "fixture" },
    requiredScripts: { cards: [], globals: [] },
  });
  for (const name of ["cards", "card-texts", "assets"])
    await json(`${addon}/${name}.json`, []);
  await mkdir(path.join(root, addon, "scripts"));
  await json("addon/shops/extra-shop.json", {
    ...base.shops[0],
    id: "extra-shop",
  });
  await json("addon/source.json", {
    schemaVersion: 1,
    baseVersion: "1.0.0",
    sets: [],
    economies: [],
    boosters: [],
    shops: ["addon/shops"],
    mods: [],
  });
  spec.packages.push({
    manifest: {
      ...spec.packages[1].manifest,
      packageId: "card-pack-shop",
      dependencies: [
        { packageId: "card-library", requirement: "minimum", version: "1.0.0" },
      ],
    },
    sourceRoot: addon,
    sourceManifest: "addon/source.json",
    sourceVersion: "1.0.0",
  });
  return { root, json, spec };
}
it("exports canonical base and dependency-referencing addon, installs and composes their shops", async () => {
  const { root, spec } = await setup();
  const result = await exportPackages(root, spec);
  expect(result.kind).toBe("ok");
  if (result.kind !== "ok") throw new Error(JSON.stringify(result));
  const fixture = createRuntimeFixture();
  const runtime = new AtomicPackageRuntime({
    registry: fixture.registry,
    files: fixture.files,
    now: () => new Date().toISOString(),
    randomId: () => crypto.randomUUID(),
  });
  cleanup.push(async () => {
    fixture.registry.close();
    await rm(fixture.registryFixture.file);
    await rm(fixture.files.root, { recursive: true });
  });
  const signal = new AbortController().signal;
  expect(
    (
      await runtime.importPackages(
        result.value.map((receipt) =>
          fixtureFile(path.join(root, receipt.path)),
        ),
        0,
        signal,
        () => {},
      )
    ).kind,
  ).toBe("ok");
  const catalog = createModuleCatalogQueries(
    { query: (request, abort) => runtime.query(request, abort) },
    () => runtime.current(),
  );
  const config = await catalog.query(
    { kind: "config", packageId: "card-library" },
    signal,
  );
  expect(config).toMatchObject({
    kind: "ok",
    value: { commerce: { shops: [{ id: "shop" }, { id: "extra-shop" }] } },
  });
});
it("reports entity path/pointer and rejects missing references before writing any candidate", async () => {
  const { root, json, spec } = await setup();
  await json("addon/shops/extra-shop.json", {
    ...commerceFixture().shops[0],
    id: "extra-shop",
    economyId: "unrelated-economy",
  });
  await expect(exportPackages(root, spec)).rejects.toMatchObject({
    code: "SOURCE_REFERENCE_MISSING",
    source: "addon/shops/extra-shop.json",
    pointer: "/economyId",
  });
  await expect(
    readFile(
      path.join(root, "generated/content-packages/card-library-1.0.0.sqlite"),
    ),
  ).rejects.toMatchObject({ code: "ENOENT" });
  await json("canonical/boosters/set-a.json", {
    ...commerceFixture().boosters[0],
    setId: "fixture-set",
    surprise: true,
  });
  await expect(
    loadCommerceSource(root, "canonical/source.json", "1.0.0"),
  ).rejects.toMatchObject({
    source: "canonical/boosters/set-a.json",
    pointer: "/surprise",
  });
  await expect(
    loadCommerceSource(root, "canonical/source.json", "2.0.0"),
  ).rejects.toMatchObject({ code: "SOURCE_MANIFEST_INVALID" });
});

it("normal export CLI preserves compiler source and pointer diagnostics", async () => {
  const { root, json, spec } = await setup();
  const relative = path.relative(process.cwd(), root);
  await json("bad/boosters/bad.json", {
    ...commerceFixture().boosters[0],
    id: "bad",
    unexpected: true,
  });
  await json("bad/source.json", {
    schemaVersion: 1,
    baseVersion: "1.0.0",
    sets: [],
    economies: [],
    boosters: [`${relative}/bad/boosters`],
    shops: [],
    mods: [],
  });
  spec.packages = spec.packages.slice(0, 2);
  spec.packages[1].sourceManifest = `${relative}/bad/source.json`;
  await json("cli-spec.json", spec);
  const result = await promisify(execFile)(process.execPath, [
    "scripts/export-content-packages.ts",
    "--spec",
    `${relative}/cli-spec.json`,
  ]).catch((error) => error);
  expect(result.code).toBe(2);
  expect(JSON.parse(result.stdout)).toMatchObject({
    kind: "failed",
    error: {
      code: "SOURCE_ENTITY_INVALID",
      source: `${relative}/bad/boosters/bad.json`,
      pointer: "/unexpected",
    },
  });
});
