import { describe, expect, it } from "vitest";
import {
  cardCode,
  choiceId,
  promptId,
} from "../../src/battle/duel/contracts/ids.ts";
import type { PlayerPrompt } from "../../src/battle/duel/contracts/player-prompt.ts";
import type {
  BotDecision,
  BotSideboardDecision,
} from "../../src/battle/worker/bot/bot-contract.ts";
import { validateBotDecision } from "../../src/battle/worker/bot/validate-bot-decision.ts";
import {
  validateSideboard,
  validateSideboardPair,
} from "../../src/battle/worker/bot/sideboard.ts";

const reason = {
  code: "test_selection",
  explanation: "Select a legal test response.",
};
const ids = [choiceId("one"), choiceId("two")];
const base: PlayerPrompt = {
  id: promptId("prompt"),
  player: 0,
  kind: "selectCard",
  title: "Select",
  choices: ids.map((id) => ({ id, label: id, action: "select" })),
  minimum: 1,
  maximum: 2,
  ordered: false,
  cancelable: false,
};
const decision = (...indexes: number[]): BotDecision => ({
  choiceIds: indexes.map((i) => ids[i]!),
  reason,
});

describe("shared bot response contract", () => {
  it("requires reasons, membership, multiplicity and selection bounds", () => {
    expect(() => validateBotDecision(base, decision(0))).not.toThrow();
    expect(() => validateBotDecision(base, decision())).toThrow(
      "minimum/maximum",
    );
    expect(() => validateBotDecision(base, decision(0, 0))).toThrow(
      "Duplicate",
    );
    expect(() =>
      validateBotDecision(base, { choiceIds: [choiceId("unknown")], reason }),
    ).toThrow("Unknown");
    expect(() =>
      validateBotDecision(base, {
        ...decision(0),
        reason: { code: "", explanation: "" },
      }),
    ).toThrow("reason");
  });
  it("requires a complete ordering and permits any valid permutation", () => {
    const prompt = { ...base, kind: "sortCard", ordered: true } as const;
    expect(() => validateBotDecision(prompt, decision(0))).toThrow(
      "permutation",
    );
    expect(() => validateBotDecision(prompt, decision(1, 0))).not.toThrow();
  });
  it("validates allocations instead of rejecting every repeated identifier", () => {
    const prompt: PlayerPrompt = {
      ...base,
      kind: "selectCounter",
      minimum: 2,
      maximum: 2,
      choices: base.choices.map((choice, i) => ({
        ...choice,
        allocationMaximum: i + 1,
      })),
    };
    expect(() => validateBotDecision(prompt, decision(1, 1))).not.toThrow();
    expect(() => validateBotDecision(prompt, decision(0, 0))).toThrow(
      "capacity",
    );
  });
  it("accounts for mandatory and alternative sum contributions", () => {
    const prompt: PlayerPrompt = {
      ...base,
      kind: "selectSum",
      requiredTotal: 5,
      mandatoryContributions: [{ contribution: 2 }],
      choices: base.choices.map((choice, i) => ({
        ...choice,
        card: {
          instanceId: `card-${i}` as never,
          controller: 0,
          location: "hand",
          sequence: i,
          contribution: 1,
          alternativeContribution: i === 0 ? 3 : 2,
        },
      })),
    };
    expect(() => validateBotDecision(prompt, decision(0))).not.toThrow();
    expect(() => validateBotDecision(prompt, decision(1))).toThrow(
      "contribution",
    );
  });
});

