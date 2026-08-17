// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import { get } from "svelte/store";
import LoadDeckDialog from "../../../src/deck-editor/components/LoadDeckDialog.svelte";
import { DeckBuilderController } from "../../../src/deck-editor/deck-editor-store.ts";
import { IndexedDbDeckRepository } from "../../../src/decks/indexeddb-deck-repository.ts";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../../src/decks/catalog/pinned-ruleset.ts";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";
import {
  deckFixture,
  prototypeCatalogMap,
} from "../../fixtures/deck-editor.ts";
import { createBlankDeck } from "../../../src/decks/deck-model.ts";
import {
  deckId,
  type DeckAutosaveRecord,
} from "../../../src/decks/deck-contracts.ts";
import type { DeckRepository } from "../../../src/decks/deck-repository.ts";

const dbNames: string[] = [];
afterEach(async () => {
  cleanup();
  await Promise.all(dbNames.splice(0).map((name) => deleteDB(name)));
});

const catalog = catalogByCode(PROTOTYPE_CATALOG);

async function waitForAutosaves(
  repository: DeckRepository,
  count: number,
): Promise<readonly DeckAutosaveRecord[]> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const entries = await repository.listAutosaves();
    if (entries.length >= count) return entries;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Autosave log never reached ${String(count)} entries`);
}

describe("load dialog", () => {
  it("the load dialog lists saved decks on its first tab", () => {
    const deck1 = deckFixture(1);
    const deck2 = Object.freeze({
      ...createBlankDeck(
        "Second Deck",
        prototypeCatalogMap,
        PROTOTYPE_RULESET,
        {
          id: "second-deck",
        },
      ),
      revision: 1,
      main: Object.freeze([89631139, 46986414]),
    });
    render(LoadDeckDialog, {
      decks: [deck1, deck2],
      autosaves: [],
      onopendeck: vi.fn(),
      onrestore: vi.fn(),
      oncancel: vi.fn(),
    });
    const list = document.querySelector('[data-cy="load-dialog-deck-list"]')!;
    expect(list).not.toBeNull();
    expect(
      list.querySelector(`[data-cy="load-dialog-deck-${deck1.id}"]`),
    ).not.toBeNull();
    expect(
      list.querySelector(`[data-cy="load-dialog-deck-${deck2.id}"]`),
    ).not.toBeNull();
    expect(list.textContent).toContain(`Main ${deck1.main.length}`);
    expect(list.textContent).toContain(`Main ${deck2.main.length}`);
  });

  it("choosing a deck routes to it", async () => {
    const user = userEvent.setup();
    const deck = deckFixture();
    const onopendeck = vi.fn();
    render(LoadDeckDialog, {
      decks: [deck],
      autosaves: [],
      onopendeck,
      onrestore: vi.fn(),
      oncancel: vi.fn(),
    });
    const btn = document.querySelector(
      `[data-cy="load-dialog-deck-${deck.id}"]`,
    ) as HTMLButtonElement;
    await user.click(btn);
    expect(onopendeck).toHaveBeenCalledWith(deck.id);
  });

  it("the autosaves tab lists timestamp and deck name newest first", async () => {
    const user = userEvent.setup();
    const older: DeckAutosaveRecord = {
      id: "save-1",
      deckId: deckId("deck-a"),
      deckName: "Alpha",
      createdAt: new Date("2026-01-01T10:00:00.000Z").toISOString(),
      main: [89631139],
      extra: [],
      side: [],
    };
    const newer: DeckAutosaveRecord = {
      id: "save-2",
      deckId: deckId("deck-a"),
      deckName: "Alpha",
      createdAt: new Date("2026-01-01T11:00:00.000Z").toISOString(),
      main: [89631139, 46986414],
      extra: [],
      side: [],
    };
    render(LoadDeckDialog, {
      decks: [],
      autosaves: [newer, older],
      onopendeck: vi.fn(),
      onrestore: vi.fn(),
      oncancel: vi.fn(),
    });
    await user.click(screen.getByRole("tab", { name: "Autosaves" }));
    const list = document.querySelector(
      '[data-cy="load-dialog-autosave-list"]',
    )!;
    const buttons = list.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.textContent).toContain(
      new Date(newer.createdAt).toLocaleString(),
    );
    expect(buttons[0]!.textContent).toContain("Alpha");
  });

  it("choosing an autosave restores its card list into the deck", async () => {
    const name = "load-dialog-restore";
    dbNames.push(name);
    const repo = await IndexedDbDeckRepository.open(name);
    const controller = new DeckBuilderController(
      repo,
      catalog,
      PROTOTYPE_RULESET,
    );
    await controller.initialize();
    await controller.createDeck("Test Deck");

    await controller.mutate({ type: "add", cardCode: 89631139 });
    const entries = await waitForAutosaves(repo, 1);
    const entry = entries[0]!;

    await controller.mutate({ type: "add", cardCode: 46986414 });

    await controller.restoreAutosave(entry);

    const current = get(controller).current!;
    expect(current.deck.main).toEqual(entry.main);

    await controller.undo();
    expect(get(controller).current!.deck.main).not.toEqual(entry.main);

    repo.close();
  });

  it("restoring an autosave of a deleted deck recreates it", async () => {
    const name = "load-dialog-deleted";
    dbNames.push(name);
    const repo = await IndexedDbDeckRepository.open(name);
    const controller = new DeckBuilderController(
      repo,
      catalog,
      PROTOTYPE_RULESET,
    );
    await controller.initialize();
    await controller.createDeck("Will Delete");

    await controller.mutate({ type: "add", cardCode: 89631139 });
    const entries = await waitForAutosaves(repo, 1);
    const entry = entries[0]!;
    const deletedId = entry.deckId;
    const revision = get(controller).current!.deck.revision;

    await controller.deleteDeck(deletedId, revision);
    expect(await repo.load(deletedId)).toBeNull();

    await controller.restoreAutosave(entry);

    const current = get(controller).current!;
    expect(current.deck.name).toBe(entry.deckName);
    expect(current.deck.main).toEqual(entry.main);
    expect(current.deck.id).not.toBe(deletedId);

    repo.close();
  });
});
