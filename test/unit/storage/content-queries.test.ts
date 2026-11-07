import {
  ENGINE_BLOB_CAP,
  MEDIA_BLOB_CAP,
} from "../../../src/storage/runtime/package-validation.ts";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AtomicPackageRuntime } from "../../../src/storage/runtime/atomic-package-runtime.ts";
import {
  createImportablePackageFixture,
  insertAsset,
} from "./sqlite-fixtures.ts";
import {
  trackAssetReads,
  activeFileKey,
  queryFailureCases,
  injectQueryFailure,
  packageOpenFailures,
  createRuntimeFixture,
  fixtureFile,
} from "./runtime-fixtures.ts";

function card(code: number) {
  return JSON.stringify({
    code,
    alias: 0,
    setcodes: [],
    type: 1,
    level: 1,
    attribute: 1,
    race: "1",
    attack: code,
    defense: code,
    lscale: 0,
    rscale: 0,
    linkMarker: 0,
    scope: 0,
  });
}

async function setupLibrary() {
  const fixture = createRuntimeFixture();
  const warnings: unknown[] = [];
  const runtime = new AtomicPackageRuntime({
    registry: fixture.registry,
    files: fixture.files,
    now: () => "2026-09-24T12:00:00.000Z",
    randomId: () => "query-import",
    mediaWarning: (warning) => warnings.push(warning),
  });
  const core = createImportablePackageFixture("duel-core");
  core.database.close();
  const library = createImportablePackageFixture("card-library");
  for (const code of [2, 3]) {
    library.database
      .prepare("INSERT INTO cards VALUES (?, ?)")
      .run(code, card(code));
    library.database
      .prepare("INSERT INTO card_texts VALUES (?, ?, ?, ?, ?)")
      .run(code, "en", `Fixture ${code}`, `Text ${code}`, "[]");
    library.database
      .prepare("INSERT INTO card_search VALUES (?, ?, ?)")
      .run("en", code, code === 2 ? "fixture % literal" : "fixture card");
  }
  insertAsset(
    library.database,
    "cards/full/1.jpg",
    "image/jpeg",
    new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  );
  library.database.exec("VACUUM");
  library.database.close();
  const result = await runtime.importPackages(
    [fixtureFile(library.file), fixtureFile(core.file)],
    0,
    new AbortController().signal,
    () => {},
  );
  expect(result.kind).toBe("ok");
  return { ...fixture, runtime, warnings };
}

