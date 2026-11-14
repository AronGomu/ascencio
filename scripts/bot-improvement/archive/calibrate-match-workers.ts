/** Real headless match workload: compare every concurrency from 2 through 8. */
import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import { writeBudgetedFile as writeFile } from "../output-storage.ts";
import path from "node:path";
import { runProcess, interruptActiveProcess } from "../run-matches.ts";
const { values: v } = parseArgs({
  options: {
    session: { type: "string" },
    out: { type: "string" },
    matches: { type: "string", default: "24" },
    repeats: { type: "string", default: "1" },
    help: { type: "boolean" },
  },
});
if (v.help)
  console.log(
    "Usage: node scripts/bot-improvement/calibrate-match-workers.ts --session SESSION --out NEW_DIRECTORY [--matches 24] [--repeats 1]\nRuns real frozen headless matches with 2,3,4,5,6,7,8 workers; prefers 6 within the measured noise band. Saves a machine-local recommendation and Markdown results. Setup must permit 8 workers.",
  );
else {
  if (!v.session || !v.out) throw new Error("--session and --out required");
  const interrupt = () => interruptActiveProcess();
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  const code = await runProcess(process.execPath, [
    "scripts/bot-improvement/archive/benchmark-matches.ts",
    "--session",
    v.session,
    "--out",
    v.out,
    "--matches",
    v.matches,
    "--repeats",
    v.repeats,
    "--worker-counts",
    "2,3,4,5,6,7,8",
    "--preferred-workers",
    "6",
  ]);
  process.off("SIGINT", interrupt);
  process.off("SIGTERM", interrupt);
  const report = JSON.parse(
    await readFile(path.join(v.out, "benchmark.json"), "utf8"),
  );
  const lines = [
    "# Match worker calibration",
    "",
    `Recommendation: ${report.recommendation ?? "none"} workers. Preferred count: 6. ${report.matchCount} matches per stage, ${report.repeats} repetition(s).`,
    "",
    "Real headless engine matches; each worker stage uses identical frozen inputs. These are calibration games, not an AI improvement evaluation.",
    "",
    "| Workers | Median seconds | Games / second | Reliable |",
    "|---:|---:|---:|---|",
  ];
  for (const s of report.stages)
    lines.push(
      `| ${s.workers} | ${s.medianMs === undefined ? "—" : (s.medianMs / 1000).toFixed(2)} | ${s.medianMs === undefined ? "—" : ((report.matchCount * 4) / (s.medianMs / 1000)).toFixed(2)} | ${s.skipped ?? s.reliable} |`,
    );
  lines.push(
    "",
    "Choose the preferred six workers if its timing falls within the measured noise band of the fastest reliable stage; otherwise choose the smallest competitive reliable count. Invalid or interrupted runs leave the previous local recommendation intact.",
  );
  await writeFile(path.join(v.out, "report.md"), lines.join("\n") + "\n");
  console.log(path.resolve(v.out, "report.md"));
  process.exitCode = code;
}
