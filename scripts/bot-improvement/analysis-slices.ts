import { findingsValidationCache } from "./findings-validation-cache.ts";
import { recordWorkflowEvent } from "./workflow-telemetry.ts";
import {
  canonicalReasonId,
  reconcileReasons,
  type ReasonOccurrence,
} from "./reason-vocabulary.ts";
import { freemem, availableParallelism } from "node:os";
import { analysisScope } from "./analysis-scope.ts";
import { ownedOperation } from "./operation-status.ts";
import {
  resolveAnalysisPolicy,
  policyIdentity,
  selectedMatches,
  analystCapacity,
  reviewFeasibility,
} from "./analysis-policy.ts";
/** Durable one-owner-per-250-match dispatch with independently published slices. */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import {
  analysisWriteOutput as writeOutput,
  saveAnalysis as save,
  withAnalysisOutput,
} from "./analysis-output.ts";
import type { compactLossReview } from "./compact-loss-review.ts";
import { reviewCardNames } from "./review-card-names.ts";
import { readableLossReview } from "./readable-loss-review.ts";
import { prepareAnalyses } from "./prepare-analyses.ts";
import { json, optionalJson } from "./session-checkpoint.ts";
import {
  analysisPath,
  readEvidence,
  readEvidenceJson,
} from "./analysis-evidence.ts";
import { digest } from "./session-fixtures.ts";
import { targetLossView } from "./game-log.ts";
import {
  lossDecisions,
  type ReviewPage,
  readReviewPage,
} from "./loss-review.ts";
import {
  parseLossMarkdown,
  renderLossMarkdown,
  validateAnalysisReport,
} from "./analysis-report.ts";
import { retrySession } from "./match-session.ts";
import { withSessionLock } from "./session-lock.ts";
import type {
  AnalysisBinding,
  AnalysisPacket,
  AnalysisQueue,
  LossMatchReport,
} from "./analysis-contract.ts";
import type { EvidenceReference } from "./session-control-contract.ts";

interface SlicePacket {
  schemaVersion: 1;
  id: string;
  executionIdentity: string;
  startMatch: number;
  endMatch: number;
  matches: string[];
  jobs: {
    id: string;
    packetSha256: string;
    match: string;
    losses: {
      game: number;
      log: EvidenceReference;
      decisions: string[];
      choiceMap?: EvidenceReference;
      review?: {
        version: 1 | 2 | 3 | 4;
        blocks?: ReturnType<typeof compactLossReview>["blocks"];
        cardIndex?: ReturnType<typeof compactLossReview>["cardIndex"];
        index?: { row: number; sequence: unknown; decision: unknown }[];
        sourceSha256: string;
        inputBytes: number;
        renderedBytes: number;
        events: number;
        pages: ReviewPage[];
      };
    }[];
  }[];
}
interface Slice {
  id: string;
  packet: EvidenceReference;
  status: "pending" | "claimed" | "complete";
  attempt: number;
  claim?: { owner: string; token: string };
  reports?: EvidenceReference[];
  /** Validated canonical per-match reports survive release/reassignment. */
  completedJobs?: string[];
  losses?: number;
  reviewBytes?: number;
  reviewPages?: number;
  reviewedLosses?: number;
  reading?: Record<string, { nextPage: number; hashes: string[] }>;
}
interface SliceState {
  schemaVersion: 1;
  binding: AnalysisBinding;
  executionIdentity: string;
  expectedSlices?: number;
  policyIdentity?: string;
  createdAt?: number;
  slices: Slice[];
  summary?: EvidenceReference;
}
type Scope = {
  analysisId?: string;
  iteration: number;
  role: AnalysisBinding["role"];
};
export type SliceAction =
  | {
      action: "sync";
      binding: AnalysisBinding;
      maxSlices?: number;
      startSlice?: number;
    }
  | (Scope &
      (
        | { action: "status" | "audit" }
        | { action: "claim"; owner: string }
        | {
            action: "read-page";
            slice: string;
            token: string;
            match: string;
            game: number;
            page: number;
            sha256: string;
          }
        | { action: "release"; slice: string; token: string; terminated: true }
        | {
            action: "complete" | "checkpoint";
            slice: string;
            token: string;
            reports?: EvidenceReference[];
            findings?: LossMatchReport[];
          }
      ));
