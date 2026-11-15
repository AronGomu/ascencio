import { watch } from "node:fs";
import { analysisScope } from "./analysis-scope.ts";
import { ensureSessionOutput } from "./output-storage.ts";
import { writeOutput } from "./output-storage.ts";
/** Event-driven bounded evaluation/analysis coordinator; durable claims remain owned by slice tools. */
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ownedOperation } from "./operation-status.ts";
import { prepareAnalysisSlices } from "./analysis-slices.ts";
import { digest } from "./session-fixtures.ts";
export interface PipelineSnapshot {
  pending: number;
  preparationComplete: boolean;
  selectedReviewComplete: boolean;
  fullCoverage: boolean;
}
export interface PipelineOptions<Claim> {
  maxWallMs: number;
  analystSlots: number;
  preparationSlots: number;
  maxPendingSlices: number;
  reconcileMs?: number;
  shutdownGraceMs?: number;
  signal?: AbortSignal;
  evaluate: (signal: AbortSignal, published: () => void) => Promise<unknown>;
  sync: (signal: AbortSignal, maxSlices: number) => Promise<PipelineSnapshot>;
  claim: (owner: string, signal: AbortSignal) => Promise<Claim | null>;
  analyze: (claim: Claim, signal: AbortSignal) => Promise<unknown>;
  admit: () => Promise<{ analystSlots: number; preparationSlots: number }>;
  event?: (event: {
    type: string;
    elapsedMs: number;
    activeAnalysts: number;
    pending: number;
  }) => Promise<void>;
}
export async function runAnalysisPipeline<Claim>(
  options: PipelineOptions<Claim>,
) {
  const reconcileMs = options.reconcileMs ?? 1000,
    grace = options.shutdownGraceMs ?? 2000;
  for (const [key, n] of Object.entries({
    maxWallMs: options.maxWallMs,
    analystSlots: options.analystSlots,
    preparationSlots: options.preparationSlots,
    maxPendingSlices: options.maxPendingSlices,
    reconcileMs,
  }))
    if (!Number.isSafeInteger(n) || n < 1)
      throw Error(`Invalid pipeline ${key}`);
  if (
    options.analystSlots > 64 ||
    options.preparationSlots > 64 ||
    !Number.isSafeInteger(grace) ||
    grace < 0 ||
    grace > 60000
  )
    throw Error("Invalid pipeline capacity/shutdown bounds");
  const started = Date.now(),
    abort = new AbortController(),
    signal = options.signal
      ? AbortSignal.any([options.signal, abort.signal])
      : abort.signal;
  let dirty = true,
    resolveWake: (() => void) | undefined;
  const wake = () => {
    dirty = true;
    resolveWake?.();
  };
  signal.addEventListener("abort", wake);
  const deadline = setTimeout(
    () => abort.abort(Error("Pipeline wall budget exhausted")),
    options.maxWallMs,
  );
  const active = new Map<number, Promise<void>>();
  let serial = 0,
    evaluationDone = false,
    failure: unknown;
  let snapshot: PipelineSnapshot = {
    pending: 0,
    preparationComplete: false,
    selectedReviewComplete: false,
    fullCoverage: false,
  };
  const event = async (type: string) =>
    options.event?.({
      type,
      elapsedMs: Date.now() - started,
      activeAnalysts: active.size,
      pending: snapshot.pending,
    });
  const evaluation = Promise.resolve()
    .then(() => options.evaluate(signal, wake))
    .then(
      () => {
        evaluationDone = true;
        wake();
      },
      (e) => {
        failure = e;
        abort.abort(e);
        wake();
      },
    );
  async function wait() {
    if (dirty) {
      dirty = false;
      return;
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        resolveWake = undefined;
        resolve();
      }, reconcileMs);
      resolveWake = () => {
        clearTimeout(timer);
        resolveWake = undefined;
        dirty = false;
        resolve();
      };
    });
  }
  try {
    await event("evaluation-started");
    for (;;) {
      if (signal.aborted) throw signal.reason;
      if (failure) throw failure;
      const admission = await options.admit();
      if (
        Object.values(admission).some((n) => !Number.isSafeInteger(n) || n < 0)
      )
        throw Error("Invalid pipeline admission");
      // A single sync owns the publication transaction; parallel decoders belong inside that tool.
      if (
        admission.preparationSlots > 0 &&
        snapshot.pending < options.maxPendingSlices
      ) {
        snapshot = await options.sync(
          signal,
          Math.min(
            options.preparationSlots,
            admission.preparationSlots,
            options.maxPendingSlices - snapshot.pending,
          ),
        );
        await event("reconciled");
      }
      const capacity = Math.min(options.analystSlots, admission.analystSlots);
      while (active.size < capacity && snapshot.pending > 0) {
        const id = serial++,
          claim = await options.claim(`pipeline-${process.pid}-${id}`, signal);
        if (!claim) break;
        snapshot.pending--;
        const task = Promise.resolve()
          .then(() => options.analyze(claim, signal))
          .then(
            () => {},
            (e) => {
              failure = e;
              abort.abort(e);
            },
          )
          .finally(() => {
            active.delete(id);
            wake();
          });
        active.set(id, task);
        await event("analyst-started");
      }
      if (
        evaluationDone &&
        active.size === 0 &&
        snapshot.preparationComplete &&
        snapshot.selectedReviewComplete
      ) {
        await event("analysis-settled");
        return {
          ...snapshot,
          elapsedMs: Date.now() - started,
          evaluationComplete: true,
        };
      }
      if (
        evaluationDone &&
        active.size === 0 &&
        snapshot.preparationComplete &&
        snapshot.pending === 0 &&
        !snapshot.selectedReviewComplete &&
        admission.analystSlots > 0
      )
        throw Error(
          "Evaluation settled with incomplete claimed analysis; recover existing owners before continuing",
        );
      await wait();
    }
  } finally {
    clearTimeout(deadline);
    abort.abort(failure ?? Error("Pipeline settled"));
    signal.removeEventListener("abort", wake);
    resolveWake?.();
    const tasks = Promise.allSettled([evaluation, ...active.values()]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      tasks,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, grace);
      }),
    ]);
    if (timer) clearTimeout(timer);
  }
}

