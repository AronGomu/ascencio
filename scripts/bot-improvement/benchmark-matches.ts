import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  benchmarkInputs,
  createBenchmarkSession,
} from "./benchmark-session.ts";
import { sessionControl } from "./match-session.ts";
import {
  executeMatches,
  matchOptions,
  runProcess,
  interruptActiveProcess,
} from "./run-matches.ts";
import { machineResources, saveRecommendation } from "./match-workers.ts";
import { digest, identity } from "./session-fixtures.ts";

const { values: v } = parseArgs({
  options: { ...matchOptions, repeats: { type: "string", default: "1" } },
});
if (!v.session || !v.out || v.resume)
  throw new Error(
    "Benchmark requires --session SESSION --out NEW_DIRECTORY; optional --repeats N (minimum 1), --candidate, --self, --limits",
  );
const repeats = Number(v.repeats);
if (!Number.isSafeInteger(repeats) || repeats < 1)
  throw new Error("At least one repetition required");
const matchCount = Number(v.matches ?? 24);
if (!Number.isSafeInteger(matchCount) || matchCount < 1 || matchCount > 500)
  throw new Error("Match count must be 1–500");
let ownerStopped = false;
const requestStop = () => {
  ownerStopped = true;
  interruptActiveProcess();
};
process.on("SIGINT", requestStop);
process.on("SIGTERM", requestStop);
const output = path.resolve(v.out);
await mkdir(path.dirname(output), { recursive: true });
await mkdir(output); // A unique benchmark root prevents evidence/build collisions.
if (
  await runProcess("cargo", [
    "build",
    "--release",
    "--manifest-path",
    "tools/bot-evaluation/Cargo.toml",
  ])
)
  throw new Error("Evaluator build failed");
const resources = await machineResources();
const sessionConfig = JSON.parse(
  await readFile(path.join(v.session, "config.json"), "utf8"),
);
const requiredBound = Math.max(
  ...[1, 2, 4, 6, 8].filter((n) => n <= resources.usable),
);
if (sessionConfig.limits.matchWorkers < requiredBound)
  throw new Error(
    `Setup match-worker bound must be at least ${requiredBound} for this machine`,
  );
const inputs = await benchmarkInputs(v.session);
const stages: {
  workers: number;
  skipped?: string;
  runs: Record<string, unknown>[];
  medianMs?: number;
  reliable?: boolean;
  speedup?: number;
  previousSpeedup?: number;
}[] = [];
let baseline = 0,
  previous = 0,
  executionIdentity: string | undefined,
  replayIdentity: string | undefined;
