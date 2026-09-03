// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
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
