import { describe, expect, it } from "vitest";
import type { ActiveDuelDependencies } from "../../src/battle/worker/assets/active-duel-dependencies.ts";
import type { BotDecisionInput } from "../../src/battle/worker/bot/bot-contract.ts";
import { createRandomBotModule } from "../../src/battle/worker/bot/random-bot.ts";
import { createGeneralistBotModule } from "../../src/battle/worker/bot/generalist-bot.ts";
import { validateBotDecision } from "../../src/battle/worker/bot/validate-bot-decision.ts";
import { buildEnginePrompt } from "../../src/battle/worker/protocol/PromptRegistry.ts";
import {
  EngineLocation,
  EnginePosition,
  EngineMessageType,
} from "../../src/battle/worker/engine/engine-constants.ts";
import type { EngineMessage } from "../../src/battle/worker/engine/OcgCoreAdapter.ts";

const dependencies: ActiveDuelDependencies = {
  cards: new Map(),
  texts: new Map(),
  scripts: new Map(),
  images: new Map(),
  strings: { system: {}, victory: {}, counter: {}, setname: {} },
  counts: { cards: 0, texts: 0, scripts: 0, globals: 0, images: 0 },
};
const observation = {
  turn: 1,
  phase: "main1",
} as BotDecisionInput["observation"];
const card = (sequence: number) => ({
  code: 100 + sequence,
  controller: 0 as const,
  location: EngineLocation.HAND,
  position: EnginePosition.FACE_UP_ATTACK,
  release_param: 1,
  sequence,
});
const reason = { code: "test", explanation: "Test response." };
function exercise(message: EngineMessage) {
  const binding = buildEnginePrompt(message, 1, dependencies)!;
  let seed = 42;
  const random = createRandomBotModule(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  }).create({});
  const outcomes = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const decision = random.decide({ prompt: binding.prompt, observation });
    expect(() => binding.resolve(decision.choiceIds)).not.toThrow();
    outcomes.add(decision.choiceIds.join(","));
  }
  const generalist = createGeneralistBotModule(dependencies).create({});
  expect(() =>
    binding.resolve(
      generalist.decide({ prompt: binding.prompt, observation }).choiceIds,
    ),
  ).not.toThrow();
  return { binding, outcomes };
}
describe("bot cancellation matches the engine encoder", () => {
  it("passes optional chains using the explicit pass choice", () => {
    const { binding, outcomes } = exercise({
      type: EngineMessageType.SELECT_CHAIN,
      player: 0,
      spe_count: 0,
      forced: false,
      hint_timing: 1,
      hint_timing_other: 1,
      selects: [],
    });
    expect(outcomes).toEqual(new Set([binding.prompt.choices[0]!.id]));
    expect(() =>
      validateBotDecision(binding.prompt, { choiceIds: [], reason }),
    ).toThrow();
  });
  it("responds with one toggle/finish/cancel even when cumulative bounds exceed one", () => {
    for (const min of [0, 2]) {
      const { binding, outcomes } = exercise({
        type: EngineMessageType.SELECT_UNSELECT_CARD,
        player: 0,
        can_finish: true,
        can_cancel: true,
        min,
        max: 3,
        select_cards: [card(0), card(1)],
        unselect_cards: [],
      });
      expect(outcomes.size).toBe(4);
      expect(() =>
        validateBotDecision(binding.prompt, { choiceIds: [], reason }),
      ).toThrow();
      expect(() =>
        validateBotDecision(binding.prompt, {
          choiceIds: binding.prompt.choices.slice(0, 2).map((c) => c.id),
          reason,
        }),
      ).toThrow();
    }
  });
  it("randomizes both declining a sort and all complete permutations", () => {
    for (const type of [
      EngineMessageType.SORT_CARD,
      EngineMessageType.SORT_CHAIN,
    ] as const) {
      const { outcomes } = exercise({
        type,
        player: 0,
        cards: [card(0), card(1)],
      });
      expect(outcomes.size).toBe(3);
      expect(outcomes.has("")).toBe(true);
    }
  });
  it("keeps empty cancellation available for card and tribute selections", () => {
    for (const type of [
      EngineMessageType.SELECT_CARD,
      EngineMessageType.SELECT_TRIBUTE,
    ] as const) {
      const { outcomes } = exercise({
        type,
        player: 0,
        min: 1,
        max: 1,
        can_cancel: true,
        selects: [card(0)],
      });
      expect(outcomes.size).toBe(2);
      expect(outcomes.has("")).toBe(true);
    }
  });
});
