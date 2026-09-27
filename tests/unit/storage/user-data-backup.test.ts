import {
  allUserMutations,
  logicalUserSnapshot,
} from "./user-data-test-records.ts";
import { createHash } from "node:crypto";
import { AtomicPackageRuntime } from "../../../src/storage/runtime/atomic-package-runtime.ts";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_SHELL_SETTINGS } from "../../../src/shell/settings/shell-settings.ts";
import {
  USER_DATA_MAX_PAYLOAD_BYTES,
  USER_DATA_SCHEMA_SQL,
} from "../../../src/storage/schema/index.ts";
import { UserDataRuntime } from "../../../src/storage/runtime/user-data-runtime.ts";
import type {
  RuntimeDatabase,
  RuntimeFileStore,
} from "../../../src/storage/runtime/runtime-ports.ts";
import { FIXTURE_ROOT, createUserDataFixture } from "./sqlite-fixtures.ts";
import {
  createRuntimeFixture,
  completeStackFiles,
  createNodeFileStore,
  databaseAdapter,
  fixtureFile,
} from "./runtime-fixtures.ts";

const shellMutation = () => ({
  kind: "put" as const,
  namespace: "preferences" as const,
  key: "shell",
  expectedRevision: null,
  payload: DEFAULT_SHELL_SETTINGS,
});
const logMutation = () => ({
  kind: "put" as const,
  namespace: "story-read-log" as const,
  key: "read",
  expectedRevision: null,
  payload: { version: 1, beats: ["beat-old", "beat-new"] },
});

function createRuntime(
  options: {
    readonly fault?: (point: string) => void;
    readonly files?: RuntimeFileStore;
    readonly database?: RuntimeDatabase;
  } = {},
) {
  const user = createUserDataFixture();
  const files = options.files ?? createNodeFileStore();
  return {
    user,
    files,
    runtime: new UserDataRuntime({
      database: options.database ?? databaseAdapter(user.database),
      files,
      randomId: () => crypto.randomUUID(),
      ...(options.fault ? { fault: options.fault } : {}),
    }),
  };
}

async function sqliteFile(
  blob: Blob,
  name = "user-data.sqlite",
): Promise<File> {
  return new File([await blob.arrayBuffer()], name, {
    type: "application/vnd.sqlite3",
  });
}

async function rows(blob: Blob) {
  mkdirSync(FIXTURE_ROOT, { recursive: true });
  const file = path.join(FIXTURE_ROOT, `backup-${crypto.randomUUID()}.sqlite`);
  writeFileSync(file, new Uint8Array(await blob.arrayBuffer()));
  const database = new DatabaseSync(file, { readOnly: true });
  const result = database
    .prepare(
      "SELECT namespace, record_key, revision, payload_json FROM user_records ORDER BY namespace, record_key",
    )
    .all();
  const tables = database
    .prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name")
    .all();
  database.close();
  return { result, tables, file };
}

