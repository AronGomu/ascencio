import test from "node:test";
import assert from "node:assert/strict";
import {
  workerCounts,
  workerRecommendation,
} from "../../scripts/bot-improvement/worker-calibration.ts";
test("calibration covers every available CPU count without a 64-worker ceiling", () => {
  assert.deepEqual(workerCounts(undefined, 6), [2, 3, 4, 5, 6]);
  assert.equal(workerCounts(undefined, 128).at(-1), 128);
  assert.equal(workerCounts(undefined, 128).length, 127);
  assert.deepEqual(workerCounts("2,4", 6), [2, 4]);
  for (const value of ["1", "7", "2,2", "", "2.5"])
    assert.throws(() => workerCounts(value, 6));
  assert.throws(() => workerCounts(undefined, 1));
});
test("recommendation uses medians and prefers fewer CPUs within three percent", () => {
  const result = workerRecommendation([
    { workers: 2, elapsedMs: 100 },
    { workers: 2, elapsedMs: 104 },
    { workers: 3, elapsedMs: 99 },
    { workers: 3, elapsedMs: 101 },
    { workers: 4, elapsedMs: 98 },
    { workers: 4, elapsedMs: 102 },
  ]);
  assert.equal(result.workers, 2);
  assert.equal(result.stages[0]!.medianMs, 102);
  assert.throws(() => workerRecommendation([]));
});