/** Read-only admission before any operation file, quota initialization or child launch. */
export async function pipelineSessionWallLimit(
  session: string,
  requestedMs: number,
) {
  if (!Number.isSafeInteger(requestedMs) || requestedMs < 1)
    throw Error("Explicit pipeline wall limit required");
  const config = JSON.parse(
    await readFile(path.join(session, "config.json"), "utf8"),
  );
  const control = await readFile(
    path.join(session, "control.json"),
    "utf8",
  ).then(JSON.parse, (e) => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
  if (control?.stoppingReason || control?.ownerStopToken)
    throw Error(
      `Source session is stopped: ${control.stoppingReason ?? "owner-stop"}`,
    );
  const marker = await readFile(path.join(session, "OWNER_STOP")).then(
    digest,
    (e) => {
      if (e.code === "ENOENT") return null;
      throw e;
    },
  );
  if (marker && marker !== control?.acknowledgedMarker)
    throw Error("Source session has an unacknowledged OWNER_STOP");
  const cap = control?.limits?.maxWallMs ?? config.limits?.stop?.maxWallMs;
  if (!Number.isSafeInteger(cap) || cap < 1)
    throw Error("Session wall budget required");
  const elapsed = Math.max(
    control?.elapsedMs ?? 0,
    control?.startedAt === undefined ? 0 : Date.now() - control.startedAt,
  );
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= cap)
    throw Error("Session wall budget exhausted");
  return Math.min(requestedMs, Math.floor(cap - elapsed));
}

