import { verifyCalibrationReport } from "./calibration-evidence.ts";
import { writeOutput } from "./output-storage.ts";
/** Opt-in standalone batch runner. Never mutates an improvement session ledger. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { prepareMatches } from "./prepare-match-job.ts";
import { runProcess } from "./match-process.ts";
import { digest, identity } from "./session-fixtures.ts";
export const batchBinary = path.resolve(
  ".tmp/batch-runner-build/release/ascencio-bot-evaluation",
);
export async function buildBatchRunner() {
  if (
    await runProcess("cargo", [
      "build",
      "--release",
      "--manifest-path",
      "tools/bot-evaluation/Cargo.toml",
      "--target-dir",
      ".tmp/batch-runner-build",
    ])
  )
    throw Error("Batch runner build failed");
}
export async function calibrationIdentity(
  binary: string,
  fixture: string,
  batchSize: number,
) {
  return identity({
    machine: os.hostname(),
    kernel: os.release(),
    node: process.version,
    memoryBytes: os.totalmem(),
    platform: process.platform,
    arch: process.arch,
    cpu: os.cpus()[0]?.model,
    logical: os.availableParallelism(),
    binary: digest(await readFile(binary)),
    fixture,
    batchSize,
  });
}
export const batchRecommendation = path.resolve(
  ".cache/batch-runner-workers.json",
);
export async function executeBatch(options: {
  session: string;
  out: string;
  workers: number | "auto";
  matches?: number | undefined;
  candidate?: string | undefined;
  self?: string | undefined;
  batchSize?: number | undefined;
  binary?: string | undefined;
  maxGames?: number | undefined;
  maxWallMs?: number | undefined;
  maxBytes?: number | undefined;
  resume?: boolean | undefined;
  stopFile?: string | undefined;
}) {
  const batchSize = options.batchSize ?? 4,
    binary = options.binary ?? batchBinary;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 256)
    throw Error("Batch size must be 1–256");
  if (
    options.maxBytes !== undefined &&
    (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 16_000_000)
  )
    throw Error("Output allowance must be an integer above 16000000 bytes");
  // Resume uses its original prepared job; validation still runs before execution.
  const state = JSON.parse(
    await readFile(path.join(options.session, "state.json"), "utf8"),
  );
  const config = JSON.parse(
    await readFile(path.join(options.session, "config.json"), "utf8"),
  );
  const initialPath = path.resolve(config.fixture.path, "versions/initial");
  const bot =
    path.resolve(state.accepted.path) === initialPath
      ? JSON.parse(
          await readFile(
            path.join(config.fixture.path, "manifest.json"),
            "utf8",
          ),
        ).target
      : JSON.parse(
          await readFile(
            path.join(state.accepted.path, "frozen-bot.json"),
            "utf8",
          ),
        );
  if (bot.identity !== state.accepted.identity)
    throw Error("Accepted snapshot identity changed");
  const { job } = await prepareMatches({
    session: options.session,
    candidate: options.candidate,
    self: options.self,
    accepted: { schemaVersion: 1, path: state.accepted.path, bot },
    matchCount: options.matches,
    maxGames: options.maxGames,
    maxWallMs: options.maxWallMs,
  });
  const effective = {
    ...job,
    batchStorageBytes: options.maxBytes ?? 20_000_000_000,
    ...(options.stopFile ? { stopFile: path.resolve(options.stopFile) } : {}),
  };
  let workers: number;
  if (options.workers === "auto") {
    const saved = JSON.parse(await readFile(batchRecommendation, "utf8"));
    if (
      saved.identity !==
      (await calibrationIdentity(binary, job.fixtureIdentity, batchSize))
    )
      throw Error("Batch calibration is stale; run bot:batch:calibrate");
    await verifyCalibrationReport(saved);
    workers = saved.workers;
  } else workers = options.workers;
  if (
    !Number.isSafeInteger(workers) ||
    workers < 1 ||
    workers > os.availableParallelism()
  )
    throw Error("Workers must be within available logical CPUs");
  return executePreparedBatch(effective, {
    ...options,
    workers,
    batchSize,
    binary,
  });
}
function preparedBatchIdentity(value: Record<string, unknown>) {
  const copy = structuredClone(value);
  if (
    copy.sessionBinding &&
    copy.stopSource &&
    typeof copy.stopSource === "object"
  )
    delete (copy.stopSource as Record<string, unknown>).acknowledged;
  return identity(copy);
}
export async function executePreparedBatch(
  effective: Record<string, unknown>,
  options: {
    out: string;
    workers: number;
    batchSize: number;
    binary: string;
    resume?: boolean | undefined;
  },
) {
  const output = path.resolve(options.out),
    workers = options.workers,
    batchSize = options.batchSize,
    binary = options.binary;
  await mkdir(path.dirname(output), { recursive: true });
  const file = `${output}.${effective.sessionBinding ? "batch-job" : "job"}.json`;
  if (options.resume) {
    const previous = JSON.parse(await readFile(file, "utf8"));
    if (preparedBatchIdentity(previous) !== preparedBatchIdentity(effective))
      throw Error("Prepared batch resume inputs changed");
    if (effective.sessionBinding && identity(previous) !== identity(effective))
      await writeOutput(file, JSON.stringify(effective));
  } else if (effective.sessionBinding)
    await writeOutput(file, JSON.stringify(effective), true);
  else await writeFile(file, JSON.stringify(effective), { flag: "wx" });
  const begin = performance.now();
  const exitCode = await runProcess(binary, [
    "batch",
    "--job",
    file,
    "--out",
    output,
    "--workers",
    String(workers),
    "--batch-size",
    String(batchSize),
    ...(options.resume ? ["--resume"] : []),
  ]);
  if (exitCode !== 0 && exitCode !== 2)
    throw Error(`Batch execution failed (${exitCode})`);
  const result = JSON.parse(
    await readFile(path.join(output, "result.json"), "utf8"),
  );
  return {
    ...result,
    exitCode,
    output,
    processWallMs: performance.now() - begin,
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { values: v } = parseArgs({
    options: {
      session: { type: "string" },
      out: { type: "string" },
      workers: { type: "string", default: "auto" },
      matches: { type: "string" },
      candidate: { type: "string" },
      self: { type: "string" },
      "batch-size": { type: "string", default: "4" },
      "max-games": { type: "string" },
      "max-wall-ms": { type: "string" },
      "max-bytes": { type: "string" },
      "stop-file": { type: "string" },
      resume: { type: "boolean" },
    },
  });
  if (!v.session || !v.out)
    throw Error("--session SOURCE --out INDEPENDENT_DIRECTORY required");
  await buildBatchRunner();
  const result = await executeBatch({
    session: v.session,
    out: v.out,
    workers: v.workers === "auto" ? "auto" : Number(v.workers),
    candidate: v.candidate,
    self: v.self,
    batchSize: Number(v["batch-size"]),
    matches: v.matches ? Number(v.matches) : undefined,
    maxGames: v["max-games"] ? Number(v["max-games"]) : undefined,
    maxWallMs: v["max-wall-ms"] ? Number(v["max-wall-ms"]) : undefined,
    maxBytes: v["max-bytes"] ? Number(v["max-bytes"]) : undefined,
    stopFile: v["stop-file"],
    resume: v.resume,
  });
  console.log(JSON.stringify(result));
  process.exitCode = result.exitCode;
}
