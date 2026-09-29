// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckEditorApp from "../../../src/deck-editor/index.ts";
import {
  DeckStorageError,
  type DeckContext,
} from "../../../src/decks/repository/index.ts";

import { installedEditorCatalog } from "../../fixtures/installed-gameplay.ts";
import { installedDuelGameplayFixture } from "../../fixtures/installed-duel-gameplay.ts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function query(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${name}"]`);
}

/* Replaces the implicit IndexedDB upgrade-blocked startup case: the caller
   now supplies a synchronous repository factory, whose refusal rejects the
   async context resolution. The editor must not open legacy storage instead. */
describe("deck editor injected repository refusal", () => {
  it("renders the typed startup error without implicitly opening legacy storage", async () => {
    const failure = new DeckStorageError("USER_DATA_UNAVAILABLE");
    const createRepository = vi.fn<DeckContext["createRepository"]>(() => {
      throw failure;
    });
    const open = vi.spyOn(indexedDB, "open");
    const remove = vi.spyOn(indexedDB, "deleteDatabase");

    render(DeckEditorApp, {
      props: {
        context: { kind: "free-play", createRepository },
        catalogInput: installedEditorCatalog(installedDuelGameplayFixture()),
        deckId: null,
        onnavigate: vi.fn(),
      },
    });

    await waitFor(() => expect(query("deck-editor-error")).not.toBeNull());
    expect(query("deck-editor-error")?.getAttribute("role")).toBe("alert");
    expect(query("deck-editor-error-message")?.textContent).toBe(
      "Deck Editor could not start: USER_DATA_UNAVAILABLE",
    );
    expect(createRepository).toHaveBeenCalledOnce();
    expect(createRepository.mock.results[0]).toEqual({
      type: "throw",
      value: failure,
    });
    expect(
      (screen.getByRole("button", { name: "Retry" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(query("deck-editor-loading-skeleton")).toBeNull();
    expect(query("deck-library")).toBeNull();
    expect(query("deck-migration-error")).toBeNull();
    expect(open).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
