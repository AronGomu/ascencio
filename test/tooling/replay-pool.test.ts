import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { replayWorkers } from "../../scripts/bot-improvement/replay-work-queue.ts";
import { prepareReplayPool } from "../../scripts/bot-improvement/prepare-replay-pool.ts";
import { runReplayPool } from "../../scripts/bot-improvement/run-replay-pool.ts";

test("dynamic replay batches execute each case once and keep fast workers supplied", async () => {
  const controller = new AbortController(),
    seen: number[] = [],
    counts = new Map<number, number>();
  let active = 0,
    peak = 0;
  await replayWorkers(
    [0, 1, 2, 3, 4, 5, 6, 7],
    3,
    1,
    controller.signal,
    async (id, worker) => {
      active++;
      peak = Math.max(peak, active);
      seen.push(id);
      counts.set(worker, (counts.get(worker) ?? 0) + 1);
      await pause(id === 0 ? 30 : 1);
      active--;
    },
  );
  assert.equal(peak, 3);
  assert.equal(active, 0);
  assert.deepEqual(
    [...seen].sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
  assert.ok([...counts.values()].some((n) => n > 1));
});
test("replay cancellation stops admission and waits for active work to settle", async () => {
  const controller = new AbortController(),
    seen: number[] = [];
  let active = 0;
  await replayWorkers([0, 1, 2, 3], 2, 1, controller.signal, async (id) => {
    seen.push(id);
    active++;
    await pause(2);
    controller.abort();
    active--;
  });
  assert.deepEqual(seen, [0, 1]);
  assert.equal(active, 0);
});
test("malformed reason requests fail during discovery without launching games", async () => {
  const root = await mkdtemp(path.resolve(".tmp/replay-pool-validation-"));
  const file = path.join(root, "request.json");
  await writeFile(
    file,
    JSON.stringify({
      schemaVersion: 1,
      reasons: [{ id: "../escape", bot: "missing.mjs", cases: [] }],
    }),
  );
  await assert.rejects(
    prepareReplayPool(file, path.join(root, "out")),
    /unique safe id/,
  );
  await assert.rejects(
    runReplayPool({
      request: file,
      out: path.join(root, "invalid"),
      workers: 0,
    }),
    /Invalid replay/,
  );
});
test("verified replay inputs detect changes before dispatch", async () => {
  const { verifyReplayPins } =
    await import("../../scripts/bot-improvement/prepare-replay-pool.ts");
  const { digest } =
    await import("../../scripts/bot-improvement/session-fixtures.ts");
  const root = await mkdtemp(path.resolve(".tmp/replay-pool-pin-")),
    file = path.join(root, "input");
  await writeFile(file, "before");
  const pins = [{ path: file, sha256: digest(await readFile(file)) }];
  await writeFile(file, "after");
  await assert.rejects(
    verifyReplayPins({
      id: "r/c",
      reason: "r",
      caseId: "c",
      game: root,
      gameId: "g",
      actor: "a",
      decision: "d",
      pairing: file,
      replacement: file,
      pins,
    }),
    /Replay input changed/,
  );
});

test("replay writer leases isolate workers and charge full replacement staging", async () => {
  const { configureOutputStorage, writeOutput } =
    await import("../../scripts/bot-improvement/output-storage.ts");
  const { leaseBatchStorage, releaseBatchStorage } =
    await import("../../scripts/bot-improvement/batch-storage-lease.ts");
  const {
    installReplayWriteGrant,
    replayWriteOutput,
    clearReplayWriteGrants,
    replayWorkerRoot,
  } = await import("../../scripts/bot-improvement/replay-output-budget.ts");
  const root = await mkdtemp(path.resolve(".tmp/replay-writer-test-")),
    out = path.join(root, "pool");
  await configureOutputStorage(root, 64_000_000);
  const lease = await leaseBatchStorage(root, out, false);
  const grant = {
    root,
    token: lease.token,
    evaluation: out,
    output: out,
    workers: 2,
  };
  try {
    await assert.rejects(
      installReplayWriteGrant({ ...grant, token: "invalid" }),
      /Invalid replay writer lease/,
    );
    await installReplayWriteGrant({ ...grant, worker: 1 });
    await installReplayWriteGrant({ ...grant, worker: 2 });
    const file = path.join(replayWorkerRoot(grant, 1), "log");
    await replayWriteOutput(file, Buffer.alloc(8_000_000, 1));
    await assert.rejects(
      replayWriteOutput(file, Buffer.alloc(6_000_000, 2)),
      /allowance exhausted/,
    );
    assert.equal((await readFile(file))[0], 1);
    await replayWriteOutput(
      path.join(replayWorkerRoot(grant, 2), "log"),
      Buffer.alloc(6_000_000),
    );
    await assert.rejects(
      writeOutput(path.join(root, "outside"), Buffer.alloc(20_000_000)),
      /max-output/,
    );
  } finally {
    clearReplayWriteGrants();
    await releaseBatchStorage(root, lease.token);
  }
});
