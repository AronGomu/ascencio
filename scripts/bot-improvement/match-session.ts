/** Short session transactions and one long-lived dispatcher ownership lock per role. */
import { mkdir, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { controlSession } from "./control-session.ts";
import { prepareIteration } from "./prepare-iteration.ts";
import { withSessionLock } from "./session-lock.ts";
import type { RunnerSnapshot } from "./session-contract.ts";
export async function retrySession<T>(
  session: string,
  run: () => Promise<T>,
): Promise<T> {
  for (let n = 0; ; n++) {
    try {
      return await run();
    } catch (e) {
      const error = e as NodeJS.ErrnoException;
      if (
        error.code !== "EEXIST" ||
        error.path !==
          path.join(path.resolve(session), ".session-state.lock") ||
        n >= 500
      )
        throw e;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
}
export const sessionControl = (
  session: string,
  action: Parameters<typeof controlSession>[1],
) => retrySession(session, () => controlSession(session, action));
export const matchRunnerIdentity = "frozen-rust-match-pool/v1";
export interface MatchBinding {
  session: string;
  iteration: number;
  role: "control" | "candidate";
  runnerIdentity: string;
  executableIdentity: string;
  stopSource?: { path: string; acknowledged: string | null };
}
export async function bindMatches(options: {
  session: string;
  out: string;
  iteration?: number | undefined;
  role?: "control" | "candidate" | undefined;
  resume?: boolean | undefined;
}) {
  const session = path.resolve(options.session),
    output = path.resolve(options.out);
  const relative = path.relative(session, output);
  if (
    !relative ||
    relative.split(path.sep).includes("..") ||
    path.isAbsolute(relative)
  )
    throw new Error(
      "Match output must be inside its session for ledger evidence references",
    );
  const plan = await sessionControl(session, { action: "plan" });
  if (!plan.mayStart && !options.resume)
    throw new Error(
      `Session stopped: ${plan.stoppingReason}; use explicit session continuation where permitted`,
    );
  const iteration = options.iteration ?? plan.iteration;
  const role = options.role ?? "control";
  const lock = path.join(session, `.match-dispatch-${iteration}-${role}.lock`);
  await retrySession(session, () =>
    withSessionLock(session, () => mkdir(lock)),
  );
  try {
    const manifestPath = path.join(
      session,
      "iterations",
      `iteration-${String(iteration).padStart(4, "0")}`,
      "manifest.json",
    );
    let runnerIdentity = matchRunnerIdentity;
    try {
      runnerIdentity = JSON.parse(
        await readFile(manifestPath, "utf8"),
      ).runnerIdentity;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    const manifest = await retrySession(session, () =>
      prepareIteration({
        session,
        iteration,
        runnerIdentity,
      }),
    );
    const accepted: RunnerSnapshot = {
      schemaVersion: 1,
      path: manifest.accepted.path,
      bot: manifest.accepted.bot,
    };
    return {
      session,
      iteration,
      role,
      runnerIdentity,
      accepted,
      selfIdentity: manifest.self.identity,
      comparisonIdentity: manifest.comparisonIdentity,
      release: () =>
        retrySession(session, () =>
          withSessionLock(session, () =>
            rm(lock, { recursive: true, force: true }),
          ),
        ),
    };
  } catch (e) {
    await withSessionLock(session, () =>
      rm(lock, { recursive: true, force: true }),
    );
    throw e;
  }
}
