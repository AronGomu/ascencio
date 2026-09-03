// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { deleteDB } from "idb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setRuntimeCatalogForTests } from "../../../src/decks/catalog/runtime-catalog.ts";
import StoryApp from "../../../src/story/StoryApp.svelte";
import PreBattleScreen from "../../../src/story/screens/PreBattleScreen.svelte";
import type { PreBattleDeckOption } from "../../../src/story/decks/pre-battle-decks.ts";
import type {
  StoryEncounterRequest,
  StoryHandoffOutcome,
} from "../../../src/story/handoff/story-handoff.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import { STORY_SAVES_DATABASE_NAME } from "../../../src/story/saves/story-save-contracts.ts";
import { createStorySaveRepository } from "../../../src/story/saves/story-save-repository.ts";
import {
  installPrototypeActiveCatalog,
  resetRuntimeCatalog,
} from "../../fixtures/active-catalog.ts";
import {
  fieldableStoryDeck,
  storyDeckFixture,
} from "../../fixtures/story-decks.ts";
import { prototypeCatalogMap } from "../../fixtures/deck-editor.ts";

afterEach(async () => {
  cleanup();
  resetRuntimeCatalog();
  await deleteDB(STORY_SAVES_DATABASE_NAME);
});

const LEGAL: PreBattleDeckOption = {
  id: "signal",
  name: "Signal Deck",
  legal: true,
  issue: null,
};
const SECOND: PreBattleDeckOption = {
  id: "relay",
  name: "Relay Deck",
  legal: true,
  issue: null,
};
const ILLEGAL: PreBattleDeckOption = {
  id: "broken",
  name: "Broken Deck",
  legal: false,
  issue: "This deck uses 3 copy/copies of Dark Magician; you own 1.",
};

/* The records behind the three options above. The briefing pairs verdicts with
   records by id, so a suite that hands over only verdicts would never notice a
   tile losing its counts. */
const RECORDS = [
  storyDeckFixture(LEGAL.id, { name: LEGAL.name }),
  storyDeckFixture(SECOND.id, { name: SECOND.name }),
  storyDeckFixture(ILLEGAL.id, { name: ILLEGAL.name }),
];

function cy(value: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${value}"]`);
}

function start(): HTMLButtonElement {
  const button = cy("deck-select-start");
  if (button === null) throw new Error("No start button");
  return button as HTMLButtonElement;
}

function deckButton(id: string): HTMLButtonElement {
  const button = cy(`deck-tile-press-${id}`);
  if (button === null) throw new Error(`No deck button for ${id}`);
  return button as HTMLButtonElement;
}

/** The tick the tile carries while it is the deck the encounter would start on. */
function picked(id: string): boolean {
  return cy(`deck-tile-check-${id}`) !== null;
}

/* Counted inside the grid rather than across the document: the opponent's own
   seat card is a deck tile too, and it is never one of the save's. */
function gridSize(): number {
  return cy("deck-select-grid")?.children.length ?? -1;
}

function notice(): string {
  return cy("deck-select-block-notice")?.textContent?.trim() ?? "";
}

function props(overrides: Record<string, unknown> = {}) {
  return { deckRecords: RECORDS, ...overrides };
}

