import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { runReplayPool } from "../../scripts/bot-improvement/run-replay-pool.ts";
import { findOutputRoot } from "../../scripts/bot-improvement/output-storage.ts";
import { digest } from "../../scripts/bot-improvement/session-fixtures.ts";
const request = process.env.ARO2_REPLAY_POOL_REQUEST;
test(
  "real replay workers preserve verified pairs, receipts and concurrency bounds",
  { skip: !request, timeout: 120000 },
  async () => {
    const file = path.resolve(request!),
      input = JSON.parse(await readFile(file, "utf8"));
    const sourceGame = path.resolve(
      path.dirname(file),
      input.reasons[0].cases[0].game,
    );
    const storage = await findOutputRoot(path.join(sourceGame, "game.log"));
    const root = await mkdtemp(
      path.join(storage ?? path.resolve(".tmp"), "replay-pool-real-"),
    );
    const result = await runReplayPool({
      request: file,
      out: path.join(root, "success"),
      workers: 2,
      batchSize: 1,
    });
    const count = input.reasons.reduce(
      (n: number, r: { cases: unknown[] }) => n + r.cases.length,
      0,
    );
    assert.equal(result.status, "complete");
    assert.equal(result.complete, count);
    assert.equal(result.failed, 0);
    assert.equal(result.branchAttempts.control, count);
    assert.equal(result.branchAttempts.alternative, count);
    assert.equal(new Set(result.rows.map((r) => r.id)).size, count);
    const events = result.rows
      .flatMap((r) => [
        [r.startedAt, 1],
        [r.finishedAt!, -1],
      ])
      .sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
    let active = 0,
      peak = 0;
    for (const [, change] of events) {
      active += change!;
      peak = Math.max(peak, active);
    }
    assert.equal(peak, Math.min(2, count));
    assert.equal(active, 0);
    for (const row of result.rows) {
      const marker = JSON.parse(
        await readFile(path.join(row.output, "done.json"), "utf8"),
      );
      for (const [relative, sha] of Object.entries(marker.files))
        assert.equal(
          digest(await readFile(path.join(row.output, relative))),
          sha,
        );
      assert.ok(marker.files["control.log"]);
      assert.ok(marker.files["alternative.log"]);
    }
    const timeout = await runReplayPool({
      request: file,
      out: path.join(root, "timeout"),
      workers: 2,
      caseTimeoutMs: 1,
    });
    assert.equal(timeout.status, "complete");
    assert.equal(timeout.ignored, count);
    assert.equal(timeout.failed, 0);
    const cancelled = await runReplayPool({
      request: file,
      out: path.join(root, "cancelled"),
      workers: 2,
      maxWallMs: 1,
    });
    assert.equal(cancelled.status, "interrupted");
    assert.equal(cancelled.stoppingReason, "max-wall-ms");
    assert.equal(cancelled.complete, 0);
    assert.equal(cancelled.cancelled, count);
  },
);
