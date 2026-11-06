import { describe, expect, it } from "vitest";
import {
  choiceId,
  promptId,
  cardInstanceId,
  cardCode,
} from "../../src/battle/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptKind,
} from "../../src/battle/duel/contracts/player-prompt.ts";
import type { BotDecisionInput } from "../../src/battle/worker/bot/bot-contract.ts";
import { createGeneralistBotModule } from "../../src/battle/worker/bot/generalist-bot.ts";
import { createRandomBotModule } from "../../src/battle/worker/bot/random-bot.ts";
import { botAsOpponentPolicy } from "../../src/battle/worker/bot/basic-bot.ts";
import { validateBotDecision } from "../../src/battle/worker/bot/validate-bot-decision.ts";

const observation: BotDecisionInput["observation"] = {
  revision: 0,
  turn: 1,
  turnPlayer: 0,
  phase: "main1",
  players: [0, 1].map((player) => ({
    player,
    lifePoints: 8000,
    deckCount: 35,
    extraDeckCount: 0,
    handCount: 5,
    monsterCount: 0,
    spellTrapCount: 0,
    graveyardCount: 0,
    banishedCount: 0,
  })) as never,
  chainSize: 0,
};
const base: PlayerPrompt = {
  id: promptId("test"),
  kind: "selectCard",
  player: 0,
  title: "Select",
  minimum: 1,
  maximum: 2,
  cancelable: false,
  ordered: false,
  choices: [0, 1, 2].map((i) => ({
    id: choiceId(String(i)),
    action: "select",
    label: String(i),
    card: {
      instanceId: cardInstanceId(String(i)),
      controller: 0,
      location: "hand",
      sequence: i,
      contribution: i + 1,
    },
  })),
};
// Diagnostic-only deterministic stream, never used by a production bot.
function rng() {
  let state = 12345;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
function responses(prompt: PlayerPrompt, runs = 300) {
  const bot = createRandomBotModule(rng()).create({});
  const results = new Set<string>();
  for (let i = 0; i < runs; i++) {
    const decision = bot.decide({ prompt, observation });
    validateBotDecision(prompt, decision);
    results.add([...decision.choiceIds].join(","));
  }
  return results;
}
describe("generalist and random shared response machinery", () => {
  it("randomizes all single choices without favoring summon, pass, or finish", () => {
    for (const kind of [
      "idleCommand",
      "battleCommand",
      "chain",
      "yesNo",
      "effectYesNo",
      "selectUnselectCard",
      "option",
      "selectPosition",
      "announceNumber",
      "announceCard",
      "rockPaperScissors",
    ] as PromptKind[]) {
      expect(responses({ ...base, kind, maximum: 1 })).toEqual(
        new Set(["0", "1", "2"]),
      );
    }
  });
  it("randomizes subset counts, cancellations and full permutations", () => {
    for (const kind of [
      "selectCard",
      "selectPlace",
      "selectDisabledField",
      "announceAttribute",
      "announceRace",
    ] as PromptKind[]) {
      const cancelable = kind === "selectCard";
      const results = responses({ ...base, kind, cancelable });
      expect(results.has("")).toBe(cancelable);
      expect(results.has("0")).toBe(true);
      expect(results.has("1,2")).toBe(true);
    }
    for (const kind of ["sortCard", "sortChain"] as const)
      expect(
        responses({ ...base, kind, minimum: 3, maximum: 3, ordered: true })
          .size,
      ).toBe(6);
  });
  it("randomizes counter allocations within capacities", () => {
    const prompt: PlayerPrompt = {
      ...base,
      kind: "selectCounter",
      minimum: 2,
      maximum: 2,
      choices: base.choices
        .slice(0, 2)
        .map((c) => ({ ...c, allocationMaximum: 2 })),
    };
    const results = responses(prompt);
    expect(results.has("0,0")).toBe(true);
    expect(results.has("1,1")).toBe(true);
    expect(results.has("0,1")).toBe(true);
  });
  it("randomizes feasible tribute counts including double contributions and overpayment", () => {
    const results = responses({
      ...base,
      kind: "selectTribute",
      requiredTotal: 3,
    });
    expect(results.has("2")).toBe(true);
    expect(results.has("0,1")).toBe(true);
    expect(results.has("1,2")).toBe(true);
  });
  it("honors mandatory and alternative sum contributions in both modes", () => {
    for (const sumMode of ["exact", "atLeast"] as const) {
      const prompt: PlayerPrompt = {
        ...base,
        kind: "selectSum",
        requiredTotal: 5,
        sumMode,
        mandatoryContributions: [{ contribution: 2 }],
        choices: base.choices.map((c) => ({
          ...c,
          card: { ...c.card!, alternativeContribution: 3 },
        })),
      };
      const results = responses(prompt);
      expect(results.has("0")).toBe(true);
      expect(results.has("1")).toBe(true);
      expect(results.has("2")).toBe(true);
      const generalist = createGeneralistBotModule({ cards: new Map() }).create(
        {},
      );
      expect(() =>
        validateBotDecision(prompt, generalist.decide({ prompt, observation })),
      ).not.toThrow();
    }
  });
  it("generalist develops board, escapes repeated actions, and has fresh game state", () => {
    const module = createGeneralistBotModule({ cards: new Map() });
    const bot = module.create({});
    const prompt: PlayerPrompt = {
      ...base,
      kind: "idleCommand",
      maximum: 1,
      choices: [
        { id: choiceId("summon"), label: "Summon", action: "summon" },
        { id: choiceId("end"), label: "End", action: "endPhase" },
      ],
    };
    expect(bot.decide({ prompt, observation }).choiceIds).toEqual(["summon"]);
    expect(bot.decide({ prompt, observation }).choiceIds).toEqual(["summon"]);
    expect(bot.decide({ prompt, observation }).choiceIds).toEqual(["end"]);
    expect(module.create({}).decide({ prompt, observation }).choiceIds).toEqual(
      ["summon"],
    );
  });
  it("strategy extensions use the runtime adapter and cannot bypass legal totals", () => {
    const bot = createGeneralistBotModule(
      { cards: new Map() },
      (_input, choice) => ({
        score: choice.card?.sequence ?? 0,
        code: "custom_rank",
        explanation: "Prefer later choices.",
      }),
    ).create({});
    const policy = botAsOpponentPolicy(bot);
    const prompt: PlayerPrompt = {
      ...base,
      kind: "selectSum",
      requiredTotal: 3,
      maximum: 1,
    };
    expect(policy.choose(prompt, observation).choiceIds).toEqual(["2"]);
  });
  it("never consults concealed opponent identity for combat estimates", () => {
    const seen: number[] = [];
    const cards = new Map();
    cards.get = (code: number) => {
      seen.push(code);
      return undefined;
    };
    const bot = createGeneralistBotModule({ cards }).create({});
    const prompt: PlayerPrompt = {
      ...base,
      kind: "battleCommand",
      maximum: 1,
      choices: [{ id: choiceId("attack"), action: "attack", label: "Attack" }],
    };
    const publicState = {
      players: [
        { monsters: [] },
        { monsters: [{ faceUp: false, code: cardCode(999) }] },
      ],
    } as never;
    bot.decide({ prompt, observation: { ...observation, publicState } });
    expect(seen).not.toContain(999);
  });
});
