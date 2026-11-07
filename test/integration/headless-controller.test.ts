import type {
  BotInstance,
  BotSideboardInput,
} from "../../src/battle/worker/bot/bot-contract.ts";
import { PACKAGE_ASSET_SOURCES as ASSET_SOURCES } from "../../scripts/lib/asset-roots.ts";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { snapshotId } from "../../src/battle/duel/contracts/ids.ts";
import { uniqueDeckCodes } from "../../src/battle/duel/presets/deck-parser.ts";
import type { MvpPreset } from "../../src/battle/duel/presets/mvp-preset.ts";
import { loadMvpPreset } from "../../src/battle/duel/presets/mvp-preset-node.ts";
import type { ActiveDuelDependencies } from "../../src/battle/worker/assets/active-duel-dependencies.ts";
import { loadActiveDuelDependenciesNode } from "../../src/battle/worker/assets/active-duel-dependencies-node.ts";
import { DuelSession } from "../../src/battle/worker/engine/DuelSession.ts";
import type { OcgCoreAdapter } from "../../src/battle/worker/engine/OcgCoreAdapter.ts";
import { loadVendoredCoreNode } from "../../src/battle/worker/engine/load-vendored-core-node.ts";
import { HeadlessDuelController } from "../../src/battle/worker/HeadlessDuelController.ts";

import { createBasicBotPolicy } from "../../src/battle/worker/bot/basic-bot.ts";
import { toOpponentVisibleState } from "../../src/battle/worker/opponent/OpponentPolicy.ts";

let adapter: OcgCoreAdapter;
let dependencies: ActiveDuelDependencies;
let preset: MvpPreset;

beforeAll(async () => {
  adapter = await loadVendoredCoreNode();
  preset = await loadMvpPreset();
  dependencies = await loadActiveDuelDependenciesNode(
    path.resolve(ASSET_SOURCES.data.source),
    uniqueDeckCodes(preset.player, preset.opponent),
    undefined,
    ASSET_SOURCES.strings.source,
  );
});

