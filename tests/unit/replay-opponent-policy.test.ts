import { describe, expect, it, vi } from "vitest";
import {
  choiceId,
  promptId,
  type PromptId,
} from "../../src/battle/duel/contracts/ids.ts";
import type { PlayerPrompt } from "../../src/battle/duel/contracts/player-prompt.ts";
import type {
  OpponentPolicy,
  OpponentVisibleDuelState,
} from "../../src/battle/worker/opponent/OpponentPolicy.ts";
import {
  ReplayDivergenceError,
  ReplayOpponentPolicy,
} from "../../src/battle/worker/opponent/ReplayOpponentPolicy.ts";

const VISIBLE_STATE = {
  revision: 1,
  turn: 1,
  turnPlayer: 1,
  phase: "main1",
  players: [summary(0), summary(1)],
  chainSize: 0,
} as const satisfies OpponentVisibleDuelState;

function summary(player: 0 | 1) {
  return {
    player,
    lifePoints: 8000,
    deckCount: 35,
    extraDeckCount: 0,
    handCount: 5,
    monsterCount: 0,
    spellTrapCount: 0,
    graveyardCount: 0,
    banishedCount: 0,
  } as const;
}

function opponentPrompt(id: PromptId): PlayerPrompt {
  return Object.freeze({
    id,
    kind: "yesNo",
    player: 1,
    title: "Confirm",
    choices: Object.freeze([
      Object.freeze({ id: choiceId(`${id}-yes`), label: "Yes", action: "yes" }),
      Object.freeze({ id: choiceId(`${id}-no`), label: "No", action: "no" }),
    ]),
    minimum: 1,
    maximum: 1,
    cancelable: false,
    ordered: false,
  });
}

function spyPolicy(): OpponentPolicy {
  return {
    choose: vi.fn(() => ({
      choiceIds: [choiceId("live-choice")],
      reason: "decline_optional" as const,
    })),
  };
}

describe("ReplayOpponentPolicy", () => {
  it("answers recorded prompts verbatim without consulting the live policy", () => {
    const resumeWith = spyPolicy();
    const policy = new ReplayOpponentPolicy(
      [
        {
          promptId: promptId("duel-1-prompt-2"),
          choiceIds: [choiceId("duel-1-prompt-2-yes")],
          reason: "answer_mandatory",
        },
        {
          promptId: promptId("duel-1-prompt-5"),
          choiceIds: [choiceId("duel-1-prompt-5-no")],
          reason: "decline_optional",
        },
      ],
      resumeWith,
    );

    expect(
      policy.choose(opponentPrompt(promptId("duel-1-prompt-2")), VISIBLE_STATE),
    ).toEqual({
      choiceIds: [choiceId("duel-1-prompt-2-yes")],
      reason: "answer_mandatory",
    });
    expect(policy.pending).toBe(1);
    expect(
      policy.choose(opponentPrompt(promptId("duel-1-prompt-5")), VISIBLE_STATE),
    ).toEqual({
      choiceIds: [choiceId("duel-1-prompt-5-no")],
      reason: "decline_optional",
    });
    expect(policy.pending).toBe(0);
    expect(resumeWith.choose).toHaveBeenCalledTimes(0);
  });

  it("hands the seat back once the record runs out", () => {
    const resumeWith = spyPolicy();
    const policy = new ReplayOpponentPolicy([], resumeWith);

    expect(
      policy.choose(opponentPrompt(promptId("duel-1-prompt-2")), VISIBLE_STATE),
    ).toEqual({
      choiceIds: [choiceId("live-choice")],
      reason: "decline_optional",
    });
    expect(resumeWith.choose).toHaveBeenCalledTimes(1);
  });

  it("stops the replay when the rebuilt duel asks a different prompt", () => {
    const resumeWith = spyPolicy();
    const policy = new ReplayOpponentPolicy(
      [
        {
          promptId: promptId("duel-1-prompt-2"),
          choiceIds: [choiceId("duel-1-prompt-2-yes")],
          reason: "answer_mandatory",
        },
      ],
      resumeWith,
    );

    expect(() =>
      policy.choose(opponentPrompt(promptId("duel-1-prompt-3")), VISIBLE_STATE),
    ).toThrow(ReplayDivergenceError);
    expect(resumeWith.choose).toHaveBeenCalledTimes(0);
    expect(policy.pending).toBe(1);
  });
});
