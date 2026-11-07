import { afterEach, describe, expect, it } from "vitest";
import { STARTER_DECK_NAME } from "../../../src/decks/editing/index.ts";
import { buildStarterGrant } from "../../../src/story/decks/starter-grant.ts";
import { reduceStory } from "../../../src/story/model/story-reducer.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import { createSqliteStoryRepository } from "../../../src/story/saves/index.ts";
import {
  storyUserRuntime,
  resetStorySessionFixture,
} from "../../fixtures/story-session.ts";
import { storyBindingFixture } from "../../fixtures/story-release.ts";

afterEach(resetStorySessionFixture);

function newGame(): ReturnType<typeof reduceStory> {
  return reduceStory(createInitialStoryState(), {
    type: "new-game",
    starterGrant: buildStarterGrant(),
  });
}

describe("the new-save starter grant", () => {
  it("a new game grants the starter deck", () => {
    const { decks } = newGame();
    expect(decks).toHaveLength(1);
    expect(decks[0]?.name).toBe(STARTER_DECK_NAME);
    expect(decks[0]?.main.length).toBeGreaterThanOrEqual(40);
  });

  /* The point of the grant: a deck the save does not own the cards for is a
     deck the ownership rule refuses at the first duel. */
  it("a new game credits the starter deck's cards", () => {
    const { decks, collection } = newGame();
    const deck = decks[0];
    expect(deck).toBeDefined();
    const used = new Map<number, number>();
    for (const code of [...deck!.main, ...deck!.extra, ...deck!.side])
      used.set(code, (used.get(code) ?? 0) + 1);
    expect(used.size).toBeGreaterThan(0);
    for (const [code, copies] of used)
      expect(collection[code] ?? 0).toBeGreaterThanOrEqual(copies);
  });

  it("the granted deck is the default", () => {
    const state = newGame();
    expect(state.defaultDeckId).toBe(state.decks[0]?.id);
  });

  /* A pack costs 150 DP; the grant is cards, not credit. */
  it("the wallet is unchanged", () => {
    expect(newGame().dp).toBe(1000);
  });

  it("the grant is deterministic", () => {
    const first = newGame();
    const second = newGame();
    expect(second.decks).toEqual(first.decks);
    expect(second.collection).toEqual(first.collection);
  });

  it("the granted deck round-trips through current SQLite saves", async () => {
    const state = newGame();
    const saves = createSqliteStoryRepository(storyUserRuntime({}));
    expect(
      await saves.write("manual:1", state, 0, storyBindingFixture()),
    ).toEqual({ kind: "written", revision: 1 });
    expect(await saves.read("manual:1")).toMatchObject({
      kind: "ready",
      envelope: { schemaVersion: 6, state },
    });
  });

  it("reading a current empty library grants nothing", async () => {
    const existing = { ...createInitialStoryState(), dp: 40 };
    const saves = createSqliteStoryRepository(storyUserRuntime({}));
    expect(
      await saves.write("manual:1", existing, 0, storyBindingFixture()),
    ).toEqual({ kind: "written", revision: 1 });
    expect(await saves.read("manual:1")).toMatchObject({
      kind: "ready",
      envelope: { state: existing },
    });
  });
});

describe("buildStarterGrant", () => {
  /* Two grants never share a mutable list: a deck edited in one save must not
     turn up edited in the next new game. */
  it("hands every caller its own frozen record", () => {
    const first = buildStarterGrant();
    const second = buildStarterGrant();
    expect(second.deck).toEqual(first.deck);
    expect(second.collection).toEqual(first.collection);
    expect(Object.isFrozen(first.deck)).toBe(true);
    expect(() => {
      (first.deck.main as number[]).push(1);
    }).toThrow();
  });

  it("credits every copy the deck uses and nothing else", () => {
    const { deck, collection } = buildStarterGrant();
    const codes = [...deck.main, ...deck.extra, ...deck.side];
    expect(
      Object.keys(collection)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([...new Set(codes)].sort((a, b) => a - b));
    const total = Object.values(collection).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(codes.length);
  });
});
