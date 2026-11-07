import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { withSessionLock } from "./session-lock.ts";
import { json, optionalJson, save } from "./session-checkpoint.ts";
import { digest } from "./session-fixtures.ts";
import { analysisPath, readEvidence } from "./analysis-evidence.ts";
import { discoverAnalyses } from "./analysis-discovery.ts";
import { validateAnalysisReport } from "./analysis-report.ts";
import type {
  AnalysisAction,
  AnalysisPacket,
  AnalysisQueue,
} from "./analysis-contract.ts";
import type { EvidenceReference } from "./session-control-contract.ts";

function scope(iteration: number, role: string) {
  if (
    !Number.isSafeInteger(iteration) ||
    iteration < 1 ||
    !["control", "candidate"].includes(role)
  )
    throw new Error("Invalid analysis iteration/role");
  return `iterations/iteration-${String(iteration).padStart(4, "0")}/analyses/${role}`;
}
async function ensureDirectory(session: string, relative: string) {
  const parts = relative.split("/");
  for (let i = 1; i <= parts.length; i++) {
    const current = parts.slice(0, i).join("/");
    try {
      await mkdir(path.join(session, current));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    await analysisPath(session, current);
  }
}
async function packetAt(session: string, ref: EvidenceReference) {
  return JSON.parse(
    (await readEvidence(session, ref)).toString(),
  ) as AnalysisPacket;
}
async function intactPacket(session: string, ref: EvidenceReference) {
  const packet = await packetAt(session, ref);
  for (const file of [...packet.files, packet.proposal])
    await readEvidence(session, file);
  return packet;
}
async function publish(session: string, relative: string, value: unknown) {
  const file = path.join(session, relative);
  let previous: Buffer | null = null;
  try {
    previous = await readFile(await analysisPath(session, relative));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (previous !== null) {
    if (!isDeepStrictEqual(JSON.parse(previous.toString()), value))
      throw new Error(`Conflicting immutable analysis artifact: ${relative}`);
  } else await save(file, value);
  return { path: relative, sha256: digest(await readFile(file)) };
}
function pump(queue: AnalysisQueue) {
  let capacity =
    queue.queueLimit -
    queue.jobs.filter((j) => j.status === "pending" || j.status === "claimed")
      .length;
  for (const job of queue.jobs)
    if (job.status === "waiting" && capacity > 0) {
      job.status = "pending";
      capacity--;
    }
}
/** Deterministic queue/claim/report transitions. Never dispatches an agent. */
export async function prepareAnalyses(session: string, action: AnalysisAction) {
  session = path.resolve(session);
  const binding = action.action === "sync" ? action.binding : action;
  const directory = scope(binding.iteration, binding.role);
  // Read large runner logs outside the short shared publication transaction.
  const discovered =
    action.action === "sync"
      ? await discoverAnalyses(session, action.binding)
      : null;
  const stateFile = path.join(session, directory, "queue.json");
  const snapshot = (await optionalJson(stateFile)) as AnalysisQueue | null;
  const integrity: { job: string; reason: string }[] = [];
  for (const job of snapshot?.jobs ?? []) {
    try {
      // Status exposes damage instead of silently counting an invalid completion.
      await intactPacket(session, job.packet);
      if (job.report) {
        const packet = await packetAt(session, job.packet);
        const report = JSON.parse(
          (await readEvidence(session, job.report)).toString(),
        );
        validateAnalysisReport(report, packet, job.packet.sha256);
      }
    } catch (error) {
      integrity.push({ job: job.id, reason: String(error) });
    }
  }
  return withSessionLock(session, async () => {
    await analysisPath(
      session,
      `iterations/iteration-${String(binding.iteration).padStart(4, "0")}`,
    );
    const existing = (await optionalJson(stateFile)) as AnalysisQueue | null;
    if (!existing && !discovered)
      throw new Error("Sync analysis evidence before dispatch");
    const queue: AnalysisQueue = existing ?? discovered!.queue;
    if (
      queue.schemaVersion !== 1 ||
      queue.binding.iteration !== binding.iteration ||
      queue.binding.role !== binding.role
    )
      throw new Error("Invalid analysis queue");
    if (discovered) {
      if (
        !isDeepStrictEqual(queue.binding, discovered.queue.binding) ||
        queue.fixtureIdentity !== discovered.queue.fixtureIdentity ||
        queue.executionIdentity !== discovered.queue.executionIdentity ||
        queue.runnerIdentity !== discovered.queue.runnerIdentity ||
        queue.workers !== discovered.queue.workers
      )
        throw new Error("Analysis queue binding changed");
      await ensureDirectory(session, `${directory}/packets`);
      await ensureDirectory(session, `${directory}/reports`);
      for (const packet of discovered.packets) {
        const ref = await publish(
          session,
          `${directory}/packets/${packet.match}.json`,
          packet,
        );
        const previous = queue.jobs.find((j) => j.id === packet.id);
        if (previous && !isDeepStrictEqual(previous.packet, ref))
          throw new Error("Finalized match changed after enqueue");
        if (!previous)
          queue.jobs.push({
            id: packet.id,
            match: packet.match,
            packet: ref,
            status: "waiting",
            attempt: 0,
          });
      }
      queue.jobs.sort((a, b) => a.match.localeCompare(b.match));
    }
    pump(queue);
    let claim: AnalysisQueue["jobs"][number] | null = null;
    if (action.action === "claim") {
      if (typeof action.owner !== "string" || !action.owner.trim())
        throw new Error("Claim owner is required");
      // A retry after losing stdout returns the original claim, never claims a second job.
      claim =
        queue.jobs.find(
          (j) => j.status === "claimed" && j.claim?.owner === action.owner,
        ) ?? null;
      if (
        !claim &&
        queue.jobs.filter((j) => j.status === "claimed").length < queue.workers
      ) {
        claim = queue.jobs.find((j) => j.status === "pending") ?? null;
        if (claim) {
          claim.status = "claimed";
          claim.attempt++;
          claim.claim = { token: randomUUID(), owner: action.owner };
        }
      }
      if (claim) await intactPacket(session, claim.packet);
    } else if (action.action === "release" || action.action === "complete") {
      const job = queue.jobs.find((j) => j.id === action.job);
      if (!job || !job.claim || job.claim.token !== action.token)
        throw new Error("Stale or unknown analysis claim");
      if (action.action === "release") {
        if (action.terminated !== true)
          throw new Error("Confirm analyst termination before release");
        if (job.status !== "claimed")
          throw new Error("Only claimed jobs can be released");
        job.status = "pending";
        delete job.claim;
      } else {
        const packet = await intactPacket(session, job.packet);
        const report = JSON.parse(
          (await readEvidence(session, action.report)).toString(),
        );
        validateAnalysisReport(report, packet, job.packet.sha256);
        const ref = await publish(
          session,
          `${directory}/reports/${job.match}-attempt-${job.attempt}.json`,
          report,
        );
        if (job.status === "complete" && !isDeepStrictEqual(job.report, ref))
          throw new Error("Conflicting completed report");
        job.report = ref;
        job.status = "complete";
      }
    } else if (!["sync", "status"].includes(action.action))
      throw new Error("Unknown analysis action");
    pump(queue);
    await save(stateFile, queue);
    const outstanding = queue.jobs.filter((j) => j.status !== "complete");
    const missing = queue.expected.filter(
      (m) => !queue.jobs.some((j) => j.match === m),
    );
    return {
      schemaVersion: 1,
      queue: stateFile,
      expected: queue.expected.length,
      finalized: queue.jobs.length,
      completed: queue.jobs.filter((j) => j.status === "complete").length,
      complete:
        missing.length === 0 &&
        outstanding.length === 0 &&
        integrity.length === 0,
      workers: queue.workers,
      queueLimit: queue.queueLimit,
      ready: queue.jobs.filter((j) => j.status === "pending"),
      outstanding,
      missing,
      reports: queue.jobs
        .filter((j) => j.report)
        .map((j) => ({ job: j.id, report: j.report })),
      unavailable: discovered?.unavailable ?? [],
      integrity,
      claim,
      validation:
        "Structural sections and resolvable references only; factual and causal correctness require agent review.",
    };
  });
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [session, request] = process.argv.slice(2);
    if (!session || !request)
      throw new Error("Usage: npm run bot:analyses -- SESSION REQUEST.json");
    console.log(
      JSON.stringify(await prepareAnalyses(session, await json(request))),
    );
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
}
