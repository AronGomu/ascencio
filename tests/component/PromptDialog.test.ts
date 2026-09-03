// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  choiceId,
  promptId,
  type ChoiceId,
} from "../../src/battle/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
} from "../../src/battle/duel/contracts/player-prompt.ts";
import PromptDialog from "../../src/battle/app/components/PromptDialog.svelte";

afterEach(() => cleanup());

function choice(
  id: string,
  label: string,
  action: PromptChoice["action"] = "select",
): PromptChoice {
  return { id: choiceId(id), label, action };
}

function prompt(overrides: Partial<PlayerPrompt> = {}): PlayerPrompt {
  return {
    id: promptId("dialog-prompt"),
    kind: "yesNo",
    player: 0,
    title: "Test prompt",
    choices: [choice("yes", "Yes", "yes"), choice("no", "No", "no")],
    minimum: 1,
    maximum: 1,
    cancelable: false,
    ordered: false,
    ...overrides,
  } as PlayerPrompt;
}

describe("PromptDialog", () => {
  it("hosts the prompt controls", () => {
    render(PromptDialog, { prompt: prompt(), onsubmit: vi.fn() });

    const dialog = document.querySelector('[data-cy="prompt-dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.querySelector('[data-prompt-kind="yesNo"]')).not.toBeNull();
  });

  it("marks its nested title with the shared dialog title class", () => {
    render(PromptDialog, { prompt: prompt(), onsubmit: vi.fn() });

    const title = document.querySelector('[data-cy="prompt-controls-heading"]');
    expect(title?.classList).toContain("ui-dialog-title");
  });

  it("has no dismiss affordance", () => {
    render(PromptDialog, { prompt: prompt(), onsubmit: vi.fn() });

    const dialog = document.querySelector('[data-cy="prompt-dialog"]');
    const closeButtons = Array.from(
      dialog?.querySelectorAll("button") ?? [],
    ).filter((button) => /close/i.test(button.textContent ?? ""));
    expect(closeButtons).toHaveLength(0);
  });

  it("ignores escape", async () => {
    const user = userEvent.setup();
    render(PromptDialog, { prompt: prompt(), onsubmit: vi.fn() });

    await user.keyboard("{Escape}");

    expect(document.querySelector('[data-cy="prompt-dialog"]')).not.toBeNull();
  });

  it("ignores backdrop clicks", async () => {
    const user = userEvent.setup();
    render(PromptDialog, { prompt: prompt(), onsubmit: vi.fn() });

    const backdrop = document.querySelector<HTMLElement>(
      '[data-cy="prompt-dialog-backdrop"]',
    );
    expect(backdrop).not.toBeNull();
    await user.click(backdrop!);

    expect(document.querySelector('[data-cy="prompt-dialog"]')).not.toBeNull();
  });

  it("focuses its first control", () => {
    render(PromptDialog, { prompt: prompt(), onsubmit: vi.fn() });

    const dialog = document.querySelector('[data-cy="prompt-dialog"]');
    expect(dialog?.contains(document.activeElement)).toBe(true);
  });

  it("forwards submissions", async () => {
    const user = userEvent.setup();
    const onsubmit = vi.fn<(choiceIds: readonly ChoiceId[]) => void>();
    render(PromptDialog, { prompt: prompt(), onsubmit });

    const yes = screen.getByRole("button", { name: "Yes" });
    yes.focus();
    await user.keyboard("{Enter}{Enter}");

    expect(onsubmit).toHaveBeenCalledTimes(1);
    expect(onsubmit).toHaveBeenCalledWith([choiceId("yes")]);
  });
});
