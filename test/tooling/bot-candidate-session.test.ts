import test from "node:test";
import { controlSession } from "../../scripts/bot-improvement/control-session.ts";
import { executeMatches } from "../../scripts/bot-improvement/run-matches.ts";
import { bindMatches } from "../../scripts/bot-improvement/match-session.ts";
import { applyDecision } from "../../scripts/bot-improvement/apply-decision.ts";
import type { CandidateDecisionRequest } from "../../scripts/bot-improvement/decision-contract.ts";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { prepareIteration } from "../../scripts/bot-improvement/prepare-iteration.ts";
import { validateCandidate } from "../../scripts/bot-improvement/validate-candidate.ts";
import {
  hashes,
  readTree,
} from "../../scripts/bot-improvement/candidate-files.ts";
import {
  digest,
  identity,
} from "../../scripts/bot-improvement/session-fixtures.ts";
import type {
  CandidateValidationResult,
  FrozenBot,
} from "../../scripts/bot-improvement/session-contract.ts";

const save = async (file: string, value: unknown) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value));
};
const json = async (file: string) => JSON.parse(await readFile(file, "utf8"));

async function preparedSession() {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/candidate-session-"));
  try {
    for (const id of ["card-library", "duel-core"])
      await save(path.join(root, "content", id, "critical.json"), {
        schemaVersion: 1,
        compilerVersion: 1,
        manifest: { packageId: id, version: "1.0.0" },
        cards:
          id === "card-library"
            ? Array.from({ length: 14 }, (_, i) => ({
                definition: {
                  code: i + 1,
                  type: 1,
                  alias: 0,
                  setcodes: [],
                  race: "1",
                  linkMarker: 0,
                },
                texts: [],
              }))
            : [],
        scripts: [],
        config: id === "duel-core" ? { strings: {} } : {},
      });
    const target = path.join(root, "target");
    await save(path.join(target, "evaluation.json"), {
      schemaVersion: 1,
      deck: "deck.ydk",
      content: "../content",
      banlist: "rules.json",
      profile: "mr5",
      configuration: {},
      module: "builtin:generalist",
    });
    await save(path.join(target, "rules.json"), []);
    await writeFile(
      path.join(target, "deck.ydk"),
      `#main\n${Array.from({ length: 40 }, (_, i) => (i % 14) + 1).join("\n")}\n#extra\n!side\n`,
    );
    const request = {
      target,
      opponents: [],
      setupSeed: "candidate-session",
      session: path.join(root, "session"),
      stop: { maxIterations: 2 },
    };
    const requestPath = path.join(root, "setup-request.json");
    await save(requestPath, request);
    const processResult = spawnSync(
      process.execPath,
      [
        "--experimental-vm-modules",
        "scripts/bot-improvement/setup-session.ts",
        requestPath,
      ],
      { encoding: "utf8", timeout: 30000 },
    );
    assert.equal(processResult.status, 0, processResult.stderr);
    const setup = JSON.parse(processResult.stdout);
    const options = {
      session: setup.session,
      iteration: 1,
      runnerIdentity: "test-v1",
    };
    await controlSession(setup.session, { action: "start", iteration: 1 });
    const prepared = await prepareIteration(options);
    return { root, setup, options, prepared };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

test("actual setup and iteration snapshots validate, promote and prepare the next iteration", async () => {
  const { root, setup, options, prepared } = await preparedSession();
  try {
    const statePath = path.join(setup.session, "state.json");
    const before = await readFile(statePath, "utf8");
    const originalDescriptor = await readFile(
      path.join(prepared.candidate.path, "frozen-bot.json"),
      "utf8",
    );
    await writeFile(
      path.join(prepared.candidate.path, "strategy.mjs"),
      "export const createStrategy = () => () => ({score: 7});",
    );
    const result = await validateCandidate({
      schemaVersion: 1,
      fixture: prepared.fixture,
      accepted: prepared.accepted,
      candidate: prepared.candidate.path,
      output: path.join(root, "validation-1"),
    });
    assert.equal(result.status, "valid", JSON.stringify(result));
    assert.equal(await readFile(statePath, "utf8"), before);
    assert.equal(
      await readFile(
        path.join(result.evidence, "submitted/frozen-bot.json"),
        "utf8",
      ),
      originalDescriptor,
    );
    assert.equal(
      await readFile(
        path.join(prepared.candidate.path, "frozen-bot.json"),
        "utf8",
      ),
      originalDescriptor,
    );
    const candidate = result.candidate!;
    assert.deepEqual(
      await json(path.join(candidate.path, "frozen-bot.json")),
      candidate.bot,
    );
    assert.equal(Object.hasOwn(candidate.bot.files, "frozen-bot.json"), false);
    const payload = await readTree(candidate.path);
    delete payload["frozen-bot.json"];
    assert.deepEqual(hashes(payload), candidate.bot.files);
    const submitted = await readTree(path.join(result.evidence, "submitted"));
    delete submitted["frozen-bot.json"];
    delete submitted["bot.mjs"];
    assert.equal(result.sourceIdentity, identity(hashes(submitted)));
    assert.notEqual(candidate.bot.identity, prepared.accepted.bot.identity);

    const request = await decisionRequest(
      setup.session,
      prepared.manifest,
      result,
    );
    const outcome = await applyDecision(request);
    assert.equal(outcome.accepted.identity, candidate.bot.identity);
    assert.deepEqual(
      await applyDecision({
        ...request,
        manifest: {
          sha256: request.manifest.sha256,
          path: request.manifest.path,
        },
      }),
      outcome,
    );
    await controlSession(setup.session, { action: "start", iteration: 2 });
    const next = await prepareIteration({ ...options, iteration: 2 });
    assert.equal(next.accepted.identity, candidate.bot.identity);
    assert.equal(next.self.identity, candidate.bot.identity);
    assert.notEqual(next.comparisonIdentity, prepared.comparisonIdentity);
    const second = await validateCandidate({
      schemaVersion: 1,
      fixture: next.fixture,
      accepted: next.accepted,
      candidate: next.candidate.path,
      output: path.join(root, "validation-2"),
    });
    assert.equal(second.status, "valid", JSON.stringify(second));
    assert.deepEqual(
      (await prepareIteration({ ...options, iteration: 2 })).candidate,
      next.candidate,
    );
    const secondOutcome = await applyDecision(
      await decisionRequest(setup.session, next.manifest, second),
    );
    assert.deepEqual(await applyDecision(request), outcome);
    assert.deepEqual((await json(statePath)).accepted, secondOutcome.accepted);
    assert.equal((await json(statePath)).iteration, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("prepared accepted and candidate descriptors reject corruption and self-consistent forgeries", async () => {
  const { root, prepared } = await preparedSession();
  try {
    await writeFile(
      path.join(prepared.candidate.path, "strategy.mjs"),
      "export const createStrategy = () => () => ({score: 7});",
    );
    let attempt = 0;
    for (const archive of [prepared.accepted.path, prepared.candidate.path]) {
      const file = path.join(archive, "frozen-bot.json");
      const original = await readFile(file, "utf8");
      const { identity: _id, ...body } = prepared.accepted.bot;
      void _id;
      const changed = { ...body, configuration: { forged: true } };
      const selfConsistent = { ...changed, identity: identity(changed) };
      const changedFiles = {
        ...body,
        files: { ...body.files, "bot.mjs": "forged" },
      };
      for (const descriptor of [
        "{",
        JSON.stringify({ ...prepared.accepted.bot, identity: "forged" }),
        JSON.stringify(selfConsistent),
        JSON.stringify({ ...changedFiles, identity: identity(changedFiles) }),
      ]) {
        await writeFile(file, descriptor);
        const result = await validateCandidate({
          schemaVersion: 1,
          fixture: prepared.fixture,
          accepted: prepared.accepted,
          candidate: prepared.candidate.path,
          output: path.join(root, `forged-${++attempt}`),
        });
        assert.equal(result.status, "invalid", JSON.stringify(result));
        assert.equal(result.reasons[0]?.category, "input");
        assert.match(result.reasons[0]!.message, /archive descriptor/);
        assert.equal(result.candidate, undefined);
        if (archive === prepared.candidate.path)
          assert.equal(
            await readFile(
              path.join(result.evidence, "submitted/frozen-bot.json"),
              "utf8",
            ),
            descriptor,
          );
      }
      await writeFile(file, original);
    }
    // The reserved sidecar cannot be smuggled into the accepted payload hash set.
    const { identity: _id, ...body } = prepared.accepted.bot;
    void _id;
    const recursive = {
      ...body,
      files: { ...body.files, "frozen-bot.json": "forged" },
    };
    const forged: FrozenBot = { ...recursive, identity: identity(recursive) };
    const result = await validateCandidate({
      schemaVersion: 1,
      fixture: prepared.fixture,
      accepted: { ...prepared.accepted, bot: forged },
      candidate: prepared.candidate.path,
      output: path.join(root, "recursive-descriptor"),
    });
    assert.equal(result.status, "invalid");
    assert.match(result.reasons[0]!.message, /descriptor identity mismatch/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function decisionRequest(
  session: string,
  manifest: string,
  validation: CandidateValidationResult,
  finish = true,
): Promise<CandidateDecisionRequest> {
  const resultPath = path.join(validation.evidence, "result.json");
  if (finish)
    await controlSession(session, {
      action: "finish",
      iteration: (await json(manifest)).iteration,
      status: validation.status === "valid" ? "complete" : "failed",
      evidence: {
        path: path.relative(session, manifest),
        sha256: digest(await readFile(manifest)),
      },
    });
  return {
    schemaVersion: 1,
    session,
    manifest: { path: manifest, sha256: digest(await readFile(manifest)) },
    validation: {
      path: resultPath,
      sha256: digest(await readFile(resultPath)),
    },
    candidateIdentity: validation.candidate?.bot.identity ?? null,
    decision: "accept",
    rationale: "Orchestrator chose the measured heuristic; test evidence.",
    evidence: [],
  };
}
async function validatedSession(finish = true) {
  const f = await preparedSession();
  try {
    await writeFile(
      path.join(f.prepared.candidate.path, "strategy.mjs"),
      "export const createStrategy = () => () => ({score: 8});",
    );
    const validation = await validateCandidate({
      schemaVersion: 1,
      fixture: f.prepared.fixture,
      accepted: f.prepared.accepted,
      candidate: f.prepared.candidate.path,
      output: path.join(f.root, "validation"),
    });
    assert.equal(validation.status, "valid", JSON.stringify(validation));
    return {
      ...f,
      validation,
      request: await decisionRequest(
        f.setup.session,
        f.prepared.manifest,
        validation,
        finish,
      ),
    };
  } catch (error) {
    await rm(f.root, { recursive: true, force: true });
    throw error;
  }
}

test("decision rejects stale, conflicting, mismatched and corrupt inputs without changing state", async () => {
  const f = await validatedSession();
  try {
    const statePath = path.join(f.setup.session, "state.json");
    const before = await readFile(statePath, "utf8");
    for (const request of [
      { ...f.request, candidateIdentity: "other" },
      {
        ...f.request,
        validation: { ...f.request.validation, sha256: "other" },
      },
      { ...f.request, manifest: { ...f.request.manifest, sha256: "other" } },
      {
        ...f.request,
        evidence: [{ path: f.request.manifest.path, sha256: "other" }],
      },
    ]) {
      await assert.rejects(applyDecision(request), /identity mismatch/);
      assert.equal(await readFile(statePath, "utf8"), before);
    }
    const validationRequestPath = path.join(
      f.validation.evidence,
      "request.json",
    );
    const originalRequest = await readFile(validationRequestPath);
    const validationRequest = JSON.parse(originalRequest.toString());
    await save(validationRequestPath, {
      ...validationRequest,
      candidate: "another-iteration/candidate",
    });
    await assert.rejects(
      applyDecision(f.request),
      /does not bind prepared candidate/,
    );
    await writeFile(validationRequestPath, originalRequest);
    const occupied = path.join(f.setup.session, "versions/iteration-0001");
    await mkdir(occupied);
    await assert.rejects(applyDecision(f.request), /destination exists/);
    await rm(occupied, { recursive: true });
    const botPath = path.join(f.validation.candidate!.path, "bot.mjs");
    const bytes = await readFile(botPath);
    await writeFile(botPath, "tampered");
    await assert.rejects(applyDecision(f.request), /archive identity mismatch/);
    await writeFile(botPath, bytes);
    const state = JSON.parse(before);
    await save(statePath, {
      ...state,
      accepted: { ...state.accepted, identity: "different" },
    });
    await assert.rejects(applyDecision(f.request), /Stale iteration/);
    await save(statePath, { ...state, iteration: 2 });
    await assert.rejects(applyDecision(f.request), /Stale or out-of-order/);
    await save(statePath, state);
    const lock = path.join(f.setup.session, ".session-state.lock");
    await mkdir(lock);
    await assert.rejects(applyDecision(f.request), /EEXIST/);
    await assert.rejects(prepareIteration(f.options), /EEXIST/);
    await rm(lock, { recursive: true });
    const competing = await Promise.allSettled([
      applyDecision(f.request),
      applyDecision(f.request),
    ]);
    assert.equal(
      competing.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      competing.filter((result) => result.status === "rejected").length,
      1,
    );
    const result = await applyDecision(f.request);
    await assert.rejects(
      applyDecision({ ...f.request, decision: "reject" }),
      /Conflicting decision/,
    );
    assert.deepEqual(await applyDecision(f.request), result);
    assert.equal((await json(statePath)).iteration, 1);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("published decision recovers the state commit from its archive and preserves unrelated fields", async () => {
  const f = await validatedSession();
  try {
    const statePath = path.join(f.setup.session, "state.json");
    const before = {
      ...(await json(statePath)),
      status: "stopped",
      stoppingReason: "owner",
      completedGames: ["game-1"],
      budgets: { used: 7 },
    };
    await save(statePath, before);
    const result = await applyDecision(f.request);
    // Recreate the durable boundary: journal published, state rename interrupted.
    await save(statePath, before);
    await rm(f.validation.evidence, { recursive: true });
    await rm(f.prepared.manifest);
    await assert.rejects(
      prepareIteration({ ...f.options, iteration: 2 }),
      /Pending decision/,
    );
    await save(statePath, {
      ...before,
      accepted: { ...before.accepted, identity: "drift" },
    });
    await assert.rejects(
      applyDecision(f.request),
      /Stale decision recovery state/,
    );
    await save(statePath, before);
    assert.deepEqual(await applyDecision(f.request), result);
    const after = await json(statePath);
    assert.deepEqual(after.accepted, result.accepted);
    assert.equal(after.iteration, 1);
    for (const field of [
      "status",
      "stoppingReason",
      "completedGames",
      "budgets",
    ])
      assert.deepEqual(after[field], before[field as keyof typeof before]);
    const next = await prepareIteration({ ...f.options, iteration: 2 });
    assert.equal(next.accepted.identity, f.request.candidateIdentity);
    assert.deepEqual(await applyDecision(f.request), result);
    await writeFile(
      path.join(result.archive, "validation/candidate/bot.mjs"),
      "corrupt",
    );
    await assert.rejects(applyDecision(f.request), /archive identity mismatch/);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("reject via CLI archives valid evidence, retains accepted bot and prepares another iteration", async () => {
  const f = await validatedSession();
  try {
    const statePath = path.join(f.setup.session, "state.json");
    const before = await json(statePath);
    const request = { ...f.request, decision: "reject" as const };
    const file = path.join(f.root, "decision.json");
    // Exercise request-relative named inputs, including rationale evidence.
    await save(file, {
      ...request,
      session: path.relative(f.root, request.session),
      manifest: {
        ...request.manifest,
        path: path.relative(f.root, request.manifest.path),
      },
      validation: {
        ...request.validation,
        path: path.relative(f.root, request.validation.path),
      },
      evidence: [
        {
          path: path.relative(f.root, request.manifest.path),
          sha256: request.manifest.sha256,
        },
      ],
    });
    const run = spawnSync(
      process.execPath,
      ["scripts/bot-improvement/apply-decision.ts", file],
      { encoding: "utf8", timeout: 30000 },
    );
    assert.equal(run.status, 0, run.stderr);
    const result = JSON.parse(run.stdout);
    assert.deepEqual(result.accepted, before.accepted);
    assert.equal(result.decision, "reject");
    assert.equal((await json(statePath)).iteration, 1);
    assert.equal(
      await readFile(path.join(result.archive, "evidence/0"), "utf8"),
      await readFile(f.request.manifest.path, "utf8"),
    );
    const next = await prepareIteration({
      ...f.options,
      iteration: result.nextIteration,
    });
    assert.equal(next.accepted.identity, before.accepted.identity);
    assert.equal(next.comparisonIdentity, f.prepared.comparisonIdentity);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("invalid validation cannot be accepted but rejection preserves failed build evidence", async () => {
  const f = await preparedSession();
  try {
    await writeFile(
      path.join(f.prepared.candidate.path, "strategy.mjs"),
      "not valid javascript {",
    );
    const validation = await validateCandidate({
      schemaVersion: 1,
      fixture: f.prepared.fixture,
      accepted: f.prepared.accepted,
      candidate: f.prepared.candidate.path,
      output: path.join(f.root, "invalid"),
    });
    assert.equal(validation.status, "invalid");
    const request = await decisionRequest(
      f.setup.session,
      f.prepared.manifest,
      validation,
    );
    const statePath = path.join(f.setup.session, "state.json");
    const before = await json(statePath);
    await assert.rejects(applyDecision(request), /Invalid candidate/);
    const result = await applyDecision({ ...request, decision: "reject" });
    assert.deepEqual((await json(statePath)).accepted, before.accepted);
    assert.deepEqual(
      await json(path.join(result.archive, "validation/result.json")),
      validation,
    );
    assert.equal(
      (await prepareIteration({ ...f.options, iteration: 2 })).accepted
        .identity,
      before.accepted.identity,
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("promotion requires ledger finish after reservation settlement and remains compatible with control/report", async () => {
  const f = await validatedSession(false);
  try {
    const before = await readFile(
      path.join(f.setup.session, "state.json"),
      "utf8",
    );
    await assert.rejects(
      applyDecision(f.request),
      /Finish the iteration ledger/,
    );
    const fixture = await json(
      path.join(f.prepared.fixture.path, "manifest.json"),
    );
    const reservation = await controlSession(f.setup.session, {
      action: "reserve",
      iteration: 1,
      role: "candidate",
      match: fixture.matches[0].id,
      executableIdentity: f.validation.candidate!.bot.identity,
      runnerIdentity: f.options.runnerIdentity,
    });
    assert.equal(reservation.reservation?.launch, true);
    await assert.rejects(applyDecision(f.request), /settle all reservations/);
    await assert.rejects(
      controlSession(f.setup.session, {
        action: "finish",
        iteration: 1,
        status: "complete",
        evidence: {
          path: path.relative(f.setup.session, f.request.manifest.path),
          sha256: f.request.manifest.sha256,
        },
      }),
      /Settle running attempts/,
    );
    assert.equal(
      await readFile(path.join(f.setup.session, "state.json"), "utf8"),
      before,
    );
    await controlSession(f.setup.session, {
      action: "settle",
      iteration: 1,
      role: "candidate",
      match: fixture.matches[0].id,
      attempt: reservation.reservation!.attempt.attempt,
      status: "interrupted",
      games: [],
    });
    await decisionRequest(f.setup.session, f.prepared.manifest, f.validation);
    const outcome = await applyDecision(f.request);
    const file = path.join(outcome.archive, "outcome.json");
    await controlSession(f.setup.session, {
      action: "record",
      iteration: 1,
      kind: "decision",
      evidence: {
        path: path.relative(f.setup.session, file),
        sha256: digest(await readFile(file)),
      },
    });
    const plan = await controlSession(f.setup.session, { action: "plan" });
    assert.deepEqual(plan.accepted, outcome.accepted);
    assert.equal(plan.reservedGames, 0);
    assert.equal(plan.completedGames, 0);
    const report = await controlSession(f.setup.session, { action: "report" });
    assert.deepEqual(report.accepted, outcome.accepted);
    assert.equal(plan.records[0]?.kind, "decision");
    await controlSession(f.setup.session, { action: "start", iteration: 2 });
    assert.equal(
      (await prepareIteration({ ...f.options, iteration: 2 })).accepted
        .identity,
      outcome.accepted.identity,
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("acceptance cannot switch the executable recorded by candidate evaluation attempts", async () => {
  const f = await validatedSession(false);
  try {
    const fixture = await json(
      path.join(f.prepared.fixture.path, "manifest.json"),
    );
    const reservation = await controlSession(f.setup.session, {
      action: "reserve",
      iteration: 1,
      role: "candidate",
      match: fixture.matches[0].id,
      executableIdentity: "another-validated-executable",
      runnerIdentity: f.options.runnerIdentity,
    });
    await controlSession(f.setup.session, {
      action: "settle",
      iteration: 1,
      role: "candidate",
      match: fixture.matches[0].id,
      attempt: reservation.reservation!.attempt.attempt,
      status: "failed",
      games: [],
    });
    await decisionRequest(f.setup.session, f.prepared.manifest, f.validation);
    await assert.rejects(
      applyDecision(f.request),
      /Evaluated candidate executable identity/,
    );
    const result = await applyDecision({ ...f.request, decision: "reject" });
    assert.equal(result.accepted.identity, f.prepared.accepted.identity);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("runner bridge settles validated candidates before decision and binds the promoted next iteration", async () => {
  const f = await validatedSession(false);
  try {
    const snapshot = path.join(f.root, "runner-snapshot.json");
    await save(snapshot, { schemaVersion: 1, ...f.validation.candidate });
    // Exercise executeMatches and its actual persistent control bridge without
    // playing games: the fake evaluator leaves a failed, fully settled attempt.
    const binary = path.join(f.root, "fake-evaluator.mjs");
    await writeFile(
      binary,
      String.raw`#!${process.execPath}
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const job = JSON.parse(readFileSync(process.argv[process.argv.indexOf("--job") + 1]));
const out = process.argv[process.argv.indexOf("--out") + 1];
const match = job.matches[0].match.id;
const commands = [
  { type: "initialize", binding: job.sessionControl },
  { type: "reserve", match },
  { type: "settle", match, attempt: 1, status: "failed", games: [] },
];
const bridge = spawnSync(process.execPath, [${JSON.stringify(path.resolve("scripts/bot-improvement/runner-control-host.ts"))}], {
  input: commands.map(c => JSON.stringify(c)).join("\n") + "\n", encoding: "utf8"
});
if (bridge.status !== 0) throw new Error(bridge.stderr);
const replies = bridge.stdout.trim().split("\n").map(line => JSON.parse(line));
if (replies.some(r => r.type !== "control") || !replies[1].plan.reservation?.launch || replies[2].plan.running.length) throw new Error(bridge.stdout);
mkdirSync(out, { recursive: true });
writeFileSync(out + "/result.json", JSON.stringify({ completedGames: 0, failedMatches: 1 }));
process.exitCode = 2;
`,
      { mode: 0o755 },
    );
    const run = await executeMatches({
      session: f.setup.session,
      out: path.join(f.setup.session, "evaluations/candidate"),
      candidate: snapshot,
      workers: "1",
      matchCount: 1,
      binary,
    });
    assert.equal(run.exitCode, 2);
    const ledger = await json(path.join(f.setup.session, "control.json"));
    assert.equal(ledger.attempts.length, 1);
    assert.equal(ledger.attempts[0].status, "failed");
    assert.equal(
      ledger.attempts[0].executableIdentity,
      f.validation.candidate!.bot.identity,
    );
    assert.notEqual(
      ledger.attempts[0].executableIdentity,
      f.validation.executableIdentity,
    );
    await assert.rejects(
      applyDecision(f.request),
      /Finish the iteration ledger/,
    );
    const request = await decisionRequest(
      f.setup.session,
      f.prepared.manifest,
      f.validation,
    );
    // Match-quality judgment stays with the orchestrator; this test checks only
    // lifecycle and byte identity, not an endorsement of failed match evidence.
    const outcome = await applyDecision(request);
    assert.equal(
      outcome.accepted.identity,
      f.validation.candidate!.bot.identity,
    );
    const next = await bindMatches({
      session: f.setup.session,
      out: path.join(f.setup.session, "evaluations/next-control"),
    });
    try {
      assert.equal(next.iteration, 2);
      assert.equal(next.accepted.bot.identity, outcome.accepted.identity);
      const plan = await controlSession(f.setup.session, {
        action: "start",
        iteration: next.iteration,
      });
      assert.deepEqual(plan.iterations.at(-1)?.accepted, outcome.accepted);
    } finally {
      await next.release();
    }
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
