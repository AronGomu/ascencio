/** Paired short workloads; verify gameplay, not timing-dependent evidence hashes. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { benchmarkBehavior } from "./benchmark-behavior.ts";
import {
  benchmarkInputs,
  createBenchmarkSession,
} from "./benchmark-session.ts";
import { executeMatches } from "./archive/run-matches.ts";
import { executeBatch, batchBinary } from "./run-batch-matches.ts";
import { identity } from "./session-fixtures.ts";
export async function gameplayFingerprint(output: string, batch: boolean) {
  const index: Record<string, string> = batch
    ? JSON.parse(await readFile(path.join(output, "matches.json"), "utf8"))
    : Object.fromEntries(
        JSON.parse(await readFile(`${output}.job.json`, "utf8")).matches.map(
          (m: { match: { id: string } }) => [
            m.match.id,
            `matches/${m.match.id}`,
          ],
        ),
      );
  const rows = [];
  for (const id of Object.keys(index).sort()) {
    const worker = batch ? path.dirname(path.dirname(index[id]!)) : ".";
    rows.push([id, await benchmarkBehavior(path.join(output, worker), [id])]);
  }
  return identity(rows);
}
export async function benchmarkRun(options: {
  session: string;
  out: string;
  workers: number;
  matches: number;
  batchSize: number;
  legacy?: boolean;
}) {
  const output = path.resolve(options.out);
  await mkdir(output, { recursive: true });
  const inputs = await benchmarkInputs(options.session);
  const session = await createBenchmarkSession(
    inputs,
    path.join(output, "source"),
  );
  const begin = performance.now();
  const run = options.legacy
    ? await executeMatches({
        session,
        out: path.join(session, "evaluation"),
        workers: String(options.workers),
        matchCount: options.matches,
        binary: batchBinary,
      })
    : await executeBatch({
        session,
        out: path.join(output, "evaluation"),
        workers: options.workers,
        matches: options.matches,
        batchSize: options.batchSize,
      });
  const wallMs = performance.now() - begin;
  if (
    run.exitCode !== 0 ||
    run.status !== "completed" ||
    run.completedGames !== options.matches * 4 ||
    run.failedGames !== 0 ||
    run.skippedGames !== 0
  )
    throw Error(`Incomplete benchmark: ${JSON.stringify(run)}`);
  const fingerprint = await gameplayFingerprint(run.output, !options.legacy);
  // Resume exercises every completion marker through the runner's integrity checks.
  const verified = options.legacy
    ? await executeMatches({
        session,
        out: run.output,
        workers: String(options.workers),
        matchCount: options.matches,
        binary: batchBinary,
        resume: true,
      })
    : await executeBatch({
        session,
        out: run.output,
        workers: options.workers,
        matches: options.matches,
        batchSize: options.batchSize,
        resume: true,
      });
  if (verified.exitCode !== 0 || verified.completedGames !== run.completedGames)
    throw Error("Resume evidence verification failed");
  const result = {
    runner: options.legacy ? "legacy" : "batch",
    workers: run.workers as number,
    matches: options.matches,
    completedGames: run.completedGames,
    wallMs,
    gamesPerSecond: run.completedGames / (wallMs / 1000),
    fingerprint,
    peakRssBytes: run.processTreePeakRssBytes,
    output: run.output,
  };
  await writeFile(
    path.join(output, "measurement.json"),
    JSON.stringify(result, null, 2),
  );
  return result;
}
