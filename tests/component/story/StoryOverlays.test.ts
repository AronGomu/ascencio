// @vitest-environment jsdom
import { readFileSync } from "fs";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import HistoryOverlay from "../../../src/story/overlays/HistoryOverlay.svelte";
import OverlayShell from "../../../src/story/overlays/OverlayShell.svelte";
import PauseOverlay from "../../../src/story/overlays/PauseOverlay.svelte";
import SaveLoadOverlay from "../../../src/story/overlays/SaveLoadOverlay.svelte";
import SettingsOverlay from "../../../src/story/overlays/SettingsOverlay.svelte";
import {
  DEFAULT_STORY_PLAYBACK_SETTINGS,
  readStoryPlaybackSettings,
} from "../../../src/story/playback/story-playback-settings.ts";

const OVERLAY_SHELL_SOURCE = readFileSync(
  "src/story/overlays/OverlayShell.svelte",
  "utf8",
);

function declarations(selector: string): readonly string[] {
  const style =
    /<style>([\s\S]*)<\/style>/.exec(OVERLAY_SHELL_SOURCE)?.[1] ?? "";
  const rules = new Map<string, string>();
  for (const [, ruleSelector, body] of style.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    rules.set(
      (ruleSelector ?? "").trim().replace(/\s+/g, " "),
      (body ?? "").trim(),
    );
  const body = rules.get(selector);
  expect(body, `OverlayShell.svelte has no \`${selector}\` rule`).toBeDefined();
  return body!
    .split(";")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => line.length > 0);
}

afterEach(() => {
  cleanup();
  /* The settings overlay persists auto speed and skip-unread, so one test's
     choices must not become the next one's starting point. */
  localStorage.clear();
});

