---
name: ai-bot-self-improvement
description: Evaluate and improve one deck’s AI using reproducible paired matches against frozen opponents.
---

# AI bot self-improvement

## Model defaults

Default model: `gpt-6.1-sol` (GPT-6.1 Sol). Default thinking level: `low`. Honor explicit user settings and report unavailable controls honestly.

## Goal

Seek a higher paired-game win rate for one bot; deliver the accepted source, verified results and compact history. Report unchanged results honestly when no edit qualifies.

## Inputs

- Required: target bot package `ai-bot`.
- Optional: additional `opponent-ai-bots` (none by default), owner limits and a compatible checkpoint.

## Constraints

All stages inherit this policy; stage instructions add requirements.

- Modify only target AI; preserve decks, engine, legality and hidden-information boundaries. Freeze all opponents, always including the starting AI as self-opponent. Accepted control is a separate, moving reference.
- Pin configuration, source commits/hashes, engine/content/runner/comparison identities, opponent order and paired schedule before dispatch. Pair starting deck orders, engine seeds, sides, rules and content; derive bot/engine randomness from stable match/game IDs. Choices and sideboarding may change trajectories, not starting inputs.
- Run independent matches at saved optimal match concurrency; keep each match's four games and sideboarding sequential. Reuse completed evidence only when inputs, settings, implementation, schedule and integrity match; report provenance and executed/reused counts.
- Score games, not matches. Opponent rate is wins divided by completed non-ignored games; draws remain in the denominator as zero wins. Weight opponents equally. Compare accepted and candidate on completed paired intersections, excluding either side's ignored game from both rates. Every scheduled opponent needs a completed pair; unresolved/mismatched comparability is unassessable. Finalized ignores alone do not invalidate valid pairs; known integrity failures follow Incident policy. Report rates, differences, ignored reasons/counts and paired coverage, without confidence intervals.
- Promote only valid candidates with strictly higher weighted rate; retain accepted source for ties, regressions or unassessable results. Explicit review policies change analysis coverage, never paired evaluation authority; label targeted/sampled review separately from full coverage.
- Generate JSON with scripts, never by editing generated output. Preserve existing command names, keys and paths: run = `campaign`, iteration = `round`, accepted = `incumbent`.
- Use current `session-typescript/v1` execution only. Incompatible old checkpoints/runners require a fresh run; do not adapt this workflow to legacy formats, budgets or runtimes.

## Autonomy

The orchestrator implements changes; delegate loss diagnosis only. Use project scripts for execution, validation, archiving and decisions; bypass automatic proposal generation. Resolve routine choices from records. Ask for ambiguous bots/checkpoints or missing required limits; stop if protected boundaries cannot hold. Reuse an existing matching writer, preserve errors/evidence and report progress while continuing authorized work. Push, publish or merge only with separate authorization.

## Controller and tools

Use the executable stage controller, one task at a time:

```sh
node .agents/skills/ai-bot-self-improvement/scripts/workflow-controller.mjs task prepare
```

`task STAGE` prints policy and current actions; `advance STAGE EVENT` checks the table’s edge and prints the next task. First verify completion and checkpoint the next stage through project tools. `resume PRIOR-STAGE` requires a verified checkpoint and Incident policy authorization. The dispatcher is stateless: owning tools execute/persist runs, accounting, storage, claims and publication; the orchestrator verifies semantic gates and authorization. Stops override progression.

Read the [runner contract][runner] before setup/dispatch. Discover exact request schemas and CLI options at the owning entry point rather than duplicating them here:

| Responsibility | Entry point |
| --- | --- |
| Frozen setup / candidate validation | `bot:setup` / `bot:validate` |
| Iteration binding / admission / matches | `bot:prepare-iteration` / `bot:session` / `bot:matches -- --workers auto` |
| Separate calibration | `bot:matches:calibrate` / `bot:replays:calibrate` |
| Loss-only slices / pipeline / cohorts | `bot:analysis-slices`; [protocol][analysis] and [performance protocol](references/performance-upgrades.md) |
| Exact-decision replay | [replay-game-decision.ts][replay] |
| Aggregate / persist candidate decision | `bot:aggregate` / `bot:decide` |
| Version commit / attempt history | [commit-bot-version.ts][commit] / [update-improvement-history.ts][history] |
| Navigation / eligible pruning | [generate-improvement-run-index.ts][index] / [prune-improvement-iteration.ts][prune] |

The aggregator also produces diagnostic statistics: use its game-decision evidence under Constraints for promotion, not confidence estimates or match-weighted diagnostics. The decision tool validates source/transaction bindings; independently verify strict paired improvement before requesting acceptance.

