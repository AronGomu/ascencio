import { readFileSync } from "node:fs";
import { AtomicPackageRuntime } from "../../../src/storage/runtime/atomic-package-runtime.ts";
import { createRuntimeFixture, fixtureFile } from "./runtime-fixtures.ts";
import { createImportablePackageFixture } from "./sqlite-fixtures.ts";
import { describe, expect, it, vi } from "vitest";
import {
  createManualContentController,
  type ManualBackupLifecycle,
  type ManualContentView,
} from "../../../src/shell/application/manual-content-controller.ts";
import type {
  ActivePackage,
  BackupPreview,
  ImportProgress,
  LocalStorageClient,
  MediaWarning,
  PackageId,
  PackageStack,
  StorageFailure,
  StorageResult,
} from "../../../src/storage/index.ts";

const manifest = (packageId: PackageId, version = "1.0.0"): ActivePackage => ({
  packageId,
  packageType:
    packageId === "duel-core" ||
    packageId === "card-library" ||
    packageId === "freeplay"
      ? packageId
      : "chapter",
  version,
  schemaVersion: 1,
  dependencies: [],
  createdAt: "2026-09-24T00:00:00.000Z",
  fileKey: `/imports/${packageId}`,
  bytes: 1024,
  sha256: "a".repeat(64),
});
const stack = (
  generation = 1,
  ids: readonly PackageId[] = [
    "duel-core",
    "card-library",
    "freeplay",
    "chapter-01",
  ],
): PackageStack => ({ generation, packages: ids.map((id) => manifest(id)) });
const ok = <T>(value: T): StorageResult<T> => ({ kind: "ok", value });
const failed = <T>(
  code: StorageFailure["code"],
  details: Omit<StorageFailure, "code"> = {},
): StorageResult<T> => ({ kind: "failed", error: { code, ...details } });
const preview: BackupPreview = {
  token: "one-use-token",
  currentRevision: 7,
  counts: {
    decks: 2,
    "deck-meta": 1,
    "deck-autosaves": 3,
    story: 4,
    preferences: 3,
    "story-read-log": 1,
  },
};