const encode = (v: unknown) => JSON.stringify(v, null, 2) + "\n";
async function immutable(session: string, relative: string, bytes: string) {
  const file = path.join(session, relative);
  await mkdir(path.dirname(file), { recursive: true });
  try {
    await writeOutput(file, bytes, true);
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code !== "EEXIST" ||
      (await readFile(await analysisPath(session, relative), "utf8")) !== bytes
    )
      throw error;
  }
  return { path: relative, sha256: digest(bytes) };
}
function finished(state: SliceState) {
  return (
    state.slices.length === (state.expectedSlices ?? state.slices.length) &&
    state.slices.every((s) => s.status === "complete")
  );
}
export async function prepareAnalysisSlices(
  session: string,
  action: SliceAction,
  progress: (
    phase: string,
    counts: Record<string, number>,
  ) => Promise<void> = async () => {},
) {
  session = path.resolve(session);
  const config = await json(path.join(session, "config.json"));
  let remainingWallMs = Number.MAX_SAFE_INTEGER;
  if (!["status", "audit"].includes(action.action)) {
    const control = await optionalJson(path.join(session, "control.json"));
    const marker = await readFile(path.join(session, "OWNER_STOP")).then(
      digest,
      (error) => {
        if (error.code !== "ENOENT") throw error;
        return null;
      },
    );
    if (marker && marker !== control?.acknowledgedMarker)
      throw Error("Session has an unacknowledged OWNER_STOP");
    if (
      control?.stoppingReason &&
      !["max-iterations", "max-games"].includes(control.stoppingReason)
    )
      throw Error(`Session is stopped: ${control.stoppingReason}`);
    const maxWallMs =
      control?.limits?.maxWallMs ?? config.limits.stop?.maxWallMs;
    if (control?.startedAt && maxWallMs)
      remainingWallMs = Math.max(
        0,
        maxWallMs - (Date.now() - control.startedAt),
      );
    if (
      control?.startedAt &&
      maxWallMs &&
      Date.now() - control.startedAt >= maxWallMs
    )
      throw Error("Session wall budget exhausted");
  }
  const cohortId =
    action.action === "sync" ? action.binding.analysisId : action.analysisId;
  if (cohortId && !config.analysisPolicies?.[cohortId])
    throw Error("Unknown analysis cohort policy");
  const policy = resolveAnalysisPolicy(
    cohortId ? config.analysisPolicies[cohortId] : config.analysisPolicy,
    config.limits.analysisWorkers,
  );
  const preparationCapacity = policy.resources
    ? Math.min(
        policy.preparationSlots,
        availableParallelism(),
        Math.max(
          0,
          Math.floor(
            (freemem() - policy.resources.reserveBytes) /
              policy.resources.bytesPerPreparer,
          ),
        ),
      )
    : policy.preparationSlots;
  const sliceSize = policy.sliceMatches;
  const binding = action.action === "sync" ? action.binding : action;
  if (
    !Number.isSafeInteger(binding.iteration) ||
    binding.iteration < 1 ||
    !["control", "candidate"].includes(binding.role)
  )
    throw Error("Invalid slice scope");
  const scope = analysisScope(
    binding.iteration,
    binding.role,
    binding.analysisId,
  );
  const queuePath = path.join(session, scope, "queue.json"),
    statePath = path.join(session, scope, "slices.json");
  const transaction = <T>(run: () => Promise<T>, output = false) =>
    retrySession(session, () =>
      withSessionLock(session, () =>
        output ? withAnalysisOutput(session, scope, run) : run(),
      ),
    );
  if (action.action === "sync") {
    await progress("discovery", { slices: 0 });
    if (
      action.maxSlices !== undefined &&
      (!Number.isSafeInteger(action.maxSlices) || action.maxSlices < 1)
    )
      throw Error("Invalid slice preparation limit");
    let state = (await optionalJson(statePath)) as SliceState | null;
    if (!state) {
      // This barrier verifies every scheduled match before any analyst admission.
      const result = await prepareAnalyses(session, {
        action: "sync",
        binding: action.binding,
        matchRange: { start: 0, count: sliceSize },
      });
      if (result.integrity.length)
        throw Error(
          "All matches must be finalized and intact before slice dispatch",
        );
      await transaction(async () => {
        const queue = (await json(queuePath)) as AnalysisQueue;
        state = (await optionalJson(statePath)) as SliceState | null;
        if (!state) {
          state = {
            schemaVersion: 1,
            binding: action.binding,
            executionIdentity: queue.executionIdentity,
            expectedSlices: Math.ceil(queue.expected.length / sliceSize),
            policyIdentity: policyIdentity(policy),
            createdAt: Date.now(),
            slices: [],
          };
          await save(statePath, state);
        }
      });
    }
    if (
      state!.policyIdentity &&
      state!.policyIdentity !== policyIdentity(policy)
    )
      throw Error("Analysis policy changed; use a new analysis scope");
    if (!isDeepStrictEqual(state!.binding, action.binding))
      throw Error("Slice binding changed");
    await readEvidence(session, action.binding.execution);
    await readEvidence(session, action.binding.proposal);
    const queue = (await json(queuePath)) as AnalysisQueue;
    const jobs = new Map(queue.jobs.map((j) => [j.match, j]));
    const triageCosts: Record<string, number> = {};
    if (policy.mode === "two-pass") {
      await prepareAnalyses(session, {
        action: "sync",
        binding: action.binding,
      });
      const whole = (await json(queuePath)) as AnalysisQueue;
      if (whole.expected.some((id) => !whole.jobs.some((j) => j.match === id)))
        throw Error("Two-pass triage waits for complete outcome metadata");
      for (const job of whole.jobs) {
        jobs.set(job.match, job);
        const input = (await readEvidenceJson(
          session,
          job.packet,
        )) as AnalysisPacket;
        triageCosts[job.match] =
          (input.lossGames?.length ?? 0) * 100 +
          (input.lossGames ?? []).reduce((n, l) => n + l.decisions.length, 0);
      }
      await transaction(
        () =>
          immutable(
            session,
            `${scope}/triage.json`,
            encode({
              policyIdentity: policyIdentity(policy),
              scores: triageCosts,
              selected: [
                ...selectedMatches(queue.expected, policy, triageCosts),
              ],
            }),
          ),
        true,
      );
    }
    if (queue.executionIdentity !== state!.executionIdentity)
      throw Error("All matches must finalize before slice dispatch");
    if (preparationCapacity === 0)
      throw Error("Insufficient preparation memory");
    if (action.startSlice === undefined && preparationCapacity > 1) {
      const total = Math.ceil(queue.expected.length / sliceSize);
      const ready = Array.from({ length: total }, (_, i) => i)
        .filter(
          (i) =>
            !state!.slices.some(
              (s) => s.id === `slice-${String(i + 1).padStart(4, "0")}`,
            ),
        )
        .slice(0, action.maxSlices ?? preparationCapacity);
      for (let i = 0; i < ready.length; i += preparationCapacity)
        await Promise.all(
          ready
            .slice(i, i + preparationCapacity)
            .map((startSlice) =>
              prepareAnalysisSlices(
                session,
                { ...action, maxSlices: 1, startSlice },
                progress,
              ),
            ),
        );
      return prepareAnalysisSlices(
        session,
        {
          action: "status",
          iteration: binding.iteration,
          role: binding.role,
          ...(binding.analysisId ? { analysisId: binding.analysisId } : {}),
        },
        progress,
      );
    }
    if (
      action.startSlice !== undefined &&
      (!Number.isSafeInteger(action.startSlice) || action.startSlice < 0)
    )
      throw Error("Invalid starting slice");
    const cardNames = await reviewCardNames(config.fixture.path);
    let prepared = 0;
    for (
      let start = (action.startSlice ?? 0) * sliceSize;
      start <
      Math.min(
        queue.expected.length,
        action.startSlice === undefined
          ? queue.expected.length
          : (action.startSlice + 1) * sliceSize,
      );
      start += sliceSize
    ) {
      const id = `slice-${String(start / sliceSize + 1).padStart(4, "0")}`;
      if (state!.slices.some((s) => s.id === id)) continue;
      if (prepared >= (action.maxSlices ?? Infinity)) break;
      // Decode/project a bounded slice outside the session lock. Only publication owns it.
      const matches = queue.expected.slice(start, start + sliceSize);
      if (matches.some((m) => !jobs.has(m))) {
        await prepareAnalyses(session, {
          action: "sync",
          binding: action.binding,
          matchRange: { start, count: sliceSize },
        });
        const refreshed = (await json(queuePath)) as AnalysisQueue;
        for (const job of refreshed.jobs) jobs.set(job.match, job);
      }
      if (matches.some((m) => !jobs.has(m))) continue;
      const packet: SlicePacket = {
        schemaVersion: 1,
        id,
        executionIdentity: queue.executionIdentity,
        startMatch: start + 1,
        endMatch: start + matches.length,
        matches,
        jobs: [],
      };
      const outputs: { path: string; bytes: string }[] = [];
      const stage = (relative: string, bytes: string) => {
        outputs.push({ path: relative, bytes });
        return { path: relative, sha256: digest(bytes) };
      };
      const selected = selectedMatches(queue.expected, policy, triageCosts);
      for (const match of matches) {
        if (!selected.has(match)) continue;
        const job = jobs.get(match)!;
        const source = (await readEvidenceJson(
          session,
          job.packet,
        )) as AnalysisPacket;
        if (source.lossGames === undefined)
          throw Error("Slice analysis requires loss-aware text evidence");
        if (!source.lossGames.length) continue;
        const losses: SlicePacket["jobs"][number]["losses"] = [];
        for (const loss of source.lossGames) {
          const projected = source.files.find((f) =>
            f.path.endsWith(`/games/game-${loss.game}/loss.log`),
          );
          const log = source.files.find((f) =>
            f.path.endsWith(`/games/game-${loss.game}/game.log`),
          );
          if (!log)
            throw Error(
              "Slice analysis requires authoritative game.log evidence",
            );
          const text = projected
            ? (await readEvidence(session, projected)).toString()
            : targetLossView((await readEvidence(session, log)).toString());
          if (
            !isDeepStrictEqual(Object.keys(lossDecisions(text)), loss.decisions)
          )
            throw Error("Loss view decision allowlist mismatch");
          const base = `${scope}/slices/${id}/losses/${match}-game-${loss.game}`;
          const ref = projected ?? stage(`${base}.log`, text);
          const readable = readableLossReview(text, { cardNames });
          const reviewText = readable.text;
          const reviewFile = stage(`${base}.md`, reviewText);
          const choiceMap = stage(
            `${base}.choices.json`,
            JSON.stringify(readable.choiceMap, null, 2),
          );
          const pages: ReviewPage[] = [
            {
              ...reviewFile,
              offset: 0,
              bytes: Buffer.byteLength(reviewText),
              pageSha256: digest(reviewText),
              events: readable.events,
              decisions: readable.decisions,
            },
          ];
          losses.push({
            ...loss,
            log: ref,
            choiceMap,
            review: {
              version: 4,
              sourceSha256: ref.sha256,
              inputBytes: Buffer.byteLength(text),
              renderedBytes: Buffer.byteLength(reviewText),
              events: readable.events,
              pages,
            },
          });
        }
        packet.jobs.push({
          id: job.id,
          packetSha256: job.packet.sha256,
          match,
          losses,
        });
      }
      await transaction(async () => {
        const current = (await json(statePath)) as SliceState;
        if (
          !isDeepStrictEqual(current.binding, action.binding) ||
          current.executionIdentity !== packet.executionIdentity
        )
          throw Error("Slice preparation binding changed");
        const existing = current.slices.find((s) => s.id === id);
        // Concurrent preparers cannot replace an already published allowlist.
        if (existing) {
          state = current;
          return;
        }
        for (const output of outputs)
          await immutable(session, output.path, output.bytes);
        const ref = await immutable(
          session,
          `${scope}/slices/${id}/packet.json`,
          encode(packet),
        );
        current.slices.push({
          id,
          packet: ref,
          status: packet.jobs.length ? "pending" : "complete",
          attempt: 0,
          losses: packet.jobs.reduce((n, j) => n + j.losses.length, 0),
          reviewedLosses: 0,
          reviewBytes: packet.jobs.reduce(
            (n, j) =>
              n +
              j.losses.reduce((m, l) => m + (l.review?.renderedBytes ?? 0), 0),
            0,
          ),
          reviewPages: packet.jobs.reduce(
            (n, j) =>
              n +
              j.losses.reduce((m, l) => m + (l.review?.pages.length ?? 0), 0),
            0,
          ),
        });
        current.slices.sort((a, b) => a.id.localeCompare(b.id));
        await save(statePath, current);
        state = current;
      }, true);
      prepared++;
      await progress("slice-published", {
        slices: state!.slices.length,
        expected: state!.expectedSlices!,
        matches: start + matches.length,
        bytes: outputs.reduce((n, o) => n + Buffer.byteLength(o.bytes), 0),
      });
    }
  }
  // Validate submitted evidence outside the ownership/publication lock.
  const validated = new Map<
    string,
    { text: string; report: LossMatchReport; packetSha256: string }
  >();
  if (action.action === "checkpoint" || action.action === "complete") {
    const state = (await json(statePath)) as SliceState;
    const slice = state.slices.find((s) => s.id === action.slice);
    if (!slice?.claim || slice.claim.token !== action.token)
      throw Error("Stale or unknown slice claim");
    const packet = (await readEvidenceJson(
      session,
      slice.packet,
    )) as SlicePacket;
    const queue = (await json(queuePath)) as AnalysisQueue;
    const jobs = new Map(queue.jobs.map((j) => [j.id, j]));
    const submitted: { text?: string; report?: LossMatchReport }[] = [];
    for (const ref of action.reports ?? [])
      submitted.push({ text: (await readEvidence(session, ref)).toString() });
    for (const report of action.findings ?? []) {
      if (report.reasons === undefined)
        throw Error("Structured findings require complete first-pass reasons");
      submitted.push({ report });
    }
    for (const submission of submitted) {
      const id =
        submission.report?.job ??
        /^Job:\s*(.+)$/m.exec(submission.text!)?.[1]?.trim();
      const input = packet.jobs.find((j) => j.id === id);
      if (!input || validated.has(input.id))
        throw Error("Duplicate/foreign slice report");
      const job = jobs.get(input.id)!;
      const full = (await readEvidenceJson(
        session,
        job.packet,
      )) as AnalysisPacket;
      const text =
        submission.text ??
        renderLossMarkdown(submission.report!, full, job.packet.sha256);
      const refs = [...full.files, full.proposal, job.packet];
      const sourceHashes = Object.fromEntries(
        refs.map((ref) => [ref.path, ref.sha256]),
      );
      const { value: report } = await findingsValidationCache.validate(
        {
          packetSha256: job.packet.sha256,
          sourceHashes,
          report: text,
          vocabularyVersion: policy.vocabulary?.version ?? "unversioned",
          validatorIdentity: "loss-markdown-v1/choices-v1",
        },
        async () => {
          const actual: Record<string, string> = {};
          for (const ref of refs)
            actual[ref.path] = digest(await readEvidence(session, ref));
          return actual;
        },
        () => parseLossMarkdown(text, full, job.packet.sha256),
      );
      for (const loss of input.losses) {
        if (
          loss.review &&
          [2, 3].includes(loss.review.version) &&
          slice.reading?.[`${input.match}/G${loss.game}`]?.nextPage !==
            loss.review.pages.length + 1
        )
          throw Error(
            "Complete ordered page acknowledgements before submitting findings",
          );
        const choices = lossDecisions(
          (await readEvidence(session, loss.log)).toString(),
        );
        for (const reason of report.reasons?.filter(
          (r) => r.game === loss.game,
        ) ?? [])
          if (
            !isDeepStrictEqual(choices[reason.decision], {
              offered: reason.offered,
              chosen: reason.chosen,
            })
          )
            throw Error("Reason choices differ from recorded decision");
      }
      validated.set(input.id, {
        text,
        report,
        packetSha256: job.packet.sha256,
      });
    }
  }
  if (action.action === "audit") {
    const result = await prepareAnalyses(session, {
      action: "status",
      iteration: binding.iteration,
      role: binding.role,
      ...(binding.analysisId ? { analysisId: binding.analysisId } : {}),
    });
    if (result.integrity.length)
      throw Error(
        `Analysis integrity failure: ${JSON.stringify(result.integrity)}`,
      );
    const state = (await json(statePath)) as SliceState;
    for (const slice of state.slices) {
      const packet = (await readEvidenceJson(
        session,
        slice.packet,
      )) as SlicePacket;
      for (const job of packet.jobs)
        for (const loss of job.losses) {
          await readEvidence(session, loss.log);
          for (const page of loss.review?.pages ?? [])
            await readReviewPage(session, page);
        }
    }
  }
  return transaction(
    async () => {
      const state = (await optionalJson(statePath)) as SliceState | null;
      if (!state) throw Error("Sync slices before dispatch");
      if (
        state.policyIdentity &&
        state.policyIdentity !== policyIdentity(policy)
      )
        throw Error("Analysis policy changed; use a new analysis scope");
      let claim: Slice | null = null;
      let dirty = false;
      if (action.action === "claim") {
        const capacity = policy.resources
          ? analystCapacity(policy, {
              ...policy.resources,
              freeBytes: freemem(),
              activeEvaluationBytes: 0,
            })
          : policy.analystSlots;
        if (policy.feasibility) {
          const feasibility = reviewFeasibility(
            policy.feasibility.samples,
            policy.feasibility.remaining,
            Math.max(1, capacity),
            Math.max(
              0,
              Math.min(
                remainingWallMs,
                policy.feasibility.remainingMs -
                  (Date.now() - (state.createdAt ?? Date.now())),
              ),
            ),
          );
          if (!feasibility.assessable || !feasibility.feasible)
            throw Error(
              "Review feasibility gate: representative throughput exceeds remaining limits or is unassessable",
            );
        }
        if (!action.owner.trim()) throw Error("Slice owner required");
        claim =
          state.slices.find(
            (s) => s.status === "claimed" && s.claim?.owner === action.owner,
          ) ?? null;
        if (
          !claim &&
          state.slices.filter((s) => s.status === "claimed").length < capacity
        ) {
          const pending = state.slices.filter((s) => s.status === "pending");
          if (policy.scheduling === "cost-balanced")
            pending.sort(
              (a, b) =>
                (b.reviewBytes ?? b.losses ?? 0) -
                  (a.reviewBytes ?? a.losses ?? 0) || a.id.localeCompare(b.id),
            );
          claim = pending[0] ?? null;
          if (claim) {
            claim.status = "claimed";
            claim.attempt++;
            claim.claim = { owner: action.owner, token: randomUUID() };
            dirty = true;
          }
        }
        if (claim) {
          const packet = (await readEvidenceJson(
            session,
            claim.packet,
          )) as SlicePacket;
          const queue = (await json(queuePath)) as AnalysisQueue;
          const completed: string[] = [];
          for (const input of packet.jobs) {
            const job = queue.jobs.find((j) => j.id === input.id)!;
            if (job.status === "complete" && job.report) {
              await readEvidence(session, job.report);
              completed.push(input.id);
            }
          }
          if (!isDeepStrictEqual(claim.completedJobs ?? [], completed.sort())) {
            claim.completedJobs = completed.sort();
            dirty = true;
          }
        }
      } else if (action.action === "read-page") {
        const slice = state.slices.find((s) => s.id === action.slice);
        if (slice?.status !== "claimed" || slice.claim?.token !== action.token)
          throw Error("Stale or unknown slice claim");
        const packet = (await readEvidenceJson(
          session,
          slice.packet,
        )) as SlicePacket;
        const loss = packet.jobs
          .find((j) => j.match === action.match)
          ?.losses.find((l) => l.game === action.game);
        const page = loss?.review?.pages[action.page - 1];
        if (
          !Number.isSafeInteger(action.page) ||
          !page ||
          page.pageSha256 !== action.sha256
        )
          throw Error("Unknown review page acknowledgement");
        await readReviewPage(session, page);
        const key = `${action.match}/G${action.game}`;
        slice.reading ??= {};
        const cursor = slice.reading[key] ?? { nextPage: 1, hashes: [] };
        if (action.page > cursor.nextPage)
          throw Error("Review acknowledgement skips unread pages");
        if (action.page === cursor.nextPage) {
          cursor.hashes.push(action.sha256);
          cursor.nextPage++;
        } else if (cursor.hashes[action.page - 1] !== action.sha256)
          throw Error("Review page changed");
        slice.reading[key] = cursor;
        dirty = true;
      } else if (
        action.action === "release" ||
        action.action === "checkpoint" ||
        action.action === "complete"
      ) {
        const slice = state.slices.find((s) => s.id === action.slice);
        if (!slice?.claim || slice.claim.token !== action.token)
          throw Error("Stale or unknown slice claim");
        if (action.action === "release") {
          if (action.terminated !== true || slice.status !== "claimed")
            throw Error("Confirm slice analyst termination");
          slice.status = "pending";
          delete slice.claim;
        } else {
          const packet = (await readEvidenceJson(
            session,
            slice.packet,
          )) as SlicePacket;
          const queue = (await json(queuePath)) as AnalysisQueue;
          const completed = new Set(
            slice.completedJobs ??
              (slice.status === "complete" ? packet.jobs.map((j) => j.id) : []),
          );
          if (
            action.action === "complete" &&
            packet.jobs.some(
              (j) => !completed.has(j.id) && !validated.has(j.id),
            )
          )
            throw Error("Incomplete slice loss coverage");
          for (const [id, value] of validated) {
            const job = queue.jobs.find((j) => j.id === id)!;
            if (job.packet.sha256 !== value.packetSha256)
              throw Error("Report packet changed");
            if (job.status === "claimed")
              throw Error("A match analyst already owns this slice’s work");
            if (job.report) {
              const previous = await readEvidenceJson(session, job.report);
              if (!isDeepStrictEqual(previous, value.report))
                throw Error("Conflicting match completion");
            } else {
              const stem = `${scope}/reports/${job.match}-${slice.id}`;
              job.findings = await immutable(session, `${stem}.md`, value.text);
              job.report = await immutable(
                session,
                `${stem}.json`,
                encode(value.report),
              );
            }
            job.status = "complete";
            completed.add(id);
          }
          await save(queuePath, queue);
          slice.completedJobs = [...completed].sort();
          slice.reviewedLosses = packet.jobs
            .filter((j) => completed.has(j.id))
            .reduce((n, j) => n + j.losses.length, 0);
          if (action.action === "complete") {
            slice.status = "complete";
            slice.reports = packet.jobs.map(
              (input) => queue.jobs.find((j) => j.id === input.id)!.findings!,
            );
          }
        }
        dirty = true;
      }
      const complete = finished(state);
      if (complete && !state.summary && action.action !== "status") {
        const queue = (await json(queuePath)) as AnalysisQueue;
        const reasons = new Map<
          string,
          { reason: string; solution: string; points: Map<string, string> }
        >();
        const occurrences: ReasonOccurrence[] = [];
        let reviewed = 0,
          unclear = 0;
        for (const job of queue.jobs) {
          if (!job.report) {
            if (policy.mode !== "full") continue;
            throw Error("Missing loss report at consolidation");
          }
          const report = (await readEvidenceJson(
            session,
            job.report,
          )) as LossMatchReport;
          const packet = (await readEvidenceJson(
            session,
            job.packet,
          )) as AnalysisPacket;
          validateAnalysisReport(report, packet, job.packet.sha256);
          reviewed += report.findings.length;
          unclear += report.findings.filter(
            (f) => f.classification === "unclear",
          ).length;
          const rows =
            report.reasons ??
            report.findings
              .filter((f) => f.classification === "avoidable")
              .map((f) => ({
                ...f,
                id: f.reason.trim().toLowerCase().replace(/\s+/g, "-"),
              }));
          for (const row of rows) {
            occurrences.push({
              id: row.id,
              loss: `${job.match}/G${row.game}`,
              decision: row.decision!,
              reason: row.reason,
              solution: row.solution,
            });
            const reasonId = policy.vocabulary
              ? canonicalReasonId(row.id, policy.vocabulary)
              : row.id;
            const item = reasons.get(reasonId) ?? {
              reason: row.reason,
              solution: row.solution,
              points: new Map<string, string>(),
            };
            item.points.set(
              `${job.match}/G${row.game}`,
              `${job.match}/G${row.game}@${row.decision}`,
            );
            reasons.set(reasonId, item);
          }
        }
        await immutable(
          session,
          `${scope}/reason-merge.json`,
          encode(
            reconcileReasons(
              occurrences,
              policy.vocabulary ?? { version: "raw-v1", aliases: {} },
            ),
          ),
        );
        const eligible = [...reasons.values()]
          .filter((r) => r.points.size >= 5)
          .sort(
            (a, b) =>
              b.points.size - a.points.size || a.reason.localeCompare(b.reason),
          );
        const text =
          `# Loss Analysis — Iteration ${binding.iteration} / ${binding.role}\n\nCoverage policy: ${policy.mode}. ${policy.mode === "full" ? "Exhaustive review complete." : "Selected review complete; unread losses are not covered."}\n\n${queue.expected.length * 4} scheduled games · ${reviewed} losses reviewed · ${unclear} unclear · ${eligible.length} eligible reasons.\n\n` +
          eligible
            .map(
              (r, i) =>
                `${i + 1}. **${r.reason}** — ${r.points.size} losses.\n   Solution: ${r.solution}\n   Replay points: ${[...r.points.values()].join("; ")}\n`,
            )
            .join("\n");
        state.summary = await immutable(
          session,
          `${scope}/loss-analysis-draft.md`,
          text,
        );
        dirty = true;
      }
      if (state.summary) await readEvidence(session, state.summary);
      if (dirty) {
        await save(statePath, state);
        const coverageQueue = (await json(queuePath)) as AnalysisQueue;
        await recordWorkflowEvent(session, {
          id: randomUUID(),
          sourceIdentity: config.fixture.identity,
          kind: action.action === "complete" ? "completion" : "checkpoint",
          phase: "analysis",
          coverage: {
            scheduledMatches: ((await json(queuePath)) as AnalysisQueue)
              .expected.length,
            finalizedMatches: ((await json(queuePath)) as AnalysisQueue).jobs
              .length,
            noLossMatches: coverageQueue.jobs.filter((j) => j.lossCount === 0)
              .length,
            totalLosses: coverageQueue.jobs.reduce(
              (n, j) => n + (j.lossCount ?? 0),
              0,
            ),
            selectedLosses: state.slices.reduce(
              (n, s) => n + (s.losses ?? 0),
              0,
            ),
            reviewedLosses: state.slices.reduce(
              (n, s) => n + (s.reviewedLosses ?? 0),
              0,
            ),
            acknowledgedPages: state.slices.reduce(
              (n, s) =>
                n +
                Object.values(s.reading ?? {}).reduce(
                  (m, c) => m + c.hashes.length,
                  0,
                ),
              0,
            ),
            expectedPages: state.slices.reduce(
              (n, s) => n + (s.reviewPages ?? 0),
              0,
            ),
            complete: complete && policy.mode === "full",
            mode: policy.mode,
          },
        });
      }
      return {
        state: statePath,
        workers: policy.analystSlots,
        complete: complete && policy.mode === "full",
        selectedReviewComplete: complete,
        coverageMode: policy.mode,
        fullCoverage: complete && policy.mode === "full",
        coverage: {
          publishedLosses: state.slices.reduce(
            (n, s) => n + (s.losses ?? 0),
            0,
          ),
          reviewedLosses: state.slices.reduce(
            (n, s) => n + (s.reviewedLosses ?? 0),
            0,
          ),
          acknowledgedPages: state.slices.reduce(
            (n, s) =>
              n +
              Object.values(s.reading ?? {}).reduce(
                (m, c) => m + c.hashes.length,
                0,
              ),
            0,
          ),
          legacyCountsUnknown: state.slices.some((s) => s.losses === undefined),
        },
        claim,
        dispatch: state.slices.filter((s) => s.status === "pending"),
        summary: state.summary ?? null,
        preparationComplete:
          state.slices.length === (state.expectedSlices ?? state.slices.length),
        instructions:
          "Publish slices until preparationComplete. For version 4 use loss-review-queue.ts and one subagent per readable loss file; submit aggregate match findings without page acknowledgements. Preserve historical packet reading protocols on older cohorts. Status is metadata-only; audit verifies full evidence.",
      };
    },
    action.action === "complete" ||
      action.action === "checkpoint" ||
      action.action === "audit",
  );
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  try {
    const [session, request] = process.argv.slice(2);
    if (!session || !request)
      throw Error(
        "Usage: node scripts/bot-improvement/analysis-slices.ts SESSION REQUEST.json",
      );
    console.log(
      JSON.stringify(
        await (async () => {
          const action = await json(request);
          if (action.action !== "sync")
            return prepareAnalysisSlices(session, action);
          return ownedOperation(
            path.join(
              session,
              `analysis-preparation-${action.binding.iteration}-${action.binding.role}.json`,
            ),
            digest(JSON.stringify(action)),
            (progress) => prepareAnalysisSlices(session, action, progress),
          );
        })(),
      ),
    );
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
}
