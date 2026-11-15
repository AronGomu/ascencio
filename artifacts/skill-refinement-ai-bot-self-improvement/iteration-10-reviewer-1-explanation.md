# Explanation from reviewer 1 for refined bot improvement skill

## 1. Outcome and scope

Improve the supplied target bot through reproducible comparisons against frozen opponents, including its starting AI, and deliver the best accepted source, verified results and compact attempt history. Inputs are the target package, optional opponents, owner limits and a compatible checkpoint. Only target AI changes are permitted; decks, engine, legality and information boundaries remain protected. Successful completion can retain the initial source if no edit qualifies; suspension remains incomplete.

## 2. Process overview

Prepare freezes identities, resources and paired schedule and calibrates both pools. Evaluate starts with baseline and later combined candidates; Decide records acceptance and archives each evaluated version. Every evaluation then receives complete delegated loss analysis. Unless the decision ceiling is reached, the orchestrator tests isolated hypotheses against their unchanged analysis source, combines qualifying edits, and repeats evaluation. No qualifying edit leads to delivery; stops override the normal loop and preserve resumable work. The stage controller dispatches instructions but does not execute or certify them.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | New run or verified compatible checkpoint | Orchestrator reads runner/defaults, resolves setup, archives initial source and calibrates | Calibration separate from evaluation/analysis | Valid current runner, frozen inputs, both matching optimal recommendations | Setup, identities, schedule, calibration reports and checkpoint | Evaluate |
| Evaluate | Frozen baseline or assembled candidate | Orchestrator validates source; tools reuse verified evidence or run missing matches | Measured match pool; four games/sideboarding sequential within match | All matches finalized, reservations settled and comparability/resources verified | Logs, receipts, outcomes and paired difference | Decide |
| Decide | Completed evaluation | Orchestrator verifies strict paired gain; tools record outcome, archive candidate and update history | Sequential | Baseline reference or persisted candidate decision | Accepted pointer, decision, commit and history | Analyze |
| Analyze | Full evaluation barrier | Slice tools assign whole consecutive 250-match slices; analysts review every target loss; orchestrator merges | One owner per slice; queued slots | Exactly-once coverage and source-bound report completed | Findings, slice coverage, evaluation loss report | Deliver at decision ceiling; otherwise Replay |
| Replay | Complete analysis and available resources | Orchestrator implements isolated addition or regression repair and replays all associated losses | Measured replay pool; immutable independent variants | Every case settled; each retained edit converts at least five and 5% of associated losses with intended choice changed | Rule identities, source hashes, traces and outcomes | Assemble if any pass; otherwise Deliver |
| Assemble | Passing isolated edits | Orchestrator combines from mode base; changed isolated semantics re-pass replay; tools validate and update history | No extra combined-rule replay gate | Frozen valid candidate preserving attribution and unedited repair rules | Candidate hash, rule/replay references | Evaluate |
| Deliver | Final analysis or no passing edit | Orchestrator ranks existing comparable results, exports accepted source, checks consolidation and prunes eligible evidence | Sequential | Required analysis/decision/report/export verified | Checked report, export and retained compact history | Closed |
| Suspend/resume | Stop or authorized continuation | Orchestrator shuts down owned work, settles/checkpoints and reports; verifies prior checkpoint before resume | No new admission while suspended | Applicable explicit authorization and sufficient remaining/increased resources | Prior stage, pending coverage, identities and budgets | Verified prior stage or explicit incomplete closure |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Frozen opposition | Supplied opponents plus starting AI | None within run | Packages, order and identities | Setup/source hashes |
| Accepted control | Starting source | Strictly improving valid evaluated candidates | Separate reference from HEAD/rejections | Paired intersection and decision binding |
| Paired execution | Pinned schedule/IDs | Trajectories through AI choices/sideboarding | Starting deck orders, seeds, sides, rules/content | Integrity and input binding checks |
| Analysis/replay base | Accepted source ordinarily; regressing candidate for repair | Next iteration mode selection | Each isolated test compares unchanged selected source | Source-bound report, immutable variant hashes |
| Rules | Stable IDs and included-ID sets | Add one ordinarily; remove/update one in repair | Repair adds none and preserves unedited rules | Replay attribution and assembly validation |
| Execution identity | Current session-typescript/v1 and calibrated environment | Recalibration on mismatch; incompatible legacy requires fresh run | Valid reuse requires exact matching inputs/settings/implementation/integrity | Reports, receipts and hashes |
| Analyst visibility | Explicit packet target-loss allowlist | No-loss slices open nothing | No other gameplay or concealed information | Page/log hashes and coverage audit |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions | 50 | Pin owner override | Persisted candidate decisions; baseline excluded | Analyze final evaluation, then deliver |
| Evaluation | 2500 four-game matches per evaluation | Pin total and opponent allocation | Floor allocation plus first remainder; at least one each | Normal completion gate |
| Games | (1 + effective decisions) × matches × 4; recovery floor(10%) | No implicit increase | Failed/interrupted reservations and recovery count; reuse adds none | Exhausted recovery ignores remaining interrupted games; time/storage still suspend |
| Wall | 86400000 ms from original start | Explicit continuation/increase | Includes downtime/suspension and all diagnostics | Suspend |
| Storage | 50000000000 logical bytes | Explicit cap; active writer continuation under lock | Staging/log/evidence/import scope; 16000000-byte control reserve inside cap | Block data writes and suspend |
| Deadlines | Evaluation 18000000; preparation 600000; validation/replay branch 300000 ms | Resolve per stage/branch, cap by remaining wall | Launch-to-exit including replay prefix | Apply incident classification |
| Shutdown | 60000 ms | Effective configured grace | Owned groups only | Terminate owned groups, settle and checkpoint |
| Calibration | Workers 2 through logical CPUs | No arbitrary fallback | Required repetitions; replay two, complete independent largest-stage batches; choose smallest within 3% fastest median | Retry failed count stage once; exclude after second failure; no qualifier stops preparation |
| Rule replay | No game quota | All associated losses required | Separate controls/takeovers/diagnostics from evaluation; all consume time/storage | Resource exhaustion suspends |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report; finalize ignored; continue safe jobs | Never retry case | Timeout reason and accounting | No retry; evaluation paired exclusion; replay denominator retained |
| Interrupted evaluation | Preserve verified completions and recover missing work | Automatic within 10% allowance | Every reservation/attempt/timeout | Safe within resources/deadlines; remaining interrupted games ignored after allowance |
| Calibration failure | Fresh evidence directory with identical pinned inputs | One failed-stage retry | Both attempts, exclusions and retry state | Other worker counts continue; at least one qualifies |
| Unsupported package pre-admission | Preserve validation; adapt build/validation tooling and run related checks | Fresh validation only | Failed validation evidence | Valid package without protected changes, otherwise stop |
| Integrity/input-prefix or other non-timeout validation failure | Stop and preserve unsafe state | No generic retry | Errors, bindings and checkpoint | Applicable explicit continuation; integrity must be resolved |
| Time/storage exhaustion | Stop admission; settle/shut down; suspend | No implicit resource increase | Resumable detail and blocking marker | Explicit continuation/increase; no ranking/export/closure cleanup during suspension |
| Owner stop or analyst failure | Stop admission/owned work | No automatic restart | Claims and uncovered losses | Explicit instruction on same verified checkpoint; avoid duplicate owners |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Shared state | Effective configuration, identities, decisions, receipts references, accounting and checkpoints | run.json and iterations/iteration-N/iteration.json | Compact state after closure | Consolidate without duplicate ledgers |
| Gameplay and replay evidence | Typed lossless .log, receipts, slices/pages/findings, source hashes, variants, traces and schedules | Existing run/game/analysis paths | All execution/validation/replay/reuse/resume needs end; accepted detail additionally replacement or closure | Designated pruning tool, owner retention honored; never resource-suspension cleanup |
| Evaluation report | English eligible reasons, distinct-loss counts, all source-qualified replay points, coverage | baseline/loss-analysis.md or iterations/iteration-N/loss-analysis.md | Replay and other lifecycle needs end | Checked summary consolidation |
| Version archive/history | Initial and every evaluated candidate commits, immutable IDs/trailers, full SHA/path/outcome and compact attempts | Git and improvement-history.md | After closure | No permanent source copies; logs/dependencies outside Git |
| Report/export | Terminal state/reason, versions/results/ranking, rule totals, executed/reused/reserved accounting, budgets/errors, accepted export/hash and unresolved issues | Project location or artifacts/ | After closure | Checked closure report precedes eligible temporary cleanup; summary-only closed runs cannot provide cached evidence |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Prepare: “whole consecutive 250-match slices”; slice protocol: “last may be smaller” | Whether a nonmultiple match total is legal | Protocol explicitly permits a final short slice | Use ceil(matches/250) owners, retaining whole assignments | No; explicit reference resolves wording |
| A2 | Autonomy: “missing required limits”; Defaults supplies all major limits | Whether absent owner limits require asking despite defaults | Missing values covered by defaults are resolved automatically; ask only for required unresolved values from owning schema | Avoid needless confirmation while not inventing schema values | No, unless owning contract exposes an unresolved requirement |
| A3 | Calibration: “verify diagnostic admission classification…stop unresolved budget conflicts” | The package does not define diagnostic admission schema/classification | Discover owning entry-point schema and runner contract as instructed | Preparation cannot dispatch diagnostics until accounting classification is verified | External contract inspection required; no package change necessarily needed |
| A4 | Limits: “timeoutsMs per stage/branch”; defaults omit dedicated analysis/calibration timeout | Whether these use existing deadline keys or additional resolved values | Discover authoritative schema; do not invent keys or silently reuse unrelated timeouts | Resolve before launching those stages, asking only if required values remain missing | Potentially, depending on owning contract |

The package deliberately delegates exact schemas and execution mechanics to repository contracts; those external sources were outside this review's allowed reading scope. This explanation therefore records their verification as mandatory gates rather than claiming that command compatibility has been tested.
