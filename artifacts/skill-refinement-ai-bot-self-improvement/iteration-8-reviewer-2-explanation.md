# Explanation from reviewer 2 for independent workflow review

## 1. Outcome and scope

Improve one required target AI against frozen opponents, including its starting self; optional opponents, owner limits and compatible checkpoint constrain execution. Deliver accepted source, verified game results and compact history, honestly retaining unchanged source when nothing qualifies. Only target AI changes; decks, engine, legality and hidden information remain protected. Current `session-typescript/v1` only.

## 2. Process overview

Prepare → Evaluate → Decide → Analyze → Replay → Assemble → Evaluate loops until the decision ceiling or no qualifying edit; then Deliver → Closed. Every evaluated version receives analysis, including the last rejection. Exhaustion/stop suspends instead. The orchestrator implements; analysts diagnose losses only.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved target/checkpoint | Orchestrator sets up, archives start, validates, calibrates | Separate pools, no evaluation/analysis overlap | Verified setup and matching recommendations | Configuration, schedule, identities | Evaluate |
| Evaluate | Frozen valid source | Tools reuse compatible evidence/run missing matches | Optimal matches; four games/sideboarding sequential | All matches final, reservations settled | Results, paired difference, receipts | Decide |
| Decide | Verified evaluation | Orchestrator verifies strict improvement; tools persist/archive | Transaction owned | Baseline accepted without decision; candidates counted | Commit, decision, history | Analyze |
| Analyze | Finalized evaluation | Slice owners inspect allowlisted losses; orchestrator merges | One owner/whole consecutive 250-match slice; slot queue | Exactly-once coverage, source-bound report | Findings, loss report | Replay or ceiling→Deliver |
| Replay | Eligible reasons/history checked | Orchestrator implements isolated variants, executes controls/takeovers | Measured replay pool | Every associated case settles; rule gate below | Hashes, rule IDs, replay evidence | Passing→Assemble; none→Deliver |
| Assemble | Passing edits | Combine from mode base, resolve overlaps; validate/freeze | No extra combined gate | Changed isolated semantics re-pass replay | Candidate, bound history | Evaluate |
| Deliver | Completed decisions/analysis | Rank existing comparable results, export/check report, eligible cleanup | No fresh games | Checked consolidation | Export/hash, report | Closed |
| Suspended | Any active interruption | Shutdown owned groups, settle/checkpoint/report | Grace-limited | Explicit authorization plus verified checkpoint/limits | Pending coverage, budgets, prior stage | Prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Comparison | Pinned setup | Accepted comparator advances | Opponents, ordered paired starts/seeds/sides/rules/content; deterministic IDs | Hashes, bindings, integrity |
| Source modes | Accepted source | Ordinary adds one fix; valid regression removes/updates one rule from regressing source | Repair’s other rules; comparator remains accepted | Distinct accepted/analysis/base identities |
| Evidence/scoring | Completed paired intersections | Valid cache reuse | Games scored; draws zero wins; equal opponent weights; ignored excluded both sides; pair/opponent required | Provenance, coverage, reasons |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Evaluation | 50 decisions; 2,500 total four-game matches/evaluation | Pin owner values | Floor allocation plus ordered remainder; ≥1/opponent; planned=(1+decisions)×matches×4; recovery=floor(10%) | Recovery exhausted: ignore missing interrupted games |
| Resources | 86,400,000 ms; 50,000,000,000 bytes | Explicit continuation; full effective limits | Original start includes downtime; logical/import bytes; 16,000,000-byte control reserve | Suspend, block data writes |
| Deadlines | Evaluation 18,000,000; preparation 600,000; validation/replay-prefix 300,000; shutdown 60,000 ms | Resolve/pin, cap remaining wall | Launch-to-exit; caches no games; diagnostics separate | Incident policy |
| Calibration | Workers 2…logical CPUs | Matching recommendation reuse | Replay two full repetitions; smallest within 3% fastest successful median | No qualifier/<2 CPUs stops |
| Rule gate | ≥5 supported losses | No weaker threshold | All associated losses; ≥5 AND ≥5% win conversions with changed intended choice; timeout denominator retained | Exclude failing rule |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report, finalize ignored | Never | Outcome/accounting | Continue safe jobs |
| Interrupted evaluation | Recover missing work | Within recovery budget | Reservations/completions | Resources/deadlines permit |
| Calibration stage failure | Fresh directory, same inputs | Once; second excludes count | Both attempts/exclusions | Other counts qualify |
| Unsupported format pre-admission | Tooling-only adaptation/local validation | Fresh validation; no game charge | Failure | Valid protected package |
| Integrity/initialization/sideboarding/other failure | Stop | No generic replay retry | Full evidence | Applicable authorization |
| Pause, cancellation, analyst failure, exhaustion | Stop admission/shutdown/checkpoint | Explicit continuation | Claims/uncovered work | Same verified checkpoint; increased limits if needed |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State/history/report | Identities, versions/results/rules, aggregate accounting/errors, accepted export/hash | Existing run JSON; Git/history; project/artifacts | Compact records permanent | Checked closure consolidation |
| Execution detail | Typed lossless logs, projections, replay traces, hashes, frozen packages, receipts | Existing game/analysis paths | All execution/validation/reuse/resume needs end; accepted additionally replacement/closure | Designated pruning; owner retention wins; no suspension cleanup |

Closure summaries omit game IDs/decision details; summary-only closed runs cannot supply caches. Starting/evaluated candidates receive commits, including rejections; temporary variants do not. No permanent source copies.

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Controller/tools | Stage command may resemble enforcement | Dispatcher prints inherited/current instructions and validates transition names only | Caller verifies gates, checkpoints and resume authorization; tools enforce admission, storage, claims and publication | No |
| A2 | External entry points | Exact schemas/enforcement unavailable within package | Linked owning contracts remain mandatory dependencies | No invented CLI/schema or claim of self-contained execution | Before execution |
