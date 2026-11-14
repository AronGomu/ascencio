import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  copyFile,
} from "node:fs/promises";
import path from "node:path";
import { executeMatches } from "../../scripts/bot-improvement/run-matches.ts";
import { spawnSync } from "node:child_process";
import { finalizedEvidence } from "../../scripts/bot-improvement/analysis-evidence.ts";
import { controlSession } from "../../scripts/bot-improvement/control-session.ts";
import { outputUsage } from "../../scripts/bot-improvement/output-storage.ts";
import {
  leaseBatchStorage,
  releaseBatchStorage,
} from "../../scripts/bot-improvement/batch-storage-lease.ts";
const source = process.env.ARO2_FROZEN_SESSION;
const json = async (file: string) => JSON.parse(await readFile(file, "utf8"));
test("session storage lease reserves future bytes and releases without double-counting", async () => {
  const root = await mkdtemp(path.resolve(".tmp/session-lease-test-"));
  const { configureOutputStorage, writeOutput } =
    await import("../../scripts/bot-improvement/output-storage.ts");
  await configureOutputStorage(root, 64_000_000);
  const out = path.join(root, "evaluation");
  const lease = await leaseBatchStorage(root, out, false);
  assert.ok((await outputUsage(root)).totalBytes >= lease.maxBytes);
  await assert.rejects(
    writeOutput(path.join(root, "other.log"), Buffer.alloc(20_000_000)),
    /max-output|storage/i,
  );
  await assert.rejects(
    leaseBatchStorage(root, path.join(root, "other"), false),
    /Another batch/,
  );
  await releaseBatchStorage(root, lease.token);
  assert.ok((await outputUsage(root)).totalBytes < 10000);
});
test(
  "default batch session produces compatible evidence, receipts and resume accounting",
  { skip: !source, timeout: 120000 },
  async () => {
    const root = await mkdtemp(path.resolve(".tmp/session-batch-test-")),
      target = path.join(root, "target"),
      session = path.join(root, "session");
    await mkdir(target);
    const cfg = await json(path.join(source!, "config.json"));
    await copyFile(
      path.resolve("assets/ai-bots/goat-control/decks/default.ydk"),
      path.join(target, "deck.ydk"),
    );
    await writeFile(
      path.join(target, "evaluation.json"),
      JSON.stringify({
        schemaVersion: 1,
        deck: "deck.ydk",
        content: path.join(cfg.fixture.path, "content"),
        banlist: path.join(cfg.fixture.path, "banlist.json"),
        profile: "mr5",
        module: "builtin:basic",
        configuration: {},
      }),
    );
    const request = {
      target,
      opponents: [],
      setupSeed: "session-batch-test",
      session,
      matches: 2,
      matchWorkers: 2,
      stop: {
        maxIterations: 2,
        maxGames: 64,
        maxWallMs: 120000,
        maxBytes: 256_000_000,
      },
    };
    const requestFile = path.join(root, "setup-request.json");
    await writeFile(requestFile, JSON.stringify(request));
    const setup = spawnSync(
      process.execPath,
      [
        "--experimental-vm-modules",
        "scripts/bot-improvement/setup-session.ts",
        requestFile,
      ],
      { encoding: "utf8", timeout: 30000 },
    );
    assert.equal(setup.status, 0, setup.stderr);
    const out = path.join(session, "evaluation"),
      options = {
        session,
        out,
        workers: "2",
        batchSize: 1,
      };
    const result = await executeMatches(options);
    assert.equal(result.runner, "typescript-native/v1");
    assert.equal(result.exitCode, 0);
    assert.equal(result.completedGames, 8);
    assert.ok(result.receipt);
    const execution = await json(path.join(out, "execution.json"));
    assert.equal(
      execution.sessionControl.runnerIdentity,
      "session-typescript/v1",
    );
    const receipt = await json(result.receipt);
    for (const item of execution.matches) {
      const id = item.match.id;
      assert.equal(receipt.matches[id].path, `matches/${id}/done.json`);
      const evidence = await finalizedEvidence(
        session,
        `evaluation/matches/${id}`,
        {
          match: id,
          executionIdentity: execution.identity,
          fixtureIdentity: execution.fixtureIdentity,
          candidateIdentity: execution.candidateIdentity,
          opponentIdentity: item.identities[1],
          item,
          outcomes: true,
        },
      );
      assert.equal(evidence.games.length, 4);
    }
    const before = await controlSession(session, { action: "plan" });
    assert.equal(before.chargedGames, 8);
    assert.equal(before.reservedGames, 0);
    assert.equal(before.completedGames, 8);
    const resumed = await executeMatches({ ...options, resume: true });
    assert.equal(resumed.exitCode, 0);
    const after = await controlSession(session, { action: "plan" });
    assert.equal(after.chargedGames, 8);
    assert.equal(after.completedGames, 8);
    const { collectEvaluation } =
      await import("../../scripts/bot-improvement/aggregation-evidence.ts");
    const { digest } =
      await import("../../scripts/bot-improvement/session-fixtures.ts");
    const config = await json(path.join(session, "config.json"));
    const frozen = await json(path.join(config.fixture.path, "manifest.json"));
    const manifest = await json(
      path.join(session, "iterations/iteration-0001/manifest.json"),
    );
    const evaluation = await collectEvaluation(
      session,
      {
        root: "evaluation",
        execution: {
          path: "evaluation/execution.json",
          sha256: digest(await readFile(path.join(out, "execution.json"))),
        },
        receipt: {
          path: "evaluation/baseline-receipt.json",
          sha256: digest(await readFile(result.receipt)),
        },
      },
      "control",
      frozen,
      manifest,
      execution.candidateIdentity,
    );
    assert.equal(evaluation.rows.length, 2);
    assert.ok(evaluation.rows.every((row) => row.games?.length === 4));
    const candidate = await executeMatches({
      ...options,
      out: path.join(session, "candidate"),
      role: "candidate",
    });
    assert.equal(candidate.exitCode, 0);
    const candidateJob = await json(
      path.join(candidate.output, "execution.json"),
    );
    assert.equal(candidateJob.budget.maxGames, 56);
    const consumed = await controlSession(session, { action: "plan" });
    assert.equal(consumed.chargedGames, 16);
    assert.equal(consumed.reservedGames, 0);
    const { benchmarkInputs, createBenchmarkSession } =
      await import("../../scripts/bot-improvement/benchmark-session.ts");
    const stoppedSession = await createBenchmarkSession(
      await benchmarkInputs(session),
      path.join(root, "stop-session"),
    );
    const marker = path.join(stoppedSession, "OWNER_STOP");
    const stopOptions = {
      session: stoppedSession,
      out: path.join(stoppedSession, "evaluation"),
      workers: "2",
      batchSize: 1,
    };
    const running = executeMatches(stopOptions);
    const { access } = await import("node:fs/promises");
    const { setTimeout: pause } = await import("node:timers/promises");
    for (let n = 0; ; n++) {
      try {
        await access(path.join(stopOptions.out, "owners.json"));
        break;
      } catch {
        if (n > 500) throw Error("Batch owner did not start");
        await pause(20);
      }
    }
    await writeFile(marker, "stop");
    const stopped = await running;
    assert.equal(stopped.status, "interrupted");
    const stoppedPlan = await controlSession(stoppedSession, {
      action: "plan",
    });
    assert.equal(stoppedPlan.reservedGames, 0);
    await controlSession(stoppedSession, {
      action: "continue",
      ownerStopToken: stoppedPlan.ownerStopToken!,
    });
    const continued = await executeMatches({ ...stopOptions, resume: true });
    assert.equal(continued.exitCode, 0);
    const finalPlan = await controlSession(stoppedSession, { action: "plan" });
    assert.equal(finalPlan.chargedGames, stoppedPlan.chargedGames + 8);
    assert.equal(finalPlan.completedGames, 8);
    const lease = await json(path.join(session, ".batch-output-lease.json"));
    assert.equal(lease.active, false);
    assert.ok((await outputUsage(session)).totalBytes <= 256_000_000);
    await assert.rejects(
      executeMatches({
        ...options,
        resume: true,
        backend: "rust",
        binary: "must-not-launch",
      }),
      /Runner identity changed/,
    );
    const manifestFile = path.join(
        session,
        "iterations/iteration-0001/manifest.json",
      ),
      original = await readFile(manifestFile, "utf8");
    await writeFile(
      manifestFile,
      JSON.stringify({
        ...JSON.parse(original),
        runnerIdentity: "session-batch/v1",
      }),
    );
    await assert.rejects(
      executeMatches({ ...options, resume: true }),
      /Runner identity changed/,
    );
    await writeFile(manifestFile, original);
  },
);
