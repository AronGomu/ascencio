import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  aggregateSession,
  aggregateRequest,
  aggregationSummary,
} from "../../scripts/bot-improvement/aggregate-session.ts";
import {
  aggregateStatistics,
  pairedEstimate,
} from "../../scripts/bot-improvement/aggregation-statistics.ts";
import { controlSession } from "../../scripts/bot-improvement/control-session.ts";
import { finalizedXml } from "../../scripts/bot-improvement/analysis-evidence.ts";
import {
  digest,
  identity,
  schedule,
} from "../../scripts/bot-improvement/session-fixtures.ts";
import { cardCode } from "../../src/battle/duel/contracts/ids.ts";
import type {
  GameOutcome,
  MatchObservation,
} from "../../scripts/bot-improvement/aggregation-statistics.ts";
import type { AggregationRequest } from "../../scripts/bot-improvement/aggregation-contract.ts";

const row = (id: string, games: GameOutcome[] | null): MatchObservation => ({
  id,
  slot: "self",
  games,
});
test("paired uncertainty uses match clusters with explicit draws, failures and denominators", () => {
  const a = [
    row("1", ["win", "loss", "draw", "draw"]),
    row("2", ["loss", "loss", "loss", "loss"]),
    row("3", ["win", "failed", "skipped", "skipped"]),
    row("4", null),
  ];
  const b = [
    row("1", ["win", "win", "draw", "loss"]),
    row("2", ["win", "loss", "loss", "loss"]),
    row("3", ["win", "win", "win", "win"]),
    row("4", null),
  ];
  const stats = aggregateStatistics(a, b);
  assert.equal(stats.control.completedGames, 9);
  assert.equal(stats.control.draws, 2);
  assert.equal(stats.control.failedGames, 1);
  assert.equal(stats.control.skippedGames, 2);
  assert.equal(stats.control.unavailableGames, 4);
  assert.equal(stats.control.gameWinRate, 2 / 9);
  assert.equal(stats.control.gameScoreRate, 3 / 9);
  assert.equal(stats.paired.winRateDifference.estimate, 0.25);
  assert.equal(stats.paired.winRateDifference.standardError, 0);
  assert.equal(stats.paired.scoreRateDifference.estimate, 0.1875);
  assert.deepEqual(stats.paired.excludedMatches, ["3", "4"]);
  assert.deepEqual(
    aggregateStatistics([...a].reverse(), [...b].reverse()),
    stats,
  );
  const estimate = pairedEstimate([0, 0.5, 1]);
  assert.equal(estimate.estimate, 0.5);
  assert.ok(Math.abs(estimate.standardError! - Math.sqrt(1 / 12)) < 1e-12);
  assert.equal(pairedEstimate([0]).interval95, null);
  assert.equal(pairedEstimate([]).estimate, null);
  assert.throws(() => aggregateStatistics(a, [...b, b[0]!]), /identical/);
  assert.throws(
    () => aggregateStatistics([a[0]!, a[0]!], [b[0]!, b[0]!]),
    /identical/,
  );
});

