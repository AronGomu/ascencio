// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckLibrary from "../../../src/deck-editor/components/DeckLibrary.svelte";
import { deckFixture } from "../../fixtures/deck-editor.ts";
import { deckId, type DeckRecord } from "../../../src/decks/deck-contracts.ts";

afterEach(() => cleanup());

function callbacks() {
  return {
    oncreate: vi.fn(),
    onopen: vi.fn(),
    onrename: vi.fn(),
    onduplicate: vi.fn(),
    ondelete: vi.fn(),
    onexport: vi.fn(),
    onimport: vi.fn(),
    onsetdefault: vi.fn(),
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
    const matching = screen.getByRole("button", { name: /Prototype Control/ });
    expect(matching).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Other/ })).toBeNull();
    await userEvent.setup().click(matching);
    expect(values.onopen).toHaveBeenCalledWith(deck.id);
  });

  it("set default marks the row with the default badge", async () => {
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
    const setDefault = () =>
      document.querySelector<HTMLButtonElement>(
        `[data-cy="deck-library-set-default-${deck.id}"]`,
      )!;
    expect(badge()).toBeNull();
    expect(setDefault().disabled).toBe(false);
    await userEvent.setup().click(setDefault());
    expect(values.onsetdefault).toHaveBeenCalledWith(deck.id);

    /* The controller owns which deck is default, so the row only claims the
       badge once the refreshed state says so. */
    await rerender({ decks: [deck], defaultDeckId: deck.id, ...values });
    expect(badge()?.textContent).toContain("Default");
    expect(setDefault().disabled).toBe(true);
  });
});
