/** Offline analysis fixture: copy finalized matches; never alter producer evidence. */
import { cp, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { finalizedEvidence } from "./analysis-evidence.ts";
import { benchmarkProvenance } from "./benchmark-provenance.ts";
import { identity } from "./session-fixtures.ts";
import type { Job } from "./typescript-match-worker.ts";

const [source, destination] = process.argv.slice(2);
if (!source || !destination)
  throw Error(
    "Usage: node scripts/bot-improvement/benchmark-analysis-evidence.ts FINALIZED_PAYLOAD FRESH_OUTPUT",
  );
const output = path.resolve(destination);
await mkdir(output, { recursive: false });
const job = JSON.parse(
  await readFile(path.join(source, "execution.json"), "utf8"),
) as Job;
const matches = job.matches.slice(0, 12);
if (matches.length !== 12)
  throw Error("Fixture requires twelve finalized matches");
const provenance = benchmarkProvenance(job, {
  workers: [1],
  evidenceMode: "native-full-analysis",
});
const runs: unknown[] = [];
let expected: string | undefined;
for (let repeat = 0; repeat < 3; repeat++) {
  const session = path.join(output, `repeat-${repeat}`);
  for (const item of matches)
    await cp(
      path.join(source, "matches", item.match.id),
      path.join(session, "matches", item.match.id),
      {
        recursive: true,
        filter: (file) =>
          !file.endsWith(`${path.sep}native${path.sep}done.json`),
      },
    );
  const stages = [];
  for (const stage of ["publish", "resume"]) {
    const cpu = process.cpuUsage(),
      start = performance.now();
    const results = [];
    for (const item of matches)
      results.push(
        await finalizedEvidence(session, `matches/${item.match.id}`, {
          match: item.match.id,
          executionIdentity: job.identity,
          fixtureIdentity: job.fixtureIdentity,
          candidateIdentity: job.candidateIdentity,
          opponentIdentity: item.identities[1]!,
          item,
        }),
      );
    const ms = performance.now() - start;
    const fingerprint = identity(results);
    if (expected !== undefined && expected !== fingerprint)
      throw Error("Analysis results changed between stages");
    expected = fingerprint;
    stages.push({
      stage,
      ms,
      cpu: process.cpuUsage(cpu),
      rss: process.memoryUsage().rss,
      fingerprint,
      events: results.reduce((n, r) => n + r.events.length, 0),
      losses: results.reduce(
        (n, r) => n + r.outcomes.filter((outcome) => outcome === "loss").length,
        0,
      ),
    });
  }
  runs.push({ repeat, stages });
  await writeFile(
    path.join(output, "measurements.json"),
    JSON.stringify(
      {
        provenance,
        matches: matches.length,
        limitation:
          "Single-process twelve-match analysis publication/resume only. Fixture copying and provenance capture excluded; no simulation or analyst/replay work measured.",
        runs,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ repeat, stages }));
}
