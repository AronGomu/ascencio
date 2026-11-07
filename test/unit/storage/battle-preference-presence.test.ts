import { setImmediate as nextTurn } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PERSISTED_UI_STATE } from "../../../src/battle/app/stores/persisted-ui-state.ts";
import { readSqliteBattlePreferences } from "../../../src/shell/adapters/sqlite-user-services.ts";
import { createUserPersistenceOwner } from "../../../src/shell/application/user-persistence-owner.ts";
import type { LocalStorageClient } from "../../../src/storage/index.ts";
import { sqliteStoryReader } from "../../fixtures/sqlite-story-reader.ts";

const fixtures: ReturnType<typeof sqliteStoryReader>[] = [];
afterEach(async () => {
  for (const fixture of fixtures.splice(0)) await fixture.close();
});
function fixture(fault?: (point: string) => void) {
  const value = sqliteStoryReader(fault);
  fixtures.push(value);
  const client = {
    userData: value.runtime,
    close: () => value.runtime.close(),
  } as unknown as LocalStorageClient;
  return { ...value, client };
}

describe("Battle preference row presence", () => {
  it("publishes only committed owner updates in exact queue result order", async () => {
    const { runtime, client } = fixture();
    const owner = await createUserPersistenceOwner(client);
    const initial = owner.hydrated;
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const write = runtime.writeUser.bind(runtime);
    vi.spyOn(runtime, "writeUser").mockImplementationOnce(async (mutations) => {
      entered.resolve();
      await release.promise;
      return write(mutations);
    });
    const port = owner.services.preferences.battle;
    const observed: string[] = [];
    const first = port
      .update({
        decks: { playerKey: "local:first:1", opponentKey: "chapter:practice" },
      })
      .then((result) => {
        expect(result).toMatchObject({
          kind: "ok",
          value: owner.hydrated.battle,
        });
        observed.push(owner.hydrated.battle.decks.playerKey);
        return result;
      });
    await entered.promise;
    const second = port
      .update({
        decks: { playerKey: "local:second:1", opponentKey: "chapter:practice" },
      })
      .then((result) => {
        expect(result).toMatchObject({
          kind: "ok",
          value: owner.hydrated.battle,
        });
        observed.push(owner.hydrated.battle.decks.playerKey);
        return result;
      });
    expect(owner.hydrated).toBe(initial);
    expect(owner.hydrated.battlePresent).toBe(false);
    release.resolve();
    await Promise.all([first, second]);
    expect(observed).toEqual(["local:first:1", "local:second:1"]);
    expect(owner.hydrated.battlePresent).toBe(true);
    expect((await port.read()).decks.playerKey).toBe("local:second:1");
  });

  it.each(["failed", "rejected", "invalid"] as const)(
    "leaves owner snapshot unchanged after %s update",
    async (kind) => {
      const { runtime, client } = fixture();
      const owner = await createUserPersistenceOwner(client);
      await owner.services.preferences.battle.update(
        DEFAULT_PERSISTED_UI_STATE,
      );
      const before = owner.hydrated;
      if (kind === "failed")
        vi.spyOn(runtime, "writeUser").mockResolvedValueOnce({
          kind: "failed",
          error: { code: "STORAGE_UNAVAILABLE" },
        });
      if (kind === "rejected")
        vi.spyOn(runtime, "writeUser").mockRejectedValueOnce(
          new Error("STORAGE_UNAVAILABLE"),
        );
      const result = await owner.services.preferences.battle.update(
        kind === "invalid"
          ? ({ version: 99 } as never)
          : {
              decks: {
                playerKey: "local:failed:1",
                opponentKey: "chapter:practice",
              },
            },
      );
      expect(result.kind).toBe("failed");
      expect(owner.hydrated).toBe(before);
      expect(owner.hydrated.battlePresent).toBe(true);
      await owner.flush();
    },
  );

  it("close drains accepted write without publishing into closed or replacement owner", async () => {
    const { runtime, client } = fixture();
    const owner = await createUserPersistenceOwner(client);
    const initial = owner.hydrated;
    const replacement = await createUserPersistenceOwner(fixture().client);
    const replacementInitial = replacement.hydrated;
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const write = runtime.writeUser.bind(runtime);
    vi.spyOn(runtime, "writeUser").mockImplementationOnce(async (mutations) => {
      entered.resolve();
      await release.promise;
      return write(mutations);
    });
    const update = owner.services.preferences.battle.update(
      DEFAULT_PERSISTED_UI_STATE,
    );
    await entered.promise;
    const closed = owner.close();
    expect(
      (
        await owner.services.preferences.battle.update(
          DEFAULT_PERSISTED_UI_STATE,
        )
      ).kind,
    ).toBe("failed");
    release.resolve();
    expect((await update).kind).toBe("ok");
    await closed;
    expect(owner.hydrated).toBe(initial);
    expect(replacement.hydrated).toBe(replacementInitial);
  });
  it("distinguishes missing from explicitly stored identical defaults, not global revision", async () => {
    const { runtime, preferences, client } = fixture();
    await preferences.shell.update({ rotationNoticeDismissed: true });
    expect(await readSqliteBattlePreferences(runtime)).toEqual({
      value: DEFAULT_PERSISTED_UI_STATE,
      present: false,
    });
    expect(
      (await createUserPersistenceOwner(client)).hydrated.battlePresent,
    ).toBe(false);
    expect(
      await preferences.battle.update(DEFAULT_PERSISTED_UI_STATE),
    ).toMatchObject({ kind: "ok" });
    expect(await readSqliteBattlePreferences(runtime)).toEqual({
      value: DEFAULT_PERSISTED_UI_STATE,
      present: true,
    });
    expect(
      (await createUserPersistenceOwner(client)).hydrated.battlePresent,
    ).toBe(true);
  });

  it("waits for queued writes and keeps failed writes absent until retry commits", async () => {
    let fail = true;
    const { runtime, preferences, database } = fixture((point) => {
      if (fail && point === "write-after-first")
        throw new Error("injected write failure");
    });
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const write = runtime.writeUser.bind(runtime);
    vi.spyOn(runtime, "writeUser").mockImplementationOnce(async (mutations) => {
      entered.resolve();
      await release.promise;
      return write(mutations);
    });
    const update = preferences.battle.update(DEFAULT_PERSISTED_UI_STATE);
    await entered.promise;
    let settled = false;
    const snapshot = readSqliteBattlePreferences(runtime).then((value) => {
      settled = true;
      return value;
    });
    const flush = preferences.battle.flush();
    await nextTurn();
    expect(settled).toBe(false);
    release.resolve();
    expect(await update).toEqual({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
    expect(await flush).toEqual({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
    expect(await snapshot).toEqual({
      value: DEFAULT_PERSISTED_UI_STATE,
      present: false,
    });
    expect(database.prepare("SELECT * FROM user_records").all()).toEqual([]);
    expect(
      database.prepare("SELECT revision FROM user_data_meta").get(),
    ).toEqual({ revision: 0 });
    fail = false;
    await preferences.battle.update(DEFAULT_PERSISTED_UI_STATE);
    expect(await readSqliteBattlePreferences(runtime)).toEqual({
      value: DEFAULT_PERSISTED_UI_STATE,
      present: true,
    });
  });

  it("rehydrates absent after successful reset without mixing an admitted write", async () => {
    const { runtime, client } = fixture();
    const owner = await createUserPersistenceOwner(client);
    const initial = owner.hydrated;
    const preferences = owner.services.preferences;
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const write = runtime.writeUser.bind(runtime);
    vi.spyOn(runtime, "writeUser").mockImplementationOnce(async (mutations) => {
      entered.resolve();
      await release.promise;
      return write(mutations);
    });
    const update = preferences.battle.update({
      decks: { playerKey: "local:chosen:4", opponentKey: "chapter:practice" },
    });
    await entered.promise;
    const reset = owner.reset(["preferences"]);
    await expect(readSqliteBattlePreferences(runtime)).rejects.toThrow(
      "STORAGE_CONFLICT",
    );
    release.resolve();
    expect(await update).toMatchObject({ kind: "ok" });
    expect(await reset).toEqual({ kind: "ok", value: undefined });
    await nextTurn();
    expect(owner.hydrated.battle).toEqual(initial.battle);
    expect(owner.hydrated.battlePresent).toBe(false);
    expect(await readSqliteBattlePreferences(runtime)).toEqual({
      value: DEFAULT_PERSISTED_UI_STATE,
      present: false,
    });
  });

  it.each([false, true])(
    "restores value and presence in the same root snapshot: %s",
    async (present) => {
      const backup = fixture();
      if (present)
        await backup.preferences.battle.update(DEFAULT_PERSISTED_UI_STATE);
      const exported = await backup.runtime.exportUserData();
      expect(exported.kind).toBe("ok");
      if (exported.kind !== "ok") throw new Error("backup failed");
      const { runtime, preferences, client } = fixture();
      if (!present) await preferences.battle.update(DEFAULT_PERSISTED_UI_STATE);
      const owner = await createUserPersistenceOwner(client);
      const initial = owner.hydrated;
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const write = runtime.writeUser.bind(runtime);
      vi.spyOn(runtime, "writeUser").mockImplementationOnce(
        async (mutations) => {
          const committed = await write(mutations);
          entered.resolve();
          await release.promise;
          return committed;
        },
      );
      const oldUpdate = owner.services.preferences.battle.update({
        decks: {
          playerKey: "local:old-component:1",
          opponentKey: "chapter:practice",
        },
      });
      await entered.promise;
      expect(owner.hydrated).toBe(initial);
      const inspected = await owner.inspectUserDataBackup(
        new File([exported.value], "preferences.sqlite"),
      );
      expect(inspected.kind).toBe("ok");
      if (inspected.kind !== "ok") throw new Error("inspection failed");
      const refresh = vi.fn(async () => {
        expect(owner.hydrated.battle).toEqual(DEFAULT_PERSISTED_UI_STATE);
        expect(owner.hydrated.battlePresent).toBe(present);
      });
      const restoring = owner.restoreUserData(
        inspected.value.token,
        inspected.value.currentRevision,
        refresh,
      );
      expect(
        await owner.services.preferences.battle.update(
          DEFAULT_PERSISTED_UI_STATE,
        ),
      ).toEqual({
        kind: "failed",
        error: { code: "STORAGE_CONFLICT" },
      });
      release.resolve();
      expect((await oldUpdate).kind).toBe("ok");
      expect(await restoring).toMatchObject({
        kind: "ok",
        value: { hydrated: { battlePresent: present } },
      });
      expect(refresh).toHaveBeenCalledOnce();
      await nextTurn();
      expect(owner.hydrated.battle).toEqual(DEFAULT_PERSISTED_UI_STATE);
      expect(owner.hydrated.battlePresent).toBe(present);
      expect(await readSqliteBattlePreferences(runtime)).toEqual({
        value: DEFAULT_PERSISTED_UI_STATE,
        present,
      });
    },
  );

  it.each(["failed", "rejected"] as const)(
    "keeps committed owner snapshot on %s reset",
    async (kind) => {
      const { runtime, client } = fixture();
      const owner = await createUserPersistenceOwner(client);
      await owner.services.preferences.battle.update(
        DEFAULT_PERSISTED_UI_STATE,
      );
      const before = owner.hydrated;
      if (kind === "failed")
        vi.spyOn(runtime, "writeUser").mockResolvedValueOnce({
          kind: "failed",
          error: { code: "STORAGE_UNAVAILABLE" },
        });
      else
        vi.spyOn(runtime, "writeUser").mockRejectedValueOnce(
          new Error("STORAGE_UNAVAILABLE"),
        );
      expect((await owner.reset(["preferences"])).kind).toBe("failed");
      expect(owner.hydrated).toBe(before);
    },
  );

  it.each(["corrupt", "unavailable"] as const)(
    "never treats %s storage as an absent record",
    async (kind) => {
      const { database, runtime, client } = fixture();
      if (kind === "corrupt")
        database
          .prepare(
            "INSERT INTO user_records VALUES ('preferences', 'battle-ui', 1, ?)",
          )
          .run("{");
      else await runtime.close();
      const code =
        kind === "corrupt" ? "USER_DATA_INVALID" : "STORAGE_UNAVAILABLE";
      await expect(readSqliteBattlePreferences(runtime)).rejects.toThrow(code);
      expect((await createUserPersistenceOwner(client)).failure).toEqual({
        code,
      });
    },
  );
});
