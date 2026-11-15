/** One measured replay stage inside a recovery-owned attempt directory. */
import path from "node:path";
import { runReplayPool } from "./run-replay-pool.ts";
import { identity } from "./session-fixtures.ts";
export async function replayCalibrationStage(
  request: string,
  workers: number,
  output: string,
  batchSize: number,
) {
  const result = await runReplayPool({
    request,
    out: path.join(output, "replays"),
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
  const run = {
    workers,
    cases: result.complete,
    elapsedMs: result.elapsedMs,
    wallMs: result.elapsedMs,
    casesPerSecond: result.complete / (result.elapsedMs / 1000),
    branchAttempts: result.branchAttempts,
    fingerprint,
    output: path.resolve(output, "replays"),
  };
  return run;
}
