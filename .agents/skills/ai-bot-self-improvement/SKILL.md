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
3. Match concurrency — always use the saved machine-local optimal settings; if absent or stale for this environment, calibrate, save and use them before evaluation.
4. Loss-analysis concurrency — one subagent per consecutive 250-match slice after evaluation; derive `analysis-workers` as `ceil(total-matches / 250)` (10 for 2,500 matches). Launch the slice analysts in parallel, subject only to the runtime’s available agent slots; queue remaining slices without changing their ownership or size.

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

- Before baseline evaluation, require a commit containing the exact starting bot source. Reuse an existing matching commit; otherwise commit the starting version on `main`. This initial commit is the exception to the evaluated-candidate rule below.
- Commit each candidate AI version on `main` after its full iteration evaluation and decision, including rejected candidates. Record its full commit SHA, bot package path and outcome.
- Record each iteration's starting accepted version by its existing commit; never substitute branch HEAD for that reference.
- Format every new bot-version commit subject as `ai-bot(<bot-id>): version <version-id> | run <run-id> | <initial|accepted|rejected>`. Use the package's stable ID, a unique immutable version ID and the run ID. Include body trailers `AI-Bot`, `AI-Version`, `AI-Run`, `AI-Outcome`, `AI-Path` and `AI-Parent-Version` (use `none` for the initial version). Reuse the same bot/version identifiers in any related follow-up commit. Search with `git log --all --fixed-strings --grep='AI-Version: <version-id>' --grep='AI-Bot: <bot-id>' --all-match`; existing matching source commits need no history rewrite.
- Keep intermediate rule variants and unevaluated candidates in temporary storage with content hashes; create no Git commits for them. Preserve the accepted-version reference independently of rejected candidate commits.
- Retrieve source with `git show <sha>:<path>` or extract the package from that commit. Use Git references instead of archival source-directory copies; retain execution bundles and detailed evidence only while required for active validation or resumable work; keep source hashes in the run summary.
- Commit only intended bot changes and history; preserve unrelated work. Keep game logs, generated bundles and dependencies outside Git. Preserve commits without rewriting history; push only with authorization.

## Overview

1. **Improvement run** — the full process, configured for up to 50 iterations by default.
    1. **Preparation** — resolve bots, freeze opponents and configure limits (workflow step 1).
    2. **Baseline** — evaluate the starting AI in step 2, skip the candidate decision in step 3, then analyze and improve it in step 4.
    3. **Iteration** — repeat Evaluate → Decide → Analyze and improve (workflow steps 2–4).
        1. **Candidate** — one combined AI version containing the validated rule changes.
        2. **Evaluation** — test that version over the configured matches, default 2,500 total across all frozen opponents.
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
- Parallelize independent matches with the saved optimal match-worker setting; keep games and sideboarding within each match sequential. Derive engine and bot randomness from stable match/game identities so worker scheduling cannot change results.
- Reuse baseline results only when inputs, settings, implementation, schedules and evidence integrity match. Record provenance and reused versus executed games.
- Score individual games, not four-game matches. For each opponent, win rate = wins / completed non-ignored games; draws stay in the denominator and count as zero wins. Weight opponents equally; weighted rate = sum(weight × opponent rate) / sum(weights). Compare only the intersection of completed paired baseline/candidate games, excluding either side’s timed-out game from both rates. Report ignored counts and paired coverage; no completed pairs for any scheduled opponent makes the comparison unassessable.
- Promote only valid candidates with strictly higher weighted win rates. Retain the accepted version on ties, regressions or unassessable comparisons; calculate no confidence intervals.
- Pin comparison rules and implementation; preserve compact run-level summaries of every attempt, decision and resource usage. Detailed evidence is temporary under Output retention rules.
- Publish or merge only with separate authorization.

## Stop Condition

Apply every limit; owner-supplied values override defaults before launch. Pin effective values in `run-config`. Resume preserves consumed budgets.

