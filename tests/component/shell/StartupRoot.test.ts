// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import StartupRoot from "../../../src/shell/startup/StartupRoot.svelte";
import type * as StorageApi from "../../../src/storage/index.ts";
const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  close: vi.fn(),
  flush: vi.fn(),
  coreClose: vi.fn(),
  coreLoad: vi.fn(),
  invoke: vi.fn(),
  clipboard: vi.fn(),
}));
vi.mock("../../../src/storage/index.ts", async (original) => ({
  ...(await original<typeof StorageApi>()),
  prepareNativeStorage: mocks.prepare,
  closePreparedNativeStorage: mocks.close,
  flushPreparedNativeStorage: mocks.flush,
  invokeNative: mocks.invoke,
}));
vi.mock("../../../src/shell/native/content.ts", () => ({
  isNativeApp: () => true,
}));
vi.mock("../../../src/shell/application/core-startup.ts", () => ({
  loadCoreStartup: mocks.coreLoad,
  closeCoreStartup: mocks.coreClose,
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ onCloseRequested: async () => () => {} }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: mocks.clipboard },
  });
  mocks.clipboard.mockResolvedValue(undefined);
  mocks.prepare.mockRejectedValue(
    "USER_DATA_INVALID: user-data.json: expected value at line 2 column 4",
  );
  mocks.invoke.mockImplementation(
    async (command: string, args?: { diagnostic: unknown }) => {
      if (
        command === "native_startup_log_status" ||
        command === "native_startup_log_record"
      )
        return {
          sessionId: "test",
          path: "/fixture/log.jsonl",
          loggingError: null,
          diagnostics: args ? [args.diagnostic] : [],
          droppedDiagnostics: 0,
        };
    },
  );
});
afterEach(cleanup);
it("shows only the agreed error summary and four ordered actions before admission", async () => {
  const view = render(StartupRoot);
  await waitFor(() =>
    expect(view.getByText("Saved data could not be loaded")).toBeTruthy(),
  );
  expect(view.getByRole("heading", { level: 1 }).textContent).toBe(
    "Application could not start",
  );
  expect(view.getByRole("heading", { level: 2 }).textContent).toBe(
    "Saved data could not be loaded",
  );
  expect(
    view.getByText(
      "USER_DATA_INVALID: user-data.json: expected value at line 2 column 4",
    ),
  ).toBeTruthy();
  expect(
    [...view.container.querySelectorAll("button")].map((b) =>
      b.textContent?.trim(),
    ),
  ).toEqual(["Restore", "Open Log", "Copy Error", "Close"]);
  expect(
    (view.getByRole("button", { name: "Restore" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    view.container.querySelector("ol, pre, [data-cy=main-menu-screen]"),
  ).toBeNull();
  expect(view.queryByRole("progressbar")).toBeNull();
  await waitFor(() =>
    expect(document.activeElement).toBe(
      view.getByRole("heading", { level: 1 }),
    ),
  );
  await fireEvent.click(view.getByRole("button", { name: "Open Log" }));
  expect(mocks.invoke).toHaveBeenCalledWith("native_startup_log_open", {
    folder: false,
  });
});
it("keeps all Lua source locations and independent diagnostics in Copy Error", async () => {
  mocks.prepare.mockRejectedValue({
    diagnostics: [
      {
        code: "MOD_LUA_SYNTAX",
        severity: "error",
        phase: "mod-composition",
        message: "Invalid Lua",
        source: { file: "broken.lua", modId: "fixture", line: 2 },
        notes: [],
        causes: [],
        remediation: "Correct Lua",
      },
      {
        code: "MOD_JSON_SYNTAX",
        severity: "error",
        phase: "mod-composition",
        message: "Invalid JSON",
        source: { file: "mod.json", line: 3, column: 5 },
        notes: [],
        causes: [],
        remediation: "Correct JSON",
      },
    ],
  });
  const view = render(StartupRoot);
  await waitFor(() =>
    expect(view.getByText("Mod could not be loaded")).toBeTruthy(),
  );
  expect(view.getByText("Invalid Lua")).toBeTruthy();
  expect(view.queryByText("Invalid JSON")).toBeNull();
  await fireEvent.click(view.getByRole("button", { name: "Copy Error" }));
  const copied = JSON.parse(mocks.clipboard.mock.calls[0]![0]);
  expect(copied.diagnostics).toHaveLength(2);
  expect(copied.diagnostics[0].source).toEqual({
    file: "broken.lua",
    modId: "fixture",
    line: 2,
  });
  expect(copied.diagnostics[1].source).toEqual({
    file: "mod.json",
    line: 3,
    column: 5,
  });
});
it("keeps the original error copyable when disk logging fails", async () => {
  mocks.invoke.mockRejectedValue(new Error("LOG_DENIED"));
  const view = render(StartupRoot);
  await waitFor(() =>
    expect(view.getByText("Saved data could not be loaded")).toBeTruthy(),
  );
  expect(
    (view.getByRole("button", { name: "Open Log" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await fireEvent.click(view.getByRole("button", { name: "Copy Error" }));
  const copied = JSON.parse(mocks.clipboard.mock.calls[0]![0]);
  expect(copied.loggingError).toContain("LOG_DENIED");
  expect(copied.diagnostics[0].code).toBe("USER_DATA_INVALID");
});
it("restores bundled content only after ownership closes, then retries preparation", async () => {
  mocks.prepare.mockRejectedValueOnce(
    "BASE_HASH_MISMATCH: card-library/critical.json",
  );
  const view = render(StartupRoot);
  await waitFor(() =>
    expect(view.getByText("Game content verification failed")).toBeTruthy(),
  );
  await fireEvent.click(view.getByRole("button", { name: "Restore" }));
  await waitFor(() => expect(mocks.prepare).toHaveBeenCalledTimes(2));
  const repairCall = mocks.invoke.mock.calls.findIndex(
    (call) => call[0] === "native_startup_repair",
  );
  expect(repairCall).toBeGreaterThanOrEqual(0);
  expect(mocks.close.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.invoke.mock.invocationCallOrder[repairCall]!,
  );
  expect(mocks.invoke.mock.invocationCallOrder[repairCall]).toBeLessThan(
    mocks.prepare.mock.invocationCallOrder[1]!,
  );
});
it("shows overall progress across phases, never goes backward and never offers Cancel", async () => {
  let report!: (event: StorageApi.StartupProgress) => void;
  const storage = Promise.withResolvers<never>();
  mocks.prepare.mockImplementation((_signal, progress) => {
    report = progress;
    return storage.promise;
  });
  const view = render(StartupRoot);
  await waitFor(() => expect(mocks.prepare).toHaveBeenCalledOnce());
  report({ sessionId: "test", phase: "verification", completed: 3, total: 6 });
  await waitFor(() =>
    expect(view.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "35",
    ),
  );
  report({ sessionId: "test", phase: "verification", completed: 6, total: 6 });
  await waitFor(() =>
    expect(view.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "45",
    ),
  );
  report({ sessionId: "test", phase: "user-state", completed: 0, total: 1 });
  await waitFor(() =>
    expect(view.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "55",
    ),
  );
  report({ sessionId: "test", phase: "verification", completed: 1, total: 6 });
  await waitFor(() =>
    expect(view.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "55",
    ),
  );
  expect(view.getByText("Startup progress")).toBeTruthy();
  expect(view.queryByRole("button", { name: /Cancel/ })).toBeNull();
  expect(
    view.container.querySelector('[data-cy="main-menu-screen"]'),
  ).toBeNull();
  storage.reject(new Error("USER_DATA_INVALID"));
  await waitFor(() => expect(view.queryByRole("progressbar")).toBeNull());
});
it("Close flushes and releases state before requesting native exit", async () => {
  const view = render(StartupRoot);
  await waitFor(() =>
    expect(view.getByText("Saved data could not be loaded")).toBeTruthy(),
  );
  await fireEvent.click(view.getByRole("button", { name: "Close" }));
  await waitFor(() =>
    expect(mocks.invoke).toHaveBeenCalledWith("native_startup_quit"),
  );
  const quitCall = mocks.invoke.mock.calls.findIndex(
    (call) => call[0] === "native_startup_quit",
  );
  expect(mocks.flush.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.close.mock.invocationCallOrder[0]!,
  );
  expect(mocks.close.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.invoke.mock.invocationCallOrder[quitCall]!,
  );
});

it("reports gameplay checkpoints without admitting the menu before readiness", async () => {
  const core = Promise.withResolvers<never>();
  let report!: (completed: number, total: number) => void;
  mocks.prepare.mockResolvedValue({});
  mocks.coreLoad.mockImplementation((_signal, progress) => {
    report = progress;
    return core.promise;
  });
  const view = render(StartupRoot);
  await waitFor(() => expect(mocks.coreLoad).toHaveBeenCalledOnce());
  expect(view.getByText("Preparing gameplay and screens…")).toBeTruthy();
  report(3, 7);
  await waitFor(() =>
    expect(view.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "87",
    ),
  );
  expect(
    view.container.querySelector('[data-cy="main-menu-screen"]'),
  ).toBeNull();
  report(7, 7);
  await waitFor(() =>
    expect(view.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "99",
    ),
  );
  expect(
    view.container.querySelector('[data-cy="main-menu-screen"]'),
  ).toBeNull();
  core.reject(new Error("ENGINE_PREPARATION_FAILED"));
  await waitFor(() =>
    expect(view.getByText("Duel engine could not be loaded")).toBeTruthy(),
  );
});

it("shows opener failures in the same compact error layout and includes them in Copy Error", async () => {
  const view = render(StartupRoot);
  await waitFor(() =>
    expect(view.getByText("Saved data could not be loaded")).toBeTruthy(),
  );
  mocks.invoke.mockRejectedValueOnce(new Error("LOG_OPEN_FAILED"));
  await fireEvent.click(view.getByRole("button", { name: "Open Log" }));
  await waitFor(() => expect(view.getByText("LOG_OPEN_FAILED")).toBeTruthy());
  expect(view.container.querySelectorAll('[role="alert"]')).toHaveLength(1);
  await fireEvent.click(view.getByRole("button", { name: "Copy Error" }));
  expect(
    JSON.parse(mocks.clipboard.mock.calls[0]![0]).actionError.message,
  ).toBe("LOG_OPEN_FAILED");
});
