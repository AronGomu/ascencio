import test from "node:test";
import assert from "node:assert/strict";
import {
  mapPlayers,
  gameplayHash,
} from "../../scripts/bot-improvement/typescript-match-worker.ts";
import { executeHostCommand } from "../../scripts/bot-evaluation/host.ts";
import { runTypescriptMatches } from "../../scripts/bot-improvement/run-typescript-matches.ts";
import { prepareMatches } from "../../scripts/bot-improvement/prepare-match-job.ts";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
test("integrated host imports without starting stdin and reports invalid commands through its sink", async () => {
  const frames: unknown[] = [];
  await executeHostCommand({ type: "invalid" }, (f) => frames.push(f));
  assert.equal((frames[0] as { type: string }).type, "host_error");
  assert.equal(frames.length, 1);
});
test("seat mapping preserves private actor perspective across starting-player rotation", () => {
  const value = {
    player: 0,
    owner: 1,
    life_points: { a: 8000, b: 4000 },
    nested: [{ controller: 0 }],
    code: 1,
  };
  assert.deepEqual(mapPlayers(value, true), {
    player: "b",
    owner: "a",
    life_points: { a: 4000, b: 8000 },
    nested: [{ controller: "b" }],
    code: 1,
  });
  assert.equal(value.player, 0);
});
test("gameplay hashing ignores object key order and detects changed decisions", () => {
  assert.equal(
    gameplayHash({ b: 2, a: { y: 1, x: 3 } }),
    gameplayHash({ a: { x: 3, y: 1 }, b: 2 }),
  );
  assert.notEqual(
    gameplayHash({ choices: ["a", "b"] }),
    gameplayHash({ choices: ["b", "a"] }),
  );
});
const source = process.env.ARO2_FROZEN_SESSION;
test(
  "persistent TypeScript workers reproduce the same games at one and two workers",
  { skip: !source, timeout: 120000 },
  async () => {
    const { job } = await prepareMatches({ session: source!, matchCount: 2 });
    const root = await mkdtemp(path.resolve(".tmp/typescript-runner-test-"));
    const one = await runTypescriptMatches({
      job,
      out: path.join(root, "one"),
      workers: 1,
    });
    const two = await runTypescriptMatches({
      job,
      out: path.join(root, "two"),
      workers: 2,
    });
    assert.equal(one.matches, 2);
    assert.equal(two.games, 8);
    assert.equal(one.fingerprint, two.fingerprint);
    assert.equal(two.rows.length, 2);
    await assert.rejects(
      runTypescriptMatches({
        job,
        out: path.join(root, "cancelled"),
        workers: 2,
        maxWallMs: 1,
      }),
      /interrupted|Worker exited/,
    );
  },
);