function fixture(
  options: {
    current?: StorageResult<PackageStack>;
    backups?: Partial<ManualBackupLifecycle>;
    sessionActive?: boolean;
  } = {},
) {
  let importResolve: ((value: StorageResult<PackageStack>) => void) | null =
    null;
  const inspectResolves: ((value: StorageResult<BackupPreview>) => void)[] = [];
  const warningListeners = new Set<(warning: MediaWarning) => void>();
  const packages = {
    current: vi.fn(async () => options.current ?? ok(stack())),
    importPackages: vi.fn(
      async (
        _files: readonly File[],
        _generation: number,
        _signal: AbortSignal,
        _progress: (event: ImportProgress) => void,
      ) => {
        void _files;
        void _generation;
        void _signal;
        void _progress;
        return await new Promise<StorageResult<PackageStack>>((resolve) => {
          importResolve = resolve;
        });
      },
    ),
    verifyInstalled: vi.fn(async () => ok(stack(2))),
    removePackage: vi.fn(async () =>
      ok({ stack: stack(2), cleanupPending: false }),
    ),
    cleanupUnused: vi.fn(async () =>
      ok({ removedFiles: 2, remainingFiles: 0 }),
    ),
    acquireSession: vi.fn(),
  };
  const client = {
    packages,
    content: { query: vi.fn() },
    userData: {},
    subscribeMediaWarnings(listener: (warning: MediaWarning) => void) {
      warningListeners.add(listener);
      return () => warningListeners.delete(listener);
    },
    close: vi.fn(),
  } as unknown as LocalStorageClient;
  const backups: ManualBackupLifecycle = {
    exportUserData: vi.fn(async () =>
      ok(
        new Blob(["backup"], {
          type: "application/vnd.sqlite3",
        }),
      ),
    ),
    inspectUserDataBackup: vi.fn(
      async () =>
        await new Promise<StorageResult<BackupPreview>>((resolve) => {
          inspectResolves.push(resolve);
        }),
    ),
    restoreUserData: vi.fn(async () => ({
      kind: "ok" as const,
      value: { revision: 8, hydrated: Symbol("hydrated") },
    })),
    refreshAfterRestore: vi.fn(async () =>
      ok({ revision: 8, hydrated: Symbol("hydrated") }),
    ),
    ...options.backups,
  };
  const restore = backups.restoreUserData;
  const refresh = backups.refreshAfterRestore;
  let rootRefresh: ((hydrated: unknown) => Promise<void>) | null = null;
  backups.restoreUserData = vi.fn<ManualBackupLifecycle["restoreUserData"]>(
    async (token, revision, root) => {
      rootRefresh = root;
      const result = await restore(token, revision, root);
      if (result.kind !== "ok") return result;
      try {
        await root(result.value.hydrated);
        return result;
      } catch {
        return {
          kind: "refresh-failed",
          error: { code: "STORAGE_UNAVAILABLE" },
        };
      }
    },
  );
  backups.refreshAfterRestore = vi.fn<
    ManualBackupLifecycle["refreshAfterRestore"]
  >(async () => {
    const result = await refresh();
    if (result.kind !== "ok") return result;
    try {
      await rootRefresh!(result.value.hydrated);
      return result;
    } catch {
      return failed("STORAGE_UNAVAILABLE");
    }
  });
  const restored = vi.fn(async () => undefined);
  const controller = createManualContentController({
    storage: client,
    backups,
    isSessionActive: () => options.sessionActive ?? false,
    onRestored: restored,
  });
  return {
    controller,
    client,
    packages,
    backups,
    restored,
    resolveImport(value: StorageResult<PackageStack>) {
      importResolve?.(value);
    },
    resolveInspect(value: StorageResult<BackupPreview>, index = 0) {
      inspectResolves[index]?.(value);
    },
    warn(warning: MediaWarning) {
      controller.updateMediaWarnings([warning]);
    },
  };
}

async function ready(
  f: ReturnType<typeof fixture>,
): Promise<ManualContentView> {
  await f.controller.refresh();
  expect(f.controller.view.state.kind).toBe("ready");
  return f.controller.view;
}

