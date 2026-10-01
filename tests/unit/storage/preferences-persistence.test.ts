import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PERSISTED_UI_STATE } from "../../../src/battle/app/stores/persisted-ui-state.ts";
import { createSqliteUserServices } from "../../../src/shell/adapters/sqlite-user-services.ts";
import { DEFAULT_SHELL_SETTINGS } from "../../../src/shell/settings/shell-settings.ts";
import { DEFAULT_STORY_PLAYBACK_SETTINGS } from "../../../src/story/playback/story-playback-settings.ts";
import type {
  StorageResult,
  UserDataStore,
  UserMutation,
  UserRecord,
} from "../../../src/storage/index.ts";
import { UserDataRuntime } from "../../fixtures/legacy-user-data-runtime.ts";
import {
  createUserDataFixture,
  type PackageFixtureDatabase,
} from "./sqlite-fixtures.ts";
import {
  createNodeFileStore,
  databaseAdapter,
  type NodeFileStore,
} from "./runtime-fixtures.ts";

function runtime(): {
  readonly database: PackageFixtureDatabase;
  readonly files: NodeFileStore;
  readonly store: UserDataRuntime;
} {
  const database = createUserDataFixture();
  const files = createNodeFileStore();
  return {
    database,
    files,
    store: new UserDataRuntime({
      database: databaseAdapter(database.database),
      files,
      randomId: () => crypto.randomUUID(),
    }),
  };
}

function wrappedStore(
  base: UserDataStore,
  overrides: Partial<UserDataStore>,
): UserDataStore {
  return {
    readUser:
      overrides.readUser ?? ((namespace, key) => base.readUser(namespace, key)),
    listUser: overrides.listUser ?? ((namespace) => base.listUser(namespace)),
    writeUser:
      overrides.writeUser ?? ((mutations) => base.writeUser(mutations)),
    exportUserData: () => base.exportUserData(),
    inspectUserDataBackup: (file) => base.inspectUserDataBackup(file),
    restoreUserData: (token, revision, confirmed) =>
      base.restoreUserData(token, revision, confirmed),
  };
}

