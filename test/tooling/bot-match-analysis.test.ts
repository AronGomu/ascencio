import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
} from "node:fs/promises";
import path from "node:path";
import { prepareAnalyses } from "../../scripts/bot-improvement/prepare-analyses.ts";
import { finalizedXml } from "../../scripts/bot-improvement/analysis-evidence.ts";
import { validateAnalysisReport } from "../../scripts/bot-improvement/analysis-report.ts";
import {
  digest,
  identity,
  schedule,
} from "../../scripts/bot-improvement/session-fixtures.ts";
import { cardCode } from "../../src/battle/duel/contracts/ids.ts";
import type {
  AnalysisAction,
  AnalysisBinding,
  AnalysisPacket,
  MatchAnalysisReport,
} from "../../scripts/bot-improvement/analysis-contract.ts";
import type { FrozenSetup } from "../../scripts/bot-improvement/session-contract.ts";

async function put(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    typeof value === "string" ? value : JSON.stringify(value),
  );
}
async function fixture(workers = 1) {
  await mkdir(".tmp", { recursive: true });
  const session = await mkdtemp(path.resolve(".tmp/match-analysis-"));
  const botBody = {
    kind: "module" as const,
    module: "builtin:basic",
    configuration: {},
    deck: { main: [cardCode(1)], extra: [], side: [] },
    files: { "bot.mjs": digest("bot") },
  };
  const bot = { ...botBody, identity: identity(botBody) };
  const body = {
    schemaVersion: 1 as const,
    setupSeed: "analysis",
    inputsIdentity: "inputs",
    profile: "mr5" as const,
    protocol: {} as FrozenSetup["protocol"],
    target: bot,
    opponents: [],
    files: { "versions/initial/bot.mjs": digest("bot") },
    matches: schedule("analysis", bot.deck, []),
  };
  const frozen = { ...body, identity: identity(body) };
  await put(path.join(session, "fixture/manifest.json"), frozen);
  await put(path.join(session, "fixture/versions/initial/bot.mjs"), "bot");
  await put(path.join(session, "config.json"), {
    schemaVersion: 1,
    fixture: { path: path.join(session, "fixture"), identity: frozen.identity },
    limits: { analysisWorkers: workers },
  });
  await put(path.join(session, "iterations/iteration-0001/manifest.json"), {
    schemaVersion: 1,
    iteration: 1,
    fixture: { identity: frozen.identity },
    self: { identity: bot.identity },
    control: { identity: bot.identity },
    opponents: [],
    runnerIdentity: "runner-v1",
  });
  const execution = {
    schemaVersion: 1,
    fixtureIdentity: frozen.identity,
    candidateIdentity: bot.identity,
    selfIdentity: bot.identity,
    matches: frozen.matches.map((match) => ({
      match,
      identities: [bot.identity, bot.identity],
    })),
  };
  const job = { ...execution, identity: identity(execution) };
  await put(path.join(session, "run.job.json"), job);
  await put(
    path.join(session, "proposal.txt"),
    "Change the score of an observed action; rationale retained here.",
  );
  await mkdir(path.join(session, "run"));
  const ref = async (relative: string) => ({
    path: relative,
    sha256: digest(await readFile(path.join(session, relative))),
  });
  const binding: AnalysisBinding = {
    iteration: 1,
    role: "candidate",
    root: "run",
    execution: await ref("run.job.json"),
    proposal: await ref("proposal.txt"),
  };
  const run = (action: AnalysisAction) => prepareAnalyses(session, action);
  const act = { iteration: 1, role: "candidate" as const };
  const sync = () => run({ action: "sync", binding });
  const base = "iterations/iteration-0001/analyses/candidate";
  async function finalized(number = 1, complete = true) {
    const match = frozen.matches[number - 1]!.id;
    const prefix = `run/matches/${match}`;
    const fields = `<run_id>${job.identity}</run_id><match_id>${match}</match_id>`;
    const games = (perspective?: string) =>
      [1, 2, 3, 4]
        .map(
          (n) =>
            `<game><game_id>${match}-game-${n}</game_id><number>${n}</number><status>${complete ? "completed" : "failed"}</status><stage>${n < 3 ? "pre_side" : "post_side"}</stage><${perspective ? "starting_player" : "starter"}>${n % 2 ? "a" : "b"}</${perspective ? "starting_player" : "starter"}>${perspective ? `<result><evidence_sha256>${digest(String(n))}</evidence_sha256></result><timeline><entry><event>draw</event><sequence>1</sequence></entry><entry><sequence>3</sequence></entry></timeline>` : `<evidence_sha256>${digest(String(n))}</evidence_sha256>`}</game>`,
        )
        .join("");
    const docs: Record<string, string> = {
      "manifest.xml": `<manifest><run_id>${job.identity}</run_id><content><sha256>${frozen.identity}</sha256></content><bots><a><artifact_sha256>${bot.identity}</artifact_sha256></a><b><artifact_sha256>${bot.identity}</artifact_sha256></b></bots></manifest>`,
      [`matches/${match}/match.xml`]: `<match>${fields}<status>${complete ? "completed" : "incomplete"}</status><sideboarding><status>completed</status></sideboarding><games>${games()}</games></match>`,
      ...Object.fromEntries(
        ["a", "b"].map((p) => [
          `matches/${match}/player-${p}.xml`,
          `<player-report>${fields}<perspective>${p}</perspective><bot_artifact_sha256>${bot.identity}</bot_artifact_sha256><sideboarding><status>completed</status></sideboarding><games>${games(p)}</games></player-report>`,
        ]),
      ),
    };
    for (const [file, bytes] of Object.entries(docs))
      await put(path.join(session, prefix, file), bytes);
    await put(
      path.join(session, prefix, "fixture.json"),
      job.matches[number - 1],
    );
    const marker = {
      files: Object.fromEntries(
        Object.entries(docs).map(([file, bytes]) => [file, digest(bytes)]),
      ),
    };
    await put(path.join(session, prefix, "done.json"), marker);
    return { prefix, marker, docs, match };
  }
  async function report(
    claim: NonNullable<Awaited<ReturnType<typeof run>>["claim"]>,
  ) {
    const packet = JSON.parse(
      await readFile(path.join(session, claim.packet.path), "utf8"),
    ) as AnalysisPacket;
    const section = {
      text: "Observed draw; heuristic impact remains uncertain.",
      evidence: [packet.events[0]!],
    };
    const report: MatchAnalysisReport = {
      schemaVersion: 1,
      job: claim.id,
      packetSha256: claim.packet.sha256,
      sections: {
        activation: section,
        changedDecisions: {
          text: "Counterfactual decision was not recorded.",
          evidence: [],
          unavailable: "No paired counterfactual decision trace.",
        },
        impact: { ...section, assessment: "uncertain" },
        consequentialPlays: section,
      },
    };
    await put(path.join(session, "report.json"), report);
    return { report, packet, ref: await ref("report.json") };
  }
  return {
    session,
    run,
    sync,
    binding,
    act,
    base,
    finalized,
    report,
    ref,
    job,
    frozen,
    bot,
  };
}

