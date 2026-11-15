# Explanation from reviewer 1 for refined execution

## 1. Outcome and scope

Improve one required target AI against frozen starting-self and optional extra opponents. Change target AI only; preserve decks, engine, legality and hidden information. Deliver accepted source, verified results and compact history; unchanged results are valid when nothing qualifies.

## 2. Process overview

Prepare → Evaluate → Decide → Analyze; continue through Replay → Assemble → Evaluate until the decision ceiling or no qualifying edit leads to Deliver. Analyze even the final evaluation. Any active stage may suspend. The dispatcher prints inherited instructions and validates event names only: it neither executes nor verifies gates, persists state, enforces budgets nor authorizes resume. Owning project tools and orchestrator verification remain necessary.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved bot/checkpoint | Orchestrator setup, initial commit, calibrations | Separate pools; no evaluation/analysis overlap | Compatible session-typescript/v1, verified setup, both matching recommendations | Configuration, sources, slice plan | Evaluate |
| Evaluate | Frozen baseline/candidate | Tools bind, admit, execute/reuse paired schedule | Measured match pool; four games/sideboarding sequential | All matches finalized, reservations settled, evidence verified | Results, paired difference | Decide |
| Decide | Verified results | Orchestrator verifies; tools persist/archive | Sequential | Baseline establishes reference; candidate strictly improves valid weighted paired rate | Every evaluated candidate commit, decision/history | Analyze |
| Analyze | Settled evaluation | Analysts diagnose; orchestrator merges | One owner per consecutive 250-match slice, queued to slots | Every completed target loss exactly once; source-bound report | Bound Markdown findings/report | Ceiling: Deliver; otherwise Replay |
| Replay | Eligible reasons/history checked | Orchestrator implements isolated variants | Measured replay pool; wait all cases | ≥5 conversions AND ≥5% associated losses, intended choice changed | Hashes, traces, outcomes | Passing: Assemble; none: Deliver |
| Assemble | Passing edits | Orchestrator combines mode base, validates/freezes | Sequential | Preserve semantics/attribution; materially changed isolated logic replays | Candidate/hash, rule history | Evaluate |
| Deliver | Completed search | Verify, rank existing results, export, consolidate, clean | Sequential | Checked evidence/report | Accepted export/hash, report | Closed |
| Suspended | Stop/exhaustion | Shutdown owned work, settle, checkpoint/report | Grace then owned-group termination | Verified checkpoint plus applicable explicit continuation | Pending work, budgets, prior stage | Authorized prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Comparisons | Starting-self/opponents frozen; accepted separate | Accepted moves on promotion | Sources, identities, schedule, seeds, sides, content/rules | Matching hashes; paired completed intersections; either ignored excludes both; draws zero wins; equal opponent weights; every opponent paired |
| Ordinary mode | Accepted analysis/control/base | Add one isolated fix | Separate accepted comparator | Rejected evaluation still analyzed first |
| Repair mode | Valid regressing candidate analysis/control/base | Remove/update one existing rule, add none | Unedited rules; accepted comparator | New-loss metadata; association ≠ causation |
| Evidence | Typed lossless logs | Target-only loss projections for analysts | Exact choices/IDs, unknowns | Allowlists, receipts, bindings; no winning/opponent gameplay |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/evaluation | 50; 2500 four-game matches total | Pin effective owner limits; matchesPerOpponent unset | Baseline excluded decisions; floor allocation plus ordered remainder; planned=(1+D)×matches×4; recovery=floor(10%) | Ceiling after analysis; recovery exhausted ignores remaining interrupted games |
| Time/storage | 86400000 ms; 50000000000 decimal bytes | Explicit resolved caps; continuation preserves consumption/start | Downtime included; logical/import bytes; fixed 16000000-byte reserve inside cap | Suspend; no ranking/export/cleanup |
| Deadlines | Evaluation 18000000; preparation 600000; validation/replay-prefix 300000; shutdown 60000 ms | Resolve/pin; cap by remaining wall | Launch-to-exit; reservations/failed attempts count; caches zero games | Incident policy |
| Calibration/replay | No rule-replay game quota | Both pools 2…logical CPUs; no fallback | Replay two repetitions, smallest within 3% fastest median; separate diagnostics/control/takeover accounting | No qualifying calibration stops Prepare |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Report, finalize ignored, continue safe jobs | Never case retry | Reason/count | Settled; replay timeout denominator retained |
| Interrupted evaluation | Recover missing work | Automatic within recovery budget | Completed evidence/all attempts | Deadlines/resources permit |
| Calibration failure | Fresh evidence, same inputs | Once per count; second excludes | Both attempts/exclusions | Fully successful required repetitions |
| Unsupported format | Tooling-only adaptation/local checks | Fresh validation before admission | Failure | Valid protected boundaries |
| Integrity/initialization/sideboarding/other validation failure | Stop | No generic retry | Error/evidence | Explicit resolution; unsafe states never ignored |
| Analyst failure/owner stop/resources | Halt, settle, checkpoint | Explicit continuation | Claims/uncovered losses/resumable detail | Verified same checkpoint; required increase/authorization |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State/history/export/report | Identities, rates/WLD/coverage, decisions/rules, budgets/errors, accepted commit/export/hash | Existing run/iteration state, Git, English history, project/artifacts | Permanently after closure | Checked consolidation; no confidence intervals |
| Detailed evidence/builds | Logs, analyses, replay points/outcomes, schedules/packages/receipts | Existing prescribed paths | Execution/replay/reuse/resume dependencies end | Checked closure only; owner retention overrides; suspended retains details |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Controller and tools; script | Legal transition versus verified completion | CLI validates syntax, caller verifies semantics | Never treat advance/resume success as authorization or evidence | No |
| A2 | Calibration | Diagnostic admission classification delegated externally | Verify owning controller before calibration | Stop unresolved budget conflict; do not infer free diagnostics | Only if unresolved |