describe("story utility overlays", () => {
  it("renders VariantB classes through the shared shell", () => {
    render(OverlayShell, { title: "History", labelId: "history-title" });
    const dialog = screen.getByRole("dialog", { name: "History" });
    expect([...dialog.classList]).toEqual(
      expect.arrayContaining(["overlay", "ui-glass-panel", "ui-chamfer"]),
    );
    expect(
      screen.getByRole("heading", { name: "History" }).classList,
    ).toContain("ui-dialog-title");
  });

  it("keeps blur on the backdrop and panel paint on VariantB primitives", () => {
    const backdrop = declarations(".overlay-backdrop");
    expect(backdrop).toContain(
      "background: color-mix(in srgb, var(--bg-deep) 55%, transparent)",
    );
    expect(backdrop).toContain("backdrop-filter: blur(6px)");

    const panel = declarations(".overlay");
    expect(panel).not.toContain("backdrop-filter: blur(6px)");
    expect(panel.some((line) => line.includes("var(--story-panel)"))).toBe(
      false,
    );
    expect(
      panel.some((line) => /^(background|border|border-radius):/.test(line)),
    ).toBe(false);
  });

  it("shows ordered history and empty state", () => {
    const rendered = render(HistoryOverlay, {
      entries: [
        { speaker: "Rin", text: "First" },
        { speaker: "Kael", text: "Second" },
      ],
    });
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual(["RinFirst", "KaelSecond"]);
    rendered.unmount();
    render(HistoryOverlay, { entries: [] });
    expect(screen.getByText(/No dialogue in this scene yet/)).toBeTruthy();
  });

  it("changes and resets settings while audio remains disabled", async () => {
    render(SettingsOverlay);
    const textSpeed = screen.getByLabelText("Text speed") as HTMLInputElement;
    await userEvent.setup().clear(textSpeed);
    await userEvent.setup().type(textSpeed, "80");
    expect(textSpeed.value).toBe("80");
    const autoSpeed = screen.getByLabelText("Auto speed") as HTMLInputElement;
    const transitions = screen.getByLabelText(
      "Transitions",
    ) as HTMLSelectElement;
    await fireEvent.input(autoSpeed, { target: { value: "7" } });
    await userEvent.setup().selectOptions(transitions, "off");
    expect(autoSpeed.value).toBe("7");
    expect(transitions.value).toBe("off");
    expect(
      (screen.getByLabelText("Music volume") as HTMLInputElement).disabled,
    ).toBe(true);
    expect(screen.getByText(/Audio not included/)).toBeTruthy();
    expect(screen.getByText(/Press F11 for fullscreen/)).toBeTruthy();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Reset settings" }));
    expect(textSpeed.value).toBe("40");
    expect(autoSpeed.value).toBe("3");
    expect(transitions.value).toBe("standard");
  });

  it("persists auto speed and skip-unread for the narrative screen to read", async () => {
    const rendered = render(SettingsOverlay);
    const skipUnread = screen.getByLabelText(
      "Skip unread text",
    ) as HTMLInputElement;
    expect(skipUnread.checked).toBe(false);
    await fireEvent.input(screen.getByLabelText("Auto speed"), {
      target: { value: "6" },
    });
    await userEvent.setup().click(skipUnread);
    expect(readStoryPlaybackSettings()).toEqual({
      autoSpeedSeconds: 6,
      skipUnread: true,
      autoFlip: false,
    });

    rendered.unmount();
    render(SettingsOverlay);
    expect(
      (screen.getByLabelText("Auto speed") as HTMLInputElement).value,
    ).toBe("6");
    expect(
      (screen.getByLabelText("Skip unread text") as HTMLInputElement).checked,
    ).toBe(true);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Reset settings" }));
    expect(readStoryPlaybackSettings()).toEqual(
      DEFAULT_STORY_PLAYBACK_SETTINGS,
    );
  });

  it("Escape closes top overlay and restores invoking control", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open history";
    document.body.append(trigger);
    trigger.focus();
    const onclose = vi.fn();
    render(HistoryOverlay, { onclose, restoreFocusTo: trigger });
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(onclose).toHaveBeenCalledOnce();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("menu overlay titles itself Menu", () => {
    render(PauseOverlay);
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeTruthy();
    expect(screen.queryByText("Paused")).toBeNull();
  });

  it("pause offers expected actions and confirms unsaved return", async () => {
    const onaction = vi.fn();
    render(PauseOverlay, { unsaved: true, onaction });
    for (const name of [
      "Resume",
      "Save",
      "Load",
      "Settings",
      "Return to Main Menu",
    ])
      expect(screen.getByRole("button", { name })).toBeTruthy();
    const user = userEvent.setup();
    for (const [button, action] of [
      ["Resume", "resume"],
      ["Save", "save"],
      ["Load", "load"],
      ["Settings", "settings"],
    ] as const) {
      await user.click(screen.getByRole("button", { name: button }));
      expect(onaction).toHaveBeenCalledWith(action);
    }
    await user.click(
      screen.getByRole("button", { name: "Return to Main Menu" }),
    );
    expect(
      screen.getByRole("alertdialog", {
        name: "Return to Main Menu without saving?",
      }),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Stay in story" }));
    expect(onaction).not.toHaveBeenCalledWith("main-menu");
    await user.click(
      screen.getByRole("button", { name: "Return to Main Menu" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Return without saving" }),
    );
    expect(onaction).toHaveBeenCalledWith("main-menu");
  });

  it.each(["success", "overwrite", "failure"] as const)(
    "exposes %s save feedback",
    async (mode) => {
      render(SaveLoadOverlay, { mode });
      expect(
        screen.getByRole("dialog", { name: /Save and load/ }),
      ).toBeTruthy();
      if (mode === "success")
        expect(screen.getByText(/Save complete/)).toBeTruthy();
      if (mode === "overwrite")
        expect(screen.getByText(/Overwrite manual slot/)).toBeTruthy();
      if (mode === "failure") {
        expect(screen.getByText(/Storage unavailable/)).toBeTruthy();
        expect(screen.getByRole("button", { name: "Retry save" })).toBeTruthy();
        expect(
          screen.getByRole("button", { name: "Continue Without Saving" }),
        ).toBeTruthy();
      }
      expect(
        screen.getByText(/Auto and Skip are reader settings/),
      ).toBeTruthy();
    },
  );
});
