// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "@testing-library/user-event";
import { tick } from "svelte";
import SettingsDialog from "../../src/battle/app/components/SettingsDialog.svelte";
import { DEFAULT_UI_SETTINGS } from "../../src/battle/app/stores/ui-settings-store.ts";

const callbacks = () => ({
  onshowduelhud: vi.fn(),
  onshowworkspace: vi.fn(),
  onautoplacecards: vi.fn(),
  onautoresolvetrivialprompts: vi.fn(),
  onshowzoneoutlines: vi.fn(),
  onshowzonecounts: vi.fn(),
  onshowcardshadows: vi.fn(),
  onshowzonelabels: vi.fn(),
  onreset: vi.fn(),
  onclose: vi.fn(),
});

afterEach(cleanup);

describe("SettingsDialog display settings", () => {
  it.each([false, true])(
    "contains keyboard focus and restores trigger (portaled=%s)",
    async (portaled) => {
      const host = document.createElement("div");
      if (portaled) host.className = "shell-region--duel";
      const trigger = document.createElement("button");
      trigger.textContent = "Underlying action";
      const preIsolated = document.createElement("div");
      preIsolated.setAttribute("inert", "");
      host.append(trigger, preIsolated);
      document.body.append(host);
      trigger.focus();
      const rendered = render(SettingsDialog, {
        props: { settings: DEFAULT_UI_SETTINGS, ...callbacks() },
        target: host,
      });
      await tick();
      const first = document.querySelector<HTMLInputElement>(
        '[data-cy="settings-show-duel-hud-checkbox"]',
      )!;
      const last = document.querySelector<HTMLButtonElement>(
        '[data-cy="settings-dialog-close-button"]',
      )!;
      const user = userEvent.setup();
      try {
        first.focus();
        expect(document.activeElement).toBe(first);
        await user.tab({ shift: true });
        expect(document.activeElement).toBe(last);
        await user.tab();
        expect(document.activeElement).toBe(first);
        expect(trigger.closest("[inert]")).not.toBeNull();
        rendered.unmount();
        expect(document.activeElement).toBe(trigger);
        expect(trigger.closest("[inert]")).toBeNull();
        expect(preIsolated.hasAttribute("inert")).toBe(true);
        const laterControl = document.createElement("button");
        host.append(laterControl);
        await tick();
        laterControl.focus();
        expect(laterControl.closest("[inert]")).toBeNull();
        expect(document.activeElement).toBe(laterControl);
      } finally {
        rendered.unmount();
        host.remove();
      }
    },
  );
  it.each([false, true])(
    "recovers focus when pending diagnostics disable the focused download (portaled=%s)",
    async (portaled) => {
      const host = document.createElement("div");
      if (portaled) host.className = "shell-region--duel";
      document.body.append(host);
      const ondownloaddiagnostics = vi.fn();
      const rendered = render(SettingsDialog, {
        props: {
          settings: DEFAULT_UI_SETTINGS,
          ...callbacks(),
          ondownloaddiagnostics,
        },
        target: host,
      });
      try {
        const download = document.querySelector<HTMLButtonElement>(
          '[data-cy="settings-download-diagnostics-button"]',
        )!;
        const first = document.querySelector<HTMLInputElement>(
          '[data-cy="settings-show-duel-hud-checkbox"]',
        )!;
        const user = userEvent.setup();
        await user.click(download);
        expect(ondownloaddiagnostics).toHaveBeenCalledOnce();
        expect(document.activeElement).toBe(download);
        await rendered.rerender({ ondownloaddiagnostics: null });
        expect(download.disabled).toBe(true);
        await vi.waitFor(() => expect(document.activeElement).toBe(first));
        await user.tab({ shift: true });
        expect(document.activeElement).toBe(
          document.querySelector('[data-cy="settings-dialog-close-button"]'),
        );
        await user.tab();
        expect(document.activeElement).toBe(first);
        await rendered.rerender({ ondownloaddiagnostics });
        expect(document.activeElement).toBe(first);
      } finally {
        rendered.unmount();
        host.remove();
      }
    },
  );
  it("recovers focus after a focused control is removed", async () => {
    const rendered = render(SettingsDialog, {
      settings: DEFAULT_UI_SETTINGS,
      ...callbacks(),
      ondownloaddiagnostics: vi.fn(),
    });
    const download = rendered.container.querySelector<HTMLButtonElement>(
      '[data-cy="settings-download-diagnostics-button"]',
    )!;
    download.focus();
    expect(document.activeElement).toBe(download);
    download.remove();
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(
        rendered.container.querySelector(
          '[data-cy="settings-show-duel-hud-checkbox"]',
        ),
      ),
    );
  });
  it("marks its existing title with the shared dialog title class", () => {
    const rendered = render(SettingsDialog, {
      settings: DEFAULT_UI_SETTINGS,
      ...callbacks(),
    });

    const title = rendered.container.querySelector(
      '[data-cy="settings-dialog-heading"]',
    );
    expect(title?.classList).toContain("ui-dialog-title");
  });

  it("dispatches new display toggles and reflects updated state", async () => {
    const handlers = callbacks();
    const rendered = render(SettingsDialog, {
      settings: DEFAULT_UI_SETTINGS,
      ...handlers,
    });
    const getByCy = (value: string): Element => {
      const element = rendered.container.querySelector(`[data-cy="${value}"]`);
      if (element === null) throw new Error(`Missing ${value}`);
      return element;
    };

    const shadows = getByCy("settings-show-card-shadows-checkbox");
    const labels = getByCy("settings-show-zone-labels-checkbox");
    expect((shadows as HTMLInputElement).checked).toBe(true);
    expect((labels as HTMLInputElement).checked).toBe(true);

    await fireEvent.click(shadows);
    await fireEvent.click(labels);
    expect(handlers.onshowcardshadows).toHaveBeenCalledWith(false);
    expect(handlers.onshowzonelabels).toHaveBeenCalledWith(false);

    await rendered.rerender({
      settings: {
        ...DEFAULT_UI_SETTINGS,
        showCardShadows: false,
        showZoneLabels: false,
      },
    });
    expect(
      (getByCy("settings-show-card-shadows-checkbox") as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(
      (getByCy("settings-show-zone-labels-checkbox") as HTMLInputElement)
        .checked,
    ).toBe(false);
  });

  it("dispatches reset for both display settings", async () => {
    const handlers = callbacks();
    const rendered = render(SettingsDialog, {
      settings: DEFAULT_UI_SETTINGS,
      ...handlers,
    });
    const getByCy = (value: string): Element => {
      const element = rendered.container.querySelector(`[data-cy="${value}"]`);
      if (element === null) throw new Error(`Missing ${value}`);
      return element;
    };
    const shadows = getByCy("settings-show-card-shadows-checkbox");
    const labels = getByCy("settings-show-zone-labels-checkbox");
    await fireEvent.click(shadows);
    await fireEvent.click(labels);
    expect(handlers.onshowcardshadows).toHaveBeenCalledWith(false);
    expect(handlers.onshowzonelabels).toHaveBeenCalledWith(false);

    const reset = getByCy("settings-reset-button");
    await fireEvent.click(reset);
    expect(handlers.onreset).toHaveBeenCalledOnce();

    rendered.unmount();
    const resetRendered = render(SettingsDialog, {
      settings: { ...DEFAULT_UI_SETTINGS },
      ...handlers,
    });
    expect(
      resetRendered.container.querySelector(
        '[data-cy="settings-show-card-shadows-checkbox"]',
      ),
    ).toHaveProperty("checked", true);
    expect(
      resetRendered.container.querySelector(
        '[data-cy="settings-show-zone-labels-checkbox"]',
      ),
    ).toHaveProperty("checked", true);
  });

  it("disables the duel log download when diagnostics are unavailable", () => {
    const rendered = render(SettingsDialog, {
      settings: DEFAULT_UI_SETTINGS,
      ...callbacks(),
      ondownloaddiagnostics: null,
    });

    const download = rendered.container.querySelector(
      '[data-cy="settings-download-diagnostics-button"]',
    );
    expect(download).toHaveProperty("disabled", true);
    expect(download?.getAttribute("title")).toBe("No duel trace yet");
  });

  it("downloads the duel log when diagnostics are available", async () => {
    const ondownloaddiagnostics = vi.fn();
    const rendered = render(SettingsDialog, {
      settings: DEFAULT_UI_SETTINGS,
      ...callbacks(),
      ondownloaddiagnostics,
    });

    const download = rendered.container.querySelector(
      '[data-cy="settings-download-diagnostics-button"]',
    );
    expect(download).toHaveProperty("disabled", false);
    await fireEvent.click(download!);
    expect(ondownloaddiagnostics).toHaveBeenCalledOnce();
  });
});
