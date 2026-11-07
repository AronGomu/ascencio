import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../src/shell/application/prepare-application-inputs.ts", () => ({
  prepareApplicationInputs: async () => ({
    requirements: [
      "domain-projections",
      "engine-preparation",
      "screen-modules",
    ],
    freeplay: {},
    stories: new Map(),
    close: () => {},
  }),
}));
const mocks = vi.hoisted(() => ({ service: vi.fn(), users: vi.fn() }));
vi.mock("../../src/shell/application/sqlite-application-service.ts", () => ({
  createSqliteApplicationService: mocks.service,
}));
vi.mock("../../src/shell/application/user-persistence-owner.ts", () => ({
  openUserPersistence: mocks.users,
}));
import { bootstrapApplication } from "../../src/shell/application/application-bootstrap.ts";
beforeEach(() => vi.clearAllMocks());
describe("native application bootstrap", () => {
  it("loads installed content and drains sessions before closing user persistence", async () => {
    const order: string[] = [];
    const close = vi.fn(async () => {
      order.push("users");
    });
    mocks.users.mockResolvedValue({
      storage: {
        preparedRequirements: [
          "critical-content",
          "user-state",
          "mod-composition",
        ],
      },
      services: {},
      close,
      flush: vi.fn(),
    });
    const service = {
      application: {},
      status: { warnings: [] },
      subscribeStatus: vi.fn(),
      readiness: async () => ({ generation: 1, freeplay: true, missing: [] }),
      dispose: vi.fn(async () => {
        order.push("sessions");
      }),
    };
    mocks.service.mockReturnValue(service);
    const startup = await bootstrapApplication();
    expect(startup.gate).toEqual({ kind: "ready", generation: 1, missing: [] });
    expect(startup.application).toBe(service.application);
    const admission = mocks.users.mock.calls[0]![0];
    expect(mocks.service.mock.calls[0]![0].admission).toBe(admission);
    await startup.dispose!();
    expect(order).toEqual(["sessions", "users"]);
    expect(admission.enter("session")).toBeNull();
  });
  it("reports native storage failure without composing a content service", async () => {
    const close = vi.fn(async () => {});
    mocks.users.mockResolvedValue({ storage: null, close });
    const startup = await bootstrapApplication();
    expect(startup.gate).toEqual({
      kind: "locked",
      reason: "storage-unavailable",
    });
    expect(mocks.service).not.toHaveBeenCalled();
    await startup.dispose!();
    expect(close).toHaveBeenCalledOnce();
  });
  it("keeps content controls available when default modules are absent", async () => {
    mocks.users.mockResolvedValue({
      storage: {
        preparedRequirements: [
          "critical-content",
          "user-state",
          "mod-composition",
        ],
      },
      services: {},
      close: vi.fn(),
      flush: vi.fn(),
    });
    const application = {};
    mocks.service.mockReturnValue({
      application,
      status: { warnings: [] },
      subscribeStatus: vi.fn(),
      dispose: vi.fn(),
      readiness: async () => ({
        generation: 0,
        freeplay: false,
        missing: ["duel-core", "card-library", "freeplay", "chapter-01"],
      }),
    });
    const startup = await bootstrapApplication();
    expect(startup.gate).toEqual({
      kind: "locked",
      reason: "content-required",
      missing: ["duel-core", "card-library", "freeplay"],
    });
    expect(startup.application).toBe(application);
    await startup.dispose!();
  });
});
