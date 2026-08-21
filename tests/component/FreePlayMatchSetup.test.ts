// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BattleRequestError,
  parseBattleRequest,
} from "../../src/battle/battle-contracts.ts";
import {
  findSelectableDeck,
  listSelectableDecks,
  presetSelectableDecks,
} from "../../src/battle/decks/selectable-decks.ts";
import { DECK_CATALOG } from "../../src/battle/duel/presets/deck-catalog.ts";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
  quantityLimit,
} from "../../src/decks/catalog/pinned-ruleset.ts";
import { emptyDeckHistory } from "../../src/decks/deck-history.ts";
import { createBlankDeck } from "../../src/decks/deck-model.ts";
import { validateDeckDraft } from "../../src/decks/deck-validation.ts";
import { DECK_DATABASE_NAME } from "../../src/decks/index.ts";
import { IndexedDbDeckRepository } from "../../src/decks/indexeddb-deck-repository.ts";
import { PROTOTYPE_CATALOG } from "../../src/deck-editor/fixtures/catalog.ts";
import type { BattleDeckModule } from "../../src/shell/domain-loaders.ts";
import FreePlayMatchSetup from "../../src/shell/screens/FreePlayMatchSetup.svelte";
import { createShellSettingsStore } from "../../src/shell/settings/shell-settings-store.ts";
import { installPrototypeActiveCatalog } from "../fixtures/active-catalog.ts";

installPrototypeActiveCatalog();

const catalog = catalogByCode(PROTOTYPE_CATALOG);
const mainCodes = PROTOTYPE_CATALOG.filter(
  (card) =>
    card.canonicalZone === "main" &&
    quantityLimit(PROTOTYPE_RULESET, card.code) === 3,
).map(({ code }) => code);
const VALID_MAIN = Array.from(
  { length: 40 },
  (_, index) => mainCodes[index % mainCodes.length]!,
);

/* Two bundled decks rather than the six this build ships: the screen renders
   whatever the battle entry hands it, and a short list is what makes "three
   options per seat" a readable assertion. Both ids are real, because
   `parseBattleRequest` checks a preset id against the shipped catalog. */
const PRESETS = DECK_CATALOG.filter(
  ({ id }) => id === "mvp-player" || id === "shaddoll",
);
const PLAYER_PRESET_KEY = "preset:mvp-player";
const OPPONENT_PRESET_KEY = "preset:shaddoll";
const LOCAL_KEY = "local:built-deck:1";

/** The slice of the battle entry the screen loads, with the bundled list cut
    down to the fixture pair. Everything else is the production function. */
function battleModule(
  overrides: Partial<BattleDeckModule> = {},
): BattleDeckModule {
  return {
    DECK_CATALOG: PRESETS,
    DEFAULT_PLAYER_DECK_ID: "mvp-player",
    DEFAULT_OPPONENT_DECK_ID: "shaddoll",
    presetSelectableDecks,
    listSelectableDecks,
    findSelectableDeck,
    parseBattleRequest,
    supportedDuelCardCodes: async () =>
      new Set(PROTOTYPE_CATALOG.map(({ code }) => code)),
    ...overrides,
  };
}

function memoryStorage(entries: Record<string, string> = {}) {
  return {
    getItem: (key: string) => entries[key] ?? null,
    setItem: (key: string, value: string) => {
      entries[key] = value;
    },
  };
}

async function seedLocalDeck(): Promise<void> {
  const repository = await IndexedDbDeckRepository.open();
  try {
    const base = createBlankDeck("Built Deck", catalog, PROTOTYPE_RULESET, {
      id: "built-deck",
    });
    await repository.create(
      {
        ...base,
        main: Object.freeze([...VALID_MAIN]),
        validation: validateDeckDraft(
          { main: [...VALID_MAIN], extra: [], side: [] },
          catalog,
          PROTOTYPE_RULESET,
        ),
      },
      emptyDeckHistory(),
    );
  } finally {
    repository.close();
  }
}

