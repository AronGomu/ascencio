# Explanation from reviewer 2 for execution of the refined bot improvement skill

## 1. Outcome and scope

Improve the supplied target AI against frozen opponents, including its starting self, while preserving engine, decks, legality and information boundaries. Inputs are the target package, optional opponents, owner limits and a compatible checkpoint. Success delivers the strictly improving accepted source, verified paired results and compact history; an honest unchanged result also completes the search when no edit qualifies.

## 2. Process overview

Prepare a pinned current-TypeScript session and independent calibrations, evaluate baseline, then decide and analyze every evaluation. Diagnose complete target-loss slices, replay isolated hypotheses and combine passing edits for another evaluation. Continue until the decision ceiling or no qualifying edit; resources or stop incidents suspend instead. The stateless controller routes verified outcomes while project tools own persistent transactions.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved target/limits | Orchestrator reads contracts, setup, archives initial source, validates and calibrates | Calibration separate from evaluation/analysis | Matching successful match/replay recommendations and frozen configuration | Setup, identities, measurements, schedule | Evaluate |
| Evaluate | Frozen baseline or assembled candidate | Orchestrator binds accepted control and source, reuses exact evidence or dispatches missing matches | Optimal match workers; four games/sideboarding sequential | Every scheduled match finalized, reservations settled, evidence verified | Logs, receipts, results, paired coverage/difference | Decide |
| Decide | Evaluation complete | Orchestrator verifies strict game-weighted paired gain and persists decision/archive/history | Sequential | Baseline accepted without decision charge; candidate accepted only if valid and strictly better | Decision, commit, checkpoint | Analyze |
| Analyze | Full evaluation barrier | Analysts own disjoint whole 250-match slices; orchestrator merges verified first-pass findings | Slice owners queued into runtime slots | Exactly-once complete target-loss coverage and source-bound report | Findings/checkpoints, loss report | Deliver at ceiling; otherwise Replay |
| Replay | Eligible supported reasons and history checked | Orchestrator implements isolated add or regression removal/update variants, replays all associated losses | Measured replay pool bounded by resources | Each retained edit converts at least five and 5% of associated losses with changed intended choice | Immutable variants, replay evidence, dispositions | Assemble if any pass; otherwise Deliver |
| Assemble | Passing edits | Orchestrator combines mode-base edits and replays materially changed isolated logic | No combined-rule gate | Validated frozen candidate, attribution and history bindings | Candidate hash, rule/base/replay references | Evaluate |
| Deliver | Search complete with resources | Orchestrator checks analyses, ranks existing comparable results and exports accepted source | Sequential | Checked report and lifecycle consolidation | Export/hash, report, compact state/history | Closed |
| Suspend/resume | Incident or authorized continuation | Orchestrator stops owned work, settles/checkpoints and verifies authorization before resume | Shutdown bounded by grace | Preserved evidence and remaining/increased limits | Stop report, pending coverage, prior stage | Verified prior stage or explicit incomplete closure |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Comparison | Frozen setup/schedule | Accepted control advances on promotion | Opponents, engine/content/runner identities, starting paired inputs and randomness derivation | Hashes, source/transaction bindings, paired intersections |
| AI sources | Initial archive and explicit accepted reference | Target-only isolated edits and assembled candidates | Hidden-information/legality boundaries and repair rules not selected for change | Validation, immutable hashes, full commit SHA/path |
| Analysis source | Accepted source ordinarily; regressing candidate for repair | Mode changes after valid regression | Unchanged replay control and assembly base match selected analysis source | Source-bound report and replay references |
| Analysis ownership | Frozen consecutive slices | Verified release/reassignment | One owner per whole slice, completed target-loss allowlist, exact coverage | Claims, tokens, packet/page hashes, audit |
| Versions | Stable bot ID, immutable unique version/run IDs | Accepted reference independent of HEAD | Commit trailers, historical identities | Recoverable commit journal and matching commit lookup |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/evaluation | 50 decisions; 2500 total four-game matches | Pin owner values before dispatch | Baseline excluded from decisions; equal allocation plus ordered remainder; planned games = (1 + effective decisions) × matches × 4 | Analyze final evaluation then deliver at ceiling |
| Recovery | floor(10% planned games) | No implicit increase | Failed/interrupted reservations and recovery executions count; cache reuse adds no games | Ignore remaining interrupted games and continue eligible work |
| Wall/storage | 24 hours; 50 GB logical bytes | Explicit effective configuration and authorized continuation | Original start includes downtime; shared gate reserves 16 MB control inside cap; track imports/staging/evidence | Suspend, block admission/data writes, preserve resume detail |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay branch 5m; shutdown 60s | Effective pinned timeouts capped by remaining wall time | Launch-to-exit including replay prefix | Incident-specific handling |
| Replay/calibration | No replay game quota; workers 2 through logical CPUs | Only matching successful measured recommendations | Time/storage include controls, takeovers and diagnostics; replay calibration two repetitions and smallest within 3% of fastest median | Stop if no qualifying workers or unresolved budget conflict |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Report bug, finalize ignored; exclude evaluation game on both paired sides | Never retry case | Timeout/accounting/reason | Other safe work continues |
| Interrupted evaluation | Preserve verified completion, settle attempts | Missing work within recovery allowance | Completed logs, reservations and deadlines | Automatic within resources |
| Calibration count failure | Retain failed measurement | One fresh-directory retry; second excludes count | Both attempts/retry state | Other qualifying counts continue |
| Unsupported package before admission | Adapt build/validation tooling only, local checks | Fresh validation; no game charge | Failed validation | Valid protected package, else stop |
| Integrity/input-prefix or non-timeout validation failure | Stop and preserve unsafe-state evidence | No generic retry | Inputs, errors and checkpoint | Applicable Incident authorization; no unsafe ignores |
| Resource exhaustion | Suspend all admission; preserve quota marker | Explicit increase/continuation | Full resumable detail and consumed budgets | Verified checkpoint and effective limits |
| Owner stop or analyst failure | Stop owned work within grace, settle/cancel | Explicit instruction | Claims, uncovered losses, pending jobs | Same verified checkpoint without duplicate ownership |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Compact state/history | Configuration/identities, decisions/accounting, English attempt lines, Git versions | Existing run.json, iteration.json, improvement-history.md | After closure | Preserve history; replacements marked SUPERSEDED |
| Execution/analysis evidence | Typed lossless logs, receipts, target-only views, findings, reports, replay traces and immutable variants | Existing game/evaluation directories | All execution, validation, replay, reuse/resume needs end | Rejected details additionally require summarized analysis/decision; accepted details require replacement or closure |
| Run report/export | Sources, results/rates/coverage, rules/counts, budgets/errors, state/checkpoint, accepted export/hash and ranking | Project location or artifacts | After closure | Check consolidation before eligible cleanup; summary-only closure cannot supply cached evidence |
| Suspended checkpoint | Prior stage, pending jobs/claims/reservations, identities, budgets and required continuation | Owning tools and report | Completion or explicit incomplete closure | No resource-suspension closure cleanup |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Source selection: “Add one fix”; Assemble: “Combine all passing edits” | Whether ordinary iteration permits only one addition overall or one addition per isolated variant | One fix per isolated variant, all independently passing fixes may be assembled | Multiple rules can enter one evaluated candidate | Helpful wording clarification |
| A2 | Replay gate: ignored timeouts “stay in denominator” | Whether threshold denominator includes every associated loss despite ignored replay cases | Yes, associated-loss count remains fixed | Timeouts reduce conversion percentage and never trigger retries | No, reading is sufficiently explicit |
| A3 | Prepare: “whole consecutive 250-match slices”; slice protocol: “last may be smaller” | Whether total matches must be a multiple of 250 | Final partial slice allowed; ceil defines workers | Arbitrary valid total does not require rounding matches | No, reference resolves it |
