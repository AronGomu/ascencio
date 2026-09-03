// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckLibrary from "../../../src/deck-editor/components/DeckLibrary.svelte";
import {
  deckFixture,
  prototypeCatalogMap,
} from "../../fixtures/deck-editor.ts";
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

function find(value: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${value}"]`);
}

function cy(value: string): HTMLElement {
  const element = find(value);
  if (element === null) throw new Error(`No element with data-cy "${value}"`);
  return element;
}

/** A deck the library may actually field, so the grid lets it be pressed. */
function legalDeck(id: string, name = "Prototype Control"): DeckRecord {
  return Object.freeze({ ...deckFixture(40), id: deckId(id), name });
}

function illegalDeck(
  id: string,
  issues: readonly DeckValidationIssue[],
): DeckRecord {
  return Object.freeze({
    ...deckFixture(),
    id: deckId(id),
    validation: {
      status: "errors" as const,
      issues,
      rulesetRevision: "prototype-2026-01",
    },
  });
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
    await user.click(cy("deck-select-create"));
    await user.type(screen.getByLabelText("Deck name"), "Prototype Control");
    expect(screen.getByRole("status").textContent).toContain(
      "Another deck already uses this name",
    );
    expect(cy("deck-library-create-submit")).not.toHaveProperty(
      "disabled",
      true,
    );
  });

  it("the create dialog still creates", async () => {
    const values = callbacks();
    render(DeckLibrary, { decks: [deckFixture()], ...values });
    const user = userEvent.setup();

    await user.click(cy("deck-select-create"));
    await user.type(cy("deck-library-create-name-input"), "Fresh Build");
    await user.click(cy("deck-library-create-submit"));

    expect(values.oncreate).toHaveBeenCalledWith("Fresh Build");
  });

  it("the import button reads Import Deck", () => {
    render(DeckLibrary, { decks: [], ...callbacks() });
    expect(screen.getByRole("button", { name: "Import Deck" })).toBeTruthy();
  });

  /* The library and duel start are one screen with two frames, so the library
     says which frame it is: the eyebrow names the deck builder, the title the
     library itself. */
  it("the library names itself in the shared screen's header", () => {
    render(DeckLibrary, { decks: [deckFixture()], ...callbacks() });
    expect(cy("deck-select-eyebrow").textContent).toBe("Deck builder");
    expect(cy("deck-select-title").textContent).toBe("Deck library");
  });

  it("the library renders tiles and focuses on press", async () => {
    const values = callbacks();
    render(DeckLibrary, {
      decks: [legalDeck("t1", "Alpha"), legalDeck("t2", "Bravo")],
      ...values,
    });
    expect(find("deck-tile-t1")).not.toBeNull();
    expect(find("deck-tile-t2")).not.toBeNull();
    expect(cy("deck-tile-t1").classList.contains("halo-focus")).toBe(false);

    await userEvent.setup().click(cy("deck-tile-press-t2"));

    /* Teal halo, and nothing else: the library fills no seat, so a press is a
       focus and never a navigation. */
    expect(cy("deck-tile-t2").classList.contains("halo-focus")).toBe(true);
    expect(cy("deck-tile-t1").classList.contains("halo-focus")).toBe(false);
    expect(values.onopen).not.toHaveBeenCalled();
  });

  it("dblclick opens the deck", async () => {
    const values = callbacks();
    const deck = legalDeck("t1");
    render(DeckLibrary, { decks: [deck], ...values });

    await fireEvent.dblClick(cy("deck-tile-press-t1"));

    expect(values.onopen).toHaveBeenCalledWith(deck.id);
  });

  it("kebab rename, duplicate and delete reach the host with the deck's identity", async () => {
    const values = callbacks();
    const onrename = vi.fn();
    const onduplicate = vi.fn();
    const ondelete = vi.fn();
    const deck = legalDeck("t1");
    render(DeckLibrary, {
      decks: [deck],
      onrename,
      onduplicate,
      ondelete,
      ...values,
    });
    const user = userEvent.setup();

    await user.click(cy("deck-tile-menu-t1"));
    await user.click(cy("deck-tile-menu-duplicate-t1"));
    expect(onduplicate).toHaveBeenCalledWith(deck.id);

    await user.click(cy("deck-tile-menu-t1"));
    await user.click(cy("deck-tile-menu-rename-t1"));
    await user.clear(cy("deck-select-rename-input"));
    await user.type(cy("deck-select-rename-input"), "Renamed Deck");
    await user.click(cy("deck-select-rename-submit"));
    expect(onrename).toHaveBeenCalledWith(deck.id, "Renamed Deck");

    await user.click(cy("deck-tile-menu-t1"));
    await user.click(cy("deck-tile-menu-delete-t1"));
    /* Deleting quotes the revision the library is holding, so storage can
       refuse a delete aimed at a deck that moved on. */
    await user.click(cy("deck-select-delete-confirm-button"));
    expect(ondelete).toHaveBeenCalledWith(deck.id, deck.revision);
  });

  /* Dimming echoes the tag line; the concrete reason still names repair. */
  it("an illegal deck is dimmed, tagged, and cannot be picked", () => {
    render(DeckLibrary, {
      decks: [illegalDeck("o1", [NOT_OWNED])],
      ...callbacks(),
    });

    expect(cy("deck-tile-o1").classList.contains("illegal")).toBe(true);
    expect(cy("deck-tile-tags-o1").textContent).toContain("Illegal");
    expect(
      cy("deck-tile-press-o1").hasAttribute("disabled"),
      "an illegal deck cannot be pressed",
    ).toBe(true);
  });

  it("an illegal deck names ownership as the cause when that is the whole story", () => {
    render(DeckLibrary, {
      decks: [illegalDeck("o1", [NOT_OWNED])],
      ...callbacks(),
    });
    expect(cy("deck-tile-tags-o1").textContent).toContain("Cards not owned");
  });

  it("a build-rule error is blocked without blaming ownership", () => {
    render(DeckLibrary, {
      decks: [illegalDeck("e2", [UNDER_MINIMUM])],
      ...callbacks(),
    });
    expect(cy("deck-tile-tags-e2").textContent).toContain("Illegal");
  });

  /* Buying the card back would not make this deck legal, so the meta line must
     not promise that it would. */
  it("a deck short of cards and of a build rule is not blamed on ownership", () => {
    render(DeckLibrary, {
      decks: [illegalDeck("b1", [NOT_OWNED, UNDER_MINIMUM])],
      ...callbacks(),
    });
    expect(cy("deck-tile-tags-b1").textContent).toContain("Illegal");
  });

  /* Warnings are not illegal, and this is the case that would lock a brand-new
     save out of the game: the granted starter deck has no Extra and no Side
     deck, so its honest verdict is two warnings. */
  it("a warning deck wears no illegal badge and stays pickable", () => {
    const deck: DeckRecord = {
      ...legalDeck("w2"),
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

    expect(cy("deck-tile-tags-w2").textContent).not.toContain("Illegal");
    expect(cy("deck-tile-press-w2").hasAttribute("disabled")).toBe(false);
    expect(cy("deck-tile-tags-w2").textContent).toBe("Local deck");
  });

  it("the status text row is gone", () => {
    render(DeckLibrary, { decks: [deckFixture()], ...callbacks() });
    expect(
      document.querySelector('[data-cy^="deck-library-status-"]'),
    ).toBeNull();
  });

  it("filters by name and opens a matching deck", async () => {
    const values = callbacks();
    const deck = legalDeck("t1");
    render(DeckLibrary, {
      decks: [deck, legalDeck("other", "Other")],
      ...values,
    });
    const user = userEvent.setup();

    await user.type(cy("deck-select-filter"), "Prototype");

    expect(find("deck-tile-t1")).not.toBeNull();
    expect(find("deck-tile-other")).toBeNull();
    expect(cy("deck-select-count").textContent).toBe("1/2");

    await fireEvent.dblClick(cy("deck-tile-press-t1"));
    expect(values.onopen).toHaveBeenCalledWith(deck.id);
  });

  it("a filter that matches nothing leaves an empty grid and a zero count", async () => {
    render(DeckLibrary, { decks: [legalDeck("t1")], ...callbacks() });

    await userEvent.setup().type(cy("deck-select-filter"), "zzz");

    expect(find("deck-tile-t1")).toBeNull();
    expect(cy("deck-select-count").textContent).toBe("0/1");
  });

  it("reports a star press and fills it after refreshed default state", async () => {
    const values = callbacks();
    const onsetdefault = vi.fn();
    const deck = legalDeck("t1");
    const base = {
      decks: [deck],
      defaultDeckId: null,
      ...values,
      onsetdefault,
    };
    const { rerender } = render(DeckLibrary, base);
    const star = () =>
      find(`deck-tile-default-star-${deck.id}`) as HTMLButtonElement | null;
    expect(star()?.disabled).toBe(false);

    await userEvent.setup().click(star()!);
    expect(onsetdefault).toHaveBeenCalledExactlyOnceWith(deck.id);

    /* Controller owns default; star fills only after refreshed state. */
    await rerender({ ...base, defaultDeckId: deck.id });
    expect(star()?.disabled).toBe(true);
    expect(star()?.getAttribute("aria-label")).toBe("Default deck");
  });

  /* The docked column is the focused deck's own list, so it has to stop being
     that deck's list the moment the library stops holding it — otherwise a
     deck the player just deleted keeps its cards on screen. */
  it("maps catalog frame and cropped art into docked rows", async () => {
    const spell = prototypeCatalogMap.get(12580477);
    if (spell === undefined) throw new Error("Missing spell fixture");
    const deck = Object.freeze({
      ...legalDeck("t1"),
      main: Object.freeze([1]),
    });
    const catalog = new Map([
      [
        1,
        {
          ...spell,
          code: 1,
          imageUrl: "/runtime/images/1.jpg",
        },
      ],
    ]);
    render(DeckLibrary, { decks: [deck], catalog, ...callbacks() });

    await userEvent.setup().click(cy("deck-tile-press-t1"));
    await waitFor(() =>
      expect(find("deck-select-docked-list-row-1")).not.toBeNull(),
    );

    const row = cy("deck-select-docked-list-row-1");
    expect(row.style.getPropertyValue("--fc")).toBe("#1d9e74");
    expect(row.style.getPropertyValue("--img")).toContain(
      "/runtime/images-cropped/1.jpg",
    );
    expect(find("deck-select-docked-list-row-art-1")).not.toBeNull();
  });

  it("the docked decklist follows the library it was resolved from", async () => {
    const kept = legalDeck("t1", "Kept");
    const doomed = legalDeck("t2", "Doomed");
    const values = callbacks();
    const { rerender } = render(DeckLibrary, {
      decks: [kept, doomed],
      catalog: prototypeCatalogMap,
      ...values,
    });

    await userEvent.setup().click(cy("deck-tile-press-t2"));
    /* The pointer leaves the tile the moment it reaches the kebab's confirm
       dialog, so the dock is showing the focused deck's resting list rather
       than a hover by the time the deck goes. */
    await fireEvent.pointerLeave(cy("deck-tile-t2"));
    await waitFor(() => expect(find("deck-select-docked-list")).not.toBeNull());
    expect(cy("deck-select-docked-list-main-heading").textContent).toBe(
      "Main (40)",
    );

    await rerender({ decks: [kept], catalog: prototypeCatalogMap, ...values });

    await waitFor(() =>
      expect(find("deck-select-docked-empty")).not.toBeNull(),
    );
    expect(find("deck-select-docked-list")).toBeNull();
  });

  it("Back reports out rather than routing itself", async () => {
    const onback = vi.fn();
    render(DeckLibrary, { decks: [legalDeck("t1")], onback, ...callbacks() });

    await userEvent.setup().click(cy("deck-select-back"));

    expect(onback).toHaveBeenCalledOnce();
  });
});
