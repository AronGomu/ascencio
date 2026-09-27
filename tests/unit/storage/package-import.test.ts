import path from "node:path";
import {
  validateRuntimePackage,
  ENGINE_BLOB_CAP,
  MEDIA_BLOB_CAP,
} from "../../../src/storage/runtime/package-validation.ts";
import { readFileSync, writeFileSync } from "node:fs";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { describe, expect, it, vi } from "vitest";
import { AtomicPackageRuntime } from "../../../src/storage/runtime/atomic-package-runtime.ts";
import {
  createImportablePackageFixture,
  createPackageFixture,
  createUserDataFixture,
  insertAsset,
} from "./sqlite-fixtures.ts";
import {
  breakLibraryClosure,
  packageOpenFailures,
  validationFailureSql,
  injectValidationFailure,
  trackAssetReads,
  databaseAdapter,
  createRuntimeFixture,
  fixtureFile,
} from "./runtime-fixtures.ts";

function runtimeWith(
  fault?: (point: string) => void,
  estimate?: (bytes: number) => Promise<boolean>,
) {
  const fixture = createRuntimeFixture();
  const runtime = new AtomicPackageRuntime({
    registry: fixture.registry,
    files: fixture.files,
    now: () => "2026-09-24T12:00:00.000Z",
    randomId: () => "operation-fixed",
    fault,
    estimate,
  });
  return { ...fixture, runtime };
}

function filesForStack(multiChunk = false): readonly File[] {
  return (["chapter-01", "freeplay", "card-library", "duel-core"] as const).map(
    (id, index) => {
      const fixture = createImportablePackageFixture(id);
      if (multiChunk && id === "card-library") {
        insertAsset(
          fixture.database,
          "cards/full/1.jpg",
          "image/jpeg",
          new Uint8Array(1024 * 1024 + 1),
        );
        fixture.database.exec("VACUUM");
      }
      fixture.database.close();
      return fixtureFile(fixture.file, `../../attacker-${index}.sqlite`);
    },
  );
}

