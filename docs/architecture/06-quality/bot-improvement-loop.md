# Bounded bot improvement loop

The `bot:improve` command runs one fixed deck through a reusable source-editing loop. It reuses the Rust evaluator and its four-game matches, shared bot validation, sideboarding, watchdogs and XML reports. It does not complete ARO2-3's multi-deck campaign, historical rankings or 100-round acceptance run, nor supply the dedicated Warrior Toolbox strategy from ARO2-11.

## Start a run

Requires Linux, bubblewrap (`bwrap`), Node 26+, the Rust toolchain, installed npm dependencies, and a verified evaluator content snapshot. Other evaluator commands remain available on their existing platforms. Run from the repository root.

Generate a self-contained initial generalist strategy:

```sh
node scripts/bot-improvement/prepare-strategy.ts generated/initial-strategy.mjs
npm run bot:improve -- --config /absolute/path/loop.json
npm run bot:improve -- --config /absolute/path/loop.json --resume
```

The loop configuration is JSON; evaluator configuration and all game evidence retain the existing versioned XML format. Paths for evaluation, initial strategy and output resolve relative to the loop configuration. Agent and check command arguments are literal argv entries; no shell expansion occurs. Checks run from the repository root. Use absolute paths in commands when needed.

```json
{
  "evaluation": "/absolute/path/evaluation.xml",
  "initial_strategy": "/absolute/path/initial-strategy.mjs",
  "output": "/absolute/path/new-run",
  "agent": ["/absolute/path/your-coding-agent-adapter"],
  "checks": [
    [
      "node",
      "--experimental-vm-modules",
      "scripts/bot-improvement/check-strategy.ts"
    ]
  ],
  "command_inputs": ["/absolute/path/your-adapter-dependencies"],
  "max_iterations": 20,
  "max_games": 60000,
  "max_no_improvement": 5,
  "development_matches": 250,
  "confirmation_matches": 500,
  "max_wall_ms": 86400000,
  "agent_timeout_ms": 600000,
  "check_timeout_ms": 120000,
  "evaluation_timeout_ms": 7200000,
  "max_bytes": 10000000000
}
```

These are explicit recommended limits, not hidden defaults. A smoke run uses one match in each phase, one or two iterations and a much smaller game budget. Evaluation uses the supplied fixed deck, rules, pinned content and per-game safeguards. The loop replaces evaluator bot references, match count and output directory; bot configuration is the empty object. Diagnostic starting-order fixtures are rejected: this first implementation uses fresh production shuffles.

## Agent protocol and isolation

The agent command runs in the attempt's `proposal/` directory. It receives `request.json`, the accepted `strategy.mjs`, current incumbent evidence and prior decisions. Its writable filesystem is that proposal directory plus temporary scratch space; the repository, archives and evaluation inputs are mounted read-only through bubblewrap. Network remains available for the configured coding service. This is write confinement, not a confidentiality sandbox for the coding agent. Bot runtime observations remain actor-relative and validated by the evaluator.

The adapter must run without interactive prompts, finish within its deadline, and write `response.json`:

```json
{
  "no_change": false,
  "diagnosis": "Describe the observed tactical weakness.",
  "evidence": [
    {
      "path": "/absolute/player-a.xml",
      "game_id": "match-000001-game-1",
      "decision_id": "a-decision-1"
    }
  ],
  "play_changes": "Describe the scoring change.",
  "sideboarding_changes": "Describe exchanges, or say unchanged.",
  "tests": "Describe any checks performed by the agent."
}
```

`no_change: true` with a diagnosis is valid. Agent-reported tests never replace trusted checks. Proposal references are checked against the supplied actor-relative reports: paths must belong to a supplied run, game IDs must exist, and any decision ID must exist in that game. A strategy exports `createStrategy({ cards })`, returning the existing generalist choice-scoring callback. It may also export `sideboard(input)`. Strategies are self-contained ECMAScript modules; imports are forbidden. Shared response construction, legality and repetition guards remain outside the editable strategy. The generated `bot.mjs` is an external evaluator package with a metadata-only `createBotModule({ cards })` factory. It returns the same `BotModule` contract used by `botAsOpponentPolicy` in the simulator; this command does not automatically install or select a bot in the UI.

Trusted check commands receive `BOT_STRATEGY` and `BOT_CANDIDATE`. The supplied check validates module syntax, import confinement and factory exports. Add deck-specific tactical regression checks to the configuration. Checks cannot be chosen or changed by the improvement agent. The built-in adapter/check directory, command executables and file arguments are fingerprinted. Declare all other transitive adapter/check inputs (files or directories) in `command_inputs`; use an empty array only for self-contained commands whose inputs are already included. Resume and phase boundaries reject changes to these bytes. Paths in `command_inputs` resolve relative to the loop configuration.