async function fixture() {
  await mkdir(".tmp", { recursive: true });
  const session = await mkdtemp(path.resolve(".tmp/aggregation-"));
  const put = async (relative: string, value: unknown) => {
    const file = path.join(session, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      typeof value === "string" ? value : JSON.stringify(value),
    );
  };
  const ref = async (relative: string) => ({
    path: relative,
    sha256: digest(await readFile(path.join(session, relative))),
  });
  const botBody = {
    kind: "module" as const,
    module: "builtin:basic",
    configuration: {},
    deck: { main: [cardCode(1)], extra: [], side: [] },
    files: { "bot.mjs": digest("bot") },
  };
  const bot = { ...botBody, identity: identity(botBody) };
  const body = {
    schemaVersion: 1,
    setupSeed: "aggregate",
    inputsIdentity: "inputs",
    profile: "mr5",
    protocol: {},
    target: bot,
    opponents: [bot],
    files: { "versions/initial/bot.mjs": digest("bot") },
    matches: schedule("aggregate", bot.deck, [bot.deck]),
  };
  const frozen = { ...body, identity: identity(body) };
  await put("fixture/manifest.json", frozen);
  await put("fixture/versions/initial/bot.mjs", "bot");
  const opponents = [
    { slot: "opponent-1", identity: bot.identity },
    { slot: "self", identity: bot.identity },
  ];
  const manifest = {
    schemaVersion: 1,
    iteration: 1,
    fixture: { path: path.join(session, "fixture"), identity: frozen.identity },
    accepted: { bot, identity: bot.identity },
    control: { identity: bot.identity },
    self: { identity: bot.identity },
    opponents,
    runnerIdentity: "runner-v1",
    comparisonIdentity: identity({
      fixture: frozen.identity,
      control: bot.identity,
      opponents,
      runnerIdentity: "runner-v1",
    }),
  };
  await put("iterations/iteration-0001/manifest.json", manifest);
  const makeJob = (role: "control" | "candidate") => {
    const jobBody = {
      schemaVersion: 1,
      fixtureIdentity: frozen.identity,
      candidateIdentity:
        role === "control" ? bot.identity : digest("candidate"),
      selfIdentity: bot.identity,
      profile: "mr5",
      limits: { game_wall_time_ms: 60000 },
      budget: { maxGames: 2000 },
      matches: frozen.matches.map((match) => ({
        match,
        decks: [bot.deck, bot.deck],
        identities: [
          role === "control" ? bot.identity : digest("candidate"),
          bot.identity,
        ],
      })),
    };
    const job = {
      ...jobBody,
      identity: identity({
        fixtureIdentity: jobBody.fixtureIdentity,
        candidateIdentity: jobBody.candidateIdentity,
        selfIdentity: jobBody.selfIdentity,
        profile: jobBody.profile,
        limits: jobBody.limits,
        budget: jobBody.budget,
        matches: jobBody.matches,
      }),
      sessionControl: {
        iteration: 1,
        role,
        runnerIdentity: "runner-v1",
        executableIdentity: jobBody.candidateIdentity,
      },
    };
    return job;
  };
  const jobs = { control: makeJob("control"), candidate: makeJob("candidate") };
  for (const role of ["control", "candidate"] as const) {
    await put(`${role}.job.json`, jobs[role]);
    await mkdir(path.join(session, role));
  }
  const request: AggregationRequest = {
    schemaVersion: 1,
    session,
    iteration: 1,
    candidateIdentity: digest("candidate"),
    control: { root: "control", execution: await ref("control.job.json") },
    candidate: {
      root: "candidate",
      execution: await ref("candidate.job.json"),
    },
    output: path.join(session, "output"),
  };
  async function finalize(
    role: "control" | "candidate",
    n: number,
    outcomes: GameOutcome[],
  ) {
    const job = jobs[role];
    const match = frozen.matches[n - 1]!;
    const prefix = `${role}/matches/${match.id}`;
    const fields = `<run_id>${job.identity}</run_id><match_id>${match.id}</match_id>`;
    const games = (actor?: string) =>
      outcomes
        .map((outcome, i) => {
          const status = ["failed", "skipped"].includes(outcome)
            ? outcome
            : "completed";
          const winner =
            outcome === "win" ? "a" : outcome === "loss" ? "b" : "";
          const hash = status === "skipped" ? "" : digest(String(i));
          const result =
            status === "skipped"
              ? ""
              : status === "failed"
                ? "failed"
                : winner === ""
                  ? "draw"
                  : winner === actor
                    ? "win"
                    : "loss";
          return `<game><game_id>${match.id}-game-${i + 1}</game_id><number>${i + 1}</number><status>${status}</status><stage>${i < 2 ? "pre_side" : "post_side"}</stage><${actor ? "starting_player" : "starter"}>${i % 2 ? "b" : "a"}</${actor ? "starting_player" : "starter"}>${actor ? `<result><outcome>${result}</outcome><evidence_sha256>${hash}</evidence_sha256></result><timeline><entry><sequence>1</sequence></entry></timeline>` : `<winner>${winner}</winner><draw>${status !== "completed" ? "" : winner ? "false" : "true"}</draw><evidence_sha256>${hash}</evidence_sha256>`}</game>`;
        })
        .join("");
    const docs = {
      "fixture.json": JSON.stringify(job.matches[n - 1]),
      "manifest.xml": `<manifest><run_id>${job.identity}</run_id><content><sha256>${frozen.identity}</sha256></content><bots><a><artifact_sha256>${job.candidateIdentity}</artifact_sha256></a><b><artifact_sha256>${bot.identity}</artifact_sha256></b></bots></manifest>`,
      [`matches/${match.id}/match.xml`]: `<match>${fields}<status>${outcomes.every((g) => ["win", "loss", "draw"].includes(g)) ? "completed" : "incomplete"}</status><sideboarding><status>${outcomes.includes("skipped") ? "failed" : "completed"}</status></sideboarding><games>${games()}</games></match>`,
      ...Object.fromEntries(
        ["a", "b"].map((actor) => [
          `matches/${match.id}/player-${actor}.xml`,
          `<player-report>${fields}<perspective>${actor}</perspective><bot_artifact_sha256>${actor === "a" ? job.candidateIdentity : bot.identity}</bot_artifact_sha256><sideboarding><status>${outcomes.includes("skipped") ? "failed" : "completed"}</status></sideboarding><games>${games(actor)}</games></player-report>`,
        ]),
      ),
    };
    for (const [file, bytes] of Object.entries(docs))
      await put(`${prefix}/${file}`, bytes);
    await put(`${prefix}/done.json`, {
      files: Object.fromEntries(
        Object.entries(docs).map(([file, bytes]) => [file, digest(bytes)]),
      ),
    });
    return { prefix, docs, match, job };
  }
  return { session, request, jobs, frozen, manifest, put, ref, finalize };
}

