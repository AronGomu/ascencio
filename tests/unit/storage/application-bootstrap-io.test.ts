import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as StorageApi from "../../../src/storage/index.ts";
import { bootstrapApplication } from "../../../src/shell/application/application-bootstrap.ts";

const mocks = vi.hoisted(() => ({
  ready: vi.fn(),
  marker: vi.fn(),
  open: vi.fn(),
  dispose: vi.fn(),
  close: vi.fn(),
  prepare: vi.fn(),
}));
vi.mock("../../../src/storage/index.ts", async (original) => ({
  ...(await original<typeof StorageApi>()),
  nativeIoTrace: { markReady: mocks.marker },
}));
vi.mock("../../../src/shell/application/prepare-application-inputs.ts", () => ({
  prepareApplicationInputs: mocks.prepare,
}));

function preparedFixture() {
  return {
    requirements: [
      "domain-projections",
      "engine-preparation",
      "screen-modules",
    ],
    freeplay: {},
    stories: new Map(),
    close() {},
  };
}
vi.mock("../../../src/shell/application/user-persistence-owner.ts", () => ({
  openUserPersistence: mocks.open,
}));
vi.mock("../../../src/shell/application/sqlite-application-service.ts", () => ({
  createSqliteApplicationService: () => ({
    readiness: mocks.ready,
    dispose: mocks.dispose,
    application: {},
    status: { warnings: [] },
    subscribeStatus: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prepare.mockImplementation(
    async (_storage, _users, _signal, progress) => {
      progress?.(6, 6);
      return preparedFixture();
    },
  );
  mocks.open.mockResolvedValue({
    storage: {
      preparedRequirements: [
        "critical-content",
        "user-state",
        "mod-composition",
      ],
    },
    services: {},
    close: mocks.close,
  });
  mocks.ready.mockResolvedValue({ generation: 1, freeplay: true, missing: [] });
  mocks.marker.mockResolvedValue(undefined);
});

describe("current startup telemetry boundary", () => {
  it("records menu readiness after package readiness resolves", async () => {
    const ready = Promise.withResolvers<{
      generation: number;
      freeplay: boolean;
      missing: string[];
    }>();
    mocks.ready.mockReturnValueOnce(ready.promise);
    const progress = vi.fn();
    const startup = bootstrapApplication(undefined, progress);
    await vi.waitFor(() => expect(mocks.ready).toHaveBeenCalledOnce());
    expect(mocks.marker).not.toHaveBeenCalled();
    expect(progress).toHaveBeenLastCalledWith(6, 7);
    ready.resolve({ generation: 1, freeplay: true, missing: [] });
    expect((await startup).gate.kind).toBe("ready");
    expect(mocks.marker).toHaveBeenCalledOnce();
    expect(progress).toHaveBeenLastCalledWith(7, 7);
  });

  it("does not emit a menu marker when content is missing or invalid", async () => {
    mocks.ready.mockResolvedValueOnce({
      generation: 1,
      freeplay: false,
      missing: ["duel-core"],
    });
    expect((await bootstrapApplication()).gate.kind).toBe("locked");
    mocks.ready.mockRejectedValueOnce(new Error("PACKAGE_INVALID"));
    await expect(bootstrapApplication()).rejects.toThrow("PACKAGE_INVALID");
    expect(mocks.marker).not.toHaveBeenCalled();
  });

  it("does not emit a menu marker when native user storage cannot open", async () => {
    mocks.open.mockResolvedValueOnce({ storage: null, close: mocks.close });
    expect((await bootstrapApplication()).gate.kind).toBe("locked");
    expect(mocks.marker).not.toHaveBeenCalled();
  });
});
