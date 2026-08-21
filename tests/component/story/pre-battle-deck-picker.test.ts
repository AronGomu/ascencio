// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { cleanup, render, waitFor } from "@testing-library/svelte";
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
import {
  installPrototypeActiveCatalog,
  resetRuntimeCatalog,
} from "../../fixtures/active-catalog.ts";
import {
  fieldableStoryDeck,
  storyDeckFixture,
} from "../../fixtures/story-decks.ts";

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

function cy(value: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${value}"]`);
}

function start(): HTMLButtonElement {
  const button = cy("story-briefing-start");
  if (button === null) throw new Error("No start button");
  return button as HTMLButtonElement;
}

function deckButton(id: string): HTMLButtonElement {
  const button = cy(`story-briefing-deck-${id}`);
  if (button === null) throw new Error(`No deck button for ${id}`);
  return button as HTMLButtonElement;
}

describe("the pre-battle deck picker", () => {
  it("lists the save's decks with the default preselected", () => {
    render(PreBattleScreen, {
      decks: [LEGAL, SECOND, ILLEGAL],
      defaultDeckId: SECOND.id,
    });

    expect(
      document.querySelectorAll('[data-cy^="story-briefing-deck-row-"]'),
    ).toHaveLength(3);
    expect(deckButton(SECOND.id).getAttribute("aria-pressed")).toBe("true");
    expect(deckButton(LEGAL.id).getAttribute("aria-pressed")).toBe("false");
    expect(cy("story-briefing-player-deck-value")?.textContent).toContain(
      SECOND.name,
    );
  });

  it("falls back to the first legal deck when the save has no default", () => {
    render(PreBattleScreen, {
      decks: [ILLEGAL, LEGAL, SECOND],
      defaultDeckId: null,
    });

    expect(deckButton(LEGAL.id).getAttribute("aria-pressed")).toBe("true");
    expect(start().disabled).toBe(false);
  });

  it("renders an illegal deck disabled and styled as illegal", () => {
    render(PreBattleScreen, {
      decks: [LEGAL, ILLEGAL],
      defaultDeckId: LEGAL.id,
    });

    const button = deckButton(ILLEGAL.id);
    expect(button.disabled).toBe(true);
    expect(button.className).toContain("illegal");
    expect(deckButton(LEGAL.id).disabled).toBe(false);
    expect(deckButton(LEGAL.id).className).not.toContain("illegal");
  });

  it("shows an illegal deck's first error", () => {
    render(PreBattleScreen, {
      decks: [LEGAL, ILLEGAL],
      defaultDeckId: LEGAL.id,
    });

    expect(cy(`story-briefing-deck-issue-${ILLEGAL.id}`)?.textContent).toBe(
      ILLEGAL.issue,
    );
    expect(cy(`story-briefing-deck-issue-${LEGAL.id}`)).toBeNull();
  });

  it("blocks the start while the selected deck is illegal, and says why", () => {
    const onstart = vi.fn();
    render(PreBattleScreen, {
      decks: [ILLEGAL, LEGAL],
      defaultDeckId: ILLEGAL.id,
      onstart,
    });

    expect(start().disabled).toBe(true);
    const reason = cy("story-briefing-block-reason")?.textContent ?? "";
    expect(reason).toContain(ILLEGAL.name);
    expect(reason).toContain("you own 1");
    expect(onstart).not.toHaveBeenCalled();
  });

  it("links a blocked start to the story deck editor", () => {
    render(PreBattleScreen, {
      decks: [ILLEGAL],
      defaultDeckId: ILLEGAL.id,
    });

    expect(cy("story-briefing-block-link")?.getAttribute("href")).toBe(
      "#/story/decks",
    );
  });

  /* Reachable, not theoretical: the deck editor no longer seeds a deck into a
     story save, so a player who deletes their last one lands here. The way out
     has to be on the screen. */
  it("sends a save with no decks to build one", () => {
    render(PreBattleScreen, { decks: [], defaultDeckId: null });

    expect(start().disabled).toBe(true);
    expect(cy("story-briefing-block-reason")?.textContent).toMatch(/no decks/i);
    const link = cy("story-briefing-block-link");
    expect(link?.getAttribute("href")).toBe("#/story/decks");
    expect(link?.textContent).toMatch(/build/i);
    expect(cy("story-briefing-deck-list")).toBeNull();
  });

  it("records the chosen deck once and enables the start", async () => {
    const onselectdeck = vi.fn();
    const onstart = vi.fn();
    render(PreBattleScreen, {
      decks: [ILLEGAL, LEGAL, SECOND],
      defaultDeckId: ILLEGAL.id,
      onselectdeck,
      onstart,
    });
    expect(start().disabled).toBe(true);

    await userEvent.setup().click(deckButton(SECOND.id));

    expect(onselectdeck).toHaveBeenCalledExactlyOnceWith(SECOND.id);
    expect(cy("story-briefing-block-reason")).toBeNull();
    expect(start().disabled).toBe(false);
    expect(cy("story-briefing-player-deck-value")?.textContent).toContain(
      SECOND.name,
    );

    await userEvent.setup().click(start());
    expect(onstart).toHaveBeenCalledOnce();
    /* Starting on a deck this screen already recorded must not write it a
       second time: the parent has one save, and a second write marks it dirty
       for a change nobody made. Asserted after the start, because the props
       here never flush back the way a mounted parent's would. */
    expect(onselectdeck).toHaveBeenCalledExactlyOnceWith(SECOND.id);
  });

  /* The fallback selection was never chosen by anybody, so nothing recorded it.
     Starting on it has to, or the encounter carries no deck at all. */
  it("records a fallback selection when the start is taken without a click", async () => {
    const onselectdeck = vi.fn();
    render(PreBattleScreen, {
      decks: [LEGAL],
      defaultDeckId: null,
      onselectdeck,
    });

    await userEvent.setup().click(start());

    expect(onselectdeck).toHaveBeenCalledExactlyOnceWith(LEGAL.id);
  });

  it("does not re-record a selection the save already holds", async () => {
    const onselectdeck = vi.fn();
    render(PreBattleScreen, {
      decks: [LEGAL],
      defaultDeckId: LEGAL.id,
      onselectdeck,
    });

    await userEvent.setup().click(start());

    expect(onselectdeck).not.toHaveBeenCalled();
  });

  /* An empty catalog calls every card missing, so a verdict reached before it
     lands would refuse every deck in the save. The screen waits instead. */
  it("waits rather than refusing while the decks are still being checked", () => {
    render(PreBattleScreen, { decks: null, defaultDeckId: "signal" });

    expect(start().disabled).toBe(true);
    expect(cy("story-briefing-deck-checking")).not.toBeNull();
    expect(cy("story-briefing-block-reason")).toBeNull();
    expect(cy("story-briefing-block-link")).toBeNull();
  });

  it("offers a retry and a way back when the card database will not load", async () => {
    const onretrydecks = vi.fn();
    const onreturn = vi.fn();
    render(PreBattleScreen, {
      decks: null,
      defaultDeckId: null,
      decksError: "The card database could not load.",
      onretrydecks,
      onreturn,
    });

    expect(start().disabled).toBe(true);
    expect(cy("story-briefing-deck-error")?.textContent).toContain(
      "The card database could not load.",
    );

    const user = userEvent.setup();
    await user.click(cy("story-briefing-deck-error-retry")!);
    await user.click(cy("story-briefing-return")!);

    expect(onretrydecks).toHaveBeenCalledOnce();
    expect(onreturn).toHaveBeenCalledOnce();
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
      expect(cy(`story-briefing-deck-${FIELDABLE.deck.id}`)).not.toBeNull(),
    );
    expect(start().disabled).toBe(true);
    expect(deckButton(BROKEN.id).disabled).toBe(true);
    expect(cy(`story-briefing-deck-issue-${BROKEN.id}`)?.textContent).toContain(
      "Main Deck needs 39 more",
    );
    expect(cy("story-briefing-block-reason")?.textContent).toContain(
      BROKEN.name,
    );

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
      expect(cy(`story-briefing-deck-${FIELDABLE.deck.id}`)).not.toBeNull(),
    );

    await userEvent.setup().click(deckButton(FIELDABLE.deck.id));
    await userEvent.setup().click(cy("story-briefing-return")!);
    await userEvent.setup().click(cy("story-map-location-old-arena")!);

    await waitFor(() =>
      expect(cy(`story-briefing-deck-${FIELDABLE.deck.id}`)).not.toBeNull(),
    );
    expect(deckButton(FIELDABLE.deck.id).getAttribute("aria-pressed")).toBe(
      "true",
    );
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
      expect(cy("story-briefing-deck-error")?.textContent).toContain(
        "The card database could not load.",
      ),
    );
    expect(start().disabled).toBe(true);
    expect(cy("story-briefing-deck-list")).toBeNull();

    const before = fetchSpy.mock.calls.length;
    await userEvent.setup().click(cy("story-briefing-deck-error-retry")!);
    await waitFor(() =>
      expect(fetchSpy.mock.calls.length).toBeGreaterThan(before),
    );
    /* Return to Map is the way out that never depends on the read. */
    await userEvent.setup().click(cy("story-briefing-return")!);
    expect(cy("story-map-screen")).not.toBeNull();
    expect(cy("story-briefing-screen")).toBeNull();
    fetchSpy.mockRestore();
  });
});
