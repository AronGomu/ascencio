import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { hostname } from "node:os";
import { commitBotVersion } from "../../scripts/bot-improvement/commit-bot-version.ts";

test("Git publication recovers after branch update, preserves unrelated staging and rejects conflicts", async () => {
  await mkdir(".tmp", { recursive: true });
  const repository = await mkdtemp(path.resolve(".tmp/bot-git-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: repository, encoding: "utf8" }).trim();
  try {
    git("init", "-b", "main");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.invalid");
    await mkdir(path.join(repository, "bot"));
    await writeFile(path.join(repository, "bot/source.ts"), "initial\n");
    await writeFile(path.join(repository, "other.txt"), "initial\n");
    git("add", ".");
    git("commit", "-m", "initial");
    await writeFile(path.join(repository, "bot/source.ts"), "candidate\n");
    await writeFile(path.join(repository, "other.txt"), "unrelated\n");
    git("add", "other.txt");
    const input = {
      repository,
      session: path.join(repository, ".session"),
      botPath: "bot",
      bot: "test",
      version: "v002",
      run: "run1",
      outcome: "rejected" as const,
      parentVersion: "v001",
    };
    const result = await commitBotVersion(input);
    assert.equal(git("show", "HEAD:bot/source.ts"), "candidate");
    assert.equal(git("show", "HEAD:other.txt"), "initial");
    assert.equal(git("diff", "--cached", "--name-only"), "other.txt");
    assert.match(git("log", "-1", "--format=%B"), /AI-Version: v002/);
    await rm(`${result.journal}.receipt.json`); // Crash after ref publication, before receipt.
    assert.deepEqual(await commitBotVersion(input), result);
    assert.equal(git("rev-list", "--count", "HEAD"), "2");
    assert.ok(
      JSON.parse(await readFile(`${result.journal}.receipt.json`, "utf8"))
        .commit,
    );
    await assert.rejects(
      commitBotVersion({ ...input, outcome: "accepted" }),
      /Conflicting/,
    );
    assert.equal(git("diff", "--cached", "--name-only"), "other.txt");
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test("initial bot publication recovers a dead owner's lock when the bot path is new", async () => {
  await mkdir(".tmp", { recursive: true });
  const repository = await mkdtemp(path.resolve(".tmp/bot-git-initial-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: repository, encoding: "utf8" }).trim();
  try {
    git("init", "-b", "main");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.invalid");
    await writeFile(path.join(repository, "other.txt"), "initial\n");
    git("add", ".");
    git("commit", "-m", "initial");
    await mkdir(path.join(repository, "bot"));
    await writeFile(path.join(repository, "bot/source.ts"), "new bot\n");
    const session = path.join(repository, ".session");
    await mkdir(session);
    const deadPid = Number(
      execFileSync(
        process.execPath,
        ["-e", "process.stdout.write(String(process.pid))"],
        { encoding: "utf8" },
      ),
    );
    assert.throws(() => process.kill(deadPid, 0), { code: "ESRCH" });
    await writeFile(
      path.join(session, ".git-publication.lock"),
      `${hostname()}:${deadPid}`,
    );
    const input = {
      repository,
      session,
      botPath: "bot",
      bot: "test",
      version: "v001",
      run: "run1",
      outcome: "initial" as const,
      parentVersion: "none",
    };
    const result = await commitBotVersion(input);
    assert.equal(git("show", "HEAD:bot/source.ts"), "new bot");
    assert.equal(git("diff", "--cached", "--name-only"), "");
    assert.match(git("log", "-1", "--format=%B"), /AI-Outcome: initial/);
    assert.deepEqual(await commitBotVersion(input), result);
    assert.equal(git("rev-list", "--count", "HEAD"), "2");
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});
