---
name: ai-bot-self-improvement
description: Evaluate and improve one deck’s AI using reproducible paired matches against frozen opponents.
---

# AI bot self-improvement

## Goal

Seek a higher paired-game win rate for one bot; deliver the accepted source, verified results and compact history. Report unchanged results honestly when no edit qualifies.

## Inputs

- Required: target bot package `ai-bot`.
- Optional: additional `opponent-ai-bots` (none by default), owner limits and a compatible checkpoint.

## Constraints

All stages inherit these rules and the Limits, Incident policy and Artifact lifecycle below. Stage instructions add requirements; omission never grants an exception.

- Modify only target AI; preserve decks, engine, legality and hidden-information boundaries. Freeze all opponents, always including the starting AI as self-opponent. Accepted control is a separate, moving reference.
- Pin configuration, source commits/hashes, engine/content/runner/comparison identities, opponent order and paired schedule before dispatch. Pair starting deck orders, engine seeds, sides, rules and content; derive bot/engine randomness from stable match/game IDs. Choices and sideboarding may change trajectories, not starting inputs.
- Run independent matches at saved optimal match concurrency; keep each match's four games and sideboarding sequential. Reuse completed evidence only when inputs, settings, implementation, schedule and integrity match; report provenance and executed/reused counts.
- Score games, not matches. Opponent rate is wins divided by completed non-ignored games; draws remain in the denominator as zero wins. Weight opponents equally. Compare accepted and candidate on completed paired intersections, excluding either side's ignored game from both rates. Every scheduled opponent needs a completed pair; unresolved/mismatched comparability is unassessable. Finalized ignores alone do not invalidate valid pairs; known integrity failures follow Incident policy. Report rates, differences, ignored reasons/counts and paired coverage, without confidence intervals.
- Promote only valid candidates with strictly higher weighted rate; retain accepted source for ties, regressions or unassessable results.
- Generate JSON with scripts, never by editing generated output. Preserve existing command names, keys and paths: run = `campaign`, iteration = `round`, accepted = `incumbent`.
- Use current `session-typescript/v1` execution only. Incompatible old checkpoints/runners require a fresh run; do not adapt this workflow to legacy formats, budgets or runtimes.

## Autonomy

The orchestrator implements changes; delegate loss diagnosis only. Use project scripts for execution, validation, archiving and decisions; bypass automatic proposal generation. Resolve routine choices from records. Ask for ambiguous bots/checkpoints or missing required limits; stop if protected boundaries cannot hold. Reuse an existing matching writer, preserve errors/evidence and report progress while continuing authorized work. Push, publish or merge only with separate authorization.

## Controller and tools

Use the executable stage controller, one task at a time:

```sh
node .agents/skills/ai-bot-self-improvement-REFINED/scripts/workflow-controller.mjs task prepare
node .agents/skills/ai-bot-self-improvement-REFINED/scripts/workflow-controller.mjs advance prepare ready
```

`task` prints inherited policy plus the current stage's instructions. `advance` checks the transition table below and prints the next task; call it only after verifying the current completion gate. It does not execute games, certify semantic evidence, store run state or grant recovery authorization. Persist the verified next stage with the project's checkpoint commands. For a suspended run use `resume <prior-stage>` only after the required authorization and checkpoint verification. Cancellation/limits always override progression.

Existing tools remain the execution controller: `bot:session` controls admission/accounting, `bot:matches` owns match execution, storage gate owns quota/atomic writes, slice tool owns analyst claims, and decision/archive tools own publication transactions. Keep human judgment and unverified gates explicit below; a stage transition is not proof of their completion.

Read the [runner contract][runner] before setup/dispatch. Discover exact request schemas and CLI options at the owning entry point rather than duplicating them here:

| Responsibility | Entry point |
| --- | --- |
| Frozen setup / candidate validation | `bot:setup` / `bot:validate` |
| Iteration binding / admission / matches | `bot:prepare-iteration` / `bot:session` / `bot:matches -- --workers auto` |
| Separate calibration | `bot:matches:calibrate` / `bot:replays:calibrate` |
| Loss-only slices | `bot:analysis-slices`; [protocol][analysis] |
| Exact-decision replay | [replay-game-decision.ts][replay] |
| Aggregate / persist candidate decision | `bot:aggregate` / `bot:decide` |
| Version commit / attempt history | [commit-bot-version.ts][commit] / [update-improvement-history.ts][history] |
| Navigation / eligible pruning | [generate-improvement-run-index.ts][index] / [prune-improvement-iteration.ts][prune] |