## Limits

During Prepare, read [default values][defaults] and pin resolved owner limits in run configuration, the execution authority. Defaults are input, not the setup schema. Resume preserves setup, original `startedAt` and consumed budgets. Check remaining time/storage and reserve through the shared gate before every admission; settle completed, failed and cancelled attempts through owning tools.

| Resource | Policy and configuration binding |
| --- | --- |
| Decisions | `maxDecisions` counts persisted candidate decisions, not baseline. Analyze final evaluation before delivery. No qualifying edit permits honest early termination. |
| Evaluation | `matches` is total four-game matches. Allocate floor(total/opponents) each plus one to first remainder opponents; freeze order/schedule, require one each. Leave `matchesPerOpponent` unset. |
| Evaluation games | Planned = (1 + effective decisions) × total matches × four; recovery = floor(10% planned). Pin both and sum. Failed/interrupted reservations and recovery executions count; caches add none. Track planned/recovery separately. |
| Wall time | Effective `stop.maxWallMs` runs from original start including downtime/suspension. |
| Storage | Always pass resolved `stop.maxBytes` explicitly. Count logical staging/log/evidence/import bytes and imported scope. Shared gate protects `controlReserveBytes` inside the cap; data gets remainder. |
| Deadlines | Resolve `timeoutsMs` per stage/branch; measure launch-to-exit, replay prefix included, capped by remaining wall time. |
| Replays/diagnostics | No rule-replay game quota; all associated losses required. Separate controls/takeovers and calibration diagnostics from evaluation/rule validation; all consume time/storage. |

Use the shared gate/checkpoint tools for locked reservations and staged, fsynced atomic publication, including match-index-last and prior skipped-prefix preservation. Do not reproduce their internals or bypass them. Never prune required validation/resume evidence merely to fit the cap.

For an authorized storage increase during an active writer transaction: persist the full continuation request, update the gate under its writer lock, then commit controller continuation when the session lock releases. Continuation uses the full effective `limits` object and preserves consumed budgets; recovery never implicitly increases time/storage.

## Calibration

Preparation requires separately saved, matching optimal match/replay recommendations. Calibration never overlaps evaluation or loss analysis. Official CLIs retain `attempts.json`; resume the same output directory only for the exact identity. Apply Incident policy’s fresh-directory retry and exclusion; never substitute arbitrary workers.

| Item | Match pool | Replay pool |
| --- | --- | --- |
| Identity | Machine/environment, TypeScript runtime source, fixture, batch size | Machine, replay runtime, engine/content, representative workload, batch size, Node version/flags, source commits/hashes, paired inputs and sampled logs/decision IDs |
| Measurement | Use designated calibrator's required repetitions and optimum | Two repetitions; at least one full independent batch per worker at largest stage; verify identical outcomes across stages; choose smallest count within 3% of fastest successful median |
| Fixture | Pinned match workload | Representative verified completed target losses with exact decision IDs and unchanged starting AI replacement; retained compatible logs or deterministic diagnostic fixture |
| Saved result | Machine-local recommendation with report/measurements | Separate `.cache/replay-workers.json`; pin identity/report and measured concurrency in run configuration |

Both pools account for every worker count from 2 through available logical CPUs, either by successful required measurements or recorded policy-permitted exclusions (including explicit memory preflight); below two has no qualifying count, so stop without an invented fallback. Recalibrate mismatched recommendations; save measurements, failed attempts and exclusions across resume. Only fully successful required repetitions qualify. Incident policy governs failures. Verify diagnostic admission classification before calibration; stop unresolved budget conflicts.

## Source selection and replay gate

Record each next iteration's accepted commit separately from analysis/replay source and assembly base.

| Mode | Trigger | Isolated operation | Analysis, unchanged replay control and assembly base | Promotion comparator |
| --- | --- | --- | --- | --- |
| Ordinary | Baseline, accepted candidate, tie or unassessable rejection | Add one fix per isolated variant | Accepted source and its matching analysis; still analyze a rejected evaluation before returning to retained accepted analysis | Accepted source |
| Regression repair | Evaluated candidate has a valid lower paired rate | Remove/update one existing rule; add none | Regressing candidate; preserve its unedited rules | Accepted source |

Baseline never performs removal analysis. In repairs use paired outcome metadata to flag new losses (accepted won, candidate lost); analysts inspect candidate losses only. Rank implicated added rules by distinct supported losses; association is not causal proof.

