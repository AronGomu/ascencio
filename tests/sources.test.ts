import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  syncRepository,
  validateGitRef,
  validatePinnedRevision,
} from "../scripts/lib/sources.ts";

function git(directory: string, ...args: string[]): string {
  return execFileSync("git", ["-C", directory, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function fixture(t: TestContext): Promise<string> {
  await mkdir(".tmp", { recursive: true });
  const scratch = await realpath(".tmp");
  const directory = await mkdtemp(path.join(scratch, "sources-test-"));
  t.after(async () => {
    assert.equal(await realpath(directory), directory);
    assert.equal(path.dirname(directory), scratch);
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

async function initRepository(directory: string): Promise<string> {
  await mkdir(directory, { recursive: true });
  git(directory, "init", "--initial-branch=main");
  await writeFile(path.join(directory, "source.txt"), "committed source\n");
  git(directory, "add", "source.txt");
  git(
    directory,
    "-c",
    "user.name=Source test",
    "-c",
    "user.email=source-test@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-m",
    "fixture",
  );
  git(directory, "remote", "add", "origin", directory);
  return git(directory, "rev-parse", "HEAD");
}

async function parentState(directory: string) {
  return {
    head: git(directory, "rev-parse", "HEAD"),
    branch: git(directory, "symbolic-ref", "HEAD"),
    status: git(directory, "status", "--porcelain"),
    config: await readFile(path.join(directory, ".git/config"), "utf8"),
    index: await readFile(path.join(directory, ".git/index")),
    source: await readFile(path.join(directory, "source.txt"), "utf8"),
  };
}

for (const offline of [true, false]) {
  for (const sparsePaths of [undefined, ["cards"]]) {
    test(`source cache owns its worktree (offline=${offline}, sparse=${!!sparsePaths})`, async (t) => {
      const root = await fixture(t);
      const parent = path.join(root, "parent");
      await initRepository(parent);
      const upstream = path.join(root, "upstream");
      await initRepository(upstream);
      git(parent, "remote", "set-url", "origin", upstream);
      await writeFile(path.join(parent, ".git/info/exclude"), ".cache/\n");
      await writeFile(
        path.join(parent, "source.txt"),
        "uncommitted parent work\n",
      );
      const cacheRoot = path.join(parent, ".cache");
      const directory = path.join(cacheRoot, "source");
      await mkdir(directory, { recursive: true });
      await writeFile(
        path.join(directory, "partial.txt"),
        "incomplete cache\n",
      );
      const before = await parentState(parent);
      const definition = {
        name: "source",
        repository: upstream,
        ref: "main",
        sparsePaths,
      };
      const events: { operation: string; args?: string[] }[] = [];
      t.mock.method(process.stderr, "write", (chunk: string) => {
        events.push(JSON.parse(chunk));
        return true;
      });

      await assert.rejects(
        syncRepository(cacheRoot, definition, offline),
        /[Ss]ource cache is .*invalid/,
      );
      assert.ok(
        events
          .filter((event) => event.operation === "git")
          .every((event) => event.args?.[0] === "rev-parse"),
      );
      assert.equal(
        await readFile(path.join(directory, "partial.txt"), "utf8"),
        "incomplete cache\n",
      );
      assert.deepEqual(await parentState(parent), before);
    });
  }
}

for (const offline of [true, false]) {
  for (const change of [
    "tracked",
    "staged",
    "untracked",
    "ignored",
    "origin",
  ]) {
    test(`source cache rejects ${change} changes without mutation (offline=${offline})`, async (t) => {
      const root = await fixture(t);
      const directory = path.join(root, "source");
      const commit = await initRepository(directory);
      let extra: string | undefined;
      if (change === "tracked" || change === "staged") {
        await writeFile(
          path.join(directory, "source.txt"),
          "local source edits\n",
        );
        if (change === "staged") git(directory, "add", "source.txt");
      } else if (change === "origin") {
        git(
          directory,
          "remote",
          "set-url",
          "origin",
          path.join(root, "wrong-origin"),
        );
      } else {
        extra = path.join(directory, "release-extra.cdb");
        await writeFile(extra, "local database\n");
        if (change === "ignored") {
          await writeFile(
            path.join(directory, ".git/info/exclude"),
            "release-extra.cdb\n",
          );
        }
      }
      const before = await parentState(directory);
      const commands: string[][] = [];
      t.mock.method(process.stderr, "write", (chunk: string) => {
        const event = JSON.parse(chunk);
        if (event.operation === "git" && event.status === "start")
          commands.push(event.args);
        return true;
      });
      await assert.rejects(
        syncRepository(
          root,
          {
            name: "source",
            repository: directory,
            ref: commit,
          },
          offline,
        ),
        /[Ss]ource cache is .*invalid/,
      );
      assert.ok(
        commands.every(([command]) =>
          ["rev-parse", "config", "--no-optional-locks"].includes(command),
        ),
      );
      assert.deepEqual(await parentState(directory), before);
      if (extra)
        assert.equal(await readFile(extra, "utf8"), "local database\n");
    });
  }
}

for (const sparsePaths of [undefined, ["cards"]]) {
  test(`offline source cache rejects a mismatched pin before mutation (sparse=${!!sparsePaths})`, async (t) => {
    const root = await fixture(t);
    const directory = path.join(root, "source");
    await initRepository(directory);
    const before = await parentState(directory);
    const commands: string[][] = [];
    t.mock.method(process.stderr, "write", (chunk: string) => {
      const event = JSON.parse(chunk);
      if (event.operation === "git" && event.status === "start")
        commands.push(event.args);
      return true;
    });

    await assert.rejects(
      syncRepository(
        root,
        {
          name: "source",
          repository: directory,
          ref: "f".repeat(40),
          sparsePaths,
        },
        true,
      ),
      (error: Error) => {
        assert.match(error.message, /Source cache is invalid/);
        assert.ok(error.cause instanceof Error);
        assert.match(error.cause.message, /Pinned source revision mismatch/);
        return true;
      },
    );
    assert.deepEqual(await parentState(directory), before);
    assert.ok(
      commands.every(([command]) =>
        ["rev-parse", "config", "--no-optional-locks"].includes(command),
      ),
    );
  });

  test(`online source cache clones missing repository then reuses clean cache (sparse=${!!sparsePaths})`, async (t) => {
    const root = await fixture(t);
    const upstream = path.join(root, "upstream");
    await initRepository(upstream);
    await mkdir(path.join(upstream, "cards"));
    await mkdir(path.join(upstream, "other"));
    await writeFile(path.join(upstream, ".gitignore"), "*.cdb\n");
    await writeFile(path.join(upstream, "cards/catalog.cdb"), "pinned DB\n");
    await writeFile(path.join(upstream, "other/source.txt"), "other source\n");
    git(upstream, "add", "--force", ".gitignore", "cards", "other");
    git(
      upstream,
      "-c",
      "user.name=Source test",
      "-c",
      "user.email=source-test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-m",
      "sparse and ignored-pattern fixtures",
    );
    const commit = git(upstream, "rev-parse", "HEAD");
    const definition = {
      name: "source",
      repository: upstream,
      ref: commit,
      sparsePaths,
    };
    const synced = await syncRepository(root, definition, false);
    assert.equal(synced.revision.commit, commit);
    assert.equal(
      await realpath(git(synced.directory, "rev-parse", "--show-toplevel")),
      await realpath(synced.directory),
    );
    const gitDirectory = await realpath(path.join(synced.directory, ".git"));
    await writeFile(
      path.join(gitDirectory, "cache-sentinel"),
      "keep existing cache\n",
    );
    assert.deepEqual(await syncRepository(root, definition, false), synced);
    assert.equal(
      await readFile(path.join(gitDirectory, "cache-sentinel"), "utf8"),
      "keep existing cache\n",
    );
    assert.deepEqual(await syncRepository(root, definition, true), synced);
    assert.equal(
      await readFile(path.join(synced.directory, "cards/catalog.cdb"), "utf8"),
      "pinned DB\n",
    );
    const other = path.join(synced.directory, "other/source.txt");
    if (sparsePaths) {
      await assert.rejects(readFile(other), { code: "ENOENT" });
    } else {
      assert.equal(await readFile(other, "utf8"), "other source\n");
    }
  });
}

test("offline source cache accepts its own worktree through a relative path", async (t) => {
  const root = await fixture(t);
  const directory = path.join(root, "source");
  const commit = await initRepository(directory);
  const synced = await syncRepository(
    path.relative(process.cwd(), root),
    {
      name: "source",
      repository: directory,
      ref: commit,
    },
    true,
  );
  assert.equal(synced.revision.commit, commit);
});

test("offline source cache accepts a linked worktree", async (t) => {
  const root = await fixture(t);
  const repository = path.join(root, "repository");
  const commit = await initRepository(repository);
  git(
    repository,
    "worktree",
    "add",
    "--detach",
    path.join(root, "source"),
    commit,
  );
  const synced = await syncRepository(
    root,
    {
      name: "source",
      repository,
      ref: commit,
    },
    true,
  );
  assert.equal(synced.revision.commit, commit);
});

test("offline missing source cache stays missing", async (t) => {
  const root = await fixture(t);
  await assert.rejects(
    syncRepository(
      root,
      {
        name: "missing",
        repository: "unused-offline",
        ref: "main",
      },
      true,
    ),
    /Offline source cache is missing or invalid/,
  );
  await assert.rejects(realpath(path.join(root, "missing")), {
    code: "ENOENT",
  });
});

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
