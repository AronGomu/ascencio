// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import DeckWorkspace from "../../../src/deck-editor/components/DeckWorkspace.svelte";
import type {
  DeckRecord,
  DeckValidationIssue,
} from "../../../src/decks/deck-contracts.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/catalog/pinned-ruleset.ts";
import {
  deckFixture,
  prototypeCatalogMap,
} from "../../fixtures/deck-editor.ts";

afterEach(() => cleanup());

const MAIN_ERROR: DeckValidationIssue = {
  id: "main-under-minimum:main-all",
  severity: "error",
  code: "main-under-minimum",
  message: "Main Deck needs 39 more card(s).",
  zone: "main",
};
const EXTRA_WARNING: DeckValidationIssue = {
  id: "empty-extra:extra-all",
  severity: "warning",
  code: "empty-extra",
  message: "Extra Deck is empty.",
  zone: "extra",
};
const SIDE_ERROR: DeckValidationIssue = {
  id: "side-over-maximum:side-all",
  severity: "error",
  code: "side-over-maximum",
  message: "Side Deck exceeds 15 cards by 1.",
  zone: "side",
};

function deckWith(
  issues: readonly DeckValidationIssue[],
  lists: Partial<Pick<DeckRecord, "main" | "extra" | "side">> = {},
): DeckRecord {
  return Object.freeze({
    ...deckFixture(1),
    ...lists,
    validation: Object.freeze({
      status: issues.some(({ severity }) => severity === "error")
        ? "errors"
        : issues.length > 0
          ? "warnings"
          : "valid",
      issues: Object.freeze([...issues]),
      rulesetRevision: "r1",
    }),
  });
}

function renderWorkspace(deck: DeckRecord) {
  return render(DeckWorkspace, {
    deck,
    catalog: prototypeCatalogMap,
    ruleset: PROTOTYPE_RULESET,
  });
}

