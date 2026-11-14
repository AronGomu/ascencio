import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
// @ts-expect-error JavaScript CLI helpers are exercised as their public interface.
import * as helpers from "../../scripts/agent-tools/session-tools.mjs";
const { snapshot, changedFiles, section, status, workloads } = helpers;
test("review snapshot detects changes and deletion", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "agent-pins-"));
  try {
    const f = path.join(dir, "source");
    await writeFile(f, "a");
    const saved = await snapshot([f]);
    assert.deepEqual(await changedFiles(saved), []);
    await writeFile(f, "b");
    assert.deepEqual(await changedFiles(saved), [f]);
    await rm(f);
    assert.deepEqual(await changedFiles(saved), [f]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("bounded heading reader retains child headings and stops at sibling", () => {
  assert.equal(
    section("# A\nx\n## Child\ny\n# B\nz", "A"),
    "1: # A\n2: x\n3: ## Child\n4: y",
  );
  assert.throws(() => section("# A", "missing"));
  assert.equal(workloads.smoke.matches, 4);
  assert.equal(workloads.confirm.repeats, 2);
});
test("status counts charged recovery but deduplicates completed work", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "agent-status-"));
  try {
    await mkdir(path.join(dir, "iterations"));
    await writeFile(
      path.join(dir, "control.json"),
      JSON.stringify({
        limits: { maxGames: 44 },
        attempts: [
          {
            iteration: 1,
            role: "control",
            match: "m",
            status: "interrupted",
            reservedGames: 4,
          },
          {
            iteration: 1,
            role: "control",
            match: "m",
            status: "complete",
            reservedGames: 4,
            games: [1, 2, 3, 4],
          },
        ],
      }),
    );
    const r = await status(dir);
    assert.equal(r.chargedGames, 8);
    assert.equal(r.completedGames, 4);
    assert.equal(r.effectiveLimits.maxGames, 44);
    assert.equal(r.replay.settledCases, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("documentation guard rejects missing links, anchors and malformed HTML", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "agent-docs-"));
  try {
    const f = path.join(dir, "doc.html");
    await writeFile(
      f,
      '<html><body><a href="#ok">ok</a><p id="ok">Text</p></body></html>',
    );
    const run = () =>
      spawnSync("python3", ["scripts/agent-tools/check-docs.py", f], {
        encoding: "utf8",
      });
    assert.equal(run().status, 0);
    await writeFile(
      f,
      '<html><body><a href="missing.md">bad</a><p></body></html>',
    );
    const bad = run();
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /missing link/);
    assert.match(bad.stdout, /unbalanced/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