The aggregator also produces diagnostic statistics: use its game-decision evidence under Constraints for promotion, not confidence estimates or match-weighted diagnostics. The decision tool validates source/transaction bindings; independently verify strict paired improvement before requesting acceptance.

## Limits

Read [default values][defaults] during Prepare, then pin owner overrides and resolved values in run configuration; it is authoritative for execution. The defaults file is input, not a replacement setup schema. Resume preserves setup, original `startedAt` and consumed budgets. Every admission checks remaining time/storage and reserves through the controller; settle completed, failed and cancelled attempts through owning tools.

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

Preparation completes only with separately saved, matching optimal match and replay recommendations; no arbitrary worker substitute. Calibration never overlaps evaluation or loss analysis.

| Item | Match pool | Replay pool |
| --- | --- | --- |
| Identity | Machine/environment, TypeScript runtime source, fixture, batch size | Machine, replay runtime, engine/content, representative workload, batch size, Node version/flags, source commits/hashes, paired inputs and sampled logs/decision IDs |
| Measurement | Use designated calibrator's required repetitions and optimum | Two repetitions; at least one full independent batch per worker at largest stage; verify identical outcomes across stages; choose smallest count within 3% of fastest successful median |
| Fixture | Pinned match workload | Representative verified completed target losses with exact decision IDs and unchanged starting AI replacement; retained compatible logs or deterministic diagnostic fixture |
| Saved result | Machine-local recommendation with report/measurements | Separate `.cache/replay-workers.json`; pin identity/report and measured concurrency in run configuration |

Both pools test every worker count from 2 through available logical CPUs. Reuse only matching recommendations; otherwise recalibrate. Save successful measurements, failed attempts and exclusions across resume. Only fully successful required repetitions qualify. Input/prefix integrity changes are failures, not concurrency measurements. A CPU bound below two cannot produce the required recommendation: stop rather than invent a fallback. Diagnostic games have separate accounting; verify the existing controller's admission classification before calibration and stop on any unresolved budget conflict.

## Source selection and replay gate

Record each next iteration's accepted commit separately from analysis/replay source and assembly base.

| Mode | Trigger | Isolated operation | Analysis, unchanged replay control and assembly base | Promotion comparator |
| --- | --- | --- | --- | --- |
| Ordinary | Baseline, accepted candidate, tie or unassessable rejection | Add one fix | Accepted source and its matching analysis; still analyze a rejected evaluation before returning to retained accepted analysis | Accepted source |
| Regression repair | Evaluated candidate has a valid lower paired rate | Remove/update one existing rule; add none | Regressing candidate; preserve its unedited rules | Accepted source |

Baseline never performs removal analysis. In repairs use paired outcome metadata to flag new losses (accepted won, candidate lost); analysts inspect candidate losses only. Rank implicated added rules by distinct supported losses; association is not causal proof.

Eligible reasons affect at least five distinct losses globally; include all supported groups ranked by count then severity. Replay every associated loss at its recorded primary critical decision. Compare each isolated variant against unchanged analysis source without earlier fixes. All cases must settle. Retain only rules converting at least five AND 5% of associated losses into wins with the intended choice changed. Unchanged choices/nonwinning takeovers are non-conversions, not automatic rule rejection. Recorded ignored timeouts settle but stay in the denominator and never convert. Execution/integrity failures follow Incident policy.

## Version archive

Before baseline reuse an exact starting-source commit or create it on `main`. Commit every candidate after full evaluation/decision, including rejected ones. Unevaluated variants remain temporary content-hashed source, without commits. Keep accepted references independent of HEAD/rejections; retrieve source with `git show <sha>:<path>` or package extraction instead of permanent source copies.

New subject: `ai-bot(<bot-id>): version <version-id> | run <run-id> | <initial|accepted|rejected>`. Use stable bot ID and unique immutable version/run IDs; trailers `AI-Bot`, `AI-Version`, `AI-Run`, `AI-Outcome`, `AI-Path`, `AI-Parent-Version` (`none` initially). Related follow-ups reuse bot/version IDs. Find matching commits with `git log --all --fixed-strings --grep='AI-Version: <version-id>' --grep='AI-Bot: <bot-id>' --all-match`; preserve existing history. Record full SHA/path/outcome and source hashes in summaries. Commit intended bot/history changes only; logs, bundles and dependencies stay outside Git. Use the commit helper's recoverable journal, reusing its commit after interruption.

