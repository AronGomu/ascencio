# Explanation from reviewer C for prospective bot improvement execution

## 1. Outcome and scope

Given `ai-bot` and optional opponents, limits/checkpoint, I would seek higher paired-game win rate and deliver accepted source, verified results and history. Only target AI changes; decks, engine, legality and hidden-information boundaries remain protected. Completion may retain the starting bot. This is prospective only.

## 2. Process overview

The controller loops Prepare → Evaluate → Decide → Analyze → Replay → Assemble → Evaluate. Analysis follows every decision. I implement variants and delegate diagnosis only. No qualifying edit or the decision ceiling leads to delivery; stops preserve verified continuation state.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Inputs resolved | Read contracts/defaults, freeze setup, archive start, calibrate | Calibration separate | Valid current runner and both recommendations | Configuration, identities, measurements | Evaluate |
| Evaluate | Frozen baseline/candidate | Tools bind comparator, reuse evidence, execute missing matches | Optimal independent matches; four games sequential | Schedule finalized, reservations settled, pairs verified | Results, coverage, difference | Decide |
| Decide | Evaluation complete | Verify gain; tools persist decision and commit source | Serial | Baseline reference or valid disposition archived | Commit, history, checkpoint | Analyze |
| Analyze | Full evaluation barrier | Analysts claim 250-match slices; reconcile report | Queued slice owners | Exactly-once loss coverage, all reasons merged | Findings, source-bound report | Replay or Deliver |
| Replay | Remaining decisions/resources | Implement isolated variants; replay every associated loss | Measured replay pool | Every case settled; at least five and 5% conversions per retained rule | Immutable variants, traces, counts | Assemble or Deliver |
| Assemble | Passing edits | Combine edits preserving semantics; validate/freeze | Serial | Changed logic requalified | Candidate hash, rule history | Evaluate |
| Deliver | Normal terminal edge | Export accepted source, rank comparable results, check consolidation | Serial | Analysis/report verified | Export, report | Closed |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Opponents | Starting AI plus requested bots | None | Packages/order | Hashes and setup |
| Comparison | Accepted source | Strict paired improvement | Matching schedule/inputs | Completed paired intersection |
| Randomness | Stable match/game IDs | Resulting trajectories | Seeds, sides, starting decks, rules/content | Bound execution records |
| Source mode | Accepted source | Regression repair uses regressor | Separate accepted comparator | Source/version hashes |
| Repair operation | Existing regressing rules | Remove/update one | Unedited rules; add none | Isolated source/replay |
| Analysis | Evaluated target losses | Supported reason reconciliation | Visible information, complete coverage | Allowlisted pages/logs and audit |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions | 50 | Pin owner value | Persisted candidate decisions; baseline excluded | Analyze then deliver |
| Matches | 2500 total | Pin owner value | Equal floor/remainder allocation; four games each | Require each opponent |
| Evaluation games | 510000 planned; 51000 recovery | Recompute effective decisions/matches | Attempts/reservations count; cache adds none | Recovery exhaustion finalizes interrupted remainder ignored |
| Wall/storage | 24 hours; 50 GB | Explicit continuation | Downtime included; logical/import bytes; 16 MB reserve | Suspend admission |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay 5m | Pin effective values | Launch-to-exit, prefix included, wall-capped | Incident policy |
| Calibration/replays | No replay game quota | Resource bounded | Diagnostics separate from evaluation; all use time/storage | Suspend or stop |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Timeout | Report bug; finalize ignored | Never that case | Outcome/reason | Continue safe jobs |
| Interrupted evaluation | Settle attempts, recover missing work | Within recovery allowance | Verified completions/reservations | Matching inputs/resources |
| Calibration stage failure | Fresh evidence directory | Once per failed stage | Attempts/exclusions | Successful qualifying count |
| Integrity, initialization, sideboarding failure | Stop | No generic retry | Failure and bindings | Applicable authorized checkpoint |
| Time/storage exhaustion | Suspend; quota marker blocks data writes | No implicit increase | Pending jobs, budgets, claims | Explicit sufficient continuation |
| Owner stop/analyst failure | Stop owned work; bounded shutdown | No restart | Uncovered losses/ownership | Explicit instruction |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Run state | Identities, decisions, accounting, checkpoint | Existing run/iteration JSON | Closure onward | Compact records retained |
| Evidence | Typed lossless logs, findings, variants, replay/calibration records | Existing execution paths | All execution/reuse/resume needs end; accepted replacement/closure | Lifecycle-eligible pruning only |
| Versions/history | Evaluated commits, English attempt lines, superseded status | Git and improvement history | Permanent | No source-copy archive |
| Report/export | Results, budgets, rules, errors, accepted hash/path | Project or artifacts | Permanent | Checked closure first |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Controller/tools links | Original-path controller/scripts | Treat implementations as runtime dependencies | Validate contracts before execution | Only if incompatible |
| A2 | Runner link | Minimum-interface anchor absent from linked headings | Locate current contract before setup | Do not assume legacy compatibility | If contract cannot be established |
| A3 | Missing required limits | Defaults exist alongside instruction to ask for missing limits | Resolve defaults; ask about unresolved requirements | Continue when resolved | Only unresolved inputs |
