# Explanation from reviewer 2 for iteration 12

## 1. Outcome and scope

Given one target bot package, optional opponents/owner overrides and a compatible checkpoint, improve only target AI against frozen opponents including its starting self. Successful completion delivers the accepted source and verified paired-game results, with honest unchanged results when no candidate qualifies; protected engine, deck, legality and information boundaries remain fixed.

## 2. Process overview

Prepare a frozen session and both calibrated pools, evaluate baseline, decide, and fully analyze losses. Unless the decision ceiling or no qualifying edit ends the run, replay isolated fixes, combine passing edits, evaluate and decide again. A valid regression switches the next replay/assembly base to the regressing candidate for removal/update repairs. Incidents override ordinary progression; suspension preserves the checkpoint until authorized continuation.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved package/checkpoint | Orchestrator discovers owning schemas, pins setup/defaults, archives starting source, calibrates | Calibration separate from evaluation/analysis | Verified current runner/setup and both matching recommendations | Configuration, identities, calibration reports | Evaluate |
| Evaluate | Frozen baseline/candidate | Owning tools bind comparator/schedule, validate, reuse compatible evidence or execute missing matches | Optimal match pool; four games/sideboarding sequential | All matches finalize; reservations settle; integrity/coverage verified | Results, paired difference, receipts/logs | Decide |
| Decide | Complete evaluation | Orchestrator checks strict paired improvement; tools persist decision, candidate commit and history | Sequential | Baseline initializes accepted; valid higher candidate promotes; otherwise retain accepted | Decision, source SHA, history | Analyze |
| Analyze | Full evaluation barrier | Slice tools dispatch analysts; orchestrator merges all first-pass primary/secondary findings | Whole 250-match slices, one owner each; queued runtime slots | Exactly-once completed loss coverage and final source-bound report | Findings, coverage, loss report | Deliver at ceiling; otherwise Replay |
| Replay | Analysis complete, resources available | Orchestrator implements isolated ordinary additions or regression repairs; tools compare unchanged source and variants | Measured replay pool; all reason jobs settle | All associated losses replayed; intended-choice win conversions ≥5 and ≥5% | Immutable hashes, controls/takeovers, counts | Assemble if any pass; otherwise Deliver |
| Assemble | Passing isolated edits | Orchestrator combines, preserves semantics, repeats materially changed isolated gate, validates/freezes | No extra combined replay gate | Candidate binding/history complete | Rules, candidate hash, replay references | Evaluate |
| Deliver | Ceiling or no qualifying edit | Rank existing comparable results, export accepted source, verify consolidation | No fresh games | Required analyses/report checked before eligible cleanup | Export/hash, report, compact state/history | Closed |
| Suspend | Incident/limit/owner stop | Stop owned admission/work, settle and checkpoint through tools | Grace bounded shutdown | Owned groups stopped; pending work/budgets/identities recorded | Resumable checkpoint/report | Authorized verified prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Target and opponents | Frozen setup; starting self included | Target AI; moving accepted reference | Opponents and protected boundaries | Validation/source hashes |
| Comparison | Pinned engine/content/runner/configuration/schedule | Target choices and resulting trajectories | Starting paired inputs, sides, seeds, rules and order | Paired intersections and integrity |
| Source mode | Separate accepted, analysis and assembly identities | Ordinary accepted base; regression candidate repair base | Unedited repair rules; unchanged isolated controls | Bound hashes, rule IDs and replay references |
| Analysis access | Target completed-loss packet allowlist | Visible hypotheses; synonymous reason merging | No other gameplay traversal or hidden facts | Packet/page hashes, IDs, coverage audit |
| Version | Stable bot ID, unique immutable version/run ID | Commit each evaluated candidate and related follow-ups | Accepted independent of HEAD; no temporary-variant commits | Commit journal, full SHA/path/hash/trailers |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/matches | 50 decisions; 2500 four-game matches | Pin effective owner values; ≥one match/opponent | Baseline excluded from decisions; quotient/remainder allocation | Analyze last evaluation then deliver at ceiling |
| Evaluation games | Planned=(1+effective decisions)×matches×4; recovery=floor(10% planned) | No implicit recovery increase | Failed/interrupted reservations count; cache executions add zero; separate totals | Recovery exhaustion ignores remaining interrupted games |
| Time/storage | 24h; 50GB including fixed 16MB control reserve | Explicit authorized increase; preserve consumed budgets/start | Wall includes downtime; logical staging/import/evidence bytes | Suspend without analysis/export/cleanup |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay branch 5m; shutdown 60s | Resolve/pin effective values; cap by remaining wall | Launch-to-exit including replay prefix | Apply relevant timeout/stop incident |
| Pools | Workers 2 through logical CPUs | Matching measurement required; no arbitrary fallback | Match calibrator contract; replay two successful repetitions, smallest within 3% fastest median | No qualifying recommendation stops Prepare |
| Replays/diagnostics | No game quota for rule replay | Still time/storage bounded | Separate evaluation, validation, controls/takeovers and diagnostics | Resource suspension |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report and finalized ignored result; safe jobs continue | Never retry case | Timeout and paired exclusion/replay denominator | Ordinary work continues |
| Interrupted evaluation | Preserve completion, recover missing admitted work | Within fixed recovery allowance | Attempts/reservations/timeouts | Deadlines/resources permit |
| Calibration stage failure | Fresh evidence, same pinned inputs | One retry; second excludes worker count | Both attempts and exclusions | Other counts may qualify |
| Unsupported pre-admission format | Adapt build/validation tooling only; fresh validation/checks | No games charged | Failed validation | Valid protected package or stop |
| Integrity/prefix/init/sideboard/non-timeout validation failure | Stop | No generic retry | Error and checkpoint | Applicable incident authorization; never ignore unsafe state |
| Time/storage exhaustion | Stop all admission; quota marker blocks data writes | No implicit increase | Resumable detail and budgets | Explicit increase/continuation; active-writer storage increase uses locked full request |
| Owner stop/analyst failure | Stop owned work; preserve claims/uncovered losses | No automatic reassignment over live owners | Checkpoint and coverage | Explicit instruction on same verified checkpoint |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Shared records | Configuration, identities, decisions, receipts, accounting | Existing run.json and iteration.json | After closure | Compact retained state |
| Execution evidence | Typed .log, projections/pages/findings, replay traces, variant hashes, frozen inputs | Existing games/analysis/iteration paths | All validation/execution/reuse/resume needs end; accepted detail until replacement/closure | Designated pruning; no resource-suspension cleanup |
| Versions/history/export | Evaluated candidate commits, English attempt lines, superseded replacements, accepted export/hash | Git, improvement-history.md, export location | After closure | No permanent source-copy archive |
| Report | Versions/results/coverage, every rule, budgets/errors, accepted source/ranking/issues | Project or artifacts | After closure | Checked consolidation precedes eligible removal; summary-only closed runs cannot provide cached gameplay |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Autonomy and Inputs/Limits | “Missing required limits” versus complete defaults | Required limits mean unresolved effective configuration, not absence of owner overrides | Read defaults and proceed unless schema/input cannot resolve a required value | No |
| A2 | Source selection vs Replay workflow | Replay says wait for every reason job, while eligibility starts at five supported losses | Jobs cover globally eligible reason groups; smaller first-pass findings remain recorded | No replay of singleton/ineligible hypotheses solely because captured | No |
