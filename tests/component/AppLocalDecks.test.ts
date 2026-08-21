// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
  quantityLimit,
} from "../../src/decks/catalog/pinned-ruleset.ts";
import { setRuntimeCatalogForTests } from "../../src/decks/catalog/runtime-catalog.ts";
import { PROTOTYPE_CATALOG } from "../../src/deck-editor/fixtures/catalog.ts";
import { installPrototypeActiveCatalog } from "../fixtures/active-catalog.ts";

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

/* The whole prototype catalog is packaged in this build, so a deck the editor
   accepts is one the Worker will accept — which is the invariant these tests
   exercise from both sides. */
const workerClientSpies = vi.hoisted(() => {
  const runtimeSnapshotId = "a".repeat(64);
  const codes = [
    10000000, 89631139, 46986414, 74677422, 97590747, 91152256, 15025844,
    83764718, 9742784, 3048768, 24175232, 8505920, 6766208, 8809344, 1322368,
    12580477, 53129443, 22082432, 6186304, 37120512, 4064256, 44095762,
    97077563, 1637760,
  ];
  Object.assign(globalThis, {
    __RUNTIME_SNAPSHOT_ID__: runtimeSnapshotId,
    __ACTIVATION_SNAPSHOT_ID__: runtimeSnapshotId,
    __RUNTIME_MANIFEST_SHA256__: "b".repeat(64),
    __ACTIVE_IMAGE_MANIFEST_SHA256__: "c".repeat(64),
    __RUNTIME_REVISIONS__: {},
    __ACTIVE_IMAGE_MANIFEST__: {
      snapshotId: runtimeSnapshotId,
      files: codes.map((code) => ({ code })),
      missing: [],
    },
    __APP_BUILD_ID__: "component-test",
  });
  return {
    startDuel: vi.fn((...args: readonly unknown[]) => args.length > 0),
  };
});

vi.mock("../../src/battle/app/DuelWorkerClient.ts", () => {
  class DuelWorkerClientMock {
    context = { workerGeneration: 1, sessionGeneration: 0 };
    listeners = new Set<(received: unknown) => void>();

    subscribe(listener: (received: unknown) => void) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    initialize() {
      queueMicrotask(() => {
        for (const listener of this.listeners)
          listener({
            context: this.context,
            event: { type: "ready", coreVersion: [11, 0] },
          });
      });
      return true;
    }

    startDuel(...args: unknown[]) {
      if (!workerClientSpies.startDuel(...args)) return null;
      this.context = { ...this.context, sessionGeneration: 1 };
      return this.context;
    }

    respond() {
      return false;
    }

    surrender() {
      return false;
    }

    requestDiagnostics() {
      return false;
    }

    async replace() {
      this.context = {
        workerGeneration: this.context.workerGeneration + 1,
        sessionGeneration: 0,
      };
      return { graceful: true };
    }

    async dispose() {
      return { graceful: true };
    }
  }

  return { DuelWorkerClient: DuelWorkerClientMock };
});

import App from "../../src/battle/app/App.svelte";
import { DECK_DATABASE_NAME } from "../../src/decks/index.ts";
import { emptyDeckHistory } from "../../src/decks/deck-history.ts";
import { createBlankDeck } from "../../src/decks/deck-model.ts";
import { validateDeckDraft } from "../../src/decks/deck-validation.ts";
import { IndexedDbDeckRepository } from "../../src/decks/indexeddb-deck-repository.ts";

/* The duel builds its catalog from the packaged card set, so the fixture has
   to be what this build packages for the seeded deck to be one it can draw.
   Installed after the imports rather than in the hoisted block above, which
   runs before the fixture module itself has been evaluated. */
installPrototypeActiveCatalog();

const LOCAL_PLAYER_OPTION = '[data-cy="deck-picker-option-local:built-deck:1"]';

async function seedDeck(
  main: readonly number[],
  { asDefault = false }: { readonly asDefault?: boolean } = {},
): Promise<void> {
  const repository = await IndexedDbDeckRepository.open();
  try {
    const base = createBlankDeck("Built Deck", catalog, PROTOTYPE_RULESET, {
      id: "built-deck",
    });
    await repository.create(
      {
        ...base,
        main: Object.freeze([...main]),
        validation: validateDeckDraft(
          { main: [...main], extra: [], side: [] },
          catalog,
          PROTOTYPE_RULESET,
        ),
      },
      emptyDeckHistory(),
    );
    if (asDefault) await repository.setDefaultDeck(base.id);
  } finally {
    repository.close();
  }
}

