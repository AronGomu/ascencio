import { describe, expect, it } from "vitest";
import { PROLOGUE } from "../../../src/story/content/prologue.ts";
import {
  createInitialStoryState,
  STORY_SCREENS,
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

  it("resets to pristine serializable state", () => {
    const changed = reduceStory(createInitialStoryState(), {
      type: "new-game",
    });
    const reset = reduceStory(changed, { type: "reset" });
    expect(reset).toEqual(createInitialStoryState());
    expect(() => JSON.parse(JSON.stringify(reset))).not.toThrow();
    expect(PROLOGUE.beats.length).toBeGreaterThanOrEqual(25);
    expect(PROLOGUE.beats.length).toBeLessThanOrEqual(40);
  });
});
