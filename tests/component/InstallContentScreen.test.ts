// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import InstallContentScreen from "../../src/shell/screens/InstallContentScreen.svelte";
import type {
  ContentActionsController,
  ContentActionsView,
} from "../../src/shell/application/content-actions.ts";

const base: ContentActionsView = {
  phase: "idle",
  message: "Installed content remains available offline.",
  completedBytes: 0,
  totalBytes: 0,
  missingMedia: 0,
  canInstall: false,
  canActivate: false,
  canDownloadMedia: false,
  canDeleteAssets: false,
  canApproveCore: false,
  coreCandidate: null,
  resumableJobs: [],
};

function actions(overrides: Partial<ContentActionsView> = {}) {
  const view = { ...base, ...overrides };
  const controller = {
    view,
    subscribe(listener: (value: ContentActionsView) => void) {
      listener(view);
      return () => undefined;
    },
    check: vi.fn(async () => undefined),
    installRequired: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    activate: vi.fn(async () => undefined),
    downloadMedia: vi.fn(async () => undefined),
    deleteUnusedAssets: vi.fn(async () => undefined),
    deleteAllAssets: vi.fn(async () => undefined),
    approveCore: vi.fn(async () => undefined),
    refresh: vi.fn(async () => undefined),
    cancel: vi.fn(),
    dispose: vi.fn(),
  } satisfies ContentActionsController;
  return controller;
}

afterEach(cleanup);

describe("InstallContentScreen explicit actions", () => {
  it("renders separate consent controls and persistent optional-media count", () => {
    const controller = actions({
      missingMedia: 12,
      canInstall: true,
      canActivate: true,
      canDownloadMedia: true,
      canDeleteAssets: true,
      canApproveCore: true,
      coreCandidate: {
        schemaVersion: 1,
        buildId: "0.1.0+candidate",
        coreContentApiVersion: 1,
      },
    });
    const view = render(InstallContentScreen, {
      gate: { kind: "locked", reason: "content-required" },
      actions: controller,
      onback: vi.fn(),
    });
    expect(
      view.getByText("Optional media is missing. You can keep playing."),
    ).toBeTruthy();
    expect(view.getByText("12 placeholders active.")).toBeTruthy();
    for (const name of [
      "Check updates",
      "Install required data",
      "Activate content",
      "Download media",
      "Approve CORE update",
      "Delete unused assets",
      "Delete all assets",
    ])
      expect(view.getByRole("button", { name })).toBeTruthy();
  });

  it("adopts content actions that finish booting after the screen mounts", async () => {
    const controller = actions({ canInstall: true });
    const view = render(InstallContentScreen, {
      gate: { kind: "checking" },
      actions: null,
      onback: vi.fn(),
    });

    expect(
      view.getByText(
        "Content controls are unavailable. Reopen from Main Menu.",
      ),
    ).toBeTruthy();

    await view.rerender({
      gate: { kind: "locked", reason: "content-required" },
      actions: controller,
      onback: vi.fn(),
    });

    expect(
      view.queryByText(
        "Content controls are unavailable. Reopen from Main Menu.",
      ),
    ).toBeNull();
    expect(view.getByText(base.message)).toBeTruthy();
    expect(
      view.getByRole("button", { name: "Install required data" }),
    ).toHaveProperty("disabled", false);
  });

  it("requires explicit delete-all confirmation stating saves/settings retention", async () => {
    const controller = actions({ canDeleteAssets: true });
    const view = render(InstallContentScreen, {
      gate: { kind: "checking" },
      actions: controller,
      onback: vi.fn(),
    });
    await fireEvent.click(
      view.getByRole("button", { name: "Delete all assets" }),
    );
    expect(
      view.getByRole("alertdialog").textContent?.replace(/\s+/g, " "),
    ).toContain("Saves and settings will be retained.");
    await fireEvent.click(
      view.getByRole("button", { name: "Delete downloaded assets" }),
    );
    expect(controller.deleteAllAssets).toHaveBeenCalledOnce();
  });

  it("shows resume separately and pause aborts only active download", async () => {
    const controller = actions({
      phase: "downloading",
      resumableJobs: [
        {
          request: {
            jobId: "00000000-0000-4000-8000-000000000001",
            manifestVersion: "a".repeat(64),
            chapterIds: ["chapter-01"],
            kind: "media",
          },
          progress: {
            jobId: "00000000-0000-4000-8000-000000000001",
            phase: "paused",
            completedFiles: 0,
            totalFiles: 1,
            completedBytes: 0,
            totalBytes: 10,
          },
        },
      ],
    });
    const view = render(InstallContentScreen, {
      gate: { kind: "checking" },
      actions: controller,
      onback: vi.fn(),
    });
    await fireEvent.click(view.getByRole("button", { name: "Pause download" }));
    expect(controller.cancel).toHaveBeenCalledOnce();
    await fireEvent.click(
      view.getByRole("button", { name: "Resume media download" }),
    );
    expect(controller.resume).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      expect.any(AbortSignal),
    );
  });
});
