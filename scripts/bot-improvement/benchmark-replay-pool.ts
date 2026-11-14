import { availableParallelism } from "node:os";
import { workerCounts, workerRecommendation } from "./worker-calibration.ts";
/** Compare explicit replay worker counts without changing production settings. */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { runReplayPool } from "./run-replay-pool.ts";
import { writeOutput } from "./output-storage.ts";
import { identity } from "./session-fixtures.ts";
const { values: v } = parseArgs({
  options: {
    request: { type: "string" },
    out: { type: "string" },
    "worker-counts": { type: "string" },
    repeats: { type: "string", default: "2" },
    "batch-size": { type: "string", default: "1" },
  },
});
if (!v.request || !v.out) throw Error("--request and --out required");
const logical = availableParallelism();
const counts = workerCounts(v["worker-counts"], logical),
  repeats = Number(v.repeats),
  batchSize = Number(v["batch-size"]);
if (
  !counts.length ||
  new Set(counts).size !== counts.length ||
  ![...counts, repeats, batchSize].every((n) => Number.isInteger(n) && n > 0)
)
  throw Error("Positive worker counts/repeats/batch size required");
const request = JSON.parse(await readFile(v.request, "utf8"));
const cases = request.reasons.reduce(
  (n: number, r: { cases: unknown[] }) => n + r.cases.length,
  0,
);
if (cases < Math.max(...counts) * batchSize)
  throw Error(
    "Provide at least one full replay batch per worker at the largest stage",
  );
await mkdir(path.dirname(path.resolve(v.out)), { recursive: true });
await mkdir(v.out);
const runs = [];
let expected: string | undefined;
for (let repeat = 0; repeat < repeats; repeat++)
  for (const workers of repeat % 2 ? [...counts].reverse() : counts) {
    const output = path.join(v.out, `workers-${workers}-repeat-${repeat + 1}`);
    const result = await runReplayPool({
      request: v.request,
      out: output,
      workers,
      batchSize,
    });
    if (
      result.status !== "complete" ||
      result.ignored ||
      result.failed ||
      result.cancelled
    )
      throw Error("Benchmark requires fully successful replay cases");
    const fingerprint = identity(
      result.rows
        .map((row) => ({
          id: row.id,
          control: row.result!.control,
          alternative: row.result!.alternative,
          choiceChanged: row.result!.choiceChanged,
          convertedLossToWin: row.result!.convertedLossToWin,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
    expected ??= fingerprint;
    if (expected !== fingerprint)
      throw Error("Replay behavior changed across worker counts");
    const run = {
      workers,
      repeat: repeat + 1,
      cases: result.complete,
      elapsedMs: result.elapsedMs,
      casesPerSecond: result.complete / (result.elapsedMs / 1000),
      branchAttempts: result.branchAttempts,
      fingerprint,
      output: path.resolve(output),
    };
    runs.push(run);
    await writeOutput(
      path.join(v.out, "benchmark.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          experimental: true,
          runs,
          logical,
          workerCounts: counts,
          repeats,
          ...workerRecommendation(runs),
          identicalReplayBehavior: true,
          scope:
            "Fresh processes per replay case; explicit worker counts; includes discovery, source freezing, both branches and durable evidence. Recommendation applies only to this replay workload; production settings are unchanged.",
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify(run));
  }
// Readability check: the durable benchmark is the handoff artifact.
await readFile(path.join(v.out, "benchmark.json"));

console.log(
  JSON.stringify({
    ...workerRecommendation(runs),
    report: path.resolve(v.out, "benchmark.json"),
  }),
);