describe("user-data SQLite backup", () => {
  it("exports real standalone SQLite and restores exact payload bytes and row revisions", async () => {
    const source = createRuntime();
    expect((await source.runtime.writeUser(allUserMutations())).kind).toBe(
      "ok",
    );
    const updates = allUserMutations().map((mutation) => {
      if (mutation.kind !== "put") throw new Error("fixture requires put");
      const payload = structuredClone(mutation.payload) as Record<
        string,
        unknown
      >;
      if (mutation.namespace === "decks")
        (payload.deck as { revision: number }).revision = 2;
      if (mutation.namespace === "story") payload.revision = 2;
      return { ...mutation, payload, expectedRevision: 1 };
    });
    expect((await source.runtime.writeUser(updates)).kind).toBe("ok");
    const beforeExport = logicalUserSnapshot(source.user.database);
    const beforeMeta = source.user.database
      .prepare("SELECT revision FROM user_data_meta")
      .get();
    const exported = await source.runtime.exportUserData();
    expect(exported.kind).toBe("ok");
    if (exported.kind === "failed") return;
    expect(exported.value.type).toBe("application/vnd.sqlite3");
    expect((exported.value as File).name).toBe("user-data.sqlite");
    const reopened = await rows(exported.value);
    expect(reopened.tables).toEqual([
      { name: "user_data_meta" },
      { name: "user_records" },
    ]);
    expect(reopened.result).toHaveLength(9);
    expect(beforeMeta).toEqual({ revision: 2 });
    expect(logicalUserSnapshot(source.user.database)).toEqual(beforeExport);
    expect(
      source.user.database.prepare("SELECT revision FROM user_data_meta").get(),
    ).toEqual(beforeMeta);

    const target = createRuntime();
    const preview = await target.runtime.inspectUserDataBackup(
      await sqliteFile(exported.value),
    );
    expect(preview).toEqual({
      kind: "ok",
      value: {
        token: expect.any(String),
        currentRevision: 0,
        counts: {
          decks: 1,
          "deck-meta": 2,
          "deck-autosaves": 1,
          story: 1,
          preferences: 3,
          "story-read-log": 1,
        },
      },
    });
    if (preview.kind === "failed") return;
    expect(
      await target.runtime.restoreUserData(
        preview.value.token,
        preview.value.currentRevision,
        true,
      ),
    ).toEqual({ kind: "ok", value: { revision: 1 } });
    expect(
      target.user.database
        .prepare(
          "SELECT namespace, record_key, revision, payload_json FROM user_records ORDER BY namespace, record_key",
        )
        .all(),
    ).toEqual(reopened.result);
    expect(logicalUserSnapshot(target.user.database)).toEqual({
      ...beforeExport,
      meta: beforeExport.meta.map((row) => ({ ...row, revision: 1 })),
    });
    expect(
      await target.runtime.restoreUserData(preview.value.token, 0, true),
    ).toEqual({ kind: "failed", error: { code: "STORAGE_CONFLICT" } });
  });

  it("rejects malformed, hostile-schema, unknown namespace, and oversized row backups", async () => {
    const target = createRuntime();
    expect(
      await target.runtime.inspectUserDataBackup(
        new File([new Uint8Array(512)], "bad.sqlite"),
      ),
    ).toEqual({ kind: "failed", error: { code: "USER_DATA_INVALID" } });
    expect(
      await target.runtime.inspectUserDataBackup({
        size: 256 * 1024 * 1024 + 1,
      } as File),
    ).toEqual({ kind: "failed", error: { code: "USER_DATA_TOO_LARGE" } });

    const hostile = createUserDataFixture();
    hostile.database.exec("CREATE TABLE stolen_registry(secret TEXT)");
    hostile.database.close();
    expect(
      await target.runtime.inspectUserDataBackup(fixtureFile(hostile.file)),
    ).toEqual({ kind: "failed", error: { code: "USER_DATA_INVALID" } });

    const unknown = createUserDataFixture();
    unknown.database
      .prepare("INSERT INTO user_records VALUES (?, ?, ?, ?)")
      .run("packages", "active", 1, "{}");
    unknown.database.close();
    expect(
      await target.runtime.inspectUserDataBackup(fixtureFile(unknown.file)),
    ).toEqual({ kind: "failed", error: { code: "USER_DATA_INVALID" } });

    const oversized = createUserDataFixture();
    oversized.database
      .prepare("INSERT INTO user_records VALUES (?, ?, ?, ?)")
      .run(
        "deck-meta",
        "lastOpened",
        1,
        JSON.stringify("x".repeat(USER_DATA_MAX_PAYLOAD_BYTES)),
      );
    oversized.database.close();
    expect(
      await target.runtime.inspectUserDataBackup(fixtureFile(oversized.file)),
    ).toEqual({ kind: "failed", error: { code: "USER_DATA_TOO_LARGE" } });
  });

  it("checks exact schema before integrity or record reads", async () => {
    const hostile = createUserDataFixture();
    hostile.database.exec("CREATE VIEW leaked AS SELECT * FROM user_records");
    hostile.database.close();
    const files = createNodeFileStore();
    const open = files.openDatabase.bind(files);
    const reads: string[] = [];
    files.openDatabase = (key) => {
      const database = open(key);
      return {
        ...database,
        all(sql, parameters) {
          reads.push(sql);
          return database.all(sql, parameters);
        },
        each(sql, parameters, callback) {
          reads.push(sql);
          database.each(sql, parameters, callback);
        },
      };
    };
    const target = createRuntime({ files });
    expect(
      await target.runtime.inspectUserDataBackup(fixtureFile(hostile.file)),
    ).toEqual({ kind: "failed", error: { code: "USER_DATA_INVALID" } });
    expect(reads).toEqual([
      "SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name",
    ]);
  });

  it.each(["restore-after-delete", "restore-before-meta"])(
    "preserves complete live data on false confirmation, stale token, and %s fault",
    async (faultPoint) => {
      let fault = false;
      const target = createRuntime({
        fault(point) {
          if (fault && point === faultPoint) throw new Error("fault");
        },
      });
      expect((await target.runtime.writeUser(allUserMutations())).kind).toBe(
        "ok",
      );
      const source = createRuntime();
      expect((await source.runtime.writeUser([logMutation()])).kind).toBe("ok");
      const exported = await source.runtime.exportUserData();
      if (exported.kind === "failed") throw new Error("export failed");

      const beforeCancelled = logicalUserSnapshot(target.user.database);
      const cancelled = await target.runtime.inspectUserDataBackup(
        await sqliteFile(exported.value),
      );
      if (cancelled.kind === "failed") throw new Error("inspect failed");
      expect(
        await target.runtime.restoreUserData(
          cancelled.value.token,
          cancelled.value.currentRevision,
          false as never,
        ),
      ).toEqual({
        kind: "failed",
        error: { code: "RESTORE_CONFIRMATION_REQUIRED" },
      });
      expect(
        await target.runtime.readUser("preferences", "shell"),
      ).toMatchObject({ kind: "ok", value: { revision: 1 } });

      expect(logicalUserSnapshot(target.user.database)).toEqual(
        beforeCancelled,
      );
      const stale = await target.runtime.inspectUserDataBackup(
        await sqliteFile(exported.value),
      );
      if (stale.kind === "failed") throw new Error("inspect failed");
      expect(
        (
          await target.runtime.writeUser([
            {
              ...shellMutation(),
              expectedRevision: 1,
              payload: {
                ...DEFAULT_SHELL_SETTINGS,
                rotationNoticeDismissed: true,
              },
            },
          ])
        ).kind,
      ).toBe("ok");
      const beforeStale = logicalUserSnapshot(target.user.database);
      expect(
        await target.runtime.restoreUserData(
          stale.value.token,
          stale.value.currentRevision,
          true,
        ),
      ).toEqual({ kind: "failed", error: { code: "STORAGE_CONFLICT" } });

      expect(logicalUserSnapshot(target.user.database)).toEqual(beforeStale);
      const failed = await target.runtime.inspectUserDataBackup(
        await sqliteFile(exported.value),
      );
      if (failed.kind === "failed") throw new Error("inspect failed");
      const beforeFault = logicalUserSnapshot(target.user.database);
      fault = true;
      expect(
        await target.runtime.restoreUserData(
          failed.value.token,
          failed.value.currentRevision,
          true,
        ),
      ).toEqual({ kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } });
      expect(
        await target.runtime.readUser("preferences", "shell"),
      ).toMatchObject({
        kind: "ok",
        value: {
          revision: 2,
          payload: { rotationNoticeDismissed: true },
        },
      });
      expect(logicalUserSnapshot(target.user.database)).toEqual(beforeFault);
    },
  );

  it("rolls back restore quota failure without mixed rows", async () => {
    const user = createUserDataFixture();
    const base = databaseAdapter(user.database);
    let failInsert = false;
    let inserts = 0;
    const database: RuntimeDatabase = {
      ...base,
      run(sql, parameters) {
        if (
          failInsert &&
          sql.startsWith("INSERT INTO user_records") &&
          ++inserts === 2
        )
          throw Object.assign(new Error("SQLITE_FULL"), { resultCode: 13 });
        return base.run(sql, parameters);
      },
    };
    const target = createRuntime({ database });
    expect((await target.runtime.writeUser(allUserMutations())).kind).toBe(
      "ok",
    );
    const source = createRuntime();
    expect(
      (
        await source.runtime.writeUser([
          {
            ...shellMutation(),
            payload: {
              ...DEFAULT_SHELL_SETTINGS,
              rotationNoticeDismissed: true,
            },
          },
          logMutation(),
        ])
      ).kind,
    ).toBe("ok");
    const exported = await source.runtime.exportUserData();
    if (exported.kind === "failed") throw new Error("export failed");
    const preview = await target.runtime.inspectUserDataBackup(
      await sqliteFile(exported.value),
    );
    if (preview.kind === "failed") throw new Error("inspect failed");
    const beforeQuota = logicalUserSnapshot(user.database);
    failInsert = true;
    expect(
      await target.runtime.restoreUserData(
        preview.value.token,
        preview.value.currentRevision,
        true,
      ),
    ).toEqual({
      kind: "failed",
      error: { code: "STORAGE_QUOTA_EXCEEDED" },
    });
    expect(await target.runtime.readUser("preferences", "shell")).toMatchObject(
      { kind: "ok", value: { revision: 1 } },
    );
    expect(logicalUserSnapshot(user.database)).toEqual(beforeQuota);
  });

  it("maps quota distinctly and cleans only owned staged backups on close", async () => {
    const source = createRuntime();
    expect((await source.runtime.writeUser([shellMutation()])).kind).toBe("ok");
    const exported = await source.runtime.exportUserData();
    if (exported.kind === "failed") throw new Error("export failed");
    const files = createNodeFileStore();
    files.failQuotaDuringImport = true;
    const target = createRuntime({ files });
    expect(
      await target.runtime.inspectUserDataBackup(
        await sqliteFile(exported.value),
      ),
    ).toEqual({
      kind: "failed",
      error: { code: "STORAGE_QUOTA_EXCEEDED" },
    });
    files.failQuotaDuringImport = false;
    const backupFile = await sqliteFile(exported.value);
    const preview = await target.runtime.inspectUserDataBackup(backupFile);
    expect(preview.kind).toBe("ok");
    const activeBytes = new Uint8Array(await backupFile.arrayBuffer());
    let sent = false;
    await files.importDatabase("/imports/active/0.partial", async () => {
      if (sent) return undefined;
      sent = true;
      return activeBytes;
    });
    expect(files.list().some((key) => key.startsWith("/user-backups/"))).toBe(
      true,
    );
    await target.runtime.close();
    expect(files.list().some((key) => key.startsWith("/user-backups/"))).toBe(
      false,
    );
    expect(files.has("/imports/active/0.partial")).toBe(true);
  });
});

