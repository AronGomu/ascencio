import { describe, expect, it } from "vitest";
import { decksBrokenBySale } from "../../../src/story/shop/sell-impact.ts";
import {
  createInitialStoryState,
  type StoryDeck,
  type StoryState,
} from "../../../src/story/model/story-state.ts";
import { storyDeckFixture } from "../../fixtures/story-decks.ts";

/* The question a sale has to answer is counterfactual: not which decks are
   illegal, but which this sale would make illegal. So every case here pairs a
   collection with the decks built out of it, and asks what the sale would
   leave behind (ADR-050). */

const BLUE_EYES = 89631139;
const DARK_MAGICIAN = 46986414;
const RAIGEKI = 12580477;

function saveWith(
  collection: Readonly<Record<number, number>>,
  decks: readonly StoryDeck[],
): StoryState {
  return Object.freeze({ ...createInitialStoryState(), collection, decks });
}

describe("decksBrokenBySale", () => {
  it("a harmless sale breaks nothing", () => {
    const state = saveWith({ [BLUE_EYES]: 2, [RAIGEKI]: 1 }, [
      storyDeckFixture("dragons", { main: [BLUE_EYES, BLUE_EYES] }),
    ]);
    expect(decksBrokenBySale(state, [{ code: RAIGEKI, quantity: 1 }])).toEqual(
      [],
    );
  });

  it("selling below a deck's usage names that deck", () => {
    const state = saveWith({ [BLUE_EYES]: 2 }, [
      storyDeckFixture("dragons", {
        name: "White Dragons",
        main: [BLUE_EYES, BLUE_EYES],
      }),
    ]);
    expect(
      decksBrokenBySale(state, [{ code: BLUE_EYES, quantity: 1 }]),
    ).toEqual([
      { deckId: "dragons", deckName: "White Dragons", codes: [BLUE_EYES] },
    ]);
  });

  it("selling spare copies breaks nothing", () => {
    const state = saveWith({ [BLUE_EYES]: 3 }, [
      storyDeckFixture("dragons", { main: [BLUE_EYES] }),
    ]);
    expect(
      decksBrokenBySale(state, [{ code: BLUE_EYES, quantity: 2 }]),
    ).toEqual([]);
  });

  it("several decks are all named", () => {
    const state = saveWith({ [BLUE_EYES]: 1 }, [
      storyDeckFixture("dragons", { name: "White Dragons", main: [BLUE_EYES] }),
      storyDeckFixture("beatdown", { name: "Beatdown", main: [BLUE_EYES] }),
    ]);
    expect(
      decksBrokenBySale(state, [{ code: BLUE_EYES, quantity: 1 }]),
    ).toEqual([
      { deckId: "dragons", deckName: "White Dragons", codes: [BLUE_EYES] },
      { deckId: "beatdown", deckName: "Beatdown", codes: [BLUE_EYES] },
    ]);
  });

  /* The sale is blamed for what it changes and nothing else. A deck already
     over its owned copies — the save was edited, or an older build let it
     happen — is illegal before the sale and illegal after it, and naming it
     here would send the player to fix a deck this sale never touched. */
  it("a deck already over its owned copies is not named by a later sale", () => {
    const state = saveWith({ [BLUE_EYES]: 2 }, [
      storyDeckFixture("dragons", {
        main: [BLUE_EYES, BLUE_EYES, BLUE_EYES],
      }),
    ]);
    expect(
      decksBrokenBySale(state, [{ code: BLUE_EYES, quantity: 1 }]),
    ).toEqual([]);
  });

  /* One deck, one collection, and the same card sleeved into two zones is two
     copies of one card — the same count `validateDeckDraft` takes, so the
     dialog and the illegal badge cannot disagree. */
  it("copies in the extra and side decks count towards the usage", () => {
    const state = saveWith({ [BLUE_EYES]: 2, [DARK_MAGICIAN]: 1 }, [
      storyDeckFixture("dragons", {
        main: [BLUE_EYES],
        extra: [],
        side: [BLUE_EYES],
      }),
    ]);
    expect(
      decksBrokenBySale(state, [{ code: BLUE_EYES, quantity: 1 }]),
    ).toEqual([
      { deckId: "dragons", deckName: "Deck dragons", codes: [BLUE_EYES] },
    ]);
  });

  it("every card the sale breaks is named for that deck", () => {
    const state = saveWith({ [BLUE_EYES]: 1, [DARK_MAGICIAN]: 1 }, [
      storyDeckFixture("dragons", { main: [BLUE_EYES, DARK_MAGICIAN] }),
    ]);
    expect(
      decksBrokenBySale(state, [
        { code: BLUE_EYES, quantity: 1 },
        { code: DARK_MAGICIAN, quantity: 1 },
      ]),
    ).toEqual([
      {
        deckId: "dragons",
        deckName: "Deck dragons",
        codes: [BLUE_EYES, DARK_MAGICIAN],
      },
    ]);
  });

  /* Two rows naming one card are one sale of both, exactly as the reducer
     totals them before it refuses a collection that would go negative. */
  it("two rows selling the same card are counted together", () => {
    const state = saveWith({ [BLUE_EYES]: 2 }, [
      storyDeckFixture("dragons", { main: [BLUE_EYES, BLUE_EYES] }),
    ]);
    expect(
      decksBrokenBySale(state, [
        { code: BLUE_EYES, quantity: 1 },
        { code: BLUE_EYES, quantity: 1 },
      ]),
    ).toEqual([
      { deckId: "dragons", deckName: "Deck dragons", codes: [BLUE_EYES] },
    ]);
  });

  it("a save with no decks has nothing to break", () => {
    const state = saveWith({ [BLUE_EYES]: 2 }, []);
    expect(
      decksBrokenBySale(state, [{ code: BLUE_EYES, quantity: 2 }]),
    ).toEqual([]);
  });

  /* The hypothetical collection is a projection, never an edit: the live save
     is what the sale will be applied to, and a screen that damaged it while
     asking a question would sell cards nobody confirmed. */
  it("asking never touches the save", () => {
    const state = saveWith({ [BLUE_EYES]: 2 }, [
      storyDeckFixture("dragons", { main: [BLUE_EYES, BLUE_EYES] }),
    ]);
    const snapshot = structuredClone(state);
    decksBrokenBySale(state, [{ code: BLUE_EYES, quantity: 2 }]);
    expect(state).toEqual(snapshot);
  });
});
