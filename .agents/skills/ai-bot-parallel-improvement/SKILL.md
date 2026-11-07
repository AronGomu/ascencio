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
├── versions/<iteration>/     # Immutable decision journal and validation archive
├── iterations/<iteration>/
│   ├── manifest.json        # Prepared bindings and baseline execution plan
│   ├── matches/              # Complete engine evidence
│   ├── analyses/             # One analyst report per match
│   ├── synthesis.md          # Findings and heuristic recommendations
│   └── decision.md           # Agent rationale and next proposal
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
- `matches-command` = `npm run bot:matches -- --session <session> --iteration <iteration-number> --role control|candidate --out <session>/evaluations/<unique-output> --workers auto`.
- Pass `--candidate SNAPSHOT.json` and optional `--self SNAPSHOT.json` for explicit archived overrides using `RunnerSnapshot`; the prepared accepted archive is the default.
- `runner-identity` = `frozen-rust-match-pool/v1` for newly prepared iterations.
- For local tuning: Run `npm run bot:matches:benchmark -- --session <session> --out <session>/benchmarks/<unique-run> --matches 24 --repeats 1`; allow eight match workers; each stage uses fresh accounting state.
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
  - Implement `proposal` in `iteration-manifest.candidate.path`.
  - `validation` = Run `npm run bot:validate -- <validation-request.json>` with `iteration-manifest.fixture`, `iteration-manifest.accepted`, `iteration-manifest.candidate.path`, and a fresh output path using [the validation contract](../../../docs/architecture/06-quality/parallel-bot-session.md#candidate-validation-aro2-21).
  - If `validation.status` is `invalid`: Preserve `validation.evidence` and stop with `validation.reasons`.
  - `candidate` = Read `validation.candidate`; record the proposal rationale.
  - In parallel:
    - `evaluation` = Run `matches-command` with `candidate`, frozen opponents plus the self-opponent, fixtures, and `match-workers`.
    - Whenever a match finalizes: Run `npm run bot:analyses -- <session> <analysis-sync-request>` using the [analysis binding contract](../../../docs/architecture/06-quality/parallel-bot-session.md#match-analysis-jobs-aro2-22) and pinned `proposal`/runner job references.
    - For each available analyst slot: Run `npm run bot:analyses -- <session> <analysis-claim-request>` with `action: "claim"`, iteration, role, and a stable dispatch owner; assign the returned packet to `match-analyst` only when `claim` is non-null.
    - Whenever an analyst returns: Run `npm run bot:analyses -- <session> <analysis-complete-request>` with `action: "complete"`, job, claim token and report reference; preserve validation failures for correction under the same claim.
  - `aggregate-result` = Run `npm run bot:aggregate -- <aggregation-request.json>` using [the aggregation contract](../../../docs/architecture/06-quality/parallel-bot-session.md#candidatecontrol-aggregation-aro2-23).
  - Require: `aggregate-result.completeness.synthesisReady` is true; otherwise preserve the result and stop with its incomplete evidence counts.
  - `aggregate-results` = Read the JSON file at `aggregate-result.result`.
  - `synthesis` = Assign a fresh Sol synthesis agent all analyst reports, `aggregate-results`, `baseline-receipt`, and `proposal`.
  - `decision` = Accept or reject `candidate` using paired results, uncertainty, observed heuristic effects, and validity; retain `accepted-bot` when inconclusive.
  - Save the rationale, evidence references, and next heuristic candidates.
  - Index proposal and comparison artifacts with `npm run bot:session -- <session> <record-request>` using the documented `record` action.
  - `finish-result` = Run `npm run bot:session -- <session> <finish-request.json>` with action `finish`, `iteration-number`, status `complete`, and the saved decision rationale's hashed session-relative path.
  - If finishing fails: Stop with the script error.
  - `decision-request` = Write [CandidateDecisionRequest](../../../scripts/bot-improvement/decision-contract.ts) with `session`, the SHA-256 pins of `iteration-result.manifest` and `validation.evidence/result.json`, `candidate.bot.identity`, `decision`, rationale and hashed evidence paths.
  - `decision-result` = Run `npm run bot:decide -- <decision-request.json>` using [the decision contract](../../../docs/architecture/06-quality/parallel-bot-session.md#candidate-decisions).
  - If the command fails: Preserve evidence and stop with the script error; replay the same request after resolving an interruption.
  - Run `npm run bot:session -- <session> <record-request.json>` with action `record`, the completed iteration number, kind `decision`, and the hashed session-relative `decision-result.archive/outcome.json` path.
  - If recording fails: Preserve the decision and stop with the script error.
  - `accepted-bot`, `iteration-number` = Read `accepted` and `nextIteration` from `decision-result`.
- Returns: `accepted-bot`, iteration evidence, and stopping reason.

### 3. Stop and report

- On owner stop or interruption: Run `npm run bot:session -- <session> <stop-request>` with `action: "stop"` and the corresponding reason from [the control contract](../../../docs/architecture/06-quality/parallel-bot-session.md#orchestrator-transitions).
- Stop dispatching work when plan returns a stop reason.
- Settle/cancel every running attempt through `matches-command`; preserve interrupted checkpoints.
- Release analysis claims with `bot:analyses` only after confirming analyst termination; preserve claim tokens and completed reports across continuation.
- `report-result` = Run `npm run bot:session -- <session> <report-request>` with `{ "action": "report" }` in `report-request`.
- Keep agent interpretation separate from `report-result.report`.
- Returns: `report-result.report`, `accepted-bot`.

## Agent assignments

- `match-analyst`: Read the claimed packet, its pinned logs and proposal; return the [four-section JSON report](../../../docs/architecture/06-quality/parallel-bot-session.md#match-analysis-jobs-aro2-22) with actual event tuples and explicit unavailable evidence.
- `synthesis-agent`: Read all match reports and aggregate candidate/baseline results; return recurring facts, keep/reject advice with uncertainty, and ranked heuristic proposals supported by evidence.
