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
const sourceFixture = JSON.parse(
  await readFile(path.join(sourceConfig.fixture.path, "manifest.json"), "utf8"),
);
const provenance = benchmarkProvenance(
  { config: sourceConfig, fixture: sourceFixture },
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
  batchSize > 256
)
  throw Error(
    "Positive integer stages required; each worker requires a full batch of matches and cannot exceed available logical CPUs",
  );
await mkdir(path.dirname(path.resolve(v.out)), { recursive: true });
await mkdir(v.out);
if (!native) await buildBatchRunner();
const runs: Awaited<ReturnType<typeof benchmarkRun>>[] = [];
let fingerprint: string | undefined;
// Alternate stage order to reduce systematic warm-cache/background-load bias.
for (let r = 0; r < repeats; r++)
  for (const workers of r % 2 ? [...counts].reverse() : counts) {
    console.error(
      `Batch calibration: ${workers} workers, repetition ${r + 1}/${repeats}`,
    );
    const run = await (native ? benchmarkTypescriptRun : benchmarkRun)({
      session: v.session,
      out: path.join(v.out, `workers-${workers}-repeat-${r + 1}`),
      workers,
      matches,
      batchSize,
    });
    fingerprint ??= run.fingerprint;
    if (run.fingerprint !== fingerprint)
      throw Error("Gameplay changed across worker settings");
    runs.push(run);
    await writeFile(
      path.join(v.out, "runs.json"),
      JSON.stringify(runs, null, 2),
    );
  }
const { stages, workers } = workerRecommendation(
  runs.map((r) => ({ workers: r.workers, elapsedMs: r.wallMs })),
);
const config = JSON.parse(
  await readFile(path.join(v.session, "config.json"), "utf8"),
);
const report = {
  provenance,
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
