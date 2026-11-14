const json = async (file: string) => JSON.parse(await readFile(file, "utf8"));
import { prepareMatches } from "../prepare-match-job.ts";
import { runProcess, matchOptions } from "../match-process.ts";
export { prepareMatches } from "../prepare-match-job.ts";
export {
  runProcess,
  matchOptions,
  interruptActiveProcess,
} from "../match-process.ts";
import { readFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import type { ExecutionAttempt } from "../session-control-contract.ts";
import { optionalJson } from "../session-checkpoint.ts";
import {
  writeOutput,
  ensureSessionOutput,
  findOutputRoot,
  storageStatus,
} from "../output-storage.ts";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { digest, identity } from "../session-fixtures.ts";
import { bindMatches, sessionControl } from "../match-session.ts";
import { resolveWorkers } from "../match-workers.ts";

export async function executeMatches(
  options: Parameters<typeof prepareMatches>[0] & {
    out: string;
    workers: string;
    resume?: boolean | undefined;
    binary?: string | undefined;
    iteration?: number | undefined;
    role?: "control" | "candidate" | undefined;
    stopSource?: { path: string; acknowledged: string | null } | undefined;
  },
) {
  const storagePause = async () => {
    const session = path.resolve(options.session),
      output = path.resolve(options.out);
    const report = await sessionControl(session, { action: "report" });
    const previous = await optionalJson(path.join(output, "result.json"));
    const ledger = await optionalJson(path.join(session, "control.json"));
    const iteration = options.iteration ?? report.iteration;
    const role = options.role ?? (options.candidate ? "candidate" : "control");
    const prefix = path.relative(session, output) + path.sep;
    const acknowledged = new Set<string>();
    for (const attempt of (ledger?.attempts ?? []) as ExecutionAttempt[]) {
      if (attempt.iteration !== iteration || attempt.role !== role) continue;
      for (const game of attempt.games)
        if (path.normalize(game.evidence.path).startsWith(prefix))
          acknowledged.add(`${attempt.match}/${game.number}`);
    }
    return {
      ...(previous ?? {
        schemaVersion: 1,
        completedGames: acknowledged.size,
        failedGames: null,
        skippedGames: null,
        matches: null,
        countsFromCheckpoint: true,
      }),
      status: "interrupted",
      exitCode: 2,
      stoppingReason: report.stoppingReason ?? "max-output-bytes",
      report: path.join(session, "report.json"),
      output,
      receipt: null,
      iteration: options.iteration ?? report.iteration,
      role: options.role ?? (options.candidate ? "candidate" : "control"),
    };
  };
  let binding: Awaited<ReturnType<typeof bindMatches>>;
  try {
    await ensureSessionOutput(path.resolve(options.session));
    const scope = await findOutputRoot(
      path.join(options.session, ".budget-probe"),
    );
    if (scope && (await storageStatus(scope)).exhausted)
      throw Object.assign(Error("Run output limit exhausted"), {
        code: "MAX_OUTPUT_BYTES",
      });
    if (options.workers === "auto" && !options.resume) {
      try {
        await resolveWorkers("auto", 64, 64);
      } catch {
        const calibration = path.join(
          path.resolve(options.session),
          `calibration-${Date.now()}`,
        );
        const code = await runProcess(process.execPath, [
          "scripts/bot-improvement/archive/calibrate-match-workers.ts",
          "--session",
          options.session,
          "--out",
          calibration,
        ]);
        if (code !== 0)
          throw new Error(
            `Worker calibration failed (${code}): ${calibration}`,
          );
      }
    }
    binding = await bindMatches({
      ...options,
      fallbackRunnerIdentity: "frozen-rust-match-pool/v1",
      role: options.role ?? (options.candidate ? "candidate" : "control"),
    });
  } catch (error) {
    const scope = await findOutputRoot(
      path.join(options.session, ".budget-probe"),
    );
    if (
      (error as NodeJS.ErrnoException).code === "MAX_OUTPUT_BYTES" ||
      (scope && (await storageStatus(scope)).exhausted)
    )
      return storagePause();
    throw error;
  }
  try {
    const {
      job: prepared,
      bound,
      totalMatches,
    } = await prepareMatches({
      ...options,
      accepted: binding.accepted,
    });
    if (
      prepared.selfIdentity !== binding.selfIdentity ||
      (binding.role === "control" &&
        prepared.candidateIdentity !== binding.accepted.bot.identity)
    )
      throw new Error("Prepared iteration control/self identity mismatch");
    const job = {
      ...prepared,
      storage: { root: binding.session },
      sessionControl: {
        session: binding.session,
        iteration: binding.iteration,
        role: binding.role,
        runnerIdentity: binding.runnerIdentity,
        executableIdentity: prepared.candidateIdentity,
        ...(options.maxGames === undefined
          ? {}
          : { maxGamesOverride: options.maxGames }),
        ...(options.maxWallMs === undefined
          ? {}
          : { maxWallMsOverride: options.maxWallMs }),
        ...(options.stopSource ? { stopSource: options.stopSource } : {}),
      },
    };
    const plan = await sessionControl(binding.session, {
      action: "start",
      iteration: binding.iteration,
    });
    if (!plan.mayStart && !options.resume)
      throw new Error(`Session stopped: ${plan.stoppingReason}`);
    const workers = await resolveWorkers(
      options.workers,
      job.matches.length,
      bound,
    );
    const output = path.resolve(options.out);
    // Preparation files have a separate exclusive owner, never collide with pool output/resume.
    await mkdir(path.dirname(output), { recursive: true });
    const lock = `${output}.prepare-lock`;
    await mkdir(lock);
    try {
      const file = `${output}.job.json`;
      if (options.resume) {
        if (identity(await json(file)) !== identity(job))
          throw new Error("Resume preparation identity mismatch");
      } else {
        await writeOutput(file, JSON.stringify(job), true);
      }
      const binary =
        options.binary ??
        path.resolve(
          "tools/bot-evaluation/target/release/ascencio-bot-evaluation",
        );
      const code = await runProcess(binary, [
        "frozen-legacy",
        "--job",
        file,
        "--out",
        output,
        "--workers",
        String(workers),
        ...(options.resume ? ["--resume"] : []),
      ]);
      const result = await json(path.join(output, "result.json"));
      const settledPlan = await sessionControl(binding.session, {
        action: "plan",
      });
      let receipt: string | null = null;
      if (
        code === 0 &&
        job.matches.length === totalMatches &&
        result.completedGames + (result.failures?.timeout ?? 0) ===
          totalMatches * 4 &&
        result.failedGames === (result.failures?.timeout ?? 0) &&
        result.skippedGames === 0 &&
        binding.role === "control"
      ) {
        const matches: Record<string, { path: string; sha256: string }> = {};
        for (const item of job.matches) {
          const file = `matches/${item.match.id}/done.json`;
          matches[item.match.id] = {
            path: file,
            sha256: digest(await readFile(path.join(output, file))),
          };
        }
        receipt = path.join(output, "baseline-receipt.json");
        await writeOutput(
          receipt,
          JSON.stringify(
            {
              schemaVersion: 1,
              comparisonIdentity: binding.comparisonIdentity,
              status: "complete",
              completedMatches: job.matches.map((m) => m.match.id),
              matches,
            },
            null,
            2,
          ),
        );
      }
      const suspensionReport = settledPlan.stoppingReason
        ? await sessionControl(binding.session, { action: "report" })
        : null;
      return {
        ...result,
        receipt,
        report: suspensionReport
          ? path.join(binding.session, "report.json")
          : null,
        stoppingReason: settledPlan.stoppingReason,
        exitCode: code,
        output,
        iteration: binding.iteration,
        role: binding.role,
      };
    } finally {
      await rm(lock, { recursive: true, force: true });
    }
  } catch (error) {
    const scope = await findOutputRoot(
      path.join(options.session, ".budget-probe"),
    );
    if (
      (error as NodeJS.ErrnoException).code !== "MAX_OUTPUT_BYTES" &&
      !(scope && (await storageStatus(scope)).exhausted)
    )
      throw error;
    return storagePause();
  } finally {
    await binding.release();
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { values: v } = parseArgs({ options: matchOptions });
  if (!v.session || !v.out)
    throw new Error(
      "--session and --out required; optional --workers auto|N --candidate SNAPSHOT.json --self SNAPSHOT.json --limits LIMITS.json --resume",
    );
  if (
    await runProcess("cargo", [
      "build",
      "--release",
      "--manifest-path",
      "tools/bot-evaluation/Cargo.toml",
    ])
  )
    throw new Error("Evaluator build failed");
  if (v.role && !["control", "candidate"].includes(v.role))
    throw new Error("Role must be control or candidate");
  const result = await executeMatches({
    session: v.session,
    out: v.out,
    workers: v.workers,
    matchCount: v.matches ? Number(v.matches) : undefined,
    iteration: v.iteration ? Number(v.iteration) : undefined,
    role: v.role as "control" | "candidate" | undefined,
    candidate: v.candidate,
    self: v.self,
    limits: v.limits,
    resume: v.resume,
    maxGames: v["max-games"] ? Number(v["max-games"]) : undefined,
    maxWallMs: v["max-wall-ms"] ? Number(v["max-wall-ms"]) : undefined,
  });
  console.log(JSON.stringify(result));
  process.exitCode = result.exitCode;
}
