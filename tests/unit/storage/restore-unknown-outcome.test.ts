import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openLocalStorage } from "../../../src/storage/create-storage-client.ts";
import { userWriteLifecycle } from "../../../src/storage/user-write-lifecycle.ts";
import { StorageRpcDispatcher } from "../../../src/storage/runtime/rpc-dispatch.ts";
import type { RpcRequest } from "../../../src/storage/contracts/rpc.ts";
import { AtomicPackageRuntime } from "../../../src/storage/runtime/atomic-package-runtime.ts";
import { UserDataRuntime } from "../../../src/storage/runtime/user-data-runtime.ts";
import { createUserPersistenceOwner } from "../../../src/shell/application/user-persistence-owner.ts";
import { createManualContentController } from "../../../src/shell/application/manual-content-controller.ts";
import { DEFAULT_SHELL_SETTINGS } from "../../../src/shell/settings/index.ts";
import { createUserDataFixture } from "./sqlite-fixtures.ts";
import { createRuntimeFixture, databaseAdapter } from "./runtime-fixtures.ts";

// Real Node SQLite + dispatcher + browser facade; no browser/importer UI harness.
async function fixture(
  interruption: "error" | "messageerror" | "authoritative",
) {
  const packages = createRuntimeFixture();
  const runtime = new AtomicPackageRuntime({
    ...packages,
    now: () => "2026-09-24T12:00:00.000Z",
    randomId: () => crypto.randomUUID(),
  });
  const database = createUserDataFixture();
  const userData = new UserDataRuntime({
    database: databaseAdapter(database.database),
    files: packages.files,
    randomId: () => crypto.randomUUID(),
  });
  await userData.writeUser([
    {
      kind: "put",
      namespace: "preferences",
      key: "shell",
      expectedRevision: null,
      payload: { ...DEFAULT_SHELL_SETTINGS, rotationNoticeDismissed: true },
    },
  ]);
  const exported = await userData.exportUserData();
  if (exported.kind !== "ok") throw new Error("export failed");
  const backup = new File(
    [await exported.value.arrayBuffer()],
    "user-data.sqlite",
  );
  await userData.writeUser([
    {
      kind: "put",
      namespace: "preferences",
      key: "shell",
      expectedRevision: 1,
      payload: { ...DEFAULT_SHELL_SETTINGS, rotationNoticeDismissed: false },
    },
  ]);
  const reachedReply = Promise.withResolvers<void>();
  const releaseReply = Promise.withResolvers<void>();
  class WorkerBridge extends EventTarget {
    terminated = 0;
    readonly sent: RpcRequest[] = [];
    readonly dispatcher = new StorageRpcDispatcher(
      runtime,
      (response) => {
        const request = this.sent.find((entry) => entry.id === response.id)!;
        if (request.method === "restoreUserData") {
          reachedReply.resolve();
          void releaseReply.promise.then(() => {
            if (interruption === "authoritative") this.message(response);
            else this.dispatchEvent(new Event(interruption));
          });
        } else this.message(response);
      },
      userData,
    );
    postMessage(value: unknown): void {
      const request = value as RpcRequest;
      this.sent.push(request);
      queueMicrotask(() => {
        void this.dispatcher.dispatch(request);
      });
    }
    message(value: unknown): void {
      this.dispatchEvent(new MessageEvent("message", { data: value }));
    }
    terminate(): void {
      this.terminated += 1;
    }
  }
  const worker = new WorkerBridge();
  vi.stubGlobal(
    "Worker",
    class {
      constructor() {
        return worker;
      }
    },
  );
  vi.stubGlobal("navigator", { storage: {}, locks: {} });
  const opened = await openLocalStorage();
  if (opened.kind !== "ok") throw new Error("open failed");
  const owner = await createUserPersistenceOwner(opened.value);
  const refreshRoot = vi.fn(async () => {});
  const restore = vi.spyOn(opened.value.userData, "restoreUserData");
  const refresh = vi.fn(() => owner.refreshAfterRestore());
  const clientClose = vi.spyOn(opened.value, "close");
  const controller = createManualContentController({
    storage: opened.value,
    backups: { ...owner, refreshAfterRestore: refresh },
    isSessionActive: () => false,
    onRestored: refreshRoot,
  });
  await controller.refresh();
  await controller.inspectUserDataBackup(backup);
  return {
    database,
    userData,
    runtime,
    owner,
    controller,
    worker,
    restore,
    refresh,
    clientClose,
    refreshRoot,
    reachedReply,
    releaseReply,
    backup,
    client: opened.value,
  };
}

