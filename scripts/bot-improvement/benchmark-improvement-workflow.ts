/** Diagnostic evaluation + complete mechanical loss-report ingestion; never promotes a bot. */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { performance } from "node:perf_hooks";
import { verifyFrozen } from "./frozen-setup.ts";
import { digest, identity } from "./session-fixtures.ts";
import { prepareTypescriptJob } from "./run-typescript-matches.ts";
import { runTypescriptNative } from "./run-typescript-native.ts";
import { prepareAnalysisSlices } from "./analysis-slices.ts";
import { benchmarkProvenance } from "./benchmark-provenance.ts";
import {
  configureOutputStorage,
  findOutputRoot,
  outputUsage,
  writeOutput,
} from "./output-storage.ts";
import { targetLossView } from "./game-log.ts";
import type { AnalysisBinding } from "./analysis-contract.ts";
import type { EvidenceReference } from "./session-control-contract.ts";

const { values: v } = parseArgs({
  options: {
    source: { type: "string" },
    out: { type: "string" },
    matches: { type: "string", default: "25" },
    workers: { type: "string", default: "2" },
  },
});
const count = Number(v.matches),
  workers = Number(v.workers);
if (
  !v.source ||
  !v.out ||
  !Number.isSafeInteger(count) ||
  count < 1 ||
  count > 25 ||
  !Number.isSafeInteger(workers) ||
  workers < 1
)
  throw Error(
    "Usage: node scripts/bot-improvement/benchmark-improvement-workflow.ts --source FROZEN_SESSION --out FRESH_OUTPUT [--matches 1..25] [--workers 2]",
  );
const out = path.resolve(v.out),
  session = path.join(out, "session"),
  fixturePath = path.join(out, "fixture");
if (await findOutputRoot(path.join(out, ".probe")))
  throw Error("Diagnostic output must be outside an existing budgeted run");
const begin = performance.now(),
  setupCpuStart = process.cpuUsage();
await mkdir(path.dirname(out), { recursive: true });
await mkdir(out);
await mkdir(session);
await mkdir(fixturePath);
const json = async (file: string) => JSON.parse(await readFile(file, "utf8"));
const sourceConfig = await json(path.join(v.source, "config.json"));
const original = await verifyFrozen(sourceConfig.fixture.path);
if (count > original.matches.length)
  throw Error("Source fixture has too few matches");
