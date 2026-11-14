---
name: ai-bot-self-improvement
description: Evaluate and improve one deck’s AI using reproducible paired matches against frozen opponents.
---

# AI bot self-improvement

## Goal

Produce an AI version with a higher paired-match win rate.

## Inputs

1. Required — `ai-bot`: target bot package folder.
2. Optional — `opponent-ai-bots`: additional opponent package folders; default None.

## Entities

- `project-root`: checkout containing the improvement run implementation.
- `run-guide`: project documentation defining improvement run commands, configuration and evidence contracts.
- `run-config`: pinned configuration for the target, opponents and experiment plan.
- `run-directory`: project-defined location for checkpoints, immutable bot versions and execution evidence.
- `accepted-version`: currently accepted target AI, initially the starting AI.
- `candidate`: proposed replacement containing the accumulated replay-validated rules.
- `eligible-reason`: supported loss pattern affecting at least 5 distinct lost games, ranked by affected games; omit smaller groups from the reason list and replay jobs.
- `baseline-results`: completed accepted version results against frozen opponents on the recorded match schedule.
- `paired-schedule`: recorded engine seeds, match/game identities and starting sides shared by accepted version and candidate evaluations.

## Version archive

- Commit an AI version on `main` only after its full iteration evaluation and decision, including rejected candidates. Record its full commit SHA, bot package path and outcome.
- Record each iteration's starting accepted version by its existing commit. Keep any uncommitted starting source as a temporary snapshot with a content hash until it qualifies for an iteration commit; never substitute branch HEAD for the recorded accepted version.
- Keep intermediate rule variants and unevaluated candidates in temporary storage with content hashes; create no Git commits for them. Preserve the accepted-version reference independently of rejected candidate commits.
- Retrieve source with `git show <sha>:<path>` or extract the package from that commit. Use Git references instead of archival source-directory copies; retain execution bundles and hashes required by the runner for reproducibility.
- Commit only intended bot changes and history; preserve unrelated work. Keep game logs, generated bundles and dependencies outside Git. Preserve commits without rewriting history; push only with authorization.

## Overview

1. **Improvement run** — the full process, configured for up to 50 iterations by default.
    1. **Preparation** — resolve bots, freeze opponents and configure limits (workflow step 1).
    2. **Baseline** — evaluate the starting AI in step 2, skip the candidate decision in step 3, then analyze and improve it in step 4.
    3. **Iteration** — repeat Evaluate → Decide → Analyze and improve (workflow steps 2–4).
        1. **Candidate** — one combined AI version containing the validated rule changes.
        2. **Evaluation** — test that version over the configured matches per frozen opponent, default 250.
            1. **Match** — four games covering starting-side rotation and sideboarding under the evaluator contract.
                1. **Game** — one duel ending in a win, loss or draw.
        3. **Decision** — promote the candidate if its weighted win rate improves; otherwise retain the accepted version.
        4. **Analysis and improvement** — analyze losses, test isolated rules in parallel and combine validated fixes into the next candidate.
    4. **Finalization** — rank saved versions, export the accepted AI and summarize results (workflow step 5).
2. **Supporting concepts**
    1. **AI version** — one saved implementation of the AI.
    2. **Frozen opponent** — an unchanged AI version used throughout the run, including the starting AI for self-play.
    3. **Baseline results** — saved evaluation results for the accepted version; retrieve the matching version’s results when the accepted version changes.
    4. **Paired starting conditions** — matching deck orders, engine seeds and starting sides for baseline/candidate comparisons.
    5. **Stage** — a workflow action, such as Propose, Evaluate or Decide; an evaluation is part of an iteration, not an entire iteration.
    6. **Stop conditions** — completion target and resource limits that bound the improvement run.

## Constraints

