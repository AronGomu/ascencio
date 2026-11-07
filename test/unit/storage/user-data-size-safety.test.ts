import { describe, expect, it, vi } from "vitest";
import { UserDataRuntime } from "../../fixtures/legacy-user-data-runtime.ts";
import {
  validateUserDataDatabase,
  USER_DATA_MAX_BACKUP_BYTES,
} from "../../fixtures/legacy-user-data-validation.ts";
import { USER_DATA_MAX_PAYLOAD_BYTES } from "../../../src/storage/schema/user-record-validation.ts";
import { createUserDataFixture } from "./sqlite-fixtures.ts";
import {
  createNodeFileStore,
  databaseAdapter,
  fixtureFile,
} from "./runtime-fixtures.ts";

function cappedDatabase(kind: "row" | "database", over = true) {
  const fixture = createUserDataFixture();
  fixture.database
    .prepare("INSERT INTO user_records VALUES (?, ?, ?, ?)")
    .run("deck-meta", "lastOpened", 1, '"small"');
  const base = databaseAdapter(fixture.database);
  const payloadReads = vi.fn();
  const serialize = vi.fn(base.exportBytes);
  const database = {
    ...base,
    exportBytes: serialize,
    all(sql: string, parameters?: Parameters<typeof base.all>[1]) {
      if (kind === "database" && sql === "PRAGMA page_count")
        return [
          { page_count: USER_DATA_MAX_BACKUP_BYTES / 4096 + (over ? 1 : 0) },
        ];
      if (kind === "database" && sql === "PRAGMA page_size")
        return [{ page_size: 4096 }];
      if (/SELECT .*payload_json FROM/.test(sql)) payloadReads();
      return base.all(sql, parameters);
    },
    each(
      sql: string,
      parameters: Parameters<typeof base.each>[1],
      callback: Parameters<typeof base.each>[2],
    ) {
      if (sql.includes("length(CAST(payload_json AS BLOB))")) {
        base.each(sql, parameters, (row) =>
          callback({
            ...row,
            payload_bytes:
              kind === "row"
                ? USER_DATA_MAX_PAYLOAD_BYTES + (over ? 1 : 0)
                : row.payload_bytes!,
          }),
        );
        return;
      }
      if (/SELECT .*payload_json FROM/.test(sql)) payloadReads();
      base.each(sql, parameters, callback);
    },
  };
  return { fixture, database, payloadReads, serialize };
}

describe("user-data pre-materialization limits", () => {
  it.each(["row", "database"] as const)(
    "rejects oversized %s before payload reads or serialization",
    async (kind) => {
      const capped = cappedDatabase(kind);
      const runtime = new UserDataRuntime({
        database: capped.database,
        files: createNodeFileStore(),
        randomId: () => "size",
      });
      const expected = {
        kind: "failed",
        error: { code: "USER_DATA_TOO_LARGE" },
      };
      expect(validateUserDataDatabase(capped.database)).toEqual(expected);
      expect(await runtime.readUser("deck-meta", "lastOpened")).toEqual(
        expected,
      );
      expect(await runtime.listUser("deck-meta")).toEqual(expected);
      expect(await runtime.exportUserData()).toEqual(expected);
      expect(capped.payloadReads).not.toHaveBeenCalled();
      expect(capped.serialize).not.toHaveBeenCalled();
      await runtime.close();
    },
  );

  it.each(["row", "database"] as const)(
    "accepts exact %s cap without huge allocation",
    (kind) => {
      const capped = cappedDatabase(kind, false);
      expect(validateUserDataDatabase(capped.database).kind).toBe("ok");
      capped.database.close();
    },
  );

  it.each(["row", "database"] as const)(
    "preflights staged %s before file export during inspect and restore",
    async (kind) => {
      const capped = cappedDatabase(kind);
      const files = createNodeFileStore();
      const normalOpen = files.openDatabase.bind(files);
      const exportFile = vi.spyOn(files, "exportDatabase");
      let oversized = true;
      files.openDatabase = (key) =>
        oversized ? { ...capped.database, close() {} } : normalOpen(key);
      const live = createUserDataFixture();
      const runtime = new UserDataRuntime({
        database: databaseAdapter(live.database),
        files,
        randomId: () => crypto.randomUUID(),
      });
      const input = fixtureFile(capped.fixture.file);
      expect(await runtime.inspectUserDataBackup(input)).toEqual({
        kind: "failed",
        error: { code: "USER_DATA_TOO_LARGE" },
      });
      expect(exportFile).not.toHaveBeenCalled();
      expect(capped.payloadReads).not.toHaveBeenCalled();
      oversized = false;
      const preview = await runtime.inspectUserDataBackup(input);
      if (preview.kind === "failed") throw new Error("inspect failed");
      exportFile.mockClear();
      oversized = true;
      expect(
        await runtime.restoreUserData(
          preview.value.token,
          preview.value.currentRevision,
          true,
        ),
      ).toEqual({ kind: "failed", error: { code: "USER_DATA_TOO_LARGE" } });
      expect(exportFile).not.toHaveBeenCalled();
      expect(capped.payloadReads).not.toHaveBeenCalled();
      await runtime.close();
      capped.database.close();
    },
  );

  it("rejects unsafe page metadata before row expressions", () => {
    const fixture = createUserDataFixture();
    const base = databaseAdapter(fixture.database);
    const each = vi.fn(base.each);
    for (const page_count of [Number.MAX_SAFE_INTEGER, -1, Infinity, 1.5]) {
      expect(
        validateUserDataDatabase({
          ...base,
          each,
          all(sql, parameters) {
            return sql === "PRAGMA page_count"
              ? [{ page_count }]
              : base.all(sql, parameters);
          },
        }).kind,
      ).toBe("failed");
    }
    expect(each).not.toHaveBeenCalled();
    base.close();
  });
});
