/** Short paired end-to-end comparison, including preparation and durable evidence. */
import { parseArgs } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { benchmarkRun } from "./batch-benchmark.ts";
import { buildBatchRunner } from "./run-batch-matches.ts";
const { values: v } = parseArgs({
  options: {
    session: { type: "string" },
    out: { type: "string" },
    matches: { type: "string", default: "8" },
    workers: { type: "string", default: "4" },
    repeats: { type: "string", default: "2" },
    "batch-size": { type: "string", default: "2" },
  },
});
if (!v.session || !v.out)
  throw Error("--session SOURCE --out NEW_DIRECTORY required");
const matches = Number(v.matches),
  workers = Number(v.workers),
  repeats = Number(v.repeats),
  batchSize = Number(v["batch-size"]);
if (
  ![matches, workers, repeats, batchSize].every(
    (n) => Number.isSafeInteger(n) && n > 0,
  ) ||
  workers > matches ||
  workers > 8 ||
  batchSize > 256
)
  throw Error(
    "Positive integers required; comparison uses legacy-supported workers <= 8 and <= matches",
  );
await mkdir(path.dirname(path.resolve(v.out)), { recursive: true });
await mkdir(v.out);
await buildBatchRunner();
const runs: Awaited<ReturnType<typeof benchmarkRun>>[] = [];
let fingerprint: string | undefined;
for (let r = 0; r < repeats; r++)
  for (const legacy of r % 2 ? [false, true] : [true, false]) {
    console.error(
      `Comparison: ${legacy ? "legacy" : "batch"}, repetition ${r + 1}/${repeats}`,
    );
    const run = await benchmarkRun({
      session: v.session,
      out: path.join(v.out, `${legacy ? "legacy" : "batch"}-${r + 1}`),
      workers,
      matches,
      batchSize,
      legacy,
    });
    fingerprint ??= run.fingerprint;
    if (fingerprint !== run.fingerprint)
      throw Error("Runner gameplay mismatch");
    runs.push(run);
    await writeFile(
      path.join(v.out, "comparison.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          matches,
          workers,
          repeats,
          batchSize,
          runs,
          gameplayIdentical: true,
          timing:
            "Preparation through child exit and durable evidence; build, fixture-session creation and post-run integrity/fingerprint verification excluded. Alternating runner order.",
        },
        null,
        2,
      ),
    );
  }
console.log(path.resolve(v.out, "comparison.json"));