- **Iterations: 50.** Count persisted decisions; completion also requires loss analysis for each completed iteration, final ranking and exports.
- **Evaluation size: 2,500 matches total.** Include the frozen starting AI and all selected opponent decks. Allocate by stable round robin: each receives floor(total / opponents), with one extra for the first total % opponents slots. Counts differ by at most one; freeze the order and schedule. Require at least one match per opponent. Four games per match give 10,000 scheduled games per evaluation, independent of opponent count.
- **Game ceiling:** let `planned-games = (1 + iterations) × total-matches × games-per-match`. Automatically authorize up to `floor(planned-games × 0.10)` additional evaluation games for recovery; pin the planned count, recovery allowance and their sum before launch. Defaults give 510,000 planned games plus 51,000 recovery games, for a 561,000-game ceiling. Recovery may reuse verified completed games and re-execute interrupted games within this allowance without another approval request. Reserve before execution; every failed/interrupted reservation and recovery execution counts, while cached results add none. Once the recovery allowance is exhausted, mark the remaining interrupted games ignored and continue eligible work; exclude an ignored game from both sides of a paired comparison and report its reason and coverage. Never count ignored games as losses, draws or replay conversions. Keep recovery usage separate from planned execution. Rank from existing results. Reason-validation replays have no game-count quota: replay all associated losses and count control/takeover executions separately.
- **Wall time: 24 hours (86,400,000 ms).** Measure from persisted `startedAt`, including suspended intervals and interruptions; never reset on resume. Legacy ledgers without a start timestamp anchor it once from their known consumed time, without inventing unknown historical downtime.
- **Output: 50 GB (50,000,000,000 bytes).** Enforce `stop.maxBytes` (default 50 GB) across the run directory using the shared Node/Rust output-storage gate, including attempts, logs and evidence. Always pass `stop.maxBytes: 50000000000` explicitly at setup, even when older runner implementations have a lower fallback. When increasing storage during an active writer transaction, persist the full authorized continuation request first, apply the shared output-storage gate configuration under its writer lock, then commit the controller continuation as soon as the session lock is released; preserve the original setup and all consumed budgets. Count logical file bytes, including temporary staging copies. Data admission leaves 16 MB of free headroom; control checkpoints/reports may use that headroom up to the total cap. A quota rejection persists a suspension marker and blocks further data writes until explicit continuation. Include temporary active evidence and record the scope of external imports. Prune completed, no-longer-needed details under Output retention rules; never discard evidence still needed for validation or resume merely to fit the limit.
- **Timeouts:** evaluation up to 5 hours (18,000,000 ms), automatically authorized; candidate preparation 10 minutes; each validation check 5 minutes; each individual replay control or takeover execution 5 minutes, including its prefix. An individual game/replay timeout is a nonfatal execution incident: write a bug report, mark the game ignored and continue remaining games/jobs without retrying it. It is neither a gameplay loss nor a successful rule validation. A sideboarding or initialization failure remains a failure because later games cannot safely use that state. Measure launch-to-exit; cap each by remaining wall time. For existing runs pinned below 5 hours, apply this evaluation allowance without another approval request; record the budget transition while preserving frozen gameplay inputs, verified completed evidence and consumed time.
- **Retries/repairs:** automatically recover interrupted evaluation execution within the 10% recovery allowance above, recording each attempt and its timeout. Preserve completed evidence and the original wall-clock start; each recovery attempt remains subject to the evaluation timeout, remaining wall time and storage limits. Beyond that allowance, ignore interrupted games as specified above. Individual game timeouts remain ignored without retry. Stop on other non-timeout failures; initialization, sideboarding, integrity and validation failures are not ignored games. Replay recovery has no automatic retry allowance.

Stop on completion, no replay-validated candidate, resource exhaustion, failure or owner cancellation. Resource exhaustion suspends the run; it does not close it. Stop new game/replay/analysis admission immediately, request graceful shutdown of owned work and allow at most 60 seconds before terminating its owned process group. Stage, fsync and atomically publish checkpoint files; publish each match index last, retaining its prior skipped-game snapshots so a crash before index publication cannot invalidate the last committed prefix. Checkpoint completed work, interrupted reservations, pending jobs, source identities, next stage and consumed limits; verify shutdown and save a user-facing progress report. Preserve all details required for resume, including schedules, receipts, active source snapshots, analyses and replay inputs. Do not export, rank, start more analysis or perform closure cleanup on this path. Reserve 16 MB (16,000,000 bytes) within the output limit for control/checkpoint/report files; workers may consume only the remaining data allowance. Reserve that control/report storage allowance before dispatch so checkpointing and reporting remain possible at the output limit.