describe("manual content controller", () => {
  it("publishes byte progress and treats cancel-after-commit as success", async () => {
    const f = fixture();
    await ready(f);
    const importing = f.controller.importPackages([
      new File(["sqlite"], "freeplay.sqlite"),
    ]);
    const progress: ImportProgress = {
      operationId: "operation",
      phase: "copying",
      fileName: "freeplay.sqlite",
      copiedBytes: 3,
      totalBytes: 6,
    };
    f.packages.importPackages.mock.calls[0]![3](progress);
    expect(f.controller.view.state).toEqual({ kind: "importing", progress });
    f.controller.cancelImport();
    expect(f.packages.importPackages.mock.calls[0]![2].aborted).toBe(true);
    f.resolveImport(ok(stack(2)));
    await importing;
    expect(f.controller.view.state).toMatchObject({
      kind: "ready",
      stack: { generation: 2 },
    });
    expect(f.controller.view.message).toBe("Packages imported and activated.");
  });

  it("uses committed remove stack, exposes cleanup warning, then reports cleanup counts", async () => {
    const f = fixture();
    await ready(f);
    f.packages.removePackage.mockResolvedValueOnce(
      ok({
        stack: stack(2, ["duel-core", "card-library", "freeplay"]),
        cleanupPending: true,
      }),
    );
    f.controller.requestRemoval("chapter-01");
    await f.controller.removePackage(true);
    expect(f.controller.view.state).toMatchObject({
      kind: "ready",
      stack: { generation: 2 },
      cleanupPending: true,
    });
    expect(f.controller.view.message).toBe(
      "Package removed. Some unused files remain. Run cleanup.",
    );
    await f.controller.cleanupUnused();
    expect(f.controller.view.message).toBe(
      "Cleanup removed 2 files. 0 unused files remain.",
    );
  });

  it.each([
    ["APP_ALREADY_OPEN", "already-open"],
    ["SQLITE_UNAVAILABLE", "failed"],
    ["STORAGE_UNAVAILABLE", "failed"],
    ["STORAGE_QUOTA_EXCEEDED", "failed"],
  ] as const)("keeps typed %s distinct", async (code, kind) => {
    const f = fixture({ current: failed(code) });
    await f.controller.refresh();
    expect(f.controller.view.state.kind).toBe(kind);
    expect(f.controller.view.message).not.toMatch(/reset|delete/i);
  });

  it("names ordered dependency blockers, installed dependants, and active-session recovery", async () => {
    const f = fixture();
    await ready(f);
    f.packages.verifyInstalled.mockResolvedValueOnce(
      failed("PACKAGE_DEPENDENCY_MISSING", {
        packageId: "card-library",
        requiredBy: "freeplay",
      }),
    );
    await f.controller.verifyInstalled();
    expect(f.controller.view.message).toBe(
      "Install card-library before freeplay, then retry.",
    );
    await f.controller.refresh();
    f.packages.removePackage.mockResolvedValueOnce(
      failed("PACKAGE_REFERENCED", {
        packageId: "duel-core",
        dependants: ["freeplay", "card-library"],
      }),
    );
    f.controller.requestRemoval("duel-core");
    await f.controller.removePackage(true);
    expect(f.controller.view.message).toBe(
      "Remove installed dependants first: card-library, freeplay.",
    );

    const active = fixture({ sessionActive: true });
    await ready(active);
    await active.controller.cleanupUnused();
    expect(active.packages.cleanupUnused).not.toHaveBeenCalled();
    expect(active.controller.view.message).toBe(
      "Return to Main Menu before changing installed content or user data.",
    );
  });

  it("keeps media warnings across refresh", async () => {
    const f = fixture();
    await ready(f);
    f.warn({
      packageId: "card-library",
      path: "cards/full/1.jpg",
      reason: "corrupt",
    });
    await f.controller.refresh();
    expect(f.controller.view.state).toMatchObject({
      kind: "ready",
      mediaWarnings: [
        {
          packageId: "card-library",
          path: "cards/full/1.jpg",
          reason: "corrupt",
        },
      ],
    });
  });
});

