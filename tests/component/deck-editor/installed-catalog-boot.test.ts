// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { deleteDB } from "idb";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckEditorApp from "../../../src/deck-editor/index.ts";
import {
  DECK_DATABASE_NAME,
  IndexedDbDeckRepository,
} from "../../../src/decks/repository/index.ts";
import { installedDuelGameplayFixture } from "../../fixtures/installed-duel-gameplay.ts";
import { installedEditorCatalog } from "../../../src/shell/cards/installed-editor-catalog.ts";

function query(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${name}"]`);
}

function expectNoImageFallback(): void {
  expect(
    document.querySelector(
      '[data-cy="deck-editor-app"] img[src]:not([src=""])',
    ),
  ).toBeNull();
}

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await deleteDB(DECK_DATABASE_NAME);
});

describe("deck editor catalog boot", () => {
  it.each([
    "/runtime/images/123.jpg",
    "runtime/images/123.jpg",
    "blob:card-art",
  ])("required-only image assertion rejects fallback %s", (source) => {
    const app = document.createElement("div");
    app.dataset.cy = "deck-editor-app";
    const image = document.createElement("img");
    image.setAttribute("src", source);
    app.append(image);
    document.body.append(app);
    try {
      expect(expectNoImageFallback).toThrow();
    } finally {
      app.remove();
    }
  });
  it("Editor required-only boot: catalog present, images null, edit/save usable", async () => {
    const unexpectedFetch = vi.fn(() => {
      throw new Error(
        "Unexpected fetch during required-only editor boot/edit/save",
      );
    });
    vi.stubGlobal("fetch", unexpectedFetch);
    const catalogInput = installedEditorCatalog(installedDuelGameplayFixture());
    const { rerender } = render(DeckEditorApp, {
      catalogInput,
      deckId: null,
      onnavigate: vi.fn(),
    });

    await waitFor(() => expect(query("deck-library")).not.toBeNull());
    expect(query("deck-editor-error")).toBeNull();
    expectNoImageFallback();
    expect(unexpectedFetch).not.toHaveBeenCalled();
    expect(
      document.querySelector('[data-cy^="deck-tile-art-placeholder-"]'),
    ).not.toBeNull();
    const repository = await IndexedDbDeckRepository.open();
    try {
      const decks = await repository.list();
      expect(decks.length).toBeGreaterThan(0);
      const edit = document.querySelector<HTMLElement>(
        '[data-cy^="deck-tile-press-"]',
      );
      expect(edit).not.toBeNull();
      await fireEvent.click(edit!);
      await rerender({ deckId: decks[0]!.id });
      await waitFor(() => expect(query("deck-name-input")).not.toBeNull());
      expect(query("deck-catalog-result-count")?.textContent).toMatch(
        /^[1-9][0-9]* results$/,
      );
      expectNoImageFallback();
      expect(unexpectedFetch).not.toHaveBeenCalled();
      query("deck-name-input")!.focus();
      await fireEvent.input(query("deck-name-input")!, {
        target: { value: "Required only" },
      });
      await fireEvent.blur(query("deck-name-input")!);
      await waitFor(async () =>
        expect(
          (await repository.list()).some(
            (deck) => deck.name === "Required only",
          ),
        ).toBe(true),
      );
      expectNoImageFallback();
      expect(unexpectedFetch).not.toHaveBeenCalled();
    } finally {
      repository.close();
    }
  });
});
