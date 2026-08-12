// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckPicker from "../../src/app/components/DeckPicker.svelte";
import { DECK_CATALOG } from "../../src/duel/presets/deck-catalog.ts";

afterEach(() => cleanup());

function renderPicker(overrides: Record<string, unknown> = {}) {
  return render(DeckPicker, {
    decks: DECK_CATALOG,
    playerDeckId: "nekroz",
    opponentDeckId: "mvp-opponent",
    ...overrides,
  });
}

describe("DeckPicker", () => {
  it("renders one option per deck in both columns", () => {
    renderPicker();

    expect(
      document.querySelectorAll('[data-cy^="deck-picker-option-player-"]'),
    ).toHaveLength(6);
    expect(
      document.querySelectorAll('[data-cy^="deck-picker-option-opponent-"]'),
    ).toHaveLength(6);
  });

  it("marks the selected deck in each column", () => {
    renderPicker();

    expect(
      document
        .querySelector('[data-cy="deck-picker-option-player-nekroz"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    const otherPlayerOptions = [
      ...document.querySelectorAll(
        '[data-cy^="deck-picker-option-player-"]:not([data-cy="deck-picker-option-player-nekroz"])',
      ),
    ];
    expect(otherPlayerOptions).toHaveLength(5);
    expect(
      otherPlayerOptions.every(
        (option) => option.getAttribute("aria-pressed") === "false",
      ),
    ).toBe(true);
  });

  it("clicking an option reports the new pair", async () => {
    const user = userEvent.setup();
    const onselect = vi.fn();
    renderPicker({ onselect });

    await user.click(
      document.querySelector(
        '[data-cy="deck-picker-option-opponent-shaddoll"]',
      ) as HTMLButtonElement,
    );

    expect(onselect).toHaveBeenCalledOnce();
    expect(onselect).toHaveBeenCalledWith("nekroz", "shaddoll");
  });

  it("start reports once", async () => {
    const user = userEvent.setup();
    const onstart = vi.fn();
    renderPicker({ onstart });

    await user.click(
      document.querySelector(
        '[data-cy="deck-picker-start-button"]',
      ) as HTMLButtonElement,
    );

    expect(onstart).toHaveBeenCalledOnce();
  });

  it("disabled blocks start", async () => {
    const user = userEvent.setup();
    const onstart = vi.fn();
    renderPicker({ disabled: true, onstart });
    const start = document.querySelector(
      '[data-cy="deck-picker-start-button"]',
    ) as HTMLButtonElement;

    expect(start.disabled).toBe(true);
    await user.click(start);
    expect(onstart).not.toHaveBeenCalled();
  });
});
