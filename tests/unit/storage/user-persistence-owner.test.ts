import { IDBFactory } from "fake-indexeddb";
import { createApplicationAdmission } from "../../../src/shell/application/application-admission.ts";
import { createAppUpdateController } from "../../../src/shell/application/app-update-controller.ts";
import { readCoreApproval } from "../../../src/shell/application/core-update-approval.ts";
import { testLocks } from "../../fixtures/application-locks.ts";
import { readFileSync } from "node:fs";
import { createManualContentController } from "../../../src/shell/application/manual-content-controller.ts";
import { setImmediate as nextTurn } from "node:timers/promises";
import { deckId } from "../../../src/decks/deck-contracts.ts";
import { createSqliteDeckRepository } from "../../../src/decks/sqlite-deck-repository.ts";
import { createSqliteUserServices } from "../../../src/shell/adapters/sqlite-user-services.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import { storyBindingFixture } from "../../fixtures/story-release.ts";
import { DEFAULT_SHELL_SETTINGS } from "../../../src/shell/settings/index.ts";
import { DEFAULT_STORY_PLAYBACK_SETTINGS } from "../../../src/story/playback/index.ts";
import { defaultPersistedUiState } from "../../../src/battle/ports/index.ts";
import { describe, expect, it, vi } from "vitest";
import { createUserPersistenceOwner } from "../../../src/shell/application/user-persistence-owner.ts";
import type { LocalStorageClient } from "../../../src/storage/index.ts";
import { UserDataRuntime } from "../../../src/storage/runtime/user-data-runtime.ts";
import { createUserDataFixture } from "./sqlite-fixtures.ts";
import { createNodeFileStore, databaseAdapter } from "./runtime-fixtures.ts";

function fixture() {
  const database = createUserDataFixture();
  const files = createNodeFileStore();
  const userData = new UserDataRuntime({
    database: databaseAdapter(database.database),
    files,
    randomId: () => crypto.randomUUID(),
  });
  const closed = vi.fn(async () => userData.close());
  const client = {
    userData,
    close: closed,
  } as unknown as LocalStorageClient;
  return { client, userData, closed, database };
}

describe("root user persistence owner", () => {
  it("hydrates four ports, flushes writes, resets explicit namespaces by CAS, and closes once", async () => {
    const { client, userData, closed } = fixture();
    const owner = await createUserPersistenceOwner(client);

    expect(owner.failure).toBeNull();
    expect(owner.hydrated.storyReadLog).toEqual(new Set());
    expect(
      await owner.services.preferences.shell.update({
        rotationNoticeDismissed: true,
      }),
    ).toMatchObject({ kind: "ok" });
    expect(
      await owner.services.preferences.storyReadLog.markRead("arrival"),
    ).toEqual({ kind: "ok", value: undefined });
    expect(await owner.flush()).toEqual({ kind: "ok", value: undefined });

    expect(await owner.reset(["preferences"])).toEqual({
      kind: "ok",
      value: undefined,
    });
    expect(await userData.listUser("preferences")).toEqual({
      kind: "ok",
      value: [],
    });
    expect(await userData.listUser("story-read-log")).toMatchObject({
      kind: "ok",
      value: [{ key: "read" }],
    });

    await owner.close();
    await owner.close();
    expect(closed).toHaveBeenCalledOnce();
  });
});

function pauseNextWrite(userData: UserDataRuntime) {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const write = userData.writeUser.bind(userData);
  vi.spyOn(userData, "writeUser").mockImplementationOnce(async (mutations) => {
    entered.resolve();
    await release.promise;
    return write(mutations);
  });
  return { entered: entered.promise, release: () => release.resolve() };
}

const history = { undo: [], redo: [], nextSequence: 1 };
function deck(id = "deck") {
  return {
    schemaVersion: 1 as const,
    id: deckId(id),
    revision: 0,
    name: id,
    createdAt: "2026-09-24T00:00:00.000Z",
    updatedAt: "2026-09-24T00:00:00.000Z",
    validation: {
      status: "valid" as const,
      issues: [],
      rulesetRevision: "fixture",
    },
    importedNeedsReview: false,
    illustrationCardCode: null,
    main: [1],
    extra: [],
    side: [],
  };
}
function autosave(id: string) {
  return {
    id,
    deckId: deckId("deck"),
    deckName: "deck",
    createdAt: "2026-09-24T00:00:00.000Z",
    main: [1],
    extra: [],
    side: [],
    illustrationCardCode: null,
  };
}

