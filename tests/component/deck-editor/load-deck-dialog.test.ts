// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import { get } from "svelte/store";
import DeckEditor from "../../../src/deck-editor/components/DeckEditor.svelte";
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
import { emptyDeckHistory } from "../../../src/decks/deck-history.ts";
import {
  deckId,
  type DeckAutosaveRecord,
  type DeckId,
  type StoredDeck,
} from "../../../src/decks/deck-contracts.ts";
import type { DeckRepository } from "../../../src/decks/deck-repository.ts";
import { stateFixture } from "../../fixtures/deck-editor.ts";

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

function renderEditor(): void {
  render(DeckEditor, {
    state: stateFixture(),
    cards: PROTOTYPE_CATALOG,
    catalog: prototypeCatalogMap,
    ruleset: PROTOTYPE_RULESET,
    returnLabel: "Deck Selection",
    onreturn: vi.fn(),
    onrename: vi.fn(),
    onmutate: vi.fn(),
    onundo: vi.fn(),
    onredo: vi.fn(),
    onretrysave: vi.fn(),
    onreload: vi.fn(),
    onpreservecopy: vi.fn(),
    onlistautosaves: () => Promise.resolve([]),
  });
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

  it("opening the dialog moves focus into it", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("button", { name: "Load" }));
    const dialog = await screen.findByRole("dialog", { name: "Load deck" });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("Escape closes the dialog without tabbing into it first", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("button", { name: "Load" }));
    await screen.findByRole("dialog", { name: "Load deck" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("cancelling returns focus to the Load button", async () => {
    const user = userEvent.setup();
    renderEditor();
    const opener = screen.getByRole("button", { name: "Load" });
    await user.click(opener);
    await screen.findByRole("dialog", { name: "Load deck" });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("a failed reopen leaves the deck that stayed open untouched", async () => {
    const vanishing = deckId("vanishing-deck");
    let stored: StoredDeck | null = null;
    let lastOpened: DeckId | null = null;
    let probed = false;
    const repository: DeckRepository = {
      list: async () => (stored === null ? [] : [stored.deck]),
      load: async (id) => {
        if (id !== vanishing) return stored;
        /* The first read is the existence probe in `restoreAutosave`; by the
           time it reopens the deck another tab has deleted it. */
        if (probed) throw new Error("deck vanished");
        probed = true;
        return {
          deck: createBlankDeck(
            "Vanishing",
            prototypeCatalogMap,
            PROTOTYPE_RULESET,
            { id: vanishing },
          ),
          history: emptyDeckHistory(),
        };
      },
      create: async (deck, history) => {
        stored = { deck: { ...deck, revision: 1 }, history };
        return stored;
      },
      createAndOpen: async (deck, history) => {
        stored = { deck: { ...deck, revision: 1 }, history };
        lastOpened = deck.id;
        return stored;
      },
      save: async (expectedRevision, deck, history) => {
        stored = { deck: { ...deck, revision: expectedRevision + 1 }, history };
        return stored;
      },
      delete: async () => undefined,
      getLastOpened: async () => lastOpened,
      setLastOpened: async (id) => {
        lastOpened = id;
      },
      clearLastOpened: async () => {
        lastOpened = null;
      },
      appendAutosave: async () => undefined,
      listAutosaves: async () => [],
      getDefaultDeck: async () => null,
      setDefaultDeck: async () => undefined,
    };
    const controller = new DeckBuilderController(
      repository,
      catalog,
      PROTOTYPE_RULESET,
    );
    await controller.initialize();
    await controller.createDeck("Stays Open");
    await controller.mutate({ type: "add", cardCode: 89631139 });
    const openId = get(controller).current!.deck.id;

    await controller.restoreAutosave({
      id: "save-vanishing",
      deckId: vanishing,
      deckName: "Vanishing",
      createdAt: new Date("2026-01-01T10:00:00.000Z").toISOString(),
      main: [46986414, 46986414],
      extra: [],
      side: [],
    });

    const state = get(controller);
    expect(state.mode).toBe("error");
    expect(state.current!.deck.id).toBe(openId);
    expect(state.current!.deck.main).toEqual([89631139]);
    expect(stored!.deck.main).toEqual([89631139]);
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
