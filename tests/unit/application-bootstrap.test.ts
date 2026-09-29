// @vitest-environment node
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSqliteApplicationService: vi.fn(),
  openUserPersistence: vi.fn(),
  prepareServiceWorkerUpdate: vi.fn(),
}));

vi.mock("../../src/shell/application/sqlite-application-service.ts", () => ({
  createSqliteApplicationService: mocks.createSqliteApplicationService,
}));
vi.mock("../../src/shell/application/user-persistence-owner.ts", () => ({
  openUserPersistence: mocks.openUserPersistence,
}));
vi.mock("../../src/shell/pwa/register-service-worker.ts", () => ({
  prepareServiceWorkerUpdate: mocks.prepareServiceWorkerUpdate,
}));

import { testLocks } from "../fixtures/application-locks.ts";
import type { ApplicationAdmission } from "../../src/shell/application/application-admission.ts";
import { bootstrapApplication } from "../../src/shell/application/application-bootstrap.ts";

describe("SQLite application bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("__APP_BUILD_ID__", "build-a");
  });

  it("composes the actual standalone app updater when no content package is installed", async () => {
    const factory = new IDBFactory();
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            buildId: "build-b",
            coreContentApiVersion: 1,
          }),
        ),
    );
    const close = vi.fn(async () => undefined);
    const userPersistence = {
      storage: {},
      services: {},
      flush: vi.fn(),
      close,
    };
    const service = {
      application: {},
      status: { warnings: [] },
      readiness: vi.fn(async () => ({
        generation: 0,
        freeplay: false,
        deckBuilder: false,
        newGame: false,
        missing: ["duel-core", "card-library", "freeplay", "chapter-01"],
      })),
      sessionActive: vi.fn(() => false),
      subscribeStatus: vi.fn(),
      dispose: vi.fn(async () => undefined),
    };
    mocks.openUserPersistence.mockResolvedValue(userPersistence);
    mocks.createSqliteApplicationService.mockReturnValue(service);

    const startup = await bootstrapApplication(
      fetch,
      "https://app.test/private/",
      factory,
    );

    expect(startup.gate).toEqual({
      kind: "locked",
      reason: "content-required",
      missing: ["duel-core", "card-library", "freeplay"],
    });
    expect(startup.appUpdates?.view.phase).toBe("idle");
    expect(fetch).not.toHaveBeenCalled();

    await startup.appUpdates?.check();

    expect(fetch).toHaveBeenCalledWith(
      "https://app.test/private/core-release.json",
      expect.objectContaining({ cache: "no-store", signal: expect.anything() }),
    );
    expect(startup.appUpdates?.view).toMatchObject({
      phase: "available",
      candidate: {
        buildId: "build-b",
        coreContentApiVersion: 1,
      },
    });
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("root approval teardown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("__APP_BUILD_ID__", "build-a");
    vi.stubGlobal("navigator", { locks: testLocks() });
  });

  it.each(["ready", "degraded", "update-failed"] as const)(
    "%s root awaits committed approval/update before closing storage",
    async (mode) => {
      const candidate = {
        schemaVersion: 1,
        buildId: "build-b",
        coreContentApiVersion: 1,
      } as const;
      const entered = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const close = vi.fn(async () => undefined);
      mocks.openUserPersistence.mockResolvedValue({
        storage: mode === "degraded" ? null : {},
        services: {},
        flush: vi.fn(),
        close,
      });
      const service = {
        application: {},
        status: {},
        sessionActive: () => false,
        subscribeStatus: vi.fn(),
        readiness: async () => ({
          generation: 0,
          freeplay: false,
          missing: ["duel-core"],
        }),
        dispose: vi.fn(async () => undefined),
      };
      mocks.createSqliteApplicationService.mockReturnValue(service);
      mocks.prepareServiceWorkerUpdate.mockResolvedValue(async () => {
        entered.resolve();
        await release.promise;
        if (mode === "update-failed") throw new Error("network failed");
      });
      const startup = await bootstrapApplication(
        async () => new Response(JSON.stringify(candidate)),
        "https://app.test/",
        new IDBFactory(),
      );
      const admission = mocks.openUserPersistence.mock
        .calls[0]![0] as ApplicationAdmission;
      if (mode !== "degraded")
        expect(
          mocks.createSqliteApplicationService.mock.calls[0]![0].admission,
        ).toBe(admission);
      await startup.appUpdates!.check();
      const approving = startup.appUpdates!.approve(candidate);
      await entered.promise;
      const disposal = startup.dispose!();
      let settled = false;
      void disposal.then(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(false);
      expect(close).not.toHaveBeenCalled();
      expect(service.dispose).not.toHaveBeenCalled();
      expect(admission.enter("session")).toBeNull();
      expect(admission.enter("restore")).toBeNull();
      release.resolve();
      await Promise.all([approving, disposal]);
      expect(close).toHaveBeenCalledOnce();
      expect(startup.appUpdates!.view.phase).toBe(
        mode === "update-failed" ? "failed" : "approved",
      );
    },
  );
});
