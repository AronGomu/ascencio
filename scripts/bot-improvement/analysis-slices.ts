/** Durable one-owner-per-250-match dispatch; packets contain target losses only. */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { writeOutput } from "./output-storage.ts";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import { prepareAnalyses } from "./prepare-analyses.ts";
import { json, optionalJson, save } from "./session-checkpoint.ts";
import { analysisPath, readEvidence } from "./analysis-evidence.ts";
import { digest } from "./session-fixtures.ts";
import { targetLossView } from "./game-log.ts";
import {
  parseLossMarkdown,
  validateAnalysisReport,
} from "./analysis-report.ts";
import { retrySession } from "./match-session.ts";
import { withSessionLock } from "./session-lock.ts";
import type {
  AnalysisBinding,
  AnalysisPacket,
  AnalysisQueue,
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
    losses: { game: number; log: EvidenceReference; decisions: string[] }[];
  }[];
}
interface Slice {
  id: string;
  packet: EvidenceReference;
  status: "pending" | "claimed" | "complete";
  attempt: number;
  claim?: { owner: string; token: string };
  reports?: EvidenceReference[];
}
interface SliceState {
  schemaVersion: 1;
  binding: AnalysisBinding;
  executionIdentity: string;
  slices: Slice[];
}
export type SliceAction =
  | { action: "sync"; binding: AnalysisBinding }
  | ({ iteration: number; role: AnalysisBinding["role"] } & (
      | { action: "status" }
      | { action: "claim"; owner: string }
      | { action: "release"; slice: string; token: string; terminated: true }
      | {
          action: "complete";
          slice: string;
          token: string;
          reports: EvidenceReference[];
        }
    ));
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
const encode = (v: unknown) => JSON.stringify(v, null, 2) + "\n";
export async function prepareAnalysisSlices(
  session: string,
  action: SliceAction,
) {
  session = path.resolve(session);
  const binding = action.action === "sync" ? action.binding : action;
  if (
    !Number.isSafeInteger(binding.iteration) ||
    binding.iteration < 1 ||
    !["control", "candidate"].includes(binding.role)
  )
    throw Error("Invalid slice scope");
  const scope = `iterations/iteration-${String(binding.iteration).padStart(4, "0")}/analyses/${binding.role}`;
  if (action.action === "sync") {
    const result = await prepareAnalyses(session, {
      action: "sync",
      binding: action.binding,
    });
    if (result.missing.length || result.integrity.length)
      throw Error(
        "All matches must be finalized and intact before slice dispatch",
      );
  }
  return retrySession(session, () =>
    withSessionLock(session, async () => {
      const queuePath = path.join(session, scope, "queue.json");
      const queue = (await json(queuePath)) as AnalysisQueue;
      if (queue.expected.some((m) => !queue.jobs.some((j) => j.match === m)))
        throw Error("All matches must finalize before slice dispatch");
      const statePath = path.join(session, scope, "slices.json");
      let state = (await optionalJson(statePath)) as SliceState | null;
      if (action.action === "sync") {
        if (state && !isDeepStrictEqual(state.binding, action.binding))
          throw Error("Slice binding changed");
        const slices: Slice[] = [];
        for (let start = 0; start < queue.expected.length; start += 250) {
          const matches = queue.expected.slice(start, start + 250),
            id = `slice-${String(start / 250 + 1).padStart(4, "0")}`;
          const packet: SlicePacket = {
            schemaVersion: 1,
            id,
            executionIdentity: queue.executionIdentity,
            startMatch: start + 1,
            endMatch: start + matches.length,
            matches,
            jobs: [],
          };
          for (const match of matches) {
            const job = queue.jobs.find((j) => j.match === match)!;
            const source = JSON.parse(
              (await readEvidence(session, job.packet)).toString(),
            ) as AnalysisPacket;
            if (source.lossGames === undefined)
              throw Error(
                "Slice analysis requires loss-aware text evidence; migrate legacy records first",
              );
            if (!source.lossGames.length) continue;
            const losses: SlicePacket["jobs"][number]["losses"] = [];
            for (const loss of source.lossGames) {
              const log = source.files.find((f) =>
                f.path.endsWith(`/games/game-${loss.game}/game.log`),
              );
              if (!log)
                throw Error(
                  "Slice analysis requires authoritative game.log evidence",
                );
              const text = targetLossView(
                (await readEvidence(session, log)).toString(),
              );
              const ref = await immutable(
                session,
                `${scope}/slices/${id}/losses/${match}-game-${loss.game}.log`,
                text,
              );
              losses.push({ ...loss, log: ref });
            }
            packet.jobs.push({
              id: job.id,
              packetSha256: job.packet.sha256,
              match,
              losses,
            });
          }
          const ref = await immutable(
            session,
            `${scope}/slices/${id}/packet.json`,
            encode(packet),
          );
          const existing = state?.slices.find((s) => s.id === id);
          if (existing && !isDeepStrictEqual(existing.packet, ref))
            throw Error("Slice packet changed");
          slices.push(
            existing ?? { id, packet: ref, status: "pending", attempt: 0 },
          );
        }
        state = {
          schemaVersion: 1,
          binding: action.binding,
          executionIdentity: queue.executionIdentity,
          slices,
        };
      }
      if (!state || state.executionIdentity !== queue.executionIdentity)
        throw Error("Sync slices before dispatch");
      // Packets are small immutable allowlists; do not reread every slice's
      // gameplay while holding the shared publication lock on each status call.
      for (const slice of state.slices)
        await readEvidence(session, slice.packet);
      let claim: Slice | null = null;
      if (action.action === "claim") {
        if (!action.owner.trim()) throw Error("Slice owner required");
        claim =
          state.slices.find(
            (s) => s.status === "claimed" && s.claim?.owner === action.owner,
          ) ?? null;
        if (!claim) {
          claim = state.slices.find((s) => s.status === "pending") ?? null;
          if (claim) {
            claim.status = "claimed";
            claim.attempt++;
            claim.claim = { owner: action.owner, token: randomUUID() };
          }
        }
      } else if (action.action === "release" || action.action === "complete") {
        const slice = state.slices.find((s) => s.id === action.slice);
        if (!slice?.claim || slice.claim.token !== action.token)
          throw Error("Stale or unknown slice claim");
        if (action.action === "release") {
          if (action.terminated !== true || slice.status !== "claimed")
            throw Error("Confirm slice analyst termination");
          slice.status = "pending";
          delete slice.claim;
        } else {
          if (!Array.isArray(action.reports))
            throw Error("Slice match reports required");
          if (slice.status === "complete") {
            if (!isDeepStrictEqual(slice.reports, action.reports))
              throw Error("Conflicting completed slice");
          } else {
            const packet = JSON.parse(
              (await readEvidence(session, slice.packet)).toString(),
            ) as SlicePacket;
            const submitted = new Map<
              string,
              { ref: EvidenceReference; text: string }
            >();
            for (const ref of action.reports) {
              const text = (await readEvidence(session, ref)).toString();
              const id = /^Job:\s*(.+)$/m.exec(text)?.[1]?.trim();
              if (
                !id ||
                submitted.has(id) ||
                !packet.jobs.some((j) => j.id === id)
              )
                throw Error("Duplicate/foreign slice report");
              submitted.set(id, { ref, text });
            }
            if (submitted.size !== packet.jobs.length)
              throw Error("Incomplete slice loss coverage");
            for (const input of packet.jobs) {
              for (const loss of input.losses)
                await readEvidence(session, loss.log);
              const job = queue.jobs.find((j) => j.id === input.id)!;
              const full = JSON.parse(
                (await readEvidence(session, job.packet)).toString(),
              ) as AnalysisPacket;
              for (const ref of [...full.files, full.proposal])
                await readEvidence(session, ref);
              const { text } = submitted.get(input.id)!;
              const parsed = parseLossMarkdown(text, full, job.packet.sha256);
              validateAnalysisReport(parsed, full, job.packet.sha256);
              const stem = `${scope}/reports/${job.match}-${slice.id}-attempt-${slice.attempt}`;
              const findings = await immutable(session, `${stem}.md`, text),
                report = await immutable(
                  session,
                  `${stem}.json`,
                  encode(parsed),
                );
              if (job.status === "claimed")
                throw Error("A match analyst already owns this slice’s work");
              if (job.report && !isDeepStrictEqual(job.report, report))
                throw Error("Conflicting match completion");
              job.findings = findings;
              job.report = report;
              job.status = "complete";
            }
            await save(queuePath, queue);
            slice.reports = action.reports;
            slice.status = "complete";
          }
        }
      } else if (action.action !== "sync" && action.action !== "status")
        throw Error("Unknown slice action");
      await save(statePath, state);
      const complete = state.slices.every((s) => s.status === "complete");
      let summary: EvidenceReference | null = null;
      if (complete) {
        const reasons = new Map<
          string,
          { reason: string; solution: string; points: Set<string> }
        >();
        let reviewed = 0,
          unclear = 0;
        for (const job of queue.jobs) {
          if (!job.report) throw Error("Missing loss report at consolidation");
          const report = JSON.parse(
            (await readEvidence(session, job.report)).toString(),
          );
          for (const finding of report.findings ?? []) {
            reviewed++;
            if (finding.classification === "unclear") unclear++;
            if (finding.classification !== "avoidable") continue;
            const key = finding.reason
              .trim()
              .toLowerCase()
              .replace(/\s+/g, " ");
            const item = reasons.get(key) ?? {
              reason: finding.reason,
              solution: finding.solution,
              points: new Set<string>(),
            };
            item.points.add(
              `${job.match}/G${finding.game}@${finding.decision}`,
            );
            reasons.set(key, item);
          }
        }
        const eligible = [...reasons.values()]
          .filter((r) => r.points.size >= 5)
          .sort(
            (a, b) =>
              b.points.size - a.points.size || a.reason.localeCompare(b.reason),
          );
        const text =
          `# Loss Analysis — Iteration ${binding.iteration} / ${binding.role}\n\n${queue.expected.length * 4} scheduled games · ${reviewed} losses reviewed · ${unclear} unclear · ${eligible.length} eligible reasons.\n\n` +
          eligible
            .map(
              (r, i) =>
                `${i + 1}. **${r.reason}** — ${r.points.size} losses.\n   Solution: ${r.solution}\n   Replay points: ${[...r.points].join("; ")}\n`,
            )
            .join("\n");
        summary = await immutable(
          session,
          `${scope}/loss-analysis-draft.md`,
          text,
        );
      }
      return {
        state: statePath,
        workers: state.slices.length,
        complete,
        claim,
        dispatch: state.slices.filter((s) => s.status === "pending"),
        summary,
        instructions:
          "Spawn one analyst per claimed slice. Read only packet.jobs[].losses[].log; return existing per-match Markdown. Orchestrator reconciles semantically equivalent reasons in the consolidated document before rule work.",
      };
    }),
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
      JSON.stringify(await prepareAnalysisSlices(session, await json(request))),
    );
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
}
