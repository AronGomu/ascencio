import { readFileSync, rmdirSync, unlinkSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserDataRuntime } from "../../../src/storage/runtime/user-data-runtime.ts";
import { createSqliteStoryRepository } from "../../../src/story/saves/sqlite-story-repository.ts";
import { createUserDataFixture } from "./sqlite-fixtures.ts";
import {
  createNodeFileStore,
  databaseAdapter,
  fixtureFile,
} from "./runtime-fixtures.ts";
import {
  allUserMutations,
  logicalUserSnapshot,
} from "./user-data-test-records.ts";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});

function liveRuntime() {
  const user = createUserDataFixture();
  const files = createNodeFileStore();
  const base = databaseAdapter(user.database);
  const sql: string[] = [];
  const runtime = new UserDataRuntime({
    database: {
      ...base,
      exec(statement) {
        sql.push(statement);
        base.exec(statement);
      },
      run(statement, parameters) {
        sql.push(statement);
        return base.run(statement, parameters);
      },
    },
    files,
    randomId: () => crypto.randomUUID(),
  });
  cleanup.push(async () => {
    await runtime.close();
    unlinkSync(user.file);
    rmdirSync(files.root);
  });
  return {
    runtime,
    files,
    sql,
    snapshot: () => ({
      bytes: readFileSync(user.file),
      logical: logicalUserSnapshot(user.database),
    }),
  };
}

function backup(access: unknown) {
  const user = createUserDataFixture();
  const mutation = allUserMutations().find((row) => row.namespace === "story")!;
  if (mutation.kind !== "put") throw new Error("fixture requires put");
  const payload = structuredClone(mutation.payload) as {
    state: { locations: { access: unknown }[] };
  };
  payload.state.locations[0]!.access = access;
  const serialized = JSON.stringify(payload, null, 2) + "\n";
  user.database
    .prepare("INSERT INTO user_records VALUES ('story', 'manual:1', 1, ?)")
    .run(serialized);
  user.database.close();
  cleanup.push(async () => {
    unlinkSync(user.file);
  });
  return { file: fixtureFile(user.file), serialized };
}

describe("Story backup structural access validation", () => {
  it.each(["available", "locked", "hidden"])(
    "rejects array access [%s] at native SQLite inspection without committing a bad row",
    async (access) => {
      const target = liveRuntime();
      expect((await target.runtime.writeUser(allUserMutations())).kind).toBe(
        "ok",
      );
      const before = target.snapshot();
      target.sql.length = 0;
      const preview = await target.runtime.inspectUserDataBackup(
        backup([access]).file,
      );
      expect
        .soft(preview)
        .toEqual({ kind: "failed", error: { code: "USER_DATA_INVALID" } });
      // Exercise the real admitted restore on RED, not only the validator.
      if (preview.kind === "ok") {
        expect
          .soft(
            await target.runtime.restoreUserData(
              preview.value.token,
              preview.value.currentRevision,
              true,
            ),
          )
          .toEqual({ kind: "failed", error: { code: "USER_DATA_INVALID" } });
      }
      expect.soft(target.snapshot()).toEqual(before);
      expect.soft(target.sql).toEqual([]);
      expect(target.files.list()).toEqual([]);
    },
  );

  it("revalidates malformed staged access before digest export or any live transaction", async () => {
    const target = liveRuntime();
    expect((await target.runtime.writeUser(allUserMutations())).kind).toBe(
      "ok",
    );
    const preview = await target.runtime.inspectUserDataBackup(
      backup("available").file,
    );
    if (preview.kind === "failed") throw new Error("valid backup rejected");
    const staged = target.files.list()[0]!;
    const malformed = new Uint8Array(
      await backup(["available"]).file.arrayBuffer(),
    );
    let sent = false;
    await target.files.importDatabase(staged, async () => {
      if (sent) return undefined;
      sent = true;
      return malformed;
    });
    const exported = vi.spyOn(target.files, "exportDatabase");
    const before = target.snapshot();
    target.sql.length = 0;
    expect(
      await target.runtime.restoreUserData(
        preview.value.token,
        preview.value.currentRevision,
        true,
      ),
    ).toEqual({ kind: "failed", error: { code: "USER_DATA_INVALID" } });
    expect(exported).not.toHaveBeenCalled();
    expect(target.snapshot()).toEqual(before);
    expect(target.sql).toEqual([]);
    expect(target.files.list()).toEqual([]);
  });

  it.each(["available", "locked", "hidden"])(
    "preserves string access %s and obsolete refs byte-for-byte through restore/export",
    async (access) => {
      const target = liveRuntime();
      const source = backup(access);
      const preview = await target.runtime.inspectUserDataBackup(source.file);
      expect(preview.kind).toBe("ok");
      if (preview.kind === "failed") throw new Error("valid backup rejected");
      expect(
        await target.runtime.restoreUserData(
          preview.value.token,
          preview.value.currentRevision,
          true,
        ),
      ).toEqual({ kind: "ok", value: { revision: 1 } });
      expect(target.snapshot().logical.rows).toEqual([
        {
          namespace: "story",
          record_key: "manual:1",
          revision: 1,
          payload_json: source.serialized,
        },
      ]);
      const beforeRead = target.snapshot();
      expect(
        await createSqliteStoryRepository(target.runtime).read("manual:1"),
      ).toEqual({ kind: "incompatible", slot: "manual:1", found: 6 });
      const exported = await target.runtime.exportUserData();
      if (exported.kind === "failed") throw new Error("export failed");
      const restored = liveRuntime();
      const reinspection = await restored.runtime.inspectUserDataBackup(
        new File([await exported.value.arrayBuffer()], "user-data.sqlite"),
      );
      if (reinspection.kind === "failed")
        throw new Error("exported backup rejected");
      expect(
        (
          await restored.runtime.restoreUserData(
            reinspection.value.token,
            0,
            true,
          )
        ).kind,
      ).toBe("ok");
      expect(restored.snapshot().logical.rows).toEqual(beforeRead.logical.rows);
      expect(target.snapshot()).toEqual(beforeRead);
    },
  );
});
