import { verifyNativeSchedule } from "../../scripts/bot-improvement/typescript-native-resume.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, readdir } from "node:fs/promises";
import path from "node:path";
import {
  canonicalTree,
  gameEvidenceHash,
  compactLog,
  verifyNativeGame,
} from "../../scripts/bot-improvement/typescript-native-evidence.ts";
import {
  encodeLogRecord,
  decodeLog,
  parseGameLog,
} from "../../scripts/bot-improvement/game-log.ts";
import {
  runTypescriptNative,
  verifyNativeCompletion,
} from "../../scripts/bot-improvement/run-typescript-native.ts";
import { prepareTypescriptJob } from "../../scripts/bot-improvement/run-typescript-matches.ts";
import { finalizedEvidence } from "../../scripts/bot-improvement/analysis-evidence.ts";
import { outputUsage } from "../../scripts/bot-improvement/output-storage.ts";
import { spawn } from "node:child_process";
import { NativeEngineSlot } from "../../scripts/bot-improvement/typescript-native-executor.ts";
import type { Job } from "../../scripts/bot-improvement/typescript-match-worker.ts";
test("native initialization rejects a host failure response", async () => {
  const slot = new NativeEngineSlot({
    runtime: "test-runtime",
    job: { content: "unused", engine: "unused" } as Job,
    register: () => {},
    aborted: () => false,
  });
  slot.request = async () => ({
    initial: [],
    events: [[], []],
    cleaned: false,
    failure: { type: "host_error", message: "Invalid frozen engine" },
  });
  await assert.rejects(
    slot.initialize({ bots: [] } as unknown as Job["matches"][number]),
    /Invalid frozen engine/,
  );
});
test("native codec retains exact typed records and version-one canonical rules", () => {
  const value = {
    a: 1,
    b: true,
    c: [],
    d: null,
    nested: { path: "x", duration_ms: 5, code: "001" },
  };
  assert.deepEqual(canonicalTree(value, true), {
    a: "1",
    b: "true",
    d: null,
    nested: { code: "001" },
  });
  const special = canonicalTree(
    JSON.parse(
      '{"z":2,"__proto__":{"safe":true},"10":10,"2":2,"constructor":"own"}',
    ),
  ) as Record<string, unknown>;
  assert.equal(Object.getPrototypeOf(special), Object.prototype);
  assert.deepEqual(Object.getOwnPropertyDescriptor(special, "__proto__"), {
    value: { safe: "true" },
    writable: true,
    enumerable: true,
    configurable: true,
  });
  assert.equal(
    JSON.stringify(special),
    '{"2":"2","10":"10","__proto__":{"safe":"true"},"constructor":"own","z":"2"}',
  );
  const sparseInput: unknown[] = [undefined, null, [], 3];
  delete sparseInput[0];
  const sparse = canonicalTree(sparseInput) as unknown[];
  assert.equal(0 in sparse, false);
  assert.equal(JSON.stringify(sparse), '[null,null,[],"3"]');
  const text = "ASCENCIO_GAME_LOG\t2\n" + encodeLogRecord("GAME", value);
  assert.deepEqual(
    decodeLog(compactLog(text), "ASCENCIO_GAME_LOG\t2"),
    decodeLog(text, "ASCENCIO_GAME_LOG\t2"),
  );
  const r = { timeline: [{ choice: "a" }], duration_ms: 1 };
  assert.equal(
    gameEvidenceHash("g", ["a", "b"], [r, r]),
    gameEvidenceHash("g", ["a", "b"], [{ ...r, duration_ms: 9 }, r]),
  );
  assert.notEqual(
    gameEvidenceHash("g", ["a", "b"], [r, r]),
    gameEvidenceHash("g", ["a", "b"], [{ timeline: [{ choice: "b" }] }, r]),
  );
});
const source = process.env.ARO2_FROZEN_SESSION;
test(
  "full TypeScript evidence supports analysis, replay, verified resume and bounded accounting",
  { skip: !source, timeout: 180000 },
  async () => {
    const { job } = await prepareTypescriptJob(source!, 2),
      root = await mkdtemp(path.resolve(".tmp/native-migration-test-")),
      out = path.join(root, "complete");
    const options = { job, out, workers: 2, maxWallMs: 120000 };
    const run = await runTypescriptNative(options);
    assert.equal(run.status, "completed");
    assert.equal(run.completedGames, 8);
    assert.equal(run.executedCompletedGames, 8);
    assert.equal(run.reusedCompletedGames, 0);
    assert.equal(run.resumeVerificationMs, 0);
    assert.equal(run.reservedGames, 8);
    for (const item of job.matches) {
      assert.ok(await verifyNativeCompletion(run.output, job, item));
      await finalizedEvidence(run.output, `matches/${item.match.id}`, {
        match: item.match.id,
        executionIdentity: job.identity,
        fixtureIdentity: job.fixtureIdentity,
        candidateIdentity: item.identities[0]!,
        opponentIdentity: item.identities[1]!,
        item,
      });
    }
    const resumed = await runTypescriptNative({ ...options, resume: true });
    assert.equal(resumed.reservedGames, 8);
    assert.equal(resumed.completedGames, 8);
    assert.equal(resumed.executedCompletedGames, 0);
    assert.equal(resumed.reusedCompletedGames, 8);
    assert.equal(resumed.gamesPerSecond, 0);
    assert.ok(resumed.resumeVerificationMs > 0);
    let abortVerification = false,
      verificationWorkers = 0,
      exitedWorkers = 0;
    await assert.rejects(
      verifyNativeSchedule({
        output: run.output,
        job,
        workers: 2,
        runtime: "fixture",
        register: (worker) => {
          verificationWorkers++;
          worker.once("exit", () => exitedWorkers++);
          abortVerification = true;
          void worker.terminate();
        },
        aborted: () => abortVerification,
      }),
      /interrupted/,
    );
    assert.equal(verificationWorkers, 1);
    assert.equal(exitedWorkers, verificationWorkers);
    const input = path.join(
        run.output,
        `matches/${job.matches[0]!.match.id}/native/games/game-1/game.log`,
      ),
      bytes = await readFile(input, "utf8"),
      game = parseGameLog(bytes),
      actor = game.neutral.winner === "a" ? "b" : "a",
      record = game.actors[actor === "a" ? 0 : 1],
      decision = record.timeline.entry.find(
        (e) => e.kind === "decision",
      )!.decision_id!;
    const replayOut = path.join(out, "replay-check");
    const code = await new Promise<number | null>((resolve, reject) => {
      const p = spawn(
        process.execPath,
        [
          "--experimental-vm-modules",
          "--disable-warning=ExperimentalWarning",
          "scripts/bot-improvement/replay-game-decision.ts",
          "--game",
          path.dirname(input),
          "--pairing",
          path.join(run.output, "execution.json"),
          "--actor",
          actor,
          "--decision",
          decision,
          "--bot",
          job.matches[0]!.bots[actor === "a" ? 0 : 1]!.source!,
          "--out",
          replayOut,
        ],
        { stdio: "inherit" },
      );
      p.once("error", reject);
      p.once("exit", resolve);
    });
    assert.equal(code, 0);
    assert.equal(
      JSON.parse(await readFile(path.join(replayOut, "result.json"), "utf8"))
        .status,
      "complete",
    );
    const unexpectedReceipt = path.join(path.dirname(input), "done.json");
    await writeFile(unexpectedReceipt, "{}");
    await assert.rejects(
      runTypescriptNative({ ...options, resume: true }),
      /file set changed/,
    );
    await rm(unexpectedReceipt);
    const afterReplay = await runTypescriptNative({ ...options, resume: true });
    assert.equal(afterReplay.reservedGames, 8);
    assert.equal(afterReplay.completedGames, 8);
    await writeFile(input, bytes + "corrupt\n");
    await assert.rejects(
      runTypescriptNative({ ...options, resume: true }),
      /bytes changed|log|hash/i,
    );
    await writeFile(input, bytes);
    const journalFile = path.join(
        run.output,
        "workers/worker-0001/journal.json",
      ),
      journalBytes = await readFile(journalFile, "utf8"),
      journal = JSON.parse(journalBytes);
    await writeFile(
      journalFile,
      JSON.stringify({ ...journal, reservedGames: 0 }),
    );
    await assert.rejects(
      runTypescriptNative({ ...options, resume: true }),
      /journal/i,
    );
    await writeFile(journalFile, journalBytes);
    const limited = await runTypescriptNative({
      job,
      out: path.join(root, "limited"),
      workers: 2,
      maxGames: 4,
      maxWallMs: 120000,
    });
    assert.equal(limited.completedGames, 4);
    assert.equal(limited.reservedGames, 4);
    assert.equal(limited.stoppingReason, "max-games");
    const stopFile = path.join(root, "STOP");
    await writeFile(stopFile, "stop");
    const stopped = await runTypescriptNative({
      job,
      out: path.join(root, "stopped"),
      workers: 2,
      stopFile,
      maxWallMs: 120000,
    });
    assert.equal(stopped.status, "interrupted");
    assert.equal(stopped.stoppingReason, "owner-stop");
    assert.ok(stopped.reservedGames <= 8);
    const expired = await runTypescriptNative({
      job,
      out: path.join(root, "expired"),
      workers: 2,
      maxWallMs: 1,
    });
    assert.equal(expired.stoppingReason, "max-wall-ms");
    const quotaRoot = path.join(root, "quota"),
      quotaJob = (await prepareTypescriptJob(source!, 4)).job,
      quota = await runTypescriptNative({
        job: quotaJob,
        out: quotaRoot,
        workers: 2,
        maxBytes: 48_000_000,
        maxWallMs: 120000,
      });
    assert.equal(quota.status, "interrupted");
    assert.equal(quota.stoppingReason, "max-output-bytes");
    assert.ok((await outputUsage(quotaRoot)).totalBytes <= 48_000_000);
    assert.equal(
      JSON.parse(await readFile(path.join(quota.output, "result.json"), "utf8"))
        .stoppingReason,
      "max-output-bytes",
    );
    assert.equal(
      JSON.parse(
        await readFile(
          path.join(quotaRoot, ".batch-output-lease.json"),
          "utf8",
        ),
      ).active,
      false,
    );
    const timeout = await runTypescriptNative({
      job: { ...job, limits: { ...job.limits, game_wall_time_ms: 1 } },
      out: path.join(root, "game-timeout"),
      workers: 2,
      maxWallMs: 120000,
    });
    assert.equal(timeout.status, "completed");
    assert.ok(timeout.timeoutGames >= 2);
    assert.equal(timeout.stoppingReason, null);
    assert.equal(
      timeout.completedGames + timeout.failedGames + timeout.skippedGames,
      8,
    );
    assert.ok(timeout.reservedGames <= 8);
    assert.equal(timeout.completedGames, 0);
    const usage = await outputUsage(out);
    assert.ok(usage.totalBytes < 20_000_000_000);
    assert.equal(
      JSON.parse(
        await readFile(path.join(out, ".batch-output-lease.json"), "utf8"),
      ).active,
      false,
    );
    assert.ok(verifyNativeGame(bytes));
  },
);

test("resume cancellation starts no verification worker or game", async () => {
  let created = 0;
  await assert.rejects(
    verifyNativeSchedule({
      output: "unused",
      job: { matches: [{}], limits: {} } as Job,
      workers: 2,
      runtime: "test",
      register: () => {
        created++;
      },
      aborted: () => true,
    }),
    /interrupted/,
  );
  assert.equal(created, 0);
});

test("resume pool caps worker creation and missing receipts perform no writes", async () => {
  const output = await mkdtemp(path.resolve(".tmp/native-resume-empty-"));
  let created = 0,
    exited = 0;
  try {
    const job = {
      identity: "missing-receipt-fixture",
      limits: {},
      matches: Array.from({ length: 12 }, (_, n) => ({
        match: { id: `match-${n}` },
      })),
    } as unknown as Job;
    const result = await verifyNativeSchedule({
      output,
      job,
      workers: 16,
      runtime: "fixture",
      aborted: () => false,
      register: (worker) => {
        created++;
        worker.once("exit", () => exited++);
      },
    });
    assert.deepEqual(result, Array(12).fill(false));
    assert.equal(created, 4);
    assert.equal(exited, created);
    assert.deepEqual(await readdir(output), []);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
