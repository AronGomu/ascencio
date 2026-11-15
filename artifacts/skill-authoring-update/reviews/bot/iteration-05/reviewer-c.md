# Explanation from reviewer C for prospective bot-improvement execution

## 1. Outcome and scope

Given a target `ai-bot`, optional opponents, owner limits and compatible checkpoint, execution seeks a strictly higher paired-game win rate. Success delivers the accepted source, verified results and compact history; unchanged acceptance is legitimate when no edit qualifies. Only target AI changes. This explanation describes the candidate and its linked contracts prospectively; it executes no bot workflow.

## 2. Process overview

The orchestrator uses the stateless stage controller and owning persistence tools, implementing changes itself while delegating loss diagnosis. Prepare freezes inputs and calibrates both pools. Evaluate, Decide and Analyze repeat around Replay and Assemble. Every evaluation receives analysis, including the last. Replay failure or decision exhaustion leads to delivery; integrity failures stop, and resource exhaustion suspends. Checkpoint verification precedes controller advancement.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved target | Orchestrator reads runner/defaults, setup schema; freezes setup and archives starting source | Calibration separate from evaluation/analysis | Valid current runner, exact sources, both matching recommendations | Configuration, commits, schedule, measurements | Evaluate |
| Evaluate | Frozen baseline/candidate | Validate, bind accepted control and schedule; reuse verified evidence or dispatch missing work | Optimal match pool; four games/sideboarding sequential | All scheduled matches finalized; reservations settled; coverage verified | Logs, receipts, paired difference | Decide |
| Decide | Complete evaluation | Record baseline reference or strict promotion decision; archive every evaluated candidate | One controller task | Valid positive weighted difference accepts; otherwise retain incumbent | Decision, commit, history, checkpoint | Analyze |
| Analyze | Evaluation barrier | Slice owners review every allowlisted completed target loss; orchestrator reconciles global reasons | Fixed consecutive 250-match slices, one owner each; queued slots | Exactly-once audited coverage and source-bound report | Findings, checkpoints, final report | Deliver at ceiling; otherwise Replay |
| Replay | Eligible reasons/source mode | Orchestrator implements isolated variants; replay every associated primary critical point against unchanged source | Measured replay pool; wait for all jobs | Each retained edit converts ≥5 and ≥5% with intended choice changed | Immutable hashes, controls, takeover outcomes | Assemble if any pass; else Deliver |
| Assemble | Passing edits | Combine from selected base; preserve attribution and repair rules; validate/freeze | No combined-rule gate | Changed isolated semantics re-pass gate | History bindings, candidate hash | Evaluate |
| Deliver | Authorized normal termination | Verify analyses/decisions, rank comparable existing results, export accepted source, check report | No fresh ranking games | Accurate actual completion and checked consolidation | Export, report, history | Closed; eligible cleanup |
| Suspend/resume | Stop or resource event | Stop owned work, settle, checkpoint; resume verified prior stage only when authorized | Admission stopped | Applicable authorization and sufficient remaining limits | Stop report, pending coverage, budgets | Prior stage or explicit incomplete closure |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Comparison | Starting AI plus optional frozen opponents | Accepted comparator moves after promotion | Opponent source/order; paired starting inputs and randomness derivation | Bindings, hashes, paired intersection |
| Source mode | Accepted source | Regression repair uses regressing candidate for analysis/control/assembly | Promotion still compares accepted; repairs add no rules | Separate accepted/replay/base records |
| Execution | `session-typescript/v1` | Compatible tooling adaptation before admission | Engine/content/runner identities; protected boundaries | Validation and receipts |
| Review | Target-loss projections | Reason reconciliation across slices | Hidden information, exact choices, complete pages, unknowns | Packet/page hashes and coverage audit |
| Archives | Unique version/run IDs | Follow-ups reuse IDs | Immutable version identity; accepted independent of HEAD | Commit journal, SHA/path/hash |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/matches | 50; 2,500 four-game matches | Pin owner values | Baseline excluded from decisions; evenly allocate matches with ordered remainder | Final analysis then Deliver |
| Evaluation games | 510,000 planned; 51,000 recovery at defaults | Derived from effective decisions/matches | Failed/interrupted reservations count; cache reuse adds none | Exhausted recovery finalizes remaining interrupted games ignored |
| Time/storage | 24 h; 50 GB | Explicit continuation preserves consumption/start | Downtime counts; logical imported/staging/evidence bytes; protected 16 MB reserve | Suspend, block data writes |
| Deadlines | Evaluation 5 h; preparation 10 min; validation/replay 5 min; shutdown 60 s | Effective pinned limits; remaining wall cap | Launch-to-exit, replay prefix included | Incident handling |
| Calibration/replays | Workers 2 through logical CPUs; no replay-game quota | Matching measured recommendation required | Diagnostics separate; consume time/storage | No qualifying calibration stops preparation |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Report bug, finalize ignored; paired evaluation exclusion | Never retry case | Outcome/reason; replay denominator retained | Continue safe jobs |
| Interrupted evaluation | Recover missing work | Shared 10% recovery allowance | Attempts/reservations/completions | Valid inputs and resources |
| Calibration stage failure | Fresh directory, same inputs | Once; second excludes count | Both attempts and exclusions | Other counts may qualify |
| Unsupported package | Adapt build/validation only | Fresh validation | Failure and checks | Protected boundaries remain valid |
| Integrity/initialization/sideboarding/non-timeout failure | Stop | No generic retry | Unsafe state and checkpoint | Applicable explicit authorization |
| Resource/owner/analyst stop | Stop admission, bounded owned shutdown, settle | No implicit limit increase | Claims, uncovered work, identities, pending jobs | Verified checkpoint and applicable explicit continuation |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State | Configuration, identities, decisions, accounting | Existing `run.json` and iteration records | Durable compact history | Consolidate without duplicate ledgers |
| Detailed evidence | Typed logs, indexes, findings, replay traces, frozen packages | Existing game/evaluation paths | All execution/reuse/resume needs end; accepted additionally replaced/closed | Designated pruning tool; never suspension cleanup |
| Versions/history/export | Every evaluated commit, attempt line, accepted hash | Git; English history; export | After closure | No permanent archival source copies |
| Checked report | Versions/results, rules/counts, budgets/errors, accepted export, unresolved issues | Project or `artifacts/` | After closure | Aggregate without game/decision details; summary-only runs cannot supply cache |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Analyze ordering | Ceiling and exhaustion may coincide | Resource-stop override takes precedence | Suspend rather than deliver or rank | No |
| A2 | Calibration fixture | Fresh run has no current completed losses | Use retained compatible logs or deterministic diagnostic fixture explicitly permitted | Pin diagnostic classification and full identity before measurement | Only if no valid fixture exists |
| A3 | Controller paths | Candidate invokes canonical skill script | Treat canonical executable as owning implementation, candidate as prospective policy | Inspect schema at execution time; do not infer persistence from dispatcher | No |