describe("restore unknown transport outcome", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(["error", "messageerror"] as const)(
    "real commit then %s keeps barrier/controller locked until close; reopen hydrates durable replacement",
    async (event) => {
      const f = await fixture(event);
      const admitted = vi.fn(async () => undefined);
      const lifecycle = userWriteLifecycle(f.client.userData);
      const acquireBarrier = lifecycle.acquireBarrier.bind(lifecycle);
      const release = vi.fn();
      vi.spyOn(lifecycle, "acquireBarrier").mockImplementation(async () => {
        const result = await acquireBarrier();
        if (result.kind !== "ok") return result;
        release.mockImplementation(() => result.value.release());
        return { kind: "ok", value: { release } };
      });
      const confirming = f.controller.confirmRestore();
      await f.reachedReply.promise;
      expect(await f.userData.readUser("preferences", "shell")).toMatchObject({
        kind: "ok",
        value: { payload: { rotationNoticeDismissed: true } },
      });
      expect(f.owner.hydrated.shell.rotationNoticeDismissed).toBe(false);
      f.releaseReply.resolve();
      await confirming;
      expect(await f.restore.mock.results[0]!.value).toEqual({
        kind: "restore-outcome-unknown",
      });
      expect(f.controller.view).toMatchObject({
        state: { kind: "restore-outcome-unknown" },
        busy: false,
        navigationBlocked: true,
        refreshPending: false,
        message:
          "Restore outcome unknown. User data may have been replaced. Close and reopen this app to inspect your data before making changes. Do not restore again. If the browser warns about leaving, choose to leave.",
      });
      expect(f.refreshRoot).not.toHaveBeenCalled();
      const sent = f.worker.sent.length;
      f.controller.cancelRestore();
      await f.controller.refresh();
      await f.controller.retry();
      await f.controller.confirmRestore();
      await f.controller.inspectUserDataBackup(f.backup);
      expect(await f.controller.exportUserData()).toBeNull();
      // Screen unmount/remount only unsubscribes/subscribes this root-owned controller.
      const unsubscribe = f.controller.subscribe(() => {});
      unsubscribe();
      const remounted = vi.fn();
      f.controller.subscribe(remounted);
      await f.controller.refresh();
      expect(remounted).toHaveBeenLastCalledWith(
        expect.objectContaining({ navigationBlocked: true }),
      );
      await f.controller.dispose();
      expect(f.controller.view.navigationBlocked).toBe(true);
      expect(await f.owner.refreshAfterRestore()).toMatchObject({
        kind: "failed",
      });
      expect(
        await f.owner.restoreUserData("unused", 0, f.refreshRoot),
      ).toMatchObject({ kind: "failed" });
      await expect(lifecycle.run(admitted)).rejects.toThrow("STORAGE_CONFLICT");
      expect(admitted).not.toHaveBeenCalled();
      expect(f.restore).toHaveBeenCalledOnce();
      expect(f.refresh).not.toHaveBeenCalled();
      expect(f.worker.sent).toHaveLength(sent);
      expect(release).not.toHaveBeenCalled();
      const closing = f.owner.close();
      expect(f.owner.close()).toBe(closing);
      await expect(lifecycle.run(admitted)).rejects.toThrow(
        "STORAGE_UNAVAILABLE",
      );
      // Existing client-close contract preserves transport failure, but always terminates.
      await expect(closing).rejects.toThrow("STORAGE_UNAVAILABLE");
      await expect(f.owner.close()).rejects.toThrow("STORAGE_UNAVAILABLE");
      expect(release).toHaveBeenCalledOnce();
      expect(f.clientClose).toHaveBeenCalledOnce();
      expect(f.worker.terminated).toBe(1);
      await f.userData.close();
      f.runtime.close();

      const reopenedDb = new DatabaseSync(f.database.file);
      const reopenedStore = new UserDataRuntime({
        database: databaseAdapter(reopenedDb),
        files: createRuntimeFixture().files,
        randomId: () => crypto.randomUUID(),
      });
      const repeat = vi.spyOn(reopenedStore, "restoreUserData");
      const mutation = vi.spyOn(reopenedStore, "writeUser");
      const reopened = await createUserPersistenceOwner({
        ...f.client,
        userData: reopenedStore,
        close: () => reopenedStore.close(),
      });
      expect(reopened.failure).toBeNull();
      expect(reopened.hydrated.shell.rotationNoticeDismissed).toBe(true);
      expect(repeat).not.toHaveBeenCalled();
      expect(mutation).not.toHaveBeenCalled();
      await reopened.close();
    },
  );

  it("close during in-flight restore drains unknown settlement once without reopening admission", async () => {
    const f = await fixture("error");
    const confirming = f.controller.confirmRestore();
    await f.reachedReply.promise;
    const closing = f.owner.close();
    const rejectedClose = expect(closing).rejects.toThrow(
      "STORAGE_UNAVAILABLE",
    );
    expect(f.owner.close()).toBe(closing);
    await expect(
      userWriteLifecycle(f.client.userData).run(async () => {}),
    ).rejects.toThrow("STORAGE_UNAVAILABLE");
    expect(f.clientClose).not.toHaveBeenCalled();
    f.releaseReply.resolve();
    await confirming;
    await rejectedClose;
    expect(f.controller.view.navigationBlocked).toBe(true);
    expect(f.clientClose).toHaveBeenCalledOnce();
    expect(f.worker.terminated).toBe(1);
    await f.userData.close();
    f.runtime.close();
  });

  it("authoritative restore failure releases barrier and truthfully preserves data", async () => {
    const f = await fixture("authoritative");
    vi.spyOn(f.userData, "restoreUserData").mockResolvedValueOnce({
      kind: "failed",
      error: { code: "STORAGE_UNAVAILABLE" },
    });
    const confirming = f.controller.confirmRestore();
    await f.reachedReply.promise;
    f.releaseReply.resolve();
    await confirming;
    expect(f.controller.view).toMatchObject({
      state: { kind: "failed" },
      navigationBlocked: false,
      refreshPending: false,
      message:
        "Browser storage is unavailable. Existing data remains untouched. Retry.",
    });
    expect(await f.userData.readUser("preferences", "shell")).toMatchObject({
      kind: "ok",
      value: { payload: { rotationNoticeDismissed: false } },
    });
    const admitted = vi.fn(async () => undefined);
    await userWriteLifecycle(f.client.userData).run(admitted);
    expect(admitted).toHaveBeenCalledOnce();
    expect(f.refreshRoot).not.toHaveBeenCalled();
    await f.owner.close();
    expect(f.worker.terminated).toBe(1);
  });
});