test("one logical job per finalized match, bounded queue and claims, complete/report dedupe", async () => {
  const f = await fixture();
  try {
    for (let n = 1; n <= 4; n++) await f.finalized(n);
    const first = await f.sync();
    assert.equal(first.finalized, 4);
    assert.equal(first.ready.length, 2);
    assert.equal(
      first.outstanding.filter((j) => j.status === "waiting").length,
      2,
    );
    assert.equal((await f.sync()).finalized, 4);
    const claim = (
      await f.run({ action: "claim", ...f.act, owner: "analyst-1" })
    ).claim!;
    assert.deepEqual(
      (await f.run({ action: "claim", ...f.act, owner: "analyst-1" })).claim,
      claim,
    );
    assert.equal(
      (await f.run({ action: "claim", ...f.act, owner: "analyst-2" })).claim,
      null,
    );
    const r = await f.report(claim);
    const request = {
      action: "complete" as const,
      ...f.act,
      job: claim.id,
      token: claim.claim!.token,
      report: r.ref,
    };
    const done = await f.run(request);
    assert.equal(done.completed, 1);
    assert.equal(done.complete, false);
    assert.equal(done.missing.length, 496);
    assert.equal((await f.run(request)).reports.length, 1);
    assert.equal(
      (await f.run({ action: "claim", ...f.act, owner: "analyst-2" })).claim!
        .match,
      "match-0002",
    );
  } finally {
    await rm(f.session, { recursive: true, force: true });
  }
});