const deck = {
  main: [cardCode(1), cardCode(2)],
  extra: [],
  side: [cardCode(3)],
};
const exchange: BotSideboardDecision = {
  reason,
  exchanges: [
    { from: "main", to: "side", cardCode: "1", copies: 1, reason },
    { from: "side", to: "main", cardCode: "3", copies: 1, reason },
  ],
};
describe("sideboard transactions", () => {
  it("preserves sizes, multiset and original input, and invokes selected rules", () => {
    let validated = false;
    const result = validateSideboard(deck, exchange, (candidate) => {
      validated = true;
      expect(candidate.main).toEqual([2, 3]);
    });
    expect(validated).toBe(true);
    expect(result.side).toEqual([1]);
    expect(deck.main).toEqual([1, 2]);
    expect(Object.isFrozen(result.main)).toBe(true);
  });
  it("rejects introduced cards, size changes and rules violations", () => {
    expect(() =>
      validateSideboard(
        deck,
        { reason, exchanges: [exchange.exchanges[0]!] },
        () => {},
      ),
    ).toThrow("sizes");
    expect(() =>
      validateSideboard(
        deck,
        { reason, exchanges: [{ ...exchange.exchanges[0]!, cardCode: "99" }] },
        () => {},
      ),
    ).toThrow("unavailable");
    expect(() =>
      validateSideboard(deck, exchange, () => {
        throw new Error("banlist");
      }),
    ).toThrow("banlist");
  });
  it("validates both independent submissions before returning either", () => {
    const invalid = { reason, exchanges: [exchange.exchanges[0]!] };
    expect(() =>
      validateSideboardPair(deck, [exchange, invalid], () => {}),
    ).toThrow();
    expect(deck.main).toEqual([1, 2]);
  });
  it("does not allow incoming cards to fund further outgoing exchanges", () => {
    const recycled: BotSideboardDecision = {
      reason,
      exchanges: [
        exchange.exchanges[0]!,
        { ...exchange.exchanges[1]!, cardCode: "1" },
      ],
    };
    expect(() => validateSideboard(deck, recycled, () => {})).toThrow(
      "unavailable",
    );
  });
});

import {
  createBasicBotModule,
  botAsOpponentPolicy,
} from "../../src/battle/worker/bot/basic-bot.ts";
import type { ActiveDuelDependencies } from "../../src/battle/worker/assets/active-duel-dependencies.ts";
import type { OpponentVisibleDuelState } from "../../src/battle/worker/opponent/OpponentPolicy.ts";
const dependencies: ActiveDuelDependencies = {
  cards: new Map(),
  texts: new Map(),
  scripts: new Map(),
  images: new Map(),
  strings: { system: {}, victory: {}, counter: {}, setname: {} },
  counts: { cards: 0, texts: 0, scripts: 0, globals: 0, images: 0 },
};
const observation: OpponentVisibleDuelState = {
  revision: 1,
  turn: 1,
  turnPlayer: 0,
  phase: "main1",
  chainSize: 0,
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
  })) as unknown as OpponentVisibleDuelState["players"],
};
describe("runtime policy integration", () => {
  it("returns equivalent decisions and explanations for direct and runtime calls", () => {
    const module = createBasicBotModule(dependencies);
    const direct = module.create({});
    const runtime = botAsOpponentPolicy(module.create({}));
    for (let i = 0; i < 5; i++) {
      const expected = direct.decide({ prompt: base, observation });
      expect(runtime.choose(base, observation)).toEqual({
        choiceIds: expected.choiceIds,
        reason: expected.reason.code,
        explanation: expected.reason.explanation,
      });
    }
  });
  it("creates independent sideboard configurations and rejects unsupported config", () => {
    const module = createBasicBotModule(dependencies);
    expect(() => module.create({ typo: true })).toThrow("configuration");
    const response = module.create({}).sideboard({
      deck,
      preSideGames: [
        { gameId: "g1", decisions: [] },
        { gameId: "g2", decisions: [] },
      ],
    });
    expect(validateSideboard(deck, response, () => {})).toEqual(deck);
  });
  it("isolates mutable policy inputs from the controller", () => {
    const original = structuredClone(base);
    const runtime = botAsOpponentPolicy({
      decide(input) {
        (input.prompt.choices as unknown[]).splice(0);
        return decision(0);
      },
      sideboard() {
        return { reason, exchanges: [] };
      },
    });
    expect(runtime.choose(original, observation).choiceIds).toEqual([ids[0]]);
    expect(original).toEqual(base);
  });
});