test("partial finalized evidence, corruption and recovery stay explicit; CLI retains fresh snapshots", async () => {
  const f = await fixture();
  try {
    await f.finalize("control", 1, ["win", "loss", "draw", "draw"]);
    await f.finalize("candidate", 1, ["win", "win", "draw", "draw"]);
    await f.finalize("control", 2, ["win", "failed", "skipped", "skipped"]);
    const before = await aggregateSession(f.request);
    assert.equal(before.overall.paired.winRateDifference.clusters, 1);
    assert.equal(before.overall.paired.winRateDifference.estimate, 0.25);
    assert.equal(before.overall.control.failedGames, 1);
    assert.equal(before.overall.control.sideboardingFailures, 1);
    assert.equal(before.overall.candidate.unavailableMatches, 499);
    assert.equal(before.completeness.evaluationComplete, false);
    assert.equal(before.completeness.synthesisReady, false);
    assert.equal(before.perOpponent[0]!.paired.winRateDifference.clusters, 1);
    assert.equal(before.perOpponent[1]!.paired.winRateDifference.clusters, 0);
    assert.match(aggregationSummary(before), /499\/500 incomplete matches/);
    const file = "candidate/matches/match-0001/matches/match-0001/match.xml";
    const original = await readFile(path.join(f.session, file));
    await f.put(file, original.toString() + "corrupt");
    const corrupt = await aggregateSession(f.request);
    assert.equal(corrupt.overall.paired.winRateDifference.clusters, 0);
    assert.match(
      corrupt.unavailable.candidate[0]!.reason!,
      /Evidence mismatch/,
    );
    await f.put(file, original.toString());
    assert.deepEqual(await aggregateSession(f.request), before);
    await f.put("request.json", f.request);
    const output = await aggregateRequest(path.join(f.session, "request.json"));
    assert.equal(
      JSON.parse(await readFile(output.result, "utf8")).identity,
      before.identity,
    );
    await assert.rejects(
      aggregateRequest(path.join(f.session, "request.json")),
      /EEXIST/,
    );
    assert.ok(
      (await readFile(output.summary, "utf8")).includes(
        "paired win-rate difference",
      ),
    );
    const accepted = {
      path: path.join(f.session, "fixture/versions/initial"),
      identity: f.manifest.accepted.identity,
    };
    await f.put("config.json", {
      schemaVersion: 1,
      fixture: f.manifest.fixture,
      accepted,
      limits: { stop: { maxIterations: 1 }, matchWorkers: 1 },
    });
    await f.put("state.json", {
      schemaVersion: 1,
      fixtureIdentity: f.frozen.identity,
      accepted,
      iteration: 0,
      completedGames: [],
      completedMatches: [],
      stoppingReason: null,
    });
    await controlSession(f.session, { action: "start", iteration: 1 });
    await controlSession(f.session, {
      action: "record",
      iteration: 1,
      kind: "comparison",
      evidence: await f.ref("output/result.json"),
    });
    await controlSession(f.session, { action: "report" });
    const report = JSON.parse(
      await readFile(path.join(f.session, "report.json"), "utf8"),
    );
    assert.deepEqual(JSON.parse(report.recorded[0].content), before);
    assert.equal(report.evidence[0].intact, true);
    assert.equal(report.completedGames, 0);
    assert.equal(report.accepted.identity, accepted.identity);
  } finally {
    await rm(f.session, { recursive: true, force: true });
  }
});