describe("the pre-battle deck picker", () => {
  it("lists the save's decks with the default preselected", () => {
    render(
      PreBattleScreen,
      props({ decks: [LEGAL, SECOND, ILLEGAL], defaultDeckId: SECOND.id }),
    );

    expect(gridSize()).toBe(3);
    expect(picked(SECOND.id)).toBe(true);
    expect(picked(LEGAL.id)).toBe(false);
    /* The counts come from the record rather than from the verdict, which is
       the pairing this screen is responsible for. */
    expect(cy(`deck-tile-counts-${SECOND.id}`)?.textContent).toBe(
      "Main 1 · Extra 0 · Side 0",
    );
  });

  it("falls back to the first legal deck when the save has no default", () => {
    render(
      PreBattleScreen,
      props({ decks: [ILLEGAL, LEGAL, SECOND], defaultDeckId: null }),
    );

    expect(picked(LEGAL.id)).toBe(true);
    expect(start().disabled).toBe(false);
  });

  it("maps a link monster frame into the hover decklist", async () => {
    const linkRecord = storyDeckFixture(LEGAL.id, {
      name: LEGAL.name,
      main: [1322368],
    });
    render(
      PreBattleScreen,
      props({
        decks: [LEGAL],
        deckRecords: [linkRecord],
        defaultDeckId: LEGAL.id,
        catalog: prototypeCatalogMap,
      }),
    );

    await fireEvent.pointerEnter(cy(`deck-tile-${LEGAL.id}`)!);
    await waitFor(() =>
      expect(cy("deck-select-seat-list-player-row-1322368")).not.toBeNull(),
    );

    expect(
      cy("deck-select-seat-list-player-row-1322368")?.style.getPropertyValue(
        "--fc",
      ),
    ).toBe("#1d6ea8");
  });

  /* Story is save-owned, so an illegal deck is listed rather than hidden: the
     player has to see the deck they need to repair. It is listed disabled, and
     the arrow keys walk past it. */
  it("renders an illegal deck disabled and never selectable", async () => {
    render(
      PreBattleScreen,
      props({ decks: [LEGAL, ILLEGAL, SECOND], defaultDeckId: LEGAL.id }),
    );

    expect(deckButton(ILLEGAL.id).disabled).toBe(true);
    expect(cy(`deck-tile-badge-illegal-${ILLEGAL.id}`)).not.toBeNull();
    expect(deckButton(LEGAL.id).disabled).toBe(false);

    await fireEvent.keyDown(window, { key: "ArrowDown" });

    expect(picked(SECOND.id)).toBe(true);
    expect(picked(ILLEGAL.id)).toBe(false);
  });

  it("shows an illegal deck's first error on its tile", () => {
    render(
      PreBattleScreen,
      props({ decks: [LEGAL, ILLEGAL], defaultDeckId: LEGAL.id }),
    );

    expect(cy(`deck-tile-meta-${ILLEGAL.id}`)?.textContent).toBe(ILLEGAL.issue);
    expect(cy(`deck-tile-meta-${LEGAL.id}`)?.textContent).toBe("Save deck");
  });

  /* The opponent is the encounter's, not a choice: no portrait control, no
     picker, and the deck card says who fixed it. */
  it("seats the encounter's opponent locked", async () => {
    render(PreBattleScreen, props({ decks: [LEGAL], defaultDeckId: LEGAL.id }));

    expect(cy("deck-select-title")?.textContent).toBe("Rin's Echo");
    const portrait = cy("duel-start-opponent-portrait");
    expect(portrait?.tagName).toBe("DIV");
    expect(cy("duel-start-opponent-change-chip")).toBeNull();

    await userEvent.setup().click(portrait!);
    expect(cy("duel-start-opponent-picker")).toBeNull();

    expect(cy("duel-start-opponent-deck")?.tagName).toBe("DIV");
    expect(cy("duel-start-opponent-deck-locked")?.textContent).toBe(
      "🔒 Set by the story",
    );
    expect(cy("duel-start-opponent-deck-name")?.textContent).toBe("Relay Deck");
  });

  it("renders no favourite controls", () => {
    render(
      PreBattleScreen,
      props({ decks: [LEGAL, SECOND], defaultDeckId: LEGAL.id }),
    );

    expect(document.querySelector('[data-cy^="deck-tile-fav-"]')).toBeNull();
    expect(cy(`deck-tile-default-star-${LEGAL.id}`)).not.toBeNull();
  });

  /* A save's decks are managed in the story's own deck editor, which this
     screen sends the player to rather than editing them here. */
  it("offers no deck management of its own", () => {
    render(PreBattleScreen, props({ decks: [LEGAL], defaultDeckId: LEGAL.id }));

    expect(cy("deck-select-manage")).toBeNull();
    expect(cy(`deck-tile-menu-${LEGAL.id}`)).toBeNull();
  });

  it("blocks the start while the selected deck is illegal, and says why", () => {
    const onstart = vi.fn();
    render(
      PreBattleScreen,
      props({ decks: [ILLEGAL, LEGAL], defaultDeckId: ILLEGAL.id, onstart }),
    );

    expect(start().disabled).toBe(true);
    expect(notice()).toContain(ILLEGAL.name);
    expect(notice()).toContain("you own 1");
    expect(onstart).not.toHaveBeenCalled();
  });

  /* Reported rather than linked. An anchor changes the route itself, which
     unmounts the story with everything it has not written yet — the shop trip
     that got the player here included. The parent saves first and navigates
     second, so this screen only says where the player wants to go. */
  it("reports a blocked start as a request for the deck editor", async () => {
    const onopendecks = vi.fn();
    render(
      PreBattleScreen,
      props({ decks: [ILLEGAL], defaultDeckId: ILLEGAL.id, onopendecks }),
    );

    const way = cy("story-briefing-block-action");
    expect(way?.tagName).toBe("BUTTON");
    expect(way?.hasAttribute("href")).toBe(false);
    await userEvent.setup().click(way!);
    expect(onopendecks).toHaveBeenCalledOnce();
  });

  /* Reachable, not theoretical: the deck editor no longer seeds a deck into a
     story save, so a player who deletes their last one lands here. The way out
     has to be on the screen. */
  it("sends a save with no decks to build one", async () => {
    const onopendecks = vi.fn();
    render(
      PreBattleScreen,
      props({ decks: [], deckRecords: [], defaultDeckId: null, onopendecks }),
    );

    expect(start().disabled).toBe(true);
    expect(notice()).toMatch(/no decks/i);
    const way = cy("story-briefing-block-action");
    expect(way?.textContent).toMatch(/build/i);
    expect(gridSize()).toBe(0);

    await userEvent.setup().click(way!);
    expect(onopendecks).toHaveBeenCalledOnce();
  });

  it("records the chosen deck once and enables the start", async () => {
    const onselectdeck = vi.fn();
    const onstart = vi.fn();
    render(
      PreBattleScreen,
      props({
        decks: [ILLEGAL, LEGAL, SECOND],
        defaultDeckId: ILLEGAL.id,
        onselectdeck,
        onstart,
      }),
    );
    expect(start().disabled).toBe(true);

    const user = userEvent.setup();
    await user.click(deckButton(SECOND.id));
    /* Pressed twice on purpose: the save already holds this deck after the
       first press, and a second write would mark the run dirty for a change
       nobody made. */
    await user.click(deckButton(SECOND.id));

    expect(onselectdeck).toHaveBeenCalledExactlyOnceWith(SECOND.id);
    expect(cy("deck-select-block-notice")).toBeNull();
    expect(picked(SECOND.id)).toBe(true);
    expect(start().disabled).toBe(false);

    await user.click(start());
    expect(onstart).toHaveBeenCalledOnce();
    /* Asserted after the start, because the props here never flush back the
       way a mounted parent's would. */
    expect(onselectdeck).toHaveBeenCalledExactlyOnceWith(SECOND.id);
  });

  /* The fallback selection was never chosen by anybody, so nothing recorded it.
     Starting on it has to, or the encounter carries no deck at all. */
  it("records a fallback selection when the start is taken without a click", async () => {
    const onselectdeck = vi.fn();
    render(
      PreBattleScreen,
      props({ decks: [LEGAL], defaultDeckId: null, onselectdeck }),
    );

    await userEvent.setup().click(start());

    expect(onselectdeck).toHaveBeenCalledExactlyOnceWith(LEGAL.id);
  });

  it("does not re-record a selection the save already holds", async () => {
    const onselectdeck = vi.fn();
    render(
      PreBattleScreen,
      props({ decks: [LEGAL], defaultDeckId: LEGAL.id, onselectdeck }),
    );

    await userEvent.setup().click(start());

    expect(onselectdeck).not.toHaveBeenCalled();
  });

  /* The parent writes the checkpoint before the route changes, so a second
     press during that write would start the encounter twice. */
  it("latches the start after one press", async () => {
    const onstart = vi.fn();
    render(
      PreBattleScreen,
      props({ decks: [LEGAL], defaultDeckId: LEGAL.id, onstart }),
    );

    const user = userEvent.setup();
    await user.click(start());
    expect(start().textContent).toBe("Entering duel…");
    expect(start().disabled).toBe(true);

    await user.click(start());
    expect(onstart).toHaveBeenCalledOnce();
  });

  /* An empty catalog calls every card missing, so a verdict reached before it
     lands would refuse every deck in the save. The screen waits instead. */
  it("waits rather than refusing while the decks are still being checked", () => {
    render(PreBattleScreen, props({ decks: null, defaultDeckId: "signal" }));

    expect(start().disabled).toBe(true);
    expect(notice()).toBe("Checking your decks against the card database…");
    expect(cy("story-briefing-block-action")).toBeNull();
  });

  it("offers a retry and a way back when the card database will not load", async () => {
    const onretrydecks = vi.fn();
    const onreturn = vi.fn();
    render(
      PreBattleScreen,
      props({
        decks: null,
        defaultDeckId: null,
        decksError: "The card database could not load.",
        onretrydecks,
        onreturn,
      }),
    );

    expect(start().disabled).toBe(true);
    expect(notice()).toContain("The card database could not load.");

    const user = userEvent.setup();
    await user.click(cy("story-briefing-deck-error-retry")!);
    await user.click(cy("deck-select-back")!);

    expect(onretrydecks).toHaveBeenCalledOnce();
    expect(onreturn).toHaveBeenCalledOnce();
  });

  /* An encounter the player cannot walk away from has no way back to show. */
  it("hides the way back when the encounter refuses one", () => {
    render(
      PreBattleScreen,
      props({ decks: [LEGAL], defaultDeckId: LEGAL.id, allowReturn: false }),
    );

    expect(cy("deck-select-back")).toBeNull();
    expect(cy("deck-select-back-icon")).toBeNull();
  });
});

