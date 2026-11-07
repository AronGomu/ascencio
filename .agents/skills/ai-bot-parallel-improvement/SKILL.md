---
name: ai-bot-parallel-improvement
description: Improve heuristics through parallel matches and evidence-based agent reports.
---

# AI bot parallel improvement

## Goal

Improve one bot through repeatable evaluations, match analysis, and one heuristic change per iteration.

## Inputs

1. Required `ai-bot`: bot folder, associated deck, and configuration.
2. Required `opponents`: fixed bot folders with decks and configurations; may be empty.
3. Required `stop-condition`: iteration limit, resource budget, or owner stop.
4. Required `setup-seed`: explicit deterministic seed.
5. Optional `match-workers`: simultaneous matches (default: 6).
6. Optional `analysis-workers`: simultaneous match analysts (default: 3).
7. Optional `reuse-fixtures`: existing frozen directory (default: None).
8. Optional `session-path`: fresh session destination (default: `.tmp/bot-session`).

## Outputs

```text
<ai-bot>/evaluation/fixtures/<identity>/ # Durable frozen inputs and manifest
<project-root>/.tmp/<session>/
├── config.json               # Durable fixture reference and resolved limits
├── versions/                 # Candidate and accepted strategy references
├── iterations/<iteration>/
│   ├── manifest.json        # Prepared bindings and baseline execution plan
│   ├── matches/              # Complete engine evidence
│   ├── analyses/             # One analyst report per match
│   ├── synthesis.md          # Findings and heuristic recommendations
│   └── decision.md           # Acceptance decision and next proposal
├── state.json                # Accepted reference
├── control.json              # Stop reason and execution accounting
└── report.json               # Factual report
<project-root>/artifacts/
└── AI-BOT-PARALLEL-IMPROVEMENT-REPORT.md
```

## Constraints

- Change only the target bot's heuristics; preserve decks, engine, legality, and hidden-information boundaries.
- Freeze supplied opponents for the session and the accepted self-opponent for each iteration.
- Run 500 matches, each containing four games, per candidate evaluation; distribute matches evenly across supplied opponents plus the accepted self-opponent, with a stable remainder assignment.
- Reuse locked seeds and exact deck orders across evaluations; cover subsequent engine and bot randomness as well as starting hands.
- Parallelize independent matches; keep games and sideboarding within each match sequential.
- Preserve evidence for accepted, rejected, failed, and interrupted iterations.
- Use Luna 6.0 at low effort for match analysis and Sol 6.1 at low effort for synthesis; stop if the requested models are unavailable.
- Ground every finding in match, game, and event references; distinguish observed effects from uncertain causal judgments.

## Workflow

You are the main improvement orchestrator.

### 1. Freeze the setup

- `setup-result` = Run `npm run bot:setup -- --target <ai-bot> --seed <setup-seed> --session <session-path>` with `--opponent` for each `opponents` item and the stop, worker, and optional reuse flags from [the setup contract](../../../docs/architecture/06-quality/parallel-bot-session.md).
- If setup fails: Stop with the script error.
- `session`, `session-config` = Read `session` and `config` from `setup-result`.
- `accepted-bot` = Read `accepted` from `session-config`.
- `matches-command` = Resolve the documented fixture-aware evaluator entry point.
- Require: `matches-command` consumes the versioned session contract; otherwise stop with the missing runner capability.
- `runner-identity` = Resolve the runner version covering its execution semantics.
- `baseline-receipt` = None.
- `iteration-number` = 1.
- Returns: `session`, `accepted-bot`, `matches-command`, `runner-identity`, `baseline-receipt`, `iteration-number`.

### 2. Improve and evaluate

- For an existing `session`: Require explicit continuation before running `npm run bot:session -- <session> <continue-request>` with `action: "continue"` and the returned owner-stop token when required.
- Require: `matches-command` implements [reservation, settlement and cancellation](../../../docs/architecture/06-quality/parallel-bot-session.md#minimum-runner-interface-for-aro2-18).
- While `stop-condition` is unmet:
  - `session-plan` = Run `npm run bot:session -- <session> <plan-request>` with `{ "action": "plan" }` in `plan-request`.
  - If `session-plan.mayStart` is false: Break.
  - `iteration-number` = Read `session-plan.iteration`.
  - Run `npm run bot:session -- <session> <start-request>` with `{ "action": "start", "iteration": <iteration-number> }` in `start-request`.
  - Require: The returned plan permits work.
  - `iteration-result` = Run `npm run bot:prepare-iteration -- --session <session> --iteration <iteration-number> --runner-identity <runner-identity>` with `--baseline <baseline-receipt>` when present.
  - If preparation fails: Stop with the script error.
  - `iteration-manifest` = Read the JSON file at `iteration-result.manifest`.
  - If `iteration-result.plan.control` is `evaluate`: Run `matches-command` for `iteration-manifest.control` using its fixture and opponent bindings; save `baseline-receipt` using [the receipt contract](../../../docs/architecture/06-quality/parallel-bot-session.md#iteration-preparation).
  - `proposal` = Choose one heuristic change with the strongest expected win-rate benefit, using available evidence.
  - `candidate` = Implement `proposal` in `iteration-manifest.candidate.path`; validate against `accepted-bot` and record its rationale and executable identity.
  - In parallel:
    - `evaluation` = Run `matches-command` with `candidate`, frozen opponents plus the self-opponent, fixtures, and `match-workers`.
    - Whenever a completed match becomes available: Assign it to a Luna match analyst, bounded by `analysis-workers`.
  - Require: All 500 matches and their analyst reports are settled; otherwise preserve progress and stop with the incomplete evaluation reason.
  - `synthesis` = Assign a fresh Sol synthesis agent all analyst reports, aggregate results, `baseline-receipt`, and `proposal`.
  - `decision` = Accept or reject `candidate` using paired results, uncertainty, observed heuristic effects, and validity; retain `accepted-bot` when inconclusive.
  - Save `decision`, its evidence, and the next heuristic candidates.
  - Index durable proposal, comparison and decision artifacts with `npm run bot:session -- <session> <record-request>` using the documented `record` action.
  - Run `npm run bot:session -- <session> <finish-request>` using `finish` with the iteration status and checkpoint evidence after all runner attempts settle.
  - If accepted: Set `accepted-bot` to `candidate`; publish its `frozen-bot.json` and update `state.accepted`.
  - Increment `iteration-number`.
- Returns: `accepted-bot`, iteration evidence, and stopping reason.

### 3. Stop and report

- On owner stop or interruption: Run `npm run bot:session -- <session> <stop-request>` with `action: "stop"` and the corresponding reason from [the control contract](../../../docs/architecture/06-quality/parallel-bot-session.md#orchestrator-transitions).
- Stop dispatching work when plan returns a stop reason.
- Settle/cancel every running attempt through `matches-command`; preserve interrupted checkpoints.
- `report-result` = Run `npm run bot:session -- <session> <report-request>` with `{ "action": "report" }` in `report-request`.
- Keep agent interpretation separate from `report-result.report`.
- Returns: `report-result.report`, `accepted-bot`.

## Agent assignments

- `match-analyst`: Read one match's complete logs and `proposal`; return one report assessing heuristic activation, changed decisions, and positive, negative, or uncertain impact, followed by factual consequential plays without strategic judgments. Mark unavailable evidence explicitly.
- `synthesis-agent`: Read all match reports and aggregate candidate/baseline results; return recurring facts, keep/reject advice with uncertainty, and ranked heuristic proposals supported by evidence.
