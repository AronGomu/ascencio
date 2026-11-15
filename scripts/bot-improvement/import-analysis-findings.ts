import { targetLossView } from "./game-log.ts";
/** Reuse only fully reviewed, source-identical findings in an explicitly claimed cohort. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { json, save } from "./session-checkpoint.ts";
import { readEvidence } from "./analysis-evidence.ts";
import { analysisScope } from "./analysis-scope.ts";
import { prepareAnalysisSlices } from "./analysis-slices.ts";
import { validateAnalysisReport } from "./analysis-report.ts";
import { digest } from "./session-fixtures.ts";
import type {
  AnalysisQueue,
  AnalysisPacket,
  LossMatchReport,
} from "./analysis-contract.ts";
import type { EvidenceReference } from "./session-control-contract.ts";
interface ImportPacket {
  jobs: {
    id: string;
    match: string;
    packetSha256: string;
    losses: {
      game: number;
      log: EvidenceReference;
      review?: { pages: { pageSha256: string }[] };
    }[];
  }[];
}
export async function importAnalysisFindings(
  session: string,
  request: {
    iteration: number;
    role: "control" | "candidate";
    sourceAnalysisId?: string;
    analysisId: string;
    slice: string;
    token: string;
  },
) {
  const sourceScope = analysisScope(
      request.iteration,
      request.role,
      request.sourceAnalysisId,
    ),
    targetScope = analysisScope(
      request.iteration,
      request.role,
      request.analysisId,
    );
  if (sourceScope === targetScope)
    throw Error("Source and destination cohorts must differ");
  const source = (await json(
    path.join(session, sourceScope, "queue.json"),
  )) as AnalysisQueue;
  const target = (await json(
    path.join(session, targetScope, "queue.json"),
  )) as AnalysisQueue;
  if (
    source.executionIdentity !== target.executionIdentity ||
    source.fixtureIdentity !== target.fixtureIdentity ||
    source.runnerIdentity !== target.runnerIdentity
  )
    throw Error("Cohort evaluation identity mismatch");
  const slices = await json(path.join(session, targetScope, "slices.json"));
  const slice = slices.slices.find(
    (s: { id: string }) => s.id === request.slice,
  );
  if (slice?.status !== "claimed" || slice.claim?.token !== request.token)
    throw Error("Stale or unknown target claim");
  const packet = JSON.parse(
    (await readEvidence(session, slice.packet)).toString(),
  ) as ImportPacket;
  const imported: string[] = [];
  for (const input of packet.jobs) {
    if (slice.completedJobs?.includes(input.id)) continue;
    const old = source.jobs.find(
      (j) => j.match === input.match && j.status === "complete" && j.report,
    );
    const current = target.jobs.find((j) => j.id === input.id);
    if (!old?.report || !current) continue;
    if (
      old.packet.sha256 !== current.packet.sha256 ||
      current.packet.sha256 !== input.packetSha256
    )
      throw Error("Imported packet identity mismatch");
    const full = JSON.parse(
      (await readEvidence(session, old.packet)).toString(),
    ) as AnalysisPacket;
    for (const ref of [...full.files, full.proposal])
      await readEvidence(session, ref);
    const report = JSON.parse(
      (await readEvidence(session, old.report)).toString(),
    ) as LossMatchReport;
    validateAnalysisReport(report, full, old.packet.sha256);
    if (!report.reasons)
      throw Error(
        "Import requires complete structured primary and secondary findings",
      );
    for (const loss of input.losses) {
      const expected = full.files.find((f) =>
        f.path.endsWith(`/games/game-${loss.game}/loss.log`),
      );
      // Reconstruct legacy projections from verified authoritative bytes.
      let sourceHash = expected?.sha256;
      if (!sourceHash) {
        const log = full.files.find((f) =>
          f.path.endsWith(`/games/game-${loss.game}/game.log`),
        );
        if (log)
          sourceHash = digest(
            targetLossView((await readEvidence(session, log)).toString()),
          );
      }
      if (sourceHash !== loss.log.sha256)
        throw Error("Imported loss projection identity mismatch");
      await readEvidence(session, loss.log);
      for (const [i, page] of (loss.review?.pages ?? []).entries())
        await prepareAnalysisSlices(session, {
          action: "read-page",
          iteration: request.iteration,
          role: request.role,
          analysisId: request.analysisId,
          slice: request.slice,
          token: request.token,
          match: input.match,
          game: loss.game,
          page: i + 1,
          sha256: page.pageSha256,
        });
    }
    await prepareAnalysisSlices(session, {
      action: "checkpoint",
      iteration: request.iteration,
      role: request.role,
      analysisId: request.analysisId,
      slice: request.slice,
      token: request.token,
      findings: [report],
    });
    const provenance = {
      sourceQueue: `${sourceScope}/queue.json`,
      sourceReport: old.report,
      targetPacket: slice.packet,
      match: input.match,
      coverage: "completed-source-review",
      executedGames: 0,
    };
    await save(
      path.join(
        session,
        targetScope,
        "imports",
        `${digest(JSON.stringify(provenance))}.json`,
      ),
      provenance,
    );
    imported.push(input.match);
  }
  return { imported, executedGames: 0 };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [session, request] = process.argv.slice(2);
  if (!session || !request)
    throw Error("Usage: import-analysis-findings.ts SESSION REQUEST.json");
  console.log(
    JSON.stringify(await importAnalysisFindings(session, await json(request))),
  );
}
