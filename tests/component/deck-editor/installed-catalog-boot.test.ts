// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, waitFor } from "@testing-library/svelte";
import { deleteDB } from "idb";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckEditorApp from "../../../src/deck-editor/index.ts";
import { DECK_DATABASE_NAME } from "../../../src/decks/deck-database.ts";
import { installedDuelGameplayFixture } from "../../fixtures/installed-duel-gameplay.ts";

function query(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${name}"]`);
}

afterEach(async () => {
  cleanup();
  await deleteDB(DECK_DATABASE_NAME);
});

describe("deck editor catalog boot", () => {
  it("mounts from the exact installed gameplay catalog", async () => {
    render(DeckEditorApp, {
      gameplay: installedDuelGameplayFixture(),
      deckId: null,
      onnavigate: vi.fn(),
    });

    await waitFor(() => expect(query("deck-library")).not.toBeNull());
    expect(query("deck-editor-error")).toBeNull();
  });
});