Resume an owner-paused or cancelled run only on explicit instruction, using the same run and verified checkpoint. Automatically resume execution interruptions within the authorized 10% recovery allowance; an active instruction to continue also authorizes that recovery. For existing runs, apply the authorized recovery allowance through a controller `continue` request with the full effective `limits` object and record the change in the ledger, without another approval request. Preserve the setup configuration, original start time and consumed budgets. Recovery authorization does not increase wall-time or storage limits; exhaustion of those limits still requires an explicit increase. Ignore interrupted games beyond the recovery allowance rather than requesting more game budget. Report the stop reason, checkpoint location, next action and any limit change required. Only completed planned work is successful; a suspended run remains incomplete.

## Autonomy

The conversation orchestrator implements AI changes; delegate only loss analysis. Use scripts for preparation, replay, archiving, validation, evaluation and decisions; bypass the automatic proposal launcher.

Resolve routine choices from project records. Ask for ambiguous bot identities, multiple matching checkpoints or missing required limits. Stop if the implementation cannot preserve Constraints.

Report progress, artifacts and blockers while continuing authorized work autonomously. Reuse a matching writer rather than starting another.

Preserve command errors and evidence; apply only configured recovery. On cancellation, request graceful shutdown, allow 60 seconds, then terminate only the owned process group if necessary. Verify shutdown and require explicit continuation.

## Output

Store shared state in `run.json`, iteration decisions in `iterations/iteration-N/iteration.json`, evaluation receipts once, and each match’s games in `games/game-N/`. Reference owned records instead of copying them. Use one log per game with separate actor A/B sections, plus one match log referencing the four game logs in order; gameplay is persisted only in lossless typed `.log` files, parsed by code and reviewed through loss-only log views. Setup, schedules, checkpoints, completion receipts and analysis metadata may remain JSON; generate no per-game JSON, actor JSON, duplicate game XML or separate replay JSONL.

Read [match-log-template.md](references/match-log-template.md) before reviewing compact logs. Use target-only loss-view `.log` files for agent review: typed initial state, one complete event/decision per line, selected/offered actions, exact decision/choice IDs, sideboarding and results. Use those same lossless logs for validation, exact choice IDs and prefix replay; reconstruct records only in memory. XML is a legacy read adapter, not a retained game-output format. Existing old runs remain readable; do not invoke the legacy linked-JSON migration to prepare new runs. Use [generate-improvement-run-index.ts](../../../scripts/bot-improvement/generate-improvement-run-index.ts) for navigation.

Keep the bot’s `improvement-history.md` entirely in English, including status labels, changes and reasons. Keep one compact line per attempt across runs; mark replaced attempts `SUPERSEDED`, not pending or rejected. Include status, change, version/evidence links and final result. Keep technical logs temporarily under the retention rules below.

Keep detailed setup, frozen packages, checkpoints, schedules, match records, per-match analyses and replay traces temporarily in `run-directory` while needed for execution, replay, accepted-version analysis reuse or resume. A rejected version's details can be pruned after its analysis and decision are summarized; accepted-version details remain until replaced or the run closes.

Use [run-summary-example.txt](references/run-summary-example.txt) as an illustrative compact report, not measured results. Generate a current report on suspension and final delivery.

