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
import { sideboardBots } from "../../src/battle/worker/bot/bot-match.ts";
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
  it("gives each cross-deck hook its own original and validates both distinct multisets", () => {
    const other = {
      main: [cardCode(4), cardCode(5)],
      extra: [],
      side: [cardCode(6)],
    };
    const otherExchange: BotSideboardDecision = {
      reason,
      exchanges: [
        { from: "main", to: "side", cardCode: "4", copies: 1, reason },
        { from: "side", to: "main", cardCode: "6", copies: 1, reason },
      ],
    };
    const histories = [
      [
        { gameId: "a1", decisions: [] },
        { gameId: "a2", decisions: [] },
      ],
      [
        { gameId: "b1", decisions: [] },
        { gameId: "b2", decisions: [] },
      ],
    ] as const;
    const result = sideboardBots(
      [deck, other],
      [
        {
          decide: () => decision(0),
          sideboard(input) {
            expect(input.deck).toEqual(deck);
            expect(input.preSideGames).toEqual(histories[0]);
            (input.deck.main as unknown as number[]).splice(0);
            return exchange;
          },
        },
        {
          decide: () => decision(0),
          sideboard(input) {
            expect(input.deck).toEqual(other);
            expect(input.preSideGames).toEqual(histories[1]);
            return otherExchange;
          },
        },
      ],
      histories,
      () => {},
    );
    expect(result.decks[0]).toEqual({ main: [2, 3], extra: [], side: [1] });
    expect(result.decks[1]).toEqual({ main: [5, 6], extra: [], side: [4] });
    expect(deck.main).toEqual([1, 2]);
    expect(other.main).toEqual([4, 5]);
    expect(() =>
      validateSideboardPair([deck, other], [exchange, exchange], () => {}),
    ).toThrow("unavailable");
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

it("validates tribute contribution rather than requiring two physical cards", () => {
  const prompt: PlayerPrompt = {
    ...base,
    kind: "selectTribute",
    minimum: 1,
    maximum: 2,
    requiredTotal: 2,
    choices: base.choices.map((c, i) => ({
      ...c,
      card: {
        instanceId: `tribute-${i}` as never,
        controller: 0,
        location: "monster",
        sequence: i,
        contribution: i === 0 ? 2 : 1,
      },
    })),
  };
  expect(() => validateBotDecision(prompt, decision(0))).not.toThrow();
  expect(() => validateBotDecision(prompt, decision(1))).toThrow(
    "Tribute contribution",
  );
});

it.each([0, 1] as const)(
  "removes concealed opponent identities from actor %s legal prompts",
  async (actor) => {
    const { bindPromptInstances } =
      await import("../../src/battle/worker/bot/prompt-instances.ts");
    const { permittedState } =
      await import("../../src/battle/worker/bot/actor-observation.ts");
    const { RICH_PUBLIC_DUEL_STATE, publicStateCard } =
      await import("../fixtures/board-public-states.ts");
    const owner = actor === 0 ? 1 : 0;
    const state = structuredClone(RICH_PUBLIC_DUEL_STATE);
    const players = [...state.players];
    players[owner] = {
      ...players[owner]!,
      hand: [
        publicStateCard(
          "private-hand",
          123456,
          owner,
          "hand",
          0,
          "faceDownDefense",
        ),
      ],
    };
    const observation = permittedState(
      { ...state, players: players as unknown as typeof state.players },
      actor,
    );
    const prompt: PlayerPrompt = {
      ...base,
      player: actor,
      choices: [
        {
          ...base.choices[0]!,
          label: "Secret monster",
          card: {
            instanceId: "private-hand" as never,
            code: cardCode(123456),
            name: "Secret monster",
            description: "Secret text",
            controller: owner,
            location: "hand",
            sequence: 0,
          },
        },
      ],
    };
    const visible = bindPromptInstances(prompt, observation);
    expect(visible.choices[0]!.card!.code).toBeUndefined();
    expect(visible.choices[0]!.label).toBe("Concealed card");
    expect(JSON.stringify(visible)).not.toContain("Secret");
  },
);
