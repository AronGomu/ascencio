import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  selectTests,
  testRunner,
} from "../../test/runner/lib/test-selection.ts";

// Only prose is exempt. Configuration (including YAML) must be reviewed/tested.
export function documentationOnly(file: string): boolean {
  return (
    file.endsWith(".md") ||
    /^(docs|artifacts)\/.*\.(txt|html|png|jpg|svg)$/.test(file)
  );
}

function git(root: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}
function list(root: string, args: string[]): string[] {
  return git(root, args).split("\0").filter(Boolean);
}

export function stagedFiles(root: string): string[] {
  return list(root, ["diff", "--cached", "--name-only", "--no-renames", "-z"]);
}

export function validationState(root: string): {
  key: string;
  files: string[];
} {
  const unstaged = list(root, ["diff", "--name-only", "--no-ext-diff", "-z"]);
  const untracked = list(root, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  ]).filter((file) => !documentationOnly(file));
  if (unstaged.length || untracked.length) {
    throw new Error(
      `Working tree differs from commit content. Stage changes or move them to a separate checkout, then retry; no files were modified:\n${[...unstaged, ...untracked].join("\n")}`,
    );
  }
  const files = list(root, ["ls-files", "--cached", "-z"]);
  // Compare actual blobs as well as Git's stat-based diff. This catches
  // assume-unchanged/skip-worktree files and uses Git's clean filters/CRLF rules.
  const entries = list(root, ["ls-files", "--stage", "-z"]);
  const regularFiles = files.filter(
    (file) => !lstatSync(path.join(root, file)).isSymbolicLink(),
  );
  const objectFormat = git(root, ["rev-parse", "--show-object-format"]).trim();
  const actual = regularFiles.length
    ? execFileSync("git", ["hash-object", "--stdin-paths"], {
        cwd: root,
        encoding: "utf8",
        input:
          regularFiles.map((file) => JSON.stringify(file)).join("\n") + "\n",
        maxBuffer: 32 * 1024 * 1024,
      })
        .trim()
        .split("\n")
    : [];
  let regularIndex = 0;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const metadata = entry.slice(0, entry.indexOf("\t")).split(" ");
    // hash-object follows symlinks; compare their target text separately.
    const file = files[i]!;
    const stat = lstatSync(path.join(root, file));
    const target = stat.isSymbolicLink()
      ? Buffer.from(readlinkSync(path.join(root, file)))
      : null;
    const blob = target
      ? createHash(objectFormat)
          .update(`blob ${target.length}\0`)
          .update(target)
          .digest("hex")
      : actual[regularIndex++];
    if (metadata[2] !== "0" || metadata[1] !== blob) {
      throw new Error(
        `Working tree differs from commit content: ${file}. Stage the intended content and retry.`,
      );
    }
  }
  const hash = createHash("sha256");
  hash.update(process.version);
  hash.update(git(root, ["write-tree"]));
  hash.update(JSON.stringify(stagedFiles(root)));
  // Include working bytes too: a changed file cannot reuse a cached success,
  // even with Git's stat cache or assume-unchanged flags.
  for (const file of files) {
    hash.update(JSON.stringify(file));
    const full = path.join(root, file);
    const stat = lstatSync(full);
    if (stat.isDirectory())
      throw new Error(`Submodule validation needs explicit support: ${file}`);
    hash.update(String(stat.mode));
    hash.update(
      stat.isSymbolicLink() ? readlinkSync(full) : readFileSync(full),
    );
  }
  return { key: hash.digest("hex"), files };
}

export type Check = (args: string[]) => void;
export function validateCommit(
  root: string,
  explicitTests: string[] = [],
  check?: Check,
): void {
  const changed = stagedFiles(root);
  if (changed.every(documentationOnly)) {
    console.log(
      "[pre-commit] Documentation-only/no staged changes: application checks skipped.",
    );
    return;
  }
  const state = validationState(root);
  const evidence = path.resolve(
    root,
    git(root, ["rev-parse", "--git-path", "commit-validation.json"]).trim(),
  );
  if (!explicitTests.length && existsSync(evidence)) {
    const previous = JSON.parse(readFileSync(evidence, "utf8")) as {
      key?: string;
    };
    if (previous.key === state.key) {
      console.log(
        "[pre-commit] Reusing successful local checks for exact staged content.",
      );
      return;
    }
  }
  const plan = selectTests(
    root,
    changed.filter((file) => !documentationOnly(file)),
    state.files,
  );
  const covered = new Set([...plan.selected.values()].flat());
  const uncovered = changed.filter(
    (file) => !documentationOnly(file) && !covered.has(file),
  );
  if (uncovered.length && !explicitTests.length) {
    throw new Error(
      `Test selection needs review for:\n${uncovered.join("\n")}\nRun npm run test:context, review related tests, then npm run commit:validate -- --tests <exact-test-files>. Stage first. The hook reuses success only for identical content.`,
    );
  }
  const tests = [
    ...new Set([...plan.selected.keys(), ...explicitTests]),
  ].sort();
  if (!tests.length)
    throw new Error(
      "No relevant tests selected. Use npm run commit:validate -- --tests <exact-test-files>.",
    );
  for (const test of tests) {
    if (!state.files.includes(test) || testRunner(test) === null)
      throw new Error(`Unsupported/untracked test: ${test}`);
  }
  rmSync(evidence, { force: true });
  const run: Check =
    check ??
    ((args) => {
      console.log(`[pre-commit] node ${args.join(" ")}`);
      const env = { ...process.env };
      // Git exports repository/index overrides inside hooks. Child tests may
      // create their own repositories; do not redirect them into this index.
      for (const name of [
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_INDEX_FILE",
        "GIT_COMMON_DIR",
        "GIT_PREFIX",
      ])
        delete env[name];
      const result = spawnSync(process.execPath, args, {
        cwd: root,
        stdio: "inherit",
        env,
      });
      if (result.error || result.status !== 0)
        throw new Error(
          `Local check failed: node ${args.join(" ")}. Fix the failure and rerun commit:validate.`,
        );
    });
  const lintFiles = changed.filter(
    (file) =>
      /\.(ts|js|mjs|svelte)$/.test(file) && existsSync(path.join(root, file)),
  );
  const global = changed.some((file) =>
    /^(package(-lock)?\.json|config\/)/.test(file),
  );
  if (global || lintFiles.length)
    run([
      "node_modules/eslint/bin/eslint.js",
      "--config",
      "config/eslint.config.js",
      ...(global ? ["."] : lintFiles),
    ]);
  if (global || changed.some((file) => /\.(ts|svelte)$/.test(file))) {
    run([
      "node_modules/typescript/bin/tsc",
      "--project",
      "config/tsconfig.json",
      "--noEmit",
    ]);
    run([
      "node_modules/svelte-check/bin/svelte-check",
      "--tsconfig",
      "./config/tsconfig.json",
      "--config",
      "./config/vite.config.ts",
    ]);
  }
  run(["test/runner/run-tests.ts", "--tests", ...tests]);
  if (validationState(root).key !== state.key)
    throw new Error(
      "Content changed during validation; rerun commit:validate.",
    );
  mkdirSync(path.dirname(evidence), { recursive: true });
  writeFileSync(
    evidence,
    JSON.stringify({
      key: state.key,
      tests,
      completed: new Date().toISOString(),
    }) + "\n",
  );
  console.log(
    "[pre-commit] Relevant local checks passed for exact staged content.",
  );
}
