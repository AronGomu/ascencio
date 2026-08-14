import { describe, expect, it } from "vitest";
import { duelRailStatusFor } from "../../src/app/presentation/duel-rail-status.ts";
import { promptId, snapshotId } from "../../src/duel/contracts/ids.ts";
import type { PlayerPrompt } from "../../src/duel/contracts/player-prompt.ts";
import type { PublicDuelState } from "../../src/duel/contracts/public-duel-state.ts";

const prompt: PlayerPrompt = {
  id: promptId("rail"),
  kind: "idleCommand",
  player: 0,
  title: "Choose action",
  choices: [],
  minimum: 1,
  maximum: 1,
  cancelable: false,
  ordered: false,
};
const snapshot = {
  snapshotId: snapshotId("d".repeat(64)),
  revision: 1,
  turn: 2,
  turnPlayer: 0,
  phase: "main1",
  layout: { extraMonsterZones: false },
  players: [
    {
      player: 0,
      lifePoints: 8000,
      deckCount: 35,
      deck: [],
      extraDeckCount: 0,
      handCount: 5,
      hand: [],
      extraDeck: [],
      monsters: [],
      spellsAndTraps: [],
      graveyard: [],
      banished: [],
    },
    {
      player: 1,
      lifePoints: 7000,
      deckCount: 35,
      deck: [],
      extraDeckCount: 0,
      handCount: 5,
      hand: [],
      extraDeck: [],
      monsters: [],
      spellsAndTraps: [],
      graveyard: [],
      banished: [],
    },
  ],
  chain: [],
} satisfies PublicDuelState;

describe("duelRailStatusFor", () => {
  it("applies truthful precedence", () => {
    expect(
      duelRailStatusFor({ prompt, snapshot, responsePending: true }),
    ).toEqual({
      title: "Waiting for the engine",
      subtitle: "Your response is being processed.",
      thinking: true,
    });
    expect(
      duelRailStatusFor({
        prompt: null,
        snapshot: null,
        responsePending: false,
      }),
    ).toEqual({
      title: "Preparing duel",
      subtitle: "Loading current duel state.",
      thinking: true,
    });
    expect(
      duelRailStatusFor({ prompt, snapshot, responsePending: false }),
    ).toEqual({
      title: "Choose action",
      subtitle: "Choose in the active prompt.",
      thinking: false,
    });
  });
  it("maps opponent and player turns", () => {
    expect(
      duelRailStatusFor({
        prompt: null,
        snapshot: { ...snapshot, turnPlayer: 1 },
        responsePending: false,
      }).title,
    ).toBe("Opponent is thinking");
    expect(
      duelRailStatusFor({ prompt: null, snapshot, responsePending: false }),
    ).toEqual({
      title: "Your move",
      subtitle: "Main 1 · 5 cards in hand",
      thinking: false,
    });
  });
});
