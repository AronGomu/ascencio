/** Migrate evidence without executing games; runner validates before deleting XML. */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { parseArgs } from "node:util";
const { values: v } = parseArgs({
  options: {
    run: { type: "string" },
    implementation: { type: "string" },
    "previous-executable": { type: "string" },
    help: { type: "boolean" },
  },
});
if (v.help) {
  console.log(
    "Usage: node scripts/bot-improvement/migrate-improvement-run.ts --run DIRECTORY --implementation CHECKOUT --previous-executable PINNED_BINARY\nRequires the current evaluator to be built. Validates original runtime and evidence, converts XML losslessly to linked per-game records and text logs, verifies results, removes migrated XML, and preserves the current stage. Starts no games or agents.",
  );
  process.exit(0);
}
for (const key of ["run", "implementation", "previous-executable"] as const)
  if (!v[key]) throw Error(`Missing --${key}`);
const root = path.resolve(v.implementation!);
const result = spawnSync(
  path.join(root, "tools/bot-evaluation/target/debug/ascencio-bot-evaluation"),
  [
    "migrate-run",
    "--directory",
    path.resolve(v.run!),
    "--previous-executable",
    path.resolve(v["previous-executable"]!),
  ],
  { cwd: root, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
