import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { installGitHooks } from "../../scripts/install-git-hooks.ts";
import {
  stagedFiles,
  validateCommit,
} from "../../scripts/lib/commit-validation.ts";

function fixture(t: { after: (fn: () => void) => void }) {
  const root = mkdtempSync(path.join(os.tmpdir(), "commit-guard-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" });
  const write = (file: string, body: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), body);
  };
  git("init", "-q");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Test");
  write("src/value.ts", "export const value = 1;\n");
  write("test/tooling/value.test.ts", 'import "../../src/value.ts";\n');
  git("add", ".");
  git("-c", "core.hooksPath=/dev/null", "commit", "-qm", "base");
  return { root, git, write };
}

test("installation is repeatable and Git invokes the tracked hook", (t) => {
  const f = fixture(t);
  f.write(".githooks/pre-commit", "#!/bin/sh\nexit 23\n");
  installGitHooks(f.root);
  installGitHooks(f.root);
  assert.equal(
    f.git("config", "--local", "core.hooksPath").trim(),
    ".githooks",
  );
  f.git("add", ".");
  assert.throws(() => f.git("commit", "-qm", "blocked"));
  assert.equal(f.git("log", "-1", "--format=%s").trim(), "base");
  assert.match(
    readFileSync("scripts/setup-desktop.ts", "utf8"),
    /installGitHooks\(root\)/,
  );
});

test("selection runs related tests, caches success, invalidates source and config", (t) => {
  const f = fixture(t);
  f.write("src/value.ts", "export const value = 2;\n");
  f.git("add", ".");
  const calls: string[][] = [];
  const run = (args: string[]) => {
    calls.push(args);
  };
  validateCommit(f.root, [], run);
  assert.deepEqual(calls.at(-1), [
    "test/runner/run-tests.ts",
    "--tests",
    "test/tooling/value.test.ts",
  ]);
  const count = calls.length;
  validateCommit(f.root, [], run);
  assert.equal(calls.length, count);
  f.write("src/value.ts", "export const value = 3;\n");
  f.git("add", ".");
  validateCommit(f.root, [], run);
  assert.ok(calls.length > count);
  f.write("config/check.json", "{}\n");
  f.git("add", ".");
  assert.throws(
    () => validateCommit(f.root, [], run),
    /selection needs review/,
  );
  validateCommit(f.root, ["test/tooling/value.test.ts"], run);
  assert.ok(calls.some((args) => args.includes(".")));
});

test("failure cannot produce reusable evidence", (t) => {
  const f = fixture(t);
  f.write("src/value.ts", "broken\n");
  f.git("add", ".");
  for (let i = 0; i < 2; i++) {
    assert.throws(
      () =>
        validateCommit(f.root, [], () => {
          throw new Error("local lint failed");
        }),
      /local lint failed/,
    );
  }
});

test("partial staging blocks even cached success and preserves owner bytes/index", (t) => {
  const f = fixture(t);
  f.write("src/value.ts", "export const value = 2;\n");
  f.git("add", ".");
  validateCommit(f.root, [], () => {});
  f.write("src/value.ts", "owner unstaged edit\n");
  const tree = f.git("write-tree");
  assert.throws(
    () => validateCommit(f.root, [], () => assert.fail("must not run")),
    /Working tree differs/,
  );
  assert.equal(
    readFileSync(path.join(f.root, "src/value.ts"), "utf8"),
    "owner unstaged edit\n",
  );
  assert.equal(f.git("write-tree"), tree);
});

test("content changing during checks cannot record success", (t) => {
  const f = fixture(t);
  f.write("src/value.ts", "export const value = 2;\n");
  f.git("add", ".");
  assert.throws(
    () =>
      validateCommit(f.root, [], () => {
        f.write("src/value.ts", "export const value = 3;\n");
        f.git("add", ".");
      }),
    /Content changed during validation/,
  );
});

test("documentation skips application execution even with unstaged owner code", (t) => {
  const f = fixture(t);
  f.write("README.md", "Documentation\n");
  f.git("add", "README.md");
  f.write("src/value.ts", "owner edit\n");
  assert.deepEqual(stagedFiles(f.root), ["README.md"]);
  validateCommit(f.root, [], () => assert.fail("no application checks"));
});

test("real tracked hook permits docs commits and gives actionable partial-staging errors", (t) => {
  const f = fixture(t);
  mkdirSync(path.join(f.root, ".githooks"));
  copyFileSync(
    ".githooks/pre-commit",
    path.join(f.root, ".githooks/pre-commit"),
  );
  // Exercise the production CLI using its real module dependencies.
  f.write(
    "scripts/validate-commit.ts",
    `import ${JSON.stringify(path.resolve("scripts/validate-commit.ts"))};\n`,
  );
  f.git("add", ".");
  f.git("-c", "core.hooksPath=/dev/null", "commit", "-qm", "install fixture");
  installGitHooks(f.root);
  f.write("README.md", "Docs\n");
  f.git("add", ".");
  f.git("commit", "-qm", "docs pass");
  f.write("src/value.ts", "staged\n");
  f.git("add", ".");
  f.write("src/value.ts", "unstaged\n");
  assert.throws(
    () => f.git("commit", "-qm", "must block"),
    /Commit blocked: Working tree differs/,
  );
});

test("assume-unchanged cannot hide working bytes different from the index", (t) => {
  const f = fixture(t);
  f.write("src/value.ts", "export const value = 2;\n");
  f.git("add", ".");
  f.git("update-index", "--assume-unchanged", "src/value.ts");
  f.write("src/value.ts", "hidden owner edit\n");
  assert.throws(
    () => validateCommit(f.root, [], () => assert.fail("must not run")),
    /Working tree differs/,
  );
});

test("YAML requires reviewed selection even alongside covered source", (t) => {
  const f = fixture(t);
  f.write("config/options.yml", "option: true\n");
  f.write("src/value.ts", "export const value = 2;\n");
  f.git("add", ".");
  assert.throws(
    () => validateCommit(f.root, [], () => assert.fail("must not run")),
    /selection needs review.*\nconfig\/options.yml/,
  );
});

test("actual nonzero test process blocks Git commit; passing processes permit it", (t) => {
  const f = fixture(t);
  mkdirSync(path.join(f.root, ".githooks"));
  copyFileSync(
    ".githooks/pre-commit",
    path.join(f.root, ".githooks/pre-commit"),
  );
  f.write(
    "scripts/validate-commit.ts",
    `import ${JSON.stringify(path.resolve("scripts/validate-commit.ts"))};\n`,
  );
  // Small subprocess fixtures isolate hook enforcement from ESLint/TS behavior.
  for (const file of [
    "node_modules/eslint/bin/eslint.js",
    "node_modules/typescript/bin/tsc",
    "node_modules/svelte-check/bin/svelte-check",
  ])
    f.write(file, "process.exit(0);\n");
  f.write("test/runner/run-tests.ts", "process.exit(9);\n");
  f.git("add", ".");
  f.git("-c", "core.hooksPath=/dev/null", "commit", "-qm", "installed fixture");
  installGitHooks(f.root);
  f.write("src/value.ts", "export const value = 2;\n");
  f.git("add", ".");
  assert.throws(
    () => f.git("commit", "-qm", "failed tests"),
    /Local check failed: node test\/runner\/run-tests.ts/,
  );
  f.write("test/runner/run-tests.ts", "process.exit(0);\n");
  f.git("add", ".");
  validateCommit(f.root, ["test/tooling/value.test.ts"]);
  f.git("commit", "-qm", "passing tests");
  assert.equal(f.git("log", "-1", "--format=%s").trim(), "passing tests");
});
