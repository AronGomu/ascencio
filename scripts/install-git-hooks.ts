import { execFileSync } from "node:child_process";
import { chmodSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function installGitHooks(root: string): void {
  chmodSync(path.join(root, ".githooks/pre-commit"), 0o755);
  execFileSync("git", ["config", "--local", "core.hooksPath", ".githooks"], {
    cwd: root,
  });
  console.log("Tracked local commit hook activated (.githooks).");
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  installGitHooks(process.cwd());
}
