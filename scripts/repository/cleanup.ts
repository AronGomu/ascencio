import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function git(root: string, ...args: string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
}
export function inspect(root: string, base = "main") {
  const baseSha = git(root, "rev-parse", "--verify", `${base}^{commit}`);
  const refs = git(
    root,
    "for-each-ref",
    "--format=%(refname) %(objectname)",
    "refs/heads",
    "refs/remotes",
    "refs/tags/archive",
  )
    .split("\n")
    .filter(Boolean)
    .filter((line) => !line.startsWith("refs/remotes/origin/HEAD "));
  const groups = new Map<string, string[]>();
  for (const line of refs) {
    const [ref, sha] = line.split(" ");
    if (sha === baseSha) continue;
    groups.set(sha!, [...(groups.get(sha!) ?? []), ref!]);
  }
  return {
    schemaVersion: 1,
    root: realpathSync(root),
    base,
    baseSha,
    groups: [...groups].map(([sha, refs]) => {
      const patches = git(root, "cherry", baseSha, sha)
        .split("\n")
        .filter(Boolean);
      return {
        sha,
        refs,
        uniquePatches: patches
          .filter((p) => p.startsWith("+"))
          .map((p) => p.slice(2)),
        equivalentPatches: patches
          .filter((p) => p.startsWith("-"))
          .map((p) => p.slice(2)),
        commits: git(
          root,
          "log",
          "--max-count=30",
          "--format=%h %s",
          `${baseSha}..${sha}`,
        )
          .split("\n")
          .filter(Boolean),
        functionalOverlap: "requires-review",
      };
    }),
    worktrees: git(root, "worktree", "list", "--porcelain")
      .split("\n\n")
      .filter(Boolean)
      .map((block) => {
        const directory = block.split("\n")[0]!.slice(9);
        return {
          directory,
          status: git(
            directory,
            "status",
            "--short",
            "--untracked-files=normal",
          )
            .split("\n")
            .filter(Boolean),
        };
      }),
    deletion: {
      tags: [] as { ref: string; sha: string; remote?: string }[],
      archives: [] as string[],
    },
  };
}
export function remove(root: string, manifest: ReturnType<typeof inspect>) {
  if (
    realpathSync(root) !== manifest.root ||
    git(root, "rev-parse", manifest.base) !== manifest.baseSha
  )
    throw Error("Repository/base changed; inspect again");
  // Validate every requested operation before mutating anything.
  for (const tag of manifest.deletion.tags) {
    if (tag.remote && !git(root, "remote").split("\n").includes(tag.remote))
      throw Error("Remote must be a configured remote name");
    if (!tag.ref.startsWith("refs/tags/archive/"))
      throw Error("Only archive tags can be deleted");
    const actual = tag.remote
      ? git(root, "ls-remote", tag.remote, tag.ref).split(/\s/)[0]
      : git(root, "rev-parse", tag.ref);
    if (actual !== tag.sha) throw Error(`Archive tag changed: ${tag.ref}`);
  }
  const tmp = realpathSync(path.join(root, ".tmp"));
  for (const directory of manifest.deletion.archives) {
    const resolved = realpathSync(directory);
    if (
      path.dirname(resolved) !== tmp ||
      !path.basename(resolved).startsWith("merge-cleanup-")
    )
      throw Error("Archive must be a direct .tmp/merge-cleanup-* directory");
  }
  for (const tag of manifest.deletion.tags) {
    if (tag.remote)
      git(
        root,
        "push",
        `--force-with-lease=${tag.ref}:${tag.sha}`,
        tag.remote,
        `:${tag.ref}`,
      );
    else git(root, "update-ref", "-d", tag.ref, tag.sha);
  }
  for (const directory of manifest.deletion.archives)
    rmSync(directory, { recursive: true });
  return { deleted: manifest.deletion, status: git(root, "status", "--short") };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const [command, file, base = "main"] = process.argv.slice(2);
  if (!file || !["inspect", "delete"].includes(command!))
    throw Error("Usage: cleanup.ts inspect|delete MANIFEST.json [BASE]");
  const root = git(process.cwd(), "rev-parse", "--show-toplevel");
  if (command === "inspect") {
    const report = inspect(root, base);
    writeFileSync(file, JSON.stringify(report, null, 2), { flag: "wx" });
    console.log(
      JSON.stringify({
        manifest: file,
        groups: report.groups.length,
        worktrees: report.worktrees.length,
      }),
    );
  } else
    console.log(
      JSON.stringify(remove(root, JSON.parse(readFileSync(file, "utf8")))),
    );
}