At run closure retain only the following run-level evidence, consolidated into the existing run state and one report rather than duplicate archives:
- Run identity, target/opponent IDs and source commits/hashes, engine/content/runner identities, effective configuration, start/end times and terminal status/reason.
- Baseline and one row per evaluated version: version/commit IDs, parent accepted version, per-opponent and weighted win/loss/draw totals and rates, paired difference, accepted/rejected/incomplete outcome and short reason. Rank from these existing results; do not launch fresh ranking games at closure.
- One compact row per attempted rule: reason, affected-loss count, replayed/converted/timed-out counts, retained/excluded status and short explanation. Include aggregate loss coverage and unclear-loss counts; omit game IDs and decision-level evidence.
- Aggregate executed/reused/reserved/failed/cancelled game counts, replay counts, elapsed time, peak storage and concise error/timeout summaries.
- Final accepted commit and export path/hash, final ranking and a short account of what changed and what remains unresolved.

Keep bot source versions in Git, the compact bot-local history and the accepted export. After the run-level summary is written and checked, remove detailed game/match logs, machine records, receipts, per-match analyses, replay traces, schedules, temporary variants, frozen source copies and generated bundles. On interruption or resource exhaustion retain all temporary details required to resume; remove them only when the run completes or the owner explicitly closes it. Honor an explicit owner request to retain details. Summary-only closed runs cannot supply verified cached games or decision replays; execute fresh work for a new run.

Deliver accepted exports and an orchestrator report with state, next stage, results, decisions, used/remaining budgets and evidence links. Use the project report location, or `artifacts/`. Distinguish completed games from reservations and diagnostics from comparisons/ranking.

Link the shared policy and pinned effective configuration in References. Do not copy global policy or add an overrides section; effective configuration remains authoritative.

## Parallel match execution