// Copy only verified inputs; the source fixture and production session stay read-only.
for (const file of Object.keys(original.files)) {
  const destination = path.join(fixturePath, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(path.join(sourceConfig.fixture.path, file), destination);
}
const { identity: originalIdentity, ...body } = original;
const narrowed = { ...body, matches: body.matches.slice(0, count) };
const frozen = { ...narrowed, identity: identity(narrowed) };
await writeFile(
  path.join(fixturePath, "manifest.json"),
  JSON.stringify(frozen),
);
await verifyFrozen(fixturePath);
const fixture = { path: fixturePath, identity: frozen.identity };
const accepted = {
  path: path.join(fixturePath, "versions/initial"),
  identity: frozen.target.identity,
};
const config = {
  ...sourceConfig,
  fixture,
  accepted,
  analysisTiming: "after-evaluation",
  limits: {
    ...sourceConfig.limits,
    matchWorkers: workers,
    analysisWorkers: 10,
    stop: { ...sourceConfig.limits.stop, maxBytes: 50_000_000_000 },
  },
};
await writeFile(path.join(session, "config.json"), JSON.stringify(config));
await writeFile(
  path.join(session, "state.json"),
  JSON.stringify({
    schemaVersion: 1,
    status: "ready",
    iteration: 0,
    accepted,
    fixtureIdentity: frozen.identity,
    completedMatches: [],
    completedGames: [],
    stoppingReason: null,
  }),
);
await mkdir(path.join(session, "iterations/iteration-0001"), {
  recursive: true,
});
await writeFile(
  path.join(session, "iterations/iteration-0001/manifest.json"),
  JSON.stringify({
    schemaVersion: 1,
    iteration: 1,
    fixture,
    self: { identity: frozen.target.identity },
    control: { identity: frozen.target.identity },
    opponents: frozen.opponents.map((bot, i) => ({
      slot: `opponent-${i + 1}`,
      identity: bot.identity,
    })),
    runnerIdentity: "diagnostic-workflow-only",
  }),
);
await writeFile(
  path.join(session, "proposal.txt"),
  "Mechanical performance fixture only; no AI findings or promotion.\n",
);
await configureOutputStorage(session, config.limits.stop.maxBytes);
const { job } = await prepareTypescriptJob(session, count);
const setupMs = performance.now() - begin;
const setupCpu = process.cpuUsage(setupCpuStart);
const provenanceStart = performance.now();
const provenance = benchmarkProvenance(
  {
    fixture: frozen.identity,
    execution: job.identity,
    matches: count,
    workers,
  },
  {
    workers: [workers],
    evidenceMode:
      "full native evaluation, complete loss preparation and mechanical unclear reports; no analyst inference or replay",
  },
);
const provenanceMs = performance.now() - provenanceStart;
const options = {
  job,
  out: path.join(session, "evaluation"),
  workers,
  maxWallMs: 600000,
  maxBytes: config.limits.stop.maxBytes,
};
const evaluationStart = performance.now(),
  evaluationCpuStart = process.cpuUsage();
const evaluation = await runTypescriptNative(options);
const evaluationMs = performance.now() - evaluationStart;
const evaluationCpu = process.cpuUsage(evaluationCpuStart);
const rssAfterEvaluation = process.memoryUsage().rss;
if (
  evaluation.status !== "completed" ||
  evaluation.completedGames !== count * 4 ||
  evaluation.reservedGames !== count * 4
)
  throw Error(
    "Integrated fixture requires every scheduled game to complete without extra reservations",
  );
const ref = async (relative: string): Promise<EvidenceReference> => ({
  path: relative,
  sha256: digest(await readFile(path.join(session, relative))),
});
const relativeOutput = path
  .relative(session, evaluation.output)
  .split(path.sep)
  .join("/");
const binding: AnalysisBinding = {
  iteration: 1,
  role: "candidate",
  root: relativeOutput,
  execution: await ref(`${relativeOutput}/execution.json`),
  proposal: await ref("proposal.txt"),
};
const preparationStart = performance.now(),
  preparationCpuStart = process.cpuUsage();
let state = await prepareAnalysisSlices(session, { action: "sync", binding });
const preparationMs = performance.now() - preparationStart;
const preparationCpu = process.cpuUsage(preparationCpuStart);
const rssAfterPreparation = process.memoryUsage().rss;
const reportingCpuStart = process.cpuUsage();
let claimMs = 0,
  reportGenerationMs = 0,
  reportIngestionMs = 0,
  losses = 0,
  reports = 0;
const views: { source: string; view: EvidenceReference }[] = [];
while (!state.complete) {
  const claimStart = performance.now();
  const claim = (
    await prepareAnalysisSlices(session, {
      action: "claim",
      iteration: 1,
      role: "candidate",
      owner: "mechanical-fixture",
    })
  ).claim;
  claimMs += performance.now() - claimStart;
  if (!claim?.claim) throw Error("Missing fixture slice claim");
  const generationStart = performance.now();
  const packet = (await json(path.join(session, claim.packet.path))) as {
    jobs: {
      id: string;
      match: string;
      packetSha256: string;
      losses: { game: number; log: EvidenceReference }[];
    }[];
  };
  const submitted: EvidenceReference[] = [];
  for (const item of packet.jobs) {
    const relative = `mechanical-reports/${item.match}.md`;
    const text =
      `# Mechanical fixture — not an AI review\nJob: ${item.id}\nPacket: ${item.packetSha256}\n\n` +
      item.losses
        .map(
          (loss) =>
            `- G${loss.game} | - | unclear | Fixture only | No causal claim\n`,
        )
        .join("");
    await writeOutput(path.join(session, relative), text, true);
    submitted.push(await ref(relative));
    reports++;
    for (const loss of item.losses) {
      losses++;
      views.push({
        source: `${relativeOutput}/matches/${item.match}/native/games/game-${loss.game}/game.log`,
        view: loss.log,
      });
    }
  }
  reportGenerationMs += performance.now() - generationStart;
  const ingestionStart = performance.now();
  state = await prepareAnalysisSlices(session, {
    action: "complete",
    iteration: 1,
    role: "candidate",
    slice: claim.id,
    token: claim.claim.token,
    reports: submitted,
  });
  reportIngestionMs += performance.now() - ingestionStart;
}
if (!state.summary) throw Error("Missing consolidated fixture summary");
const workflowMs = performance.now() - evaluationStart;
const reportingCpu = process.cpuUsage(reportingCpuStart);
const rssAfterIngestion = process.memoryUsage().rss;
// Verification below is reported separately, not hidden inside preparation timings.
const validationStart = performance.now(),
  verificationCpuStart = process.cpuUsage();
for (const item of views) {
  const source = await readFile(path.join(session, item.source), "utf8");
  const view = await readFile(path.join(session, item.view.path), "utf8");
  if (digest(view) !== item.view.sha256 || view !== targetLossView(source))
    throw Error("Analyst view differs from permitted target-loss projection");
}
const resumeStart = performance.now(),
  resumeCpuStart = process.cpuUsage();
const resume = await runTypescriptNative({ ...options, resume: true });
const resumeMs = performance.now() - resumeStart;
const resumeCpu = process.cpuUsage(resumeCpuStart);
if (resume.completedGames !== count * 4 || resume.reservedGames !== count * 4)
  throw Error("Completed resume changed game reservations");
const verificationMs = performance.now() - validationStart;
const verificationCpu = process.cpuUsage(verificationCpuStart);
const rssAfterResume = process.memoryUsage().rss;
const usage = await outputUsage(session, true);
const summary = await readFile(path.join(session, state.summary.path), "utf8");
if (!summary.includes(`${losses} losses reviewed · ${losses} unclear`))
  throw Error("Summary coverage differs from fixture reports");
const totalBeforeReportMs = performance.now() - begin;
const report = {
  schemaVersion: 1,
  provenance,
  sourceFixture: originalIdentity,
  fixture: frozen.identity,
  matches: count,
  games: evaluation.completedGames,
  losses,
  reports,
  stages: {
    setupMs,
    provenanceMs,
    totalBeforeReportMs,
    workflowOverheadMs:
      workflowMs -
      evaluationMs -
      preparationMs -
      claimMs -
      reportGenerationMs -
      reportIngestionMs,
    accountingAndSummaryMs:
      totalBeforeReportMs -
      setupMs -
      provenanceMs -
      workflowMs -
      verificationMs,
    evaluationMs,
    preparationMs,
    claimMs,
    reportGenerationMs,
    reportIngestionMs,
    workflowMs,
    verificationMs,
    resumeMs,
  },
  cpu: {
    setup: setupCpu,
    evaluation: evaluationCpu,
    preparation: preparationCpu,
    reporting: reportingCpu,
    verification: verificationCpu,
    resume: resumeCpu,
  },
  rssSamples: {
    rssAfterEvaluation,
    rssAfterPreparation,
    rssAfterIngestion,
    rssAfterResume,
  },
  evaluation,
  resume,
  usage,
  summary,
  stateSummary: state.summary,
  viewsVerified: views.length,
  limitations:
    "One diagnostic run, at most 25 matches. Mechanical unclear reports exercise complete ingestion without making AI findings. Setup includes input verification/copying and job preparation. Workflow includes evaluation, full loss preparation, claims, report generation and ingestion. Verification/provenance are separate from the workflow; resume is nested within verification. CPU includes this process and its threads, not provenance subprocesses. RSS values are samples, not peaks. No calibration, analyst inference, rule selection, replay, aggregation/promotion or sustained-throughput claim.",
};
await writeFile(
  path.join(out, "measurements.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify({ out, matches: count, losses, stages: report.stages }),
);
