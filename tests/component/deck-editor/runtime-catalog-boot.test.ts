// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import type { DeckBuilderCardView } from "../../../src/decks/catalog/ocg-card-mapper.ts";
import type * as RuntimeCatalog from "../../../src/decks/catalog/runtime-catalog.ts";
import { DECK_DATABASE_NAME } from "../../../src/decks/deck-database.ts";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";
import { installPrototypeActiveCatalog } from "../../fixtures/active-catalog.ts";

installPrototypeActiveCatalog();

/* The catalog is ~10 MB of shards over the network, so its arrival is a state
   the editor has to render rather than a value it can read. The seam that other
   files use installs a resolved fixture, which cannot express "still loading"
   or "failed"; this file owns the module mock that can. */
let deferred: Promise<readonly DeckBuilderCardView[]>;

vi.mock("../../../src/decks/catalog/runtime-catalog.ts", async (original) => ({
  ...(await original<typeof RuntimeCatalog>()),
  runtimeCatalog: () => deferred,
}));

const DeckEditorApp = (await import("../../../src/deck-editor/index.ts"))
  .default;

function query(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${name}"]`);
}

beforeEach(() => {
  deferred = Promise.resolve(PROTOTYPE_CATALOG);
});

afterEach(async () => {
  cleanup();
  await deleteDB(DECK_DATABASE_NAME);
});

describe("deck editor catalog boot", () => {
  it("waits for the catalog before it mounts the editor", async () => {
    let release: (cards: readonly DeckBuilderCardView[]) => void = () =>
      undefined;
    deferred = new Promise((resolve) => (release = resolve));

    render(DeckEditorApp, { deckId: null, onnavigate: vi.fn() });

    expect(query("deck-editor-loading")).not.toBeNull();
    expect(query("deck-library")).toBeNull();

    release(PROTOTYPE_CATALOG);
    await waitFor(() => expect(query("deck-library")).not.toBeNull());
    expect(query("deck-editor-loading")).toBeNull();
  });

  it("shows the error screen when the catalog cannot be read", async () => {
    deferred = Promise.reject(
      new Error("Runtime catalog shard failed: assets/current/catalog/x.json"),
    );

    render(DeckEditorApp, { deckId: null, onnavigate: vi.fn() });

    await waitFor(() => expect(query("deck-editor-error")).not.toBeNull());
    expect(query("deck-editor-error-message")?.textContent).toBe(
      "Deck Editor could not start: Runtime catalog shard failed: assets/current/catalog/x.json",
    );
  });
});
