# Explanation from readable_i4_b for fresh execution review

## 1. Outcome and scope

Improve one bot against frozen opponents, including starting AI. Deliver accepted source/results/history; unchanged is acceptable. Preserve decks, engine, legality and hidden information.

## 2. Process overview

Prepare pins setup/calibration. Every evaluation requires Decide/Analyze. Replay precedes assembly/reevaluation. Improvement promotes; no edit delivers; exhaustion suspends.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Required bot identified | Resolve defaults, contracts, setup, archive and policy | Calibration separate from gameplay/analysis | Valid current runner and both recommendations | Configuration, hashes, calibration | Evaluate |
| Evaluate | Frozen validated source | Tools reuse compatible evidence or execute missing matches | Saved match workers; four games and sideboarding sequential | Scheduled work finalized, settled, verified | Paired results, logs, receipts | Decide |
| Decide | Complete comparable evaluation | Verify improvement; persist decision and commit candidate | One transaction | Baseline establishes reference; ties/regressions/unassessable retain accepted | Decision, SHA, history | Analyze |
| Analyze | Finalized target losses | Fresh subagent per loss reads entire Markdown; submits primary and secondary reasons once | Queue within runtime/RAM slots; bounded publication slices | Exactly-once coverage, source-bound report | Per-loss queue, per-match reports, ledger | Replay or Deliver |
| Replay | Eligible reasons | Implement variants; test every associated critical decision | Measured bounded replay workers | All cases settled; thresholds below | Controls, takeovers, rule/source bindings | Assemble or Deliver |
| Assemble | Passing edits | Combine, resolve overlap, validate/freeze, update history | No combined gate | Changed logic replays | Candidate hash and attribution | Evaluate |
| Deliver | Required work complete | Rank comparable results, export accepted, check consolidation | No games | Checked report before eligible cleanup | Export/hash, report | Closed |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Evaluation | Pinned sources, schedule, engine/content/runner | Accepted reference moves after promotion | Opponents, starting inputs, stable randomness | Hashes and paired intersections; each opponent needs a pair |
| Ordinary source | Accepted bot | One added fix per variant | Analysis, unchanged control and assembly share source | Separate accepted/source/base records |
| Repair source | Validly regressing candidate | Remove/update one rule, add none | Other candidate rules; promotion compares accepted | Candidate losses only; new-loss metadata flags association |
| Replay gate | Reasons with ≥5 distinct losses globally | Reconciled aliases | Independent variant versus unchanged source | ≥5 converted wins AND ≥5% associated losses, intended choice changed |
| Pending rules | Reason/rule/hash and cases | Accumulate first-seen cases up to 300 | Retest all | Block unsupported reconstruction; valid failure at 300 proves discard |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/matches | 50; 250 four-game matches per evaluation | Owner override | Decisions exclude baseline; distribute matches evenly with ordered remainder | Analyze last evaluation; deliver at ceiling |
| Evaluation games | 204,000 planned at defaults; 20,400 recovery | Derived from effective decisions | Failed/interrupted reservations and recoveries count; reuse adds none | Ignore remaining interrupted games after allowance |
| Time/storage | 24 hours; 50 GB with 16 MB control reserve | Explicit full-limits continuation | Downtime counts; logical staging/import/evidence bytes | Suspend admission; no ranking/export/cleanup |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay 5m; shutdown 60s | Resolved stage limits, capped by remaining wall time | Prefix included; diagnostics consume time/storage; no replay quota | Apply incident-specific outcome |
| Calibration | Both local recommendation files | Recalibrate only unusable file or owner request | Valid workers within CPUs; identities only provenance | Stop if no qualifying count |

Measure/exclude counts 2..CPUs. Replay uses two repetitions, full largest-stage batches and smallest count within 3% of fastest median. Resuming measurements requires identity; recommendations survive version changes.

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report, finalized ignored result; safe jobs continue | Never retry case | Outcome and paired exclusions | Not interrupted work |
| Calibration stage failure | Fresh directory, same inputs | Once, then exclude count | Both attempts/exclusions | Other counts may continue |
| Integrity/initialization/sideboard/non-timeout failure | Stop unsafe work | No generic retry | Diagnostics and source bindings | Resolve; ask owner if unresolved |
| Pause, analyst failure or exhaustion | Stop admission; bounded owned shutdown and settlement | No implicit budget increase | Claims, uncovered losses, checkpoint, budgets | Applicable explicit authorization and verified checkpoint |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Durable state/history | Configuration, decisions, accounting, every evaluated version including rejected | Existing run state, Git, English history | After closure | Preserve compact record |
| Temporary evidence | Typed logs, readable losses/maps, replay traces, packages, receipts | Existing execution paths | Validation, reuse, replay and resume needs end | Rejected detail also needs summarized analysis/decision; accepted needs replacement/closure |
| Pending ledger | Provenance, cases, current outcomes, blocked/pending status | Durable cross-iteration record | Compatible future continuation | Evidence overrides pruning |
| Checked report/export | Results, rules, coverage, accounting, accepted SHA/path/hash | Project/artifacts | After closure | Delivery permits no pruning; suspended detail remains |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Replay versus pending accumulation | Eligibility at five versus accumulated smaller stacks | Sub-five entries wait; eligible stacks receive current-source replay | Preserve singleton evidence without inventing replay eligibility | No |