/* The wiring, not the rule. `pre-battle-decks.test.ts` pins the verdict and the
   block above; what these prove is that the briefing is handed a verdict at
   all — read from the live card database, against this save's own collection —
   and that the pick it takes reaches the save. A screen wired to nothing
   renders a permanent refusal that no unit test can see. */
describe("the briefing inside the story app", () => {
  const FIELDABLE = fieldableStoryDeck("fieldable");
  const BROKEN = storyDeckFixture("broken", {
    main: [FIELDABLE.deck.main[0]!],
  });

  function preBattleSave() {
    return {
      ...createInitialStoryState(),
      screen: "pre-battle" as const,
      savedScreen: "map" as const,
      progressExists: true,
      encounterId: "old-arena" as const,
      collection: FIELDABLE.collection,
      decks: [BROKEN, FIELDABLE.deck],
      defaultDeckId: BROKEN.id,
    };
  }

  it("refuses a broken default, then starts on the deck the player picks", async () => {
    installPrototypeActiveCatalog();
    const onencounter = vi.fn<
      (request: StoryEncounterRequest) => Promise<StoryHandoffOutcome>
    >(() => Promise.resolve("ready"));
    render(StoryApp, { resumeState: preBattleSave(), onencounter });

    /* Blocked while the catalog is still being read, and still blocked once it
       lands — the default deck is 39 cards short. */
    await waitFor(() =>
      expect(cy(`deck-tile-press-${FIELDABLE.deck.id}`)).not.toBeNull(),
    );
    expect(start().disabled).toBe(true);
    expect(deckButton(BROKEN.id).disabled).toBe(true);
    expect(cy(`deck-tile-meta-${BROKEN.id}`)?.textContent).toContain(
      "Main Deck needs 39 more",
    );
    expect(notice()).toContain(BROKEN.name);

    await userEvent.setup().click(deckButton(FIELDABLE.deck.id));
    expect(start().disabled).toBe(false);

    await userEvent.setup().click(start());
    await waitFor(() => expect(onencounter).toHaveBeenCalledOnce());
    /* The state the shell checkpoints is the state the duel is handed, so the
       deck the player chose has to be recorded in it before the handoff — and
       the handoff carries that deck resolved, because the shell has neither the
       catalog nor this save's ownership to resolve it with. */
    expect(onencounter.mock.calls[0]?.[0]).toMatchObject({
      encounterId: "old-arena",
      state: { defaultDeckId: FIELDABLE.deck.id },
      deck: {
        ref: { type: "local", deckId: FIELDABLE.deck.id },
        main: FIELDABLE.deck.main,
      },
    });
  });

  it("keeps the pick after a trip back to the map", async () => {
    installPrototypeActiveCatalog();
    render(StoryApp, { resumeState: preBattleSave() });
    await waitFor(() =>
      expect(cy(`deck-tile-press-${FIELDABLE.deck.id}`)).not.toBeNull(),
    );

    await userEvent.setup().click(deckButton(FIELDABLE.deck.id));
    await userEvent.setup().click(cy("deck-select-back")!);
    await userEvent.setup().click(cy("story-map-location-old-arena")!);

    await waitFor(() =>
      expect(cy(`deck-tile-press-${FIELDABLE.deck.id}`)).not.toBeNull(),
    );
    expect(picked(FIELDABLE.deck.id)).toBe(true);
    expect(start().disabled).toBe(false);
  });

  /* A card database that will not load is the one refusal the player cannot
     repair by editing a deck, so it has to say so and offer the read again. */
  it("reports a card database that will not load, and retries it", async () => {
    setRuntimeCatalogForTests(null);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("offline"));
    render(StoryApp, { resumeState: preBattleSave() });

    await waitFor(() =>
      expect(notice()).toContain("The card database could not load."),
    );
    expect(start().disabled).toBe(true);
    expect(gridSize()).toBe(0);

    const before = fetchSpy.mock.calls.length;
    await userEvent.setup().click(cy("story-briefing-deck-error-retry")!);
    await waitFor(() =>
      expect(fetchSpy.mock.calls.length).toBeGreaterThan(before),
    );
    /* Return to Map is the way out that never depends on the read. */
    await userEvent.setup().click(cy("deck-select-back")!);
    expect(cy("story-map-screen")).not.toBeNull();
    expect(cy("story-briefing-screen")).toBeNull();
    fetchSpy.mockRestore();
  });
});