describe("manual backup controller", () => {
  it("exports only after quiesced success", async () => {
    const f = fixture();
    await ready(f);
    const blob = await f.controller.exportUserData();
    expect(blob?.type).toBe("application/vnd.sqlite3");
    expect(f.controller.view.message).toBe(
      "Backup prepared. Starting browser download…",
    );

    const failedExport = fixture({
      backups: {
        exportUserData: vi.fn(async () => failed<Blob>("STORAGE_UNAVAILABLE")),
      },
    });
    await ready(failedExport);
    expect(await failedExport.controller.exportUserData()).toBeNull();
    expect(failedExport.controller.view.message).not.toContain("ready");
  });

  it("previews counts, cancellation writes nothing, confirmed restore uses exact token and revision", async () => {
    const f = fixture();
    await ready(f);
    const inspecting = f.controller.inspectUserDataBackup(
      new File(["backup"], "user-data.sqlite"),
    );
    f.resolveInspect(ok(preview));
    await inspecting;
    expect(f.controller.view.state).toEqual({
      kind: "restore-confirmation",
      preview,
    });
    f.controller.cancelRestore();
    expect(f.backups.restoreUserData).not.toHaveBeenCalled();
    expect(f.controller.view.state.kind).toBe("ready");

    const inspectingAgain = f.controller.inspectUserDataBackup(
      new File(["backup"], "user-data.sqlite"),
    );
    f.resolveInspect(ok(preview), 1);
    await inspectingAgain;
    await f.controller.confirmRestore();
    expect(f.backups.restoreUserData).toHaveBeenCalledWith(
      "one-use-token",
      7,
      expect.any(Function),
    );
    expect(f.restored).toHaveBeenCalledOnce();
    expect(f.controller.view.message).toBe("User data restored.");
  });

  it("supersedes stale inspection and cancellation cannot resurrect confirmation", async () => {
    const f = fixture();
    await ready(f);
    const first = f.controller.inspectUserDataBackup(
      new File(["one"], "one.sqlite"),
    );
    const second = f.controller.inspectUserDataBackup(
      new File(["two"], "two.sqlite"),
    );
    f.controller.cancelRestore();
    f.resolveInspect(ok(preview), 0);
    f.resolveInspect(ok({ ...preview, token: "second" }), 1);
    await Promise.all([first, second]);
    expect(f.controller.view.state.kind).toBe("ready");
    expect(f.backups.restoreUserData).not.toHaveBeenCalled();
  });

  it("shows stale restore conflict without success", async () => {
    const f = fixture({
      backups: {
        restoreUserData: vi.fn(async () => failed<never>("STORAGE_CONFLICT")),
      },
    });
    await ready(f);
    const inspecting = f.controller.inspectUserDataBackup(
      new File(["backup"], "user-data.sqlite"),
    );
    f.resolveInspect(ok(preview));
    await inspecting;
    await f.controller.confirmRestore();
    expect(f.controller.view.state.kind).toBe("failed");
    expect(f.controller.view.message).toBe(
      "Backup is stale because user data changed. Inspect it again before restoring.",
    );
  });

  it("retries hydration after committed restore without reusing one-use token", async () => {
    const hydrated = Symbol("hydrated");
    const restore = vi.fn(async () => ({
      kind: "refresh-failed" as const,
      error: { code: "STORAGE_UNAVAILABLE" as const },
    }));
    const refresh = vi
      .fn<ManualBackupLifecycle["refreshAfterRestore"]>()
      .mockResolvedValueOnce(ok({ revision: 8, hydrated }));
    const f = fixture({
      backups: { restoreUserData: restore, refreshAfterRestore: refresh },
    });
    await ready(f);
    const inspecting = f.controller.inspectUserDataBackup(
      new File(["backup"], "user-data.sqlite"),
    );
    f.resolveInspect(ok(preview));
    await inspecting;
    await f.controller.confirmRestore();
    expect(f.controller.view.refreshPending).toBe(true);
    await f.controller.retry();
    expect(restore).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
    expect(f.restored).toHaveBeenCalledWith(hydrated);
    expect(f.controller.view.message).toBe("User data restored.");
  });
});