describe("atomic package import", () => {
  it.each(packageOpenFailures)(
    "import validation preserves $label native SELECT/iteration failures",
    async ({ error, code }) => {
      for (const sql of validationFailureSql) {
        const fixture = runtimeWith();
        const core = createImportablePackageFixture("duel-core");
        core.database.close();
        const before = readFileSync(fixture.registryFixture.file);
        const hits = injectValidationFailure(fixture.files, sql, error);
        expect(
          await fixture.runtime.importPackages(
            [fixtureFile(core.file)],
            0,
            new AbortController().signal,
            () => {},
          ),
        ).toMatchObject({
          kind: "failed",
          error: { code },
        });
        expect(hits()).toBe(1);
        expect(readFileSync(fixture.registryFixture.file)).toEqual(before);
        expect(fixture.files.list()).toEqual([]);
      }
    },
  );

  it("streams reverse-order packages in bounded chunks then activates one generation", async () => {
    const { runtime, files } = runtimeWith();
    const progress: string[] = [];
    const result = await runtime.importPackages(
      filesForStack(true),
      0,
      new AbortController().signal,
      (event) => progress.push(event.phase),
    );

    expect(result).toMatchObject({
      kind: "ok",
      value: {
        generation: 1,
        packages: [
          { packageId: "duel-core" },
          { packageId: "card-library" },
          { packageId: "freeplay" },
          { packageId: "chapter-01" },
        ],
      },
    });
    expect(files.maxChunkBytes).toBeLessThanOrEqual(1024 * 1024);
    expect(
      progress.filter((phase) => phase === "copying").length,
    ).toBeGreaterThan(files.importedKeys.length * 2);
    expect(files.importedKeys).toEqual([
      "/imports/operation-fixed/0.partial",
      "/imports/operation-fixed/1.partial",
      "/imports/operation-fixed/2.partial",
      "/imports/operation-fixed/3.partial",
    ]);
    expect(files.importedKeys.some((key) => key.includes("attacker"))).toBe(
      false,
    );
    expect(progress).toContain("complete");
  });

  it("rolls back prior registry when a later selected database is malformed", async () => {
    const { runtime, registryFixture } = runtimeWith();
    const baseline = await runtime.importPackages(
      filesForStack().slice(2).reverse(),
      0,
      new AbortController().signal,
      () => {},
    );
    expect(baseline.kind).toBe("ok");
    const before = readFileSync(registryFixture.file);
    const validEarlier = createImportablePackageFixture("freeplay");
    validEarlier.database.close();
    const malformedLater = createPackageFixture("chapter-01");
    malformedLater.database.exec("CREATE TABLE hostile(value TEXT)");
    malformedLater.database.close();

    const result = await runtime.importPackages(
      [fixtureFile(validEarlier.file), fixtureFile(malformedLater.file)],
      1,
      new AbortController().signal,
      () => {},
    );

    expect(result).toMatchObject({
      kind: "failed",
      error: { code: "PACKAGE_INVALID" },
    });
    expect(await runtime.current()).toMatchObject({
      kind: "ok",
      value: {
        generation: 1,
        packages: [{ packageId: "duel-core" }, { packageId: "card-library" }],
      },
    });
    expect(readFileSync(registryFixture.file)).toEqual(before);
  });

  it("rejects cross-package deck references before activation", async () => {
    const { runtime } = runtimeWith();
    const core = createImportablePackageFixture("duel-core");
    core.database.close();
    const library = createImportablePackageFixture("card-library");
    library.database.close();
    const freeplay = createImportablePackageFixture("freeplay");
    freeplay.database
      .prepare("UPDATE decks SET cards_json=? WHERE id='starter'")
      .run(JSON.stringify({ main: [999], extra: [], side: [] }));
    freeplay.database.exec("VACUUM");
    freeplay.database.close();

    expect(
      await runtime.importPackages(
        [
          fixtureFile(freeplay.file),
          fixtureFile(library.file),
          fixtureFile(core.file),
        ],
        0,
        new AbortController().signal,
        () => {},
      ),
    ).toMatchObject({
      kind: "failed",
      error: { code: "PACKAGE_SOURCE_INCOMPLETE", packageId: "freeplay" },
    });
    expect(await runtime.current()).toMatchObject({
      kind: "ok",
      value: { generation: 0, packages: [] },
    });
  });

  it("treats identical release as no-op and rejects changed bytes at same identity", async () => {
    const { runtime } = runtimeWith();
    const original = createImportablePackageFixture("duel-core");
    original.database.close();
    expect(
      await runtime.importPackages(
        [fixtureFile(original.file)],
        0,
        new AbortController().signal,
        () => {},
      ),
    ).toMatchObject({ kind: "ok", value: { generation: 1 } });
    expect(
      await runtime.importPackages(
        [fixtureFile(original.file)],
        1,
        new AbortController().signal,
        () => {},
      ),
    ).toMatchObject({ kind: "ok", value: { generation: 1 } });

    const changed = createImportablePackageFixture("duel-core");
    const bytes = new Uint8Array([0, 97, 115, 109, 1]);
    changed.database
      .prepare(
        "UPDATE assets SET byte_length=?, sha256=?, data=? WHERE path='engine/ocgcore.sync.wasm'",
      )
      .run(bytes.byteLength, bytesToHex(sha256(bytes)), bytes);
    changed.database.exec("VACUUM");
    changed.database.close();
    expect(
      await runtime.importPackages(
        [fixtureFile(changed.file)],
        1,
        new AbortController().signal,
        () => {},
      ),
    ).toMatchObject({
      kind: "failed",
      error: { code: "PACKAGE_IDENTITY_CONFLICT", packageId: "duel-core" },
    });
  });

  it("maps known quota failure before copy and cancellation before commit", async () => {
    const quota = runtimeWith(undefined, async () => false);
    expect(
      await quota.runtime.importPackages(
        filesForStack(),
        0,
        new AbortController().signal,
        () => {},
      ),
    ).toMatchObject({
      kind: "failed",
      error: { code: "STORAGE_QUOTA_EXCEEDED" },
    });
    expect(quota.files.importedKeys).toEqual([]);

    const controller = new AbortController();
    const cancelled = runtimeWith((point) => {
      if (point === "before-commit") controller.abort();
    });
    expect(
      await cancelled.runtime.importPackages(
        filesForStack(),
        0,
        controller.signal,
        () => {},
      ),
    ).toMatchObject({
      kind: "failed",
      error: { code: "OPERATION_CANCELLED" },
    });
    expect(await cancelled.runtime.current()).toMatchObject({
      kind: "ok",
      value: { generation: 0, packages: [] },
    });
  });

  it("maps quota raised during staged copy and removes owned partial bytes", async () => {
    const { runtime, files } = runtimeWith();
    files.failQuotaDuringImport = true;
    expect(
      await runtime.importPackages(
        filesForStack(),
        0,
        new AbortController().signal,
        () => {},
      ),
    ).toMatchObject({
      kind: "failed",
      error: { code: "STORAGE_QUOTA_EXCEEDED" },
    });
    expect(files.list()).toEqual([]);
  });

  it.each(["before-copy", "after-validation", "before-commit"])(
    "keeps old registry at injected %s fault",
    async (cutpoint) => {
      const { runtime, files } = runtimeWith((point) => {
        if (point === cutpoint) throw new Error(`fault at ${point}`);
      });
      const result = await runtime.importPackages(
        filesForStack(),
        0,
        new AbortController().signal,
        () => {},
      );
      expect(result).toMatchObject({
        kind: "failed",
        error: { code: "STORAGE_UNAVAILABLE" },
      });
      expect(await runtime.current()).toMatchObject({
        kind: "ok",
        value: { generation: 0, packages: [] },
      });
      expect(files.list()).toEqual([]);
    },
  );

  it("reports committed success when abort/fault occurs after registry commit", async () => {
    const controller = new AbortController();
    const { runtime } = runtimeWith((point) => {
      if (point === "after-commit") {
        controller.abort();
        throw new Error("postcommit fault");
      }
    });
    const result = await runtime.importPackages(
      filesForStack(),
      0,
      controller.signal,
      () => {},
    );
    expect(result).toMatchObject({ kind: "ok", value: { generation: 1 } });
    expect(await runtime.current()).toMatchObject({
      kind: "ok",
      value: { generation: 1 },
    });
  });
  it.each(["alias", "locale", "text"] as const)(
    "rejects broken %s closure before commit preserving registry and user bytes",
    async (defect) => {
      const { runtime, registryFixture, files } = runtimeWith();
      const core = createImportablePackageFixture("duel-core");
      core.database.close();
      expect(
        (
          await runtime.importPackages(
            [fixtureFile(core.file)],
            0,
            new AbortController().signal,
            () => {},
          )
        ).kind,
      ).toBe("ok");
      const user = createUserDataFixture();
      user.database.close();
      const userPath = path.join(
        files.root,
        encodeURIComponent("/user-data.sqlite"),
      );
      writeFileSync(userPath, readFileSync(user.file));
      const userBefore = readFileSync(userPath);
      const registryBefore = readFileSync(registryFixture.file);
      const stackBefore = await runtime.current();
      const library = createImportablePackageFixture("card-library");
      breakLibraryClosure(library.database, defect);
      library.database.close();
      expect(
        await runtime.importPackages(
          [fixtureFile(library.file)],
          1,
          new AbortController().signal,
          () => {},
        ),
      ).toMatchObject({
        kind: "failed",
        error: { code: "PACKAGE_SOURCE_INCOMPLETE", packageId: "card-library" },
      });
      expect(await runtime.current()).toEqual(stackBefore);
      expect(readFileSync(registryFixture.file)).toEqual(registryBefore);
      expect(readFileSync(userPath)).toEqual(userBefore);
    },
  );

  it.each([
    ["duel-core", ENGINE_BLOB_CAP, "engine/ocgcore.sync.wasm"],
    ["card-library", MEDIA_BLOB_CAP, "cards/full/1.jpg"],
  ] as const)(
    "validates all %s asset lengths before any BLOB SELECT",
    (id, cap, assetPath) => {
      for (const discrepancy of [false, true]) {
        const fixture = createImportablePackageFixture(id);
        fixture.database.exec("PRAGMA ignore_check_constraints=ON");
        fixture.database
          .prepare(
            "INSERT OR REPLACE INTO assets VALUES (?, 'application/octet-stream', ?, ?, zeroblob(?))",
          )
          .run(assetPath, discrepancy ? 1 : cap + 1, "0".repeat(64), cap + 1);
        const dataReads: string[] = [];
        const database = trackAssetReads(
          databaseAdapter(fixture.database),
          dataReads,
        );
        expect(validateRuntimePackage(database)).toMatchObject({
          kind: "failed",
        });
        expect(dataReads).toEqual([]);
        database.close();
      }
    },
  );

  it.each(packageOpenFailures)(
    "staged import resolves $label open failure before commit",
    async ({ error, code }) => {
      const { runtime, files, registryFixture } = runtimeWith();
      const fixture = createImportablePackageFixture("duel-core");
      fixture.database.close();
      const before = readFileSync(registryFixture.file);
      vi.spyOn(files, "openDatabase").mockImplementation(() => {
        throw error;
      });
      await expect(
        runtime.importPackages(
          [fixtureFile(fixture.file)],
          0,
          new AbortController().signal,
          () => {},
        ),
      ).resolves.toEqual({ kind: "failed", error: { code } });
      expect(readFileSync(registryFixture.file)).toEqual(before);
      expect(files.list()).toEqual([]);
    },
  );

  it("failed import cleanup never unlinks when registry key read fails", async () => {
    const { runtime, files, registryFixture } = runtimeWith((point) => {
      if (point === "after-validation") {
        registryFixture.database.exec(
          "ALTER TABLE installed_packages RENAME COLUMN file_key TO broken_key",
        );
        throw new Error("injected registry failure");
      }
    });
    const fixture = createImportablePackageFixture("duel-core");
    fixture.database.close();
    const unlink = vi.spyOn(files, "unlink");
    await expect(
      runtime.importPackages(
        [fixtureFile(fixture.file)],
        0,
        new AbortController().signal,
        () => {},
      ),
    ).resolves.toMatchObject({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
    expect(unlink).not.toHaveBeenCalled();
    expect(files.list()).toEqual(files.importedKeys);
  });
});
