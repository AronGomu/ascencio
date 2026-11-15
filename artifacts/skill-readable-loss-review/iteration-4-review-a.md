# Explanation from fresh reviewer A for readable-loss execution

## 1. Outcome and scope

Improve supplied AI through paired games against frozen opponents, including starting AI. Deliver accepted source/results/history, unchanged when necessary. Preserve decks, legality, engine and information boundaries.

## 2. Process overview

Prepare pins identities, budgets and calibration. Evaluate, Decide, then Analyze, including the final evaluation. Replay isolated corrections, assemble passing edits and repeat. Ceiling/no edit delivers; exhaustion suspends. Tools persist; the orchestrator verifies gates.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Package identified | Orchestrator validates, freezes setup, archives starting source and resolves policy | Calibration separate from gameplay/analysis | Verified setup and two usable recommendations | Configuration, identities, calibration | Evaluate |
| Evaluate | Source frozen | Tools reuse exact evidence or run missing paired matches | Saved match optimum; four games sequential | Schedule finalized, accounting settled, integrity verified | Logs, results, paired difference | Decide |
| Decide | Comparable evaluation | Orchestrator verifies strict improvement; tool persists decision and commits evaluated candidate | Sequential | Baseline reference or accepted/rejected outcome recorded | Commit, checkpoint, history | Analyze |
| Analyze | Finalized target losses | Fresh subagent reads each complete loss; queues primary and all secondary findings | Bounded runtime/RAM slots; slices publish only | Exactly-once required coverage and source-bound report | Markdown, choice maps, findings | Replay or Deliver |
| Replay | Analysis complete | Orchestrator implements isolated variants and tests associated losses | Measured replay capacity | Every case settled; gate passes or disposition retained | Ledger, controls/takeovers | Assemble or Deliver |
| Assemble | Passing rules | Combine preserving validated semantics; changed logic repeats isolated gate | No combined-rule gate | Validated, frozen candidate | Hash, history, replay links | Evaluate |
| Deliver | Legitimate completion | Rank existing comparisons, export accepted source, check consolidation | Sequential | Required decisions/analysis verified | Report and export/hash | Closed |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Comparisons | Pinned schedule/opponent order | Accepted reference advances | Starting orders, seeds, sides, content, implementations | Exact hashes and paired intersections |
| Source selection | Accepted source ordinarily | Valid regression uses regressing candidate for analysis/control/assembly | Promotion comparator remains accepted | Record accepted, replay and assembly sources separately |
| Isolated edits | Ordinary: add one fix | Regression: remove/update one rule, add none | No earlier fixes in isolated control | Source hashes and rule IDs |
| Review | Target-only completed-loss Markdown | Explicit partial policy changes coverage | Hidden information unknown; no winning/opponent gameplay access | Allowlist, exact decisions and choice maps |

Promotion requires strictly higher equally weighted game win rates; draws count zero. Remove ignored games from both paired sides. Require a completed pair per opponent; mismatches are unassessable; ties retain accepted.

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/evaluation | 50 decisions; 250 four-game matches | Pin owner values | Baseline excluded from decision count; distribute matches evenly with ordered remainder | Analyze final evaluation, deliver |
| Games | Planned: (1 + effective decisions) × matches × 4; recovery floor(10%) | Frozen configuration | Failed/interrupted reservations count; caches execute none | Finalize interrupted remainder ignored after allowance |
| Time/storage | 24 hours; 50 GB | Explicit full-limit continuation | Original start includes downtime; logical/import bytes; protected 16 MB reserve | Suspend; block admission/data writes |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay 5m; shutdown 60s | Effective configuration, remaining wall cap | Replay prefix included; controls/diagnostics separate | Incident-specific handling |

Reuse readable positive-integer recommendations within CPU count at `.cache/typescript-native-workers.json` and `.cache/replay-workers.json`; paths alone key reuse across version/source changes. Calibrate missing/unusable files or on owner request. Cover counts 2..CPUs; no qualifier stops preparation. Replay: two repetitions, identical outcomes, smallest count within 3% of fastest median.

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report; ignored, never conversion | None | Outcome/accounting | Safe jobs continue |
| Interrupted evaluation | Preserve verified completions | Recovery allowance only | Reservations and attempts | Remaining resources/deadlines |
| Failed calibration stage | Fresh-directory measurement | Once, then exclude count | Both attempts/exclusions | Same pinned identity |
| Integrity/non-timeout validation | Stop unsafe work | No generic retry | Diagnostics/checkpoint | Resolved issue; owner if unresolved |
| Pause, analyst failure, resource exhaustion | Stop owned groups within grace, settle reservations | No implicit extension | Claims, uncovered work, budgets | Explicit applicable authorization |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Rule ledger | Reasons, aliases, exact rule/source hashes, distinct cases and outcomes | Durable cross-iteration records | Compatible continuation or established disposition | Pending evidence overrides pruning |
| Execution evidence | Logs, readable files, replay traces, immutable variants, claims | Existing run paths | All validation/reuse/resume needs end | Rejected details eligible earlier; accepted until replacement/closure |
| History/report | Every evaluated version, rule disposition, results, accounting, errors, export | Git/history and project/artifacts | After closure | Checked consolidation precedes eligible deletion |

Replay needs five distinct losses. Pass: five converted wins AND 5%, with intended choice changed. Retain smaller groups; accumulate 300 first-seen distinct cases per rule. Retest all against current source with fresh controls; unsupported reconstruction blocks. Below thresholds remains pending below 300; valid complete failure at 300 proves exact-rule discard. Exhaustion never proves failure or extends budgets.

## 8. Ambiguities and interpretations

No execution-policy ambiguity identified. External owning schemas must still be inspected before execution; this review does not infer their fields.