Use the default persistent TypeScript runner (`session-typescript/v1`) through [run-matches.ts](../../../scripts/bot-improvement/run-matches.ts) and its [runner contract](../../../docs/architecture/06-quality/parallel-bot-session.md#minimum-runner-interface-for-aro2-18). Pin session/iteration bindings, runner identity, immutable AI snapshots and the paired schedule before dispatch. Set setup's `matches` to the total configured evaluation size (default 2,500); leave `matchesPerOpponent` unset; the frozen schedule determines the total match/game counts. Pin the self-opponent to the frozen starting AI in every iteration; accepted-version control and frozen self-play are separate bindings.

Use `--workers auto` with the saved machine-local optimal settings. Calibrate first if no valid settings exist; do not fall back to an arbitrary count or override the measured choice. The default entry point is `npm run bot:matches`; it allocates session game and storage allowances once, runs persistent workers with local journals, and reconciles receipts after execution. Legacy code is retained under `scripts/bot-improvement/archive/` and `tools/bot-evaluation/src/archive/`; use `npm run bot:matches:legacy` only for explicitly pinned legacy iterations. Use `npm run bot:matches:rust` for existing `session-batch/v1` iterations; its Rust calibration remains separate. Never migrate an existing run by changing its runner identity.

Reserve each attempt atomically against shared budgets before launch; settle completed, failed and cancelled attempts through the runner. Save per-match completion receipts, resume only verified missing work and aggregate only complete paired evidence. On stop, halt dispatch, settle or cancel active matches and preserve resumable checkpoints; worker changes never alter inputs or reset budgets.

## Worker calibration

Before evaluation, load the batch runner settings matching the current machine, TypeScript runtime source identity, fixture and batch size. If absent or stale, run [calibrate-batch-workers.ts](../../../scripts/bot-improvement/calibrate-batch-workers.ts), save its optimal settings and use them. Calibration tests every worker count from 2 through the available logical CPU bound independently of replay calibration. Use `npm run bot:matches:calibrate`; it never reads or overwrites legacy worker recommendations. Count calibration games separately. If calibration fails, stop rather than guess. Recalibrate when the machine/environment or runtime sources change. New sessions default to the logical CPU bound; `--workers auto` selects measured execution concurrency within that bound.

## Post-evaluation loss analysis

Follow [streaming-loss-analysis.md](references/streaming-loss-analysis.md) only after all scheduled matches finish and evaluation evidence is settled. The filename is retained for compatibility; analysis never overlaps evaluation. Partition the frozen schedule in its recorded order into consecutive, non-overlapping slices of 250 matches; the final slice may be smaller. Launch exactly one loss-analysis subagent per slice in parallel (10 for 2,500 matches), with one owner per slice. Use [analysis-slices.ts](../../../scripts/bot-improvement/analysis-slices.ts) (`bot:analysis-slices`) to sync after evaluation, claim one durable slice per analyst, publish loss-only views and complete existing Markdown reports. Give each analyst only its slice packet and allowlisted target-loss view logs, never the full game logs with both actors; the orchestrator filters outcomes using machine metadata before dispatch. Analysts must not open or read win, draw, timeout, failed or skipped game logs, including accepted-version winning-game logs. A slice without losses returns an empty coverage report without opening game logs. Analysts identify loss reasons only, using the current per-match Markdown findings format, and return their slice’s reports to the orchestrator. The orchestrator waits for all slices, verifies complete loss coverage, merges equivalent reasons and writes one evaluation-level loss-analysis document before continuing the normal workflow. When a combined candidate regresses, the orchestrator can flag paired new losses from outcome metadata (accepted won, candidate lost); analysts inspect only the candidate loss logs to identify implicated added rules and rank suspect rules by distinct supported affected losses. Distinguish observed associations from causal proof; use the regression repair mode in step 4 to remove or update one existing rule at a time and apply the same replay tests. The initial baseline has no regression repair/removal analysis; only an evaluated candidate with a lower paired win rate enters this mode. Analyze and replay candidate regressions against that candidate’s source, then build the repaired candidate from the same regressing source using the validated removals or updates. Preserve the accepted version solely as the promotion comparator. Preserve the five-loss eligibility threshold for new reason jobs.

## Workflow

Map these terms to the existing implementation without renaming its interfaces: improvement run = `campaign`, iteration = `round`, accepted version = `incumbent`. Preserve existing command names, configuration keys and artifact paths.

### 1 — Prepare the bots and improvement run

1. Resolve the implementation, bots and command template; use `main` and Version archive.
2. Find a compatible checkpoint, or use [setup-session.ts](../../../scripts/bot-improvement/setup-session.ts) (`bot:setup`) with the target, additional opponents, setup seed, `matches: 2500` and pinned stop limits. Its frozen-session path is authoritative for this workflow; the legacy external campaign generator is not the execution path.
3. Validate the setup with evaluator and strategy checks; verify Parallel match execution compatibility and resolve and save optimal match settings and pin the derived slice-analysis concurrency and 250-match slice assignments.

### 2 — Evaluate

1. Initialize or resume a compatible improvement run. On the first pass, evaluate the starting AI to establish the baseline; later passes evaluate the final combined candidate. Record the source version using Version archive. Validate the exact frozen AI before dispatch, including the unchanged starting AI for baseline evaluation. If the current package format is unsupported, adapt the validation/build tooling within this step, preserve the failed evidence, run related local checks and validate again to a new evidence directory. This compatibility adaptation precedes game admission and does not retry failed games or consume evaluation recovery attempts. Preserve source, deck, engine, legality and hidden-information boundaries; validate changed candidates through an explicit target-AI-only edit boundary. Stop if validation still fails or those boundaries cannot be preserved. Later candidate evaluations require a changed source; the initial baseline is exempt.
2. Run the parallel match pool using Parallel match execution, distributing the configured total matches across the frozen opponent roster. Save the baseline's paired schedule and reuse it for candidates; retrieve compatible results or complete missing matches.
3. Wait until every scheduled match is finalized and all execution reservations are settled. Save timeout bug reports and ignored games; start no loss analysts during evaluation. Loss analysis starts in step 4 after the candidate decision.
4. Verify evidence and save results, weighted win rates and resource usage. For candidates, also save the difference from the accepted version; mark incomplete or mismatched comparisons unassessable.

### 3 — Decide

1. For the initial baseline, record its accepted-version reference and continue to step 4 without counting an iteration decision.
2. For a candidate, apply the acceptance rule, save the decision and checkpoint, and update the history with the win-rate difference and a short reason. Commit the evaluated AI using Version archive and the recoverable [commit-bot-version.ts](../../../scripts/bot-improvement/commit-bot-version.ts) transaction; its journal pins the parent, source tree and commit before updating main, and resume reuses the recorded commit rather than creating another. Record its SHA; preserve the accepted-version reference on rejection.
3. Continue to step 4 for loss analysis, including after the last iteration decision.

### 4 — Analyze losses and prepare the next candidate

1. Dispatch one loss-only subagent per 250-match slice in parallel under Post-evaluation loss analysis, wait for all slice reports, verify coverage of every completed target loss, and consolidate findings into [loss-analysis.md](references/loss-analysis-template.md), binding it to the evaluated AI and source evaluation. Reuse completed analysis; delegate only uncovered losses and reconcile duplicate categories. After delivery, check stop conditions before preparing another candidate; finish at step 5 when the run is complete.
2. Record the next iteration’s accepted starting version and the analysis source version separately. Choose one mode:
   - **Baseline or ordinary improvement:** use the accepted version and its loss analysis; propose isolated new fixes. The initial starting-AI baseline never performs rule-removal analysis.
   - **Regressing candidate repair:** use the evaluated regressing candidate and its loss analysis. Identify existing rules causing losses; each isolated variant removes or updates one such rule, with no new rule additions in this mode. Keep the unchanged regressing candidate as the replay control. Do not apply its loss cases to the accepted source, whose decisions can differ.
   Before proposing, read `improvement-history.md` and its linked summaries to exclude unchanged failed rules/combinations for the same source/context. Record stable rule IDs, operation (add/remove/update), accepted version, replay source version, candidate source hash and sorted included rule IDs. A retry needs a material change and explanation. Keep immutable variants in separate source/output directories.
3. In both modes run [replay-game-decision.ts](../../../scripts/bot-improvement/replay-game-decision.ts) for every associated loss at its recorded critical decision. Compare each isolated variant with its unchanged analysis source; earlier fixes do not enter validation. Use the same criterion for additions, removals and updates: all cases must settle, the intended choice must change, and at least 5 losses and 5% of all associated losses must become wins. Timeout cases remain in that threshold denominator and never count as conversions. Record failed/unchanged choices and outcomes, not just successes.
4. Bound concurrent jobs by available resources and queue remaining reasons. Replay every associated loss without a replay game-count quota; enforce the per-execution timeout and check remaining run wall time/storage before admission. Exclude rules below either threshold; retain compact result summaries and temporarily keep details needed for review. An individual timeout writes a bug report and skips that case while remaining jobs continue. On other failure or run wall-time/storage exhaustion, stop admission and settle active jobs while preserving evidence.
5. Wait for every reason job to finish. Combine all validated edits into one final candidate: ordinary improvements start from the accepted version; regression repairs start from the evaluated regressing candidate, preserving its unedited rules while applying only validated removals/updates. Keep the accepted version unchanged as the promotion comparator and record the separate repair-source identity; resolve overlapping edits and retain the rule-ID mapping needed to attribute subsequent regressions. Evaluate the combined candidate in the next full batch; no additional combined-rule replay gate is required. Validate and freeze that version, then run [update-improvement-history.ts](../../../scripts/bot-improvement/update-improvement-history.ts) with included rule IDs (`--rules`), the candidate source hash (`--candidate-hash`), accepted source identity (`--base`) and replay references. Generate no `proposal.md`. If no edit validates, finish at step 5 with no candidate and retain the accepted version.
6. After analysis delivery and replay review, use [prune-improvement-iteration.ts](../../../scripts/bot-improvement/prune-improvement-iteration.ts) only where its deletion scope matches Output retention rules. Preserve details still needed for accepted-version reuse, unresolved validation or resume; consolidate and remove the remaining details at run closure. Continue to step 2 with the final candidate for its full evaluation.

### 5 — Verify and deliver

1. Verify completed iterations, decisions and loss analyses against evidence; rank saved versions from existing comparable results and export the accepted AI. On resource exhaustion, use the suspension/checkpoint/report path in Stop Condition instead of finalizing; continue this step only after an authorized resume or explicit closure.
2. Generate the report and deliver artifact links, completion status and unresolved errors.
