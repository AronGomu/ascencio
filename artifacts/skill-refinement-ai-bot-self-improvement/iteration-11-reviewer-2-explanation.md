# Explanation from reviewer 2 for refined bot improvement execution

## 1. Outcome and scope

Given one target AI package, optional opponents, owner limits and a compatible checkpoint, seek strict improvement in equally weighted paired game win rates. Only target AI changes; deliver verified accepted source, results and compact history, including honest unchanged completion when no edit qualifies. Publishing requires separate authorization.

## 2. Process overview

A stateless controller presents one stage at a time while project tools persist evidence and enforce reservations. Prepare frozen setup and separate calibrations; evaluate baseline or combined candidate; decide and always analyze all completed target losses. Either deliver at the decision ceiling, replay isolated edits then assemble passing edits for another evaluation, or deliver when none qualifies. Incidents can suspend any active stage.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Inputs resolved | Orchestrator discovers owning schemas, pins setup, archives starting source, validates and calibrates | Calibration separate from evaluation/analysis | Matching optimal match and replay recommendations and verified setup | Configuration, identities, schedule, calibration reports | Evaluate |
| Evaluate | Frozen baseline/candidate | Tools bind sources/control and reuse verified evidence or run missing work | Measured match pool; four games/sideboarding sequential | Every match finalized, reservations settled, comparability/resources verified | Logs, results, coverage, paired difference | Decide |
| Decide | Evaluation complete | Orchestrator verifies gate; tools persist decision/archive/history; baseline only sets accepted reference | Sequential | Strictly higher valid paired weighted rate promotes | Decision, commit, checkpoint | Analyze |
| Analyze | Full evaluation barrier | Slice tools publish/claim whole consecutive 250-match slices; delegated analysts inspect all allowlisted target losses; orchestrator merges reasons | One owner per slice; queued slots | Exactly-once coverage, source-bound report, globally ranked reasons | Findings, coverage, loss report | Ceiling: Deliver; otherwise Replay |
| Replay | Analysis complete, resources available | Orchestrator builds isolated add or repair variants and compares against unchanged analysis source | Measured replay pool; wait for every reason | All cases settled; at least five and 5% convert to wins with intended choice changed | Immutable hashes, control/takeover evidence, dispositions | Passing: Assemble; none: Deliver |
| Assemble | Passing isolated edits | Orchestrator combines all from mode base, resolves overlaps and replays materially changed logic; tools validate/freeze/history | Sequential assembly | Protected boundaries and validated semantics hold | Candidate hash/rule attribution/replay links | Evaluate |
| Deliver | Ceiling or no edit | Rank existing comparable results, export accepted source, check consolidated report then eligible cleanup | No fresh games | Required analyses/decisions verified | Export, report, retained history/state | Closed |
| Suspend/resume | Incident or explicit continuation | Stop owned work, settle/checkpoint/report; resume verified prior stage only with applicable authorization | Shutdown grace bounded | Owned shutdown verified and budgets available | Pending coverage, reservations, identities, prior stage | Suspended/prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Opponents and pairing | Starting AI plus supplied opponents | Accepted comparator moves after promotion | Frozen opponent order, starting inputs, engine/content/runner/comparison identities and stable randomness | Bindings/hashes and paired intersections |
| Sources | Archived initial source | Target AI candidate and accepted reference | Decks, engine, legality, hidden information boundaries | Source validation and commit hashes |
| Ordinary mode | Accepted source and matching analysis | Add one isolated fix before assembly | Unchanged replay control/base | Source-bound reports and variant hashes |
| Regression repair | Validly regressing candidate | Remove/update one existing rule per isolated variant | Other rules preserved; comparator remains accepted | New-loss metadata and candidate-loss analysis |
| Evidence reuse | Matching prior records | Reuse completed work | Inputs/settings/implementation/schedule/integrity | Provenance and executed/reused counts; analysis audit |
| Runtime/storage formats | session-typescript/v1; typed .log | Tool-generated state JSON | Existing command/key/path conventions | Fresh incompatible runs; native receipts and codec validation |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/matches | 50 decisions; 2500 four-game matches | Pin effective owner settings | Baseline excluded from decisions; floor allocation plus ordered remainder, at least one match/opponent | Analyze final decision, then deliver |
| Evaluation allowance | (1 + effective decisions) × matches × 4; recovery floor(10%) | Pin planned/recovery and sum | Failed/interrupted reservations and recovery executions count; caches do not | Recovery exhausted: ignore remaining interrupted games, continue eligible work |
| Time/storage | 24 hours; 50 GB | Explicit active continuation preserves consumption/start; storage increase uses writer-locked gate/full request | Include downtime, imports, staging and diagnostics; 16 MB protected control reserve | Suspend, block data writes, no ranking/export/cleanup |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay branch 5m; shutdown 60s | Resolve effective stage/branch settings | Launch-to-exit including replay prefix, capped by wall remainder | Apply relevant incident row |
| Calibration/replays | All workers 2..logical CPUs; replay two successful repetitions | No arbitrary worker fallback | Separate diagnostics consume time/storage, no rule-replay game quota | No qualifying calibration stops Prepare |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report, finalize ignored; paired evaluation excludes both sides; replay stays denominator without conversion | Never same case | Timeout/outcome/accounting | Continue safe jobs |
| Interrupted evaluation | Recover only missing work within resources/deadlines | Automatic within recovery allowance | Verified completions and every attempt/reservation | Valid remaining allowance |
| Calibration stage failure | Fresh evidence directory, same inputs | Once per failed worker-count stage; then exclude count and remaining repetitions | Both attempts/exclusions across resume | Other qualifying counts |
| Unsupported format before admission | Adapt build/validation tooling only and run local checks | Fresh validation directory; no game charge | Failed validation | Valid protected boundaries, otherwise stop |
| Integrity, prefix, initialization, sideboarding or non-timeout validation failure | Stop | No generic retry | Errors and checkpoints | Applicable explicit authorization and verified safe checkpoint |
| Resource/owner/analyst stop | Stop admission/owned work; settle and checkpoint within shutdown grace | No implicit budget increase | Claims, uncovered losses and pending jobs | Explicit instruction; closure can remain incomplete |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State/report | Configuration, identities, version results/paired coverage, rule dispositions, accounting, errors, accepted export/hash, terminal reason | Existing run.json/iteration.json and checked project/artifacts report | Compact records after closure | Consolidate without detailed game IDs/decision details |
| Execution evidence | Logs, receipts, slices/findings/reports, replay traces, hashes, packages, schedules, calibration records | Existing game/evaluation/run paths | All execution/validation/replay/reuse/resume needs end; accepted detail until replacement or closure | Designated pruning tool; never suspension cleanup or delivery alone |
| Source/history | Initial/every evaluated candidate commit, immutable version IDs/trailers, full SHA/path/outcome/hashes, one English attempt line, SUPERSEDED replacements | Git and improvement-history.md | After closure | No permanent source copies; temporary unevaluated variants uncommitted |
| Export | Accepted source/hash and comparable ranking | Report-linked export | After closure | Checked consolidation precedes eligible temporary cleanup; summaries cannot supply cached games |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Prepare / slice protocol | “Pin whole consecutive 250-match slices” versus explicit smaller last slice | Full chunks plus final remainder | Nonmultiples of 250 remain valid; worker count is ceiling | No; reference resolves it |
| A2 | Calibration / Limits | Other stage-specific timeouts must be resolved, but defaults cover only named branches | Discover required schemas and resolve missing required limits before admission | Do not invent unlisted calibration/analysis timeout values | Only if owning schema/records do not resolve them |
| A3 | Replay gate | “All associated losses” can include ignored replay timeouts, but only completed target losses enter diagnosis | Association starts from completed evaluation losses; later replay timeouts settle those cases | Keep timed-out replay cases in reason denominator without conversion | No |
