// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import CardPreviewPanel from "../../src/shared-svelte-ui/card-preview/CardPreviewPanel.svelte";
import type { CardPreviewView } from "../../src/shared-svelte-ui/card-preview/index.ts";

afterEach(() => cleanup());

function preview(overrides: Partial<CardPreviewView> = {}): CardPreviewView {
  return {
    key: "97590747",
    name: "The Legendary Fisherman",
    description: "This card is unaffected by Spell effects.",
    statsLine: null,
    imageUrl: null,
    imageAlt: "The Legendary Fisherman",
    placeholderLabel: "Image unavailable",
    ...overrides,
  };
}

function renderPanel(value: CardPreviewView | null = preview()) {
  return render(CardPreviewPanel, {
    preview: value,
    dataCyPrefix: "test-preview",
    emptyLabel: "Hover a card to see its details.",
  });
}

describe("CardPreviewPanel", () => {
  it("panel shows host-provided empty state", () => {
    renderPanel(null);
    expect(screen.getByText("Hover a card to see its details.")).toBeTruthy();
    expect(
      document.querySelector('[data-cy="test-preview-empty"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="test-preview-name"]')).toBeNull();
  });

  it("renders complete preview VM without provider access", () => {
    renderPanel(
      preview({
        imageUrl: "blob:fisherman",
        statsLine: "WATER · Warrior · Level 5 · ATK 1850 / DEF 1600",
      }),
    );
    expect(
      document
        .querySelector('[data-cy="test-preview-image"]')
        ?.getAttribute("src"),
    ).toBe("blob:fisherman");
    expect(
      document
        .querySelector('[data-cy="test-preview-image"]')
        ?.getAttribute("alt"),
    ).toBe("The Legendary Fisherman");
    expect(
      document.querySelector('[data-cy="test-preview-stats"]')?.textContent,
    ).toContain("ATK 1850");
  });

  it("uses placeholder for missing and failed optional media then recovers on key change", async () => {
    const rendered = renderPanel();
    expect(
      screen.getByRole("img", {
        name: "Card image unavailable for The Legendary Fisherman",
      }),
    ).toBeTruthy();

    await rendered.rerender({
      preview: preview({ imageUrl: "blob:broken" }),
      dataCyPrefix: "test-preview",
      emptyLabel: "Hover a card to see its details.",
    });
    await fireEvent.error(
      document.querySelector('[data-cy="test-preview-image"]')!,
    );
    expect(document.querySelector('[data-cy="test-preview-image"]')).toBeNull();

    await rendered.rerender({
      preview: preview({
        key: "89631139",
        name: "Blue-Eyes White Dragon",
        imageUrl: "blob:blue-eyes",
        imageAlt: "Blue-Eyes White Dragon",
        placeholderLabel: "Image unavailable",
      }),
      dataCyPrefix: "test-preview",
      emptyLabel: "Hover a card to see its details.",
    });
    expect(
      document
        .querySelector('[data-cy="test-preview-image"]')
        ?.getAttribute("src"),
    ).toBe("blob:blue-eyes");
  });

  it.each([
    ["Home", 0],
    ["End", 500],
    ["PageUp", 100],
    ["PageDown", 300],
  ] as const)("preserves %s text scrolling", async (key, expected) => {
    renderPanel();
    const text = document.querySelector<HTMLElement>(
      '[data-cy="test-preview-text"]',
    )!;
    Object.defineProperties(text, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 500 },
    });
    text.scrollTop = 200;
    const event = await fireEvent.keyDown(text, { key });
    expect(text.scrollTop).toBe(expected);
    expect(event).toBe(false);
  });
});
