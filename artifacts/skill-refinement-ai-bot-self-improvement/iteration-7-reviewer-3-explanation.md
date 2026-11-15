# Explanation from reviewer 3 for independent skill review

## 1. Outcome and scope

Improve one required `ai-bot` against frozen opponents, including its starting AI, using reproducible paired games. Optional opponents, owner limits and compatible checkpoints configure the search. Only target AI changes; deliver accepted source, verified results and compact history, honestly retaining unchanged source if nothing qualifies.

## 2. Process overview

Prepare freezes identities and calibrates; Evaluate → Decide → Analyze runs even for the final candidate. Analysis either ends at the decision ceiling or feeds isolated Replay → Assemble → Evaluate. No passing edit ends early. Incidents override progression through suspension.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Inputs resolved | Orchestrator sets up, archives start, calibrates | Calibration separate from evaluation/analysis | Compatible setup; both matching recommendations | Configuration, slice plan, measurements | Evaluate |
| Evaluate | Frozen source | Tools bind/reuse/run paired schedule | Optimal match pool; four games/sideboarding sequential | All matches finalized, reservations settled, evidence verified | Results, coverage, paired difference | Decide |
| Decide | Evaluation complete | Orchestrator verifies; tools persist/archive | Serial | Baseline reference; otherwise strict valid improvement | Decision, commit, history | Analyze |
| Analyze | Settled evaluation | Diagnosis-only owners inspect allowlisted losses; orchestrator merges | One owner per consecutive 250-match slice, queued by available slots | Every completed target loss exactly once; final source-bound report | Per-match findings, merged reasons | Deliver at ceiling; otherwise Replay |
| Replay | Eligible reasons/history checked | Orchestrator implements isolated variants; tools replay every associated loss | Measured replay pool | All cases settled; ≥5 and ≥5% convert to wins with changed intended choice | Hashes, controls/takeovers, dispositions | Assemble if passing; otherwise Deliver |
| Assemble | Passing edits | Orchestrator combines, validates/freezes | Serial | Preserve replayed semantics; changed logic regated | Candidate, attributed history | Evaluate |
| Deliver | Search ended | Verify, rank existing comparable results, export, consolidate/check | Serial | Required analyses/decisions complete | Export, checked report | Closed; eligible cleanup |
| Suspended | Stop incident | Stop owned work, settle/checkpoint/report | Shutdown grace bounded | Authorization and verified checkpoint to resume | Prior stage, pending coverage, budgets | Prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Sources | Starting commit; frozen opponents | Accepted reference advances | Opponents, protected boundaries | Source hashes/commits |
| Source mode | Ordinary: accepted analysis/replay/base | Regression: remove/update one candidate rule; add none | Unedited repair rules; comparator accepted | Source-bound report and variant IDs |
| Pairing/scoring | Pinned seeds, orders, sides, engine/content/runner | Trajectories | Starting inputs; equal opponent weighting | Completed paired intersections; draws denominator; either ignored excluded both sides; each opponent paired |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/evaluation | 50 decisions; 2500 four-game matches/evaluation | Pin owner values | Baseline excluded from decisions; planned games `(1+D)×matches×4`; recovery floor(10%); caches zero | Analyze final evaluation; interrupted remainder ignored after recovery |
| Wall/storage | 86400000 ms; 50000000000 decimal bytes | Explicit resolved configuration/increase | Original start includes downtime; logical/import bytes; fixed 16000000-byte control reserve inside cap | Suspend, block admission/data writes |
| Deadlines | Evaluation 18000000; preparation 600000; validation/replay-prefix 300000; shutdown 60000 ms | Effective overrides; remaining-wall cap | Launch-to-exit; diagnostics/replays consume time/storage | Incident policy |
| Calibration | Every worker count 2…logical CPUs | Matching reuse only | Replay two successful repetitions, independent batches, identical outcomes; smallest within 3% fastest median | No qualifier/CPU<2 stops |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Report; ignored, never conversion | None | Outcome/accounting | Safe jobs continue |
| Interrupted evaluation/calibration | Preserve attempts | Evaluation recovery above; calibration count once, then exclude | Both attempts/retry state | Resources and valid inputs |
| Integrity/prefix or initialization/sideboarding/other validation failure | Stop | No generic replay retry | Errors/bindings | Applicable explicit continuation |
| Unsupported package pre-admission | Adapt tooling only | Fresh validation, no game charge | Failure/checks | Valid protected boundaries |
| Exhaustion/pause/cancel/analyst failure | Stop owned groups after grace; checkpoint | Explicit authorization | Claims, uncovered work, reservations | Same verified checkpoint; increased limits where needed |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State/history/report/export | Identities, versions/results, rules, accounting, errors, accepted SHA/hash | Existing run state, Git/history, project/artifacts | After closure | Compact permanent record |
| Execution evidence | Typed lossless `.log`, indexes, Markdown analyses, replay traces, hashes, receipts, frozen sources | Existing game/iteration paths | All execution/validation/replay/reuse/resume needs end; accepted also replacement/closure | Designated pruning; owner retention wins; suspension forbids closure cleanup |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Controller/tools; script | Stage advancement resembles enforcement | Dispatcher checks transition syntax and prints policy/tasks only | Caller verifies semantic gates, authorization and persisted checkpoint; no execution/state/certification | No |
| A2 | External entry points | Exact schemas unavailable within package | Discover from owning tools during execution | No invented CLI/schema or legacy adaptation | At execution if unresolved |
