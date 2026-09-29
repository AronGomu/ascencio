// @vitest-environment node
import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppUpdateController } from "../../src/shell/application/app-update-controller.ts";
import * as approvalStore from "../../src/shell/application/core-update-approval.ts";
import { readCoreApproval } from "../../src/shell/application/core-update-approval.ts";
import { testLocks } from "../fixtures/application-locks.ts";

const candidate = {
  schemaVersion: 1 as const,
  buildId: "build-b",
  coreContentApiVersion: 2,
};

function response(value: unknown = candidate): Response {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
  });
}

function harness(
  overrides: Partial<Parameters<typeof createAppUpdateController>[0]> = {},
) {
  const factory = new IDBFactory();
  const update = vi.fn(async () => undefined);
  const prepareServiceWorkerUpdate = vi.fn(async () => update);
  const controller = createAppUpdateController({
    factory,
    locks: testLocks(),
    appBaseUrl: "https://app.test/private/",
    currentBuildId: "build-a",
    fetch: vi.fn(async () => response()),
    prepareServiceWorkerUpdate,
    isSessionActive: () => false,
    now: () => 123,
    ...overrides,
  });
  return { controller, factory, prepareServiceWorkerUpdate, update };
}

async function storeNames(factory: IDBFactory): Promise<readonly string[]> {
  return await new Promise((resolve, reject) => {
    const request = factory.open("ygo-app-update-approval");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve([...request.result.objectStoreNames]);
      request.result.close();
    };
  });
}

describe("standalone app update controller", () => {
  it("discovers app metadata and explicitly approves it without installed content or selector state", async () => {
    const f = harness();

    await f.controller.check();
    expect(f.controller.view).toMatchObject({
      phase: "available",
      candidate,
      canApprove: true,
    });
    expect(await readCoreApproval(f.factory)).toBeNull();

    await f.controller.approve(candidate);

    expect(await readCoreApproval(f.factory)).toEqual({
      ...candidate,
      approvedAt: 123,
    });
    expect(await storeNames(f.factory)).toEqual(["approval"]);
    expect(f.prepareServiceWorkerUpdate).toHaveBeenCalledOnce();
    expect(f.update).toHaveBeenCalledOnce();
    expect(f.controller.view.phase).toBe("approved");
  });

  it("rejects invalid discovery without approval or update", async () => {
    const f = harness({ fetch: vi.fn(async () => response({ buildId: "x" })) });

    await f.controller.check();

    expect(f.controller.view).toMatchObject({
      phase: "failed",
      canApprove: false,
      candidate: null,
    });
    expect(await readCoreApproval(f.factory)).toBeNull();
    expect(f.prepareServiceWorkerUpdate).not.toHaveBeenCalled();
  });

  it("cancels discovery without approval or update", async () => {
    const fetch = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const f = harness({ fetch });

    const checking = f.controller.check();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    f.controller.cancel();
    await checking;

    expect(f.controller.view).toMatchObject({
      phase: "idle",
      canApprove: false,
      candidate: null,
    });
    expect(await readCoreApproval(f.factory)).toBeNull();
    expect(f.prepareServiceWorkerUpdate).not.toHaveBeenCalled();
  });

  it("blocks approval while an app session is active", async () => {
    let active = false;
    const f = harness({ isSessionActive: () => active });
    await f.controller.check();
    active = true;

    await f.controller.approve(candidate);

    expect(f.controller.view).toMatchObject({
      phase: "failed",
      message: "Return to Main Menu before approving an app update.",
    });
    expect(await readCoreApproval(f.factory)).toBeNull();
    expect(f.prepareServiceWorkerUpdate).not.toHaveBeenCalled();
  });

  it("leaves approval empty when service worker updates are unavailable", async () => {
    const f = harness({
      prepareServiceWorkerUpdate: vi.fn(async () => {
        throw new Error("CORE_UPDATE_UNAVAILABLE");
      }),
    });
    await f.controller.check();

    await f.controller.approve(candidate);

    expect(f.controller.view).toMatchObject({
      phase: "failed",
      message: "App updates are unavailable in this browser.",
    });
    expect(await readCoreApproval(f.factory)).toBeNull();
  });

  it("keeps an explicit durable approval but reports a registration update failure", async () => {
    const update = vi.fn(async () => {
      throw new Error("network failed");
    });
    const f = harness({
      prepareServiceWorkerUpdate: vi.fn(async () => update),
    });
    await f.controller.check();

    await f.controller.approve(candidate);

    expect(await readCoreApproval(f.factory)).toMatchObject(candidate);
    expect(f.controller.view).toMatchObject({
      phase: "failed",
      message:
        "App update request failed. Approved build remains pending; retry from this screen.",
    });
  });
});