describe("HeadlessDuelController", () => {
  it("uses the shared basic bot for both seats in a real-core mirror game", () => {
    const session = DuelSession.create({
      adapter,
      dependencies,
      playerDeck: preset.player,
      opponentDeck: preset.player,
      configuration: { mode: "production", rules: "mr5" },
    });
    const bot = createBasicBotPolicy(dependencies);
    let opponentDecisions = 0;
    const opponent = createBasicBotPolicy(dependencies);
    const controller = new HeadlessDuelController({
      session,
      dependencies,
      snapshotId: snapshotId("a".repeat(64)),
      presetId: preset.id,
      deckCounts: [preset.player.main.length, preset.player.main.length],
      extraDeckCounts: [preset.player.extra.length, preset.player.extra.length],
      extraMonsterZones: true,
      opponentPolicy: {
        choose(prompt, observation) {
          opponentDecisions++;
          const decision = opponent.choose(prompt, observation);
          expect(decision.explanation).toBeTruthy();
          return decision;
        },
      },
    });
    try {
      let boundary = controller.advance();
      for (let i = 0; i < 2000 && boundary.result === undefined; i++) {
        if (boundary.prompt === undefined)
          throw new Error("No decision boundary");
        const decision = bot.choose(
          boundary.prompt,
          toOpponentVisibleState(boundary.state, 0),
        );
        expect(decision.explanation).toBeTruthy();
        boundary = controller.respond(boundary.prompt.id, decision.choiceIds);
      }
      expect(boundary.result).toBeDefined();
      expect(opponentDecisions).toBeGreaterThan(0);
      expect(session.disposed).toBe(true);
    } finally {
      controller.dispose();
    }
  });
  it("projects real messages and accepts one opaque human choice", () => {
    const session = DuelSession.create({
      adapter,
      dependencies,
      playerDeck: preset.player,
      opponentDeck: preset.opponent,
      configuration: {
        mode: "programmed",
        rules: "mr5",
        seed: [1n, 2n, 3n, 4n],
        playerDeckOrder: preset.player.main,
        opponentDeckOrder: preset.opponent.main,
      },
    });
    const controller = new HeadlessDuelController({
      session,
      dependencies,
      snapshotId: snapshotId("a".repeat(64)),
      presetId: preset.id,
      deckCounts: [preset.player.main.length, preset.opponent.main.length],
      extraDeckCounts: [
        preset.player.extra.length,
        preset.opponent.extra.length,
      ],
      extraMonsterZones: true,
    });

    try {
      const first = controller.advance();
      expect(first.prompt?.kind).toBe("idleCommand");
      expect(first.state.players[0].hand).toHaveLength(5);
      expect(first.state.players[1].hand).toEqual([]);
      const summon = first.prompt?.choices.find(
        (choice) => choice.action === "summon",
      );
      if (first.prompt === undefined || summon === undefined)
        throw new Error("Summon choice is missing");
      const place = controller.respond(first.prompt.id, [summon.id]);
      expect(place.prompt?.kind).toBe("selectPlace");
      const zone = place.prompt?.choices[0];
      if (place.prompt === undefined || zone === undefined)
        throw new Error("Zone choice is missing");
      let second = controller.respond(place.prompt.id, [zone.id]);
      while (second.prompt?.kind === "chain") {
        const pass = second.prompt.choices.find(
          (choice) => choice.action === "pass",
        );
        if (pass === undefined) throw new Error("Pass choice is missing");
        second = controller.respond(second.prompt.id, [pass.id]);
      }
      expect(second.prompt?.kind).toBe("idleCommand");
      expect(second.state.players[0].monsters).toHaveLength(1);
      expect(
        controller.trace().entries.some((entry) => entry.kind === "response"),
      ).toBe(true);
    } finally {
      controller.dispose();
    }
  });

  it("returns a structured surrender result and destroys the session", () => {
    const session = DuelSession.create({
      adapter,
      dependencies,
      playerDeck: preset.player,
      opponentDeck: preset.opponent,
      configuration: { mode: "production", rules: "mr5" },
    });
    const controller = new HeadlessDuelController({
      session,
      dependencies,
      snapshotId: snapshotId("a".repeat(64)),
      presetId: preset.id,
      deckCounts: [40, 40],
      extraDeckCounts: [0, 0],
      extraMonsterZones: true,
    });
    expect(controller.surrender().result).toEqual({
      type: "surrendered",
      winner: 1,
      loser: 0,
    });
    expect(session.disposed).toBe(true);
  });
});

it("actual worker runtime and evaluation share independent sideboard transactions", async () => {
  const { DuelWorkerRuntime } =
    await import("../../src/battle/worker/DuelWorkerRuntime.ts");
  const { sideboardBots } =
    await import("../../src/battle/worker/bot/bot-match.ts");
  const { TEST_CONTENT_REF } =
    await import("../fixtures/installed-gameplay.ts");
  const runtime = new DuelWorkerRuntime(async () => ({
    adapter,
    dependencies,
    snapshotId: snapshotId("a".repeat(64)),
    createPreset: (playerDeckId, opponentDeckId) => ({
      ...preset,
      playerDeckId,
      opponentDeckId,
    }),
  }));
  await runtime.handle({ type: "initialize", runtime: TEST_CONTENT_REF });
  const counts = new Map<number, number>();
  for (const c of preset.player.main) counts.set(c, (counts.get(c) ?? 0) + 1);
  const replacement = preset.opponent.main.find(
    (c) =>
      dependencies.cards.has(c) &&
      (counts.get(c) ?? 0) < 3 &&
      c !== preset.player.main[0],
  )!;
  expect(replacement).toBeDefined();
  const deck = {
    main: [...preset.player.main],
    extra: [...preset.player.extra],
    side: [replacement],
  };
  const reason = {
    code: "observed_test",
    explanation: "Use the independently observed match history.",
  };
  const histories = [
    [
      { gameId: "a-1", decisions: [] },
      { gameId: "a-2", decisions: [] },
    ],
    [
      { gameId: "b-1", decisions: [] },
      { gameId: "b-2", decisions: [] },
    ],
  ] as const;
  const create = () =>
    [0, 1].map((i) => ({
      decide: () => ({ choiceIds: [], reason }),
      sideboard: (input: BotSideboardInput) => {
        expect(input.preSideGames[0].gameId).toBe(i === 0 ? "a-1" : "b-1");
        return {
          reason,
          exchanges: [
            {
              from: "main" as const,
              to: "side" as const,
              cardCode: String(deck.main[0]),
              copies: 1,
              reason,
            },
            {
              from: "side" as const,
              to: "main" as const,
              cardCode: String(replacement),
              copies: 1,
              reason,
            },
          ],
        };
      },
    })) as unknown as readonly [BotInstance, BotInstance];
  try {
    const expected = sideboardBots(deck, create(), histories, () => {});
    const actual = runtime.sideboardBots(deck, create(), histories);
    expect(actual.decks).toEqual(expected.decks);
    expect(actual.decisions).toEqual(expected.decisions);
    expect(actual.decks[0]).not.toBe(actual.decks[1]);
    expect(deck.side).toEqual([replacement]);
  } finally {
    runtime.dispose();
  }
});

