// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  JsonUserDataStore,
  type UserJsonBackend,
} from "../../../src/storage/json/user-data-store.ts";
import { userWriteLifecycle } from "../../../src/storage/user-write-lifecycle.ts";
import { createUserPersistenceOwner } from "../../../src/shell/application/user-persistence-owner.ts";
import { createManualContentController } from "../../../src/shell/application/manual-content-controller.ts";
import { DEFAULT_SHELL_SETTINGS } from "../../../src/shell/settings/index.ts";
import type { LocalStorageClient } from "../../../src/storage/index.ts";

async function fixture(authoritative = false) {
  let source: string | null = null;
  let interrupt = false;
  const reachedReply = Promise.withResolvers<void>();
  const releaseReply = Promise.withResolvers<void>();
  const write: UserJsonBackend["write"] = async (next, expected) => {
    if (expected !== source)
      return { kind: "failed", error: { code: "STORAGE_CONFLICT" } };
    source = next;
    return { kind: "ok", value: undefined };
  };
  const backend: UserJsonBackend = {
    read: async () => source,
    write: async (next, expected) => {
      if (!interrupt) return write(next, expected);
      if (!authoritative) await write(next, expected);
      reachedReply.resolve();
      await releaseReply.promise;
      if (authoritative)
        return { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } };
      const error = new Error("Lost write reply and readback unavailable");
      error.name = "UserWriteOutcomeUnknown";
      throw error;
    },
  };
  const userData = new JsonUserDataStore(backend);
  const change = (revision: number | null, dismissed: boolean) =>
    userData.writeUser([
      {
        kind: "put",
        namespace: "preferences",
        key: "shell",
        expectedRevision: revision,
        payload: {
          ...DEFAULT_SHELL_SETTINGS,
          rotationNoticeDismissed: dismissed,
        },
      },
    ]);
  await change(null, true);
  const exported = await userData.exportUserData();
  if (exported.kind !== "ok") throw new Error("Export failed");
  const backup = new File([exported.value], "user-data.json");
  await change(1, false);
  const close = vi.fn(async () => userData.close());
  const client = {
    userData,
    packages: {
      current: async () => ({
        kind: "ok",
        value: { generation: 0, packages: [] },
      }),
    },
    close,
  } as unknown as LocalStorageClient;
  const owner = await createUserPersistenceOwner(client);
  const refreshRoot = vi.fn(async () => {});
  const restore = vi.spyOn(userData, "restoreUserData");
  const controller = createManualContentController({
    storage: client,
    backups: owner,
    isSessionActive: () => false,
    onRestored: refreshRoot,
  });
  await controller.refresh();
  await controller.inspectUserDataBackup(backup);
  interrupt = true;
  return {
    userData,
    client,
    owner,
    controller,
    close,
    refreshRoot,
    restore,
    reachedReply,
    releaseReply,
    reopen: () => new JsonUserDataStore({ read: backend.read, write }),
  };
}

describe("JSON restore with uncertain write outcome", () => {
  it("keeps controller and writes blocked after a durable replacement until reopening", async () => {
    const f = await fixture();
    const lifecycle = userWriteLifecycle(f.userData);
    const confirming = f.controller.confirmRestore();
    await f.reachedReply.promise;
    const observer = f.reopen();
    expect(await observer.readUser("preferences", "shell")).toMatchObject({
      kind: "ok",
      value: { payload: { rotationNoticeDismissed: true } },
    });
    await observer.close();
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
    });
    expect(f.refreshRoot).not.toHaveBeenCalled();
    await f.controller.retry();
    await f.controller.confirmRestore();
    await f.controller.refresh();
    expect(f.restore).toHaveBeenCalledOnce();
    const admitted = vi.fn(async () => {});
    await expect(lifecycle.run(admitted)).rejects.toThrow("STORAGE_CONFLICT");
    expect(admitted).not.toHaveBeenCalled();
    await f.controller.dispose();
    expect(f.controller.view.navigationBlocked).toBe(true);
    const closing = f.owner.close();
    expect(f.owner.close()).toBe(closing);
    await closing;
    expect(f.close).toHaveBeenCalledOnce();
    const store = f.reopen();
    const reopened = await createUserPersistenceOwner({
      ...f.client,
      userData: store,
      close: () => store.close(),
    });
    expect(reopened.failure).toBeNull();
    expect(reopened.hydrated.shell.rotationNoticeDismissed).toBe(true);
    await reopened.close();
  });
  it("drains an in-flight restore on close without reopening admission", async () => {
    const f = await fixture();
    const confirming = f.controller.confirmRestore();
    await f.reachedReply.promise;
    const closing = f.owner.close();
    expect(f.owner.close()).toBe(closing);
    await expect(
      userWriteLifecycle(f.userData).run(async () => {}),
    ).rejects.toThrow("STORAGE_UNAVAILABLE");
    expect(f.close).not.toHaveBeenCalled();
    f.releaseReply.resolve();
    await confirming;
    await closing;
    expect(f.controller.view.navigationBlocked).toBe(true);
    expect(f.close).toHaveBeenCalledOnce();
  });
  it("releases admission after an authoritative failure and preserves current data", async () => {
    const f = await fixture(true);
    const confirming = f.controller.confirmRestore();
    await f.reachedReply.promise;
    f.releaseReply.resolve();
    await confirming;
    expect(f.controller.view).toMatchObject({
      state: { kind: "failed" },
      navigationBlocked: false,
      refreshPending: false,
    });
    expect(await f.userData.readUser("preferences", "shell")).toMatchObject({
      kind: "ok",
      value: { payload: { rotationNoticeDismissed: false } },
    });
    const admitted = vi.fn(async () => {});
    await userWriteLifecycle(f.userData).run(admitted);
    expect(admitted).toHaveBeenCalledOnce();
    expect(f.refreshRoot).not.toHaveBeenCalled();
    await f.owner.close();
  });
});
