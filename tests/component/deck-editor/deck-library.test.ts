// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckLibrary from "../../../src/deck-editor/components/DeckLibrary.svelte";
import { deckFixture } from "../../fixtures/deck-editor.ts";
import {
  deckId,
  type DeckRecord,
  type DeckValidationIssue,
} from "../../../src/decks/deck-contracts.ts";

afterEach(() => cleanup());

const NOT_OWNED: DeckValidationIssue = {
  id: "not-owned:deck-89631139",
  severity: "error",
  code: "not-owned",
  message: "This deck uses 2 copy/copies of Blue-Eyes White Dragon; you own 1.",
  cardCode: 89631139,
};

const UNDER_MINIMUM: DeckValidationIssue = {
  id: "main-under-minimum",
  severity: "error",
  code: "main-under-minimum",
  message: "Main Deck needs 40 more card(s).",
  zone: "main",
};

function callbacks() {
  return {
    oncreate: vi.fn(),
    onopen: vi.fn(),
    onimport: vi.fn(),
  };
}

describe("DeckLibrary", () => {
  it("shows blank-first create/import empty state without selection UI", async () => {
    const values = callbacks();
    render(DeckLibrary, { decks: [], ...values });
    expect(
      screen.getByRole("heading", { name: "No local decks" }),
    ).toBeTruthy();
    expect(screen.queryByText(/template/i)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /select|use deck/i }),
    ).toBeNull();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Create blank deck" }));
    expect(
      screen.getByRole("heading", { name: "Create blank deck" }),
    ).toBeTruthy();
  });

  it("warns on duplicate names without conflating deck IDs", async () => {
    const values = callbacks();
    render(DeckLibrary, { decks: [deckFixture()], ...values });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Create deck" }));
    await user.type(screen.getByLabelText("Deck name"), "Prototype Control");
    expect(screen.getByRole("status").textContent).toContain(
      "Another deck already uses this name",
    );
    expect(screen.getByRole("button", { name: /^Create$/ })).not.toHaveProperty(
      "disabled",
      true,
    );
  });

  it("the import button reads Import Deck", () => {
    render(DeckLibrary, { decks: [], ...callbacks() });
    expect(screen.getByRole("button", { name: "Import Deck" })).toBeTruthy();
  });

  it("the library renders no eyebrow or subtitle", () => {
    render(DeckLibrary, { decks: [], ...callbacks() });
    expect(
      document.querySelector('[data-cy="deck-library-eyebrow"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-cy="deck-library-subtitle"]'),
    ).toBeNull();
  });

  it("a warning deck gets an orange halo and a tooltip listing its issues", () => {
    const deck: DeckRecord = {
      ...deckFixture(),
      id: deckId("w1"),
      validation: {
        status: "warnings",
        issues: [
          {
            id: "empty-side",
            severity: "warning",
            code: "empty-side",
            message: "Side Deck is empty.",
            zone: "side",
          },
        ],
        rulesetRevision: "prototype-2026-01",
      },
    };
    render(DeckLibrary, { decks: [deck], ...callbacks() });
    const btn = document.querySelector('[data-cy="deck-library-open-w1"]');
    expect(btn?.classList.contains("halo-warnings")).toBe(true);
    expect(btn?.getAttribute("data-validation-status")).toBe("warnings");
    expect(btn?.getAttribute("title")).toContain("Side Deck is empty.");
  });

  it("an errors deck gets the red halo", () => {
    const deck: DeckRecord = {
      ...deckFixture(),
      id: deckId("e1"),
      validation: {
        status: "errors",
        issues: [
          {
            id: "main-under-minimum",
            severity: "error",
            code: "main-under-minimum",
            message: "Main Deck needs 40 more card(s).",
            zone: "main",
          },
        ],
        rulesetRevision: "prototype-2026-01",
      },
    };
    render(DeckLibrary, { decks: [deck], ...callbacks() });
    const btn = document.querySelector('[data-cy="deck-library-open-e1"]');
    expect(btn?.classList.contains("halo-errors")).toBe(true);
    expect(btn?.getAttribute("data-validation-status")).toBe("errors");
  });

  /* The halo alone says "something is wrong"; the badge says the deck cannot be
     fielded, and names ownership when that is why. A player who sold a card
     never edited this deck, so "Illegal" on its own would send them to the
     editor to look for a mistake they did not make. */
  it("an illegal deck wears a badge naming ownership as the cause", () => {
    const deck: DeckRecord = {
      ...deckFixture(),
      id: deckId("o1"),
      validation: {
        status: "errors",
        issues: [NOT_OWNED],
        rulesetRevision: "prototype-2026-01",
      },
    };
    render(DeckLibrary, { decks: [deck], ...callbacks() });
    const badge = document.querySelector('[data-cy="deck-library-illegal-o1"]');
    expect(badge?.classList.contains("illegal-badge")).toBe(true);
    expect(badge?.textContent).toContain("Cards not owned");
    expect(
      document
        .querySelector('[data-cy="deck-library-open-o1"]')
        ?.getAttribute("title"),
    ).toContain("Blue-Eyes White Dragon");
  });

  it("a build-rule error is badged illegal without blaming ownership", () => {
    const deck: DeckRecord = {
      ...deckFixture(),
      id: deckId("e2"),
      validation: {
        status: "errors",
        issues: [UNDER_MINIMUM],
        rulesetRevision: "prototype-2026-01",
      },
    };
    render(DeckLibrary, { decks: [deck], ...callbacks() });
    expect(
      document.querySelector('[data-cy="deck-library-illegal-e2"]')
        ?.textContent,
    ).toContain("Illegal");
  });

  /* Buying the card back would not make this deck legal, so the badge must not
     promise that it would. */
  it("a deck short of cards and of a build rule is not blamed on ownership", () => {
    const deck: DeckRecord = {
      ...deckFixture(),
      id: deckId("b1"),
      validation: {
        status: "errors",
        issues: [NOT_OWNED, UNDER_MINIMUM],
        rulesetRevision: "prototype-2026-01",
      },
    };
    render(DeckLibrary, { decks: [deck], ...callbacks() });
    expect(
      document.querySelector('[data-cy="deck-library-illegal-b1"]')
        ?.textContent,
    ).toContain("Illegal");
  });

  /* A warning alongside the ownership error must not cost the row its wording:
     the empty Extra and Side decks the starter deck ships with are warnings, and
     the deck is still illegal for exactly one reason. */
  it("a warning alongside the ownership error keeps the ownership wording", () => {
    const deck: DeckRecord = {
      ...deckFixture(),
      id: deckId("b2"),
      validation: {
        status: "errors",
        issues: [
          NOT_OWNED,
          {
            id: "empty-side",
            severity: "warning",
            code: "empty-side",
            message: "Side Deck is empty.",
            zone: "side",
          },
        ],
        rulesetRevision: "prototype-2026-01",
      },
    };
    render(DeckLibrary, { decks: [deck], ...callbacks() });
    expect(
      document.querySelector('[data-cy="deck-library-illegal-b2"]')
        ?.textContent,
    ).toContain("Cards not owned");
  });

  /* Warnings are not illegal, and this is the case that would lock a brand-new
     save out of the game: the granted starter deck has no Extra and no Side
     deck, so its honest verdict is two warnings. */
  it("a warning deck wears no illegal badge", () => {
    const deck: DeckRecord = {
      ...deckFixture(),
      id: deckId("w2"),
      validation: {
        status: "warnings",
        issues: [
          {
            id: "empty-extra",
            severity: "warning",
            code: "empty-extra",
            message: "Extra Deck is empty.",
            zone: "extra",
          },
        ],
        rulesetRevision: "prototype-2026-01",
      },
    };
    render(DeckLibrary, { decks: [deck], ...callbacks() });
    expect(
      document.querySelector('[data-cy="deck-library-illegal-w2"]'),
    ).toBeNull();
  });

  it("a valid deck gets the green halo and no tooltip", () => {
    const deck: DeckRecord = {
      ...deckFixture(),
      id: deckId("v1"),
      validation: {
        status: "valid",
        issues: [],
        rulesetRevision: "prototype-2026-01",
      },
    };
    render(DeckLibrary, { decks: [deck], ...callbacks() });
    const btn = document.querySelector('[data-cy="deck-library-open-v1"]');
    expect(btn?.classList.contains("halo-valid")).toBe(true);
    expect(btn?.getAttribute("data-validation-status")).toBe("valid");
    expect(btn?.getAttribute("title")).toBeNull();
  });

  it("the status text row is gone", () => {
    render(DeckLibrary, { decks: [deckFixture()], ...callbacks() });
    expect(
      document.querySelector('[data-cy^="deck-library-status-"]'),
    ).toBeNull();
  });

  it("searches by name and opens matching decks", async () => {
    const values = callbacks();
    const deck = deckFixture();
    render(DeckLibrary, {
      decks: [deck, { ...deck, id: deckId("other"), name: "Other" }],
      ...values,
    });
    await userEvent
      .setup()
      .type(
        screen.getByRole("searchbox", { name: "Search decks" }),
        "Prototype",
      );
    const matching = screen.getByRole("button", { name: /^Prototype Control/ });
    expect(matching).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Other/ })).toBeNull();
    await userEvent.setup().click(matching);
    expect(values.onopen).toHaveBeenCalledWith(deck.id);
  });

  it("the default badge appears when defaultDeckId matches the row", async () => {
    const values = callbacks();
    const deck = deckFixture();
    const { rerender } = render(DeckLibrary, {
      decks: [deck],
      defaultDeckId: null,
      ...values,
    });
    const badge = () =>
      document.querySelector(
        `[data-cy="deck-library-default-badge-${deck.id}"]`,
      );
    expect(badge()).toBeNull();

    /* The controller owns which deck is default, so the row only claims the
       badge once the refreshed state says so. */
    await rerender({ decks: [deck], defaultDeckId: deck.id, ...values });
    expect(badge()?.textContent).toContain("Default");
  });
});