function playerSelect(): HTMLSelectElement {
  return query("deck-picker-player-select") as HTMLSelectElement;
}

function persistedDeckKeys(): { playerKey: string; opponentKey: string } {
  return JSON.parse(localStorage.getItem("ygo.ui.v2") ?? "null").decks;
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

async function renderReadyApp() {
  const rendered = render(App);
  await vi.waitFor(() => expect(query("deck-picker")).not.toBeNull());
  return rendered;
}

beforeEach(async () => {
  await deleteDeckDatabase();
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  /* Every test starts from a catalog that answers: the failure case below
     clears the memo, and a cleared memo would make the next render fetch. */
  installPrototypeActiveCatalog();
  localStorage.clear();
  workerClientSpies.startDuel.mockClear();
  workerClientSpies.startDuel.mockImplementation(() => true);
  await deleteDeckDatabase();
});

describe("App deck picker with local decks", () => {
  it("offers the bundled group before the local library has been read", async () => {
    await renderReadyApp();

    expect(query("deck-picker-group-preset")).not.toBeNull();
    expect(
      document.querySelectorAll('[data-cy^="deck-picker-option-preset:"]'),
    ).toHaveLength(6);
    expect(
      (query("deck-picker-start-button") as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  /* The card database is a fetch now, and a fetch can fail. The bundled decks
     are compiled into the build, so they must survive that; the decks the
     player built cannot be resolved without the catalog, so their absence is
     explained rather than left looking like deletion. */
  it("keeps the bundled decks and says so when the card database fails", async () => {
    await seedDeck(VALID_MAIN);
    setRuntimeCatalogForTests(null);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );

    await renderReadyApp();

    await vi.waitFor(() =>
      expect(query("app-catalog-error-panel")).not.toBeNull(),
    );
    expect(query("app-catalog-error-message")?.textContent).toContain(
      "Card database could not load",
    );
    expect(
      document.querySelectorAll('[data-cy^="deck-picker-option-preset:"]'),
    ).toHaveLength(6);
    expect(document.querySelector(LOCAL_PLAYER_OPTION)).toBeNull();
  });

  /* The panel used to latch for the session: it is a term in
     `duelViewportOnly`, so a player who took its offer and duelled with a
     bundled deck kept a banner over the field and lost the ADR-019 full-height
     shell until they reloaded. `runtimeCatalog()` no longer memoizes a
     rejection, so there is now something for a retry to reach. */
  it("retries the card database and clears the panel when it answers", async () => {
    const user = userEvent.setup();
    await seedDeck(VALID_MAIN);
    setRuntimeCatalogForTests(null);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );

    await renderReadyApp();
    await vi.waitFor(() =>
      expect(query("app-catalog-error-panel")).not.toBeNull(),
    );

    installPrototypeActiveCatalog();
    await user.click(query("app-retry-catalog-button") as HTMLButtonElement);

    await vi.waitFor(() => expect(query("app-catalog-error-panel")).toBeNull());
    await vi.waitFor(() =>
      expect(document.querySelector(LOCAL_PLAYER_OPTION)).not.toBeNull(),
    );
  });

  it("lists a playable local deck and dispatches its card list", async () => {
    const user = userEvent.setup();
    await seedDeck(VALID_MAIN);
    await renderReadyApp();
    await vi.waitFor(() =>
      expect(document.querySelector(LOCAL_PLAYER_OPTION)).not.toBeNull(),
    );

    await user.selectOptions(playerSelect(), "local:built-deck:1");
    await user.click(query("deck-picker-start-button") as HTMLButtonElement);

    expect(workerClientSpies.startDuel).toHaveBeenCalledOnce();
    expect(workerClientSpies.startDuel).toHaveBeenCalledWith(
      "local-v1:local:vs:shaddoll",
      { kind: "cards", main: VALID_MAIN, extra: [], side: [] },
      { kind: "preset", deckId: "shaddoll" },
    );
  });

  /* The whole point of the stored default: a player who built a deck and
     marked it theirs opens the duel menu on that deck, not on a bundled one. */
  it("the stored default deck is pre-selected for the player seat", async () => {
    await seedDeck(VALID_MAIN, { asDefault: true });
    await renderReadyApp();

    await vi.waitFor(() =>
      expect(document.querySelector(LOCAL_PLAYER_OPTION)).not.toBeNull(),
    );
    expect(playerSelect().value).toBe("local:built-deck:1");
    expect(query("deck-picker-fallback-notice")).toBeNull();
    expect(persistedDeckKeys().playerKey).toBe("local:built-deck:1");
  });

  /* An existing profile carries the opponent this build no longer offers, so
     the stored key is rewritten rather than read forever. */
  it("the persisted opponent key is forced to shaddoll", async () => {
    localStorage.setItem(
      "ygo.ui.v2",
      JSON.stringify({
        version: 2,
        windows: { zoneList: null, confirm: null },
        decks: {
          playerKey: "preset:nekroz",
          opponentKey: "preset:mvp-opponent",
        },
        settings: { showZoneOutlines: true, showZoneCounts: true },
      }),
    );

    await renderReadyApp();

    await vi.waitFor(() =>
      expect(persistedDeckKeys().opponentKey).toBe("preset:shaddoll"),
    );
    expect(persistedDeckKeys().playerKey).toBe("preset:nekroz");
    expect(playerSelect().value).toBe("preset:nekroz");
    expect(query("deck-picker-fallback-notice")).toBeNull();
  });

  it("omits a local deck that does not satisfy the pinned ruleset", async () => {
    await seedDeck(VALID_MAIN.slice(0, 39));
    await renderReadyApp();
    await vi.waitFor(() => expect(playerSelect()).not.toBeNull());

    expect(query("deck-picker-group-local")).toBeNull();
    expect(document.querySelector(LOCAL_PLAYER_OPTION)).toBeNull();
  });

  it("falls back to the bundled pair when a persisted deck is gone", async () => {
    localStorage.setItem(
      "ygo.ui.v2",
      JSON.stringify({
        version: 2,
        windows: { zoneList: null, confirm: null },
        decks: {
          playerKey: "local:deleted-deck:4",
          opponentKey: "preset:shaddoll",
        },
        settings: { showZoneOutlines: true, showZoneCounts: true },
      }),
    );

    await renderReadyApp();
    await vi.waitFor(() =>
      expect(query("deck-picker-fallback-notice")).not.toBeNull(),
    );

    expect(playerSelect().value).toBe("preset:mvp-player");
    expect(query("deck-picker-opponent-fixed")).not.toBeNull();
    expect(persistedDeckKeys().opponentKey).toBe("preset:shaddoll");
    expect(
      document.querySelectorAll('[data-cy="deck-picker-fallback-notice"]'),
    ).toHaveLength(1);
  });

  it("clears the fallback notice as soon as a deck is chosen", async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      "ygo.ui.v2",
      JSON.stringify({
        version: 2,
        windows: { zoneList: null, confirm: null },
        decks: { playerKey: "local:gone:1", opponentKey: "preset:shaddoll" },
        settings: { showZoneOutlines: true, showZoneCounts: true },
      }),
    );
    await renderReadyApp();
    await vi.waitFor(() =>
      expect(query("deck-picker-fallback-notice")).not.toBeNull(),
    );

    await user.selectOptions(playerSelect(), "preset:nekroz");

    expect(query("deck-picker-fallback-notice")).toBeNull();
  });

  /* Defensive: the picker only offers decks the Worker should accept, so a
     refused start means the two disagree. It has to stay recoverable rather
     than leaving a blank screen where the picker was. */
  it("keeps the picker open and explains when the start is refused", async () => {
    const user = userEvent.setup();
    workerClientSpies.startDuel.mockImplementation(() => false);
    await renderReadyApp();

    await user.click(query("deck-picker-start-button") as HTMLButtonElement);

    expect(query("deck-picker")).not.toBeNull();
    expect(query("deck-picker-start-error")?.textContent?.trim()).toBe(
      "The duel could not be started. Try again.",
    );
  });
});