test("partial files are excluded while finalized failure evidence remains available", async () => {
  const f = await fixture();
  try {
    const partial = await f.finalized(1);
    await rm(path.join(f.session, partial.prefix, "done.json"));
    const failed = await f.finalized(2, false);
    const changed = await f.finalized(3);
    await put(
      path.join(
        f.session,
        changed.prefix,
        `matches/${changed.match}/player-a.xml`,
      ),
      "<player-report>",
    );
    const result = await f.sync();
    assert.equal(result.finalized, 1);
    assert.equal(result.unavailable.length, 499);
    assert.equal(result.unavailable[0]!.reason, "not-finalized");
    assert.equal(result.outstanding[0]!.match, failed.match);
    assert.match(
      result.unavailable.find((u) => u.match === changed.match)!.reason,
      /Evidence mismatch/,
    );
    await put(path.join(f.session, partial.prefix, "done.json"), "{");
    assert.match((await f.sync()).unavailable[0]!.reason, /SyntaxError/);
  } finally {
    await rm(f.session, { recursive: true, force: true });
  }
});

test("orphan publication recovery, durable claims, explicit release and stale completion fencing", async () => {
  const f = await fixture();
  try {
    await f.finalized();
    await f.sync();
    // Simulate crash after immutable packet rename but before queue publication.
    await rm(path.join(f.session, f.base, "queue.json"));
    assert.equal((await f.sync()).finalized, 1);
    const claim = (await f.run({ action: "claim", ...f.act, owner: "old" }))
      .claim!;
    const prior = await readFile(path.join(f.session, f.base, "queue.json"));
    const r = await f.report(claim);
    const complete = {
      action: "complete" as const,
      ...f.act,
      job: claim.id,
      token: claim.claim!.token,
      report: r.ref,
    };
    await f.run(complete);
    // Report was published before process loss; durable queue still says claimed.
    await writeFile(path.join(f.session, f.base, "queue.json"), prior);
    assert.equal((await f.run(complete)).completed, 1);
    await writeFile(path.join(f.session, f.base, "queue.json"), prior);
    await f.run({
      action: "release",
      ...f.act,
      job: claim.id,
      token: claim.claim!.token,
      terminated: true,
    });
    const replacement = (
      await f.run({ action: "claim", ...f.act, owner: "new" })
    ).claim!;
    assert.equal(replacement.id, claim.id);
    assert.equal(replacement.attempt, 2);
    await assert.rejects(f.run(complete), /Stale/);
  } finally {
    await rm(f.session, { recursive: true, force: true });
  }
});