it("reopens a hand-built schema-v1 file for test validity", () => {
  const file = path.join(FIXTURE_ROOT, `schema-${crypto.randomUUID()}.sqlite`);
  const database = new DatabaseSync(file);
  database.exec(USER_DATA_SCHEMA_SQL);
  database.close();
  expect(readFileSync(file).subarray(0, 16).toString()).toBe(
    "SQLite format 3\0",
  );
});

it("all user actions leave real shared-pool registry and content bytes unchanged", async () => {
  const fixture = createRuntimeFixture();
  const packages = new AtomicPackageRuntime({
    ...fixture,
    now: () => "2026-09-24T00:00:00.000Z",
    randomId: () => "user-isolation",
  });
  expect(
    (
      await packages.importPackages(
        completeStackFiles(),
        0,
        new AbortController().signal,
        () => {},
      )
    ).kind,
  ).toBe("ok");
  const contentKeys = [...fixture.files.list()];
  async function contentSnapshot() {
    return {
      registry: createHash("sha256")
        .update(fixture.registry.exportBytes())
        .digest("hex"),
      files: await Promise.all(
        contentKeys.map(async (key) => [
          key,
          createHash("sha256")
            .update(await fixture.files.exportDatabase(key))
            .digest("hex"),
        ]),
      ),
    };
  }
  const before = await contentSnapshot();
  const target = createRuntime({ files: fixture.files });
  expect((await target.runtime.writeUser(allUserMutations())).kind).toBe("ok");
  const exported = await target.runtime.exportUserData();
  if (exported.kind === "failed") throw new Error("export failed");
  const backup = await sqliteFile(exported.value);
  const cancelled = await target.runtime.inspectUserDataBackup(backup);
  if (cancelled.kind === "failed") throw new Error("inspect failed");
  expect(
    (
      await target.runtime.restoreUserData(
        cancelled.value.token,
        cancelled.value.currentRevision,
        false as never,
      )
    ).kind,
  ).toBe("failed");
  expect((await target.runtime.writeUser(allUserMutations())).kind).toBe(
    "failed",
  );
  const preview = await target.runtime.inspectUserDataBackup(backup);
  if (preview.kind === "failed") throw new Error("inspect failed");
  expect(
    (
      await target.runtime.restoreUserData(
        preview.value.token,
        preview.value.currentRevision,
        true,
      )
    ).kind,
  ).toBe("ok");
  for (const mutation of allUserMutations()) {
    expect(
      (await target.runtime.readUser(mutation.namespace, mutation.key)).kind,
    ).toBe("ok");
    expect((await target.runtime.listUser(mutation.namespace)).kind).toBe("ok");
  }
  expect(
    await target.runtime.writeUser([
      {
        kind: "delete",
        namespace: "deck-meta",
        key: "defaultDeck",
        expectedRevision: 1,
      },
    ]),
  ).toEqual({ kind: "ok", value: [] });
  expect(await contentSnapshot()).toEqual(before);
  expect(fixture.files.list()).toEqual(contentKeys);
  await target.runtime.close();
  packages.close();
});

