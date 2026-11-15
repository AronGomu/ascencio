import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { recoverCalibration } from "../../scripts/bot-improvement/calibration-recovery.ts";
test("calibration retries once, excludes failed count, resumes successes and rejects identity drift", async () => {
  const out = await mkdtemp(path.join(tmpdir(), "calibration-recovery-"));
  let calls = 0;
  const config = {
    out,
    identity: "pinned",
    counts: [2, 3],
    repeats: 2,
    run: async (workers: number) => {
      calls++;
      if (workers === 3) throw Error("stage failed");
      return { workers, wallMs: 100, fingerprint: "same" };
    },
  };
  try {
    const first = await recoverCalibration(config);
    assert.deepEqual(first.excluded, [3]);
    assert.equal(first.runs.length, 2);
    assert.equal(calls, 4);
    const second = await recoverCalibration(config);
    assert.deepEqual(second, first);
    assert.equal(calls, 4);
    await assert.rejects(
      recoverCalibration({ ...config, identity: "changed" }),
      /identity/,
    );
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test("memory preflight excludes counts durably without executing and retained evidence rejects corruption", async () => {
  const { writeFile } = await import("node:fs/promises");
  const { verifyCalibrationReport } =
    await import("../../scripts/bot-improvement/calibration-evidence.ts");
  const out = await mkdtemp(path.join(tmpdir(), "calibration-memory-"));
  let calls = 0;
  const options = {
    out,
    identity: "memory",
    counts: [2, 3, 4],
    repeats: 2,
    memory: {
      availableBytes: 100,
      reserveBytes: 20,
      bytesPerWorker: 30,
      provenance: "fixture estimate",
    },
    run: async (workers: number, dir: string) => {
      calls++;
      await writeFile(path.join(dir, "evidence"), "fixed");
      return { workers, wallMs: 10, fingerprint: "same" };
    },
  };
  try {
    const result = await recoverCalibration(options);
    assert.equal(calls, 2);
    assert.deepEqual(result.excluded, [3, 4]);
    assert.ok(result.exclusions.every((e) => e.reason === "memory-preflight"));
    await verifyCalibrationReport(result);
    assert.deepEqual(await recoverCalibration(options), result);
    assert.equal(calls, 2);
    await writeFile(
      path.join(out, "workers-2-repeat-1-attempt-1", "evidence"),
      "corrupt",
    );
    await assert.rejects(recoverCalibration(options), /integrity mismatch/);
    await assert.rejects(verifyCalibrationReport(result), /integrity mismatch/);
    assert.equal(calls, 2);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
test("calibration resume ignores observation timestamp but pins source/runtime metadata", async () => {
  const { stableCalibrationProvenance } =
    await import("../../scripts/bot-improvement/calibration-evidence.ts");
  assert.deepEqual(
    stableCalibrationProvenance({
      capturedAt: "a",
      source: "fixed",
      machine: { cpu: "x", loadAverage: [1] },
    }),
    stableCalibrationProvenance({
      capturedAt: "b",
      source: "fixed",
      machine: { cpu: "x", loadAverage: [9] },
    }),
  );
  assert.notDeepEqual(
    stableCalibrationProvenance({ source: "a" }),
    stableCalibrationProvenance({ source: "b" }),
  );
});
test("unsafe failures cannot silently resume as an ordinary retry", async () => {
  const out = await mkdtemp(path.join(tmpdir(), "calibration-unsafe-"));
  let calls = 0;
  const config = {
    out,
    identity: "unsafe",
    counts: [2],
    repeats: 1,
    run: async (workers: number) => {
      calls++;
      throw Error("input integrity mismatch");
      return { workers, wallMs: 10, fingerprint: "same" };
    },
  };
  try {
    await assert.rejects(recoverCalibration(config), /integrity/);
    await assert.rejects(recoverCalibration(config), /incident resolution/);
    assert.equal(calls, 1);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test("interrupted attempt is retained and consumes the single retry", async () => {
  const { writeFile, readFile, mkdir } = await import("node:fs/promises");
  const out = await mkdtemp(path.join(tmpdir(), "calibration-interrupted-"));
  const first = path.join(out, "workers-2-repeat-1-attempt-1");
  try {
    await mkdir(first);
    await writeFile(path.join(first, "partial"), "retained");
    await writeFile(
      path.join(out, "attempts.json"),
      JSON.stringify({
        identity: "interrupted",
        attempts: [
          { workers: 2, repeat: 0, attempt: 0, out: first, status: "running" },
        ],
      }),
    );
    let calls = 0;
    const result = await recoverCalibration({
      out,
      identity: "interrupted",
      counts: [2],
      repeats: 1,
      run: async (workers, dir) => {
        calls++;
        assert.match(dir, /attempt-2$/);
        return { workers, wallMs: 1, fingerprint: "fixed" };
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.runs.length, 1);
    assert.equal(
      await readFile(path.join(first, "partial"), "utf8"),
      "retained",
    );
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
test("memory CLI options must be explicit together", async () => {
  const { calibrationMemory } =
    await import("../../scripts/bot-improvement/calibration-memory.ts");
  assert.equal(calibrationMemory({}), undefined);
  assert.throws(
    () => calibrationMemory({ "memory-budget-bytes": "100" }),
    /requires explicit/,
  );
  assert.deepEqual(
    calibrationMemory({
      "memory-budget-bytes": "100",
      "memory-reserve-bytes": "20",
      "memory-per-worker-bytes": "30",
    }),
    {
      availableBytes: 100,
      reserveBytes: 20,
      bytesPerWorker: 30,
      provenance: "explicit CLI budget and worker estimate",
    },
  );
});

test("replay calibration reaches request validation inside a recovery-owned attempt", async () => {
  const { writeFile, readFile } = await import("node:fs/promises");
  const { replayCalibrationStage } =
    await import("../../scripts/bot-improvement/replay-calibration-stage.ts");
  const { configureOutputStorage } =
    await import("../../scripts/bot-improvement/output-storage.ts");
  const root = await mkdtemp(
    path.join(tmpdir(), "replay-calibration-handoff-"),
  );
  try {
    await configureOutputStorage(root, 64_000_000);
    const request = path.join(root, "request.json");
    await writeFile(request, JSON.stringify({ schemaVersion: 1, reasons: [] }));
    await recoverCalibration({
      out: path.join(root, "calibration"),
      identity: "replay-handoff",
      counts: [2],
      repeats: 1,
      run: (workers, output) =>
        replayCalibrationStage(request, workers, output, 1),
    });
    const journal = JSON.parse(
      await readFile(path.join(root, "calibration", "attempts.json"), "utf8"),
    );
    assert.equal(journal.attempts.length, 2);
    for (const attempt of journal.attempts) {
      assert.match(attempt.error, /nonempty reasons/);
      assert.doesNotMatch(attempt.error, /EEXIST/);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
