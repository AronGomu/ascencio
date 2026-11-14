/** Verify previously measured stages without replaying games or changing their timings. */
import { readFile } from "node:fs/promises";
import { writeBudgetedFile as writeFile } from "../output-storage.ts";
import path from "node:path";
import { parseArgs } from "node:util";
import { benchmarkBehavior } from "../benchmark-behavior.ts";
import {
  saveRecommendation,
  machineResources,
  selectWorkerRecommendation,
} from "../match-workers.ts";
const { values: v } = parseArgs({ options: { out: { type: "string" } } });
if (!v.out) throw new Error("--out EXISTING_CALIBRATION_DIRECTORY required");
const file = path.resolve(v.out, "benchmark.json");
const report = JSON.parse(await readFile(file, "utf8"));
if (report.resources.identity !== (await machineResources()).identity)
  throw new Error("Calibration machine/environment mismatch");
if (String(report.stoppingReason).startsWith("Owner interrupted"))
  throw new Error("Interrupted calibration cannot publish a recommendation");
let behavior: string | undefined;
for (const stage of report.stages) {
  for (const run of stage.runs) {
    run.behaviorMatchesBaseline = false;
    if (
      run.exitCode !== 0 ||
      run.failedGames ||
      run.skippedGames ||
      !run.evidenceVerified ||
      run.completedGames !== report.matchCount * 4
    )
      continue;
    const job = JSON.parse(await readFile(run.output + ".job.json", "utf8"));
    if (
      job.identity !== report.executionIdentity ||
      run.identity !== report.executionIdentity
    )
      throw new Error("Calibration inputs changed between stages");
    run.behaviorIdentity = await benchmarkBehavior(
      run.output,
      job.matches.map((m: { match: { id: string } }) => m.match.id),
    );
    behavior ??= run.behaviorIdentity;
    run.behaviorMatchesBaseline = run.behaviorIdentity === behavior;
  }
  stage.reliable =
    stage.runs.length === report.repeats &&
    stage.runs.every(
      (r: {
        exitCode: number;
        status: string;
        matches: number;
        completedGames: number;
        failedGames: number;
        skippedGames: number;
        evidenceVerified: boolean;
        behaviorMatchesBaseline: boolean;
        completedMatchLatencySamples: number;
      }) =>
        r.exitCode === 0 &&
        r.status === "completed" &&
        r.matches === report.matchCount &&
        r.completedGames === report.matchCount * 4 &&
        r.completedMatchLatencySamples === report.matchCount &&
        r.failedGames === 0 &&
        r.skippedGames === 0 &&
        r.evidenceVerified &&
        r.behaviorMatchesBaseline,
    );
}
const selection = selectWorkerRecommendation(
  report.stages,
  report.preferredWorkers,
);
const noise = selection.noiseFraction;
const selected = report.stages.find(
  (s: { workers: number }) => s.workers === selection.workers,
);
report.behaviorProtocol = "decisions-outcomes-opening-orders-v1";
report.noiseFraction = noise;
report.recommendation = selected?.workers ?? null;
report.stoppingReason = selected ? "completed" : "No reliable comparable stage";
report.recheckedWithoutReplay = true;
await writeFile(file, JSON.stringify(report, null, 2) + "\n");
if (selected)
  await saveRecommendation(selected.workers, file, report.preferredWorkers);
else process.exitCode = 2;
const lines = [
  "# Match worker calibration",
  "",
  `Recommendation: **${report.recommendation ?? "none"} workers**. Preferred: ${report.preferredWorkers}. ${report.matchCount} frozen matches per stage; ${report.repeats} repetition(s).`,
  "",
  "| Workers | Seconds | Games / second | Comparable |",
  "|---:|---:|---:|---|",
];
for (const s of report.stages)
  lines.push(
    `| ${s.workers} | ${(s.medianMs / 1000).toFixed(2)} | ${((report.matchCount * 4) / (s.medianMs / 1000)).toFixed(2)} | ${s.reliable} |`,
  );
lines.push(
  "",
  "All runs retain exact-byte evidence verification. Gameplay comparison checks opening orders, configurations, decisions and outcomes; harmless engine annotation ordering is excluded. Original trace hashes and timings remain recorded. Verification was repeated without replaying games or changing measured timings.",
);
await writeFile(path.resolve(v.out, "report.md"), lines.join("\n") + "\n");
console.log(file);
