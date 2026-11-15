# Explanation from reviewer 2 for refined skill comprehension

## 1. Outcome and scope

Improve one required target AI against frozen starting-self plus optional opponents, delivering accepted source, verified paired-game results and history; unchanged is valid. Only target AI changes; decks, engine, legality and hidden information remain protected. Current session-typescript/v1 only. Interface configuration allows implicit invocation; orchestrator implements, analysts diagnose.

## 2. Process overview

Prepare → Evaluate → Decide → Analyze; continue through Replay → Assemble → Evaluate, or Deliver at decision ceiling/no qualifying edit. Every evaluation gets analysis, including rejected/final candidates. Suspension interrupts any active stage; verified authorized resume returns to its prior stage.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved target/checkpoint | Orchestrator setup, archive, calibrate | Separate pools; counts 2…CPUs | Verified setup; matching recommendations | Pinned configuration, slice plan | Evaluate |
| Evaluate | Frozen source/control | Owning tools reuse/run paired schedule | Optimal matches; four games sequential | All matches finalized, reservations settled, evidence verified | Paired difference/coverage | Decide |
| Decide | Evaluation complete | Orchestrator verify; tools persist/archive | One task | Strict valid weighted improvement; baseline uncounted | Decision, commit, history | Analyze |
| Analyze | Decided/finalized | Slice analysts; orchestrator merge | One owner/250-match slice; queued slots | Every completed target loss exactly once | Bound Markdown report | Replay/Deliver |
| Replay | Eligible reasons/history | Orchestrator isolated variants | Measured replay pool | All cases settle; ≥5 and ≥5% conversions | Hashes, points, outcomes | Assemble/Deliver |
| Assemble | Passing edits | Orchestrator combine/validate | One task | Preserve semantics; changed logic re-gated | Frozen candidate/history | Evaluate |
| Deliver | Legitimate stopping branch | Verify/rank/export/consolidate | No fresh games | Checked report | Accepted export/status | Closed |
| Suspended | Incident/stop | Shutdown, settle, checkpoint | Owned work only | Explicit verified continuation | Prior stage/pending/budgets | Prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Experiment | Setup sources/schedule | Accepted reference moves | Opponents, paired starts, seeds, sides, rules, identities | Hashes/bindings; matching reuse |
| Source mode | Accepted source | Ordinary adds one fix; regression removes/updates one rule | Repair base is regressing candidate; no additions; preserve others | Candidate-loss flags, isolated unchanged controls |
| Scoring | Completed paired intersection | Final ignores exclude both sides | Equal opponent weights; draws zero wins; each opponent paired | Rates/difference/coverage; no CI |
| Analysis | Allowlisted target losses | Merge equivalent reasons globally | Visible-only projections; unknowns preserved | Packet hashes, exact IDs, queue coverage |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/matches | 50 / 2500 | Pin effective owner limits | Decisions exclude baseline; matches floor/remainder across opponents | Analyze final; deliver |
| Evaluation games | 510000 + 51000 recovery | Derive effective plan | Reservations/failures/recovery count; caches zero | Interrupt allowance exhausted: ignore remainder |
| Time/storage | 24h / 50GB; 16MB reserve | Explicit effective configuration | Original start incl. downtime; logical/import bytes | Suspend |
| Deadlines | Evaluation 18m; preparation 10m; validation/replay 5m; shutdown 1m | Resolved per branch, wall-capped | Launch–exit; replay prefix included | Incident policy |
| Diagnostics/replays | No replay-game quota | Admission classification verified | Time/storage; separate from evaluation | Suspend/conflict stop |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Timeout | Report/ignore; safe jobs continue | None | Final timeout | Not retryable |
| Interrupted evaluation | Settle/recover | 10% allowance | Attempts/completions | Within limits |
| Calibration failure | Fresh evidence | Once/count; then exclude | Both attempts | Successful full repetitions |
| Unsupported pre-admission format | Tooling-only adaptation/checks | Fresh validation | Failed validation | Valid protected boundaries |
| Integrity/prefix/init/sideboard/other failure | Stop | No generic retry | Failure/checkpoint | Applicable explicit recovery |
| Analyst failure/owner stop/pause | Halt/settle owned work | Explicit continuation | Claims/uncovered work | Verified checkpoint |
| Resource exhaustion | Block admission/data writes | Explicit increase | Resumable detail | Full limits continuation; locked storage update |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State/report/history | Identities, outcomes, rules, accounting, errors, ranking/export hash | Existing run/iteration JSON; English history; project/artifacts report | Permanent compact record | Checked consolidation |
| Gameplay/analysis/replay | Typed lossless .log; Markdown findings/points/outcomes | Existing games/analyses paths | Validation/reuse/resume dependencies end | Closure; owner retention overrides |
| Builds/schedules/receipts | Hashes, frozen inputs, measurements | Temporary existing paths | Same dependencies | Remove after consolidation |
| Versions/export | Initial/every evaluated candidate commits; accepted package | Git/export path | Permanent | No permanent source copies; summary-only cannot cache |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Workflow/controller | Transition versus gate | Controller only validates labels/prints tasks; no state, execution, evidence or authorization checks | Caller verifies and persists gates; resume command alone insufficient | No |
| A2 | Replay/Incident | Settled timeout versus failure | Timeout denominator/nonconversion; integrity/non-timeout failure stops | No ordinary replay retry; unchanged/nonwinning choices alone do not reject rule | No |
| A3 | Source selection | Rejected analysis versus next base | Analyze rejection first; only valid lower rate selects repair | Ties/unassessable return to accepted analysis/base | No |
