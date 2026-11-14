/** Native-format fixed-work measurement and zero-replay completion verification. */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  benchmarkInputs,
  createBenchmarkSession,
} from "./benchmark-session.ts";
import { prepareTypescriptJob } from "./run-typescript-matches.ts";
import { runTypescriptNative } from "./run-typescript-native.ts";
import { gameplayFingerprint } from "./batch-benchmark.ts";
export async function benchmarkTypescriptRun(options: {
  session: string;
  out: string;
  workers: number;
  matches: number;
  batchSize: number;
}) {
  await mkdir(options.out, { recursive: true });
  const session = await createBenchmarkSession(
    await benchmarkInputs(options.session),
    path.join(options.out, "source"),
  );
  const { job } = await prepareTypescriptJob(session, options.matches);
  const config = {
    job,
    out: path.join(options.out, "evaluation"),
    workers: options.workers,
    maxWallMs: 600000,
  };
  const run = await runTypescriptNative(config);
  if (
    run.status !== "completed" ||
    run.completedGames !== options.matches * 4 ||
    run.failedGames ||
    run.skippedGames
  )
    throw Error("Incomplete native benchmark");
  const fingerprint = await gameplayFingerprint(run.output, true),
    verified = await runTypescriptNative({ ...config, resume: true });
  if (
    verified.completedGames !== run.completedGames ||
    verified.reservedGames !== run.reservedGames
  )
    throw Error("Native resume changed consumption");
  const result = {
    runner: "typescript",
    workers: run.workers,
    matches: options.matches,
    wallMs: run.elapsedMs,
    gamesPerSecond: run.gamesPerSecond,
    fingerprint,
    output: run.output,
    peakRssBytes: run.processTreePeakRssBytes,
  };
  await writeFile(
    path.join(options.out, "measurement.json"),
    JSON.stringify(result, null, 2),
  );
  return result;
}
