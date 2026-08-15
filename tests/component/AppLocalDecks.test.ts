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
import { PROTOTYPE_CATALOG } from "../../src/decks/catalog/prototype-catalog.ts";

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
    __ACTIVE_CARD_TEXTS__: codes.map((code) => ({
      code,
      name: `Card ${code}`,
      description: "",
    })),
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

const LOCAL_PLAYER_OPTION =
  '[data-cy="deck-picker-option-player-local:built-deck:1"]';

async function seedDeck(main: readonly number[]): Promise<void> {
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
      document.querySelectorAll(
        '[data-cy^="deck-picker-option-player-preset:"]',
      ),
    ).toHaveLength(6);
    expect(
      (query("deck-picker-start-button") as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("lists a playable local deck and dispatches its card list", async () => {
    const user = userEvent.setup();
    await seedDeck(VALID_MAIN);
    await renderReadyApp();
    await vi.waitFor(() =>
      expect(document.querySelector(LOCAL_PLAYER_OPTION)).not.toBeNull(),
    );

    await user.click(
      document.querySelector(LOCAL_PLAYER_OPTION) as HTMLElement,
    );
    await user.click(query("deck-picker-start-button") as HTMLButtonElement);

    expect(workerClientSpies.startDuel).toHaveBeenCalledOnce();
    expect(workerClientSpies.startDuel).toHaveBeenCalledWith(
      "local-v1:local:vs:mvp-opponent",
      { kind: "cards", main: VALID_MAIN, extra: [], side: [] },
      { kind: "preset", deckId: "mvp-opponent" },
    );
  });

  it("omits a local deck that does not satisfy the pinned ruleset", async () => {
    await seedDeck(VALID_MAIN.slice(0, 39));
    await renderReadyApp();
    await vi.waitFor(() =>
      expect(query("deck-picker-column-player")).not.toBeNull(),
    );

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

    expect(
      query("deck-picker-option-player-preset:mvp-player")?.getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
    expect(
      query("deck-picker-option-opponent-preset:mvp-opponent")?.getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
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

    await user.click(
      query("deck-picker-option-player-preset:nekroz") as HTMLButtonElement,
    );

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
