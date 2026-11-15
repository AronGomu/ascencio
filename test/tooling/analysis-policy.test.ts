import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveAnalysisPolicy,
  selectedMatches,
  policyIdentity,
  reviewFeasibility,
  analystCapacity,
} from "../../scripts/bot-improvement/analysis-policy.ts";
test("full default and explicitly bounded alternatives retain different identities", () => {
  const full = resolveAnalysisPolicy();
  assert.equal(selectedMatches(["a", "b"], full).size, 2);
  assert.throws(() => resolveAnalysisPolicy({ mode: "sample" }), /explicit/);
  const sample = resolveAnalysisPolicy({
    mode: "sample",
    sampleMatches: 1,
    seed: "fixed",
  });
  assert.equal(selectedMatches(["b", "a"], sample).size, 1);
  assert.deepEqual(
    selectedMatches(["a", "b"], sample),
    selectedMatches(["b", "a"], sample),
  );
  assert.notEqual(policyIdentity(full), policyIdentity(sample));
  assert.equal(
    analystCapacity(resolveAnalysisPolicy({ analystSlots: 10 }), {
      runtimeSlots: 3,
      freeBytes: 100,
      reserveBytes: 20,
      bytesPerAnalyst: 30,
      activeEvaluationBytes: 30,
    }),
    1,
  );
  assert.equal(
    reviewFeasibility(
      [{ stratum: "short", losses: 10, elapsedMs: 100, bytes: 1000 }],
      { short: 10, long: 10 },
      3,
      1000,
    ).assessable,
    false,
  );
  assert.equal(
    reviewFeasibility(
      [{ stratum: "short", losses: 10, elapsedMs: 100, bytes: 1000 }],
      { short: 10 },
      1,
      50,
    ).feasible,
    false,
  );
});

test("two-pass cohorts expand monotonically while retaining representative and high-cost losses", () => {
  const ids = Array.from({ length: 25 }, (_, i) => `match-${i}`);
  const costs = Object.fromEntries(ids.map((id, i) => [id, i]));
  let previous = new Set<string>();
  for (let n = 1; n <= ids.length; n++) {
    const policy = resolveAnalysisPolicy({
      mode: "two-pass",
      sampleMatches: n,
      seed: "fixed",
    });
    const next = selectedMatches(ids, policy, costs);
    assert.equal(next.size, n);
    assert.ok([...previous].every((id) => next.has(id)));
    assert.deepEqual(next, selectedMatches([...ids].reverse(), policy, costs));
    previous = next;
  }
  assert.throws(
    () =>
      selectedMatches(
        ids,
        resolveAnalysisPolicy({
          mode: "two-pass",
          sampleMatches: 5,
          seed: "fixed",
        }),
        {},
      ),
    /triage metadata/,
  );
  assert.throws(
    () =>
      resolveAnalysisPolicy({
        analystSlots: 4,
        resources: {
          runtimeSlots: 3,
          reserveBytes: 1,
          bytesPerAnalyst: 1,
          bytesPerPreparer: 1,
        },
      }),
    /runtime capabilities/,
  );
});