Adapters needing session databases or logs must put them within the proposal directory. For example, Codex supports explicit `sqlite_home` and `log_dir` configuration ([official configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)). Keep authentication in its existing read-only store; do not copy credentials into retained evidence. An optional adapter is included:

```json
"agent": ["node", "/absolute/repository/scripts/bot-improvement/codex-agent.ts", "YOUR_MODEL", "YOUR_REASONING_EFFORT"]
```

It uses the installed Codex CLI and existing file-backed login, a temporary Codex runtime mount, and an explicit model and effort. It supplies a bounded first-game report excerpt plus the current strategy and history directly to the agent, and uses patch editing because nested CLI shell-helper execution is unavailable in this environment. It neither installs a provider nor silently substitutes a model. The outer bubblewrap boundary remains enforced even though the inner CLI is configured to execute without further approval prompts.

## Evaluation and promotion

Each iteration first evaluates the accepted incumbent against itself to supply fresh diagnostic evidence. This symmetric self-play is never treated as proof of strength. A changed candidate then plays a fresh development batch directly against the frozen incumbent. Both starting positions and both pre/post-side stages occur in every four-game match. Only a positive development score qualifies for a separate, fresh confirmation batch. Batch sizes cannot grow adaptively.

For each completed match define `X = (candidate game wins - incumbent game wins) / 4`. Draws contribute zero and remain in the four-game denominator. The estimator is the mean of independent match clusters; games within a cluster may be dependent. The predeclared two-sided 95% Hoeffding interval has radius `sqrt(2 * ln(40) / n)` for `X` in `[-1, 1]`, clipped to that range. Promotion requires the un-clipped lower bound to exceed zero in confirmation. This conservative bound handles constant samples and small batches without a zero-variance false promotion. It measures superiority in this mirror matchup only; it is not ARO2-3's stratified multi-opponent promotion test or campaign-wide confidence.

Failed, interrupted or incomplete evidence stops the attempt; it is never scored as a loss or draw. Regressions, inconclusive results, identical packages and no-change responses retain the incumbent. Pre/post-side metrics, failures, decisions and starting orders remain in the referenced evaluator XML.

## Persistence, cancellation and limits

`configuration.json` pins inputs and runtime identity. `versions/<sha256>/` stores each distinct strategy and its trusted adapter. `state.json` atomically records baseline, incumbent, attempts, game reservations and decisions. Each attempt retains agent output, checks and every evaluator run. Promotion updates the incumbent, completed history and active-attempt marker together only after the evidence and decision are saved; persistence failures leave the incumbent unchanged. Completed attempt evidence is hashed and checked on resume. Rejected versions remain archived. Agent-created symlinks are retained and counted without following their targets; result files must be bounded regular files, so symlinks and FIFOs cannot block result parsing or subsequent attempts.

Games are reserved before each batch and never refunded after interruption. Wall time starts with the original run and includes downtime. A process lock prevents concurrent writers. Agent, checks and evaluator subprocess groups have deadlines and are killed on cancellation or limit exhaustion; the evaluator supplies its own game watchdog. Storage is checked periodically, so a short-lived writer can overshoot the configured threshold between checks. Evidence is never deleted to recover space.

Create `CANCEL` in the output directory or send SIGINT to stop. Remove `CANCEL` before resuming. Resume rejects configuration, runtime, initial package or content-manifest changes, preserves interrupted attempts and starts the next attempt from the incumbent. It does not silently rerun an interrupted batch or reset budgets. A changed runtime requires a new experiment. `completed` means an iteration or consecutive non-improvement limit was reached, not optimal play; failures and exhausted time/game/storage budgets produce `incomplete` with a reason and exit code 2. Configuration errors return 1. Clean completion returns 0.

## Validation

Use the repository's targeted test workflow. `test/tooling/bot-improvement.test.ts` runs real four-game evaluation and tests rejected proposals, immutable incumbents, completed-run resume, failed-agent recovery and changed-config refusal. Set `ARO2_ACCEPTANCE_SNAPSHOT` to a complete verified snapshot to enable it. Rust tests cover conservative confidence decisions, archive tamper detection and process-group watchdog/cancellation. Existing bot tests cover legal responses, hidden identities and simulator policy adaptation.
