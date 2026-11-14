/** Recoverable Git source publication, independent of the decision-state journal. */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, open } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { hostname } from "node:os";
import { optionalJson, save } from "./session-checkpoint.ts";
import { identity } from "./session-fixtures.ts";

export interface BotVersionCommit {
  repository: string;
  session: string;
  botPath: string;
  bot: string;
  version: string;
  run: string;
  outcome: "initial" | "accepted" | "rejected";
  parentVersion: string;
}
/** Uses a private index; unrelated staged/working changes are never committed. */
export async function commitBotVersion(input: BotVersionCommit) {
  const repository = path.resolve(input.repository);
  const session = path.resolve(input.session);
  const botPath = path.relative(
    repository,
    path.resolve(repository, input.botPath),
  );
  if (
    !botPath ||
    botPath.split(path.sep).includes("..") ||
    path.isAbsolute(botPath)
  )
    throw new Error("Bot path must be inside repository");
  for (const value of [
    input.bot,
    input.version,
    input.run,
    input.parentVersion,
  ])
    if (!/^[a-zA-Z0-9_.-]+$/.test(value))
      throw new Error("Invalid commit identifier");
  if (!["initial", "accepted", "rejected"].includes(input.outcome))
    throw new Error("Invalid commit outcome");
  const request = { ...input, repository, session, botPath };
  const git = (args: string[], env?: NodeJS.ProcessEnv, stdin?: string) =>
    execFileSync("git", args, {
      cwd: repository,
      env: { ...process.env, ...env },
      input: stdin,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  await mkdir(session, { recursive: true });
  const lock = path.join(session, ".git-publication.lock");
  const token = `${hostname()}:${process.pid}`;
  for (;;) {
    try {
      const handle = await open(lock, "wx");
      try {
        await handle.writeFile(token);
        await handle.sync();
      } finally {
        await handle.close();
      }
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const owner = await readFile(lock, "utf8");
      const split = owner.lastIndexOf(":");
      const pid = Number(owner.slice(split + 1));
      if (
        owner.slice(0, split) !== hostname() ||
        !Number.isSafeInteger(pid) ||
        pid < 1
      )
        throw new Error(
          "Unverifiable Git publication lock; reconcile before resume",
        );
      try {
        process.kill(pid, 0);
        throw new Error("Git publication is already active");
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code !== "ESRCH") throw cause;
      }
      await rm(lock);
    }
  }
  try {
    if (git(["symbolic-ref", "HEAD"]) !== "refs/heads/main")
      throw new Error("Bot version commits require main");
    const journalPath = path.join(
      session,
      `git-version-${input.bot}-${input.version}.json`,
    );
    let journal = (await optionalJson(journalPath)) as null | {
      request: BotVersionCommit;
      parent: string;
      tree: string;
      commit: string;
    };
    if (journal && identity(journal.request) !== identity(request))
      throw new Error("Conflicting bot version commit request");
    if (!journal) {
      const parent = git(["rev-parse", "HEAD"]);
      const index = path.join(session, `.git-index-${process.pid}`);
      const env = { GIT_INDEX_FILE: index };
      try {
        git(["read-tree", parent], env);
        git(["add", "-A", "--", botPath], env);
        const tree = git(["write-tree"], env);
        const subject = `ai-bot(${input.bot}): version ${input.version} | run ${input.run} | ${input.outcome}`;
        const message = `${subject}\n\nAI-Bot: ${input.bot}\nAI-Version: ${input.version}\nAI-Run: ${input.run}\nAI-Outcome: ${input.outcome}\nAI-Path: ${botPath}\nAI-Parent-Version: ${input.parentVersion}\n`;
        const commit = git(
          ["commit-tree", tree, "-p", parent],
          undefined,
          message,
        );
        journal = { request, parent, tree, commit };
        // Publish the object identity before moving the branch. Resume is idempotent.
        await save(journalPath, journal);
        for (const file of [journalPath, session]) {
          const handle = await open(file, "r");
          try {
            await handle.sync();
          } finally {
            await handle.close();
          }
        }
      } finally {
        await rm(index, { force: true });
      }
    }
    if (
      git(["rev-parse", `${journal.commit}^{tree}`]) !== journal.tree ||
      git(["rev-parse", `${journal.commit}^`]) !== journal.parent
    )
      throw new Error("Git publication journal integrity mismatch");
    const head = git(["rev-parse", "HEAD"]);
    if (head === journal.parent) {
      // Keep the user's shared index intact and refuse to replace staged bot edits.
      if (git(["diff", "--cached", "--name-only", "--", botPath]))
        throw new Error(
          "Unstage bot files before publication; unrelated staging is preserved",
        );
      git(["update-ref", "refs/heads/main", journal.commit, journal.parent]);
    } else {
      try {
        git(["merge-base", "--is-ancestor", journal.commit, "HEAD"]);
      } catch {
        throw new Error(
          "Main moved outside the recorded publication; reconcile before resume",
        );
      }
    }
    // On recovery the index may still contain the recorded parent tree. Never
    // overwrite newer staged edits, including edits made after publication.
    const stagedTree = git(["write-tree"]);
    const stagedBot = git(["ls-tree", stagedTree, "--", botPath]);
    const parentBot = git(["ls-tree", journal.parent, "--", botPath]);
    const committedBot = git(["ls-tree", journal.commit, "--", botPath]);
    if (stagedBot !== parentBot && stagedBot !== committedBot)
      throw new Error(
        "Bot staging changed after publication; reconcile before resume",
      );
    // Reset only the bot's index entries to the committed tree. Working files survive.
    git(["reset", "-q", journal.commit, "--", botPath]);
    await save(`${journalPath}.receipt.json`, {
      commit: journal.commit,
      requestIdentity: identity(request),
    });
    return { commit: journal.commit, journal: journalPath };
  } finally {
    if ((await readFile(lock, "utf8")) === token) await rm(lock);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const file = process.argv[2];
  if (!file)
    throw new Error(
      "Usage: node scripts/bot-improvement/commit-bot-version.ts REQUEST.json",
    );
  console.log(
    JSON.stringify(
      await commitBotVersion(JSON.parse(await readFile(file, "utf8"))),
    ),
  );
}