Persist every reported reason, including groups below five losses, in the cross-iteration pending-rule ledger described below. Reasons eligible for rule replay affect at least five distinct losses globally; include all supported groups ranked by count then severity. Replay every associated loss at its recorded primary critical decision. Compare each isolated variant against unchanged analysis source without earlier fixes. All cases must settle. Validate rules converting at least five AND 5% of associated losses into wins with the intended choice changed. Below-threshold rules remain pending under the accumulation policy; they are not discarded merely for missing either threshold. Unchanged choices/nonwinning takeovers are non-conversions, not automatic rule rejection. Recorded ignored timeouts settle but stay in the denominator and never convert. Execution/integrity failures follow Incident policy.

## Pending reasons and accumulated replay cases

Keep a durable cross-iteration pending-rule ledger separate from findings. Bind each entry to stable reason/rule IDs, explicit reason aliases and exact semantic rule/source hash. Retain original findings, distinct loss IDs, source/log hashes, primary critical decisions, offered/chosen IDs and attempt outcomes. Reconcile similar reasons explicitly, preserving provenance and disagreements. Different corrections require separate rule entries, even for one reason.

Accumulate at most 300 distinct losses per reason/rule in deterministic first-seen order; repeated executions add no cases. Retain below-threshold entries and required evidence across iterations, extending their stacks with matching or explicitly reconciled similar losses. Singleton and sub-five groups wait for eligibility.

At each otherwise authorized Replay stage, retest every eligible pending rule against the **current iteration's analysis-source bot**. Sub-five groups wait for eligibility; source-mode restrictions still apply, so block incompatible rule operations. Replay every accumulated case, old and new, from pinned original inputs with fresh unchanged-current-source control and current-source-plus-rule branches. Verify reconstruction, legal critical-decision addressing and choice applicability. Never silently force historical policy choices through a prefix claimed as current-policy control. If exact current-source replay is unavailable, retain the blocked entry and diagnostics rather than inventing non-conversions or rejection. Preserve original provenance and bind fresh outcomes to current source/rule hashes; historical outcomes never substitute.

After every current-source case settles, require at least five converted wins AND at least 5% of accumulated associated losses, with intended choice changed. Validated rules proceed through ordinary assembly/evaluation gates. Failure of either threshold below 300 cases stays pending. At 300 distinct cases, complete valid current-source replay failing either gate marks that exact rule **proven-discarded**. Archive counts, denominator, source/rule identities and evidence in durable failed-rule history; exclude the unchanged rule from future attempts. Resource exhaustion, interruption or integrity failure cannot establish discard. A materially different correction needs a new rule identity and explanation, preserving failed history.

Pending entries override ordinary exclusions for previously unsuccessful rules and override pruning of their required evidence. They do not authorize extra iterations, games, time or storage. If no rule passes and no further iteration is otherwise authorized/possible, deliver the pending ledger and retain it for an explicitly compatible future continuation; do not force an empty candidate or silently extend limits. A discarded campaign supplies no inherited pending stack unless separately authorized.

## Version archive

Before baseline reuse an exact starting-source commit or create it on `main`. Commit every candidate after full evaluation/decision, including rejected ones. Unevaluated variants remain temporary content-hashed source, without commits. Keep accepted independent of HEAD/rejections; retrieve committed source with `git show <sha>:<path>` or package extraction.

New subject: `ai-bot(<bot-id>): version <version-id> | run <run-id> | <initial|accepted|rejected>`. Use stable bot ID and unique immutable version/run IDs; trailers `AI-Bot`, `AI-Version`, `AI-Run`, `AI-Outcome`, `AI-Path`, `AI-Parent-Version` (`none` initially). Related follow-ups reuse bot/version IDs. Find matching commits with `git log --all --fixed-strings --grep='AI-Version: <version-id>' --grep='AI-Bot: <bot-id>' --all-match`; preserve existing history. Record full SHA/path/outcome and source hashes in summaries. Commit intended bot/history changes only; logs, bundles and dependencies stay outside Git. Use the commit helper's recoverable journal, reusing its commit after interruption.

## Incident policy

Resolve integrity/input-prefix failures first; ask the user if unresolved. Otherwise apply the table.

Individual timeouts are finalized incidents, not interrupted work eligible for retry.

Calibration retries apply only to failed measurement stages, never ordinary rule-replay cases.

