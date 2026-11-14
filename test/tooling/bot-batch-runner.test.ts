import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { executeBatch } from "../../scripts/bot-improvement/run-batch-matches.ts";
import { gameplayFingerprint } from "../../scripts/bot-improvement/batch-benchmark.ts";
const source = process.env.ARO2_FROZEN_SESSION;
const json = async (file: string) => JSON.parse(await readFile(file, "utf8"));

test("batch runner validates worker settings before preparing output", async () => {
  await assert.rejects(
    executeBatch({
      session: "missing",
      out: "unused",
      workers: 1,
      batchSize: 0,
    }),
    /Batch size/,
  );
});

test("batch runner rejects invalid output limits before reading source state", async () => {
  await assert.rejects(
    executeBatch({
      session: "missing",
      out: "unused",
      workers: 1,
      maxBytes: -1,
    }),
    /Output allowance/,
  );
});

test(
  "real batch execution resumes without replay and rejects corrupt completion evidence",
  { skip: !source, timeout: 120000 },
  async () => {
    const root = await mkdtemp(path.resolve(".tmp/batch-test-")),
      out = path.join(root, "evaluation");
    const options = {
      session: source!,
      out,
      workers: 2,
      matches: 2,
      batchSize: 1,
    };
    const run = await executeBatch(options);
    assert.equal(run.exitCode, 0);
    assert.equal(run.completedGames, 8);
    assert.equal(run.reservedGames, 8);
    const fingerprint = await gameplayFingerprint(out, true);
    const resumed = await executeBatch({ ...options, resume: true });
    assert.equal(resumed.exitCode, 0);
    assert.equal(resumed.reservedGames, 8);
    assert.equal(await gameplayFingerprint(out, true), fingerprint);
    const index = await json(path.join(out, "matches.json"));
    const match = Object.values(index)[0] as string;
    const file = path.join(out, match, "native/games/game-1/game.log");
    await writeFile(file, `${await readFile(file, "utf8")}corrupt`);
    await assert.rejects(
      executeBatch({ ...options, resume: true }),
      /Batch execution failed/,
    );
  },
);

test(
  "batch reservations enforce the global game limit across workers and resume",
  { skip: !source, timeout: 120000 },
  async () => {
    const root = await mkdtemp(path.resolve(".tmp/batch-budget-test-"));
    const options = {
      session: source!,
      out: path.join(root, "evaluation"),
      workers: 2,
      matches: 2,
      batchSize: 2,
      maxGames: 4,
    };
    const run = await executeBatch(options);
    assert.equal(run.status, "interrupted");
    assert.equal(run.stoppingReason, "max-games");
    assert.equal(run.completedGames, 4);
    assert.equal(run.reservedGames, 4);
    const resumed = await executeBatch({ ...options, resume: true });
    assert.equal(resumed.reservedGames, 4);
    assert.equal(resumed.completedGames, 4);
  },
);

test(
  "worker output exhaustion leaves a readable checkpoint within the total allowance",
  { skip: !source, timeout: 120000 },
  async () => {
    const root = await mkdtemp(path.resolve(".tmp/batch-storage-test-"));
    const run = await executeBatch({
      session: source!,
      out: path.join(root, "evaluation"),
      workers: 1,
      matches: 1,
      maxBytes: 16_001_000,
    });
    assert.equal(run.status, "interrupted");
    assert.equal(run.stoppingReason, "max-output-bytes");
    assert.equal(run.reservedGames, 4);
    assert.ok(
      await json(path.join(run.output, "workers/worker-0001/journal.json")),
    );
  },
);

test(
  "an external stop marker suspends execution and resume preserves the original deadline",
  { skip: !source, timeout: 120000 },
  async () => {
    const root = await mkdtemp(path.resolve(".tmp/batch-stop-test-"));
    const stopFile = path.join(root, "STOP");
    await writeFile(stopFile, "stop");
    const options = {
      session: source!,
      out: path.join(root, "evaluation"),
      workers: 1,
      matches: 1,
      batchSize: 1,
      stopFile,
      maxGames: 8,
    };
    const stopped = await executeBatch(options);
    assert.equal(stopped.status, "interrupted");
    assert.equal(stopped.stoppingReason, "cancelled");
    const startedAt = (await json(path.join(options.out, "run.json")))
      .startedAt;
    const { rm } = await import("node:fs/promises");
    await rm(stopFile);
    const resumed = await executeBatch({ ...options, resume: true });
    assert.equal(resumed.exitCode, 0);
    assert.equal(resumed.completedGames, 4);
    assert.equal(
      (await json(path.join(options.out, "run.json"))).startedAt,
      startedAt,
    );
    assert.ok(resumed.reservedGames <= 8);
  },
);
