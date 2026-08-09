// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CardActionChips from "../../src/app/components/duel-field/CardActionChips.svelte";
import { choiceId } from "../../src/duel/contracts/ids.ts";
import type { InteractionChoice } from "../../src/app/prompts/interaction-spec.ts";

afterEach(() => {
  cleanup();
});

const ACTIVATE: InteractionChoice = {
  id: choiceId("choice-activate"),
  label: "Activate Mystical Space Typhoon",
  action: "activate",
};

const SET: InteractionChoice = {
  id: choiceId("choice-setSpellTrap"),
  label: "Set Mystical Space Typhoon",
  action: "setSpellTrap",
};

function renderChips(
  overrides: {
    readonly choices?: readonly InteractionChoice[];
    readonly disabled?: boolean;
  } = {},
) {
  const onchoose = vi.fn();
  const ondismiss = vi.fn();
  const rendered = render(CardActionChips, {
    cardId: "card-1",
    cardLabel: "Mystical Space Typhoon in Your Hand",
    choices: overrides.choices ?? [ACTIVATE, SET],
    disabled: overrides.disabled ?? false,
    onchoose,
    ondismiss,
  });
  return { rendered, onchoose, ondismiss };
}

function chips(): HTMLButtonElement[] {
  return [
    ...document.querySelectorAll<HTMLButtonElement>(
      '[data-cy^="card-action-chip-"]',
    ),
  ];
}

describe("CardActionChips", () => {
  it("renders one button per choice", () => {
    const { rendered } = renderChips();
    expect(
      rendered.container.querySelector('[data-cy="card-action-chips-card-1"]'),
    ).not.toBeNull();
    expect(chips()).toHaveLength(2);
  });

  it("labels a chip with the action word and keeps the engine text accessible", () => {
    renderChips({ choices: [ACTIVATE] });
    const chip = chips()[0];
    if (chip === undefined) throw new Error("Missing chip");
    expect(chip.textContent?.trim()).toBe("Activate");
    expect(chip.getAttribute("title")).toBe(ACTIVATE.label);
    expect(chip.getAttribute("aria-label")).toBe(ACTIVATE.label);
    expect(screen.getByRole("button", { name: ACTIVATE.label })).toBe(chip);
  });

  it("excludes inspect and close entries", () => {
    renderChips();
    for (const chip of chips())
      expect(chip.textContent ?? "").not.toMatch(/inspect|close/i);
    expect(screen.queryByRole("button", { name: /inspect|close/i })).toBeNull();
  });

  it("reports the chosen choice once", async () => {
    const user = userEvent.setup();
    const { onchoose } = renderChips();
    const chip = chips()[0];
    if (chip === undefined) throw new Error("Missing chip");
    await user.click(chip);
    expect(onchoose).toHaveBeenCalledTimes(1);
    expect(onchoose).toHaveBeenCalledWith(ACTIVATE);
  });

  it("moves between chips with arrow keys", async () => {
    const user = userEvent.setup();
    renderChips();
    const [first, second] = chips();
    if (first === undefined || second === undefined)
      throw new Error("Missing chips");
    first.focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(second);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(first);
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(second);
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(first);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(second);
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(first);
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(second);
  });

  it("dismisses on Escape", async () => {
    const user = userEvent.setup();
    const { ondismiss } = renderChips();
    const chip = chips()[0];
    if (chip === undefined) throw new Error("Missing chip");
    chip.focus();
    await user.keyboard("{Escape}");
    expect(ondismiss).toHaveBeenCalledTimes(1);
  });

  it("disables every chip while a response is pending", () => {
    renderChips({ disabled: true });
    expect(chips()).toHaveLength(2);
    for (const chip of chips()) expect(chip.disabled).toBe(true);
  });

  it("focuses the first chip through the instance binding", async () => {
    const { rendered } = renderChips();
    (
      rendered.component as unknown as { focusFirstChip: () => void }
    ).focusFirstChip();
    await waitFor(() => expect(document.activeElement).toBe(chips()[0]));
  });
});
