// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckPicker from "../../src/app/components/DeckPicker.svelte";
import type { SelectableDeck } from "../../src/battle/decks/selectable-decks.ts";
import { deckId } from "../../src/decks/index.ts";
import { DECK_CATALOG } from "../../src/duel/presets/deck-catalog.ts";

afterEach(() => cleanup());

const PRESET_DECKS: readonly SelectableDeck[] = DECK_CATALOG.map((preset) => ({
  key: `preset:${preset.id}`,
  label: preset.name,
  source: "preset",
  selection: { kind: "preset", deckId: preset.id },
}));

/* The picker never reads the card list — it only shows the label and reports
   the key — so the seat's snapshot is left empty here on purpose. */
const LOCAL_DECK: SelectableDeck = {
  key: "local:built-deck:2",
  label: "Built Deck",
  source: "local",
  selection: {
    kind: "local",
    deck: {
      ref: { type: "local", deckId: deckId("built-deck"), revision: 2 },
      name: "Built Deck",
      validationDigest: "fnv1a-0",
      main: [],
      extra: [],
      side: [],
    },
  },
};

function renderPicker(overrides: Record<string, unknown> = {}) {
  return render(DeckPicker, {
    decks: PRESET_DECKS,
    playerKey: "preset:nekroz",
    opponentKey: "preset:mvp-opponent",
    ...overrides,
  });
}

function query(value: string): HTMLElement | null {
  return document.querySelector(`[data-cy="${value}"]`);
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
      query("deck-picker-option-player-preset:nekroz")?.getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
    const otherPlayerOptions = [
      ...document.querySelectorAll(
        '[data-cy^="deck-picker-option-player-"]:not([data-cy="deck-picker-option-player-preset:nekroz"])',
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
      query("deck-picker-option-opponent-preset:shaddoll") as HTMLButtonElement,
    );

    expect(onselect).toHaveBeenCalledOnce();
    expect(onselect).toHaveBeenCalledWith("preset:nekroz", "preset:shaddoll");
  });

  it("start reports once", async () => {
    const user = userEvent.setup();
    const onstart = vi.fn();
    renderPicker({ onstart });

    await user.click(query("deck-picker-start-button") as HTMLButtonElement);

    expect(onstart).toHaveBeenCalledOnce();
  });

  it("disabled blocks start", async () => {
    const user = userEvent.setup();
    const onstart = vi.fn();
    renderPicker({ disabled: true, onstart });
    const start = query("deck-picker-start-button") as HTMLButtonElement;

    expect(start.disabled).toBe(true);
    await user.click(start);
    expect(onstart).not.toHaveBeenCalled();
  });

  it("renders a labelled group per source when both exist", () => {
    renderPicker({ decks: [...PRESET_DECKS, LOCAL_DECK] });

    expect(query("deck-picker-group-preset")).not.toBeNull();
    expect(query("deck-picker-group-local")).not.toBeNull();
    expect(
      document.getElementById("deck-picker-preset-label")?.textContent,
    ).toBe("Bundled decks");
    expect(
      document.getElementById("deck-picker-local-label")?.textContent,
    ).toBe("Your decks");
    expect(
      query("deck-picker-option-player-local:built-deck:2")?.textContent,
    ).toBe("Built Deck");
  });

  it("hides the local group when no local deck qualifies", () => {
    renderPicker();

    expect(query("deck-picker-group-preset")).not.toBeNull();
    expect(query("deck-picker-group-local")).toBeNull();
    expect(query("deck-picker-start-button")).not.toBeNull();
  });

  it("selects a local deck for one seat and keeps the other preset", async () => {
    const user = userEvent.setup();
    const onselect = vi.fn();
    renderPicker({ decks: [...PRESET_DECKS, LOCAL_DECK], onselect });

    await user.click(
      query("deck-picker-option-player-local:built-deck:2") as HTMLElement,
    );

    expect(onselect).toHaveBeenCalledWith(
      "local:built-deck:2",
      "preset:mvp-opponent",
    );
  });

  it("shows the fallback notice only when the host asks for it", () => {
    const { rerender } = renderPicker();
    expect(query("deck-picker-fallback-notice")).toBeNull();

    rerender({ decks: PRESET_DECKS, fallbackNotice: true });
    expect(
      document.querySelectorAll('[data-cy="deck-picker-fallback-notice"]'),
    ).toHaveLength(1);
  });

  it("shows a start error as an assertive, recoverable message", () => {
    renderPicker({ startError: "That deck is no longer available." });
    const error = query("deck-picker-start-error");

    expect(error?.getAttribute("role")).toBe("alert");
    expect(error?.textContent?.trim()).toBe(
      "That deck is no longer available.",
    );
    expect(
      (query("deck-picker-start-button") as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
