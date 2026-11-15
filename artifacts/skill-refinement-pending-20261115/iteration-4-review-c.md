# Explanation from reviewer C for fresh comprehension review

## 1. Outcome and scope

Improve one supplied target AI through paired evaluation against frozen opponents, including its starting self; deliver accepted source, verified results and compact history, honestly retaining unchanged source when nothing qualifies. Optional opponents, owner limits and a compatible checkpoint refine the run. Only target AI changes; decks, engine, legality and hidden information remain protected. This package specifies orchestration rather than implementing campaign persistence itself.

## 2. Process overview

Prepare freezes identities, limits and calibrations; Evaluate runs baseline or assembled candidates; Decide records results; Analyze always follows, including after the final decision. Otherwise-authorized analysis selects the appropriate source mode and enters Replay. Passing isolated rules assemble into a candidate and loop through evaluation. No qualifying edit or the decision ceiling leads to delivery; incidents can suspend any active stage. The stateless controller prints tasks and checks legal edges; project tools persist state, while the orchestrator verifies semantic gates and authorization. Only loss diagnosis is delegated.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | New/compatible run | Orchestrator resolves defaults, setup, starting archive and both calibrations | Calibration excludes evaluation/analysis | Verified setup and matching recommendations | Pinned configuration, schedule, identities, calibration evidence | Evaluate |
| Evaluate | Baseline/validated combined candidate | Tools reuse verified evidence or execute missing paired matches | Optimal match workers; four games/sideboarding sequential per match; gated analysis pipeline | All scheduled matches finalized, accounting settled, evidence verified | Logs, results, paired difference, slices | Decide |
| Decide | Complete evaluation | Orchestrator verifies improvement; tools persist outcome/archive/history | Serialized decisions | Baseline accepted without candidate count; candidate accepted only for strict valid improvement | Decision, commit, checkpoint | Analyze |
| Analyze | Every decision | Analysts review allowlisted target losses, acknowledge ordered pages; orchestrator reconciles reasons | One owner per slice, bounded slots; explicit partial policies labeled | Required selected coverage/report complete | Per-match findings, source-bound report, pending ledger | Replay, Deliver at ceiling, or suspend |
| Replay | Further work authorized | Orchestrator builds isolated fixes/repairs, retests all eligible pending rules | Measured replay pool, resource gated | Every associated case settled and rule gates assessed | Immutable variants, current-source control/takeover outcomes, dispositions | Assemble if any pass; otherwise Deliver |
| Assemble | Passing edits | Combine from mode base, preserve semantics; replay materially changed logic; validate/freeze | No extra combined-rule gate | Valid candidate/history bindings | Candidate hash and rule references | Evaluate |
| Deliver/suspend | Completion/incident | Export and consolidate checked report, or shutdown/checkpoint | Stop admission when suspended | Closure only after verification; suspension remains incomplete | Report/export or resumable checkpoint | Closed/authorized prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Evaluation | Frozen starting AI/opponents and schedule | Accepted comparator moves | Starting inputs, opponent order, engine/content/runner identities | Hashes and completed paired intersections; every opponent represented |
| Ordinary mode | Accepted source | Add one fix per variant | Analysis, unchanged control and assembly base agree | Rejected evaluation still analyzed before returning to accepted analysis |
| Repair mode | Validly regressing candidate | Remove/update one rule, add none | Other rules retained; promotion comparator stays accepted | Candidate-loss diagnosis; paired new-loss metadata is association only |
| Pending rule | Stable reason/rule IDs and exact semantic hash | Explicit aliases/reconciliation; materially different correction gets new identity | Original provenance, decisions and distinct case identities | Fresh current-analysis-source control and plus-rule replay of every accumulated original input |

Scoring uses games: draws count as zero wins, opponents have equal weight, paired ignored games are excluded from both sides. Unresolved comparability is unassessable; ties/regressions retain accepted source. No confidence intervals.

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/evaluation | 50 decisions; 250 four-game matches/evaluation | Pin owner limits; four games fixed | Baseline excluded from decisions; ordered quotient/remainder opponent allocation | Analyze final decision; deliver |
| Games | Planned `(1+effective decisions)×matches×4`; recovery floor 10% | No implicit expansion | Failed/interrupted reservations count; caches execute none | Ignore remaining interrupted games after recovery allowance |
| Time/storage | 24h; 50GB; fixed 16MB control reserve | Explicit full-limits continuation | Original start includes downtime; logical/imported bytes count | Suspend; no analysis/export/cleanup |
| Stage timeouts | Evaluation 5h; preparation 10m; validation/replay branch 5m; shutdown 60s | Resolved overrides, capped by wall remainder | Launch-to-exit includes replay prefix | Incident policy |
| Rules | Eligibility five distinct losses; stack cap 300 | No extra iteration/resource authorization | Deterministic first-seen cases, repetitions add none; ignored replay timeouts remain denominator | Below cap, either failed threshold stays pending; at 300, complete valid current-source failure of five wins AND 5% gates proves exact rule discarded |

Calibration accounts for every worker count 2..logical CPUs with required successful repetitions or permitted exclusions; replay uses two repetitions and smallest count within 3% of fastest median. No qualifying count stops preparation. Replays/diagnostics consume time/storage, not evaluation game quota.

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report, finalized ignored outcome | Never retry case | Incident and denominator | Safe jobs continue |
| Interrupted evaluation | Recover missing work | Within recovery allowance | Attempts/reservations/completions | Remaining deadlines/resources |
| Calibration failure | Fresh evidence directory | Once per failed stage, then exclude count | Both attempts/exclusions | Other counts may continue |
| Unsupported pre-admission package | Adjust build/validation tooling only | Fresh validation | Failed validation | Protected boundaries hold |
| Integrity/initialization/sideboarding/non-timeout failure | Stop, resolve; ask if unresolved | No generic replay retry | Diagnostics/checkpoint | Verified resolution |
| Resource/owner/analyst stop | Stop owned work, bounded shutdown, settle reservations | No automatic budget increase | Claims, uncovered losses, identities, next stage/budgets | Explicit applicable continuation |

Unavailable exact current-policy reconstruction blocks a pending entry; it never creates non-conversions or discard.

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State/history | Configurations, decisions, accounting; compact attempt/version history | Existing run state, Git, English history | After closure | Keep durable summaries |
| Evidence | Typed lossless logs, projections/pages, findings, replay traces and identities | Existing game/analysis paths | All execution/reuse/resume needs end | Rejected details eligible after summarized decision/analysis; accepted additionally until replacement/closure |
| Pending/failed rules | Cases/provenance/current outcomes; terminal counts, denominator and hashes | Durable separate ledger/failed history | Compatible continuation/history needs | Pending overrides pruning and unsuccessful-rule exclusions; discarded campaign carries no stack without authorization |
| Report/export | Version results/ranking, rules, budgets/errors, accepted SHA/path/hash | Project/artifacts and accepted export | After closure | Checked consolidation precedes eligible cleanup; suspension prohibits closure cleanup |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Pending ledger / performance retention | Exact ledger schema/path and current-policy reconstruction support are not supplied | Orchestrator must persist verified bindings without assuming tools implement accumulation | Discover tooling; block unsupported replay rather than fabricate results | Needed only if implementation cannot safely represent required evidence |
| A2 | Closure consolidation versus pending retention | Closure report omits game IDs/details, but pending evidence must survive | Compact report is additional to required pending stack | No pruning of pending provenance simply because delivery/closure occurred | No; explicit pending override resolves priority |
