import {
  leaseBatchStorage,
  releaseBatchStorage,
} from "./batch-storage-lease.ts";
import {
  installReplayWriteGrant,
  refreshReplayWorker,
  replayWorkerRoot,
  clearReplayWriteGrants,
  replayWriteOutput as writeOutput,
} from "./replay-output-budget.ts";
/** Experimental replay pool; production reason orchestration remains unchanged. */
import { mkdir, readFile, readdir, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { availableParallelism } from "node:os";
import { parseArgs } from "node:util";
import { digest } from "./session-fixtures.ts";
import {
  configureOutputStorage,
  findOutputRoot,
  storageStatus,
} from "./output-storage.ts";
import { prepareReplayPool, verifyReplayPins } from "./prepare-replay-pool.ts";
import { replayWorkers } from "./replay-work-queue.ts";
import { replayProcess } from "./replay-pool-process.ts";
import type {
  ReplayPoolRow,
  ReplayCaseResult,
} from "./replay-pool-contract.ts";
async function optional(file: string) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
async function receipt(base: string) {
  const files: Record<string, string> = {};
  async function visit(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink())
        throw Error("Symlink replay output is unsupported");
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && entry.name !== "done.json")
        files[path.relative(base, file)] = digest(await readFile(file));
    }
  }
  await visit(base);
  return files;
}
export async function runReplayPool(options: {
  request: string;
  out: string;
  workers: number;
  batchSize?: number | undefined;
  maxWallMs?: number | undefined;
  caseTimeoutMs?: number | undefined;
  maxBytes?: number | undefined;
}) {
  const workers = options.workers,
    batchSize = options.batchSize ?? 1,
    maxWallMs = options.maxWallMs ?? 1_800_000,
    caseTimeoutMs = options.caseTimeoutMs ?? 630_000;
  if (
    ![workers, batchSize, maxWallMs, caseTimeoutMs].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    ) ||
    workers > availableParallelism() ||
    batchSize > 256
  )
    throw Error("Invalid replay workers, batch size or time limits");
  const output = path.resolve(options.out),
    startedAt = Date.now();
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(output);
  await configureOutputStorage(output, options.maxBytes ?? 20_000_000_000);
  const prepared = await prepareReplayPool(
    path.resolve(options.request),
    output,
  );
  const sourceControl = prepared.sourceRoot
    ? await optional(path.join(prepared.sourceRoot, "control.json"))
    : null;
  if (sourceControl?.stoppingReason)
    throw Error(`Source session is stopped: ${sourceControl.stoppingReason}`);
  if (
    prepared.sourceRoot &&
    (await optional(path.join(prepared.sourceRoot, ".batch-output-lease.json")))
      ?.active
  )
    throw Error("Finish the active evaluation before starting a replay pool");
  const storageRoot = (await findOutputRoot(path.join(output, ".probe")))!;
  const evaluation =
    storageRoot === output ? path.join(output, "payload") : output;
  const lease = await leaseBatchStorage(
    storageRoot,
    evaluation,
    false,
    options.maxBytes,
  );
  const grant = {
    root: lease.root,
    token: lease.token,
    evaluation: path.resolve(lease.root, lease.evaluation),
    output,
    workers: Math.min(workers, prepared.jobs.length),
  };
  try {
    await installReplayWriteGrant(grant);
    for (let worker = 1; worker <= grant.workers; worker++)
      await installReplayWriteGrant({ ...grant, worker });
    for (const variant of prepared.variants)
      await writeOutput(variant.file, variant.bytes, true);
    const deadline = Math.min(
      startedAt + maxWallMs,
      sourceControl?.startedAt && sourceControl?.limits?.maxWallMs
        ? sourceControl.startedAt + sourceControl.limits.maxWallMs
        : Number.MAX_SAFE_INTEGER,
    );
    const rows: ReplayPoolRow[] = prepared.jobs.map((job) => ({
      id: job.id,
      reason: job.reason,
      worker: 0,
      status: "pending",
      output: path.join(output, "reasons", job.reason, job.caseId),
      startedAt: 0,
    }));
    const byId = new Map(rows.map((row) => [row.id, row]));
    const controller = new AbortController();
    let stoppingReason: string | null = null;
    const stop = (reason: string) => {
      stoppingReason ??= reason;
      controller.abort();
    };
    const ownerStop = () => stop("owner-stop");
    process.on("SIGINT", ownerStop);
    process.on("SIGTERM", ownerStop);
    await writeOutput(
      path.join(output, "execution.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          experimental: true,
          requestSha256: prepared.requestSha256,
          workers,
          batchSize,
          maxWallMs,
          caseTimeoutMs,
          jobs: prepared.jobs,
        },
        null,
        2,
      ),
    );
    await writeOutput(
      path.join(output, "owners.json"),
      JSON.stringify({ pid: process.pid, startedAt }),
    );
    let serial: Promise<void> = Promise.resolve();
    const checkpoint = () => {
      const bytes = JSON.stringify({
        schemaVersion: 1,
        startedAt,
        stoppingReason,
        rows,
      });
      const next = serial
        .catch(() => {})
        .then(() => writeOutput(path.join(output, "progress.json"), bytes));
      serial = next;
      return next;
    };
    const checkStop = async () => {
      if (Date.now() >= deadline) stop("max-wall-ms");
      try {
        await lstat(path.join(output, "OWNER_STOP"));
        stop("owner-stop");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
      if (prepared.sourceRoot) {
        try {
          if (
            digest(
              await readFile(path.join(prepared.sourceRoot, "OWNER_STOP")),
            ) !== sourceControl?.acknowledgedMarker
          )
            stop("owner-stop");
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        }
      }
    };
    const monitor = setInterval(() => {
      void checkStop().catch(() => stop("monitor-failure"));
    }, 250);
    try {
      await checkStop();
      if ((await storageStatus(output)).exhausted) stop("max-output-bytes");
      await replayWorkers(
        prepared.jobs,
        workers,
        batchSize,
        controller.signal,
        async (job, worker) => {
          const row = byId.get(job.id)!;
          row.worker = worker;
          row.output = path.join(
            replayWorkerRoot(grant, worker),
            job.reason,
            job.caseId,
          );
          row.startedAt = Date.now();
          row.status = "running";
          try {
            await checkStop();
            if (controller.signal.aborted) {
              row.status = "cancelled";
              return;
            }
            await verifyReplayPins(job);
            await checkpoint();
            await mkdir(path.dirname(row.output), { recursive: true });
            console.error(`Replay worker ${worker}: ${job.id}`);
            const result = await replayProcess(
              job,
              row.output,
              Math.max(1, Math.min(caseTimeoutMs, deadline - Date.now())),
              controller.signal,
              { ...grant, worker },
            );
            await refreshReplayWorker(grant, worker);
            await mkdir(row.output, { recursive: true });
            await writeOutput(path.join(row.output, "runner.log"), result.text);
            if (result.timedOut && Date.now() >= deadline) stop("max-wall-ms");
            if (result.cancelled || controller.signal.aborted)
              row.status = "cancelled";
            else if (result.timedOut) {
              row.status = "ignored";
              row.error = "Replay case exceeded its wall limit";
              await writeOutput(
                path.join(row.output, "bug-report.json"),
                JSON.stringify({
                  status: "ignored",
                  category: "timeout",
                  case: job.id,
                  retry: false,
                }),
              );
            } else if (result.code !== 0)
              throw Error(
                `Replay process failed (${result.code}): ${result.text.slice(-4000)}`,
              );
            else {
              const value = (await optional(
                path.join(row.output, "result.json"),
              )) as ReplayCaseResult | null;
              if (
                !value ||
                !["complete", "ignored"].includes(value.status) ||
                value.game !== job.gameId ||
                value.actor !== job.actor ||
                value.decision !== job.decision
              )
                throw Error("Missing or mismatched replay result");
              row.result = value;
              row.status = value.status;
            }
            await verifyReplayPins(job);
            if (row.status === "complete" || row.status === "ignored")
              await writeOutput(
                path.join(row.output, "done.json"),
                JSON.stringify({
                  schemaVersion: 1,
                  id: job.id,
                  pins: job.pins,
                  files: await receipt(row.output),
                }),
              );
          } catch (e) {
            row.status = "failed";
            row.error = String(e);
            stop(
              String(e).includes("max-output-bytes")
                ? "max-output-bytes"
                : "failure",
            );
          } finally {
            row.finishedAt = Date.now();
            try {
              await checkpoint();
            } catch (e) {
              row.error = String(e);
              stop("checkpoint-failure");
            }
          }
        },
      );
    } finally {
      clearInterval(monitor);
      process.off("SIGINT", ownerStop);
      process.off("SIGTERM", ownerStop);
    }
    for (const row of rows)
      if (row.status === "pending") row.status = "cancelled";
    const reasonIds = [...new Set(rows.map((r) => r.reason))];
    const reasons = reasonIds.map((id) => {
      const cases = rows.filter((r) => r.reason === id);
      return {
        id,
        cases: cases.length,
        complete: cases.filter((r) => r.status === "complete").length,
        ignored: cases.filter((r) => r.status === "ignored").length,
        converted: cases.filter(
          (r) => r.result?.convertedLossToWin && r.result.choiceChanged,
        ).length,
      };
    });
    const branchAttempts = { control: 0, alternative: 0 };
    for (const row of rows) {
      const attempts = await optional(path.join(row.output, "attempts.json"));
      for (const name of attempts?.started ?? []) {
        if (name === "control" || name === "alternative")
          branchAttempts[name as "control" | "alternative"]++;
      }
    }
    const result = {
      schemaVersion: 1,
      experimental: true,
      branchAttempts,
      status: stoppingReason ? "interrupted" : "complete",
      stoppingReason,
      workers: Math.min(workers, prepared.jobs.length),
      batchSize,
      elapsedMs: Date.now() - startedAt,
      complete: rows.filter((r) => r.status === "complete").length,
      ignored: rows.filter((r) => r.status === "ignored").length,
      failed: rows.filter((r) => r.status === "failed").length,
      cancelled: rows.filter((r) => r.status === "cancelled").length,
      reasons,
      rows,
    };
    await checkpoint();
    await writeOutput(
      path.join(output, "result.json"),
      JSON.stringify(result, null, 2),
    );
    return result;
  } finally {
    clearReplayWriteGrants();
    await releaseBatchStorage(storageRoot, lease.token);
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { values: v } = parseArgs({
    options: {
      request: { type: "string" },
      out: { type: "string" },
      workers: { type: "string", default: "2" },
      "batch-size": { type: "string", default: "1" },
      "max-wall-ms": { type: "string" },
      "case-timeout-ms": { type: "string" },
      "max-bytes": { type: "string" },
    },
  });
  if (!v.request || !v.out)
    throw Error(
      "--request REQUEST.json --out NEW_DIRECTORY [--workers N --batch-size N] required",
    );
  const result = await runReplayPool({
    request: v.request,
    out: v.out,
    workers: Number(v.workers),
    batchSize: Number(v["batch-size"]),
    maxWallMs: v["max-wall-ms"] ? Number(v["max-wall-ms"]) : undefined,
    caseTimeoutMs: v["case-timeout-ms"]
      ? Number(v["case-timeout-ms"])
      : undefined,
    maxBytes: v["max-bytes"] ? Number(v["max-bytes"]) : undefined,
  });
  console.log(JSON.stringify(result));
  process.exitCode = result.status === "complete" ? 0 : 2;
}