| Incident | Immediate action and accounting | Retry/continuation |
| --- | --- | --- |
| Individual game/replay timeout | Bug report, ignored outcome, continue safe jobs. Neither loss/draw nor replay conversion; exclude evaluation game from both paired sides | Never retry that case |
| Interrupted evaluation | Preserve verified completion, record every reservation/attempt/timeout, recover missing work within deadlines/resources | Automatic within 10% allowance; once exhausted ignore remaining interrupted games and continue eligible work without requesting extra games |
| Failed calibration worker-count stage | Same pinned inputs, fresh evidence directory; retain both attempts | Retry once; second failure excludes count and remaining repetitions; continue other counts. Persist retry state; no qualifier stops preparation |
| Unsupported package format before admission | Preserve failed validation, adapt only build/validation tooling, run related local checks and validate in fresh directory without changing protected boundaries | No game/recovery charge; stop if still invalid |
| Initialization, sideboarding, integrity or other validation/non-timeout failure | Stop; never classify unsafe state as ignored | No generic retry; ordinary replay recovery has no automatic allowance |
| Time/storage exhaustion | Suspend incomplete; stop all admission; quota rejection persists marker blocking data writes | Explicit increase/continuation; no ranking, export, further analysis or closure cleanup |
| Owner pause/cancellation or analyst execution failure | Stop admission and owned work; preserve claims and uncovered losses | Explicit instruction on same verified checkpoint; resume uncovered work without duplicate owners |

For all stopped owned work, allow at most effective `timeoutsMs.ownedShutdownGrace`, then terminate only owned process groups. Settle/cancel reservations, verify shutdown and checkpoint completed work, pending jobs/coverage, interrupted reservations, source identities, next stage and budgets. Report stop reason, checkpoint, next action and required limit change. Owner-authorized explicit closure is distinct from ordinary resource suspension and must retain incomplete status.

## Output and artifact lifecycle

Preserve the existing artifact paths and literal analysis/log formats in the references. State/control metadata may be JSON generated by tools; gameplay is typed lossless `.log` only, reconstructed in memory for validation/replay. Agents review target-only completed-loss projections. Read [match-log-template.md][logs] before reviewing logs. Use positive allowlists rather than browsing adjacent gameplay files.

During a run, rejected-version details may be pruned after summarized analysis/decision and after all execution, validation, replay, reuse and resume needs end; closure is not required. Accepted details additionally remain until replacement or closure. Owner retention overrides pruning; resource suspension permits no closure cleanup.

| Artifact | Contents/location | Retention and cleanup |
| --- | --- | --- |
| Shared state | `run.json`; decisions `iterations/iteration-N/iteration.json`; receipts once; reference owned records | Preserve compact configuration, identities, decisions and accounting in existing run state; checkpoint via owning tools |
| Temporary execution evidence | Game logs under `games/game-N/` with actor A/B initial state/events/choices/IDs/sideboarding/results; match log indexes four games. Review pages/packets, match-findings checkpoints, per-match Markdown and [evaluation report][loss-report], replay points/control-takeover traces/outcomes, immutable variant hashes, frozen packages/copies, schedules, receipts, machine records and bundles | Keep while execution, validation, replay, accepted-analysis reuse or resume needs it; apply version conditions above. No permanent archival source copies; delivery alone permits no pruning. |
| Bot history/export | Git versions; English `improvement-history.md`, one compact line per attempt across runs with status/change/version/evidence/final result; replacements `SUPERSEDED`; accepted export/hash | Retain after closure |
| Run report | Project location or `artifacts/`; state/stage, results/decisions, used/remaining budgets, errors and links; [minimal example][summary] | Generate on suspension/final delivery; closure fields below |

At closure, consolidate into existing state and one checked report:

- Run/target/opponent IDs and source commits/hashes, engine/content/runner identities, configuration, start/end times, terminal status/reason.
- Baseline and each evaluated version: version/commit, parent accepted source, per-opponent and weighted W/L/D totals/rates, paired difference, accepted/rejected/incomplete outcome/reason; rank existing comparable results, without fresh games.
- Each attempted rule: reason, affected/replayed/converted/timed-out counts, retained/excluded status/explanation; aggregate coverage and unclear losses, without game IDs or decision details.
- Aggregate executed/reused/reserved/failed/cancelled games, replay counts, elapsed time, peak storage, concise errors/timeouts.
- Accepted commit/export path/hash, ranking, changes and unresolved issues.

Remove eligible temporary evidence after checked closure consolidation. Suspended detail remains until completion or explicit closure; summary-only closed runs cannot supply verified cached games/replays. Distinguish reservations from completions and diagnostics from comparisons; References link shared policy and authoritative pinned configuration, without copying policy or an overrides section.

## Workflow

Legal edges below require verified completion under inherited policy; controller events report outcomes.

