import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import { AtomicPackageRuntime } from "../../../src/storage/runtime/atomic-package-runtime.ts";
import {
  createImportablePackageFixture,
  createUserDataFixture,
} from "./sqlite-fixtures.ts";
import {
  breakLibraryClosure,
  activeFileKey,
  crossPackageDefects,
  breakCrossPackageReference,
  packageOpenFailures,
  validationFailureSql,
  injectValidationFailure,
  createRuntimeFixture,
  fixtureFile,
} from "./runtime-fixtures.ts";

function createHarness() {
  const fixture = createRuntimeFixture();
  const runtime = new AtomicPackageRuntime({
    registry: fixture.registry,
    files: fixture.files,
    now: () => "2026-09-24T12:00:00.000Z",
    randomId: () => crypto.randomUUID(),
  });
  return { ...fixture, runtime };
}

function stackFiles(): File[] {
  return (["duel-core", "card-library", "freeplay", "chapter-01"] as const).map(
    (id) => {
      const fixture = createImportablePackageFixture(id);
      fixture.database.close();
      return fixtureFile(fixture.file);
    },
  );
}

async function install(runtime: AtomicPackageRuntime): Promise<void> {
  const result = await runtime.importPackages(
    stackFiles(),
    0,
    new AbortController().signal,
    () => {},
  );
  expect(result.kind).toBe("ok");
}