/** CLI binds real evaluation and analyst commands to the same owned process supervisor. */
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [session, requestFile] = process.argv.slice(2);
    if (!session || !requestFile)
      throw Error("Usage: analysis-pipeline.ts SESSION REQUEST.json");
    const request = JSON.parse(await readFile(requestFile, "utf8"));
    if (
      !request.evaluation?.command ||
      !request.analyst?.command ||
      !request.resources
    )
      throw Error(
        "Explicit evaluation/analyst commands and resource admission required",
      );
    for (const key of [
      "runtimeAnalystSlots",
      "preparationSlots",
      "bytesPerAnalyst",
      "bytesPerPreparer",
      "reserveBytes",
      "activeEvaluationBytes",
    ]) {
      const n = request.resources[key];
      if (
        !Number.isSafeInteger(n) ||
        n < (key === "activeEvaluationBytes" || key === "reserveBytes" ? 0 : 1)
      )
        throw Error(`Explicit valid resource ${key} required`);
    }
    request.limits.maxWallMs = await pipelineSessionWallLimit(
      session,
      request.limits?.maxWallMs,
    );
    await ensureSessionOutput(session);
    const operation = path.join(session, "analysis-pipeline-operation.json");
    const result = await ownedOperation(
      operation,
      digest(JSON.stringify(request)),
      async (progress, context) => {
        let owners = 0;
        const scope = {
          iteration: request.binding.iteration,
          role: request.binding.role,
          ...(request.analysisId ? { analysisId: request.analysisId } : {}),
        };
        const execute = async (
          command: { command: string; args?: string[] },
          extra: string[] = [],
        ) => {
          const child = await context.spawn(
            command.command,
            [...(command.args ?? []), ...extra],
            { cwd: path.resolve(session) },
          );
          const result = await child.completed;
          if (result.code !== 0)
            throw Error(
              `Pipeline command failed: ${command.command} (${result.code}/${result.signal})`,
            );
        };
        return runAnalysisPipeline<
          NonNullable<
            Awaited<ReturnType<typeof prepareAnalysisSlices>>["claim"]
          >
        >({
          ...request.limits,
          signal: context.signal,
          evaluate: async (_signal, published) => {
            const watcher = watch(
              session,
              { recursive: true },
              (_event, name) => {
                if (
                  name &&
                  String(name).startsWith(request.binding.root) &&
                  path.basename(String(name)) === "done.json"
                )
                  published();
              },
            );
            watcher.on("error", published); // periodic reconciliation remains the fallback
            try {
              await execute(request.evaluation);
            } finally {
              watcher.close();
            }
          },
          sync: async (_signal, maxSlices) => {
            // The evaluation command may still be publishing its pinned execution plan.
            // Missing files mean not-ready; changed hashes still fail in the slice verifier.
            try {
              await readFile(
                path.join(session, request.binding.execution.path),
              );
              await readFile(path.join(session, request.binding.proposal.path));
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "ENOENT")
                throw error;
              return {
                pending: 0,
                preparationComplete: false,
                selectedReviewComplete: false,
                fullCoverage: false,
              };
            }

            const s = await prepareAnalysisSlices(session, {
              action: "sync",
              binding: {
                ...request.binding,
                ...(request.analysisId
                  ? { analysisId: request.analysisId }
                  : {}),
              },
              maxSlices,
            });
            return {
              pending: s.dispatch.length,
              preparationComplete: s.preparationComplete,
              selectedReviewComplete: s.selectedReviewComplete,
              fullCoverage: s.fullCoverage,
            };
          },
          claim: async () => {
            const s = await prepareAnalysisSlices(session, {
              action: "claim",
              ...scope,
              owner: `pipeline-${process.pid}-${owners++}`,
            });
            return s.claim;
          },
          analyze: async (claim) => {
            const dir = path.join(session, "pipeline-claims");
            await mkdir(dir, { recursive: true });
            const file = path.join(dir, `${claim.id}-${claim.attempt}.json`);
            await writeOutput(
              file,
              JSON.stringify({ session: path.resolve(session), scope, claim }) +
                "\n",
              true,
            );
            await execute(request.analyst, [file]);
            const state = JSON.parse(
              await readFile(
                path.join(
                  session,
                  analysisScope(
                    scope.iteration,
                    scope.role,
                    request.analysisId,
                  ),
                  "slices.json",
                ),
                "utf8",
              ),
            );
            const completed = state.slices.find(
              (s: { id: string }) => s.id === claim.id,
            );
            if (
              completed?.status !== "complete" ||
              completed?.claim?.token !== claim.claim?.token
            )
              throw Error(
                `Analyst exited without completing claimed slice ${claim.id}`,
              );
          },
          admit: async () => {
            const resources = request.resources;
            const { freemem } = await import("node:os");
            const memorySlots = Math.max(
              0,
              Math.floor(
                (freemem() -
                  resources.reserveBytes -
                  resources.activeEvaluationBytes) /
                  resources.bytesPerAnalyst,
              ),
            );
            return {
              analystSlots: Math.min(
                resources.runtimeAnalystSlots,
                memorySlots,
              ),
              preparationSlots: Math.max(
                0,
                Math.min(
                  resources.preparationSlots,
                  Math.floor(
                    (freemem() -
                      resources.reserveBytes -
                      resources.activeEvaluationBytes) /
                      resources.bytesPerPreparer,
                  ),
                ),
              ),
            };
          },
          event: async (e) =>
            progress(e.type, {
              elapsedMs: e.elapsedMs,
              activeAnalysts: e.activeAnalysts,
              pending: e.pending,
            }),
        });
      },
      { shutdownGraceMs: request.limits.shutdownGraceMs ?? 2000 },
    );
    console.log(JSON.stringify(result));
  } catch (e) {
    console.error(String(e));
    process.exitCode = 1;
  }
}
