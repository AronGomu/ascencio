import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import path from "node:path";
import {
  changedFiles,
  repositoryFiles,
  selectTests,
} from "./test-selection.ts";

function git(root: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
}

export function branchBase(root: string): string {
  for (const ref of [
    "@{upstream}",
    "refs/remotes/origin/HEAD",
    "origin/main",
    "main",
  ]) {
    try {
      const resolved = git(root, [
        "rev-parse",
        "--verify",
        "--end-of-options",
        ref,
      ]).trim();
      const head = git(root, ["rev-parse", "HEAD"]).trim();
      if (ref === "main" && resolved === head) continue;
      return ref;
    } catch {
      // A checkout without an upstream can still use its remote or local main.
    }
  }
  throw new Error(
    "Cannot infer the branch base. Supply --base <ref>; HEAD alone would omit committed branch changes.",
  );
}

export function gatherBranchContext(
  root: string,
  requestedBase: string | null,
) {
  const base = requestedBase ?? branchBase(root);
  const baseCommit = git(root, [
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${base}^{commit}`,
  ]).trim();
  const mergeBase = git(root, ["merge-base", "HEAD", baseCommit]).trim();
  const changed = changedFiles(root, base);
  const selection = selectTests(root, changed, repositoryFiles(root));
  const untracked = git(root, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  ])
    .split("\0")
    .filter(Boolean)
    .map((file) => {
      const absolute = path.join(root, file);
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink())
        return { file, kind: "symlink", target: readlinkSync(absolute) };
      if (!stat.isFile()) return { file, kind: "non-file", bytes: stat.size };
      const buffer = readFileSync(absolute);
      return buffer.includes(0)
        ? { file, kind: "binary", bytes: buffer.length }
        : {
            file,
            kind: "text",
            bytes: buffer.length,
            content: buffer.toString("utf8"),
          };
    });
  const diffFlags = ["--no-ext-diff", "--no-textconv", "--no-renames"];
  return {
    branch: git(root, ["rev-parse", "--abbrev-ref", "HEAD"]).trim(),
    head: git(root, ["rev-parse", "HEAD"]).trim(),
    base,
    baseCommit,
    mergeBase,
    commits: git(root, ["log", "--format=%H %s", `${mergeBase}..HEAD`])
      .trim()
      .split("\n")
      .filter(Boolean),
    status: git(root, ["status", "--porcelain=v1"]),
    changedFiles: changed,
    patches: {
      committed: git(root, ["diff", ...diffFlags, mergeBase, "HEAD", "--"]),
      staged: git(root, ["diff", ...diffFlags, "--cached", "--"]),
      unstaged: git(root, ["diff", ...diffFlags, "--"]),
    },
    untracked,
    selectedTests: [...selection.selected]
      .sort()
      .map(([file, reasons]) => ({ file, reasons })),
    needsReview: selection.uncovered,
    note: "Static references suggest tests, not behavioral coverage. Review patches, affected consumers, and needsReview before choosing exact test files. Binary untracked files carry metadata rather than text.",
  };
}