stagesLoop: for (const workers of [1, 2, 4, 6, 8]) {
  const stage: (typeof stages)[number] = { workers, runs: [] };
  stages.push(stage);
  if (workers > resources.usable) {
    stage.skipped = `Exceeds usable CPU limit ${resources.usable}`;
    continue;
  }
  for (let repeat = 1; repeat <= repeats; repeat++) {
    if (ownerStopped) break stagesLoop;
    console.error(
      `Benchmark: ${workers} workers, repetition ${repeat}/${repeats}, ${matchCount} matches / ${matchCount * 4} games`,
    );
    const runSession = await createBenchmarkSession(
      inputs,
      path.join(output, `workers-${workers}-repeat-${repeat}`, "session"),
    );
    const begin = performance.now();
    const run = await executeMatches({
      session: runSession,
      stopSource: inputs.stopSource,
      out: path.join(runSession, "evaluation"),
      workers: String(workers),
      matchCount,
      candidate: v.candidate,
      self: v.self,
      limits: v.limits,
      maxGames: v["max-games"] ? Number(v["max-games"]) : undefined,
      maxWallMs: v["max-wall-ms"] ? Number(v["max-wall-ms"]) : undefined,
    });
    run.commandWallMs = performance.now() - begin;
    run.commandGamesPerSecond = run.completedGames / (run.commandWallMs / 1000);
    run.amortizedWallMsPerCompletedMatch = run.matches
      ? run.commandWallMs / run.matches
      : null;
    if (run.workers !== workers)
      throw new Error(
        "Session worker bound clamps requested benchmark stage; setup with --match-workers 8",
      );
    executionIdentity ??= run.identity;
    if (run.identity !== executionIdentity)
      throw new Error("Benchmark inputs changed between stages");
    if (run.stoppingReason === "owner-stop") ownerStopped = true;
    if (ownerStopped) {
      const file = path.join(run.output, "result.json");
      await sessionControl(runSession, {
        action: "finish",
        iteration: run.iteration,
        status: "interrupted",
        evidence: {
          path: path.relative(path.resolve(runSession), file),
          sha256: digest(await readFile(file)),
        },
      });
      stage.runs.push(run);
      break stagesLoop;
    }
    // Final XML reread/hash verification uses the same production resume path. This
    // validates evidence without replacing the timing of the original full execution.
    const verified = await executeMatches({
      session: runSession,
      stopSource: inputs.stopSource,
      out: run.output,
      workers: String(workers),
      matchCount,
      candidate: v.candidate,
      self: v.self,
      limits: v.limits,
      resume: true,
      iteration: run.iteration,
      role: run.role,
      maxGames: v["max-games"] ? Number(v["max-games"]) : undefined,
      maxWallMs: v["max-wall-ms"] ? Number(v["max-wall-ms"]) : undefined,
    });
    const finishStart = performance.now();
    const resultFile = path.join(run.output, "result.json");
    await sessionControl(runSession, {
      action: "finish",
      iteration: run.iteration,
      status: run.exitCode === 0 ? "complete" : "failed",
      evidence: {
        path: path.relative(path.resolve(runSession), resultFile),
        sha256: digest(await readFile(resultFile)),
      },
    });
    run.commandWallMs += performance.now() - finishStart;
    run.commandGamesPerSecond = run.completedGames / (run.commandWallMs / 1000);
    run.amortizedWallMsPerCompletedMatch = run.matches
      ? run.commandWallMs / run.matches
      : null;
    run.evidenceVerified =
      verified.completedGames === run.completedGames &&
      verified.identity === run.identity &&
      verified.exitCode === run.exitCode;
    replayIdentity ??= run.replayIdentity;
    run.replayMatchesBaseline = run.replayIdentity === replayIdentity;
    stage.runs.push(run);
    await writeFile(
      path.join(output, "benchmark.json"),
      JSON.stringify({ schemaVersion: 1, resources, repeats, stages }, null, 2),
    );
  }
  stage.reliable = stage.runs.every(
    (r) =>
      r.exitCode === 0 &&
      r.status === "completed" &&
      r.matches === matchCount &&
      r.completedGames === matchCount * 4 &&
      r.completedMatchLatencySamples === matchCount &&
      Number(r.averageCompletedMatchLatencyMs) > 0 &&
      r.failedGames === 0 &&
      r.skippedGames === 0 &&
      r.evidenceVerified === true &&
      r.replayMatchesBaseline === true,
  );
  const times = stage.runs
    .map((r) => Number(r.commandWallMs))
    .sort((a, b) => a - b);
  stage.medianMs =
    (times[Math.floor((times.length - 1) / 2)]! +
      times[Math.ceil((times.length - 1) / 2)]!) /
    2;
  baseline ||= stage.medianMs;
  stage.speedup = baseline / stage.medianMs;
  stage.previousSpeedup = (previous || baseline) / stage.medianMs;
  previous = stage.medianMs;
}
// Use the larger of a 3% floor and observed relative run spread as the noise band.
const reliable = stages.filter((s) => s.reliable);
const noise = Math.max(
  0.03,
  ...reliable.map((s) => {
    const t = s.runs.map((r) => Number(r.commandWallMs));
    return (Math.max(...t) - Math.min(...t)) / s.medianMs!;
  }),
);
const fastest = Math.min(...reliable.map((s) => s.medianMs!));
const selected = ownerStopped
  ? undefined
  : reliable.find((s) => s.medianMs! <= fastest * (1 + noise));
const result = {
  schemaVersion: 1,
  resources,
  matchCount,
  repeats,
  executionIdentity,
  stages,
  noiseFraction: noise,
  recommendation: selected?.workers ?? null,
  accountingIsolation:
    "Fresh session control ledger and iteration 1 for every repetition; same frozen inputs, stop limits and evidence-writing behavior. Source OWNER_STOP is forwarded to the active run.",
  timingBoundary:
    "Each repetition starts with frozen verification/preparation and ends after Rust process shutdown and required evidence, summary and progress persistence. Build is once before stages; no unmeasured game warmup. Evidence verification replay is reported outside the execution interval.",
  evidenceIdentity: identity(stages),
  stoppingReason: ownerStopped
    ? "Owner interrupted benchmark; recommendation unchanged"
    : selected
      ? "completed"
      : "No reliable complete selected-match stage; recommendation unchanged",
};
await writeFile(
  path.join(output, "benchmark.json"),
  JSON.stringify(result, null, 2),
);
if (selected)
  await saveRecommendation(
    selected.workers,
    path.join(output, "benchmark.json"),
  );
console.log(JSON.stringify(result));
if (!selected) process.exitCode = 2;

process.off("SIGINT", requestStop);
process.off("SIGTERM", requestStop);
