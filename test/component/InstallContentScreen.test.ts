// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import InstallContentScreen from "../../src/shell/screens/InstallContentScreen.svelte";

import type {
  ManualContentController,
  ManualContentView,
} from "../../src/shell/application/manual-content-controller.ts";

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
  it("shows installed content and optional media warnings without a browser updater", () => {
    const view = render(InstallContentScreen, {
      gate: { kind: "locked", reason: "content-required" },
      manual: manual(),
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
      view.queryByRole("button", { name: "Approve app update" }),
    ).toBeNull();
    expect(
      view.queryByRole("button", { name: "Install required data" }),
    ).toBeNull();
  });

  it("adopts root manual controller after storage boot", async () => {
    const view = render(InstallContentScreen, {
      gate: { kind: "checking" },
      manual: null,
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
      onback: vi.fn(),
    });
    expect(
      view.queryByText(
        "Local content controls are unavailable. Reopen from Main Menu.",
      ),
    ).toBeNull();
  });

  it.each([
    { state: { kind: "restoring" } as const, busy: true },
    { state: { kind: "restore-outcome-unknown" } as const, busy: false },
  ])(
    "blocks navigation and content writes during restore",
    async ({ state, busy }) => {
      const onback = vi.fn();
      const view = render(InstallContentScreen, {
        gate: { kind: "checking" },
        manual: manual({ ...manualView, state, busy, navigationBlocked: true }),
        onback,
      });
      expect(
        view.getByRole("button", { name: "Back to Main Menu" }),
      ).toHaveProperty("disabled", true);
      expect(
        view.getByRole("button", { name: "Export user-data.json" }),
      ).toHaveProperty("disabled", true);
      await fireEvent.click(
        view.getByRole("button", { name: "Back to Main Menu" }),
      );
      expect(onback).not.toHaveBeenCalled();
    },
  );
});