describe("confirmed restore races", () => {
  it("cannot cancel, refresh, inspect, export or remount away a committed restore", async () => {
    const committed =
      Promise.withResolvers<
        Awaited<ReturnType<ManualBackupLifecycle["restoreUserData"]>>
      >();
    const f = fixture({
      backups: { restoreUserData: vi.fn(() => committed.promise) },
    });
    await ready(f);
    const inspect = f.controller.inspectUserDataBackup(
      new File(["backup"], "backup.sqlite"),
    );
    f.resolveInspect(ok(preview));
    await inspect;
    const restoring = f.controller.confirmRestore();
    const confirmedState = f.controller.view.state.kind;
    f.controller.cancelRestore();
    await f.controller.refresh();
    const lateInspect = f.controller.inspectUserDataBackup(
      new File(["other"], "other.sqlite"),
    );
    f.resolveInspect(ok({ ...preview, token: "late" }), 1);
    await lateInspect;
    const lateExport = await f.controller.exportUserData();
    const seen: ManualContentView[] = [];
    const unmount = f.controller.subscribe((view) => seen.push(view));
    unmount();
    const remount = f.controller.subscribe((view) => seen.push(view));
    await f.controller.refresh();
    committed.resolve(ok({ revision: 8, hydrated: "committed" }));
    await restoring;
    remount();
    expect(f.restored).toHaveBeenCalledOnce();
    expect(confirmedState).toBe("restoring");
    expect(lateExport).toBeNull();
    expect(f.controller.view.message).toBe("User data restored.");
    expect(seen.some((view) => /unchanged/.test(view.message))).toBe(false);
  });

  it("reports committed root refresh failure truthfully; only retry refresh can recover", async () => {
    const f = fixture();
    await ready(f);
    const inspect = f.controller.inspectUserDataBackup(
      new File(["backup"], "backup.sqlite"),
    );
    f.resolveInspect(ok(preview));
    await inspect;
    f.restored.mockRejectedValueOnce(new Error("ROOT_REFRESH_FAILED"));
    await f.controller.confirmRestore();
    expect(f.controller.view.message).toMatch(/committed.*Retry refresh/);
    expect(f.controller.view.message).not.toMatch(/untouched|unchanged/);
    f.controller.cancelRestore();
    await f.controller.importPackages([
      new File(["package"], "package.sqlite"),
    ]);
    expect(f.packages.importPackages).not.toHaveBeenCalled();
    await f.controller.retry();
    expect(f.backups.restoreUserData).toHaveBeenCalledOnce();
    expect(f.controller.view.message).toBe("User data restored.");
  });
});

describe("removal consent identity", () => {
  it("captures immutable v1 consent and never silently removes externally updated v2", async () => {
    const f = fixture();
    await ready(f);
    f.controller.requestRemoval("chapter-01");
    const consent = f.controller.view.removal;
    expect(consent).toEqual({
      packageId: "chapter-01",
      version: "1.0.0",
      generation: 1,
      sha256: "a".repeat(64),
    });
    expect(Object.isFrozen(consent)).toBe(true);
    await f.controller.importPackages([new File(["v2"], "chapter.sqlite")]);
    await f.controller.cleanupUnused();
    await f.controller.inspectUserDataBackup(
      new File(["backup"], "backup.sqlite"),
    );
    expect(f.packages.importPackages).not.toHaveBeenCalled();
    expect(f.packages.cleanupUnused).not.toHaveBeenCalled();
    expect(f.backups.inspectUserDataBackup).not.toHaveBeenCalled();
    // External update is guarded by backend CAS, not by refreshing consent.
    f.packages.removePackage.mockResolvedValueOnce(failed("STORAGE_CONFLICT"));
    await f.controller.removePackage(true);
    expect(f.packages.removePackage).toHaveBeenCalledWith("chapter-01", 1);
    expect(f.controller.view.state.kind).toBe("failed");
    expect(f.controller.view.message).not.toContain("Package removed");
  });

  it("refresh closes stale removal dialog rather than rebinding its generation", async () => {
    const f = fixture();
    await ready(f);
    f.controller.requestRemoval("chapter-01");
    f.packages.current.mockResolvedValueOnce(
      ok({ generation: 2, packages: [manifest("chapter-01", "2.0.0")] }),
    );
    await f.controller.refresh();
    expect(f.controller.view.removal).toBeNull();
    await f.controller.removePackage(true);
    expect(f.packages.removePackage).not.toHaveBeenCalled();
    expect(f.controller.view.message).toBe(
      "Installed packages changed. Review removal again.",
    );
  });
});

