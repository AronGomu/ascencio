import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalReasonId,
  reconcileReasons,
  validateReasonVocabulary,
} from "../../scripts/bot-improvement/reason-vocabulary.ts";
test("explicit aliases preserve original conflicting solutions and distinct supported loss counts", () => {
  const vocabulary = {
    version: "v1",
    aliases: {
      "wrong-target": "self-destruction",
      "bad-target": "wrong-target",
    },
  };
  const rows = [
    {
      id: "bad-target",
      loss: "match1/G1",
      decision: "exact-id",
      reason: "bad",
      solution: "choose opponent",
    },
    {
      id: "wrong-target",
      loss: "match1/G1",
      decision: "other-id",
      reason: "different",
      solution: "pass",
    },
    {
      id: "self-destruction",
      loss: "match2/G1",
      decision: "another",
      reason: "bad",
      solution: "choose opponent",
    },
  ];
  const groups = reconcileReasons(rows, vocabulary);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.losses.length, 2);
  assert.deepEqual(groups[0]?.occurrences, rows);
  assert.equal(canonicalReasonId("novel-reason", vocabulary), "novel-reason");
  assert.throws(
    () =>
      validateReasonVocabulary({ version: "v1", aliases: { a: "b", b: "a" } }),
    /cycle/,
  );
  assert.throws(
    () => reconcileReasons([{ ...rows[0]!, loss: "" }], vocabulary),
    /supported loss/,
  );
});
