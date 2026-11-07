import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { prepareIteration } from "../../scripts/bot-improvement/prepare-iteration.ts";
import {
  digest,
  identity,
  schedule,
} from "../../scripts/bot-improvement/session-fixtures.ts";
import type {
  FrozenSetup,
  FrozenBot,
} from "../../scripts/bot-improvement/session-contract.ts";
import type { BaselineReceipt } from "../../scripts/bot-improvement/iteration-contract.ts";
import { cardCode } from "../../src/battle/duel/contracts/ids.ts";

const save = async (file: string, value: unknown) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value));
};
async function fixture() {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/iteration-test-"));
  const frozenPath = path.join(root, "fixture"),
    session = path.join(root, "session");
  const body = {
    kind: "module" as const,
    configuration: {},
    module: "builtin:basic",
    deck: { main: [cardCode(1)], extra: [], side: [] },
    files: { "bot.mjs": digest("initial") },
  };
  const bot: FrozenBot = { ...body, identity: identity(body) };
  const setupBody = {
    schemaVersion: 1 as const,
    setupSeed: "seed",
    inputsIdentity: "inputs",
    profile: "mr5" as const,
    protocol: {} as FrozenSetup["protocol"],
    target: bot,
    opponents: [bot],
    files: {
      "versions/initial/bot.mjs": digest("initial"),
      "opponents/opponent-1/bot.mjs": digest("initial"),
    },
    matches: schedule("seed", bot.deck, [bot.deck]),
  };
  const frozen = { ...setupBody, identity: identity(setupBody) };
  await save(path.join(frozenPath, "manifest.json"), frozen);
  for (const file of Object.keys(frozen.files)) {
    await mkdir(path.dirname(path.join(frozenPath, file)), { recursive: true });
    await writeFile(path.join(frozenPath, file), "initial");
  }
  const accepted = {
    path: path.join(frozenPath, "versions/initial"),
    identity: bot.identity,
  };
  await save(path.join(session, "config.json"), {
    schemaVersion: 1,
    fixture: { path: frozenPath, identity: frozen.identity },
    accepted,
  });
  await save(path.join(session, "state.json"), {
    schemaVersion: 1,
    fixtureIdentity: frozen.identity,
    accepted,
    iteration: 0,
  });
  await mkdir(path.join(session, "iterations"));
  return {
    root,
    session,
    frozen,
    accepted,
    options: { session, iteration: 1, runnerIdentity: "runner-v1" },
  };
}