test("fixed identities, schedule mismatch, runner limits and stale receipt cannot be silently pooled", async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      aggregateSession({ ...f.request, candidateIdentity: digest("other") }),
      /binding mismatch/,
    );
    const job = structuredClone(f.jobs.candidate);
    job.matches[0]!.match.games[0]!.engineSeed[0] = "999";
    await f.put("candidate.job.json", job);
    f.request.candidate.execution = await f.ref("candidate.job.json");
    await assert.rejects(
      aggregateSession(f.request),
      /identity\/coverage mismatch/,
    );
    await f.put("candidate.job.json", f.jobs.candidate);
    f.request.candidate.execution = await f.ref("candidate.job.json");
    const changed = structuredClone(f.jobs.candidate);
    changed.limits.game_wall_time_ms++;
    const {
      fixtureIdentity,
      candidateIdentity,
      selfIdentity,
      profile,
      limits,
      budget,
      matches,
    } = changed;
    changed.identity = identity({
      fixtureIdentity,
      candidateIdentity,
      selfIdentity,
      profile,
      limits,
      budget,
      matches,
    });
    await f.put("candidate.job.json", changed);
    f.request.candidate.execution = await f.ref("candidate.job.json");
    await assert.rejects(
      aggregateSession(f.request),
      /limits or budgets differ/,
    );
    await f.put("candidate.job.json", f.jobs.candidate);
    f.request.candidate.execution = await f.ref("candidate.job.json");
    await f.put("control/baseline-receipt.json", {
      schemaVersion: 1,
      status: "complete",
      comparisonIdentity: "stale",
      completedMatches: [],
      matches: {},
    });
    f.request.control.receipt = await f.ref("control/baseline-receipt.json");
    await assert.rejects(
      aggregateSession(f.request),
      /receipt binding\/coverage/,
    );
  } finally {
    await rm(f.session, { recursive: true, force: true });
  }
});

test(
  "real finalized runner XML can be read without executing matches",
  { skip: !process.env.ARO2_AGGREGATION_RUNNER_SAMPLE },
  async () => {
    // Explicit external smoke input: { session, relative, expected }. Read-only; no Cargo or runner invocation.
    const sample = JSON.parse(
      await readFile(process.env.ARO2_AGGREGATION_RUNNER_SAMPLE!, "utf8"),
    );
    const result = await finalizedXml(sample.session, sample.relative, {
      ...sample.expected,
      outcomes: true,
    });
    assert.equal(result.outcomes.length, 4);
    assert.equal(result.games.length, 4);
    assert.ok(result.files.length >= 5);
  },
);

test("analysis coverage verifies pinned packets, reports and event references without interpreting text", async () => {
  const f = await fixture();
  try {
    const m = await f.finalize("candidate", 1, ["win", "loss", "draw", "draw"]);
    const result = await finalizedXml(f.session, m.prefix, {
      match: m.match.id,
      executionIdentity: m.job.identity,
      fixtureIdentity: f.frozen.identity,
      candidateIdentity: m.job.candidateIdentity,
      opponentIdentity: f.manifest.opponents[0]!.identity,
      item: m.job.matches[0],
    });
    await f.put("proposal.txt", "One heuristic change.");
    const proposal = await f.ref("proposal.txt");
    const packet = {
      schemaVersion: 1,
      adapter: "frozen-xml-v1",
      id: "1/candidate/match-0001",
      iteration: 1,
      role: "candidate",
      match: "match-0001",
      fixtureIdentity: f.frozen.identity,
      runnerIdentity: "runner-v1",
      executionIdentity: m.job.identity,
      candidateIdentity: m.job.candidateIdentity,
      opponent: f.manifest.opponents[0],
      proposal,
      files: result.files,
      games: result.games,
      events: result.events,
    };
    await f.put("packet.json", packet);
    const packetRef = await f.ref("packet.json");
    const section = { text: "Recorded event.", evidence: [packet.events[0]!] };
    const report = {
      schemaVersion: 1,
      job: packet.id,
      packetSha256: packetRef.sha256,
      sections: {
        activation: section,
        changedDecisions: section,
        impact: { ...section, assessment: "uncertain" },
        consequentialPlays: section,
      },
    };
    await f.put("report.json", report);
    const queue = {
      schemaVersion: 1,
      binding: {
        iteration: 1,
        role: "candidate",
        root: "candidate",
        execution: f.request.candidate.execution,
        proposal,
      },
      fixtureIdentity: f.frozen.identity,
      runnerIdentity: "runner-v1",
      executionIdentity: m.job.identity,
      expected: f.frozen.matches.map((m) => m.id),
      jobs: [
        {
          id: packet.id,
          match: packet.match,
          packet: packetRef,
          status: "complete",
          report: await f.ref("report.json"),
        },
      ],
    };
    await f.put("queue.json", queue);
    f.request.candidate.analyses = await f.ref("queue.json");
    const valid = await aggregateSession(f.request);
    assert.equal(valid.completeness.reports.candidate.complete, 1);
    assert.equal(valid.completeness.reports.candidate.pending, 499);
    assert.equal(valid.completeness.reports.candidate.status, "incomplete");
    report.sections.activation.evidence = [
      { game: 1, perspective: "a", sequence: 999 },
    ];
    await f.put("report.json", report);
    queue.jobs[0]!.report = await f.ref("report.json");
    await f.put("queue.json", queue);
    f.request.candidate.analyses = await f.ref("queue.json");
    const invalid = await aggregateSession(f.request);
    assert.equal(invalid.completeness.reports.candidate.complete, 0);
    assert.match(
      invalid.completeness.reports.candidate.invalid[0]!.reason,
      /Unresolvable event/,
    );
    queue.executionIdentity = digest("another-execution");
    await f.put("queue.json", queue);
    f.request.candidate.analyses = await f.ref("queue.json");
    await assert.rejects(aggregateSession(f.request), /queue binding/);
  } finally {
    await rm(f.session, { recursive: true, force: true });
  }
});