function deleteDeckDatabase(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DECK_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

function query(value: string): HTMLElement | null {
  return document.querySelector(`[data-cy="${value}"]`);
}

function seat(which: "player" | "opponent"): HTMLSelectElement {
  return query(`free-play-match-${which}-picker`) as HTMLSelectElement;
}

function optionKeys(which: "player" | "opponent"): readonly string[] {
  return [...seat(which).querySelectorAll("option")].map(
    (option) => option.value,
  );
}

function startButton(): HTMLButtonElement {
  return query("free-play-match-start") as HTMLButtonElement;
}

interface RenderOptions {
  readonly storage?: ReturnType<typeof memoryStorage>;
  readonly module?: Partial<BattleDeckModule>;
  readonly loadBattle?: () => Promise<BattleDeckModule>;
}

function renderSetup(options: RenderOptions = {}) {
  const onstart = vi.fn();
  const onback = vi.fn();
  const storage = options.storage ?? memoryStorage();
  const rendered = render(FreePlayMatchSetup, {
    settings: createShellSettingsStore(storage),
    loadBattle:
      options.loadBattle ?? (async () => battleModule(options.module)),
    onstart,
    onback,
  });
  return { ...rendered, onstart, onback, storage };
}

async function renderLoadedSetup(options: RenderOptions = {}) {
  const setup = renderSetup(options);
  await vi.waitFor(() => expect(seat("player").options).not.toHaveLength(0));
  return setup;
}

beforeEach(async () => {
  await deleteDeckDatabase();
  await seedLocalDeck();
});

afterEach(async () => {
  cleanup();
  await deleteDeckDatabase();
});

describe("FreePlayMatchSetup", () => {
  it("lists presets and local decks for both seats", async () => {
    await renderLoadedSetup();

    expect(query("free-play-match-setup")).not.toBeNull();
    for (const which of ["player", "opponent"] as const) {
      expect(optionKeys(which)).toEqual([
        PLAYER_PRESET_KEY,
        OPPONENT_PRESET_KEY,
        LOCAL_KEY,
      ]);
    }
  });

  it("builds a battle request from both selections", async () => {
    const setup = await renderLoadedSetup();

    await fireEvent.change(seat("player"), { target: { value: LOCAL_KEY } });
    await fireEvent.change(seat("opponent"), {
      target: { value: OPPONENT_PRESET_KEY },
    });
    await fireEvent.click(startButton());

    expect(setup.onstart).toHaveBeenCalledTimes(1);
    const request = setup.onstart.mock.calls[0]![0] as unknown;
    expect(parseBattleRequest(request)).toStrictEqual(request);
    expect((request as { player: { kind: string } }).player.kind).toBe("local");
    expect(request).toMatchObject({
      opponent: { kind: "preset", deckId: "shaddoll" },
    });
  });

  it("remembers the last pairing", async () => {
    const storage = memoryStorage();
    const first = await renderLoadedSetup({ storage });

    await fireEvent.change(seat("player"), { target: { value: LOCAL_KEY } });
    await fireEvent.change(seat("opponent"), {
      target: { value: PLAYER_PRESET_KEY },
    });
    await fireEvent.click(startButton());
    expect(first.onstart).toHaveBeenCalledTimes(1);
    cleanup();

    await renderLoadedSetup({ storage });

    expect(seat("player").value).toBe(LOCAL_KEY);
    expect(seat("opponent").value).toBe(PLAYER_PRESET_KEY);
  });

  it("falls back when a remembered deck is gone", async () => {
    const storage = memoryStorage();
    const first = await renderLoadedSetup({ storage });
    await fireEvent.change(seat("player"), { target: { value: LOCAL_KEY } });
    await fireEvent.click(startButton());
    expect(first.onstart).toHaveBeenCalledTimes(1);
    cleanup();
    await deleteDeckDatabase();

    await renderLoadedSetup({ storage });

    expect(optionKeys("player")).toEqual([
      PLAYER_PRESET_KEY,
      OPPONENT_PRESET_KEY,
    ]);
    expect(seat("player").value).toBe(PLAYER_PRESET_KEY);
    expect(seat("opponent").value).toBe(OPPONENT_PRESET_KEY);
    expect(query("free-play-match-error")).toBeNull();
    expect(startButton().disabled).toBe(false);
  });

  it("start is disabled until both seats are chosen", async () => {
    renderSetup({ loadBattle: () => new Promise<BattleDeckModule>(() => {}) });

    expect(startButton().disabled).toBe(true);
    expect(seat("player").value).toBe("");
    expect(seat("opponent").value).toBe("");
  });

  /* The seats stay live so the player can pick their way out of it, rather
     than being left on a screen whose only working control is Back. */
  it("shows a refused request inline and keeps the pickers usable", async () => {
    const setup = await renderLoadedSetup({
      module: {
        parseBattleRequest: () => {
          throw new BattleRequestError("player.deck.main holds 39 cards");
        },
      },
    });

    await fireEvent.click(startButton());

    expect(setup.onstart).not.toHaveBeenCalled();
    expect(query("free-play-match-error")?.textContent).toContain(
      "player.deck.main holds 39 cards",
    );
    expect(seat("player").disabled).toBe(false);
    expect(seat("opponent").disabled).toBe(false);

    await fireEvent.change(seat("player"), { target: { value: LOCAL_KEY } });

    expect(seat("player").value).toBe(LOCAL_KEY);
    expect(query("free-play-match-error")).toBeNull();
  });

  it("goes back to the free-play menu without starting a match", async () => {
    const setup = await renderLoadedSetup();

    await fireEvent.click(query("free-play-match-back")!);

    expect(setup.onback).toHaveBeenCalledTimes(1);
    expect(setup.onstart).not.toHaveBeenCalled();
  });
});