## Incident policy

Integrity/input-prefix failures always stop; resource exhaustion and owner stops override normal progression. Otherwise apply the specific incident row. Individual timeouts are finalized incidents, not interrupted work eligible for retry. Calibration retries apply only to failed measurement stages, never ordinary rule-replay cases.

| Incident | Immediate action and accounting | Retry/continuation |
| --- | --- | --- |
| Individual game/replay timeout | Bug report, ignored outcome, continue safe jobs. Neither loss/draw nor replay conversion; exclude evaluation game from both paired sides | Never retry that case |
| Interrupted evaluation | Preserve verified completion, record every reservation/attempt/timeout, recover missing work within deadlines/resources | Automatic within 10% allowance; once exhausted ignore remaining interrupted games and continue eligible work without requesting extra games |
| Failed calibration worker-count stage | Same pinned inputs, fresh evidence directory; retain both attempts | Retry once; second failure excludes count and remaining repetitions; continue other counts. Persist retry state; no qualifier stops preparation |
| Unsupported package format before admission | Preserve failed validation, adapt only build/validation tooling, run related local checks and validate in fresh directory without changing protected boundaries | No game/recovery charge; stop if still invalid |
| Initialization, sideboarding, integrity or other validation/non-timeout failure | Stop; never classify unsafe state as ignored | No generic retry; ordinary replay recovery has no automatic allowance |
| Analyst execution failure / owner stop | Halt dispatch, settle/terminate owned analysts; retain reports, claims and uncovered losses | Explicit continuation; resume uncovered work without duplicate owners |
| Time/storage exhaustion | Suspend incomplete; stop all admission; quota rejection persists marker blocking data writes | Explicit increase/continuation; no ranking, export, further analysis or closure cleanup |
| Owner pause/cancellation | Stop admission and owned work | Explicit instruction on same verified checkpoint |

On suspension/interruption/cancellation gracefully stop owned games/replays/analysts, allow at most effective `timeoutsMs.ownedShutdownGrace`, then terminate only owned process groups. Settle/cancel reservations, verify shutdown and checkpoint completed work, pending jobs/coverage, interrupted reservations, source identities, next stage and budgets. Report stop reason, checkpoint, next action and required limit change. Owner-authorized explicit closure is distinct from ordinary resource suspension and must retain incomplete status.

## Output and artifact lifecycle

Preserve the existing artifact paths and literal analysis/log formats in the references. State/control metadata may be JSON generated by tools; gameplay is typed lossless `.log` only, reconstructed in memory for validation/replay. Agents review target-only completed-loss projections. Read [match-log-template.md][logs] before reviewing logs. Use positive allowlists rather than browsing adjacent gameplay files.

| Artifact | Contents/location | Retention and cleanup |
| --- | --- | --- |
| Shared state | `run.json`; decisions `iterations/iteration-N/iteration.json`; receipts once; reference owned records | Preserve compact configuration, identities, decisions and accounting in existing run state; checkpoint via owning tools |
| Gameplay | One game log with actor A/B sections under `games/game-N/`; match log indexes four games in order; exact initial state/events/choices/IDs/sideboarding/results | Keep while execution, validation, replay, accepted-analysis reuse or resume needs it |
| Analyses/replays | Per-match Markdown, evaluation [loss-analysis.md][loss-report], replay points, traces, control/takeover outcomes | Same dependency rule; rejected details only after summarized decision/analysis, accepted details until replacement/closure; delivery alone is insufficient |
| Temporary source/builds | Immutable variant hashes, frozen packages, schedules, machine records, bundles | Same dependency rule; no permanent archival source copies |
| Bot history/export | Git versions; English `improvement-history.md`, one compact line per attempt across runs with status/change/version/evidence/final result; replacements `SUPERSEDED`; accepted export/hash | Retain after closure |
| Run report | Project location or `artifacts/`; state/stage, results/decisions, used/remaining budgets, errors and links; [minimal example][summary] | Generate on suspension/final delivery; compact retained evidence below |