it("expires superseded/consumed tokens and rejects staged digest changes without altering logical data", async () => {
  const target = createRuntime();
  expect((await target.runtime.writeUser(allUserMutations())).kind).toBe("ok");
  const before = logicalUserSnapshot(target.user.database);
  const exported = await target.runtime.exportUserData();
  if (exported.kind === "failed") throw new Error("export failed");
  const file = await sqliteFile(exported.value);
  const first = await target.runtime.inspectUserDataBackup(file);
  const second = await target.runtime.inspectUserDataBackup(file);
  if (first.kind === "failed" || second.kind === "failed")
    throw new Error("inspect failed");
  expect(
    await target.runtime.restoreUserData(first.value.token, 1, true),
  ).toEqual({ kind: "failed", error: { code: "STORAGE_CONFLICT" } });
  expect(
    target.files.list().filter((key) => key.startsWith("/user-backups/")),
  ).toHaveLength(1);
  const altered = createRuntime();
  expect((await altered.runtime.writeUser([shellMutation()])).kind).toBe("ok");
  const alteredExport = await altered.runtime.exportUserData();
  if (alteredExport.kind === "failed") throw new Error("export failed");
  const stagedKey = target.files
    .list()
    .find((key) => key.startsWith("/user-backups/"))!;
  const alteredBytes = new Uint8Array(await alteredExport.value.arrayBuffer());
  let sent = false;
  await target.files.importDatabase(stagedKey, async () => {
    if (sent) return undefined;
    sent = true;
    return alteredBytes;
  });
  expect(
    await target.runtime.restoreUserData(second.value.token, 1, true),
  ).toEqual({ kind: "failed", error: { code: "USER_DATA_INVALID" } });
  expect(
    await target.runtime.restoreUserData(second.value.token, 1, true),
  ).toEqual({ kind: "failed", error: { code: "STORAGE_CONFLICT" } });
  expect(logicalUserSnapshot(target.user.database)).toEqual(before);
  expect(target.files.has(stagedKey)).toBe(false);
  const third = await target.runtime.inspectUserDataBackup(file);
  if (third.kind === "failed") throw new Error("inspect failed");
  // Startup owns stale staging cleanup, not any prior process's in-memory token.
  const reopened = new UserDataRuntime({
    database: databaseAdapter(createUserDataFixture().database),
    files: target.files,
    randomId: () => "restart",
  });
  expect(await reopened.reconcileStagedBackups()).toEqual({
    kind: "ok",
    value: { removedFiles: 1 },
  });
  expect(await reopened.restoreUserData(third.value.token, 1, true)).toEqual({
    kind: "failed",
    error: { code: "STORAGE_CONFLICT" },
  });
  await reopened.close();
  await target.runtime.close();
  await altered.runtime.close();
});
