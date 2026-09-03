import { describe, expect, it } from "vitest";
import { PROLOGUE } from "../../../src/story/content/prologue.ts";
import {
  createInitialStoryState,
  STORY_SCREENS,
  storyScreenLabel,
  transitionStoryScreen,
  type ShopRarity,
  type StoryScreen,
} from "../../../src/story/model/story-state.ts";
import { reduceStory } from "../../../src/story/model/story-reducer.ts";

describe("story state model", () => {
  /* `launcher` was the reviewer harness's own screen; the production domain
     opens on the title. */
  it("declares every story screen and starts New Game at first narrative beat", () => {
    expect(STORY_SCREENS).toEqual([
      "title",
      "load",
      "narrative",
      "map",
      "pre-battle",
      "battle-mock",
      "outcome",
      "reward",
      "end",
      "shop-greeting",
      "shop-browse",
      "shop-cards",
      "shop-sell",
      "shop-opening",
      "shop-results",
    ]);
    expect(createInitialStoryState().screen).toBe("title");
    const state = reduceStory(createInitialStoryState(), {
      type: "new-game",
    });
    expect(state).toMatchObject({
      screen: "narrative",
      narrativeIndex: 0,
      progressExists: true,
    });
  });

  it("remembers every distinct screen transition and preserves the prior screen on same-screen updates", () => {
    for (const from of STORY_SCREENS) {
      for (const to of STORY_SCREENS) {
        const state = {
          ...createInitialStoryState(),
          screen: from,
          previousScreen: "narrative" as const,
        };
        const next = transitionStoryScreen(state, to);
        expect(next.screen, `${from} → ${to} screen`).toBe(to);
        expect(next.previousScreen, `${from} → ${to} previous`).toBe(
          from === to ? "narrative" : from,
        );
      }
    }
  });

  it("records reducer transitions but not same-screen state updates", () => {
    const narrative = {
      ...createInitialStoryState(),
      screen: "narrative" as const,
      previousScreen: "title" as const,
    };
    const advanced = reduceStory(narrative, { type: "advance", inputId: 1 });
    expect(advanced.previousScreen).toBe("title");
    expect(reduceStory(advanced, { type: "go-to-map" })).toMatchObject({
      screen: "map",
      previousScreen: "narrative",
    });
  });

  it("labels every story screen for contextual navigation", () => {
    const labels = {
      title: "Title",
      load: "Load",
      narrative: "Dialog",
      map: "Map",
      "pre-battle": "Duel Setup",
      "battle-mock": "Duel",
      outcome: "Duel Result",
      reward: "Duel Result",
      end: "End",
      "shop-greeting": "Shop",
      "shop-browse": "Shop",
      "shop-cards": "Shop",
      "shop-sell": "Shop",
      "shop-opening": "Shop",
      "shop-results": "Shop",
    } satisfies Record<StoryScreen, string>;
    expect(
      Object.fromEntries(
        STORY_SCREENS.map((screen) => [screen, storyScreenLabel(screen)]),
      ),
    ).toEqual(labels);
  });

  /* The wallet is part of the story rather than a store beside it, so a fresh
     run starts funded and with no shop session half-open. */
  it("initial state funds the wallet and idles the shop", () => {
    const initial = createInitialStoryState();
    expect(initial.dp).toBe(1000);
    expect(initial.boosters).toEqual({});
    expect(initial.collection).toEqual({});
    expect(initial.shopReturnScreen).toBeNull();
    expect(initial.shopSetId).toBeNull();
    expect(initial.openedCards).toBeNull();
    expect(initial.openingMode).toBeNull();
  });

  it("continues mock progress and loads only occupied manual/autosave slots", () => {
    const fresh = createInitialStoryState();
    expect(reduceStory(fresh, { type: "continue" })).toBe(fresh);
    const continued = reduceStory(
      { ...fresh, progressExists: true, savedScreen: "map" },
      { type: "continue" },
    );
    expect(continued.screen).toBe("map");
    expect(reduceStory(fresh, { type: "load", slot: "empty" })).toBe(fresh);
    expect(reduceStory(fresh, { type: "load", slot: "manual" }).screen).toBe(
      "narrative",
    );
    expect(reduceStory(fresh, { type: "load", slot: "autosave" }).screen).toBe(
      "map",
    );
  });

  it("advances one beat per unique input and records one choice", () => {
    let state = reduceStory(createInitialStoryState(), {
      type: "new-game",
    });
    state = reduceStory(state, { type: "advance", inputId: 1 });
    const duplicate = reduceStory(state, { type: "advance", inputId: 1 });
    expect(duplicate.narrativeIndex).toBe(1);
    state = reduceStory(duplicate, { type: "choose", choice: "trust-rin" });
    const repeated = reduceStory(state, {
      type: "choose",
      choice: "challenge-rin",
    });
    expect(repeated.choice).toBe("trust-rin");
    expect(repeated.choiceResponse).toMatch(/trust/i);
    const challenged = reduceStory(
      reduceStory(createInitialStoryState(), { type: "new-game" }),
      { type: "choose", choice: "challenge-rin" },
    );
    expect(challenged.choiceResponse).not.toBe(repeated.choiceResponse);
  });

  it("retains choice for later map acknowledgment", () => {
    const state = reduceStory(
      reduceStory(createInitialStoryState(), { type: "new-game" }),
      { type: "choose", choice: "observe-first" },
    );
    expect(
      reduceStory(state, { type: "go-to-map" }).laterAcknowledgment,
    ).toMatch(/watched|observe/i);
  });

  /* The encounter has to outlive the screen: the story is unmounted while its
     duel runs, and what comes back has to know which node it was. */
  it("records the selected encounter and clears it once the outcome is read", () => {
    const map = { ...createInitialStoryState(), screen: "map" as const };
    const briefing = reduceStory(map, {
      type: "select-location",
      locationId: "old-arena",
    });
    expect(briefing.encounterId).toBe("old-arena");
    expect(createInitialStoryState().encounterId).toBeNull();

    const aborted = reduceStory(
      { ...briefing, screen: "battle-mock" },
      { type: "battle-result", result: "abort" },
    );
    expect(aborted.encounterId).toBe("old-arena");
    expect(
      reduceStory(aborted, { type: "continue-outcome" }).encounterId,
    ).toBeNull();

    const rewarded = reduceStory(
      reduceStory(
        { ...briefing, screen: "battle-mock" },
        { type: "battle-result", result: "win" },
      ),
      { type: "continue-outcome" },
    );
    expect(rewarded.screen).toBe("reward");
    expect(
      reduceStory(rewarded, { type: "acknowledge-reward" }).encounterId,
    ).toBeNull();
  });

  it("selecting the card shop opens the greeting, not a duel", () => {
    const map = { ...createInitialStoryState(), screen: "map" as const };
    const next = reduceStory(map, {
      type: "select-location",
      locationId: "card-shop",
    });
    expect(next.screen).toBe("shop-greeting");
    expect(next.shopReturnScreen).toBe("map");
    expect(next.encounterId).toBeNull();
  });

  it("leaving the shop returns where it was entered", () => {
    const greeting = {
      ...createInitialStoryState(),
      screen: "shop-greeting" as const,
      shopReturnScreen: "map" as const,
    };
    const next = reduceStory(greeting, { type: "leave-shop" });
    expect(next.screen).toBe("map");
    expect(next.shopReturnScreen).toBeNull();
  });

  it("leave-shop is a no-op on non-shop screens", () => {
    const map = { ...createInitialStoryState(), screen: "map" as const };
    expect(reduceStory(map, { type: "leave-shop" })).toBe(map);
  });

  it("allows available map destinations only", () => {
    const map = { ...createInitialStoryState(), screen: "map" as const };
    expect(
      reduceStory(map, { type: "select-location", locationId: "old-arena" })
        .screen,
    ).toBe("pre-battle");
    expect(
      reduceStory(map, { type: "select-location", locationId: "archive" }),
    ).toBe(map);
    expect(
      reduceStory(map, {
        type: "select-location",
        locationId: "hidden-gate",
      }),
    ).toBe(map);
  });

  it.each(["win", "loss", "abort", "failure"] as const)(
    "models %s as distinct battle result",
    (result) => {
      const battle = {
        ...createInitialStoryState(),
        screen: "battle-mock" as const,
      };
      expect(
        reduceStory(battle, { type: "battle-result", result }),
      ).toMatchObject({ screen: "outcome", outcome: result });
    },
  );

  it("routes win/loss separately and grants resolved rewards once", () => {
    const battle = {
      ...createInitialStoryState(),
      screen: "battle-mock" as const,
    };
    const win = reduceStory(battle, {
      type: "battle-result",
      result: "win",
    });
    const loss = reduceStory(battle, {
      type: "battle-result",
      result: "loss",
    });
    expect(win.outcomeScene).not.toBe(loss.outcomeScene);
    const rewarded = reduceStory(win, { type: "continue-outcome" });
    expect(rewarded).toMatchObject({ screen: "reward", rewardGranted: true });
    expect(reduceStory(rewarded, { type: "continue-outcome" })).toBe(rewarded);
  });

  it("returns repeat completed battles to map without a second reward", () => {
    const repeatOutcome = {
      ...createInitialStoryState(),
      screen: "outcome" as const,
      outcome: "win" as const,
      rewardGranted: true,
      rewardAcknowledged: true,
    };
    expect(
      reduceStory(repeatOutcome, { type: "continue-outcome" }),
    ).toMatchObject({
      screen: "map",
      outcome: null,
      rewardGranted: true,
      rewardAcknowledged: true,
    });
  });

  it.each(["abort", "failure"] as const)(
    "never grants progress after %s",
    (result) => {
      const outcome = reduceStory(
        { ...createInitialStoryState(), screen: "battle-mock" },
        { type: "battle-result", result },
      );
      expect(reduceStory(outcome, { type: "continue-outcome" })).toMatchObject({
        rewardGranted: false,
        screen: "map",
      });
    },
  );

  it("resets to pristine serializable state while remembering its origin", () => {
    const changed = reduceStory(createInitialStoryState(), {
      type: "new-game",
    });
    const reset = reduceStory(changed, { type: "reset" });
    expect(reset).toEqual({
      ...createInitialStoryState(),
      previousScreen: "narrative",
    });
    expect(() => JSON.parse(JSON.stringify(reset))).not.toThrow();
    expect(PROLOGUE.beats.length).toBeGreaterThanOrEqual(25);
    expect(PROLOGUE.beats.length).toBeLessThanOrEqual(40);
  });

  it("buying ten packs pays fifteen hundred dp", () => {
    const browse = {
      ...createInitialStoryState(),
      screen: "shop-browse" as const,
      dp: 1500,
    };
    const next = reduceStory(browse, {
      type: "buy-packs",
      setId: "metal-raiders",
      count: 10,
      released: true,
    });
    expect(next.dp).toBe(0);
    expect(next.boosters["metal-raiders"]).toBe(10);
  });

  it("buying beyond the wallet is refused", () => {
    const browse = {
      ...createInitialStoryState(),
      screen: "shop-browse" as const,
      dp: 150,
    };
    const next = reduceStory(browse, {
      type: "buy-packs",
      setId: "metal-raiders",
      count: 2,
      released: true,
    });
    expect(next).toBe(browse);
  });

  it("non-integer counts are refused", () => {
    const browse = {
      ...createInitialStoryState(),
      screen: "shop-browse" as const,
      dp: 10000,
    };
    for (const count of [1.5, 0, -3]) {
      expect(
        reduceStory(browse, {
          type: "buy-packs",
          setId: "metal-raiders",
          count,
          released: true,
        }),
      ).toBe(browse);
    }
  });

  it("buying a set the shop has not released is refused", () => {
    const browse = {
      ...createInitialStoryState(),
      screen: "shop-browse" as const,
      dp: 1500,
    };
    const next = reduceStory(browse, {
      type: "buy-packs",
      setId: "soul-of-the-duelist",
      count: 1,
      released: false,
    });
    expect(next).toBe(browse);
    expect(next.dp).toBe(1500);
    expect(next.boosters).toEqual({});
  });

  it("shop-navigate only walks shop screens", () => {
    const map = { ...createInitialStoryState(), screen: "map" as const };
    expect(reduceStory(map, { type: "shop-navigate", to: "browse" })).toBe(map);

    const greeting = {
      ...createInitialStoryState(),
      screen: "shop-greeting" as const,
      shopReturnScreen: "map" as const,
    };
    expect(
      reduceStory(greeting, { type: "shop-navigate", to: "browse" }).screen,
    ).toBe("shop-browse");
  });

  it("keeps each distinct shop sub-screen as the meaningful return origin", () => {
    const greeting = {
      ...createInitialStoryState(),
      screen: "shop-greeting" as const,
      previousScreen: "map" as const,
    };
    const browse = reduceStory(greeting, {
      type: "shop-navigate",
      to: "browse",
    });
    expect(browse.previousScreen).toBe("shop-greeting");

    const cards = reduceStory(browse, {
      type: "view-set-cards",
      setId: "lob",
    });
    expect(cards.previousScreen).toBe("shop-browse");

    const unchangedScreen = reduceStory(cards, {
      type: "buy-single",
      code: 111,
      rarity: "common",
    });
    expect(unchangedScreen.previousScreen).toBe("shop-browse");
  });

  it("view-set-cards opens the list for that set", () => {
    const browse = {
      ...createInitialStoryState(),
      screen: "shop-browse" as const,
    };
    const next = reduceStory(browse, {
      type: "view-set-cards",
      setId: "lob",
    });
    expect(next).toMatchObject({ screen: "shop-cards", shopSetId: "lob" });
  });

  it("back to browse clears the set", () => {
    const cards = {
      ...createInitialStoryState(),
      screen: "shop-cards" as const,
      shopSetId: "lob",
    };
    const next = reduceStory(cards, { type: "shop-navigate", to: "browse" });
    expect(next.screen).toBe("shop-browse");
    expect(next.shopSetId).toBeNull();
  });

  it("buying a single pays four times sell", () => {
    const cards = {
      ...createInitialStoryState(),
      screen: "shop-cards" as const,
      dp: 100,
    };
    const next = reduceStory(cards, {
      type: "buy-single",
      code: 111,
      rarity: "common",
    });
    expect(next.dp).toBe(60);
    expect(next.collection[111]).toBe(1);
  });

  it("single beyond the wallet is refused", () => {
    const cards = {
      ...createInitialStoryState(),
      screen: "shop-cards" as const,
      dp: 30,
    };
    const next = reduceStory(cards, {
      type: "buy-single",
      code: 111,
      rarity: "common",
    });
    expect(next).toBe(cards);
  });

  /* A rarity outside the union has no price, so pricing it produced `NaN`,
     every comparison against it was false, and the buy went through for a
     wallet that could never be spent again. */
  it("single at a rarity the shop does not sell is refused", () => {
    const cards = {
      ...createInitialStoryState(),
      screen: "shop-cards" as const,
      dp: 1000,
    };
    const next = reduceStory(cards, {
      type: "buy-single",
      code: 111,
      rarity: "mythic" as ShopRarity,
    });
    expect(next).toBe(cards);
    expect(next.dp).toBe(1000);
  });

  it("single off the cards screen is refused", () => {
    const browse = {
      ...createInitialStoryState(),
      screen: "shop-browse" as const,
      dp: 1000,
    };
    const next = reduceStory(browse, {
      type: "buy-single",
      code: 111,
      rarity: "common",
    });
    expect(next).toBe(browse);
  });

  it("opening consumes boosters and grows the collection", () => {
    const shopBrowse = {
      ...createInitialStoryState(),
      screen: "shop-browse" as const,
      boosters: { a: 2 },
    };
    const cards = Array.from({ length: 18 }, (_, i) => ({
      code: i < 9 ? 1 : 2,
      rarity: "common" as const,
    }));
    const next = reduceStory(shopBrowse, {
      type: "open-boosters",
      picks: [{ setId: "a", count: 2 }],
      cards,
      mode: "all",
    });
    expect(next.boosters).toEqual({});
    expect(next.collection[1]).toBe(9);
    expect(next.collection[2]).toBe(9);
    expect(next.screen).toBe("shop-results");
    expect(next.openedCards).toBe(cards);
  });

  it("sequential mode heads to the opening screen", () => {
    const shopBrowse = {
      ...createInitialStoryState(),
      screen: "shop-browse" as const,
      boosters: { a: 2 },
    };
    const cards = Array.from({ length: 18 }, (_, i) => ({
      code: i < 9 ? 1 : 2,
      rarity: "common" as const,
    }));
    const next = reduceStory(shopBrowse, {
      type: "open-boosters",
      picks: [{ setId: "a", count: 2 }],
      cards,
      mode: "sequential",
    });
    expect(next.screen).toBe("shop-opening");
  });

  it("overdrawn picks are refused", () => {
    const shopBrowse = {
      ...createInitialStoryState(),
      screen: "shop-browse" as const,
      boosters: { a: 2 },
    };
    const next = reduceStory(shopBrowse, {
      type: "open-boosters",
      picks: [{ setId: "a", count: 3 }],
      cards: [],
      mode: "all",
    });
    expect(next).toBe(shopBrowse);
  });

  it("zero, negative and fractional pack counts are refused", () => {
    const shopBrowse = {
      ...createInitialStoryState(),
      screen: "shop-browse" as const,
      boosters: { a: 2 },
    };
    for (const count of [0, -1, 1.5]) {
      const next = reduceStory(shopBrowse, {
        type: "open-boosters",
        picks: [{ setId: "a", count }],
        cards: [],
        mode: "all",
      });
      expect(next, `count ${count}`).toBe(shopBrowse);
    }
  });

  it("finish-opening reaches the recap", () => {
    const opening = {
      ...createInitialStoryState(),
      screen: "shop-opening" as const,
      openedCards: [{ code: 1, rarity: "common" as const }],
      openingMode: "sequential" as const,
    };
    const next = reduceStory(opening, { type: "finish-opening" });
    expect(next.screen).toBe("shop-results");
    expect(next.openedCards).toBe(opening.openedCards);
    expect(next.openingMode).toBe(opening.openingMode);
  });

  it("finish-opening elsewhere is refused", () => {
    const map = { ...createInitialStoryState(), screen: "map" as const };
    expect(reduceStory(map, { type: "finish-opening" })).toBe(map);
  });

  it("acknowledge clears the recap", () => {
    const results = {
      ...createInitialStoryState(),
      screen: "shop-results" as const,
      openedCards: [{ code: 1, rarity: "common" as const }],
      openingMode: "all" as const,
    };
    const next = reduceStory(results, { type: "acknowledge-opened" });
    expect(next.screen).toBe("shop-browse");
    expect(next.openedCards).toBeNull();
    expect(next.openingMode).toBeNull();
  });

  it("selling pays the ladder", () => {
    const sell = {
      ...createInitialStoryState(),
      screen: "shop-sell" as const,
      dp: 500,
      collection: { 111: 3, 222: 1 } as Record<number, number>,
    };
    const next = reduceStory(sell, {
      type: "sell-cards",
      items: [
        { code: 111, quantity: 2, rarity: "common" },
        { code: 222, quantity: 1, rarity: "ultra-rare" },
      ],
    });
    expect(next.dp).toBe(620);
    expect(next.collection).toEqual({ 111: 1 });
  });

  /* The receipt names a rarity; the price for it comes from the ladder here.
     A screen that has not loaded the shop data yet cannot know a card's
     rarity, and a caller-supplied price would let that ignorance be paid
     out — irreversibly — at the commonest rate. */
  it("sell price comes from the ladder, not from the receipt", () => {
    const sell = {
      ...createInitialStoryState(),
      screen: "shop-sell" as const,
      dp: 0,
      collection: { 111: 1 } as Record<number, number>,
    };
    const next = reduceStory(sell, {
      type: "sell-cards",
      items: [{ code: 111, quantity: 1, rarity: "ghost-rare" }],
    });
    expect(next.dp).toBe(1000);
    expect(next.collection).toEqual({});
  });

  it("selling at a rarity the shop does not price is refused", () => {
    const sell = {
      ...createInitialStoryState(),
      screen: "shop-sell" as const,
      dp: 0,
      collection: { 111: 1 } as Record<number, number>,
    };
    const next = reduceStory(sell, {
      type: "sell-cards",
      items: [{ code: 111, quantity: 1, rarity: "mythic" as ShopRarity }],
    });
    expect(next).toBe(sell);
  });

  it("selling more than owned is wholly refused", () => {
    const sell = {
      ...createInitialStoryState(),
      screen: "shop-sell" as const,
      dp: 0,
      collection: { 111: 1, 222: 5 } as Record<number, number>,
    };
    const next = reduceStory(sell, {
      type: "sell-cards",
      items: [
        { code: 222, quantity: 3, rarity: "common" },
        { code: 111, quantity: 2, rarity: "common" },
      ],
    });
    expect(next).toBe(sell);
  });

  it("selling off the sell screen is refused", () => {
    const browse = {
      ...createInitialStoryState(),
      screen: "shop-browse" as const,
      dp: 0,
      collection: { 111: 3 } as Record<number, number>,
    };
    const next = reduceStory(browse, {
      type: "sell-cards",
      items: [{ code: 111, quantity: 1, rarity: "common" }],
    });
    expect(next).toBe(browse);
  });

  /* Each item used to be checked against the stored collection on its own, so
     two rows naming one card aggregated past the guard: the player was paid
     for four copies of a card they owned three of, and the save came back
     holding minus one. */
  it("repeated codes are counted together against the collection", () => {
    const sell = {
      ...createInitialStoryState(),
      screen: "shop-sell" as const,
      dp: 0,
      collection: { 111: 3 } as Record<number, number>,
    };
    const next = reduceStory(sell, {
      type: "sell-cards",
      items: [
        { code: 111, quantity: 2, rarity: "common" },
        { code: 111, quantity: 2, rarity: "common" },
      ],
    });
    expect(next).toBe(sell);
    expect(next.collection[111]).toBe(3);
  });

  it("repeated sets are counted together against the boosters", () => {
    const shopBrowse = {
      ...createInitialStoryState(),
      screen: "shop-browse" as const,
      boosters: { a: 2 },
    };
    const next = reduceStory(shopBrowse, {
      type: "open-boosters",
      picks: [
        { setId: "a", count: 2 },
        { setId: "a", count: 2 },
      ],
      cards: [],
      mode: "all",
    });
    expect(next).toBe(shopBrowse);
    expect(next.boosters["a"]).toBe(2);
  });

  it("zero and fractional quantities are refused", () => {
    const sell = {
      ...createInitialStoryState(),
      screen: "shop-sell" as const,
      dp: 0,
      collection: { 111: 5 } as Record<number, number>,
    };
    for (const quantity of [0, 1.5, -1]) {
      expect(
        reduceStory(sell, {
          type: "sell-cards",
          items: [{ code: 111, quantity, rarity: "common" }],
        }),
      ).toBe(sell);
    }
  });
});
