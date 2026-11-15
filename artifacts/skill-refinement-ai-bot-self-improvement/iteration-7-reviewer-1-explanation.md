# Explanation from reviewer 1 for independent workflow interpretation

## 1. Outcome and scope

Improve one required target AI against frozen starting-self and optional opponents, delivering accepted source, verified paired-game results and compact history. Owner limits/checkpoint are optional inputs. Only target AI changes; unchanged outcomes are valid completion. Push, publication and merge require separate authorization.

## 2. Process overview

Prepare → Evaluate → Decide → Analyze always includes final-evaluation analysis. Below the decision ceiling, Analyze → Replay → Assemble → Evaluate; no passing edit ends search. Limits or incidents suspend instead of completing. Resume preserves original configuration, start and consumed budgets.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved target/checkpoint | Orchestrator freezes setup, archives start, calibrates pools | Calibration separate | Compatible runner, verified setup, matching recommendations | Configuration, identities, slice plan | Evaluate |
| Evaluate | Frozen source | Tools bind control/schedule; reuse or execute | Optimal match pool; four games/sideboarding sequential | All matches finalized, reservations settled, comparability verified | Logs, receipts, paired results | Decide |
| Decide | Evaluation complete | Orchestrator verifies strict improvement; tools persist/archive | One decision | Baseline reference or accepted/rejected candidate recorded | Commit, decision, history | Analyze |
| Analyze | Settled evaluation | Diagnosis-only slice owners; orchestrator merges | One owner/250 consecutive matches; queue runtime slots | Every completed target loss exactly once; source-bound report | Findings, coverage, reasons | Replay or Deliver at ceiling |
| Replay | Eligible reasons/history checked | Orchestrator implements isolated variants; tools replay all associated losses | Measured replay pool | Every case settled; conversion gate passes | Hashes, controls/takeovers, outcomes | Assemble or Deliver |
| Assemble | Passing edits | Orchestrator combines; materially altered isolated logic replays | No combined-rule gate | Validated frozen candidate, attribution preserved | Candidate/history; no proposal.md | Evaluate |
| Deliver | Completed analysis/search | Rank existing comparable results, export/check report, eligible cleanup | No new games | Verified consolidation | Accepted export/report | Closed |
| Suspended | Stop event | Shutdown, settle, checkpoint/report | Owned groups only | Authorized verified continuation | Prior stage/pending coverage/budgets | Prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Inputs | Pinned commits/hashes/schedule | Accepted reference moves | Opponents, engine/content/runner, seeds/decks/sides; hidden-information boundaries | Bindings/integrity |
| Source modes | Accepted source | Ordinary adds one fix; valid regression repairs candidate by removing/updating one rule | Repair preserves unedited rules; comparator accepted; replay control equals analysis source | Hashes/source reports |
| Scoring | Completed paired games | Ignore either side on both | Draws denominator, equal opponent weight, one pair/opponent; strict improvement | Coverage/rates; no confidence intervals |
| Replay gate | Globally supported reasons | Rank count then severity | ≥5 losses eligible; ≥5 AND ≥5% convert to wins with intended choice changed | All associated primary decisions |
| Evidence access | Typed lossless .log | In-memory reconstruction | Analysts target-loss allowlists only; unknowns preserved | Packet hashes/unique coverage |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/matches | 50; 2,500 four-game matches/evaluation | Pin owner limits | Baseline excluded; floor/remainder opponent allocation | Final analysis/deliver |
| Evaluation games | 510,000 planned + 51,000 recovery | Effective decisions determine formula | Attempts/reservations count; cache free | Ignore unrecovered interruptions |
| Time/storage | 86,400,000 ms; 50,000,000,000 bytes | Explicit continuation/increase | Downtime; logical/import bytes; protected 16,000,000-byte control reserve | Suspend |
| Deadlines | Evaluation 18,000,000; preparation 600,000; validation/replay-prefix 300,000; shutdown 60,000 ms | Effective pinned values | Launch-to-exit, remaining-wall cap | Incident policy |
| Pools/replays | CPUs 2..logical maximum; no replay quota | Matching calibration required | Replay two repetitions, full largest batches, identical outcomes; smallest within 3% fastest median | No qualifier/CPU<2 stops |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Timeout | Report, ignored/nonconversion | Never case retry | Outcome/counts | Safe jobs continue |
| Interrupted evaluation | Recover missing work | 10% pool only | Attempts/completions | Within resources |
| Calibration failure | Fresh directory | Once/count; then exclude | Both attempts | Other counts qualify |
| Unsupported format | Tooling-only adaptation | Fresh validation | Failure/checks | Valid boundaries |
| Integrity/initialization/sideboarding/other failure | Stop | No generic replay retry | Checkpoint/errors | Applicable authorization |
| Resource/owner/analyst stop | Stop admission, bounded shutdown, settle | No implicit increase | Claims/uncovered work | Explicit verified continuation; quota marker blocks writes |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State/history | Identities, decisions, accounting; English attempt lines, SUPERSEDED replacements | run.json, iteration.json, Git/history | After closure | Compact permanent record |
| Execution details | Logs/indexes, Markdown findings, replay traces, hashes, frozen packages | Existing game/analysis paths | All execution/validation/reuse/resume needs end; accepted until replacement/closure | Eligible rejected details may prune during run; suspension forbids closure cleanup |
| Report/export | Versions/results, rules/coverage, budgets/errors, accepted commit/path/hash, ranking | Project/artifacts | After checked closure | Remove eligible temporaries; summary-only evidence cannot cache/replay |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Controller/tools | Dispatcher versus enforcement | Actual script validates stage/event names and prints inherited text; resume accepts any active prior-stage name | No execution, persistent state, evidence certification or authorization checks; caller/tools enforce gates | No |
| A2 | External entry-point links | Exact schemas unavailable within package | Discover before execution as instructed | This explanation cannot verify external tool enforcement | Before execution |
