/** One readable loss and one analyst per claim; match reports remain the publication boundary. */
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { mkdir, lstat, readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { readEvidence, readEvidenceJson } from "./analysis-evidence.ts";
import { reviewCardNames } from "./review-card-names.ts";
import { readableLossReview } from "./readable-loss-review.ts";
import { lossDecisions } from "./loss-review.ts";
import { digest } from "./session-fixtures.ts";
import { json, optionalJson, save } from "./session-checkpoint.ts";
import { ensureSessionOutput, writeOutput } from "./output-storage.ts";
import { retrySession } from "./match-session.ts";
import { withSessionLock } from "./session-lock.ts";
import type { EvidenceReference } from "./session-control-contract.ts";
import type { LossMatchReport, LossReason } from "./analysis-contract.ts";

type Finding = LossMatchReport["findings"][number];
interface Packet {
  executionIdentity: string;
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
        version: number;
        pages: (EvidenceReference & {
          offset: number;
          bytes: number;
          pageSha256: string;
        })[];
      };
    }[];
  }[];
}
interface LossJob {
  id: string;
  match: string;
  game: number;
  parentJob: string;
  packetSha256: string;
  source: EvidenceReference;
  review: EvidenceReference;
  choices: EvidenceReference;
  decisions: string[];
  status: "pending" | "claimed" | "complete";
  owners: string[];
  claim?: { owner: string; token: string };
  result?: EvidenceReference;
}
interface State {
  schemaVersion: 1;
  format: "readable-loss-queue-v1";
  packet: EvidenceReference;
  executionIdentity: string;
  workers: number;
  runtimeSlots: number;
  jobs: LossJob[];
}
export type LossReviewAction = { queue: string } & (
  | {
      action: "prepare";
      packet: EvidenceReference;
      workers: number;
      runtimeSlots: number;
    }
  | { action: "claim"; owner: string }
  | { action: "status" }
  | { action: "audit" }
  | { action: "release"; id: string; token: string; terminated: true }
  | {
      action: "complete";
      id: string;
      token: string;
      reviewSha256: string;
      finding: Finding;
      reasons: LossReason[];
    }
);
function safe(value: string) {
  if (
    !value ||
    path.isAbsolute(value) ||
    value.split(/[\\/]/).some((p) => !p || p === "." || p === "..")
  )
    throw Error("Unsafe review queue path");
  return value;
}
/** Check every existing component before reads or writes, including partially prepared directories. */
async function outputPath(session: string, relative: string) {
  let current = session;
  if ((await lstat(current)).isSymbolicLink())
    throw Error("Symlink session is unsupported");
  for (const part of safe(relative).split(/[\\/]/)) {
    current = path.join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink())
        throw Error("Symlink review output is unsupported");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return current;
}
async function publish(session: string, relative: string, bytes: string) {
  const file = await outputPath(session, relative);
  try {
    if ((await readFile(file, "utf8")) !== bytes)
      throw Error("Existing review output differs; use a fresh queue");
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await writeOutput(file, bytes, true);
}
async function verifyJob(session: string, job: LossJob) {
  const source = (await readEvidence(session, job.source)).toString();
  await readEvidence(session, job.review);
  await readEvidence(session, job.choices);
  return lossDecisions(source);
}
function validateFinding(
  job: LossJob,
  finding: Finding,
  reasons: LossReason[],
  choices: ReturnType<typeof lossDecisions>,
) {
  const prose = (s: unknown) =>
    typeof s === "string" && s.trim().length > 0 && !/[\r\n|]/.test(s);
  if (
    finding.game !== job.game ||
    !["avoidable", "unavoidable", "unclear"].includes(finding.classification) ||
    !prose(finding.reason) ||
    !prose(finding.solution) ||
    (finding.decision !== null && !Object.hasOwn(choices, finding.decision)) ||
    (finding.classification === "avoidable" && !finding.decision)
  )
    throw Error("Invalid loss finding or foreign decision");
  if (!Array.isArray(reasons))
    throw Error("Complete first-pass reasons required");
  const ids = new Set<string>();
  for (const reason of reasons) {
    if (
      reason.game !== job.game ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(reason.id) ||
      ids.has(reason.id) ||
      !prose(reason.reason) ||
      !prose(reason.solution) ||
      !Object.hasOwn(choices, reason.decision) ||
      !isDeepStrictEqual(choices[reason.decision], {
        offered: reason.offered,
        chosen: reason.chosen,
      })
    )
      throw Error("Invalid reason or choices differ from recorded decision");
    ids.add(reason.id);
  }
  if (
    finding.classification === "avoidable" &&
    !reasons.some((r) => r.decision === finding.decision)
  )
    throw Error("Avoidable primary finding requires a supported reason");
}
async function summary(
  session: string,
  state: State,
  claim: LossJob | null = null,
) {
  const reports: LossMatchReport[] = [];
  for (const parentJob of new Set(state.jobs.map((j) => j.parentJob))) {
    const jobs = state.jobs.filter((j) => j.parentJob === parentJob);
    if (!jobs.every((j) => j.status === "complete")) continue;
    const results = await Promise.all(
      jobs.map((j) =>
        readEvidenceJson<{ finding: Finding; reasons: LossReason[] }>(
          session,
          j.result!,
        ),
      ),
    );
    reports.push({
      schemaVersion: 1,
      format: "loss-markdown-v1",
      job: parentJob,
      packetSha256: jobs[0]!.packetSha256,
      findings: results.map((r) => r.finding),
      reasons: results.flatMap((r) => r.reasons),
    });
  }
  return {
    complete: state.jobs.every((j) => j.status === "complete"),
    losses: state.jobs.length,
    reviewedLosses: state.jobs.filter((j) => j.status === "complete").length,
    active: state.jobs.filter((j) => j.status === "claimed").length,
    workers: state.workers,
    claim,
    reports,
  };
}
export async function reviewLossQueue(
  session: string,
  action: LossReviewAction,
) {
  session = path.resolve(session);
  const queue = safe(action.queue),
    file = path.join(session, queue, "queue.json");
  await outputPath(session, `${queue}/queue.json`);
  await ensureSessionOutput(session);
  return retrySession(session, () =>
    withSessionLock(session, async () => {
      await outputPath(session, `${queue}/queue.json`);
      const config = await json(path.join(session, "config.json"));
      const control = await optionalJson(path.join(session, "control.json"));
      if (!["status", "audit", "release"].includes(action.action)) {
        const marker = await readFile(path.join(session, "OWNER_STOP")).then(
          digest,
          (error) => {
            if (error.code === "ENOENT") return null;
            throw error;
          },
        );
        if (marker && marker !== control?.acknowledgedMarker)
          throw Error("Session has an unacknowledged OWNER_STOP");
        if (
          control?.stoppingReason &&
          !["max-iterations", "max-games"].includes(control.stoppingReason)
        )
          throw Error(`Session stopped: ${control.stoppingReason}`);
        const maxWallMs =
          control?.limits?.maxWallMs ?? config.limits?.stop?.maxWallMs;
        if (
          control?.startedAt &&
          maxWallMs &&
          Date.now() - control.startedAt >= maxWallMs
        )
          throw Error("Session wall budget exhausted");
      }
      let state = (await optionalJson(file)) as State | null;
      if (action.action === "prepare") {
        if (
          !Number.isSafeInteger(action.workers) ||
          action.workers < 1 ||
          action.workers > 64 ||
          !Number.isSafeInteger(action.runtimeSlots) ||
          action.runtimeSlots < action.workers ||
          action.runtimeSlots > 64
        )
          throw Error("Invalid analyst worker capacity");
        const packet = await readEvidenceJson<Packet>(session, action.packet);
        if (state) {
          if (
            !isDeepStrictEqual(state.packet, action.packet) ||
            state.workers !== action.workers ||
            state.runtimeSlots !== action.runtimeSlots
          )
            throw Error("Review cohort is immutable; prepare a fresh queue");
          return summary(session, state);
        }
        state = {
          schemaVersion: 1,
          format: "readable-loss-queue-v1",
          packet: action.packet,
          executionIdentity: packet.executionIdentity,
          workers: action.workers,
          runtimeSlots: action.runtimeSlots,
          jobs: [],
        };
        await mkdir(path.dirname(file), { recursive: true });
        const cardNames = config.fixture?.path
          ? await reviewCardNames(config.fixture.path)
          : {};
        const ids = new Set<string>();
        for (const parent of packet.jobs)
          for (const loss of parent.losses) {
            if (!/^[a-zA-Z0-9_-]+$/.test(parent.match))
              throw Error("Unsafe match identifier");
            if (
              !Number.isSafeInteger(loss.game) ||
              loss.game < 1 ||
              loss.game > 4
            )
              throw Error("Invalid game number");
            const id = `${parent.match}-game-${loss.game}`;
            if (ids.has(id)) throw Error("Duplicate loss in packet");
            ids.add(id);
            const text = (await readEvidence(session, loss.log)).toString();
            const decisions = Object.keys(lossDecisions(text));
            if (!isDeepStrictEqual(decisions, loss.decisions))
              throw Error("Loss decision allowlist mismatch");
            const rendered = readableLossReview(text, { cardNames });
            let reviewText = rendered.text;
            if (loss.review?.version === 4) {
              if (loss.review.pages.length !== 1)
                throw Error("Readable loss review requires one file");
              const page = loss.review.pages[0]!;
              const bytes = await readEvidence(session, page);
              if (
                page.offset !== 0 ||
                page.bytes !== bytes.length ||
                page.pageSha256 !== page.sha256
              )
                throw Error(
                  "Readable loss review must reference its complete file",
                );
              reviewText = bytes.toString();
            }
            const relative = `${queue}/losses/${id}.md`;
            await publish(session, relative, reviewText);
            if (
              loss.choiceMap &&
              !isDeepStrictEqual(
                await readEvidenceJson(session, loss.choiceMap),
                rendered.choiceMap,
              )
            )
              throw Error("Readable choice map differs from source decisions");
            const choicesPath = `${queue}/losses/${id}.choices.json`;
            const choicesBytes =
              JSON.stringify(rendered.choiceMap, null, 2) + "\n";
            await publish(session, choicesPath, choicesBytes);
            state.jobs.push({
              id,
              match: parent.match,
              game: loss.game,
              parentJob: parent.id,
              packetSha256: parent.packetSha256,
              source: loss.log,
              review: { path: relative, sha256: digest(reviewText) },
              choices: { path: choicesPath, sha256: digest(choicesBytes) },
              decisions,
              status: "pending",
              owners: [],
            });
          }
        await save(file, state);
        return summary(session, state);
      }
      if (!state) throw Error("Prepare review queue first");
      if (
        state.schemaVersion !== 1 ||
        state.format !== "readable-loss-queue-v1"
      )
        throw Error("Unsupported review queue");
      await readEvidence(session, state.packet);
      if (action.action === "status") return summary(session, state);
      if (action.action === "audit") {
        for (const job of state.jobs) {
          const choices = await verifyJob(session, job);
          if (job.result) {
            const result = await readEvidenceJson<{
              finding: Finding;
              reasons: LossReason[];
            }>(session, job.result);
            validateFinding(job, result.finding, result.reasons, choices);
          }
        }
        return summary(session, state);
      }
      if (action.action === "claim") {
        if (!action.owner.trim()) throw Error("Analyst owner required");
        const own = state.jobs.find((j) => j.owners.includes(action.owner));
        if (own) {
          if (own.status === "claimed" && own.claim?.owner === action.owner) {
            await verifyJob(session, own);
            return summary(session, state, own);
          }
          throw Error("Each loss needs a distinct analyst owner");
        }
        if (
          state.jobs.filter((j) => j.status === "claimed").length >=
          state.workers
        )
          return summary(session, state);
        const job = state.jobs.find((j) => j.status === "pending");
        if (!job) return summary(session, state);
        await verifyJob(session, job);
        job.status = "claimed";
        job.owners.push(action.owner);
        job.claim = { owner: action.owner, token: randomUUID() };
        await save(file, state);
        return summary(session, state, job);
      }
      const job = state.jobs.find((j) => j.id === action.id);
      if (
        !job ||
        job.claim?.token !== action.token ||
        (job.status !== "claimed" && action.action !== "complete")
      )
        throw Error("Stale or unknown loss claim");
      if (action.action === "release") {
        if (action.terminated !== true)
          throw Error("Release requires terminated owner");
        job.status = "pending";
        delete job.claim;
        await save(file, state);
        return summary(session, state);
      }
      if (action.reviewSha256 !== job.review.sha256)
        throw Error("Reviewed file hash mismatch");
      const choices = await verifyJob(session, job);
      validateFinding(job, action.finding, action.reasons, choices);
      const value = { finding: action.finding, reasons: action.reasons };
      if (job.result) {
        if (
          !isDeepStrictEqual(await readEvidenceJson(session, job.result), value)
        )
          throw Error("Completed findings are immutable");
        return summary(session, state);
      }
      const relative = `${queue}/findings/${job.id}.json`,
        bytes = JSON.stringify(value, null, 2) + "\n";
      await publish(session, relative, bytes);
      job.result = { path: relative, sha256: digest(bytes) };
      job.status = "complete";
      await save(file, state);
      return summary(session, state);
    }),
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [session, request] = process.argv.slice(2);
  if (!session || !request)
    throw Error("Usage: node loss-review-queue.ts SESSION REQUEST.json");
  console.log(
    JSON.stringify(await reviewLossQueue(session, await json(request))),
  );
}
