import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  pairedGameDecision,
  type MatchObservation,
} from "../../scripts/bot-improvement/aggregation-statistics.ts";

test("decisions weight opponents equally and exclude timed-out pairs in both arms", () => {
  const a: MatchObservation[] = [
    { id: "1", slot: "a", games: ["win", "loss", "draw", "loss"] },
    { id: "2", slot: "a", games: ["win", "win", "win", "win"] },
    { id: "3", slot: "self", games: ["loss", "loss", "loss", "loss"] },
  ];
  const b: MatchObservation[] = [
    { id: "1", slot: "a", games: ["timeout", "win", "draw", "loss"] },
    { id: "2", slot: "a", games: ["win", "win", "win", "win"] },
    { id: "3", slot: "self", games: ["win", "loss", "loss", "loss"] },
  ];
  const result = pairedGameDecision(a, b);
  assert.equal(result.assessable, true);
  assert.equal(result.perOpponent[0]!.pairedGames, 7);
  assert.equal(result.perOpponent[0]!.ignoredPairs, 1);
  assert.equal(result.controlWinRate, 4 / 7 / 2);
  assert.equal(result.candidateWinRate, (5 / 7 + 1 / 4) / 2);
  assert.equal(result.recommendation, "accept");
  assert.equal(pairedGameDecision(a, a).recommendation, "retain");
  b[2]!.games = ["timeout", "timeout", "timeout", "timeout"];
  assert.equal(pairedGameDecision(a, b).assessable, false);
});

test("existing rule history rejects repeated candidate content against the same base", async () => {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/rule-history-"));
  try {
    const run = (id: string, status: string, base = "v1") =>
      spawnSync(
        process.execPath,
        [
          "scripts/bot-improvement/update-improvement-history.ts",
          "--bot",
          root,
          "--id",
          id,
          "--change",
          "target removal",
          "--status",
          status,
          "--base",
          base,
          "--candidate",
          path.join(root, "candidate.ts"),
          "--evidence",
          path.join(root, "summary.txt"),
          "--candidate-hash",
          "a".repeat(64),
          "--rules",
          "removal-target",
          "--reason",
          "paired regression",
          "--delta=-1",
        ],
        { encoding: "utf8" },
      );
    const first = run("attempt1", "rejected");
    assert.equal(first.status, 0, first.stderr);
    const duplicate = run("attempt2", "pending");
    assert.notEqual(duplicate.status, 0);
    assert.match(duplicate.stderr, /Duplicate candidate/);
    assert.equal(run("attempt3", "pending", "v2").status, 0);
    const text = await readFile(
      path.join(root, "improvement-history.md"),
      "utf8",
    );
    assert.match(text, /rules: removal-target/);
    assert.equal(text.includes("attempt2"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