afterEach(() => vi.restoreAllMocks());

describe("approval lifecycle", () => {
  it.each(["cancel", "check", "dispose"] as const)(
    "%s during preparation prevents consent and update",
    async (action) => {
      const preparing = Promise.withResolvers<() => Promise<void>>();
      const entered = Promise.withResolvers<void>();
      const f = harness({
        prepareServiceWorkerUpdate: async () => {
          entered.resolve();
          return preparing.promise;
        },
      });
      await f.controller.check();
      const task = f.controller.approve(candidate);
      await entered.promise;
      const invalidation = f.controller[action]();
      preparing.resolve(f.update);
      await Promise.all([task, invalidation]);
      expect(await readCoreApproval(f.factory)).toBeNull();
      expect(f.update).not.toHaveBeenCalled();
    },
  );

  it("cancel from approving subscriber cannot start preparation or write", async () => {
    const f = harness();
    await f.controller.check();
    f.controller.subscribe((view) => {
      if (view.phase === "approving") f.controller.cancel();
    });
    await f.controller.approve(candidate);
    expect(await readCoreApproval(f.factory)).toBeNull();
    expect(f.prepareServiceWorkerUpdate).not.toHaveBeenCalled();
  });

  it("commit cannot claim cancellation, supersede candidate, or outlive disposal", async () => {
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const original = approvalStore.writeCoreApproval;
    vi.spyOn(approvalStore, "writeCoreApproval").mockImplementation(
      async (...args) => {
        entered.resolve();
        await release.promise;
        return original(...args);
      },
    );
    const f = harness();
    await f.controller.check();
    const task = f.controller.approve(candidate);
    await entered.promise;
    f.controller.cancel();
    await f.controller.check();
    expect(f.controller.view.phase).toBe("committing");
    let disposed = false;
    const disposal = Promise.resolve(f.controller.dispose()).then(() => {
      disposed = true;
    });
    await Promise.resolve();
    expect(disposed).toBe(false);
    release.resolve();
    await Promise.all([task, disposal]);
    expect(await readCoreApproval(f.factory)).toMatchObject(candidate);
    expect(f.update).toHaveBeenCalledOnce();
  });

  it("holds lifecycle Web Lock through registration.update settlement", async () => {
    const locks = testLocks();
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const f = harness({
      locks,
      prepareServiceWorkerUpdate: async () => async () => {
        entered.resolve();
        await release.promise;
      },
    });
    await f.controller.check();
    const task = f.controller.approve(candidate);
    await entered.promise;
    await locks.request(
      "ygo-application-lifecycle-v1",
      { mode: "exclusive", ifAvailable: true },
      (lock) => {
        expect(lock).toBeNull();
      },
    );
    release.resolve();
    await task;
  });

  it("rejects superseded candidate without approving the newly checked build", async () => {
    let next = candidate;
    const f = harness({ fetch: async () => response(next) });
    await f.controller.check();
    next = { ...candidate, buildId: "build-c" };
    await f.controller.check();
    await f.controller.approve(candidate);
    expect(await readCoreApproval(f.factory)).toBeNull();
    expect(f.update).not.toHaveBeenCalled();
    expect(f.controller.view.phase).toBe("failed");
  });
});

