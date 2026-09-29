import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inspect } from "node:util";
import {
  syncRepository,
  validateGitRef,
  validatePinnedRevision,
} from "../scripts/lib/sources.ts";

test("Git source refs accept branches, tags and commit hashes", () => {
  assert.doesNotThrow(() => validateGitRef("master"));
  assert.doesNotThrow(() => validateGitRef("refs/tags/v1.2.3"));
  assert.doesNotThrow(() =>
    validateGitRef("ed2e32c31c85bfa1fbbd37ffbb41265dd9f90ef7"),
  );
});

test("pinned source revisions must match the checked-out commit", () => {
  const pinned = "ed2e32c31c85bfa1fbbd37ffbb41265dd9f90ef7";
  assert.doesNotThrow(() => validatePinnedRevision(pinned, pinned));
  assert.throws(
    () => validatePinnedRevision(pinned, "f".repeat(40)),
    /Pinned source revision mismatch/,
  );
  assert.doesNotThrow(() => validatePinnedRevision("review-branch", pinned));
});

test("Git source refs reject option and refspec injection", () => {
  for (const ref of [
    "--upload-pack=evil",
    "main:other",
    "main..other",
    "main^{}",
    "bad ref",
  ]) {
    assert.throws(() => validateGitRef(ref), /Unsafe or invalid Git ref/);
  }
});

test("offline source sync rejects a cache cloned from another repository", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ygo-assets-source-"));
  const cacheRoot = path.join(root, "cache");
  const repository = path.join(cacheRoot, "BabelCDB");
  try {
    await mkdir(repository, { recursive: true });
    runGit(["init", "--initial-branch=main"], repository);
    runGit(["config", "user.email", "test@example.invalid"], repository);
    runGit(["config", "user.name", "Asset test"], repository);
    runGit(
      ["remote", "add", "origin", "https://attacker.invalid/BabelCDB.git"],
      repository,
    );
    await writeFile(path.join(repository, "README.md"), "untrusted cache\n");
    runGit(["add", "README.md"], repository);
    runGit(["commit", "-m", "fixture"], repository);

    await assert.rejects(
      () =>
        syncRepository(
          cacheRoot,
          {
            name: "BabelCDB",
            repository: "https://github.com/ProjectIgnis/BabelCDB.git",
            ref: "main",
          },
          true,
        ),
      /Offline source cache is missing or invalid/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cached origin credentials stay out of diagnostics and error causes", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ygo-assets-source-"));
  const repository = path.join(root, "BabelCDB");
  const origin = new URL("https://attacker.invalid/BabelCDB.git");
  origin.username = "synthetic-cache-user";
  origin.password = "synthetic-cache-secret";
  const diagnostics: string[] = [];
  let failure: unknown;
  try {
    await mkdir(repository);
    runGit(["init", "--initial-branch=main"], repository);
    const setup = spawnSync("git", ["remote", "add", "origin", origin.href], {
      cwd: repository,
      encoding: "utf8",
    });
    // Never include credential-bearing command output in assertion failures.
    assert.equal(setup.status, 0, "fixture origin setup failed");
    const stderr = t.mock.method(process.stderr, "write", (chunk: string) => {
      diagnostics.push(String(chunk));
      return true;
    });
    try {
      await syncRepository(
        root,
        {
          name: "BabelCDB",
          repository: "https://github.com/ProjectIgnis/BabelCDB.git",
          ref: "main",
        },
        true,
      );
    } catch (error) {
      failure = error;
    } finally {
      stderr.mock.restore();
    }

    // Assert booleans only: RED output must not echo captured credentials.
    for (const output of [diagnostics.join(""), inspect(failure)]) {
      const leaked = [origin.username, origin.password, origin.href].some(
        (secret) => output.includes(secret),
      );
      assert.equal(leaked, false, "cached origin credentials leaked");
      assert.equal(
        output.includes("Cached source repository mismatch"),
        true,
        "mismatch classification missing",
      );
    }
    assert.equal(
      failure instanceof Error &&
        failure.message.includes("Offline source cache is missing or invalid"),
      true,
      "mismatched cache must reject offline sync",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function runGit(args: string[], cwd: string): void {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}
