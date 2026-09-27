// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import InstallContentScreen from "../../src/shell/screens/InstallContentScreen.svelte";
import type {
  AppUpdateController,
  AppUpdateView,
} from "../../src/shell/application/app-update-controller.ts";
import type {
  ManualContentController,
  ManualContentView,
} from "../../src/shell/application/manual-content-controller.ts";

const updateView: AppUpdateView = {
  phase: "available",
  message: "App update available. Approval is required before installation.",
  canCheck: true,
  canApprove: true,
  candidate: {
    schemaVersion: 1,
    buildId: "0.1.0+candidate",
    coreContentApiVersion: 1,
  },
};

function updates(view: AppUpdateView = updateView) {
  return {
    view,
    subscribe(listener: (value: AppUpdateView) => void) {
      listener(view);
      return () => undefined;
    },
    check: vi.fn(async () => undefined),
    approve: vi.fn(async () => undefined),
    cancel: vi.fn(),
    dispose: vi.fn(async () => undefined),
  } satisfies AppUpdateController;
}

const manualView: ManualContentView = {
  state: {
    kind: "ready",
    stack: { generation: 1, packages: [] },
    readiness: {
      freeplay: false,
      deckBuilder: false,
      newGame: false,
      missing: ["duel-core", "card-library", "freeplay", "chapter-01"],
    },
    cleanupPending: false,
    mediaWarnings: [
      {
        packageId: "card-library",
        path: "cards/full/1.jpg",
        reason: "missing",
      },
    ],
  },
  message: "Installed package status refreshed.",
  busy: false,
  refreshPending: false,
  navigationBlocked: false,
  removal: null,
};

function manual(view: ManualContentView = manualView): ManualContentController {
  return {
    view,
    subscribe(listener) {
      listener(view);
      return () => undefined;
    },
    refresh: vi.fn(async () => undefined),
    retry: vi.fn(async () => undefined),
    importPackages: vi.fn(async () => undefined),
    cancelImport: vi.fn(),
    verifyInstalled: vi.fn(async () => undefined),
    requestRemoval: vi.fn(),
    cancelRemoval: vi.fn(),
    reportDownload: vi.fn(),
    removePackage: vi.fn(async () => undefined),
    cleanupUnused: vi.fn(async () => undefined),
    exportUserData: vi.fn(async () => null),
    inspectUserDataBackup: vi.fn(async () => undefined),
    cancelRestore: vi.fn(),
    confirmRestore: vi.fn(async () => undefined),
    updateMediaWarnings: vi.fn(),
    dispose: vi.fn(async () => undefined),
  };
}

afterEach(cleanup);

describe("InstallContentScreen composition", () => {
  it("keeps manual packages, persistent media warning, and app approval separate", () => {
    const view = render(InstallContentScreen, {
      gate: { kind: "locked", reason: "content-required" },
      manual: manual(),
      appUpdates: updates(),
      onback: vi.fn(),
    });
    expect(
      view.getByText(
        "Optional media is unavailable. You can keep playing. 1 warning recorded.",
      ),
    ).toBeTruthy();
    expect(
      view.getByRole("button", { name: "Verify installed content" }),
    ).toBeTruthy();
    expect(
      view.getByRole("button", { name: "Approve app update" }),
    ).toBeTruthy();
    expect(
      view.queryByRole("button", { name: "Install required data" }),
    ).toBeNull();
  });

  it("adopts root manual controller after storage boot", async () => {
    const view = render(InstallContentScreen, {
      gate: { kind: "checking" },
      manual: null,
      appUpdates: null,
      onback: vi.fn(),
    });
    expect(
      view.getByText(
        "Local content controls are unavailable. Reopen from Main Menu.",
      ),
    ).toBeTruthy();
    await view.rerender({
      gate: { kind: "locked", reason: "content-required" },
      manual: manual(),
      appUpdates: null,
      onback: vi.fn(),
    });
    expect(
      view.queryByText(
        "Local content controls are unavailable. Reopen from Main Menu.",
      ),
    ).toBeNull();
  });

  it("requires explicit app update approval", async () => {
    const appUpdates = updates();
    const view = render(InstallContentScreen, {
      gate: { kind: "checking" },
      manual: manual(),
      appUpdates,
      onback: vi.fn(),
    });
    expect(
      view.getByText("Build 0.1.0+candidate · content API 1"),
    ).toBeTruthy();
    await fireEvent.click(
      view.getByRole("button", { name: "Approve app update" }),
    );
    expect(appUpdates.approve).toHaveBeenCalledWith(updateView.candidate);
  });

  it.each([
    {
      name: "committed restore",
      state: { kind: "restoring" } as const,
      busy: true,
    },
    {
      name: "unknown restore outcome",
      state: { kind: "restore-outcome-unknown" } as const,
      busy: false,
    },
  ])(
    "blocks app update checks and approval during $name",
    ({ state, busy }) => {
      const blocked: ManualContentView = {
        ...manualView,
        state,
        busy,
        navigationBlocked: true,
        message:
          "Restoring user data. This operation cannot be cancelled. Keep this app open.",
      };
      const appUpdates = updates();
      const view = render(InstallContentScreen, {
        gate: { kind: "checking" },
        manual: manual(blocked),
        appUpdates,
        onback: vi.fn(),
      });

      expect(
        view.getByRole("button", { name: "Check for app update" }),
      ).toHaveProperty("disabled", true);
      expect(
        view.getByRole("button", { name: "Approve app update" }),
      ).toHaveProperty("disabled", true);
      expect(appUpdates.check).not.toHaveBeenCalled();
      expect(appUpdates.approve).not.toHaveBeenCalled();
    },
  );
});

describe("app approval UI lifecycle", () => {
  it("precommit cancel remains usable while restore and content actions are blocked", async () => {
    const appUpdates = updates({
      ...updateView,
      phase: "approving",
      canCheck: false,
      canApprove: false,
    });
    const onback = vi.fn();
    const view = render(InstallContentScreen, {
      gate: { kind: "locked", reason: "content-required" },
      manual: manual(),
      appUpdates,
      onback,
    });
    expect(
      view.getByRole("button", { name: "Verify installed content" }),
    ).toHaveProperty("disabled", true);
    const cancel = view.getByRole("button", { name: "Cancel approval" });
    expect(cancel).toHaveProperty("disabled", false);
    await fireEvent.click(cancel);
    expect(appUpdates.cancel).toHaveBeenCalledOnce();
    await fireEvent.click(
      view.getByRole("button", { name: "Back to Main Menu" }),
    );
    expect(appUpdates.cancel).toHaveBeenCalledTimes(2);
    expect(onback).toHaveBeenCalledOnce();
  });

  it("noncancellable consent commit blocks back and offers no misleading cancel", async () => {
    const appUpdates = updates({
      ...updateView,
      phase: "committing",
      canCheck: false,
      canApprove: false,
    });
    const onback = vi.fn();
    const view = render(InstallContentScreen, {
      gate: { kind: "locked", reason: "content-required" },
      manual: manual(),
      appUpdates,
      onback,
    });
    expect(
      view.queryByRole("button", { name: /Cancel (check|approval)/ }),
    ).toBeNull();
    const back = view.getByRole("button", { name: "Back to Main Menu" });
    expect(back).toHaveProperty("disabled", true);
    await fireEvent.click(back);
    expect(onback).not.toHaveBeenCalled();
    expect(appUpdates.cancel).not.toHaveBeenCalled();
  });
});