| Stage | Completed outcome/event | Next stage |
| --- | --- | --- |
| Prepare | ready | Evaluate |
| Evaluate | complete | Decide |
| Decide | complete | Analyze |
| Analyze | continue | Replay |
| Analyze | complete: decision ceiling reached | Deliver |
| Replay | validated | Assemble |
| Replay | none: no qualifying edit | Deliver |
| Assemble | ready | Evaluate |
| Deliver | complete | Closed |
| Any active stage | suspend | Suspended |
| Suspended | explicit authorized resume of verified prior stage | Prior stage |

### Prepare

Resolve inputs and mandatory contracts; read defaults and pin effective configuration and setup seed. Use frozen-session `bot:setup`, archive starting source, validate setup/current runner and exact sources, and save both matching calibration recommendations. Pin the explicit analysis policy using [performance protocol](references/performance-upgrades.md). Default to full coverage and consecutive 250-match slices (last may be smaller), one owner per slice. Pin analyst slots independently of slice count and within the runtime capability. Ready requires verified setup and both recommendations.

### Evaluate

Evaluate unchanged starting source first, then changed combined candidates. Validate/freeze exact source and target-only boundary before admission. Bind source, accepted control, runner and paired schedule; retrieve compatible results or run verified missing matches. A finalized slice may be prepared independently and emits `slice-ready`; remain in Evaluate. Use the configured pipeline and concurrent storage envelopes to admit analysis as capacity permits; legacy exclusive leases remain exclusive. Analyst commands use the normal claim/page/findings protocol and actual declared runtime slots. Complete after every scheduled match finalizes, reservations settle and evidence, results, coverage and resources are verified. Save candidate’s paired difference.

### Decide

Record baseline accepted reference without a candidate decision. Otherwise verify the promotion gate, persist outcome/reason/difference/checkpoint, archive the evaluated candidate and update history through owning tools. Always Analyze afterward, including the final decision.

### Analyze

Read [performance protocol](references/performance-upgrades.md) for versioned page reading, checkpoints and partial-mode coverage. Read and execute [slice protocol][analysis] and [evaluation report contract][loss-report]. For full policy, complete every required loss; for explicit partial policies, complete and label the selected cohort. Early research may create hypotheses or isolated temporary variants when its gate permits, but cannot bypass paired evaluation or replay requirements. Complete the source-bound report before checking completion: decision ceiling goes to Deliver, exhausted resources suspend, otherwise select the next source mode and continue to Replay.

### Replay

Read history and the pending-rule ledger; carry pending entries and their full accumulated replay stacks into this iteration. Exclude unchanged proven-discarded rules/context/combinations, not merely below-threshold pending attempts. Explain materially changed retries. Implement isolated variants; record stable rule IDs, operation, accepted/replay source, candidate hash and sorted included IDs; keep immutable isolated source/output directories. Execute Source selection and replay gate at measured resource-bounded concurrency, wait for every reason job and record validated, pending, blocked and proven-discarded outcomes with current-source bindings. At least one passing edit goes to Assemble; none retains accepted source and goes to Deliver.

### Assemble

Combine all passing edits from mode base, resolving overlaps while preserving validated semantics, attribution and unedited repair rules. Materially changed isolated logic re-passes its replay gate; no additional combined-rule gate. Validate/freeze candidate and update history with `--rules`, `--candidate-hash`, accepted `--base` and replay references. Generate no `proposal.md`. Prune only lifecycle-eligible detail through the designated tool, then Evaluate.

### Deliver

Verify required decisions/analyses, rank existing comparable results, export accepted source and check the report before lifecycle cleanup. Report actual progress, status, links and unresolved errors; no-edit completion does not claim all planned decisions ran. Resource exhaustion uses Suspended instead.

### Suspended

Execute Incident policy’s owned shutdown, settlement, checkpoint and report, preserving prior stage and resumable evidence. Resume only with applicable authorization and remaining/increased limits. Explicit incomplete closure never becomes successful by relabeling.

[runner]: ../../../docs/architecture/06-quality/parallel-bot-session.md#minimum-runner-interface-for-aro2-18
[analysis]: references/streaming-loss-analysis.md
[loss-report]: references/loss-analysis-template.md
[logs]: references/match-log-template.md
[summary]: references/run-summary-example.txt
[replay]: ../../../scripts/bot-improvement/replay-game-decision.ts
[commit]: ../../../scripts/bot-improvement/commit-bot-version.ts
[history]: ../../../scripts/bot-improvement/update-improvement-history.ts
[index]: ../../../scripts/bot-improvement/generate-improvement-run-index.ts
[prune]: ../../../scripts/bot-improvement/prune-improvement-iteration.ts

[defaults]: references/defaults.md