test("complete paired evaluation requires every candidate report before synthesis", async () => {
  const f = await fixture();
  try {
    await f.put("proposal.txt", "One heuristic change.");
    const proposal = await f.ref("proposal.txt");
    const jobs = [];
    for (let n = 1; n <= f.frozen.matches.length; n++) {
      await f.finalize("control", n, ["win", "loss", "draw", "draw"]);
      const m = await f.finalize("candidate", n, [
        "win",
        "win",
        "draw",
        "draw",
      ]);
      const result = await finalizedXml(f.session, m.prefix, {
        match: m.match.id,
        executionIdentity: m.job.identity,
        fixtureIdentity: f.frozen.identity,
        candidateIdentity: m.job.candidateIdentity,
        opponentIdentity: m.job.matches[n - 1]!.identities[1]!,
        item: m.job.matches[n - 1],
      });
      const packet = {
        schemaVersion: 1,
        adapter: "frozen-xml-v1",
        id: `1/candidate/${m.match.id}`,
        iteration: 1,
        role: "candidate",
        match: m.match.id,
        fixtureIdentity: f.frozen.identity,
        runnerIdentity: "runner-v1",
        executionIdentity: m.job.identity,
        candidateIdentity: m.job.candidateIdentity,
        opponent: f.manifest.opponents.find(
          (o) => o.slot === m.match.opponentSlot,
        ),
        proposal,
        files: result.files,
        games: result.games,
        events: result.events,
      };
      const packetFile = `reports/${m.match.id}.packet.json`;
      const reportFile = `reports/${m.match.id}.report.json`;
      await f.put(packetFile, packet);
      const packetRef = await f.ref(packetFile);
      const section = {
        text: "Recorded event.",
        evidence: [packet.events[0]!],
      };
      await f.put(reportFile, {
        schemaVersion: 1,
        job: packet.id,
        packetSha256: packetRef.sha256,
        sections: {
          activation: section,
          changedDecisions: section,
          impact: { ...section, assessment: "uncertain" },
          consequentialPlays: section,
        },
      });
      jobs.push({
        id: packet.id,
        match: packet.match,
        packet: packetRef,
        status: "complete",
        report: await f.ref(reportFile),
      });
    }
    const noReports = await aggregateSession(f.request);
    assert.equal(noReports.completeness.evaluationComplete, true);
    assert.equal(noReports.completeness.synthesisReady, false);
    assert.equal(noReports.overall.paired.winRateDifference.clusters, 500);
    assert.equal(noReports.overall.paired.winRateDifference.estimate, 0.25);
    assert.equal(
      noReports.perOpponent.find((p) => p.slot === "self")!.candidate
        .completeMatches,
      250,
    );
    const queue = {
      schemaVersion: 1,
      binding: {
        iteration: 1,
        role: "candidate",
        root: "candidate",
        execution: f.request.candidate.execution,
        proposal,
      },
      fixtureIdentity: f.frozen.identity,
      runnerIdentity: "runner-v1",
      executionIdentity: f.jobs.candidate.identity,
      expected: f.frozen.matches.map((m) => m.id),
      jobs,
    };
    await f.put("queue.json", queue);
    f.request.candidate.analyses = await f.ref("queue.json");
    const complete = await aggregateSession(f.request);
    assert.equal(complete.completeness.synthesisReady, true);
    jobs[0]!.status = "pending";
    await f.put("queue.json", queue);
    f.request.candidate.analyses = await f.ref("queue.json");
    const pending = await aggregateSession(f.request);
    assert.equal(pending.completeness.evaluationComplete, true);
    assert.equal(pending.completeness.synthesisReady, false);
    assert.equal(pending.completeness.reports.candidate.pending, 1);
  } finally {
    await rm(f.session, { recursive: true, force: true });
  }
});
