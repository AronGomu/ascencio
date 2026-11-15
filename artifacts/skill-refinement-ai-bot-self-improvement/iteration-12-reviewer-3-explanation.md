# Explanation from reviewer 3 for AI bot improvement execution

## 1. Outcome and scope

Given a target bot, optional additional opponents and owner limits/checkpoint, improve only its AI against frozen opponents including its initial self. Success delivers the strictly improved accepted source, or honestly unchanged source, with verified paired results and compact retained history. Engine, deck, legality and hidden-information boundaries stay protected.

## 2. Process overview

Prepare frozen identities and calibrated pools, evaluate baseline, decide and analyze every evaluation, then replay isolated fixes before combining passing edits into another evaluated candidate. Lower valid results switch the next attempt to removing/updating existing rules from the regressing source; other outcomes return to accepted-source additions. Decision ceiling or no passing edit leads to delivery; incidents can override progression with suspension. The controller prints tasks/checks legal edges; owning project tools persist work and the orchestrator verifies gates.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Inputs resolved | Orchestrator discovers schemas, sets frozen session, archives start and calibrates | Calibration separate from evaluation/analysis | Valid current runner/setup; both recommendations match | Configuration, source commit, measurements | Evaluate |
| Evaluate | Frozen source admitted | Tools execute/reuse paired schedule | Measured match pool; four games and sideboarding sequential | All scheduled matches finalized, reservations settled, coverage/integrity verified | Logs, receipts, paired rates | Decide |
| Decide | Verified evaluation | Orchestrator verifies strict weighted paired improvement; tools persist/archive/history | Serial | Baseline establishes control; candidate accepted only if valid and strictly better | Outcome, SHA, difference | Analyze |
| Analyze | Evaluation barrier | Delegated analysts claim whole slices; orchestrator merges all findings | One owner per consecutive 250-match slice, queued slots | Exactly-once all target-loss coverage; complete source-bound report | Slice findings and loss-analysis.md | Deliver at ceiling; otherwise Replay |
| Replay | Source mode selected | Orchestrator implements isolated reasons and runs unchanged control/takeover | Measured replay pool; every reason settles | Reason supports ≥5 distinct losses; retain edit converting ≥5 and ≥5% with intended choice changed | Immutable hashes, traces, outcomes | Assemble if any pass; otherwise Deliver |
| Assemble | Passing edits | Orchestrator combines from mode base and validates; altered isolated logic replays again | No extra combined gate | Preserved semantics/attribution, frozen candidate, history updated | Candidate binding and rules | Evaluate |
| Deliver | Complete analyses and terminal normal branch | Tools rank existing comparisons, export, consolidate/check report, prune eligible detail | Serial | Checked delivery, actual completion status | Export/hash and report | Closed |
| Suspend/resume | Overriding incident | Stop owned work, settle/checkpoint; resume verified prior stage only with authorization | Shutdown bounded by grace | Limits/incident authorization permit continuation | Pending coverage, identities, budgets | Prior stage or explicit incomplete closure |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Opponents/schedule | Starting source plus supplied opponents | None within run | Source hashes, opponent order, paired starting inputs/IDs and engine/content/runtime identities | Setup, admission, reuse integrity |
| Accepted/source modes | Initial archived source | Accepted moves only on promotion; regression replay base may differ | Separate accepted comparator, analysis source and assembly base bindings | Decision and replay records |
| Rules/versions | Stable IDs and immutable source hashes | New unique version per evaluated candidate; temporary variants uncommitted | Version/run IDs, trailers, intended bot/history-only commits | Commit helper journal and Git lookup |
| Analysis access | Target completed-loss allowlists | Matching findings reuse | No adjacent/full two-actor gameplay; visible information only | Packet/page hashes, IDs and audit |
| Scoring | Equal opponent weight | Paired completed intersection per comparison | Games as unit; draws zero wins in denominator; exclude either ignored side from both | Coverage for every opponent and paired aggregate |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/matches | 50 decisions; 2500 total four-game matches | Pin effective owner values in setup | Baseline not decision; allocate quotient/remainder by frozen opponent order | Final analysis then delivery at decision ceiling |
| Evaluation games | Planned=(1+effective decisions)×matches×4; recovery=floor(10% planned) | No implicit enlargement | Failed/interrupted reservations and recovery executions count; cache adds none | Recovery exhausted: ignore remaining interrupted games and continue eligible work |
| Wall/storage | 24h from original startedAt; 50 GB logical bytes | Explicit authorized increase/continuation | Include downtime/imports, diagnostics and evidence; 16 MB control reserve inside cap | Suspend; no further analysis/export/cleanup |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay 5m; shutdown 60s | Resolve stage/branch timeouts, cap at remaining wall | Launch-to-exit including replay prefix | Apply timeout/incident classification |
| Pools | All counts 2..logical CPUs | Matching recommendations required, no arbitrary fallback | Replay two full repetitions; smallest within 3% fastest median; calibrator owns match requirements | No qualifying count stops preparation |
| Rule replays | No game quota | All associated losses required | Controls/takeovers/calibration separate from evaluation | Time/storage still bound admission |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual game/replay timeout | Report bug, finalize ignore, continue safe work | Never retry case | Ignore reason/count; replay stays denominator/nonconversion | No interruption resume needed |
| Interrupted evaluation | Recover verified missing work within resources | Automatic only within recovery allocation | Reservations, attempts and completed evidence | Matching identities/deadlines |
| Calibration count failure | Fresh evidence directory, same inputs | Once; second failure excludes count/repetitions | Both attempts and exclusions across resume | Other counts may qualify |
| Unsupported format pre-admission | Adapt build/validation tooling only; fresh validation | Stop if still invalid | Validation failure, local checks | Protected boundaries remain valid |
| Integrity/input-prefix, initialization, sideboarding or other validation failure | Stop; never mark unsafe work ignored | No generic retry | Error and checkpoint | Applicable incident authorization; integrity always stops |
| Owner stop/analyst execution failure | Stop admissions and owned work | No automatic restart | Claims/uncovered losses; settled reservations | Explicit instruction and verified checkpoint |
| Resource exhaustion | Persist blocking marker and suspend | No automatic increase | Full resumable detail | Explicit limits/continuation; active storage increase uses writer lock then continuation commit |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Shared state | Config/identities, decisions, receipts, accounting, checkpoint | run.json and iteration.json | After closure compact state remains | Consolidate existing records, no duplicate ledger |
| Execution/analysis evidence | Typed .log, indexes, projections, findings, replay traces, variants, schedules | Existing run paths; baseline/iteration loss-analysis.md | Execution, validation, replay, reuse and resume needs end; accepted additionally replacement/closure | Designated pruning only; owner retention wins; suspension forbids cleanup |
| Versions/history | Every evaluated version including rejected; one English line per attempt, SUPERSEDED replacements | Git and improvement-history.md | Permanent after closure | No permanent source copies; unevaluated variants temporary |
| Checked report/export | State, identities, per-version results, rules/counts, accounting, accepted SHA/path/hash, errors/ranking | Project/artifacts and accepted export | After closure | Checked consolidation permits eligible detail deletion; summary-only runs cannot supply cache |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Prepare: “whole consecutive 250-match slices”; slice protocol: “last may be smaller” | Whole could imply divisibility by 250 | Whole means indivisible ownership; final slice may be short | ceil(matches/250) owners, no invented match rounding | No |
| A2 | Incident policy integrity always stops versus Suspended resume | Whether owner authorization can revive known failed integrity evidence | Resume can only proceed once safe identity/evidence is verifiably restored; failed evidence never reused | No ignored integrity failures or blind rerun | Only if such incident arises |

No other execution misunderstandings identified. External owning schemas/contracts are deliberately discovered at execution; this explanation does not infer their fields from the package.
