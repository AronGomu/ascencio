import { benchmarkProvenance } from "./benchmark-provenance.ts";
import { runProcess } from "./match-process.ts";
import { compareNativeRunners } from "./compare-native-runners.ts";
import type { runTypescriptNative } from "./run-typescript-native.ts";
import { gameplayFingerprint } from "./batch-benchmark.ts";
import { gameplayHash } from "./typescript-match-worker.ts";
/** Compare identical frozen matches; raw-frame mode is not canonical Rust evidence. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  runTypescriptMatches,
  prepareTypescriptJob,
} from "./run-typescript-matches.ts";
import {
  benchmarkInputs,
  createBenchmarkSession,
} from "./benchmark-session.ts";
import { benchmarkRun } from "./batch-benchmark.ts";
import { buildBatchRunner } from "./run-batch-matches.ts";
import { parseGameLog } from "./game-log.ts";
import { identity } from "./session-fixtures.ts";
const { values: v } = parseArgs({
  options: {
    session: { type: "string" },
    out: { type: "string" },
    workers: { type: "string", default: "2" },
    matches: { type: "string", default: "8" },
    "full-only": { type: "boolean", default: false },
    "native-first": { type: "boolean", default: false },
    "max-wall-ms": { type: "string", default: "60000" },
  },
});
if (!v.session || !v.out) throw Error("--session and --out required");
await mkdir(v.out);
const source = await createBenchmarkSession(
  await benchmarkInputs(v.session),
  path.join(v.out, "source"),
);
const { job } = await prepareTypescriptJob(source, Number(v.matches));
const provenance = benchmarkProvenance(job, {
  workers: [Number(v.workers)],
  evidenceMode: v["full-only"]
    ? "native-v2"
    : "native-v2 plus diagnostic compact/raw frames",
  childRuntimeFlags: [
    "--no-lazy",
    "--no-wasm-lazy-compilation",
    "--no-liftoff",
  ],
});
await buildBatchRunner();
const nativeOptions = {
  job,
  out: path.join(v.out, "typescript-native"),
  workers: Number(v.workers),
  maxWallMs: Number(v["max-wall-ms"]),
};
type NativeRun = Awaited<ReturnType<typeof runTypescriptNative>>;
async function nativeStage(resume = false) {
  const begin = performance.now();
  const exit = await runProcess(process.execPath, [
    "--no-lazy",
    "--no-wasm-lazy-compilation",
    "--no-liftoff",
    "scripts/bot-improvement/run-typescript-native.ts",
    "--session",
    source,
    "--out",
    nativeOptions.out,
    "--workers",
    String(nativeOptions.workers),
    "--matches",
    String(v.matches),
    "--max-wall-ms",
    String(nativeOptions.maxWallMs),
    ...(resume ? ["--resume"] : []),
  ]);
  if (exit !== 0) throw Error(`Native comparison process failed (${exit})`);
  const result = JSON.parse(
    await readFile(path.join(nativeOptions.out, "payload/result.json"), "utf8"),
  ) as NativeRun;
  const processWallMs = performance.now() - begin;
  const execution = JSON.parse(
    await readFile(path.join(result.output, "execution.json"), "utf8"),
  );
  if (identity(execution) !== identity(job))
    throw Error("Comparison preparation changed between coordinators");
  return { ...result, processWallMs };
}
const firstNative = v["native-first"] ? await nativeStage() : undefined;
const rust = await benchmarkRun({
  session: source,
  out: path.join(v.out, "rust"),
  workers: Number(v.workers),
  matches: Number(v.matches),
  batchSize: 1,
});
const index: Record<string, string> = JSON.parse(
  await readFile(path.join(rust.output, "matches.json"), "utf8"),
);
const expected = [];
for (const id of Object.keys(index).sort()) {
  const games = [];
  for (let n = 1; n <= 4; n++) {
    const g = parseGameLog(
      await readFile(
        path.join(rust.output, index[id]!, `native/games/game-${n}/game.log`),
        "utf8",
      ),
    );
    games.push({
      id: `${id}-game-${n}`,
      winner: g.neutral.winner,
      turns: g.actors[0]!.result!.turns,
      reason: g.actors[0]!.result!.engine_reason,
      actors: g.actors.map((a) => ({
        opening: a.initial!.own_starting_order,
        decisions: a.timeline.entry
          .filter((e) => e.kind === "decision")
          .map((e) => ({ id: e.decision_id, choices: e.selected_choice_ids })),
      })),
    });
  }
  expected.push([id, gameplayHash(games)]);
}
const expectedFingerprint = identity(expected),
  runs = [];
for (const evidence of v["full-only"] ? [] : [false, true]) {
  const result = await runTypescriptMatches({
    job,
    out: path.join(
      v.out,
      evidence ? "typescript-frames" : "typescript-compact",
    ),
    workers: Number(v.workers),
    evidence,
    maxWallMs: Number(v["max-wall-ms"]),
  });
  if (result.fingerprint !== expectedFingerprint)
    throw Error(
      `Gameplay mismatch; inspect ${v.out} before interpreting timing`,
    );
  const compact = {
    runner: result.runner,
    workers: result.workers,
    matches: result.matches,
    games: result.games,
    elapsedMs: result.elapsedMs,
    gamesPerSecond: result.gamesPerSecond,
    fingerprint: result.fingerprint,
    evidence: result.evidence,
  };
  runs.push(compact);
}
const native = firstNative ?? (await nativeStage());
if (
  native.status !== "completed" ||
  (await gameplayFingerprint(native.output, true)) !== rust.fingerprint
)
  throw Error("Full native gameplay mismatch");
const fullEvidence = await compareNativeRunners(rust.output, native.output);
const resumed = await nativeStage(true);
if (
  resumed.completedGames !== native.completedGames ||
  resumed.reservedGames !== native.reservedGames
)
  throw Error("Native resume replayed or lost work");
const report = {
  provenance,
  rust,
  runs,
  native,
  nativeResume: resumed,
  comparison: {
    games: native.completedGames,
    workers: native.workers,
    rustMs: rust.wallMs,
    typescriptMs: native.processWallMs,
    throughputRatio: rust.wallMs / native.processWallMs,
    isolatedCoordinators: true,
  },
  fullEvidence,
  nativeGameplayFingerprint: await gameplayFingerprint(native.output, true),
  order: v["native-first"] ? "typescript-first" : "rust-first",
  identicalGameplay: true,
  comparisonFingerprint: expectedFingerprint,
  scope:
    "Fixed identical matches; both coordinators run in separate fresh processes so terminated worker memory is not carried into the other backend. The comparison field uses process wall time including frozen preparation, startup, durable native v2 logs, evidence hashing, completion verification and output writes. Native and Rust gameplay fingerprints must match. Resume timing is verification only, not simulated throughput. Compact/raw modes, when included, have weaker persistence contracts. This standalone test does not migrate session ledgers or change production defaults.",
};
await writeFile(
  path.join(v.out, "comparison.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