describe("package lifecycle", () => {
  it.each(packageOpenFailures)(
    "installed validation preserves $label native SELECT/iteration failures",
    async ({ error, code }) => {
      for (const sql of validationFailureSql) {
        const fixture = createHarness();
        await install(fixture.runtime);
        const before = readFileSync(fixture.registryFixture.file);
        const hits = injectValidationFailure(fixture.files, sql, error);
        expect(
          await fixture.runtime.verifyInstalled(new AbortController().signal),
        ).toEqual({
          kind: "failed",
          error: {
            code,
            packageId:
              sql === "PRAGMA trusted_schema=OFF"
                ? "card-library"
                : "duel-core",
          },
        });
        expect(hits()).toBe(1);
        expect(readFileSync(fixture.registryFixture.file)).toEqual(before);
      }
    },
  );

  it.each(crossPackageDefects)(
    "installed verification rejects $label cross-reference without writes",
    async (defect) => {
      const fixture = createHarness();
      await install(fixture.runtime);
      breakCrossPackageReference(fixture, defect);
      const user = createUserDataFixture();
      const userBefore = readFileSync(user.file);
      const registryBefore = readFileSync(fixture.registryFixture.file);
      const run = vi.spyOn(fixture.registry, "run");
      const exec = vi.spyOn(fixture.registry, "exec");
      const unlink = vi.spyOn(fixture.files, "unlink");
      await expect(
        fixture.runtime.verifyInstalled(new AbortController().signal),
      ).resolves.toEqual({
        kind: "failed",
        error: {
          code: "PACKAGE_INTEGRITY_FAILED",
          packageId: defect.packageId,
        },
      });
      expect(run).not.toHaveBeenCalled();
      expect(exec).not.toHaveBeenCalled();
      expect(unlink).not.toHaveBeenCalled();
      expect(readFileSync(fixture.registryFixture.file)).toEqual(
        registryBefore,
      );
      expect(readFileSync(user.file)).toEqual(userBefore);
      user.database.close();
    },
  );

  it.each(packageOpenFailures)(
    "installed cross-reference verification preserves $label native failures",
    async ({ error, code }) => {
      for (const packageId of [
        "card-library",
        "freeplay",
        "chapter-01",
      ] as const) {
        for (const phase of ["open", "query"] as const) {
          const fixture = createHarness();
          await install(fixture.runtime);
          const key = activeFileKey(fixture, packageId);
          const open = fixture.files.openDatabase.bind(fixture.files);
          let opens = 0;
          let hits = 0;
          vi.spyOn(fixture.files, "openDatabase").mockImplementation(
            (fileKey) => {
              const target = fileKey === key && ++opens === 2;
              if (target && phase === "open") {
                hits += 1;
                throw error;
              }
              const database = open(fileKey);
              if (!target) return database;
              return {
                ...database,
                all() {
                  hits += 1;
                  throw error;
                },
              };
            },
          );
          const before = readFileSync(fixture.registryFixture.file);
          await expect(
            fixture.runtime.verifyInstalled(new AbortController().signal),
          ).resolves.toEqual({
            kind: "failed",
            error: { code, packageId },
          });
          expect(hits).toBe(1);
          expect(readFileSync(fixture.registryFixture.file)).toEqual(before);
        }
      }
    },
  );

  it("installed verification succeeds read-only and honors cancellation at the cross-reference boundary", async () => {
    const fixture = createHarness();
    await install(fixture.runtime);
    const before = readFileSync(fixture.registryFixture.file);
    const run = vi.spyOn(fixture.registry, "run");
    const exec = vi.spyOn(fixture.registry, "exec");
    expect(
      await fixture.runtime.verifyInstalled(new AbortController().signal),
    ).toEqual(await fixture.runtime.current());
    const controller = new AbortController();
    const key = activeFileKey(fixture, "chapter-01");
    const open = fixture.files.openDatabase.bind(fixture.files);
    let opens = 0;
    vi.spyOn(fixture.files, "openDatabase").mockImplementation((fileKey) => {
      const database = open(fileKey);
      if (fileKey !== key || ++opens !== 2) return database;
      return {
        ...database,
        close() {
          database.close();
          controller.abort();
        },
      };
    });
    await expect(
      fixture.runtime.verifyInstalled(controller.signal),
    ).resolves.toEqual({
      kind: "failed",
      error: { code: "OPERATION_CANCELLED" },
    });
    expect(run).not.toHaveBeenCalled();
    expect(exec).not.toHaveBeenCalled();
    expect(readFileSync(fixture.registryFixture.file)).toEqual(before);
  });

  it("rejects base update incompatible with retained dependants without changing generation", async () => {
    const { runtime } = createHarness();
    await install(runtime);
    const replacement = createImportablePackageFixture("duel-core");
    replacement.database
      .prepare("UPDATE package_manifest SET version='2.0.0'")
      .run();
    replacement.database.exec("VACUUM");
    replacement.database.close();

    const result = await runtime.importPackages(
      [fixtureFile(replacement.file)],
      1,
      new AbortController().signal,
      () => {},
    );

    expect(result).toMatchObject({
      kind: "failed",
      error: {
        code: "PACKAGE_DEPENDENCY_INCOMPATIBLE",
        packageId: "duel-core",
        requiredBy: "card-library",
      },
    });
    expect(await runtime.current()).toMatchObject({
      kind: "ok",
      value: { generation: 1 },
    });
  });

  it("returns every transitive dependant when removal is blocked", async () => {
    const { runtime } = createHarness();
    await install(runtime);
    expect(await runtime.removePackage("duel-core", 1)).toEqual({
      kind: "failed",
      error: {
        code: "PACKAGE_REFERENCED",
        packageId: "duel-core",
        dependants: ["card-library", "chapter-01", "freeplay"],
      },
    });
  });

  it("rejects mutations during session then allows them after idempotent release", async () => {
    const { runtime } = createHarness();
    await install(runtime);
    const lease = await runtime.acquireSession();
    expect(lease.kind).toBe("ok");
    expect(await runtime.removePackage("chapter-01", 1)).toMatchObject({
      kind: "failed",
      error: { code: "APP_SESSION_ACTIVE" },
    });
    if (lease.kind === "ok") {
      await lease.value.release();
      await lease.value.release();
    }
    expect(await runtime.removePackage("chapter-01", 1)).toMatchObject({
      kind: "ok",
      value: { stack: { generation: 2 }, cleanupPending: false },
    });
  });

  it("keeps logical uninstall successful when postcommit byte deletion fails", async () => {
    const { runtime, files } = createHarness();
    await install(runtime);
    files.failDelete = true;
    const result = await runtime.removePackage("chapter-01", 1);
    expect(result).toMatchObject({
      kind: "ok",
      value: { stack: { generation: 2 }, cleanupPending: true },
    });
    expect(await runtime.current()).toMatchObject({
      kind: "ok",
      value: {
        generation: 2,
        packages: expect.not.arrayContaining([
          expect.objectContaining({ packageId: "chapter-01" }),
        ]),
      },
    });
  });

  it("startup reconciliation removes interrupted imports but protects active partial-key mappings", async () => {
    const { runtime, files } = createHarness();
    await install(runtime);
    const stack = await runtime.current();
    expect(stack.kind).toBe("ok");
    const activeKeys =
      stack.kind === "ok"
        ? stack.value.packages.map((item) => item.fileKey)
        : [];
    const orphan = "/imports/interrupted/0.partial";
    writeFileSync(
      path.join(files.root, encodeURIComponent(orphan)),
      new Uint8Array([1]),
    );

    expect(await runtime.reconcileInterruptedImports()).toEqual({
      kind: "ok",
      value: { removedFiles: 1 },
    });
    expect(activeKeys.every((key) => files.has(key))).toBe(true);
  });

  it("cleanup removes only inactive files and protects active partial-key mappings", async () => {
    const { runtime, files } = createHarness();
    await install(runtime);
    const stack = await runtime.current();
    expect(stack.kind).toBe("ok");
    const activeKeys =
      stack.kind === "ok"
        ? stack.value.packages.map((item) => item.fileKey)
        : [];
    const orphan = "/imports/orphan/0.partial";
    writeFileSync(
      path.join(files.root, encodeURIComponent(orphan)),
      new Uint8Array([1]),
    );

    const result = await runtime.cleanupUnused();

    expect(result).toEqual({
      kind: "ok",
      value: { removedFiles: 1, remainingFiles: 0 },
    });
    expect(activeKeys.every((key) => files.has(key))).toBe(true);
  });
  it.each(["reconcileInterruptedImports", "cleanupUnused"] as const)(
    "%s protects every registry key even when an active database is corrupt",
    async (method) => {
      const { runtime, files, registryFixture } = createHarness();
      await install(runtime);
      const keys = registryFixture.database
        .prepare("SELECT file_key FROM installed_packages")
        .all() as { file_key: string }[];
      const activePath = path.join(
        files.root,
        encodeURIComponent(keys[0]!.file_key),
      );
      writeFileSync(activePath, new Uint8Array([1, 2, 3]));
      const before = new Map(
        keys.map(({ file_key }) => [
          file_key,
          readFileSync(path.join(files.root, encodeURIComponent(file_key))),
        ]),
      );
      const registryBefore = readFileSync(registryFixture.file);
      const orphan = "/imports/interrupted/0.partial";
      writeFileSync(
        path.join(files.root, encodeURIComponent(orphan)),
        "orphan",
      );
      expect(await runtime.current()).toMatchObject({ kind: "failed" });
      expect(await runtime[method]()).toMatchObject({
        kind: "ok",
        value: { removedFiles: 1 },
      });
      for (const [key, bytes] of before) {
        expect(files.has(key)).toBe(true);
        expect(
          readFileSync(path.join(files.root, encodeURIComponent(key))),
        ).toEqual(bytes);
      }
      expect(readFileSync(registryFixture.file)).toEqual(registryBefore);
      expect(files.has(orphan)).toBe(false);
    },
  );

  it.each(["reconcileInterruptedImports", "cleanupUnused"] as const)(
    "%s fails closed on registry key query/schema failure without any unlink",
    async (method) => {
      const { runtime, files, registryFixture } = createHarness();
      await install(runtime);
      writeFileSync(
        path.join(files.root, encodeURIComponent("/imports/orphan/0.partial")),
        "orphan",
      );
      registryFixture.database.exec(
        "ALTER TABLE installed_packages RENAME COLUMN file_key TO broken_key",
      );
      const before = files.list();
      const unlink = vi.spyOn(files, "unlink");
      await expect(runtime[method]()).resolves.toEqual({
        kind: "failed",
        error: { code: "STORAGE_UNAVAILABLE" },
      });
      expect(unlink).not.toHaveBeenCalled();
      expect(files.list()).toEqual(before);
    },
  );

  it("cleanup remainingFiles counts only failed inactive deletions", async () => {
    const { runtime, files } = createHarness();
    await install(runtime);
    writeFileSync(
      path.join(files.root, encodeURIComponent("/imports/orphan/0.partial")),
      "orphan",
    );
    files.failDelete = true;
    expect(await runtime.cleanupUnused()).toEqual({
      kind: "ok",
      value: { removedFiles: 0, remainingFiles: 1 },
    });
  });

  it.each(["alias", "locale", "text"] as const)(
    "installed verification rejects broken %s closure without mutation",
    async (defect) => {
      const { runtime, files, registryFixture } = createHarness();
      await install(runtime);
      const row = registryFixture.database
        .prepare(
          "SELECT file_key FROM installed_packages WHERE package_id='card-library'",
        )
        .get() as { file_key: string };
      const database = new DatabaseSync(
        path.join(files.root, encodeURIComponent(row.file_key)),
      );
      breakLibraryClosure(database, defect);
      database.close();
      const before = readFileSync(registryFixture.file);
      expect(
        await runtime.verifyInstalled(new AbortController().signal),
      ).toMatchObject({
        kind: "failed",
        error: { code: "PACKAGE_INTEGRITY_FAILED", packageId: "card-library" },
      });
      expect(readFileSync(registryFixture.file)).toEqual(before);
    },
  );

  it.each(packageOpenFailures)(
    "installed verification resolves $label open failure on either open",
    async ({ error, code }) => {
      for (const failingOpen of [1, 2]) {
        const { runtime, files, registryFixture } = createHarness();
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
        const before = readFileSync(registryFixture.file);
        const open = files.openDatabase.bind(files);
        let opens = 0;
        vi.spyOn(files, "openDatabase").mockImplementation((key) => {
          if (++opens === failingOpen) throw error;
          return open(key);
        });
        await expect(
          runtime.verifyInstalled(new AbortController().signal),
        ).resolves.toEqual({
          kind: "failed",
          error: { code, packageId: "duel-core" },
        });
        expect(readFileSync(registryFixture.file)).toEqual(before);
      }
    },
  );
});
