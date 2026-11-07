import type { EvidenceRecord } from "./evidence.ts";
/** Evaluator transport measurements only. Does not substitute for Tauri/browser. */
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { build } from "esbuild";
import {
  nativeTransport,
  wasmTransport,
  type ExperimentTransport,
} from "./transport.ts";
import type { EngineCardData } from "../../src/battle/worker/engine/OcgCoreAdapter.ts";
import type {
  BotDecisionInput,
  BotSideboardInput,
  BotInstance,
} from "../../src/battle/worker/bot/bot-contract.ts";
const repetitions = Number(process.argv[2] ?? 5),
  warmup = 1;
if (!Number.isSafeInteger(repetitions) || repetitions < 2)
  throw new Error("At least two repetitions required");
const raw = JSON.parse(
  await readFile("docs/evidence/bot-experiment/native-parity.json", "utf8"),
);
if (raw.games !== 40 || raw.unexpectedFallbacks !== 0)
  throw new Error("Parity prerequisite missing");
async function tsTransport(): Promise<ExperimentTransport> {
  const built = await build({
    stdin: {
      contents: `export {createBasicBotModule} from './src/battle/worker/bot/basic-bot.ts'; export {createGeneralistBotModule} from './src/battle/worker/bot/generalist-bot.ts';`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    minify: true,
    format: "esm",
    platform: "node",
    target: "es2023",
  });
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(built.outputFiles![0]!.text).toString("base64")}`
  );
  let bot: BotInstance;
  return {
    computeMs: 0,
    async memoryBytes() {
      return process.memoryUsage().rss;
    },
    close() {},
    async request(this: ExperimentTransport, value: unknown) {
      // Explicit JSON loopback includes copying, matching the Rust wire payload.
      const request = JSON.parse(JSON.stringify(value)) as {
        op: string;
        policy: string;
        cards: EngineCardData[];
        input: BotDecisionInput & BotSideboardInput;
      };
      let result;
      if (request.op === "create") {
        bot = (
          request.policy === "basic"
            ? module.createBasicBotModule
            : module.createGeneralistBotModule
        )({ cards: new Map(request.cards.map((c) => [c.code, c])) }).create({});
        result = { contractVersion: 1 };
      } else {
        const start = performance.now();
        result =
          request.op === "decide"
            ? bot.decide(request.input)
            : bot.sideboard(request.input);
        this.computeMs = performance.now() - start;
      }
      return JSON.parse(JSON.stringify(result));
    },
  };
}
function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    n: values.length,
    mean,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    min: sorted[0],
    max: sorted.at(-1),
    stddev: Math.sqrt(
      values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length,
    ),
  };
}
const results = [];
for (const target of ["typescript", "wasm", "native"]) {
  const compute: number[] = [],
    roundtrip: number[] = [],
    cold: number[] = [],
    durations: number[] = [],
    memory: number[] = [];
  for (let repetition = -warmup; repetition < repetitions; repetition++) {
    const coldStart = performance.now();
    const bots = await Promise.all(
      [0, 1].map(() =>
        target === "typescript"
          ? tsTransport()
          : target === "wasm"
            ? wasmTransport()
            : nativeTransport(),
      ),
    );
    cold.push(performance.now() - coldStart);
    const input = createInterface({
      input: createReadStream(
        "docs/evidence/bot-experiment/typescript-baseline.jsonl.gz",
      ).pipe(createGunzip()),
    });
    let metadata: EvidenceRecord | undefined;
    let workloadMs = 0;
    try {
      for await (const line of input) {
        const record = JSON.parse(line) as EvidenceRecord;
        if (record.type === "metadata") metadata = record;
        if (record.type !== "game") continue;
        for (const actor of [0, 1] as const)
          await bots[actor]!.request({
            op: "create",
            contractVersion: 1,
            policy: [record.policy, "basic"][record.request.bot_order[actor]!],
            configuration: {},
            cards: metadata!.cards.map((c) => c[1]),
          });
        for (const message of record.messages) {
          if (message.type !== "captured_decision") continue;
          const bot = bots[message.actor]!;
          const start = performance.now();
          const result = await bot.request({
            op: "decide",
            input: message.input,
          });
          const duration = performance.now() - start;
          workloadMs += duration;
          if (
            JSON.stringify(result.choiceIds) !==
            JSON.stringify(message.decision.choiceIds)
          )
            throw new Error("Benchmark parity failed");
          if (repetition >= 0) {
            compute.push(bot.computeMs);
            roundtrip.push(duration);
          }
        }
        memory.push(await bots[0]!.memoryBytes());
      }
    } finally {
      input.close();
      for (const bot of bots) bot.close();
    }
    if (repetition >= 0) durations.push(workloadMs);
    console.error(
      `${target}: repetition ${repetition + 1}, ${workloadMs.toFixed(1)} ms decision roundtrips`,
    );
  }
  results.push({
    target,
    computeMs: stats(compute),
    roundtripMs: stats(roundtrip),
    coldConstructPairMs: stats(cold),
    workloadDecisionMs: stats(durations),
    sampledMemoryBytes: stats(memory),
    memoryMeaning:
      target === "typescript"
        ? "whole Node process RSS including fixture reader"
        : target === "wasm"
          ? "one instance committed linear memory"
          : "one native bot child RSS; Linux /proc",
    transport:
      target === "typescript"
        ? "same-process JSON loopback"
        : target === "wasm"
          ? "Node to WASM linear-memory copy and JSON"
          : "Node to native child stdin/stdout JSON",
  });
}
const report = {
  scope: "Evaluator replay only; browser and Worker-to-Tauri not measured",
  machine: {
    platform: process.platform,
    arch: process.arch,
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    totalMemory: os.totalmem(),
  },
  toolchain: {
    node: process.version,
    rustBuild: JSON.parse(
      await readFile("assets/ai-bots/reference/dist/build.json", "utf8"),
    ),
  },
  repetitions,
  warmup,
  timing:
    "performance.now host monotonic milliseconds; Rust Instant compute nanoseconds; WASM execute export timed separately from prepare/serialize. Input gzip/read/parse and parity assertions excluded from decision timings. No per-decision evidence I/O.",
  limitations: [
    "Native compute includes result construction; wasm execute includes envelope construction",
    "Cold TypeScript includes esbuild, native process construction excludes ready handshake, WASM includes compilation/instantiation: these are not directly comparable startup measurements",
    "Memory scopes differ; no comparative memory efficiency claim",
    "Complete duel throughput is not measured by this replay benchmark",
  ],
  results,
};
await writeFile(
  "docs/evidence/bot-experiment/evaluator-performance.json",
  JSON.stringify(report, null, 2) + "\n",
);