At closure, consolidate into existing state and one checked report:

- Run/target/opponent IDs and source commits/hashes, engine/content/runner identities, configuration, start/end times, terminal status/reason.
- Baseline and each evaluated version: version/commit, parent accepted source, per-opponent and weighted W/L/D totals/rates, paired difference, accepted/rejected/incomplete outcome/reason; rank existing comparable results, without fresh games.
- Each attempted rule: reason, affected/replayed/converted/timed-out counts, retained/excluded status/explanation; aggregate coverage and unclear losses, without game IDs or decision details.
- Aggregate executed/reused/reserved/failed/cancelled games, replay counts, elapsed time, peak storage, concise errors/timeouts.
- Accepted commit/export path/hash, ranking, changes and unresolved issues.

After checked consolidation remove detailed logs, receipts, per-match analyses, replay traces/points, schedules, variants, frozen copies, machine records and bundles. Explicit owner retention overrides cleanup. Suspended runs retain resumable detail until completion or explicit closure. Summary-only closed runs cannot supply verified cached games/replays. Distinguish reservations from completions and diagnostics from comparisons; References link shared policy and authoritative pinned configuration, without copying policy or an overrides section.

## Workflow

The table defines legal progression; every gate includes inherited policy and evidence verification. Controller events describe completed outcomes, not permissions to skip their gates.

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

Resolve bots/checkpoint and required contracts. Use frozen-session `bot:setup` with target, extra opponents, seed, total matches and all limits; archive starting source. Validate setup, current runner compatibility and exact sources; save both calibrated recommendations and the whole consecutive 250-match slice plan, deriving `analysis-workers = ceil(total-matches / 250)`. Ready requires matching recommendations and a verified setup. Stop incompatible runs rather than adding compatibility branches.

### Evaluate

Evaluate unchanged starting source first, then changed combined candidates. Validate/freeze exact source and target-only boundary before dispatch, using only Incident policy's narrow tooling exception if needed. Bind schedule, runner, source and accepted control; retrieve compatible results or run missing matches with owning tools. Complete only after every scheduled match finalizes, reservations settle and evidence/results/coverage/resource usage are verified. Save candidate's paired difference from accepted source.

### Decide

Record baseline accepted reference without a candidate decision. Otherwise verify Constraints' promotion rule, persist outcome/reason/difference/checkpoint, archive every evaluated candidate with the commit helper and update history. Rejection preserves accepted reference. Always continue to Analyze, even after the final decision.

### Analyze

Read and follow [slice protocol][analysis] and [evaluation report contract][loss-report]. After Decide, dispatch one diagnosis-only owner per consecutive whole slice, queue for runtime slots, verify every completed target loss exactly once, reuse matching findings, merge equivalent reasons and finalize one source-bound report. Apply stop conditions after delivery: decision ceiling goes to Deliver; resource exhaustion suspends; otherwise continue with the appropriate source mode.

### Replay

Read history/linked summaries; exclude unchanged failed rules/combinations in the same source/context. A retry needs material change/explanation. Implement immutable isolated variants under Source selection and replay gate, with stable rule IDs, operation, accepted/replay source, candidate hash and sorted included IDs in separate source/output directories. Run all associated losses at measured replay concurrency within resources; wait for every reason job, recording failed/unchanged outcomes too. Return validated only if at least one edit passes; none retains accepted source and goes to Deliver.

### Assemble

Combine all passing edits from the mode's base, resolving overlaps while preserving validated semantics, rule attribution and unedited repair rules. Materially changed isolated logic needs its own replay gate, not a new combined-rule gate. Validate/freeze candidate; update history with `--rules`, `--candidate-hash`, accepted `--base` and replay references. Generate no `proposal.md`. Prune only eligible details with the designated tool; then return to Evaluate.

### Deliver

Verify required decisions/analyses against evidence, rank existing comparable evaluations, export accepted source and check the report before lifecycle cleanup. A search with no validated edit may end early; report actual progress, without claiming all planned decisions ran. Resource exhaustion uses the suspension report/checkpoint path instead. Deliver links, status and unresolved errors.

### Suspended

Perform Incident policy's shutdown, settlement, checkpoint and report. Preserve the prior stage and resumable evidence. Resume only under its applicable authorization and remaining/increased limits; an explicitly closed incomplete run never becomes successful by relabeling it.

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