/* The briefing is the one screen a player is *sent* to the deck editor from,
   and it is the screen furthest from their last save: a new game, a shop trip
   and a walk to the arena all sit between the two. The story writes on a manual
   save and on the reward autosave and nowhere else, so leaving for the editor
   has to write, and has to keep the player here when the write is refused. */
describe("leaving the briefing for the deck editor", () => {
  /* A save that cannot start its encounter and cannot repair its way out on
     this screen: no decks at all, plus a shop trip that is still only in
     memory. */
  function unsavedProgress() {
    return {
      ...createInitialStoryState(),
      screen: "pre-battle" as const,
      savedScreen: "map" as const,
      progressExists: true,
      encounterId: "old-arena" as const,
      dp: 250,
      collection: { 89631139: 3 },
      decks: [],
      defaultDeckId: null,
    };
  }

  async function blockedBriefing(ondecks: () => void) {
    installPrototypeActiveCatalog();
    render(StoryApp, { resumeState: unsavedProgress(), ondecks });
    await waitFor(() =>
      expect(cy("story-briefing-block-action")).not.toBeNull(),
    );
    /* Dispatched rather than driven through `userEvent`, so the assertion
       below lands inside the write rather than after it. */
    await fireEvent.click(cy("story-briefing-block-action")!);
  }

  it("writes the run to the autosave slot before it hands the route over", async () => {
    const ondecks = vi.fn();
    await blockedBriefing(ondecks);

    /* Spent while the write is in flight: the storage round-trip takes a task,
       so a second click here would write the same run twice and push a second
       history entry the player has to walk back through. */
    expect(
      (cy("story-briefing-block-action") as HTMLButtonElement).disabled,
    ).toBe(true);
    await waitFor(() => expect(ondecks).toHaveBeenCalledOnce());
    /* Read back from storage, not from the component: what the editor opens is
       the record on disk, and it opens the newest player slot. */
    const saved = await createStorySaveRepository(globalThis.indexedDB).read(
      "autosave",
    );
    if (saved.kind !== "ready") throw new Error("expected a written save");
    expect(saved.envelope.state).toMatchObject({
      dp: 250,
      collection: { 89631139: 3 },
      /* Resumed where they were sent from, so coming back out of the editor
         and pressing Continue lands on the briefing rather than the map. */
      savedScreen: "pre-battle",
    });
  });

  it("keeps the player on the briefing when the save is refused", async () => {
    /* Reads still answer and only the write is refused, which is the state
       full storage leaves a browser in — and the one that would silently cost
       the player their run if the navigation went ahead anyway. */
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function put(
      this: IDBObjectStore,
      ...args: Parameters<typeof originalPut>
    ) {
      const pending = originalPut.apply(this, args);
      queueMicrotask(() => {
        this.transaction.abort();
      });
      return pending;
    };
    const ondecks = vi.fn();
    try {
      await blockedBriefing(ondecks);

      await waitFor(() =>
        expect(cy("story-storage-error-message")?.textContent).toContain(
          "Storage write failed",
        ),
      );
      expect(ondecks).not.toHaveBeenCalled();
      expect(cy("story-briefing-screen")).not.toBeNull();
      /* And the one way off this screen is a way off it again: a refusal that
         left the button spent would strand the player on the briefing. */
      expect(
        (cy("story-briefing-block-action") as HTMLButtonElement).disabled,
      ).toBe(false);
    } finally {
      IDBObjectStore.prototype.put = originalPut;
    }
  });
});
