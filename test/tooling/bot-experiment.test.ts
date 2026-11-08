import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  nativeTransport,
  wasmTransport,
} from "../../scripts/bot-experiment/transport.ts";
import { createRandomBotModule } from "../../src/battle/worker/bot/random-bot.ts";
import { createGeneralistBotModule } from "../../src/battle/worker/bot/generalist-bot.ts";
import { createBasicBotModule } from "../../src/battle/worker/bot/basic-bot.ts";
import type { BotDecisionInput } from "../../src/battle/worker/bot/bot-contract.ts";
import type { ActiveDuelDependencies } from "../../src/battle/worker/assets/active-duel-dependencies.ts";
import {
  choiceId,
  promptId,
  cardInstanceId,
} from "../../src/battle/duel/contracts/ids.ts";
const dependencies: ActiveDuelDependencies = {
  cards: new Map(),
  texts: new Map(),
  scripts: new Map(),
  strings: { system: {}, victory: {}, counter: {}, setname: {} },
  images: new Map(),
  counts: { cards: 0, texts: 0, scripts: 0, globals: 0, images: 0 },
};
const observation: BotDecisionInput["observation"] = {
  revision: 0,
  turn: 1,
  turnPlayer: 0,
  phase: "main1",
  players: [0, 1].map((player) => ({
    player,
    lifePoints: 8000,
    deckCount: 40,
    extraDeckCount: 0,
    handCount: 0,
    monsterCount: 0,
    spellTrapCount: 0,
    graveyardCount: 0,
    banishedCount: 0,
  })) as unknown as BotDecisionInput["observation"]["players"],
  chainSize: 0,
};
function input(
  kind: BotDecisionInput["prompt"]["kind"],
  extra: Partial<BotDecisionInput["prompt"]> = {},
): BotDecisionInput {
  return {
    observation,
    prompt: {
      id: promptId("test"),
      kind,
      player: 0,
      title: "Test",
      minimum: 1,
      maximum: 1,
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
          alternativeContribution: i + 2,
        },
        allocationMaximum: 2,
      })),
      ...extra,
    },
  };
}
test("Rust targets preserve selection ordering, loop state, and Random draws", async () => {
  const build = spawnSync(
    "cargo",
    [
      "build",
      "--locked",
      "--release",
      "--manifest-path",
      "docs/archive/rust-bot-experiment/reference/ai/Cargo.toml",
    ],
    { encoding: "utf8" },
  );
  assert.equal(build.status, 0, build.stderr);
  const workloads = [
    // Generalist scores the enemy's zero ATK as -0 and our zero ATK as +0.
    // Both targets must preserve the first offered choice like TypeScript.
    input("selectCard", {
      choices: [1, 0].map((controller, i) => ({
        id: choiceId(`zero-${i}`),
        action: "select" as const,
        label: `Zero ATK ${i}`,
        card: {
          instanceId: cardInstanceId(`zero-${i}`),
          controller: controller as 0 | 1,
          location: "monster" as const,
          sequence: i,
        },
      })),
    }),
    input("selectCard", { minimum: 0, maximum: 3, cancelable: true }),
    input("selectCounter", { minimum: 4, maximum: 4 }),
    input("sortCard", { minimum: 3, maximum: 3, ordered: true }),
    input("selectSum", {
      minimum: 1,
      maximum: 3,
      requiredTotal: 5,
      sumMode: "exact",
      mandatoryContributions: [{ contribution: 1, alternativeContribution: 2 }],
    }),
    input("selectSum", {
      minimum: 1,
      maximum: 3,
      requiredTotal: 5,
      sumMode: "atLeast",
    }),
    input("selectTribute", { minimum: 1, maximum: 3, requiredTotal: 3 }),
    input("selectUnselectCard", { minimum: 0, maximum: 3 }),
    input("idleCommand", {
      choices: ["activate", "changePosition", "endPhase"].map((action, i) => ({
        id: choiceId(String(i)),
        action: action as "activate" | "changePosition" | "endPhase",
        label: action,
      })),
    }),
  ];
  workloads.push(...Array.from({ length: 5 }, () => workloads.at(-1)!));
  for (const target of [nativeTransport, wasmTransport]) {
    let transport = await target();
    try {
      await assert.rejects(
        transport.request({ op: "decide", input: workloads[0] }),
        /Uninitialized/,
      );
      transport.close();
      transport = await target();
      await assert.rejects(
        transport.request({
          op: "create",
          contractVersion: 2,
          policy: "basic",
        }),
        /version/,
      );
      transport.close();
      transport = await target();
      await assert.rejects(
        transport.request({
          op: "create",
          contractVersion: 1,
          policy: "basic",
          configuration: { unknown: true },
        }),
        /Configuration/,
      );
      transport.close();
      transport = await target();
      for (const policy of ["basic", "generalist", "random"]) {
        let seed = 12345;
        let draws: number[] = [];
        const random = () => {
          seed ^= seed << 13;
          seed ^= seed >>> 17;
          seed ^= seed << 5;
          seed >>>= 0;
          draws.push(seed);
          return seed / 2 ** 32;
        };
        const bot = (
          policy === "basic"
            ? createBasicBotModule(dependencies)
            : policy === "generalist"
              ? createGeneralistBotModule(dependencies)
              : createRandomBotModule(random)
        ).create({});
        await transport.request({
          op: "create",
          contractVersion: 1,
          policy,
          configuration: {},
          seed: 12345,
          cards: [],
        });
        for (let repetition = 0; repetition < 10; repetition++)
          for (const input of workloads) {
            draws = [];
            const expected = bot.decide(input);
            const actual = await transport.request({ op: "decide", input });
            assert.deepEqual(
              actual.choiceIds,
              expected.choiceIds,
              `${policy} ${input.prompt.kind}`,
            );
            assert.deepEqual(
              actual.randomDraws,
              draws,
              `${policy} random consumption`,
            );
          }
        const sideboard = await transport.request({
          op: "sideboard",
          input: { deck: { main: [], extra: [], side: [] }, preSideGames: [] },
        });
        assert.deepEqual(sideboard.exchanges, []);
      }
    } finally {
      transport.close();
    }
  }
});