describe("same-store write lifecycle", () => {
  it.each(["create", "save", "autosave"] as const)(
    "reset drains admitted %s behind autosave, then deletes every row",
    async (kind) => {
      const { client, userData } = fixture();
      const owner = await createUserPersistenceOwner(client);
      const first = owner.services.createDeckRepository();
      const second = createSqliteDeckRepository(userData);
      const stored = await first.create(deck(), history);
      const pause = pauseNextWrite(userData);
      const a = first.appendAutosave(autosave("a"));
      await pause.entered;
      const b =
        kind === "create"
          ? second.createAndOpen(deck("b"), history)
          : kind === "save"
            ? second.save(
                stored.deck.revision,
                { ...stored.deck, name: "changed" },
                history,
              )
            : second.appendAutosave(autosave("b"));
      const resetting = owner.reset(["decks", "deck-meta", "deck-autosaves"]);
      pause.release();
      await Promise.all([a, b]);
      expect(await resetting).toEqual({ kind: "ok", value: undefined });
      for (const namespace of ["decks", "deck-meta", "deck-autosaves"] as const)
        expect(await userData.listUser(namespace)).toEqual({
          kind: "ok",
          value: [],
        });
      await owner.close();
    },
  );

  it("reset rejects late writes synchronously while admitted preferences/read-log/Story calls drain", async () => {
    const { client, userData } = fixture();
    const owner = await createUserPersistenceOwner(client);
    const other = createSqliteUserServices(userData);
    const pause = pauseNextWrite(userData);
    const a = owner.services.preferences.shell.update({
      rotationNoticeDismissed: true,
    });
    await pause.entered;
    const b = other.preferences.shell.update({
      freePlayOpponentId: "old-opponent",
    });
    const c = other.preferences.storyReadLog.markRead("old-beat");
    const d = owner.saves.write(
      "manual:1",
      createInitialStoryState(),
      null,
      storyBindingFixture(),
    );
    let settled = false;
    const resetting = owner
      .reset(["preferences", "story-read-log", "story"])
      .then((result) => {
        settled = true;
        return result;
      });
    const late = other.preferences.shell.update({ freePlayOpponentId: "late" });
    const lateStory = owner.saves.write(
      "manual:2",
      createInitialStoryState(),
      null,
      storyBindingFixture(),
    );
    const lateDeck = owner.services
      .createDeckRepository()
      .appendAutosave(autosave("late"))
      .then(
        () => "accepted",
        () => "rejected",
      );
    await nextTurn();
    const settledBeforeRelease = settled;
    pause.release();
    expect((await a).kind).toBe("ok");
    expect((await b).kind).toBe("ok");
    expect((await c).kind).toBe("ok");
    expect((await d).kind).toBe("written");
    expect(settledBeforeRelease).toBe(false);
    expect((await late).kind).toBe("failed");
    expect((await lateStory).kind).toBe("failed");
    expect(await lateDeck).toBe("rejected");
    expect(await resetting).toEqual({ kind: "ok", value: undefined });
    expect(await owner.saves.read("manual:1")).toEqual({
      kind: "empty",
      slot: "manual:1",
    });
    expect(
      await other.preferences.shell.update({
        freePlayOpponentId: "new-opponent",
      }),
    ).toMatchObject({
      kind: "ok",
      value: {
        rotationNoticeDismissed: false,
        freePlayOpponentId: "new-opponent",
      },
    });
    expect(
      (await other.preferences.storyReadLog.markRead("new-beat")).kind,
    ).toBe("ok");
    expect(await owner.services.preferences.storyReadLog.read()).toEqual(
      new Set(["new-beat"]),
    );
    await owner.close();
  });

  it("export quiesces all admitted user writes and rejects new writes until snapshot completes", async () => {
    const { client, userData } = fixture();
    const owner = await createUserPersistenceOwner(client);
    const pause = pauseNextWrite(userData);
    const admitted = owner.services.preferences.shell.update({
      rotationNoticeDismissed: true,
    });
    await pause.entered;
    let settled = false;
    const exporting = owner.exportUserData().then((result) => {
      settled = true;
      return result;
    });
    const late = owner.services.preferences.shell.update({
      freePlayOpponentId: "late",
    });
    await nextTurn();
    expect(settled).toBe(false);
    expect((await late).kind).toBe("failed");
    pause.release();
    expect((await admitted).kind).toBe("ok");
    expect(await exporting).toMatchObject({
      kind: "ok",
      value: { type: "application/vnd.sqlite3" },
    });
    await owner.close();
  });

  it("holds restore barrier across hydration failure, then retries caches without reusing token", async () => {
    const source = fixture();
    expect(
      await source.userData.writeUser([
        {
          kind: "put",
          namespace: "preferences",
          key: "shell",
          expectedRevision: null,
          payload: { ...DEFAULT_SHELL_SETTINGS, rotationNoticeDismissed: true },
        },
      ]),
    ).toMatchObject({ kind: "ok" });
    const exported = await source.userData.exportUserData();
    if (exported.kind === "failed") throw new Error(exported.error.code);

    const target = fixture();
    const owner = await createUserPersistenceOwner(target.client);
    const inspected = await owner.inspectUserDataBackup(
      new File([await exported.value.arrayBuffer()], "user-data.sqlite", {
        type: "application/vnd.sqlite3",
      }),
    );
    if (inspected.kind === "failed") throw new Error(inspected.error.code);
    vi.spyOn(target.userData, "readUser").mockResolvedValueOnce({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
    expect(
      await owner.restoreUserData(
        inspected.value.token,
        inspected.value.currentRevision,
        async () => undefined,
      ),
    ).toEqual({
      kind: "refresh-failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
    expect(
      (
        await owner.services.preferences.shell.update({
          freePlayOpponentId: "blocked",
        })
      ).kind,
    ).toBe("failed");
    const refreshed = await owner.refreshAfterRestore();
    expect(refreshed).toMatchObject({
      kind: "ok",
      value: {
        revision: 1,
        hydrated: { shell: { rotationNoticeDismissed: true } },
      },
    });
    expect(await owner.services.preferences.shell.read()).toMatchObject({
      rotationNoticeDismissed: true,
      freePlayOpponentId: DEFAULT_SHELL_SETTINGS.freePlayOpponentId,
    });
    await owner.close();
    await source.userData.close();
  });

  it("successful reset invalidates every cached preference key across service instances", async () => {
    const { client, userData } = fixture();
    const owner = await createUserPersistenceOwner(client);
    const other = createSqliteUserServices(userData);
    await other.preferences.shell.update({ rotationNoticeDismissed: true });
    await other.preferences.storyPlayback.update({ skipUnread: true });
    await other.preferences.battle.update({
      windows: { zoneList: { x: 10, y: 20 }, confirm: null },
    });
    await other.preferences.storyReadLog.markRead("old");
    expect((await owner.reset(["preferences", "story-read-log"])).kind).toBe(
      "ok",
    );
    expect(await other.preferences.shell.read()).toEqual(
      DEFAULT_SHELL_SETTINGS,
    );
    expect(await other.preferences.storyPlayback.read()).toEqual(
      DEFAULT_STORY_PLAYBACK_SETTINGS,
    );
    expect(await other.preferences.battle.read()).toEqual(
      defaultPersistedUiState(),
    );
    await other.preferences.storyPlayback.update({ autoFlip: true });
    expect(await other.preferences.storyPlayback.read()).toMatchObject({
      autoFlip: true,
      skipUnread: false,
    });
    await other.preferences.storyReadLog.markRead("new");
    expect(await other.preferences.storyReadLog.read()).toEqual(
      new Set(["new"]),
    );
    await owner.close();
  });

  it.each(["result", "throw"] as const)(
    "failed reset (%s) releases admission without invalidating saved preferences",
    async (failure) => {
      const { client, userData } = fixture();
      const owner = await createUserPersistenceOwner(client);
      await owner.services.preferences.shell.update({
        rotationNoticeDismissed: true,
      });
      if (failure === "result")
        vi.spyOn(userData, "writeUser").mockResolvedValueOnce({
          kind: "failed",
          error: { code: "STORAGE_UNAVAILABLE" },
        });
      else
        vi.spyOn(userData, "writeUser").mockRejectedValueOnce(
          new Error("STORAGE_UNAVAILABLE"),
        );
      expect(await owner.reset(["preferences"])).toEqual({
        kind: "failed",
        error: { code: "STORAGE_UNAVAILABLE" },
      });
      expect(
        await owner.services.preferences.shell.update({
          freePlayOpponentId: "after",
        }),
      ).toMatchObject({
        kind: "ok",
        value: { rotationNoticeDismissed: true, freePlayOpponentId: "after" },
      });
      await owner.close();
    },
  );

  it("close drains all admitted adapters, rejects late writes, shares completion", async () => {
    const { client, userData, closed } = fixture();
    const owner = await createUserPersistenceOwner(client);
    const repository = owner.services.createDeckRepository();
    const pause = pauseNextWrite(userData);
    const a = repository.appendAutosave(autosave("a"));
    await pause.entered;
    const b = repository.appendAutosave(autosave("b"));
    const c = owner.services.preferences.shell.update({
      rotationNoticeDismissed: true,
    });
    const d = owner.services.preferences.storyReadLog.markRead("read");
    const e = owner.saves.write(
      "manual:1",
      createInitialStoryState(),
      null,
      storyBindingFixture(),
    );
    const written: string[] = [];
    const close = closed.getMockImplementation()!;
    closed.mockImplementation(async () => {
      for (const namespace of [
        "deck-autosaves",
        "preferences",
        "story-read-log",
        "story",
      ] as const) {
        const result = await userData.listUser(namespace);
        if (result.kind === "ok")
          written.push(...result.value.map((row) => `${namespace}/${row.key}`));
      }
      await close();
    });
    const closing = owner.close();
    const closingAgain = owner.close();
    const late = repository.appendAutosave(autosave("late")).then(
      () => "accepted",
      () => "rejected",
    );
    await nextTurn();
    const premature = closed.mock.calls.length;
    pause.release();
    await Promise.all([a, b, c, d, e, closing, closingAgain]);
    expect(premature).toBe(0);
    expect(await late).toBe("rejected");
    expect(written.sort()).toEqual([
      "deck-autosaves/a",
      "deck-autosaves/b",
      "preferences/shell",
      "story-read-log/read",
      "story/manual:1",
    ]);
    expect(closed).toHaveBeenCalledOnce();
    expect(
      (
        await owner.services.preferences.shell.update({
          rotationNoticeDismissed: false,
        })
      ).kind,
    ).toBe("failed");
  });

  it("flush exposes queued autosave errors even when later write succeeds", async () => {
    const { client, userData } = fixture();
    const owner = await createUserPersistenceOwner(client);
    vi.spyOn(userData, "writeUser").mockResolvedValueOnce({
      kind: "failed",
      error: { code: "STORAGE_QUOTA_EXCEEDED" },
    });
    const repository = owner.services.createDeckRepository();
    const a = repository.appendAutosave(autosave("a")).catch(() => undefined);
    const b = repository.appendAutosave(autosave("b"));
    const flushed = owner.flush();
    await Promise.all([a, b]);
    expect(await flushed).toEqual({
      kind: "failed",
      error: { code: "STORAGE_QUOTA_EXCEEDED" },
    });
    await owner.close();
  });

  it("close reports failed accepted writes after draining remaining writes and terminating client", async () => {
    const { client, userData, closed } = fixture();
    const owner = await createUserPersistenceOwner(client);
    const repository = owner.services.createDeckRepository();
    vi.spyOn(userData, "writeUser").mockResolvedValueOnce({
      kind: "failed",
      error: { code: "STORAGE_QUOTA_EXCEEDED" },
    });
    const a = repository.appendAutosave(autosave("a")).catch(() => undefined);
    const b = repository.appendAutosave(autosave("b"));
    const closing = expect(owner.close()).rejects.toThrow(
      "STORAGE_QUOTA_EXCEEDED",
    );
    await Promise.all([a, b, closing]);
    expect(closed).toHaveBeenCalledOnce();
  });
});

describe("restore root refresh ownership", () => {
  it("keeps barrier through external root callback failure and retry", async () => {
    const target = fixture();
    const owner = await createUserPersistenceOwner(target.client);
    const exported = await target.userData.exportUserData();
    if (exported.kind === "failed") throw new Error(exported.error.code);
    const inspected = await owner.inspectUserDataBackup(
      new File([await exported.value.arrayBuffer()], "backup.sqlite"),
    );
    if (inspected.kind === "failed") throw new Error(inspected.error.code);
    const root = vi.fn<() => Promise<void>>(async () => {
      expect(
        (
          await owner.services.preferences.shell.update({
            freePlayOpponentId: "late",
          })
        ).kind,
      ).toBe("failed");
      throw new Error("ROOT_REFRESH_FAILED");
    });
    const result = await owner.restoreUserData(
      inspected.value.token,
      inspected.value.currentRevision,
      root,
    );
    expect(root).toHaveBeenCalledOnce();
    expect(result.kind).toBe("refresh-failed");
    expect(
      (await owner.services.preferences.storyReadLog.markRead("late")).kind,
    ).toBe("failed");
    const restored = vi.spyOn(target.userData, "restoreUserData");
    root.mockImplementationOnce(async () => undefined);
    expect((await owner.refreshAfterRestore()).kind).toBe("ok");
    expect(restored).not.toHaveBeenCalled();
    expect(
      (await owner.services.preferences.storyReadLog.markRead("after")).kind,
    ).toBe("ok");
    await owner.close();
  });
});

it("real SQLite restore cannot release admission before controller root invalidation", async () => {
  const target = fixture();
  const owner = await createUserPersistenceOwner(target.client);
  const backup = await target.userData.exportUserData();
  if (backup.kind === "failed") throw new Error(backup.error.code);
  const current = vi.fn(async () => ({
    kind: "ok" as const,
    value: { generation: 0, packages: [] },
  }));
  const rootEntered = Promise.withResolvers<void>();
  const rootRelease = Promise.withResolvers<void>();
  const controller = createManualContentController({
    storage: {
      ...target.client,
      packages: { current },
    } as unknown as LocalStorageClient,
    backups: owner,
    isSessionActive: () => false,
    onRestored: async () => {
      rootEntered.resolve();
      await rootRelease.promise;
    },
  });
  await controller.refresh();
  await controller.inspectUserDataBackup(
    new File([await backup.value.arrayBuffer()], "backup.sqlite"),
  );
  const restoring = controller.confirmRestore();
  await rootEntered.promise;
  const late = await owner.services.preferences.shell.update({
    freePlayOpponentId: "stale-root",
  });
  rootRelease.resolve();
  await restoring;
  await owner.close();
  expect(late.kind).toBe("failed");
});

async function inspectedEmptyBackup(
  owner: Awaited<ReturnType<typeof createUserPersistenceOwner>>,
  target: ReturnType<typeof fixture>,
) {
  const backup = await target.userData.exportUserData();
  if (backup.kind === "failed") throw new Error(backup.error.code);
  const inspected = await owner.inspectUserDataBackup(
    new File([await backup.value.arrayBuffer()], "backup.sqlite"),
  );
  if (inspected.kind === "failed") throw new Error(inspected.error.code);
  return inspected.value;
}

describe("restore close and committed byte safety", () => {
  it("drains accepted writes before restore CAS; failed uncommitted restore keeps exact live bytes", async () => {
    const target = fixture();
    const owner = await createUserPersistenceOwner(target.client);
    const preview = await inspectedEmptyBackup(owner, target);
    const pause = pauseNextWrite(target.userData);
    const accepted = owner.services.preferences.shell.update({
      rotationNoticeDismissed: true,
    });
    await pause.entered;
    const acceptedReadLog =
      owner.services.preferences.storyReadLog.markRead("accepted");
    const acceptedStory = owner.saves.write(
      "manual:1",
      createInitialStoryState(),
      null,
      storyBindingFixture(),
    );
    const acceptedDeck = owner.services
      .createDeckRepository()
      .create(deck("accepted"), history);
    const rawRestore = target.userData.restoreUserData.bind(target.userData);
    let before: Buffer | null = null;
    vi.spyOn(target.userData, "restoreUserData").mockImplementationOnce(
      async (...args) => {
        before = readFileSync(target.database.file);
        return rawRestore(...args);
      },
    );
    const root = vi.fn(async () => undefined);
    const restoring = owner.restoreUserData(
      preview.token,
      preview.currentRevision,
      root,
    );
    expect(
      (
        await owner.services.preferences.shell.update({
          freePlayOpponentId: "late",
        })
      ).kind,
    ).toBe("failed");
    pause.release();
    await Promise.all([accepted, acceptedReadLog, acceptedStory, acceptedDeck]);
    expect(await restoring).toEqual({
      kind: "failed",
      error: { code: "STORAGE_CONFLICT" },
    });
    expect(readFileSync(target.database.file)).toEqual(before);
    expect(root).not.toHaveBeenCalled();
    expect(
      (await owner.services.preferences.storyReadLog.markRead("after")).kind,
    ).toBe("ok");
    await owner.close();
  });

  it.each(["commit", "root", "failed-refresh"] as const)(
    "close safely awaits %s with barrier held, closes once without orphan",
    async (phase) => {
      const source = fixture();
      await source.userData.writeUser([
        {
          kind: "put",
          namespace: "preferences",
          key: "shell",
          expectedRevision: null,
          payload: { ...DEFAULT_SHELL_SETTINGS, rotationNoticeDismissed: true },
        },
      ]);
      const backup = await source.userData.exportUserData();
      if (backup.kind === "failed") throw new Error(backup.error.code);
      const target = fixture();
      const owner = await createUserPersistenceOwner(target.client);
      const preview = await owner.inspectUserDataBackup(
        new File([await backup.value.arrayBuffer()], "backup.sqlite"),
      );
      if (preview.kind === "failed") throw new Error(preview.error.code);
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const raw = target.userData.restoreUserData.bind(target.userData);
      const restored = vi
        .spyOn(target.userData, "restoreUserData")
        .mockImplementation(async (...args) => {
          const result = await raw(...args);
          if (phase === "commit") {
            entered.resolve();
            await release.promise;
          }
          return result;
        });
      const root = vi.fn(async () => {
        if (phase === "root") {
          entered.resolve();
          await release.promise;
        }
        if (phase === "failed-refresh") throw new Error("ROOT_REFRESH_FAILED");
      });
      const restoring = owner.restoreUserData(
        preview.value.token,
        preview.value.currentRevision,
        root,
      );
      if (phase === "failed-refresh")
        expect((await restoring).kind).toBe("refresh-failed");
      else await entered.promise;
      const committedBytes = readFileSync(target.database.file);
      const closing = owner.close();
      const closingAgain = owner.close();
      expect(closingAgain).toBe(closing);
      expect(
        (
          await owner.services.preferences.shell.update({
            rotationNoticeDismissed: false,
          })
        ).kind,
      ).toBe("failed");
      if (phase !== "failed-refresh")
        expect(target.closed).not.toHaveBeenCalled();
      release.resolve();
      await Promise.all([restoring, closing, closingAgain]);
      expect(readFileSync(target.database.file)).toEqual(committedBytes);
      expect(restored).toHaveBeenCalledOnce();
      expect(root).toHaveBeenCalledOnce();
      expect(target.closed).toHaveBeenCalledOnce();
      await source.userData.close();
    },
  );

  it("close during barrier acquisition drains accepted work without orphaning acquired barrier", async () => {
    const target = fixture();
    const owner = await createUserPersistenceOwner(target.client);
    const preview = await inspectedEmptyBackup(owner, target);
    const pause = pauseNextWrite(target.userData);
    const accepted =
      owner.services.preferences.storyReadLog.markRead("before-close");
    await pause.entered;
    const restoring = owner.restoreUserData(
      preview.token,
      preview.currentRevision,
      async () => undefined,
    );
    const closing = owner.close();
    pause.release();
    await Promise.all([accepted, restoring, closing]);
    expect(target.closed).toHaveBeenCalledOnce();
  });
});

describe("restore and app approval capability exclusion", () => {
  function updater(
    admission: ReturnType<typeof createApplicationAdmission>,
    prepareServiceWorkerUpdate: () => Promise<() => Promise<void>> = async () =>
      async () =>
        undefined,
  ) {
    const factory = new IDBFactory();
    const candidate = {
      schemaVersion: 1,
      buildId: "build-b",
      coreContentApiVersion: 1,
    } as const;
    const controller = createAppUpdateController({
      admission,
      factory,
      locks: testLocks(),
      currentBuildId: "build-a",
      appBaseUrl: "https://app.test/",
      fetch: async () => new Response(JSON.stringify(candidate)),
      isSessionActive: () => false,
      prepareServiceWorkerUpdate,
    });
    return { controller, factory, candidate };
  }

  it("restore after approval click is rejected at owner capability before raw restore", async () => {
    const target = fixture();
    const admission = createApplicationAdmission();
    const owner = await createUserPersistenceOwner(target.client, admission);
    const entered = Promise.withResolvers<void>();
    const prepared = Promise.withResolvers<() => Promise<void>>();
    const f = updater(admission, async () => {
      entered.resolve();
      return prepared.promise;
    });
    const raw = vi.spyOn(target.userData, "restoreUserData");
    await f.controller.check();
    const approving = f.controller.approve(f.candidate);
    await entered.promise;
    expect(
      await owner.restoreUserData("token", 0, async () => undefined),
    ).toEqual({ kind: "failed", error: { code: "APP_SESSION_ACTIVE" } });
    expect(raw).not.toHaveBeenCalled();
    f.controller.cancel();
    await approving;
    const update = vi.fn(async () => undefined);
    prepared.resolve(update);
    await Promise.resolve();
    expect(await readCoreApproval(f.factory)).toBeNull();
    expect(update).not.toHaveBeenCalled();
    await f.controller.dispose();
    await owner.close();
  });

  it.each(["known", "unknown", "refresh-failed", "failed"] as const)(
    "%s restore blocks updater through barrier, not merely controller UI",
    async (outcome) => {
      const target = fixture();
      const admission = createApplicationAdmission();
      const owner = await createUserPersistenceOwner(target.client, admission);
      const f = updater(admission);
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      vi.spyOn(
        target.client.userData,
        "restoreUserData",
      ).mockImplementationOnce(async () => {
        entered.resolve();
        await release.promise;
        if (outcome === "unknown") return { kind: "restore-outcome-unknown" };
        if (outcome === "failed")
          return { kind: "failed", error: { code: "STORAGE_CONFLICT" } };
        return { kind: "ok", value: { revision: 1 } };
      });
      await f.controller.check();
      const root = vi.fn(async () => {
        if (outcome === "refresh-failed")
          throw new Error("ROOT_REFRESH_FAILED");
      });
      const restoring = owner.restoreUserData("token", 0, root);
      // Owner reserves admission synchronously, even before raw restore starts.
      await f.controller.approve(f.candidate);
      expect(f.controller.view.message).toContain(
        "Finish the active session, restore",
      );
      expect(await readCoreApproval(f.factory)).toBeNull();
      await entered.promise;
      release.resolve();
      await restoring;
      if (outcome === "unknown" || outcome === "refresh-failed") {
        await f.controller.approve(f.candidate);
        expect(await readCoreApproval(f.factory)).toBeNull();
        expect(admission.enter("session")).toBeNull();
        if (outcome === "refresh-failed") {
          root.mockResolvedValueOnce(undefined);
          expect((await owner.refreshAfterRestore()).kind).toBe("ok");
          await f.controller.approve(f.candidate);
          expect(await readCoreApproval(f.factory)).toMatchObject(f.candidate);
        }
      } else {
        await f.controller.approve(f.candidate);
        expect(await readCoreApproval(f.factory)).toMatchObject(f.candidate);
      }
      await f.controller.dispose();
      await owner.close();
    },
  );
});
