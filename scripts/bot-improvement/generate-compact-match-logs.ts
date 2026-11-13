/** Project existing completed evaluations into actor-relative text logs, without replay. */
import { readFile, readdir, mkdir, writeFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { parseArgs } from "node:util";
const { values: v } = parseArgs({
  options: {
    root: { type: "string" },
    implementation: { type: "string" },
    help: { type: "boolean" },
  },
});
if (v.help) {
  console.log(
    "Usage: node scripts/bot-improvement/generate-compact-match-logs.ts --root RUN_OR_PARENT --implementation CHECKOUT\nConverts completed checkpoint evaluations using the built Rust evaluator. Writes compact-logs/ and compact-logs/index.md beside each checkpoint. Preserves source evidence, checkpoint state and hashes; starts no games.",
  );
  process.exit(0);
}
if (!v.root || !v.implementation)
  throw Error("--root and --implementation required");
const implementation = path.resolve(v.implementation);
let count = 0;
async function visit(folder: string) {
  const entries = await readdir(folder, { withFileTypes: true });
  if (entries.some((e) => e.name === "state.json")) {
    const state = JSON.parse(
      await readFile(path.join(folder, "state.json"), "utf8"),
    );
    if (state.jobs) {
      const lines = [
        "# Compact match logs",
        "",
        "Actor-relative projections; source XML remains authoritative for machine validation.",
        "",
      ];
      for (const job of Object.values(state.jobs) as {
        status: string;
        result: { run: string };
      }[]) {
        if (job.status !== "completed") continue;
        const run = job.result.run;
        const out = path.join(folder, "compact-logs", path.basename(run));
        const result = spawnSync(
          path.join(
            implementation,
            "tools/bot-evaluation/target/debug/ascencio-bot-evaluation",
          ),
          ["compact-logs", "--run", run, "--out", out],
          { cwd: implementation, encoding: "utf8" },
        );
        if (result.status !== 0) throw Error(result.stderr || result.stdout);
        for (const m of (await readdir(out)).sort())
          for (const actor of ["a", "b"]) {
            const file = path.join(out, m, `player-${actor}.log`);
            await stat(file);
            lines.push(
              `- ${path.basename(run)} / ${m} / ${actor}: [log](<${file}>)`,
            );
            count++;
          }
      }
      await mkdir(path.join(folder, "compact-logs"), { recursive: true });
      await writeFile(
        path.join(folder, "compact-logs/index.md"),
        lines.join("\n") + "\n",
      );
    }
    return;
  }
  for (const e of entries)
    if (
      e.isDirectory() &&
      !["node_modules", ".git", "evaluations", "compact-logs"].includes(e.name)
    )
      await visit(path.join(folder, e.name));
}
await visit(path.resolve(v.root));
console.log(`Generated ${count} actor logs; no matches replayed.`);