it("dispose waits for confirmed commit and root refresh, cannot turn late result into cancellation", async () => {
  const commit =
    Promise.withResolvers<
      Awaited<ReturnType<ManualBackupLifecycle["restoreUserData"]>>
    >();
  const f = fixture({
    backups: { restoreUserData: vi.fn(() => commit.promise) },
  });
  await ready(f);
  const inspect = f.controller.inspectUserDataBackup(
    new File(["backup"], "backup.sqlite"),
  );
  f.resolveInspect(ok(preview));
  await inspect;
  const restoring = f.controller.confirmRestore();
  let disposed = false;
  const disposing = f.controller.dispose().then(() => {
    disposed = true;
  });
  await Promise.resolve();
  expect(disposed).toBe(false);
  await f.controller.refresh();
  f.controller.cancelRestore();
  commit.resolve(ok({ revision: 8, hydrated: "restored" }));
  await Promise.all([restoring, disposing]);
  expect(f.restored).toHaveBeenCalledOnce();
  expect(f.controller.view.message).toBe("User data restored.");
});

it("real package registry CAS rejects v1 consent after external v2 activation, preserving v2 bytes", async () => {
  const disk = createRuntimeFixture();
  const packages = new AtomicPackageRuntime({
    registry: disk.registry,
    files: disk.files,
    now: () => "2026-09-24T12:00:00.000Z",
    randomId: () => crypto.randomUUID(),
  });
  const v1 = createImportablePackageFixture("duel-core");
  v1.database.close();
  expect(
    (
      await packages.importPackages(
        [fixtureFile(v1.file)],
        0,
        new AbortController().signal,
        () => {},
      )
    ).kind,
  ).toBe("ok");
  const f = fixture();
  const controller = createManualContentController({
    storage: { ...f.client, packages },
    backups: f.backups,
    isSessionActive: () => false,
    onRestored: async () => undefined,
  });
  await controller.refresh();
  controller.requestRemoval("duel-core");
  expect(controller.view.removal).toMatchObject({
    version: "1.0.0",
    generation: 1,
  });
  const v2 = createImportablePackageFixture("duel-core");
  v2.database.prepare("UPDATE package_manifest SET version='2.0.0'").run();
  v2.database.close();
  expect(
    (
      await packages.importPackages(
        [fixtureFile(v2.file)],
        1,
        new AbortController().signal,
        () => {},
      )
    ).kind,
  ).toBe("ok");
  const registryBefore = readFileSync(disk.registryFixture.file);
  const filesBefore = disk.files.list();
  await controller.removePackage(true);
  expect(controller.view.state).toEqual({
    kind: "failed",
    error: { code: "STORAGE_CONFLICT" },
  });
  expect(readFileSync(disk.registryFixture.file)).toEqual(registryBefore);
  expect(disk.files.list()).toEqual(filesBefore);
  expect(await packages.current()).toMatchObject({
    kind: "ok",
    value: {
      generation: 2,
      packages: [{ packageId: "duel-core", version: "2.0.0" }],
    },
  });
  await controller.dispose();
  await packages.close();
});

it("synchronous restoring subscriber teardown awaits the newly confirmed operation", async () => {
  const commit =
    Promise.withResolvers<
      Awaited<ReturnType<ManualBackupLifecycle["restoreUserData"]>>
    >();
  const f = fixture({
    backups: { restoreUserData: vi.fn(() => commit.promise) },
  });
  await ready(f);
  const inspect = f.controller.inspectUserDataBackup(
    new File(["backup"], "backup.sqlite"),
  );
  f.resolveInspect(ok(preview));
  await inspect;
  let disposed = false;
  let disposal: Promise<void> | null = null;
  f.controller.subscribe((view) => {
    if (view.state.kind === "restoring")
      disposal = f.controller.dispose().then(() => {
        disposed = true;
      });
  });
  const restoring = f.controller.confirmRestore();
  await Promise.resolve();
  await Promise.resolve();
  const premature = disposed;
  commit.resolve(ok({ revision: 8, hydrated: "restored" }));
  await restoring;
  await disposal;
  expect(premature).toBe(false);
  expect(f.restored).toHaveBeenCalledOnce();
  expect(f.controller.view.message).toBe("User data restored.");
});
