import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { controlSession } from "../../scripts/bot-improvement/control-session.ts";
import { prepareIteration } from "../../scripts/bot-improvement/prepare-iteration.ts";
import {
  digest,
  identity,
  schedule,
} from "../../scripts/bot-improvement/session-fixtures.ts";
import { cardCode } from "../../src/battle/duel/contracts/ids.ts";
import type { FrozenSetup } from "../../scripts/bot-improvement/session-contract.ts";
import type { ControlAction } from "../../scripts/bot-improvement/session-control-contract.ts";

const save = async (file: string, data: unknown) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data));
};
async function fixture(
  stop: {
    maxIterations?: number;
    maxGames?: number;
    maxWallMs?: number;
    ownerStop?: true;
  } = { maxIterations: 2, maxGames: 20 },
) {
  await mkdir(".tmp", { recursive: true });
  const session = await mkdtemp(path.resolve(".tmp/control-test-"));
  const root = path.join(session, "fixture");
  const body = {
    kind: "module" as const,
    module: "builtin:basic",
    configuration: {},
    deck: { main: [cardCode(1)], extra: [], side: [] },
    files: { "bot.mjs": digest("bot") },
  };
  const bot = { ...body, identity: identity(body) };
  const frozenBody = {
    schemaVersion: 1 as const,
    setupSeed: "control",
    inputsIdentity: "inputs",
    profile: "mr5" as const,
    protocol: {} as FrozenSetup["protocol"],
    target: bot,
    opponents: [],
    files: { "versions/initial/bot.mjs": digest("bot") },
    matches: schedule("control", bot.deck, []),
  };
  const frozen = { ...frozenBody, identity: identity(frozenBody) };
  await save(path.join(root, "manifest.json"), frozen);
  await mkdir(path.join(root, "versions/initial"), { recursive: true });
  await writeFile(path.join(root, "versions/initial/bot.mjs"), "bot");
  const accepted = {
    path: path.join(root, "versions/initial"),
    identity: bot.identity,
  };
  await save(path.join(session, "config.json"), {
    schemaVersion: 1,
    fixture: { path: root, identity: frozen.identity },
    accepted,
    limits: { stop, matchWorkers: 2 },
  });
  await save(path.join(session, "state.json"), {
    schemaVersion: 1,
    fixtureIdentity: frozen.identity,
    accepted,
    iteration: 0,
    completedGames: [],
    completedMatches: [],
    stoppingReason: null,
  });
  await mkdir(path.join(session, "iterations"));
  const run = (action: ControlAction) => controlSession(session, action);
  await prepareIteration({
    session,
    iteration: 1,
    runnerIdentity: "runner-v1",
  });
  const ref = { path: "evidence.json", sha256: digest("evidence") };
  await writeFile(path.join(session, ref.path), "evidence");
  const reserve = {
    action: "reserve" as const,
    runnerIdentity: "runner-v1",
    iteration: 1,
    role: "candidate" as const,
    match: frozen.matches[0]!.id,
    executableIdentity: "validated-candidate",
  };
  const settle = {
    action: "settle" as const,
    iteration: 1,
    role: "candidate" as const,
    match: reserve.match,
    attempt: 1,
    status: "complete" as const,
    games: [1, 2, 3, 4].map((number) => ({ number, evidence: ref })),
  };
  return { session, run, ref, reserve, settle, accepted };
}

test("owner stops are sticky, settlement is allowed, continuation preserves evidence and budgets", async () => {
  const f = await fixture();
  try {
    await f.run({ action: "start", iteration: 1 });
    assert.equal((await f.run(f.reserve)).reservation?.launch, true);
    const repeated = await f.run(f.reserve);
    assert.equal(repeated.running.length, 1);
    assert.equal(repeated.reservation?.launch, false);
    await writeFile(path.join(f.session, "OWNER_STOP"), "owner requested stop");
    const stopped = await f.run({ action: "plan" });
    assert.equal(stopped.stoppingReason, "owner-stop");
    assert.equal(stopped.cancel.length, 1);
    assert.equal(stopped.completedGames, 0);
    assert.equal(stopped.reservedGames, 4);
    await assert.rejects(
      f.run({ action: "continue", ownerStopToken: stopped.ownerStopToken! }),
      /Settle/,
    );
    await f.run(f.settle);
    await f.run(f.settle); // idempotent receipt delivery
    await assert.rejects(f.run({ ...f.settle, games: [] }), /Invalid/);
    await assert.rejects(f.run({ action: "continue" }), /Explicit owner-stop/);
    const continued = await f.run({
      action: "continue",
      ownerStopToken: stopped.ownerStopToken!,
    });
    assert.equal(continued.completedGames, 4);
    assert.equal(continued.reservedGames, 0);
    assert.deepEqual(continued.accepted, f.accepted);
    await f.run(f.reserve);
    assert.equal((await f.run({ action: "plan" })).running.length, 0);
    await f.run({
      action: "finish",
      iteration: 1,
      status: "complete",
      evidence: f.ref,
    });
    await assert.rejects(
      f.run({ action: "start", iteration: 1 }),
      /already settled/,
    );
    assert.equal((await f.run({ action: "start", iteration: 2 })).iteration, 2);
  } finally {
    await rm(f.session, { recursive: true, force: true });
  }
});

