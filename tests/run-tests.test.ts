import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { gatherBranchContext } from "../scripts/lib/branch-test-context.ts";
import {
  changedFiles,
  relativeFile,
  repositoryFiles,
  selectTests,
} from "../scripts/lib/test-selection.ts";

async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ascencio-test-runner-"));
  for (const [file, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), text);
  }
  return root;
}

async function dispose(root: string) {
  assert.equal(path.dirname(root), os.tmpdir());
  assert.ok(path.basename(root).startsWith("ascencio-test-runner-"));
  await rm(root, { recursive: true, force: true });
}

test("selects consumers through Svelte, dynamic imports, barrels and JS-to-TS resolution", async () => {
  const files = {
    "src/feature.ts": "export const value = 1;",
    "src/index.ts": 'export * from "./feature.js";',
    "src/Screen.svelte":
      '<script lang="ts">import { value } from "./index.ts";</script><p>{value}</p>',
    "tests/component/screen.test.ts":
      'import Screen from "../../src/Screen.svelte";',
    "tests/unit/feature.test.ts": 'await import("../../src/feature.ts");',
    "tests/unit/unrelated.test.ts": "export {};",
  };
  const root = await fixture(files);
  try {
    const plan = selectTests(root, ["src/feature.ts"], Object.keys(files));
    assert.deepEqual(
      [...plan.selected.keys()],
      ["tests/component/screen.test.ts", "tests/unit/feature.test.ts"],
    );
    assert.deepEqual(plan.uncovered, []);
  } finally {
    await dispose(root);
  }
});

test("selects literal stylesheet coverage and reports unmatched executable changes", async () => {
  const files = {
    "src/app.css": '@import "./tokens.css";',
    "src/tokens.css": ":root { color: red; }",
    "src/new.ts": "export {};",
    "tests/unit/styles.test.ts": 'readFileSync("src/app.css", "utf8");',
    "docs/note.md": "note",
  };
  const root = await fixture(files);
  try {
    const plan = selectTests(
      root,
      ["src/tokens.css", "src/new.ts", "docs/note.md"],
      Object.keys(files),
    );
    assert.deepEqual([...plan.selected.keys()], ["tests/unit/styles.test.ts"]);
    assert.deepEqual(plan.uncovered, ["src/new.ts"]);
  } finally {
    await dispose(root);
  }
});

test("handles dependency cycles, deleted sources and config changes without a full-suite fallback", async () => {
  const files = {
    "src/a.ts": 'import "./b.ts";',
    "src/b.ts": 'import "./a.ts"; import "./deleted.ts";',
    "tests/unit/a.test.ts":
      'import "../../src/a.ts"; readFileSync("package.json");',
    "package.json": "{}",
  };
  const root = await fixture(files);
  try {
    const plan = selectTests(
      root,
      ["src/deleted.ts", "package.json"],
      Object.keys(files),
    );
    assert.deepEqual(plan.selected.get("tests/unit/a.test.ts"), [
      "src/deleted.ts",
    ]);
    assert.deepEqual(plan.uncovered, ["package.json"]);
    assert.throws(
      () => relativeFile(root, "../outside.ts"),
      /inside the repository/,
    );
  } finally {
    await dispose(root);
  }
});

test("Git scope combines committed, staged, unstaged, deleted and untracked changes", async () => {
  const root = await fixture({
    "a.ts": "a",
    "b.ts": "b",
    "c.ts": "c",
    "d.ts": "d",
  });
  function git(...args: string[]) {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  try {
    git("init", "-q");
    git("add", ".");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-qm",
      "baseline",
    );
    const base = git("rev-parse", "HEAD");
    await writeFile(path.join(root, "d.ts"), "committed");
    git("add", "d.ts");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-qm",
      "change",
    );
    await writeFile(path.join(root, "b.ts"), "staged");
    git("add", "b.ts");
    await writeFile(path.join(root, "a.ts"), "unstaged");
    await rm(path.join(root, "c.ts"));
    await writeFile(path.join(root, "new.ts"), "untracked");
    assert.deepEqual(changedFiles(root, null), [
      "a.ts",
      "b.ts",
      "c.ts",
      "new.ts",
    ]);
    assert.deepEqual(changedFiles(root, base), [
      "a.ts",
      "b.ts",
      "c.ts",
      "d.ts",
      "new.ts",
    ]);
    assert.ok(repositoryFiles(root).includes("new.ts"));
    await writeFile(path.join(root, "binary.bin"), Buffer.from([0, 1, 2]));
    const context = gatherBranchContext(root, base);
    assert.equal(context.commits.length, 1);
    assert.match(context.patches.committed, /committed/);
    assert.match(context.patches.staged, /staged/);
    assert.match(context.patches.unstaged, /unstaged/);
    assert.deepEqual(
      context.untracked.find((file) => file.file === "new.ts"),
      { file: "new.ts", kind: "text", bytes: 9, content: "untracked" },
    );
    assert.deepEqual(
      context.untracked.find((file) => file.file === "binary.bin"),
      { file: "binary.bin", kind: "binary", bytes: 3 },
    );
    git("remote", "add", "origin", "https://example.invalid/not-contacted");
    git("update-ref", "refs/remotes/origin/main", base);
    const branch = git("rev-parse", "--abbrev-ref", "HEAD");
    git("config", `branch.${branch}.remote`, "origin");
    git("config", `branch.${branch}.merge`, "refs/heads/main");
    const automatic = gatherBranchContext(root, null);
    assert.equal(automatic.base, "@{upstream}");
    assert.equal(automatic.mergeBase, base);
    assert.equal(automatic.commits.length, 1);
  } finally {
    await dispose(root);
  }
});

