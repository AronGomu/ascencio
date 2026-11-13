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
- `eligible-reason`: supported loss pattern affecting at least one lost game, ranked by affected games.
- `baseline-results`: completed accepted version results against frozen opponents on the recorded match schedule.
- `paired-schedule`: recorded engine seeds, match/game identities and starting sides shared by accepted version and candidate evaluations.

## Overview

1. **Improvement run** — the full process, configured for up to 50 iterations by default.
    1. **Preparation** — resolve bots, freeze opponents and configure limits (workflow step 1).
    2. **Baseline evaluation** — evaluate the starting AI and save results and starting conditions (workflow step 2).
    3. **Candidate preparation** — analyze losses and cumulatively replay-validate fixes before each iteration (workflow step 3).
    4. **Iteration** — evaluate and decide on the combined candidate (workflow steps 4–5).
        1. **Candidate** — the accumulated replay-validated AI changes.
        2. **Evaluate** — test the candidate against frozen opponents.
            1. **Evaluation** — test one AI version over the configured matches per opponent, default 250.
                1. **Match** — four games covering starting-side rotation and sideboarding under the current evaluator contract.
                    1. **Game** — one duel ending in a win, loss or draw.
        3. **Decide** — promote the candidate to the accepted version if its weighted win rate improves; otherwise keep the current accepted version.
    5. **Finalization** — rank saved versions, export the accepted AI and summarize results after the iterations finish.
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

1. Resolve the implementation, bots and command template.
2. Find a compatible checkpoint, or run [generate-improvement-run-setup.ts](../../../scripts/bot-improvement/generate-improvement-run-setup.ts).
3. Validate the setup with evaluator and strategy checks.

### 2 — Generate or retrieve the baseline

1. Initialize the improvement run or resume a compatible checkpoint; complete missing baseline matches using the starting AI against frozen opponents.
2. Save the results and paired schedule; spawn a baseline loss-analysis agent using [loss-analysis-template.md](references/loss-analysis-template.md). Keep source logs for step 3.

### 3 — Prepare the next iteration’s candidate

1. Read the loss analysis. Starting with reason 1, implement its proposed rule in the target AI; keep previously validated rules.
2. Run [replay-game-decision.ts](../../../scripts/bot-improvement/replay-game-decision.ts) on that reason’s lost games, taking over at each recorded critical decision. Verify the rule changes the intended choice. Stop at the first verified loss-to-win conversion; mark the rule replay-validated, not yet promoted. Compare the accumulated script before and after this rule at the same takeover; a win already achieved by earlier rules does not validate the new rule.
3. If every associated loss is tried without a conversion, remove only the unvalidated rule and record why. Process every eligible reason in rank order, preserving earlier fixes; stop on execution failures or budget exhaustion.
4. Archive and validate the combined candidate; run [update-improvement-history.ts](../../../scripts/bot-improvement/update-improvement-history.ts). Record each rule’s outcome and replay reference; generate no `proposal.md`. Start the iteration only after every eligible reason is processed. If none validates, report no candidate.
5. Run [prune-improvement-iteration.ts](../../../scripts/bot-improvement/prune-improvement-iteration.ts) only after analysis delivery and replay review, unless the owner requests retaining logs. Preserve unresolved replay evidence.

### 4 — Evaluate the candidate

1. Skip candidate games for invalid or unchanged proposals; record why.
2. Run the evaluator to play the candidate’s configured matches against every frozen opponent on the saved paired schedule; reuse compatible accepted-version results.
3. Verify paired evidence and save both weighted win rates, percentage-point difference and resource usage. Mark incomplete or mismatched comparisons unassessable.

### 5 — Decide and continue

1. Apply the acceptance rule, save the decision and checkpoint, and update the history entry with its result, win-rate difference and a short factual reason.
2. Spawn a loss-analysis agent after each decision using [loss-analysis-template.md](references/loss-analysis-template.md). Retain game records until the next candidate’s replay validation is complete.
3. Return to step 3 before starting another iteration; build from the accepted version and reuse its compatible baseline. Retain rejected candidates’ fixes as history, not as accepted code.
4. Rank saved versions and export the accepted AI at separate review boundaries.

### 6 — Verify and deliver

1. Verify decisions, completed iterations, loss analyses, ranking and exports against evidence.
2. Generate the report and deliver artifact links, completion status and unresolved errors.