test("iteration CLI snapshots control/self and retries preserve candidate edits and session progress", async () => {
  const f = await fixture();
  try {
    const run = spawnSync(
      process.execPath,
      [
        "scripts/bot-improvement/prepare-iteration.ts",
        "--session",
        f.session,
        "--iteration",
        "1",
        "--runner-identity",
        "runner-v1",
      ],
      { encoding: "utf8" },
    );
    assert.equal(run.status, 0, run.stderr);
    const first = JSON.parse(run.stdout);
    assert.deepEqual(first.control, first.self);
    assert.equal(first.opponents.at(-1).identity, f.accepted.identity);
    assert.equal(first.baseline.reason, "missing");
    assert.equal(first.candidate.identity, null);
    assert.equal(
      await readFile(path.join(first.control.path, "bot.mjs"), "utf8"),
      "initial",
    );
    await writeFile(path.join(first.candidate.path, "bot.mjs"), "edited");
    assert.deepEqual(await prepareIteration(f.options), first);
    assert.equal(
      await readFile(path.join(first.candidate.path, "bot.mjs"), "utf8"),
      "edited",
    );
    assert.deepEqual(await readdir(path.join(f.session, "iterations")), [
      "iteration-0001",
    ]);
    assert.equal(
      JSON.parse(await readFile(path.join(f.session, "state.json"), "utf8"))
        .iteration,
      0,
    );
    await assert.rejects(
      prepareIteration({ ...f.options, runnerIdentity: "runner-v2" }),
      /identity mismatch/,
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("baseline reuse requires exact comparison identity, complete coverage and intact evidence", async () => {
  const f = await fixture();
  try {
    const first = await prepareIteration(f.options);
    const receipt = path.join(f.root, "baseline/receipt.json");
    const matches: BaselineReceipt["matches"] = {};
    await save(path.join(f.root, "baseline/match.json"), {
      games: [1, 2, 3, 4],
    });
    const sha256 = digest(
      await readFile(path.join(f.root, "baseline/match.json")),
    );
    for (const m of f.frozen.matches) {
      await save(path.join(f.root, `baseline/${m.id}.json`), {
        games: [1, 2, 3, 4],
      });
      matches[m.id] = { path: `${m.id}.json`, sha256 };
    }
    const evidence: BaselineReceipt = {
      schemaVersion: 1,
      comparisonIdentity: first.comparisonIdentity,
      status: "complete",
      completedMatches: f.frozen.matches.map((m) => m.id),
      matches,
    };
    await save(receipt, evidence);
    const opts = { ...f.options, baseline: receipt };
    assert.equal((await prepareIteration(opts)).baseline.action, "reuse");
    await save(receipt, { ...evidence, comparisonIdentity: "other" });
    assert.equal(
      (await prepareIteration(opts)).baseline.reason,
      "identity-mismatch",
    );
    await save(receipt, {
      ...evidence,
      completedMatches: evidence.completedMatches.slice(1),
    });
    assert.equal((await prepareIteration(opts)).baseline.reason, "incomplete");
    await save(receipt, evidence);
    await writeFile(path.join(f.root, "baseline/match-0001.json"), "damaged");
    assert.equal((await prepareIteration(opts)).baseline.reason, "corrupt");
    await writeFile(receipt, "{");
    assert.equal((await prepareIteration(opts)).baseline.reason, "corrupt");
    await rm(receipt);
    assert.equal((await prepareIteration(opts)).baseline.reason, "missing");
    const next = await prepareIteration({
      ...f.options,
      iteration: 2,
      runnerIdentity: "v2",
    });
    assert.notEqual(next.comparisonIdentity, first.comparisonIdentity);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("accepted promotion binds a new snapshot and invalidates baseline; frozen deck drift fails", async () => {
  const f = await fixture();
  try {
    const first = await prepareIteration(f.options);
    const { identity: oldIdentity, ...body } = f.frozen.target;
    assert.equal(oldIdentity, first.control.identity);
    const updated = { ...body, files: { "bot.mjs": digest("changed") } };
    const bot = { ...updated, identity: identity(updated) };
    const version = path.join(f.session, "versions/promoted");
    await save(path.join(version, "frozen-bot.json"), bot);
    await writeFile(path.join(version, "bot.mjs"), "changed");
    const state = {
      schemaVersion: 1,
      fixtureIdentity: f.frozen.identity,
      accepted: { path: version, identity: bot.identity },
    };
    await save(path.join(f.session, "state.json"), state);
    await assert.rejects(prepareIteration(f.options), /identity mismatch/);
    const next = await prepareIteration({ ...f.options, iteration: 2 });
    assert.notEqual(next.comparisonIdentity, first.comparisonIdentity);
    assert.equal(next.self.identity, bot.identity);
    await save(path.join(version, "frozen-bot.json"), {
      ...bot,
      deck: { main: [], extra: [], side: [] },
    });
    await assert.rejects(
      prepareIteration({ ...f.options, iteration: 3 }),
      /deck changed/,
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("corruption and locks fail without publishing; ordinary failure permits retry", async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      prepareIteration({ ...f.options, iteration: 0 }),
      /Positive iteration/,
    );
    const lock = path.join(f.session, ".iteration-preparation.lock");
    await mkdir(lock);
    await assert.rejects(prepareIteration(f.options), /EEXIST/);
    await rm(lock, { recursive: true });
    await writeFile(path.join(f.accepted.path, "bot.mjs"), "broken");
    await assert.rejects(prepareIteration(f.options), /Frozen input mismatch/);
    assert.deepEqual(await readdir(path.join(f.session, "iterations")), []);
    await writeFile(path.join(f.accepted.path, "bot.mjs"), "initial");
    const conflict = path.join(f.session, "iterations/iteration-0001");
    await mkdir(conflict);
    await assert.rejects(prepareIteration(f.options), /destination exists/);
    assert.deepEqual(await readdir(conflict), []);
    await rm(conflict, { recursive: true });
    const first = await prepareIteration(f.options);
    await writeFile(path.join(first.self.path, "bot.mjs"), "broken");
    await assert.rejects(prepareIteration(f.options), /Accepted file mismatch/);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
