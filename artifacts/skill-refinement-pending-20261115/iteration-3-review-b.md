# Explanation from review B for pending skill comprehension

## 1. Outcome and scope

Improve one supplied `ai-bot` against frozen opponents, always including its starting self. Deliver the accepted source, verified paired results and compact history; unchanged completion is legitimate. Only target AI changes. Defaults are Sol 6.1/low unless explicitly overridden. Use current `session-typescript/v1`, project tools and pinned owner limits; orchestrator implements, delegated analysts diagnose losses only.

## 2. Process overview

Prepare freezes setup and calibrates separate match/replay pools. Evaluate baseline, then combined candidates; Decide preserves or advances accepted source. Analyze every evaluation, including rejected/final ones. Eligible pending corrections receive isolated current-source replay; passing corrections assemble into another evaluation. Decision ceiling or no qualifying edit leads to delivery; resource exhaustion suspends. Controller validates edges but does not persist semantic evidence or authorize continuation.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Inputs resolved | Orchestrator setup, source archive, validation, policy, calibrations | Calibration separate from evaluation/analysis | Both matching recommendations; all counts 2..CPUs measured/excluded | Configuration, measurements | Evaluate |
| Evaluate | Frozen source/schedule | Tools reuse exact evidence or execute matches | Measured match pool; four games/sideboarding sequential; bounded slice pipeline | Every match final, accounting/evidence verified | Logs, aggregates, paired difference | Decide |
| Decide | Complete evaluation | Persist baseline or candidate outcome, commit evaluated version/history | One controller task | Strict valid paired improvement promotes; otherwise retain | Decision/checkpoint/commit | Analyze |
| Analyze | Finalized losses | Analysts claim whole slices, acknowledge ordered pages, submit complete first-pass reasons; orchestrator merges | Declared slots, one owner/slice; full default or explicit labeled partial cohort | Required coverage/report complete | Source-bound report, all reasons | Ceiling: Deliver; otherwise Replay |
| Replay | Authorized next iteration | Orchestrator creates isolated corrections and replays all accumulated cases | Measured replay pool | All settle; ≥5 converted wins AND ≥5%, intended choice changed | Current-source outcomes/ledger | Pass: Assemble; none: Deliver |
| Assemble | Passing rules | Combine, preserve semantics; materially changed logic replays again | No combined-rule replay gate | Validate/freeze combined candidate | Hash/history/rules | Evaluate |
| Deliver | Ordinary completion | Verify, rank existing comparable results, export/report | No fresh games | Checked consolidation and eligible cleanup | Accepted export/report | Closed |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Evaluation | Frozen setup/opponents | Accepted comparator advances | Seeds, inputs, schedule, engine/content/runtime, opponent order | Hashes, paired intersections; each opponent represented |
| Scoring | Games | Finalized ignores excluded symmetrically | Draws count as zero wins; equal opponent weighting | Strict weighted improvement; no confidence intervals |
| Ordinary source | Accepted AI | Add one fix per isolated variant | Matching analysis/control/assembly base | Rejected evaluation analyzed before returning to accepted analysis |
| Repair source | Valid regressing candidate | Remove/update one rule; add none | Other rules; accepted promotion comparator | Candidate-loss inspection, new-loss metadata; association is not causation |
| Pending rules | Stable reason/rule IDs, semantic hash, aliases | Explicit reconciliations; different correction gets new ID | Original provenance, ordered distinct cases | Fresh current-analysis-source control plus rule; no forced historical-policy prefix |
| Logs | Typed lossless `.log` | In-memory reconstruction | Exact choice IDs, observations and unknowns | Analyst positive allowlist: completed target losses only |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/matches | 50 decisions; 250 total four-game matches | Pin owner overrides | Baseline excluded from decisions; floor allocation plus ordered remainder | Analyze final evaluation, deliver |
| Games | Planned `(1+effective decisions)×matches×4`; recovery floor 10% | Frozen configuration | Failed/interrupted reservations count; cache zero; diagnostics separate | Recovery exhausted: ignore remaining interrupted games |
| Time/storage | 24h; 50GB decimal | Explicit authorized full-limits continuation | Original start includes downtime; logical bytes/imports; protected 16MB control reserve | Suspend, no export/ranking/cleanup |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay branch 5m; shutdown 60s | Resolved stage values | Launch-to-exit including replay prefix, capped by remaining wall time | Incident policy |
| Pending/replay | 300 distinct losses/rule; no replay game quota | No extra budgets authorized | Deterministic first-seen; duplicates add none | Valid complete current-source failure at 300: proven-discarded |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report, finalize ignored; replay denominator retained | Never that case | Outcome/accounting | Continue safe work |
| Interrupted evaluation | Recover missing work | 10% allowance | Verified completion/reservations | Resources/deadlines permit |
| Calibration failure | Fresh directory, same identity | Once/count, then exclude | Both attempts/exclusions | Qualifying pool remains |
| Invalid package | Adapt build/validation tooling only | Fresh validation; no games charged | Failure/checks | Valid protected boundaries |
| Integrity/initialization/sideboarding/non-timeout | Stop; resolve integrity first | No generic replay retry | Failure/checkpoint | Resolve; ask if unresolved |
| Budget/owner stop/analyst failure | Stop admission, bounded owned shutdown, settle reservations | No implicit increase | Claims, uncovered work, identities/budgets | Authorized verified continuation; owner stops need explicit instruction |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State/report | Identities, results, decisions, coverage, budgets, errors, checkpoint | Existing run state and one checked report | Durable compact history | Consolidate before eligible pruning |
| Evidence | Logs, packets/pages, findings, replay branches, hashes, schedules | Existing run paths | All execution/validation/replay/reuse/resume needs end | Rejected after summarized analysis/decision; accepted additionally replacement/closure; no suspension cleanup |
| Pending/failed ledger | All reasons including singletons; provenance/cases/current outcomes; terminal failure evidence | Durable cross-iteration ledger/history | Compatible continuation or durable failed history | Pending overrides ordinary pruning/exclusions; discard campaign inherits nothing without authorization |
| Source/history/export | Initial and every evaluated candidate commits, accepted hash/export, English attempt lines | Git/history/export | After closure | Temporary unevaluated variants uncommitted; no push without authorization |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Pending ledger / performance retention | Persistence schema/path absent; tools explicitly do not implement ledger | Orchestrator must establish durable bindings without editing generated records | Verify implementation before admission; blocked reconstruction remains pending, never fabricated failure | Implementation choice needed |
| A2 | Pending versus closure summary | Compact report excludes game IDs; ledger requires detailed cases | Separate durable pending/failed evidence survives compact reporting | Closure cannot erase pending evidence merely to produce summary-only run | No |
