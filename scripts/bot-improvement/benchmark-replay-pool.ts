import { stableCalibrationProvenance } from "./calibration-evidence.ts";
import { calibrationMemory } from "./calibration-memory.ts";
import { prepareReplayPool } from "./prepare-replay-pool.ts";
import { configureOutputStorage, findOutputRoot } from "./output-storage.ts";
import { recoverCalibration } from "./calibration-recovery.ts";
import { hostname, release } from "node:os";
import { benchmarkProvenance } from "./benchmark-provenance.ts";
import { availableParallelism } from "node:os";
import { workerCounts, workerRecommendation } from "./worker-calibration.ts";
/** Compare explicit replay worker counts without changing production settings. */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { replayCalibrationStage } from "./replay-calibration-stage.ts";
import { writeOutput } from "./output-storage.ts";
import { identity } from "./session-fixtures.ts";
const { values: v } = parseArgs({
  options: {
    request: { type: "string" },
    out: { type: "string" },
    "worker-counts": { type: "string" },
    repeats: { type: "string", default: "2" },
    "batch-size": { type: "string", default: "1" },
    "max-bytes": { type: "string" },
    "memory-budget-bytes": { type: "string" },
    "memory-reserve-bytes": { type: "string" },
    "memory-per-worker-bytes": { type: "string" },
  },
});
if (!v.request || !v.out) throw Error("--request and --out required");
const logical = availableParallelism();
const counts = workerCounts(v["worker-counts"], logical),
  repeats = Number(v.repeats),
  batchSize = Number(v["batch-size"]);
if (
  repeats < 2 ||
  !counts.length ||
  new Set(counts).size !== counts.length ||
  ![...counts, repeats, batchSize].every((n) => Number.isInteger(n) && n > 0)
)
  throw Error("Positive worker counts/repeats/batch size required");
const request = JSON.parse(await readFile(v.request, "utf8"));
const provenance = benchmarkProvenance(request, {
  workers: counts,
  evidenceMode: "verified replay branches and durable evidence",
});
const cases = request.reasons.reduce(
  (n: number, r: { cases: unknown[] }) => n + r.cases.length,
  0,
);
if (cases < Math.max(...counts) * batchSize)
  throw Error(
    "Provide at least one full replay batch per worker at the largest stage",
  );
const memory = calibrationMemory(v);
if (
  !(await findOutputRoot(path.join(v.out, ".probe"))) &&
  v["max-bytes"] === undefined
)
  throw Error(
    "Replay calibration requires an existing storage root or explicit --max-bytes",
  );
if (v["max-bytes"] !== undefined)
  await configureOutputStorage(v.out, Number(v["max-bytes"]));
const prepared = await prepareReplayPool(
  v.request,
  path.join(v.out, "identity-probe"),
);
const workload = prepared.jobs.map((j) => ({
  ...j,
  replacement: undefined,
  pins: j.pins.map((p) => ({
    path: p.path === j.replacement ? "replacement" : p.path,
    sha256: p.sha256,
  })),
}));
await mkdir(path.dirname(path.resolve(v.out)), { recursive: true });
await mkdir(v.out, { recursive: true });
const { runs, excluded, exclusions, journal, journalIdentity } =
  await recoverCalibration({
    out: v.out,
    identity: identity({
      request,
      provenance: stableCalibrationProvenance(provenance),
      workload,
      memory,
      counts,
      repeats,
      batchSize,
      node: process.version,
      flags: process.execArgv,
      machine: hostname(),
      kernel: release(),
    }),
    counts,
    repeats,
    ...(memory ? { memory } : {}),
    run: (workers, output) =>
      replayCalibrationStage(v.request!, workers, output, batchSize),
  });
await writeOutput(
  path.join(v.out, "benchmark.json"),
  JSON.stringify(
    {
      schemaVersion: 1,
      provenance,
      experimental: true,
      runs,
      excluded,
      exclusions,
      journal,
      journalIdentity,
      memory,
      workload,
      logical,
      workerCounts: counts,
      repeats,
      ...workerRecommendation(runs),
      identicalReplayBehavior: true,
    },
    null,
    2,
  ),
);
// Readability check: the durable benchmark is the handoff artifact.
await readFile(path.join(v.out, "benchmark.json"));

console.log(
  JSON.stringify({
    ...workerRecommendation(runs),
    report: path.resolve(v.out, "benchmark.json"),
  }),
);
