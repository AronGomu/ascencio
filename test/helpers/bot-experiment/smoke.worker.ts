import type { EvidenceRecord } from "../../../scripts/bot-experiment/evidence.ts";
import { fixtureFetch } from "./fixture-fetch.ts";
import { failures } from "./failures.ts";
import { benchmark } from "./benchmark.ts";
import { playLiveGame } from "../../../scripts/bot-experiment/live-game.ts";
import { OcgCoreAdapter } from "../../../src/battle/worker/engine/OcgCoreAdapter.ts";
import { loadBot } from "../../../src/battle/worker/bot-runtime/loaded-bot.ts";
import { receiveBotHostResult } from "../../../src/battle/worker/bot-runtime/host-rpc.ts";
import { validateSideboardPair } from "../../../src/battle/worker/bot/sideboard.ts";
import type { ActiveDuelDependencies } from "../../../src/battle/worker/assets/active-duel-dependencies.ts";
import type { BotGameObservation } from "../../../src/battle/worker/bot/bot-contract.ts";
import type { ParsedDeck } from "../../../src/battle/duel/presets/deck-parser.ts";
import type { BotSelection } from "../../../src/battle/duel/contracts/bot-selection.ts";
type Game = {
  policy: "basic" | "generalist";
  match: number;
  game: number;
  request: {
    game_id: string;
    seed: string[];
    decks: [ParsedDeck, ParsedDeck];
    bot_order: [0 | 1, 0 | 1];
  };
};
self.onmessage = (event: MessageEvent) => {
  if (receiveBotHostResult(event.data)) return;
  void run(event.data.runtime, event.data.mode).catch((error) =>
    self.postMessage({
      type: "failed",
      message: String(error),
      stack: error.stack,
    }),
  );
};
async function run(runtime: BotSelection["runtime"], mode: string) {
  if (mode === "failures") {
    await failures();
    return;
  }
  const [wire, workload, wasm] = await Promise.all([
    fixtureFetch("/fixture/dependencies").then((r) => r.json()),
    fixtureFetch("/fixture/games").then((r) => r.json()) as Promise<Game[]>,
    fixtureFetch("/fixture/engine").then((r) => r.arrayBuffer()),
  ]);
  const dependencies: ActiveDuelDependencies = {
    ...wire,
    cards: new Map(
      wire.cards.map(([code, c]: [number, { race: string }]) => [
        code,
        { ...c, race: BigInt(c.race) },
      ]),
    ),
    texts: new Map(wire.texts),
    scripts: new Map(wire.scripts),
    images: new Map(),
  };
  if (mode === "memory") {
    const record = (await fixtureFetch("/fixture/workload/0").then((r) =>
      r.json(),
    )) as EvidenceRecord;
    const bot = await loadBot(
      {
        runtime,
        packageId: runtime === "typescript" ? "builtin" : "ascencio.reference",
        policy: "basic",
      },
      dependencies,
      false,
    );
    for (const message of record.messages
      .filter((m) => m.type === "captured_decision")
      .slice(0, 100))
      await bot.decide(message.input);
    if (bot.fallbackCount) throw new Error("Memory fixture fallback");
    // Keep the loaded instance and identical inputs live until the host takes its GC-aware measurement.
    self.onmessage = (event) => {
      if (receiveBotHostResult(event.data)) return;
      void bot.decide(
        record.messages.find((m) => m.type === "captured_decision")!.input,
      );
    };
    self.postMessage({ type: "memoryReady" });
    return;
  }
  if (mode === "benchmark") {
    await benchmark(runtime, dependencies);
    return;
  }
  const started = performance.now();
  const adapter = await OcgCoreAdapter.initialize({ wasmBinary: wasm });
  const completed = [];
  const exchanges = [];
  let fallbackCount = 0,
    sideboards = 0;
  let histories: BotGameObservation[][] = [[], []];
  let decks: readonly ParsedDeck[] = [];
  for (const game of workload) {
    if (game.game === 0) {
      histories = [[], []];
      decks = game.request.decks;
    }
    const selections: BotSelection[] = [
      {
        runtime,
        packageId: runtime === "typescript" ? "builtin" : "ascencio.reference",
        policy: game.policy,
      },
      {
        runtime,
        packageId: runtime === "typescript" ? "builtin" : "ascencio.reference",
        policy: "basic",
      },
    ];
    const bots = await Promise.all(
      selections.map((s) => loadBot(s, dependencies, false)),
    );
    try {
      const order = game.request.bot_order;
      const result = await playLiveGame(
        adapter,
        dependencies,
        [decks[order[0]]!, decks[order[1]]!],
        game.request.seed,
        [bots[order[0]]!, bots[order[1]]!],
        game.request.game_id,
      );
      for (const actor of [0, 1] as const)
        histories[order[actor]]!.push(result.histories[actor]);
      completed.push({
        id: game.request.game_id,
        turns: result.turns,
        decisions: result.decisions,
        ...result.result,
      });
      self.postMessage({ type: "progress", game: game.request.game_id });
    } finally {
      for (const bot of bots) {
        fallbackCount += bot.fallbackCount;
        bot.dispose();
      }
    }
    if (game.game === 1) {
      const sideBots = await Promise.all(
        selections.map((s) => loadBot(s, dependencies, false)),
      );
      try {
        const proposals = await Promise.all(
          sideBots.map((b, i) =>
            b.sideboard({
              deck: game.request.decks[0],
              preSideGames: histories[i] as [
                BotGameObservation,
                BotGameObservation,
              ],
            }),
          ),
        );
        decks = validateSideboardPair(
          game.request.decks[0],
          [proposals[0]!, proposals[1]!],
          () => {},
        );
        sideboards += 2;
        exchanges.push({
          match: game.match,
          policy: game.policy,
          proposals,
          decks,
        });
      } finally {
        for (const bot of sideBots) {
          fallbackCount += bot.fallbackCount;
          bot.dispose();
        }
      }
    }
    if (fallbackCount) throw new Error("Unexpected bot fallback during smoke");
  }
  if (completed.length !== 40 || sideboards !== 20)
    throw new Error("Incomplete smoke");
  self.postMessage({
    type: "complete",
    runtime,
    completed,
    sideboards,
    exchanges,
    ...(mode === "throughput"
      ? {
          elapsedMs: performance.now() - started,
          gamesPerSecond: 40 / ((performance.now() - started) / 1000),
        }
      : {}),
    crashes: 0,
    illegalDecisions: 0,
    unexpectedFallbacks: fallbackCount,
    environment: navigator.userAgent,
  });
}