- Modify only the target AI; preserve decks, engine, legality and hidden-information boundaries.
- Always include the frozen starting AI as a self-play opponent.
- Generate JSON through scripts or runner commands; regenerate from changed inputs instead of editing outputs.
- Pair baseline/candidate games using identical starting deck orders, engine seeds, starting sides, rules and content. Orders may differ across matches; AI decisions and sideboarding may change game trajectories.
- Reuse baseline results only when inputs, settings, implementation, schedules and evidence integrity match. Record provenance and reused versus executed games.
- Promote only valid candidates with strictly higher weighted win rates. Retain the accepted version on ties, regressions or unassessable comparisons; calculate no confidence intervals.
- Pin comparison rules and implementation; preserve all attempts, evidence and consumed budgets.
- Publish or merge only with separate authorization.

## Stop Condition

Apply every limit; owner-supplied values override defaults before launch. Pin effective values in `run-config`. Resume preserves consumed budgets.

- **Iterations: 50.** Count persisted decisions; completion also requires loss analysis for each completed iteration, final ranking and exports.
- **Evaluation size: 250 matches per opponent.** Games per batch = matches × games per match; currently `250 × 4 = 1,000` per opponent. This sizes evaluations, not the loop.
- **Game ceiling: `(2 + 2 × iterations) × opponents × matches × games-per-match`.** Includes initial baseline, one candidate batch per iteration and ranking up to `iterations + 1` versions. Defaults with one opponent give 102,000 games. Reserve before execution; stop if the next reservation exceeds the ceiling. Failed/interrupted reservations count; cached/imported results add none. Budget diagnostic replays, extra ranking and recovery separately; count every control and takeover execution, including replayed prefixes.
- **Wall time: 24 hours (86,400,000 ms).** Measure from persisted start, including review pauses and interruptions; never reset on resume.
- **Output: 2 GB (2,000,000,000 bytes).** Use runner storage accounting, including attempts, logs and evidence. Record scope for external imported evidence; never delete evidence to continue.
- **Timeouts:** evaluation 30 minutes; proposal 10 minutes; each validation check 5 minutes. Measure launch-to-exit; cap each by remaining wall time.
- **Retries/repairs: 0.** Stop on the first failure. Explicitly enabled recovery requires declared attempts, timeout and extra game budget.
- **Review:** pause at authorized boundaries in step-by-step mode; continue only on explicit instruction.

Stop on completion, no replay-validated candidate, resource exhaustion, failure or owner cancellation. Report the reason and consumed/allowed amounts. Only completed planned work is successful; retain incomplete status otherwise.

## Autonomy

The conversation orchestrator implements AI changes; delegate only loss analysis. Use scripts for preparation, replay, archiving, validation, evaluation and decisions; bypass the automatic proposal launcher.

Resolve routine choices from project records. Ask for ambiguous bot identities, multiple matching checkpoints or missing required limits. Stop if the implementation cannot preserve Constraints.

At review boundaries, report results, artifacts and blockers; stop before dependent work. Reuse a matching writer rather than starting another.

Preserve command errors and evidence; apply only configured recovery. On cancellation, request graceful shutdown, allow 60 seconds, then terminate only the owned process group if necessary. Verify shutdown and require explicit continuation.

## Output

Store shared state in `run.json`, iteration decisions in `iterations/iteration-N/iteration.json`, evaluation receipts once, and each match’s games in `games/game-N/`. Reference owned records instead of copying them. Keep A/B views separate; `.log` and Markdown are for agents, structured records for code.

Read [match-log-template.md](references/match-log-template.md) before reviewing compact logs. Use actor-relative compact `.log` files for agent match review: card dictionary, one event/decision per line, selected/offered actions, decision IDs and results. Use linked per-game machine records for validation; XML is only an in-memory compatibility codec. Run [migrate-improvement-run.ts](../../../scripts/bot-improvement/migrate-improvement-run.ts) for verified migration and [generate-improvement-run-index.ts](../../../scripts/bot-improvement/generate-improvement-run-index.ts) for navigation.

Keep the bot’s `improvement-history.md` entirely in English, including status labels, changes and reasons. Keep one compact line per attempt across runs; mark replaced attempts `SUPERSEDED`, not pending or rejected. Include status, change, version/evidence links and final result. Preserve technical logs separately.

