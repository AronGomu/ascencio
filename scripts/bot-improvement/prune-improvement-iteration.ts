/** Remove owned action traces only after completed loss analysis is delivered. */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
const { values: v } = parseArgs({
  options: {
    run: { type: "string" },
    iteration: { type: "string" },
    baseline: { type: "boolean" },
    implementation: { type: "string" },
    "analysis-delivered": { type: "boolean" },
    help: { type: "boolean" },
  },
});
if (v.help) {
  console.log(
    "Usage: node scripts/bot-improvement/prune-improvement-iteration.ts --run DIRECTORY (--baseline | --iteration N) --implementation CHECKOUT --analysis-delivered\nRun only after the orchestrator has read baseline/loss-analysis.md or iterations/iteration-N/loss-analysis.md. Baseline mode requires completed baseline results; iteration mode requires a persisted decision. Deletes A/B text and machine action traces, keeps results, pairing and sideboarding, journals deletions and updates evidence hashes. Safe to rerun after interruption. Imported external evidence is preserved. Refreshes navigation afterward. Starts no games.",
  );
  process.exit(0);
}
for (const key of ["run", "implementation"] as const)
  if (!v[key]) throw Error(`Missing --${key}`);
if (!v["analysis-delivered"])
  throw Error("Read the delivered loss-analysis report before pruning");
if (Boolean(v.baseline) === Boolean(v.iteration))
  throw Error("Choose --baseline or --iteration N");
const iteration = Number(v.iteration);
if (!v.baseline && (!Number.isSafeInteger(iteration) || iteration < 1))
  throw Error("Invalid iteration");
const implementation = path.resolve(v.implementation!);
const result = spawnSync(
  path.join(
    implementation,
    "tools/bot-evaluation/target/debug/ascencio-bot-evaluation",
  ),
  [
    v.baseline ? "prune-baseline" : "prune-iteration",
    "--directory",
    path.resolve(v.run!),
    ...(v.baseline ? [] : ["--iteration", String(iteration)]),
    "--analysis-delivered",
  ],
  { cwd: implementation, stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
} else {
  const navigation = spawnSync(
    process.execPath,
    [
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "generate-improvement-run-index.ts",
      ),
      "--run",
      path.resolve(v.run!),
    ],
    { stdio: "inherit" },
  );
  if (navigation.error) throw navigation.error;
  process.exitCode = navigation.status ?? 1;
}
