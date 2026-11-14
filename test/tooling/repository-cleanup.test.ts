import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { inspect, remove } from "../../scripts/repository/cleanup.ts";

test("cleanup deduplicates tips, excludes agent refs and checks tag identity before deletion", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "cleanup-test-"));
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
  try {
    git("init", "-b", "main");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.com");
    writeFileSync(path.join(root, "file"), "base");
    git("add", ".");
    git("commit", "-m", "base");
    git("checkout", "-b", "feature");
    writeFileSync(path.join(root, "file"), "feature");
    git("commit", "-am", "feature");
    const sha = git("rev-parse", "HEAD");
    git("tag", "archive/test");
    git("update-ref", "refs/t3/checkpoints/test", sha);
    git("checkout", "main");
    mkdirSync(path.join(root, ".tmp"));
    const report = inspect(root);
    assert.equal(report.groups.length, 1);
    assert.equal(report.groups[0]!.uniquePatches.length, 1);
    assert.equal(report.groups[0]!.refs.length, 2);
    assert.equal(report.groups[0]!.functionalOverlap, "requires-review");
    report.deletion.tags.push({
      ref: "refs/tags/archive/test",
      sha: report.baseSha,
    });
    assert.throws(() => remove(root, report), /changed/);
    report.deletion.tags[0]!.sha = sha;
    remove(root, report);
    assert.equal(git("tag", "--list", "archive/test"), "");
    assert.equal(git("rev-parse", "feature"), sha);
    report.deletion.tags = [];
    report.deletion.archives = [root];
    assert.throws(() => remove(root, report), /direct/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