function cy(container: HTMLElement, value: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[data-cy="${value}"]`);
  if (element === null) throw new Error(`Missing data-cy=${value}`);
  return element;
}

describe("deck validation issue grouping", () => {
  it("maps explicit zones before card membership and global issues to main", async () => {
    const explicit: DeckValidationIssue = {
      ...SIDE_ERROR,
      cardCode: 89631139,
    };
    const byCard: DeckValidationIssue = {
      id: "copy-limit:deck-89631139",
      severity: "error",
      code: "copy-limit",
      message: "Blue-Eyes White Dragon allows 1 copy/copies; found 2.",
      cardCode: 89631139,
    };
    const global: DeckValidationIssue = {
      id: "import-review:deck-all",
      severity: "warning",
      code: "import-review",
      message: "Imported deck has not been reviewed.",
    };
    const { container } = renderWorkspace(
      deckWith([explicit, byCard, global], {
        main: [89631139],
        extra: [],
        side: [89631139],
      }),
    );

    const mainIcon = cy(container, "deck-zone-error-main");
    const sideIcon = cy(container, "deck-zone-error-side");
    expect(mainIcon.getAttribute("aria-label")).toBe(
      "Main Deck has 2 validation errors",
    );
    expect(sideIcon.getAttribute("aria-label")).toBe(
      "Side Deck has 2 validation errors",
    );
    expect(
      container.querySelector('[data-cy="deck-zone-error-extra"]'),
    ).toBeNull();

    await fireEvent.focus(mainIcon);
    expect(cy(container, "deck-zone-error-tooltip-main").textContent).toContain(
      global.message,
    );
    expect(
      cy(container, "deck-zone-error-tooltip-main").textContent,
    ).not.toContain(explicit.message);
    await fireEvent.blur(mainIcon);
    await fireEvent.focus(sideIcon);
    expect(cy(container, "deck-zone-error-tooltip-side").textContent).toContain(
      explicit.message,
    );
  });
});

describe("deck validation UI", () => {
  it("marks only error zones, keeps warnings normal, and removes the old strip", () => {
    const { container } = renderWorkspace(
      deckWith([MAIN_ERROR, EXTRA_WARNING]),
    );

    expect(cy(container, "deck-zone-main").classList.contains("invalid")).toBe(
      true,
    );
    expect(cy(container, "deck-zone-extra").classList.contains("invalid")).toBe(
      false,
    );
    expect(cy(container, "deck-zone-side").classList.contains("invalid")).toBe(
      false,
    );
    expect(cy(container, "deck-zone-error-main")).toBeTruthy();
    expect(cy(container, "deck-zone-error-extra")).toBeTruthy();
    expect(
      container.querySelector('[data-cy="deck-zone-error-side"]'),
    ).toBeNull();
    expect(container.querySelector('[data-cy="deck-validation"]')).toBeNull();
  });

  it("shows exact ordered messages on pointer hover and closes on pointer leave", async () => {
    const { container } = renderWorkspace(
      deckWith([
        MAIN_ERROR,
        {
          id: "import-review:deck-all",
          code: "import-review",
          severity: "warning",
          message: "Imported deck has not been reviewed.",
        },
      ]),
    );
    const icon = cy(container, "deck-zone-error-main");

    await fireEvent.pointerEnter(icon, { pointerType: "mouse" });
    const tooltip = cy(container, "deck-zone-error-tooltip-main");
    expect(icon.getAttribute("aria-expanded")).toBe("true");
    expect(icon.getAttribute("aria-describedby")).toBe(tooltip.id);
    expect(
      [...tooltip.querySelectorAll("li")].map(({ textContent }) => textContent),
    ).toEqual([
      "Main Deck needs 39 more card(s).",
      "Imported deck has not been reviewed.",
    ]);

    await fireEvent.pointerLeave(icon, { pointerType: "mouse" });
    expect(
      container.querySelector('[data-cy="deck-zone-error-tooltip-main"]'),
    ).toBeNull();
  });

  it("opens on focus, closes on Escape or blur, and exposes expanded state", async () => {
    const { container } = renderWorkspace(deckWith([MAIN_ERROR]));
    const icon = cy(container, "deck-zone-error-main");

    await fireEvent.focus(icon);
    expect(icon.getAttribute("aria-expanded")).toBe("true");
    expect(cy(container, "deck-zone-error-tooltip-main")).toBeTruthy();

    await fireEvent.keyDown(icon, { key: "Escape" });
    expect(icon.getAttribute("aria-expanded")).toBe("false");
    expect(
      container.querySelector('[data-cy="deck-zone-error-tooltip-main"]'),
    ).toBeNull();

    await fireEvent.focus(icon);
    await fireEvent.blur(icon);
    expect(icon.getAttribute("aria-expanded")).toBe("false");
  });

  it("toggles on touch-style activation", async () => {
    const { container } = renderWorkspace(deckWith([MAIN_ERROR]));
    const icon = cy(container, "deck-zone-error-main");

    await fireEvent.pointerDown(icon, { pointerType: "touch" });
    await fireEvent.focus(icon);
    await fireEvent.click(icon);
    expect(icon.getAttribute("aria-expanded")).toBe("true");

    await fireEvent.click(icon);
    expect(icon.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps an invalid side indicator visible while side is collapsed", () => {
    const { container } = renderWorkspace(deckWith([SIDE_ERROR]));

    expect(container.querySelector("#deck-zone-body-side")).toBeNull();
    expect(cy(container, "deck-zone-side").classList.contains("invalid")).toBe(
      true,
    );
    expect(cy(container, "deck-zone-error-side")).toBeTruthy();
  });

  it("renders no indicators or red borders for a legal issue-free deck", () => {
    const { container } = renderWorkspace(deckWith([]));

    expect(container.querySelectorAll(".zone.invalid")).toHaveLength(0);
    expect(container.querySelector('[data-cy^="deck-zone-error-"]')).toBeNull();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
