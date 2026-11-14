import type { ReplayWriteGrant } from "./replay-output-budget.ts";
/** One isolated CLI process per case; its engine children share an owned process group. */
import { spawn } from "node:child_process";
import path from "node:path";
import type { PreparedReplayCase } from "./replay-pool-contract.ts";
export async function replayProcess(
  job: PreparedReplayCase,
  out: string,
  timeoutMs: number,
  signal: AbortSignal,
  grant?: ReplayWriteGrant,
) {
  const child = spawn(
    process.execPath,
    [
      "--experimental-vm-modules",
      "--disable-warning=ExperimentalWarning",
      path.resolve("scripts/bot-improvement/replay-game-decision.ts"),
      "--game",
      job.game,
      "--actor",
      job.actor,
      "--decision",
      job.decision,
      "--pairing",
      job.pairing,
      "--bot",
      job.replacement,
      "--out",
      out,
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...(grant ? { ARO2_REPLAY_WRITE_BUDGET: JSON.stringify(grant) } : {}),
      },
      detached: process.platform !== "win32",
    },
  );
  let text = "",
    timedOut = false,
    killer: ReturnType<typeof setTimeout> | undefined;
  const capture = (b: Buffer) => {
    text = (text + b.toString()).slice(-65536);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  const kill = (kind: NodeJS.Signals) => {
    try {
      if (process.platform !== "win32" && child.pid)
        process.kill(-child.pid, kind);
      else child.kill(kind);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e;
    }
  };
  const stop = () => {
    kill("SIGTERM");
    killer ??= setTimeout(() => kill("SIGKILL"), 2000);
  };
  const timeout = setTimeout(() => {
    timedOut = true;
    stop();
  }, timeoutMs);
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) stop();
  let code: number | null;
  try {
    code = await new Promise<number | null>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", resolve);
    });
  } finally {
    clearTimeout(timeout);
    if (killer) clearTimeout(killer);
    signal.removeEventListener("abort", stop);
    kill("SIGKILL");
  }
  return { code, text, timedOut, cancelled: signal.aborted };
}
