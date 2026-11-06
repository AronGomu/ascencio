/** Persistent deck sessions; each bug diagnosis gets its own Sol 6.1 high session. */
import { previousSession, saveSession, type Session } from "./session.ts";
import { agentSandbox } from "./sandbox.ts";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { resolve, dirname, delimiter } from "node:path";
import { access, mkdir, readFile, realpath } from "node:fs/promises";
import { createInterface } from "node:readline";
const [model, effort] = process.argv.slice(2);
if (!model || !effort) throw new Error("Usage: codex-agent.ts MODEL EFFORT");
const workspace = process.cwd();
const state = process.env.BOT_AGENT_STATE;
if (!state) throw new Error("BOT_AGENT_STATE required");
let executable: string | undefined;
for (const directory of (process.env.PATH ?? "").split(delimiter)) {
  try {
    executable = await realpath(resolve(directory, "codex"));
    break;
  } catch {
    /* next PATH entry */
  }
}
if (!executable) throw new Error("Installed codex executable not found");
const binaryDirectory = dirname(executable);
const originalHome = process.env.CODEX_HOME ?? resolve(homedir(), ".codex");
const auth = resolve(originalHome, "auth.json");
await access(auth);
const runtime = resolve(state, "runtime");
await mkdir(runtime, { recursive: true });
const requestText = await readFile("request.json", "utf8");
const request = JSON.parse(requestText) as Record<string, unknown>;
const bug = request.kind === "bug_fix";
if (bug && (model !== "gpt-6.1-sol" || effort !== "high"))
  throw new Error("Bug fixes require exactly gpt-6.1-sol high");
const previous = await previousSession(state, model, effort);
let currentSession: Session | undefined;
let source = "";
let evidence = "";
if (!bug) {
  source = await readFile("strategy.mjs", "utf8");
  const index = JSON.parse(
    await readFile(String(request.evidence_index), "utf8"),
  ) as { path: string; games: unknown[] }[];
  // Full reports remain available by path. Inline the current first report so
  // apply_patch-only environments still have authentic decision evidence.
  const diagnostic = request.diagnostic as
    { results?: { run: string }[] } | undefined;
  const currentRun = diagnostic?.results?.[0]?.run;
  const current =
    index.find(
      (entry) => currentRun && entry.path.startsWith(currentRun + "/"),
    ) ?? index.at(-1);
  if (current)
    evidence = `REPORT PATH ${current.path}\n${(await readFile(current.path, "utf8")).slice(0, 96000)}`;
}
const prompt = `You are ${bug ? "the dedicated bug-fixing agent" : "the persistent improvement agent for this deck"}. Continue this same logical assignment across rounds. Current writable proposal directory is ${workspace}; use ABSOLUTE paths for apply_patch because the resumed session may remember an older cwd. Do not spawn subagents or request approval. Root filesystem is read-only except this directory and your session state. Write response.json at ${resolve(workspace, "response.json")}. Never fabricate test execution. Use apply_patch if shell helper is unavailable. Complete reports are accessible at the paths in the evidence index; the inline report may be truncated and only real complete decision entries may be cited. You may return no_change with a specific explanation when evidence is insufficient. Preserve lessons from rejected attempts, start code from the accepted incumbent below.\nREQUEST:\n${requestText}\nCURRENT STRATEGY:\n${source}\n${evidence}`;
const args = [
  "--no-daemon",
  "exec",
  "--cd",
  workspace,
  "--ignore-user-config",
  "--skip-git-repo-check",
  "--sandbox",
  "danger-full-access",
  "-c",
  'approval_policy="never"',
  "-m",
  model,
  "-c",
  `model_reasoning_effort=${JSON.stringify(effort)}`,
  "--json",
];
if (previous) args.push("resume", previous.session_id, "-");
else args.push("-");
const child = spawn(
  "bwrap",
  agentSandbox({
    workspace,
    runtime,
    originalHome,
    authentication: auth,
    binaryDirectory,
    executable,
    args,
  }),
  { stdio: ["pipe", "pipe", "inherit"] },
);
child.stdin.end(prompt);
let identityWritten = false;
const lines = createInterface({ input: child.stdout });
for await (const line of lines) {
  process.stdout.write(line + "\n");
  let event: {
    type?: string;
    thread_id?: string;
    usage?: Record<string, number>;
    message?: string;
    error?: { message?: string };
  };
  try {
    event = JSON.parse(line) as typeof event;
  } catch {
    continue;
  }
  if (event.type === "thread.started" && event.thread_id) {
    currentSession = {
      session_id: event.thread_id,
      model,
      effort,
      logical_agent_id: request.logical_agent_id ?? request.bug_id,
      previous_session_id: previous?.session_id ?? null,
    };
    await saveSession(state, currentSession);
    identityWritten = true;
  }
  if (event.type === "turn.completed" && event.usage && currentSession) {
    currentSession.usage = event.usage;
    await saveSession(state, currentSession);
  }
  if (["error", "turn.failed"].includes(event.type ?? "") && currentSession) {
    const message = event.error?.message ?? event.message ?? "";
    if (/context.*(exceed|limit|length)/i.test(message)) {
      currentSession.replace_reason = message;
      await saveSession(state, currentSession);
    }
  }
}

const code =
  child.exitCode ??
  (await new Promise<number | null>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", resolveExit);
  }));
if (code !== 0 || (!identityWritten && !previous)) process.exitCode = code || 1;
