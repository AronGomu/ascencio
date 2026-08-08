// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppMenubar from "../../src/app/components/AppMenubar.svelte";
import MenuDialog from "../../src/app/components/MenuDialog.svelte";
import SettingsDialog from "../../src/app/components/SettingsDialog.svelte";

afterEach(() => cleanup());

describe("AppMenubar", () => {
  it("exposes one settings button", async () => {
    const user = userEvent.setup();
    const onopensettings = vi.fn();
    render(AppMenubar, { onopensettings });

    const button = screen.getByRole("button", { name: "Settings" });
    expect(
      document.querySelector('[data-cy="app-menubar-settings-button"]'),
    ).toBe(button);

    await user.click(button);
    expect(onopensettings).toHaveBeenCalledTimes(1);
  });
});

describe("MenuDialog", () => {
  it("offers settings and surrender", () => {
    render(MenuDialog, {
      surrenderAvailable: true,
      responsePending: false,
      onopensettings: vi.fn(),
      onsurrender: vi.fn(),
      onclose: vi.fn(),
    });

    const settingsButton = document.querySelector(
      '[data-cy="menu-dialog-settings-button"]',
    );
    const surrenderButton = document.querySelector(
      '[data-cy="menu-dialog-surrender-button"]',
    );
    expect(settingsButton).not.toBeNull();
    expect(surrenderButton).not.toBeNull();
    expect(surrenderButton?.classList.contains("danger")).toBe(true);
  });

  it("needs confirmation before surrendering", async () => {
    const user = userEvent.setup();
    const onsurrender = vi.fn();
    render(MenuDialog, {
      surrenderAvailable: true,
      responsePending: false,
      onopensettings: vi.fn(),
      onsurrender,
      onclose: vi.fn(),
    });

    const surrenderButton = document.querySelector(
      '[data-cy="menu-dialog-surrender-button"]',
    ) as HTMLButtonElement;
    await user.click(surrenderButton);

    expect(onsurrender).not.toHaveBeenCalled();
    const confirmButton = document.querySelector(
      '[data-cy="menu-dialog-surrender-confirm-button"]',
    ) as HTMLButtonElement;
    expect(confirmButton).not.toBeNull();

    await user.click(confirmButton);
    expect(onsurrender).toHaveBeenCalledTimes(1);
  });

  it("cancel returns to the menu without surrendering", async () => {
    const user = userEvent.setup();
    const onsurrender = vi.fn();
    render(MenuDialog, {
      surrenderAvailable: true,
      responsePending: false,
      onopensettings: vi.fn(),
      onsurrender,
      onclose: vi.fn(),
    });

    await user.click(
      document.querySelector(
        '[data-cy="menu-dialog-surrender-button"]',
      ) as HTMLButtonElement,
    );
    await user.click(
      document.querySelector(
        '[data-cy="menu-dialog-surrender-cancel-button"]',
      ) as HTMLButtonElement,
    );

    expect(
      document.querySelector('[data-cy="menu-dialog-surrender-button"]'),
    ).not.toBeNull();
    expect(onsurrender).not.toHaveBeenCalled();
  });

  it("hides surrender when unavailable", () => {
    render(MenuDialog, {
      surrenderAvailable: false,
      responsePending: false,
      onopensettings: vi.fn(),
      onsurrender: vi.fn(),
      onclose: vi.fn(),
    });

    expect(
      document.querySelector('[data-cy="menu-dialog-surrender-button"]'),
    ).toBeNull();
  });

  it("disables the confirm button while a response is pending", async () => {
    const user = userEvent.setup();
    render(MenuDialog, {
      surrenderAvailable: true,
      responsePending: true,
      onopensettings: vi.fn(),
      onsurrender: vi.fn(),
      onclose: vi.fn(),
    });

    await user.click(
      document.querySelector(
        '[data-cy="menu-dialog-surrender-button"]',
      ) as HTMLButtonElement,
    );
    const confirmButton = document.querySelector(
      '[data-cy="menu-dialog-surrender-confirm-button"]',
    ) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
  });

  it("closes on Escape", () => {
    const onclose = vi.fn();
    render(MenuDialog, {
      surrenderAvailable: false,
      responsePending: false,
      onopensettings: vi.fn(),
      onsurrender: vi.fn(),
      onclose,
    });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click", async () => {
    const user = userEvent.setup();
    const onclose = vi.fn();
    render(MenuDialog, {
      surrenderAvailable: false,
      responsePending: false,
      onopensettings: vi.fn(),
      onsurrender: vi.fn(),
      onclose,
    });

    await user.click(
      document.querySelector('[data-cy="menu-dialog-backdrop"]') as HTMLElement,
    );
    expect(onclose).toHaveBeenCalledTimes(1);
  });
});

describe("SettingsDialog", () => {
  it("reflects the current settings state", () => {
    render(SettingsDialog, {
      settings: { showDuelHud: true, showWorkspace: false },
      coreVersion: null,
      activeSnapshotId: null,
      fallbackSnapshotId: null,
      onshowduelhud: vi.fn(),
      onshowworkspace: vi.fn(),
      onclose: vi.fn(),
    });

    const hudCheckbox = document.querySelector(
      '[data-cy="settings-show-duel-hud-checkbox"]',
    ) as HTMLInputElement;
    const workspaceCheckbox = document.querySelector(
      '[data-cy="settings-show-workspace-checkbox"]',
    ) as HTMLInputElement;
    expect(hudCheckbox.checked).toBe(true);
    expect(workspaceCheckbox.checked).toBe(false);
  });

  it("reports toggles through callbacks", async () => {
    const user = userEvent.setup();
    const onshowworkspace = vi.fn();
    render(SettingsDialog, {
      settings: { showDuelHud: false, showWorkspace: false },
      coreVersion: null,
      activeSnapshotId: null,
      fallbackSnapshotId: null,
      onshowduelhud: vi.fn(),
      onshowworkspace,
      onclose: vi.fn(),
    });

    await user.click(
      document.querySelector(
        '[data-cy="settings-show-workspace-checkbox"]',
      ) as HTMLInputElement,
    );
    expect(onshowworkspace).toHaveBeenCalledTimes(1);
    expect(onshowworkspace).toHaveBeenCalledWith(true);
  });

  it("shows engine build and snapshot info", () => {
    render(SettingsDialog, {
      settings: { showDuelHud: false, showWorkspace: false },
      coreVersion: [11, 0],
      activeSnapshotId: "abc123def456ghi",
      fallbackSnapshotId: null,
      onshowduelhud: vi.fn(),
      onshowworkspace: vi.fn(),
      onclose: vi.fn(),
    });

    expect(
      document.querySelector('[data-cy="settings-engine-version"]')
        ?.textContent,
    ).toContain("ocgcore 11.0");
    expect(
      document.querySelector('[data-cy="settings-active-snapshot"]')
        ?.textContent,
    ).toContain("abc123def456");
  });
});
