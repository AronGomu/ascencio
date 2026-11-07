import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual as equal } from "node:util";
import { verifyFrozen } from "./frozen-setup.ts";
import { digest, identity } from "./session-fixtures.ts";
import { readEvidence } from "./analysis-evidence.ts";
import {
  collectEvaluation,
  recheckEvaluation,
} from "./aggregation-evidence.ts";
import { aggregateStatistics } from "./aggregation-statistics.ts";
import type { AggregationRequest } from "./aggregation-contract.ts";
import type { IterationManifest } from "./iteration-contract.ts";

const json = async (file: string) => JSON.parse(await readFile(file, "utf8"));
/** Deterministic read-only snapshot; no runner, agent or session-state mutation. */
export async function aggregateSession(request: AggregationRequest) {
  if (
    request.schemaVersion !== 1 ||
    !Number.isSafeInteger(request.iteration) ||
    request.iteration < 1 ||
    !/^[a-f0-9]{64}$/.test(request.candidateIdentity)
  )
    throw new Error("Invalid aggregation request");
  const session = path.resolve(request.session);
  const manifestFile = path.join(
    session,
    `iterations/iteration-${String(request.iteration).padStart(4, "0")}/manifest.json`,
  );
  const manifestBytes = await readFile(manifestFile);
  const manifest = JSON.parse(manifestBytes.toString()) as IterationManifest;
  const frozen = await verifyFrozen(manifest.fixture.path);
  const opponents = [
    ...frozen.opponents.map((bot, i) => ({
      slot: `opponent-${i + 1}`,
      identity: bot.identity,
    })),
    { slot: "self", identity: manifest.control.identity },
  ];
  for (const field of [
    "deck",
    "configuration",
    "kind",
    "policy",
    "module",
  ] as const)
    if (!equal(manifest.accepted.bot[field], frozen.target[field]))
      throw new Error("Accepted snapshot changed frozen target inputs");
  const comparisonIdentity = identity({
    fixture: frozen.identity,
    control: manifest.control.identity,
    opponents,
    runnerIdentity: manifest.runnerIdentity,
  });
  const { identity: acceptedIdentity, ...acceptedBody } = manifest.accepted.bot;
  if (
    manifest.schemaVersion !== 1 ||
    manifest.iteration !== request.iteration ||
    manifest.fixture.identity !== frozen.identity ||
    acceptedIdentity !== identity(acceptedBody) ||
    manifest.control.identity !== acceptedIdentity ||
    manifest.accepted.identity !== acceptedIdentity ||
    manifest.self.identity !== acceptedIdentity ||
    !manifest.runnerIdentity ||
    !equal(
      manifest.opponents.map(({ slot, identity }) => ({ slot, identity })),
      opponents,
    ) ||
    manifest.comparisonIdentity !== comparisonIdentity
  )
    throw new Error("Iteration comparison binding mismatch");
  const control = await collectEvaluation(
    session,
    request.control,
    "control",
    frozen,
    manifest,
    request.candidateIdentity,
  );
  const candidate = await collectEvaluation(
    session,
    request.candidate,
    "candidate",
    frozen,
    manifest,
    request.candidateIdentity,
  );
  if (!equal(control.executionSettings, candidate.executionSettings))
    throw new Error("Candidate/control execution limits or budgets differ");
  const overall = aggregateStatistics(control.rows, candidate.rows);
  const perOpponent = opponents.map((opponent) => ({
    ...opponent,
    ...aggregateStatistics(
      control.rows.filter((m) => m.slot === opponent.slot),
      candidate.rows.filter((m) => m.slot === opponent.slot),
    ),
  }));
  const evaluationComplete =
    overall.control.completeMatches === frozen.matches.length &&
    overall.candidate.completeMatches === frozen.matches.length;
  const synthesisReady =
    evaluationComplete &&
    candidate.reports.status === "complete" &&
    ["complete", "not-requested"].includes(control.reports.status);
  await recheckEvaluation(session, control);
  await recheckEvaluation(session, candidate);
  for (const input of [request.control, request.candidate]) {
    await readEvidence(session, input.execution);
    if (input.receipt) await readEvidence(session, input.receipt);
    if (input.analyses) await readEvidence(session, input.analyses);
  }
  if (digest(await readFile(manifestFile)) !== digest(manifestBytes))
    throw new Error("Iteration manifest changed during aggregation");
  const body = {
    schemaVersion: 1 as const,
    iteration: request.iteration,
    fixtureIdentity: frozen.identity,
    comparisonIdentity,
    runnerIdentity: manifest.runnerIdentity,
    controlIdentity: manifest.control.identity,
    candidateIdentity: request.candidateIdentity,
    executions: {
      control: control.executionIdentity,
      candidate: candidate.executionIdentity,
    },
    inputs: {
      manifestSha256: digest(manifestBytes),
      control: request.control,
      candidate: request.candidate,
    },
    evidence: { control: control.files, candidate: candidate.files },
    completeness: {
      evaluationComplete,
      synthesisReady,
      reports: { control: control.reports, candidate: candidate.reports },
    },
    method: {
      version: "paired-match-normal-v1",
      outcomes:
        "Actor A target; wins=1, losses=0, draws=0.5 for score and 0 for win rate. Failed/skipped/unavailable games are excluded, never losses.",
      denominators:
        "Descriptive game rates use all completed games, including partial matches. Match rates use only four-completed-game matches. Paired rates use only identical match IDs complete in both arms; each cluster contributes its four-game mean.",
      uncertainty:
        "Candidate minus control; sample SD of paired match means / sqrt(n); normal approximate 95% interval mean +/- 1.96 SE, untruncated. Interval and SE null below two complete paired clusters. Zero observed variance yields zero SE; small samples and correlated matches limit approximation.",
      weighting:
        "Overall pools scheduled match clusters, weighting opponents by their frozen match counts; per-opponent estimates use that slot only. No imputation, multiple-comparison adjustment, or acceptance decision. Self-play against the pinned accepted snapshot is reported as its own slot.",
      settings: control.executionSettings,
    },
    overall,
    perOpponent,
    unavailable: {
      control: control.rows
        .filter((m) => m.unavailable)
        .map(({ id, unavailable }) => ({ match: id, reason: unavailable })),
      candidate: candidate.rows
        .filter((m) => m.unavailable)
        .map(({ id, unavailable }) => ({ match: id, reason: unavailable })),
    },
  };
  return { ...body, identity: identity(body) };
}
export function aggregationSummary(
  result: Awaited<ReturnType<typeof aggregateSession>>,
) {
  const lines = [
    `Iteration ${result.iteration}; comparison ${result.comparisonIdentity}.`,
    `Evaluation complete: ${result.completeness.evaluationComplete}; synthesis evidence complete: ${result.completeness.synthesisReady}.`,
  ];
  for (const [name, stats] of [
    ["overall", result.overall],
    ...result.perOpponent.map((p) => [p.slot, p] as const),
  ] as const) {
    const paired = stats.paired.winRateDifference;
    lines.push(
      `${name}: control ${stats.control.wins}/${stats.control.completedGames} game wins; candidate ${stats.candidate.wins}/${stats.candidate.completedGames}; paired win-rate difference ${paired.estimate ?? "unavailable"}, 95% interval ${paired.interval95 ? `[${paired.interval95.join(", ")}]` : "unavailable"} (${paired.clusters}/${stats.paired.expectedMatches} match clusters).`,
    );
    for (const role of ["control", "candidate"] as const) {
      const m = stats[role];
      lines.push(
        `${name} ${role}: ${m.draws} draws, ${m.failedGames} failed games, ${m.skippedGames} skipped games, ${m.unavailableGames} unavailable games; ${m.incompleteMatches}/${m.expectedMatches} incomplete matches; ${m.sideboardingFailures} sideboarding failures.`,
      );
    }
  }
  for (const role of ["control", "candidate"] as const) {
    const r = result.completeness.reports[role];
    lines.push(
      `${role} reports: ${r.status}; ${r.complete}/${r.expected} complete, ${r.pending} pending, ${r.invalid.length} invalid.`,
    );
  }
  return lines.join("\n") + "\n";
}
export async function aggregateRequest(file: string) {
  const request = (await json(file)) as AggregationRequest;
  request.session = path.resolve(
    path.dirname(path.resolve(file)),
    request.session,
  );
  request.output = path.resolve(
    path.dirname(path.resolve(file)),
    request.output,
  );
  // A fresh, disjoint destination makes retries explicit and preserves all earlier snapshots.
  const manifest = await json(
    path.join(
      request.session,
      `iterations/iteration-${String(request.iteration).padStart(4, "0")}/manifest.json`,
    ),
  );
  const protectedRoots = [
    manifest.fixture.path,
    ...[request.control, request.candidate].map((i) =>
      path.join(request.session, i.root),
    ),
  ];
  if (
    protectedRoots.some((root) => {
      const relative = path.relative(path.resolve(root), request.output);
      return (
        relative === "" ||
        (!relative.startsWith(`..${path.sep}`) &&
          relative !== ".." &&
          !path.isAbsolute(relative))
      );
    })
  )
    throw new Error("Aggregation output overlaps input evidence");
  const result = await aggregateSession(request);
  const summary = aggregationSummary(result);
  await mkdir(request.output);
  try {
    await writeFile(
      path.join(request.output, "result.json"),
      JSON.stringify(result, null, 2) + "\n",
      { flag: "wx" },
    );
    await writeFile(path.join(request.output, "summary.txt"), summary, {
      flag: "wx",
    });
  } catch (error) {
    await rm(request.output, { recursive: true, force: true });
    throw error;
  }
  return {
    output: request.output,
    result: path.join(request.output, "result.json"),
    summary: path.join(request.output, "summary.txt"),
    identity: result.identity,
    completeness: result.completeness,
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length !== 3)
      throw new Error(
        "Usage: npm run bot:aggregate -- aggregation-request.json",
      );
    const result = await aggregateRequest(path.resolve(process.argv[2]!));
    console.log(JSON.stringify(result));
    if (
      !result.completeness.evaluationComplete ||
      Object.values(result.completeness.reports).some(
        (r) => r.status === "incomplete",
      )
    )
      process.exitCode = 2;
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
}
