import { fixtureFetch } from "./fixture-fetch.ts";
import { loadBot } from "../../../src/battle/worker/bot-runtime/loaded-bot.ts";
import type { BotTransportMetrics } from "../../../src/battle/worker/bot-runtime/transport.ts";
import type { BotSelection } from "../../../src/battle/duel/contracts/bot-selection.ts";
import type { ActiveDuelDependencies } from "../../../src/battle/worker/assets/active-duel-dependencies.ts";
import type { EvidenceRecord } from "../../../scripts/bot-experiment/evidence.ts";
function stats(v: number[]) {
  const s = [...v].sort((a, b) => a - b),
    mean = v.reduce((a, b) => a + b, 0) / v.length;
  return {
    n: v.length,
    mean,
    min: s[0],
    max: s.at(-1),
    p50: s[Math.floor(s.length * 0.5)],
    p95: s[Math.floor(s.length * 0.95)],
    stddev: Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length),
  };
}
export async function benchmark(
  runtime: BotSelection["runtime"],
  dependencies: ActiveDuelDependencies,
) {
  const repetitions = 3,
    warmup = 1,
    compute: number[] = [],
    roundtrip: number[] = [],
    startup: number[] = [],
    passes: number[] = [],
    memory: number[] = [];
  let firstStartupMs: number | undefined;
  for (let repetition = 0; repetition < repetitions + warmup; repetition++) {
    let elapsed = 0,
      decisions = 0;
    for (let game = 0; game < 40; game++) {
      // Fetch/decode/reporting are outside measured execution, identically for every runtime.
      const record = (await fixtureFetch(`/fixture/workload/${game}`).then(
        (r) => r.json(),
      )) as EvidenceRecord;
      const latest: BotTransportMetrics[] = [];
      const policies = [record.policy, "basic"] as const;
      const bots = [];
      for (const actor of [0, 1] as const) {
        const begin = performance.now();
        bots.push(
          await loadBot(
            {
              runtime,
              packageId:
                runtime === "typescript" ? "builtin" : "ascencio.reference",
              policy: policies[record.request.bot_order[actor]!]!,
            },
            dependencies,
            false,
            (m) => {
              latest[actor] = m;
            },
          ),
        );
        const duration = performance.now() - begin;
        firstStartupMs ??= duration;
        if (repetition >= warmup) startup.push(duration);
      }
      try {
        for (const message of record.messages) {
          if (message.type !== "captured_decision") continue;
          const before = performance.now();
          const result = await bots[message.actor]!.decide(message.input);
          const duration = performance.now() - before;
          elapsed += duration;
          decisions++;
          if (
            JSON.stringify(result.choiceIds) !==
            JSON.stringify(message.decision.choiceIds)
          )
            throw new Error(
              `Benchmark replay divergence ${record.request.game_id}/${decisions}`,
            );
          if (repetition >= warmup) {
            roundtrip.push(duration);
            compute.push(latest[message.actor]!.computationMs);
            const bytes = latest[message.actor]!.memoryBytes;
            if (bytes) memory.push(bytes);
          }
        }
        if (bots.some((b) => b.fallbackCount))
          throw new Error("Benchmark unexpected fallback");
        for (const bot of bots) {
          const bytes = await bot.memoryBytes?.();
          if (bytes) memory.push(bytes);
        }
      } finally {
        for (const bot of bots) bot.dispose();
      }
    }
    if (decisions !== 22158)
      throw new Error(`Incomplete benchmark ${decisions}`);
    if (repetition >= warmup) passes.push(elapsed);
    self.postMessage({ type: "progress", runtime, repetition, decisions });
  }
  const controlRecord = (await fixtureFetch("/fixture/workload/0").then((r) =>
    r.json(),
  )) as EvidenceRecord;
  const controlTimes: number[] = [],
    controlCompute: number[] = [];
  let metric: BotTransportMetrics | undefined;
  for (let pass = 0; pass < 4; pass++) {
    const bot = await loadBot(
      {
        runtime,
        packageId: runtime === "typescript" ? "builtin" : "ascencio.reference",
        policy: "random",
      },
      dependencies,
      false,
      (m) => {
        metric = m;
      },
      1,
    );
    try {
      for (const m of controlRecord.messages) {
        if (m.type !== "captured_decision") continue;
        const before = performance.now();
        await bot.decide(m.input);
        const duration = performance.now() - before;
        if (pass) {
          controlTimes.push(duration);
          controlCompute.push(metric!.computationMs);
        }
      }
      if (bot.fallbackCount) throw new Error("Random control fallback");
    } finally {
      bot.dispose();
    }
  }
  self.postMessage({
    type: "complete",
    runtime,
    mode: "benchmark",
    randomControl: {
      workload: "saved game 0 inputs",
      rng: "xorshift32",
      seed: 1,
      warmup: 1,
      repetitions: 3,
      roundtripMs: stats(controlTimes),
      computeMs: stats(controlCompute),
    },
    repetitions,
    warmup,
    decisionsPerPass: 22158,
    firstStartupMs,
    warmStartupMs: stats(startup),
    computeMs: stats(compute),
    roundtripMs: stats(roundtrip),
    passExecutionMs: stats(passes),
    botMemoryBytes: memory.length ? stats(memory) : null,
    environment: navigator.userAgent,
    timing:
      "performance.now; full asynchronous loadedBot.decide includes production transport, validation and copies; fixture parsing and equality check excluded",
    unexpectedFallbacks: 0,
  });
}