it("actual Worker uses one configured module for play and sideboard with fresh instances", async () => {
  const { DuelWorkerRuntime } =
    await import("../../src/battle/worker/DuelWorkerRuntime.ts");
  const { createBasicBotModule } =
    await import("../../src/battle/worker/bot/basic-bot.ts");
  const { TEST_CONTENT_REF } =
    await import("../fixtures/installed-gameplay.ts");
  let instances = 0,
    playCalls = 0,
    sideCalls = 0;
  const runtime = new DuelWorkerRuntime(
    async () => ({
      adapter,
      dependencies,
      snapshotId: snapshotId("a".repeat(64)),
      createPreset: (playerDeckId, opponentDeckId) => ({
        ...preset,
        playerDeckId,
        opponentDeckId,
      }),
    }),
    {
      bot: {
        configuration: { purpose: "contract-test" },
        module: {
          contractVersion: 1,
          create(config) {
            expect(config).toEqual({ purpose: "contract-test" });
            instances++;
            let localCalls = 0;
            const bot = createBasicBotModule(dependencies).create({});
            return {
              decide(input) {
                localCalls++;
                playCalls++;
                expect(input.observation.publicState?.players[0].hand).toEqual(
                  [],
                );
                return bot.decide(input);
              },
              sideboard(input) {
                expect(localCalls).toBe(0);
                sideCalls++;
                return bot.sideboard(input);
              },
            };
          },
        },
      },
    },
  );
  try {
    await runtime.handle({ type: "initialize", runtime: TEST_CONTENT_REF });
    for (let game = 0; game < 2; game++) {
      const human = createBasicBotPolicy(dependencies);
      let events = await runtime.handle({
        type: "startDuel",
        duelId: `shared-bot-${game}` as never,
        player: { kind: "cards", ...preset.player },
        opponent: { kind: "cards", ...preset.player },
      });
      for (
        let n = 0;
        n < 2000 && !events.some((e) => e.type === "result");
        n++
      ) {
        const state = events.find((e) => e.type === "state");
        const prompt = events.find((e) => e.type === "prompt");
        if (state?.type !== "state" || prompt?.type !== "prompt")
          throw new Error(JSON.stringify(events));
        const choice = human.choose(
          prompt.prompt,
          toOpponentVisibleState(state.state, 0),
        );
        events = await runtime.handle({
          type: "respond",
          promptId: prompt.prompt.id,
          choiceIds: choice.choiceIds,
        });
      }
      expect(events.some((e) => e.type === "result")).toBe(true);
    }
    const histories = [
      { gameId: "one", decisions: [] },
      { gameId: "two", decisions: [] },
    ] as const;
    runtime.sideboardConfiguredBots(preset.player, [histories, histories]);
    expect(instances).toBe(4);
    expect(playCalls).toBeGreaterThan(0);
    expect(sideCalls).toBe(2);
  } finally {
    runtime.dispose();
  }
});
