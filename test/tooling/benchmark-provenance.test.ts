import { test } from "node:test";
import assert from "node:assert/strict";
import { benchmarkProvenance } from "../../scripts/bot-improvement/benchmark-provenance.ts";

test("benchmark provenance pins inputs, source bytes and runtime without substituting requested for completed work", () => {
  const options = {
    workers: [2, 4],
    evidenceMode: "native-v2",
    childRuntimeFlags: ["--no-liftoff"],
  };
  const first = benchmarkProvenance({ fixture: "a", seeds: [1, 2] }, options);
  const same = benchmarkProvenance({ fixture: "a", seeds: [1, 2] }, options);
  const changed = benchmarkProvenance({ fixture: "a", seeds: [1, 3] }, options);
  assert.equal(first.frozenInputsSha256, same.frozenInputsSha256);
  assert.notEqual(first.frozenInputsSha256, changed.frozenInputsSha256);
  assert.equal(
    first.source.trackedAndUntrackedSourceSha256,
    same.source.trackedAndUntrackedSourceSha256,
  );
  assert.match(first.source.revision, /^[a-f0-9]{40}$/);
  assert.deepEqual(first.runtime.childRuntimeFlags, options.childRuntimeFlags);
  assert.deepEqual(first.workers, [2, 4]);
  assert.equal(first.evidenceMode, "native-v2");
  assert.equal("completedGames" in first, false);
});