describe("content queries", () => {
  describe.each(queryFailureCases)("$label native failures", (testCase) => {
    it.each(packageOpenFailures)(
      "classifies $label on open/query",
      async ({ error, code }) => {
        for (const phase of ["open", "query"] as const) {
          const fixture = await setupLibrary();
          const hits = injectQueryFailure(
            fixture.files,
            activeFileKey(fixture, testCase.packageId),
            phase,
            testCase.sql,
            error,
          );
          const result = await fixture.runtime.query(
            testCase.request,
            new AbortController().signal,
          );
          expect(hits()).toBe(1);
          if (phase === "query" && testCase.optional) {
            expect(result).toEqual({ kind: "ok", value: null });
            expect(fixture.warnings).toEqual([
              {
                packageId: testCase.packageId,
                path:
                  testCase.request.kind === "asset"
                    ? testCase.request.path
                    : "sets/fixture-set",
                reason: "unreadable",
              },
            ]);
          } else {
            expect(result).toMatchObject({
              kind: "failed",
              error: { code, packageId: testCase.packageId },
            });
            expect(fixture.warnings).toEqual([]);
          }
        }
      },
    );
  });

  it("returns stable bounded exclusive card and script pages", async () => {
    const { runtime } = await setupLibrary();
    const signal = new AbortController().signal;
    const first = await runtime.query(
      { kind: "cards", locale: "en", afterCode: 0, limit: 2 },
      signal,
    );
    expect(first).toMatchObject({
      kind: "ok",
      value: [{ code: 1 }, { code: 2 }],
    });
    const second = await runtime.query(
      { kind: "cards", locale: "en", afterCode: 2, limit: 2 },
      signal,
    );
    expect(second).toMatchObject({ kind: "ok", value: [{ code: 3 }] });
    const scripts = await runtime.query(
      { kind: "scripts", afterName: "", limit: 1 },
      signal,
    );
    expect(scripts).toMatchObject({
      kind: "ok",
      value: [{ name: "c1.lua" }],
    });
  });

  it("normalizes prefix search and escapes LIKE metacharacters", async () => {
    const { runtime } = await setupLibrary();
    expect(
      await runtime.query(
        { kind: "card-search", locale: "en", prefix: "FIXTURE %", limit: 10 },
        new AbortController().signal,
      ),
    ).toEqual({ kind: "ok", value: [2] });
    expect(
      await runtime.query(
        {
          kind: "card-search",
          locale: "en",
          prefix: "x".repeat(257),
          limit: 10,
        },
        new AbortController().signal,
      ),
    ).toMatchObject({ kind: "failed", error: { code: "RPC_INVALID" } });
  });

  it("returns optional missing asset as null plus one correlated warning", async () => {
    const { runtime, warnings } = await setupLibrary();
    const result = await runtime.query(
      { kind: "asset", packageId: "card-library", path: "cards/cropped/1.jpg" },
      new AbortController().signal,
    );
    expect(result).toEqual({ kind: "ok", value: null });
    expect(warnings).toEqual([
      {
        packageId: "card-library",
        path: "cards/cropped/1.jpg",
        reason: "missing",
      },
    ]);
  });

  it("returns corrupt optional asset as null with warning while full verify fails", async () => {
    const { runtime, files, warnings } = await setupLibrary();
    const stack = await runtime.current();
    const library =
      stack.kind === "ok"
        ? stack.value.packages.find((item) => item.packageId === "card-library")
        : undefined;
    expect(library).toBeDefined();
    const database = new DatabaseSync(
      path.join(files.root, encodeURIComponent(library!.fileKey)),
    );
    database
      .prepare("UPDATE assets SET data=? WHERE path='cards/full/1.jpg'")
      .run(new Uint8Array([0, 0, 0, 0]));
    database.close();

    expect(
      await runtime.query(
        { kind: "asset", packageId: "card-library", path: "cards/full/1.jpg" },
        new AbortController().signal,
      ),
    ).toEqual({ kind: "ok", value: null });
    expect(warnings.at(-1)).toEqual({
      packageId: "card-library",
      path: "cards/full/1.jpg",
      reason: "corrupt",
    });
    expect(await runtime.current()).toMatchObject({
      kind: "ok",
      value: { generation: 1 },
    });
    expect(
      await runtime.verifyInstalled(new AbortController().signal),
    ).toMatchObject({
      kind: "failed",
      error: { code: "PACKAGE_INTEGRITY_FAILED", packageId: "card-library" },
    });
  });
  it.each([
    ["duel-core", ENGINE_BLOB_CAP, "engine/ocgcore.sync.wasm"],
    ["card-library", MEDIA_BLOB_CAP, "cards/full/1.jpg"],
  ] as const)(
    "first asset read rejects oversized %s metadata before BLOB SELECT",
    async (packageId, cap, assetPath) => {
      for (const discrepancy of [false, true]) {
        const { runtime, files, registryFixture, warnings } =
          await setupLibrary();
        const row = registryFixture.database
          .prepare("SELECT file_key FROM installed_packages WHERE package_id=?")
          .get(packageId) as { file_key: string };
        const database = new DatabaseSync(
          path.join(files.root, encodeURIComponent(row.file_key)),
        );
        database.exec("PRAGMA ignore_check_constraints=ON");
        database
          .prepare(
            "UPDATE assets SET byte_length=?, data=zeroblob(?) WHERE path=?",
          )
          .run(discrepancy ? 1 : cap + 1, cap + 1, assetPath);
        database.close();
        const dataReads: string[] = [];
        const open = files.openDatabase.bind(files);
        vi.spyOn(files, "openDatabase").mockImplementation((key) =>
          trackAssetReads(open(key), dataReads),
        );
        const result = await runtime.query(
          { kind: "asset", packageId, path: assetPath },
          new AbortController().signal,
        );
        expect(dataReads).toEqual([]);
        if (packageId === "duel-core")
          expect(result).toMatchObject({
            kind: "failed",
            error: {
              code: "PACKAGE_INTEGRITY_FAILED",
              packageId,
              path: assetPath,
            },
          });
        else {
          expect(result).toEqual({ kind: "ok", value: null });
          expect(warnings).toEqual([
            { packageId, path: assetPath, reason: "corrupt" },
          ]);
        }
      }
    },
  );
});