Save setup, frozen packages, checkpoints, schedules, matches, proposals, decisions and accounting in `run-directory`.

Deliver accepted exports and an orchestrator report with state, next stage, results, decisions, used/remaining budgets and evidence links. Use the project report location, or `artifacts/`. Distinguish completed games from reservations and diagnostics from comparisons/ranking.

Link the shared policy and pinned effective configuration in References. Do not copy global policy or add an overrides section; effective configuration remains authoritative.

## Workflow

Map these terms to the existing implementation without renaming its interfaces: improvement run = `campaign`, iteration = `round`, accepted version = `incumbent`. Preserve existing command names, configuration keys and artifact paths.

### 1 — Prepare the bots and improvement run

1. Resolve the implementation, bots and command template; use `main` and Version archive.
2. Find a compatible checkpoint, or run [generate-improvement-run-setup.ts](../../../scripts/bot-improvement/generate-improvement-run-setup.ts).
3. Validate the setup with evaluator and strategy checks.

### 2 — Evaluate

1. Initialize or resume a compatible improvement run. On the first pass, evaluate the starting AI to establish the baseline; later passes evaluate the final combined candidate. Record the source version using Version archive; stop for invalid or unchanged candidates.
2. Run the evaluator for the configured matches against every frozen opponent. Save the baseline's paired schedule and reuse it for candidates; retrieve compatible results or complete missing matches.
3. Verify evidence and save results, weighted win rates and resource usage. For candidates, also save the difference from the accepted version; mark incomplete or mismatched comparisons unassessable.

### 3 — Decide

1. For the initial baseline, record its accepted-version reference and continue to step 4 without counting an iteration decision.
2. For a candidate, apply the acceptance rule, save the decision and checkpoint, and update the history with the win-rate difference and a short reason. Commit the evaluated AI using Version archive and record its SHA; preserve the accepted-version reference on rejection.
3. Continue to step 4 for loss analysis, including after the last iteration decision.

### 4 — Analyze losses and prepare the next candidate

1. Spawn a loss-analysis agent for the evaluated version using [loss-analysis-template.md](references/loss-analysis-template.md); reuse compatible existing analysis. Bind every report to its source AI and evaluation. After delivery, check stop conditions before preparing another candidate; finish at step 5 when the run is complete.
2. Record the next iteration's accepted starting version using Version archive. Use that version's matching loss analysis; after rejection, reuse the accepted version's analysis rather than applying the rejected candidate's reasons to a different source AI. Prepare one immutable variant per eligible reason, containing only that reason's rule; use separate source and output directories.
3. Run reason jobs in parallel with [replay-game-decision.ts](../../../scripts/bot-improvement/replay-game-decision.ts). Replay every associated loss at its recorded critical decision, comparing the isolated variant against the accepted version. Retain a rule only after all its cases complete and it converts at least 5 losses and 5% of the reason's total associated losses into wins, with the intended choice changed. Earlier reason fixes do not enter validation.
4. Bound concurrent jobs by available resources and queue remaining reasons. Reserve shared budgets atomically before each replay. Exclude rules below either threshold; preserve their results. On failure or budget exhaustion, stop admission and settle active jobs while preserving evidence.
5. Wait for every reason job to finish. Combine all validated rules into one final candidate based on the accepted version; resolve overlapping edits while preserving each rule's behavior. Validate and freeze that version, then run [update-improvement-history.ts](../../../scripts/bot-improvement/update-improvement-history.ts) with included rules and replay references. Generate no `proposal.md`. If none validates, finish at step 5 with no candidate.
6. Run [prune-improvement-iteration.ts](../../../scripts/bot-improvement/prune-improvement-iteration.ts) only after analysis delivery and replay review, unless the owner requests retaining logs. Preserve unresolved replay evidence. Continue to step 2 with the final candidate for its full evaluation.

### 5 — Verify and deliver

1. Verify completed iterations, decisions and loss analyses against evidence; rank saved versions and export the accepted AI at the final review boundary.
2. Generate the report and deliver artifact links, completion status and unresolved errors.
