# Explanation from readable_i5_c for fresh comprehension review

## 1. Outcome and scope

Improve one target AI against frozen opponents, including its starting AI. Deliver accepted source, verified results and history; unchanged source is valid when no edit qualifies. Only target AI changes; decks, engine, legality and hidden information stay fixed. Inputs: target package, optional opponents, limits, checkpoint.

## 2. Process overview

Prepare freezes setup and calibrations; Evaluate → Decide → Analyze always includes the final evaluation. Replay validates isolated rules; Assemble returns candidates to Evaluate. No qualifying edit ends through Deliver; resource exhaustion suspends. Controller checks transitions; tools persist; orchestrator implements and verifies gates. Diagnosis is delegated.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Target resolved | Orchestrator pins setup, source and policy; loads/calibrates workers | Calibration excludes evaluation/analysis | Valid current runner and both recommendations | Configuration, starting commit, measurements | Evaluate |
| Evaluate | Frozen validated source | Tools run missing paired schedule or reuse verified evidence | Independent matches parallel; four games and sideboarding sequential | Matches finalized, reservations settled | Logs, receipts, paired difference | Decide |
| Decide | Comparable evaluation | Verify improvement; persist decision/archive | Sequential | Baseline establishes reference; candidate accepted or rejected | Commit, decision, history | Analyze |
| Analyze | Published target losses | Fresh subagent reads complete loss and submits primary/secondary findings | One owner per loss; bounded runtime slots | Required coverage complete | Findings, coverage, pending reasons | Replay or Deliver at ceiling |
| Replay | Eligible accumulated reasons | Replay isolated rules across all cases | Measured replay pool, resource bounded | All cases settle; conversions meet both thresholds | Controls/takeovers, dispositions | Assemble or Deliver |
| Assemble | Passing edits | Combine, resolve overlaps, validate | Sequential | Changes re-pass gate | Candidate hash, attribution/history | Evaluate |
| Deliver | Required analyses complete | Export, rank comparable results, check report | No fresh games | Checked consolidation and eligible cleanup | Export/hash, report | Closed |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Comparison | Starting AI and opponents | Accepted comparator moves on promotion | Opponents, paired starting inputs and identity bindings | Source hashes, schedules and integrity |
| Scoring | Completed paired intersections | Remove either ignored side from both | Games as units; draws zero wins in denominator; equal opponent weights | Every opponent paired; strict increase; no confidence intervals |
| Ordinary source | Accepted source | Add one fix per isolated variant | Analysis, unchanged control and assembly share base | Source-bound evidence |
| Repair source | Valid lower-rate candidate | Remove/update one existing rule; add none | Preserve other rules; comparator remains accepted | Candidate-loss analysis and paired new-loss metadata |
| Pending rules | Stable reason/rule IDs and semantic hashes | Explicit alias reconciliation; new correction gets new identity | Original provenance | Fresh current-analysis-source reconstruction; historical prefixes cannot impose old choices |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/games | 50 decisions; 250 matches/evaluation | Pin owner limits | Baseline plus 50 candidates: 51 × 250 × 4 = 51,000 planned games; floor(10%) = 5,100 recovery; total 56,100 | Ceiling still requires final analysis |
| Match allocation | 250 total | Require at least one/opponent | For O opponents, floor(250/O) each plus first remainder; no matchesPerOpponent | Reject insufficient schedule |
| Time | 86,400,000 ms | Explicit continuation | Original start includes downtime; stage deadline capped by remainder | Suspend |
| Storage | 50,000,000,000 bytes | Explicit locked gate update | 16,000,000 reserve leaves 49,984,000,000 data bytes; imports/logical evidence count | Stop admission/writes |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay branch 5m; shutdown 60s | Resolved configuration | Launch-to-exit, replay prefix included | Applicable incident policy |
| Rule cases | 300 distinct losses/entry | No extra budget implied | Eligibility ≥5 losses; conversion gate ≥5 wins AND ≥5%; at 300 requires ≥15 | Valid cap failure discards exact rule |

Failed/interrupted reservations consume games; caches do not. Replays have no game quota; time/storage apply. Controls/takeovers/calibration are separate diagnostics. Pools cover workers 2 through logical CPUs. Replay calibration: two repetitions, smallest count within 3% of fastest median. Valid local recommendation paths survive source/version changes.

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Report, finalize ignored; never conversion | None | Incident and paired exclusions | Continue safe jobs |
| Interrupted evaluation | Recover missing work | Only 10% allowance; then ignore remainder | Reservations/completions | Remaining resources |
| Calibration failure | Fresh evidence directory | One retry then count exclusion | Both attempts/exclusions | Other qualifying counts |
| Integrity/initialization/sideboarding failure | Stop unsafe execution | No generic retry | Failure/input evidence | Resolved, authorized incident path |
| Resource or owner/analyst stop | Shutdown owned groups, settle, checkpoint | No implicit extension | Claims, uncovered losses, budgets | Explicit compatible continuation |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State/report | Identities, decisions, rates, coverage, budgets, errors, unresolved work | Existing run state and project/artifacts | Durable compact record | Checked consolidation |
| Temporary evidence | Typed lossless logs, readable losses/maps, replay traces, frozen variants | Existing run paths outside Git | All validation/reuse/resume needs end | Rejected detail may prune earlier; accepted until replacement/closure |
| Pending ledger | Every reason, accumulated cases and current outcomes | Durable cross-iteration records | Compatible future continuation or disposition | Pending evidence overrides ordinary pruning |
| Versions/history/export | Evaluated rejected and accepted commits; compact English attempts; accepted hash | Git and export path | After closure | No source-copy archive |

Suspension prohibits ranking, export, analysis and cleanup. Closed summary-only runs cannot supply verified caches.

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Controller/tools paths | Candidate instructions name canonical skill path | Treat as execution entry point, candidate remains read-only here | Real execution must verify deployed controller matches intended policy | Before execution if versions differ |