describe("approval timing and failures", () => {
  it("cancellation before lock callback prevents preparation and durable consent", async () => {
    const release = Promise.withResolvers<void>();
    const locks = testLocks();
    const delayedLocks = {
      request: async (
        name: string,
        options: LockOptions,
        callback: LockGrantedCallback<unknown>,
      ) => {
        await release.promise;
        return locks.request(name, options, callback);
      },
    } as LockManager;
    const f = harness({ locks: delayedLocks });
    await f.controller.check();
    const task = f.controller.approve(candidate);
    f.controller.cancel();
    release.resolve();
    await task;
    expect(f.prepareServiceWorkerUpdate).not.toHaveBeenCalled();
    expect(await readCoreApproval(f.factory)).toBeNull();
  });

  it("rechecks session after prepare before starting consent", async () => {
    let active = false;
    const f = harness({
      isSessionActive: () => active,
      prepareServiceWorkerUpdate: async () => {
        active = true;
        return async () => {
          throw new Error("must not update");
        };
      },
    });
    await f.controller.check();
    await f.controller.approve(candidate);
    expect(await readCoreApproval(f.factory)).toBeNull();
    expect(f.controller.view.message).toBe(
      "Return to Main Menu before approving an app update.",
    );
  });

  it.each(["check", "dispose"] as const)(
    "reentrant %s sees installed approval task before notification",
    async (action) => {
      const f = harness();
      await f.controller.check();
      let nested: Promise<void> | undefined;
      f.controller.subscribe((view) => {
        if (view.phase === "approving") nested = f.controller[action]();
      });
      const task = f.controller.approve(candidate);
      await Promise.all([task, nested]);
      expect(await readCoreApproval(f.factory)).toBeNull();
      expect(f.prepareServiceWorkerUpdate).not.toHaveBeenCalled();
    },
  );

  it("reports failed consent write, releases admission, never requests update", async () => {
    vi.spyOn(approvalStore, "writeCoreApproval").mockRejectedValueOnce(
      new Error("APP_STORAGE_UNAVAILABLE"),
    );
    const f = harness();
    await f.controller.check();
    await f.controller.approve(candidate);
    expect(f.controller.view.message).toBe(
      "App update approval could not be saved. No update was requested.",
    );
    expect(f.update).not.toHaveBeenCalled();
    expect(await readCoreApproval(f.factory)).toBeNull();
    await f.controller.approve(candidate);
    expect(f.update).toHaveBeenCalledOnce();
  });

  it("never describes previously durable consent as cancelled after a request failure", async () => {
    const f = harness({
      prepareServiceWorkerUpdate: async () => async () => {
        throw new Error("network failed");
      },
    });
    await f.controller.check();
    await f.controller.approve(candidate);
    f.controller.cancel();
    expect(f.controller.view.message).toContain(
      "Previously approved build remains pending",
    );
    expect(await readCoreApproval(f.factory)).toMatchObject(candidate);
  });

  it("disposal from committing notification waits for update failure and preserves visible pending consent", async () => {
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const f = harness({
      prepareServiceWorkerUpdate: async () => async () => {
        entered.resolve();
        await release.promise;
        throw new Error("network failed");
      },
    });
    await f.controller.check();
    let disposal: Promise<void> | undefined;
    f.controller.subscribe((view) => {
      if (view.phase === "committing") disposal = f.controller.dispose();
    });
    const task = f.controller.approve(candidate);
    await entered.promise;
    let settled = false;
    void disposal!.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    release.resolve();
    await Promise.all([task, disposal]);
    expect(f.controller.view.phase).toBe("failed");
    expect(f.controller.view.message).toContain(
      "Approved build remains pending",
    );
    expect(await readCoreApproval(f.factory)).toMatchObject(candidate);
  });
});

it("precommit disposal drains preparation even after cancellation releases lifecycle lock", async () => {
  const prepared = Promise.withResolvers<() => Promise<void>>();
  const entered = Promise.withResolvers<void>();
  const locks = testLocks();
  const f = harness({
    locks,
    prepareServiceWorkerUpdate: async () => {
      entered.resolve();
      return prepared.promise;
    },
  });
  await f.controller.check();
  const approving = f.controller.approve(candidate);
  await entered.promise;
  const disposal = f.controller.dispose();
  let disposed = false;
  void disposal.then(() => {
    disposed = true;
  });
  await approving;
  expect(disposed).toBe(false);
  await locks.request(
    "ygo-application-lifecycle-v1",
    { mode: "exclusive", ifAvailable: true },
    (lock) => {
      expect(lock).not.toBeNull();
    },
  );
  prepared.resolve(f.update);
  await disposal;
  expect(await readCoreApproval(f.factory)).toBeNull();
  expect(f.update).not.toHaveBeenCalled();
});