describe("SQLite preference services", () => {
  it("hydrates every missing preference from its domain-owned default", async () => {
    const fixture = runtime();
    const preferences = createSqliteUserServices(fixture.store).preferences;
    expect(await preferences.shell.read()).toEqual(DEFAULT_SHELL_SETTINGS);
    expect(await preferences.battle.read()).toEqual(DEFAULT_PERSISTED_UI_STATE);
    expect(await preferences.storyPlayback.read()).toEqual(
      DEFAULT_STORY_PLAYBACK_SETTINGS,
    );
    expect(await preferences.storyReadLog.read()).toEqual(new Set());
    expect(
      await preferences.storyPlayback.update({ autoSpeedSeconds: 0 }),
    ).toEqual({ kind: "failed", error: { code: "USER_DATA_INVALID" } });
  });

  it("hydrates once per key across service instances and merges rapid writes", async () => {
    const fixture = runtime();
    let shellReads = 0;
    const store = wrappedStore(fixture.store, {
      readUser(namespace, key) {
        if (namespace === "preferences" && key === "shell") shellReads += 1;
        return fixture.store.readUser(namespace, key);
      },
    });
    const first = createSqliteUserServices(store);
    const second = createSqliteUserServices(store);

    expect(await first.preferences.shell.read()).toEqual(
      DEFAULT_SHELL_SETTINGS,
    );
    expect(await second.preferences.shell.read()).toEqual(
      DEFAULT_SHELL_SETTINGS,
    );
    const [dismissed, opponent] = await Promise.all([
      first.preferences.shell.update({ rotationNoticeDismissed: true }),
      second.preferences.shell.update({ freePlayOpponentId: "rival" }),
    ]);
    expect(dismissed.kind).toBe("ok");
    expect(opponent).toMatchObject({
      kind: "ok",
      value: { rotationNoticeDismissed: true, freePlayOpponentId: "rival" },
    });
    expect(await first.preferences.shell.read()).toMatchObject({
      rotationNoticeDismissed: true,
      freePlayOpponentId: "rival",
    });
    expect(shellReads).toBe(1);
  });

  it("reloads and rebases one stale write while preserving external fields", async () => {
    const fixture = runtime();
    const services = createSqliteUserServices(fixture.store);
    expect(await services.preferences.shell.read()).toEqual(
      DEFAULT_SHELL_SETTINGS,
    );
    expect(
      await fixture.store.writeUser([
        {
          kind: "put",
          namespace: "preferences",
          key: "shell",
          expectedRevision: null,
          payload: {
            ...DEFAULT_SHELL_SETTINGS,
            freePlayOpponentId: "external",
          },
        },
      ]),
    ).toMatchObject({ kind: "ok" });

    expect(
      await services.preferences.shell.update({
        rotationNoticeDismissed: true,
      }),
    ).toMatchObject({
      kind: "ok",
      value: {
        rotationNoticeDismissed: true,
        freePlayOpponentId: "external",
      },
    });
    expect(await fixture.store.readUser("preferences", "shell")).toMatchObject({
      kind: "ok",
      value: { revision: 2 },
    });
  });

  it("returns a typed conflict after one stale retry and flush reports it", async () => {
    const fixture = runtime();
    let externalRevision: number | null = null;
    let conflicts = 0;
    const store = wrappedStore(fixture.store, {
      async writeUser(mutations) {
        if (
          mutations.length === 1 &&
          mutations[0]?.kind === "put" &&
          mutations[0].namespace === "preferences" &&
          mutations[0].key === "shell"
        ) {
          const payload = {
            ...DEFAULT_SHELL_SETTINGS,
            freePlayOpponentId: `external-${++conflicts}`,
          };
          const external = await fixture.store.writeUser([
            {
              kind: "put",
              namespace: "preferences",
              key: "shell",
              expectedRevision: externalRevision,
              payload,
            },
          ]);
          if (external.kind === "ok")
            externalRevision = external.value[0]?.revision ?? null;
        }
        return fixture.store.writeUser(mutations);
      },
    });
    const services = createSqliteUserServices(store);
    const result = await services.preferences.shell.update({
      rotationNoticeDismissed: true,
    });
    expect(result).toEqual({
      kind: "failed",
      error: { code: "STORAGE_CONFLICT" },
    });
    expect(conflicts).toBe(2);
    expect(await services.preferences.shell.flush()).toEqual(result);
    expect(await services.preferences.shell.read()).toMatchObject({
      rotationNoticeDismissed: false,
      freePlayOpponentId: "external-1",
    });
  });

  it("unions concurrent read-log marks across service instances", async () => {
    const fixture = runtime();
    const first = createSqliteUserServices(fixture.store);
    const second = createSqliteUserServices(fixture.store);

    expect(
      await Promise.all([
        first.preferences.storyReadLog.markRead("opening"),
        second.preferences.storyReadLog.markRead("removed-beat"),
        first.preferences.storyReadLog.markRead("ending"),
      ]),
    ).toEqual([
      { kind: "ok", value: undefined },
      { kind: "ok", value: undefined },
      { kind: "ok", value: undefined },
    ]);
    expect([...(await second.preferences.storyReadLog.read())].sort()).toEqual([
      "ending",
      "opening",
      "removed-beat",
    ]);
    expect(
      await fixture.store.readUser("story-read-log", "read"),
    ).toMatchObject({
      kind: "ok",
      value: {
        revision: 3,
        payload: {
          version: 1,
          beats: ["opening", "removed-beat", "ending"],
        },
      },
    });
  });

  it("never touches legacy browser storage or constructs a Worker", async () => {
    const fixture = runtime();
    const forbidden = new Proxy(
      {},
      {
        get() {
          throw new Error("legacy API called");
        },
      },
    );
    vi.stubGlobal("localStorage", forbidden);
    vi.stubGlobal("indexedDB", forbidden);
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error("legacy API called");
        }
      },
    );
    try {
      const services = createSqliteUserServices(fixture.store);
      expect(await services.preferences.shell.read()).toEqual(
        DEFAULT_SHELL_SETTINGS,
      );
      expect(await services.createDeckRepository().list()).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps failed writes unpublished and makes flush wait then surface failure", async () => {
    const fixture = runtime();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const unavailable: StorageResult<readonly UserRecord[]> = {
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    };
    let block = true;
    const store = wrappedStore(fixture.store, {
      async writeUser(mutations: readonly UserMutation[]) {
        if (!block) return fixture.store.writeUser(mutations);
        await gate;
        return unavailable;
      },
    });
    const services = createSqliteUserServices(store);
    const update = services.preferences.shell.update({
      rotationNoticeDismissed: true,
    });
    let flushed = false;
    const flush = services.preferences.shell.flush().then((result) => {
      flushed = true;
      return result;
    });
    await Promise.resolve();
    expect(flushed).toBe(false);
    release();
    expect(await update).toEqual(unavailable);
    expect(await flush).toEqual(unavailable);
    expect(await services.preferences.shell.read()).toEqual(
      DEFAULT_SHELL_SETTINGS,
    );

    block = false;
    expect(
      await services.preferences.shell.update({
        rotationNoticeDismissed: true,
      }),
    ).toMatchObject({ kind: "ok" });
    expect(await services.preferences.shell.flush()).toEqual({
      kind: "ok",
      value: undefined,
    });
  });
});