test("reservations enforce game ceilings; partial retries charge actual games and completed matches stay unique", async () => {
  const f = await fixture({ maxGames: 5 });
  try {
    await f.run({ action: "start", iteration: 1 });
    await f.run(f.reserve);
    const denied = await f.run({ ...f.reserve, match: "match-0002" });
    assert.equal(denied.stoppingReason, null);
    assert.equal(denied.reservation, null);
    await f.run({
      ...f.settle,
      status: "interrupted",
      games: f.settle.games.slice(0, 1),
    });
    await f.run({ action: "continue" });
    await f.run(f.reserve);
    const report = await f.run({ action: "report" });
    assert.equal(report.completedGames, 1);
    assert.equal(report.reservedGames, 4);
    assert.equal(report.running[0]!.attempt, 2);
    await f.run({ ...f.settle, attempt: 2 });
    const exhausted = await f.run({ action: "plan" });
    assert.equal(exhausted.completedGames, 5);
    assert.equal(exhausted.completedMatches.length, 1);
    assert.equal(exhausted.stoppingReason, "max-games");
    assert.equal(
      (await f.run({ action: "continue" })).stoppingReason,
      "max-games",
    );
  } finally {
    await rm(f.session, { recursive: true, force: true });
  }
});

test("iteration cap and interruption survive restart; accounting cannot be silently migrated or extended", async () => {
  const f = await fixture({ maxIterations: 1 });
  try {
    await f.run({ action: "start", iteration: 1 });
    await f.run({ action: "stop", reason: "interrupted" });
    assert.equal(
      (await f.run({ action: "start", iteration: 1 })).mayStart,
      false,
    );
    await f.run({ action: "continue" });
    await f.run({ action: "start", iteration: 1 });
    await f.run({
      action: "finish",
      iteration: 1,
      status: "failed",
      evidence: f.ref,
    });
    assert.equal(
      (await f.run({ action: "start", iteration: 2 })).stoppingReason,
      "max-iterations",
    );
    const configPath = path.join(f.session, "config.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    await save(configPath, {
      ...config,
      limits: { ...config.limits, stop: { maxIterations: 10 } },
    });
    await assert.rejects(
      f.run({ action: "plan" }),
      /budgets cannot be extended/,
    );
  } finally {
    await rm(f.session, { recursive: true, force: true });
  }
});

test("crashed running attempts remain reserved; wall deadline requests cancellation and reports distinguish missing evidence", async () => {
  const f = await fixture({ maxWallMs: 100000 });
  try {
    await f.run({ action: "start", iteration: 1 });
    await f.run(f.reserve);
    const ledgerPath = path.join(f.session, "control.json");
    const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
    await save(ledgerPath, { ...ledger, activeSince: Date.now() - 200000 });
    const stopped = await f.run({ action: "plan" });
    assert.equal(stopped.stoppingReason, "max-wall-ms");
    assert.equal(stopped.cancel.length, 1);
    await f.run({
      ...f.settle,
      status: "failed",
      games: f.settle.games.slice(0, 2),
    });
    await f.run({
      action: "record",
      iteration: 1,
      kind: "comparison",
      evidence: f.ref,
    });
    await assert.rejects(
      f.run({
        action: "record",
        iteration: 1,
        kind: "decision",
        evidence: { path: "../outside", sha256: "bad" },
      }),
      /Unsafe/,
    );
    await writeFile(path.join(f.session, f.ref.path), "changed");
    await f.run({ action: "report" });
    const report = JSON.parse(
      await readFile(path.join(f.session, "report.json"), "utf8"),
    );
    assert.equal(report.completedGames, 2);
    assert.equal(report.completedMatches.length, 0);
    assert.equal(report.attempts[0].status, "failed");
    assert.equal(report.recorded[0].content, null);
    assert.equal(
      report.evidence.every((r: { intact: boolean }) => !r.intact),
      true,
    );
    assert.equal(
      (await f.run({ action: "continue" })).stoppingReason,
      "max-wall-ms",
    );
  } finally {
    await rm(f.session, { recursive: true, force: true });
  }
});

