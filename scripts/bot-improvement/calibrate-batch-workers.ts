import { verifyFrozen } from "./frozen-setup.ts";
import { stableCalibrationProvenance } from "./calibration-evidence.ts";
import { calibrationMemory } from "./calibration-memory.ts";
import {
  ensureSessionOutput,
  configureOutputStorage,
} from "./output-storage.ts";
import { recoverCalibration } from "./calibration-recovery.ts";
import { identity as hashIdentity } from "./session-fixtures.ts";
import { benchmarkProvenance } from "./benchmark-provenance.ts";
import { randomUUID } from "node:crypto";
import { benchmarkTypescriptRun } from "./typescript-benchmark.ts";
import {
  typescriptCalibrationIdentity,
  typescriptRecommendation,
} from "./typescript-calibration.ts";
import { workerCounts, workerRecommendation } from "./worker-calibration.ts";
/** Calibrate the distinct batch runner across logical CPUs; never changes legacy settings. */
import { parseArgs } from "node:util";
import { availableParallelism } from "node:os";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { benchmarkRun } from "./batch-benchmark.ts";
import {
  batchBinary,
  batchRecommendation,
  buildBatchRunner,
  calibrationIdentity,
} from "./run-batch-matches.ts";
const { values: v } = parseArgs({
  options: {
    backend: { type: "string", default: "typescript" },
    session: { type: "string" },
    out: { type: "string" },
    matches: { type: "string" },
    repeats: { type: "string", default: "2" },
    "batch-size": { type: "string", default: "1" },
    "worker-counts": { type: "string" },
    "memory-budget-bytes": { type: "string" },
    "memory-reserve-bytes": { type: "string" },
    "memory-per-worker-bytes": { type: "string" },
  },
});
if (!v.session || !v.out)
  throw Error("--session SOURCE --out NEW_DIRECTORY required");
if (!["typescript", "rust"].includes(v.backend))
  throw Error("Unknown calibration backend");
const native = v.backend === "typescript",
  recommendation = native ? typescriptRecommendation : batchRecommendation;
const logical = availableParallelism();
const counts = workerCounts(v["worker-counts"], logical);
const sourceConfig = JSON.parse(
  await readFile(path.join(v.session, "config.json"), "utf8"),
);
const sourceState = JSON.parse(
  await readFile(path.join(v.session, "state.json"), "utf8"),
);
const sourceFixture = await verifyFrozen(sourceConfig.fixture.path);
if (sourceFixture.identity !== sourceConfig.fixture.identity)
  throw Error("Calibration fixture identity mismatch");
const provenance = benchmarkProvenance(
  {
    config: sourceConfig,
    fixture: sourceFixture,
    accepted: sourceState.accepted,
  },
  {
    workers: counts,
    evidenceMode: "native-v2",
  },
);
const matches = Number(
  v.matches ??
    Math.min(
      sourceFixture.matches.length,
      Math.max(16, logical * Number(v["batch-size"])),
    ),
);
const repeats = Number(v.repeats),
  batchSize = Number(v["batch-size"]);
if (
  ![matches, repeats, batchSize, ...counts].every(
    (n) => Number.isSafeInteger(n) && n > 0,
  ) ||
  counts.some((n) => n > logical || n * batchSize > matches) ||
  repeats < 2 ||
  batchSize > 256
)
  throw Error(
    "Positive integer stages required; each worker requires a full batch of matches and cannot exceed available logical CPUs",
  );
const memory = calibrationMemory(v);
await ensureSessionOutput(v.session);
await configureOutputStorage(v.out, sourceConfig.limits.stop.maxBytes);
await mkdir(path.dirname(path.resolve(v.out)), { recursive: true });
await mkdir(v.out, { recursive: true });
if (!native) await buildBatchRunner();
const calibrationId = native
  ? await typescriptCalibrationIdentity(
      sourceConfig.fixture.identity,
      batchSize,
    )
  : await calibrationIdentity(
      batchBinary,
      sourceConfig.fixture.identity,
      batchSize,
    );
const { runs, excluded, exclusions, journal, journalIdentity } =
  await recoverCalibration({
    out: v.out,
    identity: hashIdentity({
      calibrationId,
      provenance: stableCalibrationProvenance(provenance),
      memory,
      matches,
      repeats,
      batchSize,
      counts,
    }),
    counts,
    repeats,
    ...(memory ? { memory } : {}),
    run: (workers, out) =>
      (native ? benchmarkTypescriptRun : benchmarkRun)({
        session: v.session!,
        out,
        workers,
        matches,
        batchSize,
      }),
  });
const { stages, workers } = workerRecommendation(
  runs.map((r) => ({ workers: r.workers, elapsedMs: r.wallMs })),
);
const config = JSON.parse(
  await readFile(path.join(v.session, "config.json"), "utf8"),
);
const report = {
  excluded,
  exclusions,
  journal,
  journalIdentity,
  memory,
  provenance,
  acceptedIdentity: hashIdentity(sourceState.accepted),
  schemaVersion: 1,
  backend: v.backend,
  identity: native
    ? await typescriptCalibrationIdentity(config.fixture.identity, batchSize)
    : await calibrationIdentity(
        batchBinary,
        config.fixture.identity,
        batchSize,
      ),
  workers,
  batchSize,
  matches,
  repeats,
  logical,
  stages,
  runs,
  scope:
    "Short fresh standalone sessions; recalibrate under representative output sizes and background load.",
};
await writeFile(
  path.join(v.out, "calibration.json"),
  JSON.stringify(report, null, 2),
);
await mkdir(path.dirname(recommendation), { recursive: true });
const recommendationStage = `${recommendation}.${randomUUID()}.tmp`;
await writeFile(recommendationStage, JSON.stringify(report, null, 2));
const { rename } = await import("node:fs/promises");
await rename(recommendationStage, recommendation);
console.log(
  JSON.stringify({ workers, report: path.resolve(v.out, "calibration.json") }),
);
