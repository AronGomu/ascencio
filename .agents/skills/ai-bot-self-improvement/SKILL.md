---
name: ai-bot-self-improvement
description: Orchestrate measured strategy experiments against specified opponents.
---

# AI bot self-improvement

## Goal

Orchestrate the complete improvement process for a given deck's AI, from initial assessment through repeated proposals, evaluation, selection, and reporting.

## Inputs

1. Required `ai-bot` folder path : AI bot to improve.
2. Required `opponent-ai-bots` list folder paths : AI bots to test against.

## Outputs

```text
<project-root>/.tmp/<ai-bot-name>-improvement-session-<session-id>/
├── configuration.json          # Resolved experiment and resource limits
├── state.json                  # Progress, decisions, and reservations
├── evaluations/                # Game evidence
├── proposals/                  # Suggested changes and checks
├── versions/                   # Strategy archive
├── recovery/                   # Failure diagnosis and repairs, when needed
├── final/                      # Accepted strategy exports, after completion
└── report.md                   # Supervisor report
<project-root>/artifacts/
└── IMPROVEMENT-REPORT-<AI-BOT-NAME-IN-CAPSLOCK>-AI-BOT.md
```

## Constraints

- Improve only `ai-bot`; retain the supplied opponents as evaluation opponents.
- Keep decks, hidden-information filtering, legality, validation, and frozen engine files outside strategy changes.
- Preserve failed, interrupted, rejected, and accepted evidence and consumed budgets.
- Keep the declared comparison protocol and pinned implementation unchanged during a campaign.
- Require explicit continuation after an owner stop.
- Treat publication and merging as separate actions requiring their own authorization.
- Stop with the named command error when execution fails unless the supervisor provides bounded recovery.

## Workflow

You are the improvement orchestrator.

### 1. Resolve the bots and implementation

- `project-root` = Locate the project from the invocation directory.
- `campaign-guide` = Resolve `docs/architecture/06-quality/bot-campaign.md` in `project-root`.
- If `campaign-guide` is absent: Locate an existing implementation checkout and resolve `project-root` and `campaign-guide` there.
- If no implementation checkout exists: Stop with `campaign implementation unavailable`.
- Read `campaign-guide` and the relevant command usage under `scripts/bot-campaign/`.
- `resolved-ai-bot` = Resolve the deck and strategy identified by `ai-bot` from project records.
- `resolved-opponents` = Resolve the decks and strategies identified by `opponent-ai-bots` from project records.
- If a bot identity is ambiguous: Request clarification of that bot identity.
- Require `resolved-opponents` contains at least one eligible nonidentical opponent.
- Returns: `project-root`, `campaign-guide`, `resolved-ai-bot`, `resolved-opponents`.

### 2. Establish the campaign

- `existing-campaign` = Find a checkpoint matching `resolved-ai-bot` and `resolved-opponents`, or None.
- If multiple checkpoints match: Stop with `ambiguous campaign history`.
- If `existing-campaign` records an owner stop without subsequent continuation authorization: Stop with `campaign stopped by owner`.
- `experiment-plan` = Resolve rounds, resource ceilings, and comparison precision from the matching checkpoint or documented project defaults.
- If required settings have no documented defaults: Stop with `campaign defaults unavailable`.
- `precision-assessment` = Calculate the expected uncertainty and games per comparison under `experiment-plan`.
- If expected uncertainty exceeds the intended detectable gain: Stop with `evaluation plan cannot resolve the intended gain`.
- `campaign-config` = Prepare or reuse the documented campaign configuration with `resolved-ai-bot`, `resolved-opponents`, and `experiment-plan`.
- Configure proposal generation only for `resolved-ai-bot`.
- If the available tools cannot retain the supplied opponents while improving only the target: Stop with `target-only improvement unsupported`.
- `campaign-directory` = Read the output location from `campaign-config`.
- Record `precision-assessment`, source revision, configuration identity, and executable identity beside `campaign-directory`.
- Returns: `campaign-config`, `campaign-directory`, `experiment-plan`.

### 3. Orchestrate the improvement loop

- `writer-state` = Inspect the checkpoint, cancellation marker, campaign lock, and processes associated with `campaign-directory`.
- If a matching writer is running:
  - `campaign-process` = Select the existing writer.
- Else:
  - `campaign-command` = Select the documented `bot:campaign` invocation with `campaign-config` and the resume flag when `existing-campaign` exists.
  - `campaign-process` = Run `campaign-command` from `project-root`.
- Monitor `campaign-process` until all planned rounds settle, a declared resource ceiling is reached, or the supervisor reports cancellation or failure.
- Let the supervisor sequence diagnostics, evidence-based proposals, fresh candidate/control comparisons, promotion decisions, and scheduled ranking.
- Let the supervisor preserve the accepted strategy when a proposal is inconclusive, invalid, or unassessable.
- Let the supervisor perform only its configured bounded retries and permitted recovery.
- Whenever the owner requests a stop:
  - Create `CANCEL` in `campaign-directory`.
  - `stop-deadline` = Current time plus 60 seconds.
  - While campaign processes remain and current time is before `stop-deadline`: Wait briefly and inspect process ownership.
  - If campaign processes remain: Identify and terminate only the campaign process group.
  - If a campaign writer remains: Stop with `campaign termination unverified`.
- `campaign-status` = Read the settled process status and checkpoint.
- If `campaign-status` is incomplete: Preserve the stop reason without automatically extending budgets or restarting.
- Returns: `campaign-status`.

### 4. Report the complete process

- `campaign-evidence` = Read the checkpoint, completed decisions, direct comparisons, rankings, and failures in `campaign-directory`.
- `proposal-results` = Collect each proposal's intent, candidate/control game counts, both win rates, difference in percentage points, recorded confidence interval, and decision.
- Count completed games separately from reservations and separate direct verification, diagnostics, and ranking games.
- Label missing support as unassessable and uncertainty spanning zero as inconclusive.
- `completion-status` = Verify the planned rounds, final decisions, required ranking, and accepted strategy exports against `campaign-evidence`.
- `plain-language-report` = Write `plain-language-report.md` beside `campaign-directory` using `proposal-results`, `campaign-status`, and `completion-status`.
- Include the target bot, opponents, starting strategy, attempted changes, accepted changes, round counts, interruptions, resource use, and evidence locations in `plain-language-report`.
- Explain wide uncertainty and unfinished scope explicitly.
- Returns: `campaign-directory`, `plain-language-report`, `completion-status`.
