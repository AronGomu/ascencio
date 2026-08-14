import { describe, expect, it } from "vitest";
import {
  battleFacadeFailure,
  battleResultForDuelResult,
  BattleRequestError,
  parseBattleRequest,
} from "../../src/battle/battle-contracts.ts";

const LOCAL_DECK = {
  ref: { type: "local", deckId: "starter", revision: 3 },
  name: "Starter",
  validationDigest: "a".repeat(64),
  main: [1, 2, 3],
  extra: [4],
  side: [5],
};

const PRESET_REQUEST = {
  player: { kind: "preset", deckId: "burning-abyss" },
  opponent: { kind: "preset", deckId: "shaddoll" },
};

function localRequest(deck: unknown): unknown {
  return {
    player: { kind: "local", deck },
    opponent: { kind: "preset", deckId: "shaddoll" },
  };
}

describe("parseBattleRequest", () => {
  it("parses a preset request into a frozen value", () => {
    const request = parseBattleRequest(PRESET_REQUEST);

    expect(request).toEqual(PRESET_REQUEST);
    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.player)).toBe(true);
    expect(Object.isFrozen(request.opponent)).toBe(true);
  });

  it("parses a local request, copying and freezing every card list", () => {
    const source = { ...LOCAL_DECK, main: [...LOCAL_DECK.main] };
    const request = parseBattleRequest(localRequest(source));

    if (request.player.kind !== "local")
      throw new Error("expected a local selection");
    const deck = request.player.deck;
    expect(deck.main).toEqual([1, 2, 3]);
    expect(deck.main).not.toBe(source.main);
    expect(Object.isFrozen(deck)).toBe(true);
    expect(Object.isFrozen(deck.main)).toBe(true);
    expect(Object.isFrozen(deck.ref)).toBe(true);

    source.main.push(99);
    expect(deck.main).toEqual([1, 2, 3]);
  });

  it("rejects an unknown preset deck id", () => {
    expect(() =>
      parseBattleRequest({
        ...PRESET_REQUEST,
        player: { kind: "preset", deckId: "nope" },
      }),
    ).toThrow(BattleRequestError);
  });

  it("rejects extra keys anywhere in the request", () => {
    expect(() => parseBattleRequest({ ...PRESET_REQUEST, seed: 42 })).toThrow(
      BattleRequestError,
    );
    expect(() =>
      parseBattleRequest({
        ...PRESET_REQUEST,
        player: { kind: "preset", deckId: "shaddoll", seed: 42 },
      }),
    ).toThrow(BattleRequestError);
    expect(() =>
      parseBattleRequest(localRequest({ ...LOCAL_DECK, seed: 42 })),
    ).toThrow(BattleRequestError);
  });

  it("rejects a request that is not a plain object", () => {
    for (const value of [null, undefined, "duel", 7, [], () => undefined])
      expect(() => parseBattleRequest(value)).toThrow(BattleRequestError);
  });

  it("rejects card lists past their zone bound", () => {
    expect(() =>
      parseBattleRequest(
        localRequest({
          ...LOCAL_DECK,
          main: Array.from({ length: 61 }, () => 1),
        }),
      ),
    ).toThrow(BattleRequestError);
    expect(() =>
      parseBattleRequest(
        localRequest({
          ...LOCAL_DECK,
          extra: Array.from({ length: 16 }, () => 1),
        }),
      ),
    ).toThrow(BattleRequestError);
    expect(() =>
      parseBattleRequest(
        localRequest({
          ...LOCAL_DECK,
          side: Array.from({ length: 16 }, () => 1),
        }),
      ),
    ).toThrow(BattleRequestError);
  });

  it("accepts a card list exactly at its zone bound", () => {
    expect(() =>
      parseBattleRequest(
        localRequest({
          ...LOCAL_DECK,
          main: Array.from({ length: 60 }, () => 1),
          extra: Array.from({ length: 15 }, () => 1),
          side: Array.from({ length: 15 }, () => 1),
        }),
      ),
    ).not.toThrow();
  });

  it("rejects card codes that are not non-negative integers", () => {
    for (const main of [[1.5], [-1], ["1"], [Number.NaN]])
      expect(() =>
        parseBattleRequest(localRequest({ ...LOCAL_DECK, main })),
      ).toThrow(BattleRequestError);
  });

  it("rejects a malformed local deck reference", () => {
    for (const ref of [
      { type: "remote", deckId: "starter", revision: 1 },
      { type: "local", deckId: "", revision: 1 },
      { type: "local", deckId: "starter", revision: -1 },
      { type: "local", deckId: "starter" },
    ])
      expect(() =>
        parseBattleRequest(localRequest({ ...LOCAL_DECK, ref })),
      ).toThrow(BattleRequestError);
  });
});

describe("battleResultForDuelResult", () => {
  it("resolves a finished duel from the local player's seat", () => {
    expect(
      battleResultForDuelResult({
        type: "completed",
        winner: 0,
        loser: 1,
        reason: 1,
      }),
    ).toEqual({ kind: "resolved", outcome: "player-win" });
    expect(
      battleResultForDuelResult({
        type: "completed",
        winner: 1,
        loser: 0,
        reason: 1,
      }),
    ).toEqual({ kind: "resolved", outcome: "player-loss" });
  });

  it("reports a surrender as an abort, not a loss", () => {
    expect(
      battleResultForDuelResult({ type: "surrendered", winner: 1, loser: 0 }),
    ).toEqual({ kind: "aborted", reason: "surrender" });
  });

  /* A technical stop is never a duel the player lost: hosts branch on the
     outcome, and a fabricated loss would advance a story past a duel that
     never actually finished. */
  it("reports engine trouble as a failure, never as a resolved loss", () => {
    expect(
      battleResultForDuelResult({ type: "engineError", detail: "core died" }),
    ).toEqual({ kind: "failed", message: "core died" });
    expect(
      battleResultForDuelResult({
        type: "unsupported",
        messageType: 7,
        detail: "unsupported message",
      }),
    ).toEqual({ kind: "failed", message: "unsupported message" });
  });

  it("freezes every mapped result", () => {
    expect(
      Object.isFrozen(
        battleResultForDuelResult({
          type: "completed",
          winner: 0,
          loser: 1,
          reason: 1,
        }),
      ),
    ).toBe(true);
    expect(Object.isFrozen(battleFacadeFailure("boom"))).toBe(true);
  });
});
