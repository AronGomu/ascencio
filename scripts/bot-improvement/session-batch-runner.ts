import {
  runTypescriptNative,
  nativeRuntimeIdentity,
} from "./run-typescript-native.ts";
import {
  typescriptCalibrationIdentity,
  typescriptRecommendation,
} from "./typescript-calibration.ts";
/** Default improvement-session adapter: allocate once, execute independently, reconcile once. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  bindMatches,
  sessionControl,
  matchRunnerIdentity,
  rustMatchRunnerIdentity,
} from "./match-session.ts";
import { prepareMatches } from "./prepare-match-job.ts";
import { runProcess } from "./match-process.ts";
import {
  batchBinary,
  buildBatchRunner,
  calibrationIdentity,
  batchRecommendation,
  executePreparedBatch,
} from "./run-batch-matches.ts";
import {
  reserveBatchBudget,
  settleBatchBudget,
} from "./batch-session-accounting.ts";
import {
  leaseBatchStorage,
  releaseBatchStorage,
} from "./batch-storage-lease.ts";
import { ensureSessionOutput, writeOutput } from "./output-storage.ts";
import { digest, identity } from "./session-fixtures.ts";
import { availableParallelism } from "node:os";
export type MatchOptions = Parameters<typeof prepareMatches>[0] & {
  backend?: "typescript" | "rust";
  out: string;
  workers: string;
  resume?: boolean | undefined;
  binary?: string | undefined;
  iteration?: number | undefined;
  role?: "control" | "candidate" | undefined;
  batchSize?: number | undefined;
  stopSource?: { path: string; acknowledged: string | null } | undefined;
};
async function json(file: string) {
  return JSON.parse(await readFile(file, "utf8"));
}
async function workersFor(
  options: MatchOptions,
  binary: string,
  fixture: string,
  batchSize: number,
  bound: number,
  count: number,
) {
  const native =
    (options.backend ?? (options.binary ? "rust" : "typescript")) ===
    "typescript";
  let workers = Number(options.workers);
  if (options.workers === "auto") {
    const config = await json(path.join(options.session, "config.json"));
    const manifest = await json(
      path.join(config.fixture.path, "manifest.json"),
    );
    const allowed = Math.min(
      bound,
      count,
      availableParallelism(),
      manifest.matches.length,
    );
    if (allowed < 2) return 1;
    const load = async () => {
      const saved = await json(
        native ? typescriptRecommendation : batchRecommendation,
      );
      if (
        !Number.isSafeInteger(saved.workers) ||
        saved.workers < 1 ||
        saved.workers > allowed ||
        Math.max(...saved.stages.map((s: { workers: number }) => s.workers)) <
          allowed ||
        saved.identity !==
          (native
            ? await typescriptCalibrationIdentity(fixture, batchSize)
            : await calibrationIdentity(binary, fixture, batchSize))
      )
        throw Error("Stale batch worker calibration");
      return saved.workers as number;
    };
    try {
      workers = await load();
    } catch {
      const out = path.resolve(".tmp", `batch-calibration-${randomUUID()}`);
      if (
        await runProcess(process.execPath, [
          "--no-lazy",
          "--no-wasm-lazy-compilation",
          "--no-liftoff",
          "scripts/bot-improvement/calibrate-batch-workers.ts",
          "--backend",
          native ? "typescript" : "rust",
          "--session",
          options.session,
          "--out",
          out,
          "--batch-size",
          String(batchSize),
          "--worker-counts",
          Array.from({ length: allowed - 1 }, (_, i) => i + 2).join(","),
        ])
      )
        throw Error("Batch worker calibration failed");
      workers = await load();
    }
  }
  if (
    !Number.isSafeInteger(workers) ||
    workers < 1 ||
    workers > availableParallelism()
  )
    throw Error("Workers must be auto or within available logical CPUs");
  return Math.min(workers, bound, count, availableParallelism());
}
export async function executeMatches(options: MatchOptions) {
  const session = path.resolve(options.session),
    output = path.resolve(options.out),
    binary = options.binary ?? batchBinary,
    batchSize = options.batchSize ?? 1;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 256)
    throw Error("Batch size must be 1–256");
  const native =
    (options.backend ?? (options.binary ? "rust" : "typescript")) ===
    "typescript";
  const runtime = native ? await nativeRuntimeIdentity() : undefined;
  if (!native && !options.binary) await buildBatchRunner();
  const config = await json(path.join(session, "config.json"));
  const workers = await workersFor(
    options,
    binary,
    config.fixture.identity,
    batchSize,
    config.limits.matchWorkers,
    options.matchCount ?? Number.MAX_SAFE_INTEGER,
  );
  await ensureSessionOutput(session);
  const binding = await bindMatches({
    ...options,
    session,
    runnerIdentity: native ? matchRunnerIdentity : rustMatchRunnerIdentity,
    role: options.role ?? (options.candidate ? "candidate" : "control"),
  });
  let lease: Awaited<ReturnType<typeof leaseBatchStorage>> | undefined;
  try {
    const plan = await sessionControl(session, {
      action: "start",
      iteration: binding.iteration,
    });
    if (!plan.mayStart)
      throw Error(
        `Session stopped: ${plan.stoppingReason}; continue it before resume`,
      );
    const { job: prepared, totalMatches } = await prepareMatches({
      ...options,
      session,
      accepted: binding.accepted,
    });
    if (
      prepared.selfIdentity !== binding.selfIdentity ||
      (binding.role === "control" &&
        prepared.candidateIdentity !== binding.accepted.bot.identity)
    )
      throw Error("Batch control/self binding mismatch");
    const admission = await reserveBatchBudget(
      binding,
      output,
      prepared.candidateIdentity,
      !!options.resume,
      options.maxGames,
    );
    const bindingInfo = {
      session,
      iteration: binding.iteration,
      role: binding.role,
      runnerIdentity: binding.runnerIdentity,
      executableIdentity: prepared.candidateIdentity,
    };
    prepared.budget.maxGames = admission.allocation.gameCeiling;
    prepared.budget.maxWallMs ??= Number.MAX_SAFE_INTEGER;
    prepared.identity = identity({
      fixtureIdentity: prepared.fixtureIdentity,
      candidateIdentity: prepared.candidateIdentity,
      selfIdentity: prepared.selfIdentity,
      profile: prepared.profile,
      limits: prepared.limits,
      budget: prepared.budget,
      matches: prepared.matches.map(({ match, decks, identities }) => ({
        match,
        decks,
        identities,
      })),
    });
    const publicJob = {
      ...prepared,
      budget: {
        ...prepared.budget,
        maxGames: admission.allocation.gameCeiling,
      },
      sessionControl: bindingInfo,
    };
    const publicFile = `${output}.job.json`;
    if (options.resume) {
      if (identity(await json(publicFile)) !== identity(publicJob))
        throw Error("Session resume preparation changed");
    } else await writeOutput(publicFile, JSON.stringify(publicJob), true);
    lease = await leaseBatchStorage(
      session,
      output,
      !!options.resume,
      undefined,
      8_000_000 + Buffer.byteLength(JSON.stringify(publicJob)) * 2 + 65536,
    );
    const stopSource = options.stopSource ?? {
      path: path.join(session, "OWNER_STOP"),
      acknowledged:
        (await json(path.join(session, "control.json"))).acknowledgedMarker ??
        null,
    };
    const job = {
      ...prepared,
      budget: {
        ...prepared.budget,
        maxGames: admission.allocation.gameCeiling,
      },
      batchStorageBytes: lease.maxBytes,
      coordinatorReserveBytes: Math.max(
        16_000_000,
        Buffer.byteLength(JSON.stringify(publicJob, null, 2)) + 2_000_000,
      ),
      sessionBinding: bindingInfo,
      publicExecutionPath: publicFile,
      publicExecutionHash: digest(Buffer.from(JSON.stringify(publicJob))),
      storageLease: { token: lease.token },
      sessionDeadlineMs:
        admission.maxWallMs === undefined
          ? Number.MAX_SAFE_INTEGER
          : admission.startedAt + admission.maxWallMs,
      stopSource,
    };
    const run = native
      ? await runTypescriptNative({
          job,
          out: output,
          workers: Math.min(workers, prepared.matches.length),
          resume: !!options.resume,
          runtimeIdentity: runtime!,
          sessionLease: {
            root: lease.root,
            token: lease.token,
            maxBytes: lease.maxBytes,
            publicExecutionPath: publicFile,
            publicExecutionHash: job.publicExecutionHash,
            deadlineMs: job.sessionDeadlineMs,
            stopSource,
          },
        })
      : await executePreparedBatch(job, {
          out: output,
          workers: Math.min(workers, prepared.matches.length),
          batchSize,
          binary,
          resume: options.resume,
        });
    // Stop writers before releasing their shared allowance. Failed launch leaves the lease held.
    const storageRoot = lease.root;
    await releaseBatchStorage(session, lease.token);
    lease = undefined;
    await settleBatchBudget(binding, output);
    let receipt: string | null = null;
    if (
      run.exitCode === 0 &&
      prepared.matches.length === totalMatches &&
      binding.role === "control"
    ) {
      const matches: Record<string, { path: string; sha256: string }> = {};
      for (const item of prepared.matches) {
        const relative = `matches/${item.match.id}/done.json`;
        matches[item.match.id] = {
          path: relative,
          sha256: digest(await readFile(path.join(output, relative))),
        };
      }
      receipt = path.join(output, "baseline-receipt.json");
      await writeOutput(
        receipt,
        JSON.stringify({
          schemaVersion: 1,
          comparisonIdentity: binding.comparisonIdentity,
          status: "complete",
          completedMatches: prepared.matches.map((m) => m.match.id),
          matches,
        }),
      );
    }
    if (run.stoppingReason === "max-output-bytes")
      await writeOutput(
        path.join(storageRoot, ".storage-stop"),
        "max-output-bytes\n",
      );
    if (run.status !== "completed" || run.exitCode !== 0)
      await sessionControl(session, {
        action: "stop",
        reason:
          run.stoppingReason === "cancelled" ? "owner-stop" : "interrupted",
      });
    const settled = await sessionControl(session, { action: "plan" });
    const report = settled.stoppingReason
      ? await sessionControl(session, { action: "report" })
      : null;
    return {
      ...run,
      receipt,
      report: report ? path.join(session, "report.json") : null,
      iteration: binding.iteration,
      role: binding.role,
      stoppingReason: settled.stoppingReason ?? run.stoppingReason,
    };
  } finally {
    if (lease && native) await releaseBatchStorage(session, lease.token);
    await binding.release();
  }
}
