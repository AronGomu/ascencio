/** Optional adapter; the loop itself is independent of coding-agent providers. */
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { access, readFile } from "node:fs/promises";
const [model, effort] = process.argv.slice(2);
if (!model || !effort)
  throw new Error("Usage: codex-agent.ts MODEL REASONING_EFFORT");
const workspace = process.cwd();
const stateDirectory = process.env.CODEX_HOME ?? resolve(homedir(), ".codex");
const authentication = resolve(stateDirectory, "auth.json");
await access(authentication);
const requestText = await readFile(resolve(workspace, "request.json"), "utf8");
const request = JSON.parse(requestText) as { evidence: { run: string } };
const strategy = await readFile(resolve(workspace, "strategy.mjs"), "utf8");
const reportPath = resolve(
  request.evidence.run,
  "matches/match-000001/player-a.xml",
);
const excerpt = (await readFile(reportPath, "utf8")).slice(0, 64000);
const prompt = `You are the coding agent in a bounded bot improvement loop. All inputs needed for one small proposal are below. Use apply_patch to edit strategy.mjs and write response.json in the current directory. Do not use shell tools, whose helper execution is unavailable in this nested sandbox. Do not spawn subagents. Trusted checks and real-engine evaluation run after your response. A no-change diagnosis is valid. Never modify legality, deck lists, runtime, or request.json. Response must have no_change (boolean), diagnosis (nonempty string), evidence (array of path/game_id/decision_id objects), play_changes, sideboarding_changes and tests. Cite only decisions actually present in this possibly truncated excerpt; do not invent test results.
REQUEST:
${requestText}
CURRENT STRATEGY:
${strategy}
EVIDENCE (${reportPath}, first 64000 characters):
${excerpt}`;
// An ephemeral mount permits CLI runtime state without writing the owner's
// configuration or copying credentials into retained campaign evidence.
const child = spawn(
  "bwrap",
  [
    "--die-with-parent",
    "--ro-bind",
    "/",
    "/",
    "--bind",
    workspace,
    workspace,
    "--tmpfs",
    stateDirectory,
    "--ro-bind",
    authentication,
    authentication,
    "--tmpfs",
    "/tmp",
    "--",
    "codex",
    "--no-daemon",
    "exec",
    "--ignore-user-config",
    "--skip-git-repo-check",
    "--ephemeral",
    "--sandbox",
    "danger-full-access",
    "-c",
    'approval_policy="never"',
    "-m",
    model,
    "-c",
    `model_reasoning_effort=${JSON.stringify(effort)}`,
    "-",
  ],
  { stdio: ["pipe", "inherit", "inherit"] },
);
child.stdin?.end(prompt);
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