test("CLI continues after failure, has no file cap, and writes reports only on request", async () => {
  const root = await fixture({
    "package.json": '{"type":"module"}',
    ".gitignore": "node_modules/\n",
    "src/value.ts": "export const value = 1;",
    "tests/pass.test.ts":
      'import test from "node:test"; test("pass", () => {});',
    "tests/space name.test.ts":
      'import test from "node:test"; test("space", () => {});',
    "tests/fail.test.ts":
      'import test from "node:test"; test("fail", () => { throw new Error("expected failure"); });',
  });
  try {
    await mkdir(path.join(root, "scripts/lib"), { recursive: true });
    await cp("scripts/run-tests.ts", path.join(root, "scripts/run-tests.ts"));
    await cp(
      "scripts/lib/test-selection.ts",
      path.join(root, "scripts/lib/test-selection.ts"),
    );
    await cp(
      "scripts/lib/branch-test-context.ts",
      path.join(root, "scripts/lib/branch-test-context.ts"),
    );
    await symlink(
      path.resolve("node_modules"),
      path.join(root, "node_modules"),
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
    function run(...args: string[]) {
      return spawnSync(process.execPath, ["scripts/run-tests.ts", ...args], {
        cwd: root,
        encoding: "utf8",
      });
    }
    const preview = run("--tests", "tests/pass.test.ts", "--list");
    assert.equal(preview.status, 0, preview.stderr);
    assert.match(preview.stdout, /Selected 1 test files/);
    assert.doesNotMatch(preview.stdout, /Starting command/);
    const failed = run("--tests", "tests/fail.test.ts", "tests/pass.test.ts");
    assert.equal(failed.status, 1, failed.stdout + failed.stderr);
    assert.ok(
      failed.stdout.indexOf('"command":"tests/pass.test.ts"') >
        failed.stdout.indexOf('"command":"tests/fail.test.ts"'),
    );
    const directories = await readdir(
      path.join(root, "generated/tests/local-runs"),
    );
    for (const directory of directories)
      assert.ok(
        !(
          await readdir(
            path.join(root, "generated/tests/local-runs", directory),
          )
        ).includes("report.json"),
      );
    const reported = run("--tests", "tests/pass.test.ts", "--report");
    assert.equal(reported.status, 0, reported.stderr);
    const spaced = run("--tests", "tests/space name.test.ts");
    assert.equal(spaced.status, 0, spaced.stdout + spaced.stderr);
    const reportPath = /Requested report: (.+)/
      .exec(reported.stdout)?.[1]
      ?.trim();
    assert.ok(reportPath);
    assert.match(await readFile(reportPath, "utf8"), /"exitCode": 0/);
    assert.equal(run("--tests").status, 2);
    assert.equal(run("--tests", "tests").status, 2);
    assert.equal(run("--unknown").status, 2);
    assert.equal(run("--full", "--tests", "tests/pass.test.ts").status, 2);
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        type: "module",
        scripts: {
          check: 'node -e "process.exit(1)" && npm run later',
          later: "node -e \"console.log('later-gate')\"",
        },
      }),
    );
    const full = run("--full");
    assert.equal(full.status, 1, full.stdout + full.stderr);
    assert.match(
      full.stdout,
      /\[test-event\] \{"kind":"passed","command":"later:/,
    );
    const gap = run("--files", "src/value.ts", "--list");
    assert.equal(gap.status, 2);
    assert.match(gap.stderr, /Coverage needs an explicit selection/);
    const broad: string[] = [];
    for (let index = 0; index < 21; index++) {
      const file = `tests/test-${index}.test.ts`;
      await writeFile(path.join(root, file), 'import "../src/value.ts";');
      broad.push(file);
    }
    const broadPreview = run("--tests", ...broad, "--list");
    assert.equal(broadPreview.status, 0, broadPreview.stderr);
    assert.match(broadPreview.stdout, /Selected 21 test files/);
    assert.doesNotMatch(broadPreview.stdout, /Starting command/);
    assert.equal(run("--timeout", "2").status, 2);
  } finally {
    await dispose(root);
  }
});