test("shared lock, execution identity, evidence checks and CLI failures preserve durable state", async () => {
  const f = await fixture();
  try {
    await f.run({ action: "start", iteration: 1 });
    await mkdir(path.join(f.session, ".session-state.lock"));
    await assert.rejects(f.run({ action: "plan" }), /EEXIST/);
    await assert.rejects(
      prepareIteration({
        session: f.session,
        iteration: 1,
        runnerIdentity: "runner-v1",
      }),
      /EEXIST/,
    );
    await rm(path.join(f.session, ".session-state.lock"), { recursive: true });
    await assert.rejects(
      f.run({ ...f.reserve, runnerIdentity: "other" }),
      /binding mismatch/,
    );
    await f.run(f.reserve);
    await assert.rejects(
      f.run({
        ...f.settle,
        games: [{ number: 1, evidence: { ...f.ref, sha256: "wrong" } }],
        status: "failed",
      }),
      /Evidence mismatch/,
    );
    assert.equal((await f.run({ action: "plan" })).running.length, 1);
    const request = path.join(f.session, "request.json");
    await save(request, { action: "report" });
    const cli = spawnSync(
      process.execPath,
      ["scripts/bot-improvement/control-session.ts", f.session, request],
      { encoding: "utf8" },
    );
    assert.equal(cli.status, 0, cli.stderr);
    assert.equal(JSON.parse(cli.stdout).reservedGames, 4);
    await f.run({ ...f.settle, status: "interrupted", games: [] });
    await assert.rejects(
      f.run({ ...f.reserve, executableIdentity: "different" }),
      /identity changed/,
    );
    const ledger = await readFile(path.join(f.session, "control.json"));
    await save(request, { action: "nonexistent" });
    assert.equal(
      spawnSync(process.execPath, [
        "scripts/bot-improvement/control-session.ts",
        f.session,
        request,
      ]).status,
      1,
    );
    assert.deepEqual(
      await readFile(path.join(f.session, "control.json")),
      ledger,
    );
  } finally {
    await rm(f.session, { recursive: true, force: true });
  }
});

test("new owner request invalidates an old continuation token; unaccounted progress fails closed", async () => {
  const f = await fixture();
  try {
    await f.run({ action: "start", iteration: 1 });
    await writeFile(path.join(f.session, "OWNER_STOP"), "first request");
    const first = await f.run({ action: "plan" });
    await writeFile(path.join(f.session, "OWNER_STOP"), "second request");
    await assert.rejects(
      f.run({ action: "continue", ownerStopToken: first.ownerStopToken! }),
      /Explicit owner-stop/,
    );
    const second = await f.run({ action: "plan" });
    assert.notEqual(second.ownerStopToken, first.ownerStopToken);
    await rm(path.join(f.session, "control.json"));
    const stateFile = path.join(f.session, "state.json");
    const state = JSON.parse(await readFile(stateFile, "utf8"));
    await save(stateFile, { ...state, completedGames: ["legacy-game"] });
    await assert.rejects(
      f.run({ action: "plan" }),
      /explicit accounting migration/,
    );
  } finally {
    await rm(f.session, { recursive: true, force: true });
  }
});

test("plans deny budgets too small for a match and interrupted checkpoints require explicit continuation", async () => {
  const small = await fixture({ maxGames: 3 });
  try {
    const plan = await small.run({ action: "plan" });
    assert.equal(plan.mayStart, false);
    assert.equal(plan.stoppingReason, "max-games");
    assert.equal(
      (await small.run({ action: "start", iteration: 1 })).iterations.length,
      0,
    );
  } finally {
    await rm(small.session, { recursive: true, force: true });
  }
  const f = await fixture();
  try {
    await f.run({ action: "start", iteration: 1 });
    await f.run({
      action: "finish",
      iteration: 1,
      status: "interrupted",
      evidence: f.ref,
    });
    assert.equal(
      (await f.run({ action: "start", iteration: 1 })).mayStart,
      false,
    );
    await f.run({ action: "continue" });
    const resumed = await f.run({ action: "start", iteration: 1 });
    assert.equal(resumed.mayStart, true);
    assert.equal(resumed.iterations.length, 1);
    await f.run({
      action: "record",
      iteration: 1,
      kind: "decision",
      evidence: f.ref,
    });
    await f.run({
      action: "record",
      iteration: 1,
      kind: "decision",
      evidence: f.ref,
    });
    const second = { path: "another.json", sha256: digest("another") };
    await writeFile(path.join(f.session, second.path), "another");
    await assert.rejects(
      f.run({
        action: "record",
        iteration: 1,
        kind: "decision",
        evidence: second,
      }),
      /already published/,
    );
    assert.equal((await f.run({ action: "plan" })).records.length, 1);
  } finally {
    await rm(f.session, { recursive: true, force: true });
  }
});