test("reports require sections, association and resolvable events; damage remains visible", async () => {
  const f = await fixture();
  try {
    const match = await f.finalized();
    await f.sync();
    const claim = (await f.run({ action: "claim", ...f.act, owner: "one" }))
      .claim!;
    const r = await f.report(claim);
    const check = (value: unknown) =>
      validateAnalysisReport(value, r.packet, claim.packet.sha256);
    assert.throws(() => check({ ...r.report, job: "other" }), /association/);
    assert.throws(() => check({ ...r.report, sections: {} }), /section/);
    assert.throws(
      () =>
        check({
          ...r.report,
          sections: {
            ...r.report.sections,
            activation: { text: "No refs", evidence: [] },
          },
        }),
      /unavailability/,
    );
    assert.throws(
      () =>
        check({
          ...r.report,
          sections: {
            ...r.report.sections,
            activation: {
              text: "Invented",
              evidence: [{ game: 1, perspective: "a", sequence: 2 }],
            },
          },
        }),
      /Unresolvable/,
    );
    check(r.report);
    await f.run({
      action: "complete",
      ...f.act,
      job: claim.id,
      token: claim.claim!.token,
      report: r.ref,
    });
    await put(path.join(f.session, match.prefix, "manifest.xml"), "changed");
    const damaged = await f.run({ action: "status", ...f.act });
    assert.equal(damaged.integrity.length, 1);
    assert.equal(damaged.complete, false);
    await assert.rejects(
      f.run({
        action: "sync",
        binding: {
          ...f.binding,
          proposal: { path: "proposal.txt", sha256: digest("changed") },
        },
      }),
      /Evidence mismatch/,
    );
  } finally {
    await rm(f.session, { recursive: true, force: true });
  }
});

test("shared session lock excludes competing writers and preserves durable claim capacity", async () => {
  const f = await fixture();
  try {
    await f.finalized();
    await f.sync();
    const file = path.join(f.session, f.base, "queue.json");
    const before = await readFile(file, "utf8");
    await mkdir(path.join(f.session, ".session-state.lock"));
    await assert.rejects(
      f.run({ action: "claim", ...f.act, owner: "blocked" }),
      { code: "EEXIST" },
    );
    assert.equal(await readFile(file, "utf8"), before);
    await rm(path.join(f.session, ".session-state.lock"), { recursive: true });
    const results = await Promise.allSettled(
      ["one", "two"].map((owner) =>
        f.run({ action: "claim", ...f.act, owner }),
      ),
    );
    assert.equal(
      results.filter((r) => r.status === "fulfilled" && r.value.claim).length,
      1,
    );
    const status = await f.run({ action: "status", ...f.act });
    assert.equal(
      status.outstanding.filter((j) => j.status === "claimed").length,
      1,
    );
  } finally {
    await rm(f.session, { recursive: true, force: true });
  }
});

test("adapter rejects symlinks, unlisted files, unsafe marker paths and malformed XML", async () => {
  const f = await fixture();
  try {
    const m = await f.finalized();
    const expected = {
      match: m.match,
      executionIdentity: f.job.identity,
      fixtureIdentity: f.frozen.identity,
      candidateIdentity: f.bot.identity,
      opponentIdentity: f.bot.identity,
    };
    const read = () => finalizedXml(f.session, m.prefix, expected);
    assert.equal((await read()).events.length, 16);
    const fixtureFile = path.join(f.session, m.prefix, "fixture.json");
    m.marker.files["fixture.json"] = digest(await readFile(fixtureFile));
    await put(path.join(f.session, m.prefix, "done.json"), m.marker);
    assert.equal((await read()).events.length, 16);

    await put(path.join(f.session, m.prefix, "extra.log"), "still writing");
    await assert.rejects(read(), /file set/);
    await rm(path.join(f.session, m.prefix, "extra.log"));
    const xml = `matches/${m.match}/player-a.xml`;
    await rm(path.join(f.session, m.prefix, xml));
    await symlink(
      path.join(f.session, "proposal.txt"),
      path.join(f.session, m.prefix, xml),
    );
    await assert.rejects(read(), /Symlink/);
    await rm(path.join(f.session, m.prefix, xml));
    await put(path.join(f.session, m.prefix, xml), "<player-report>");
    m.marker.files[xml] = digest("<player-report>");
    await put(path.join(f.session, m.prefix, "done.json"), m.marker);
    await assert.rejects(read(), /unclosed/);
    await assert.rejects(
      finalizedXml(f.session, "../escape", expected),
      /Unsafe/,
    );
  } finally {
    await rm(f.session, { recursive: true, force: true });
  }
});
