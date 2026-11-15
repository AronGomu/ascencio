# Explanation from reviewer 2 for refined skill execution

## 1. Outcome and scope

Improve one required target AI against frozen opponents, including its starting self. Optional opponents, owner limits and compatible checkpoint shape the run. Only target AI changes; completion delivers accepted source, verified comparisons and compact history, honestly unchanged if nothing qualifies. Publishing requires separate authorization.

## 2. Process overview

Prepare, evaluate baseline, decide, then analyze. Repeat isolated replay, assembly, evaluation, decision and analysis until the decision ceiling or no qualifying edit; deliver after final analysis. Stops override progression. Orchestrator implements; delegated analysts diagnose only. Tools execute and persist evidence; humans verify semantic gates.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved inputs | Orchestrator setup, archive, calibrate | Calibration separate from evaluation/analysis | Compatible runner, verified setup, both matching recommendations | Pinned configuration/slices | Evaluate |
| Evaluate | Frozen baseline/candidate | Validate, reuse compatible evidence, dispatch missing matches | Measured match pool; four games/sideboarding sequential | All matches finalized, reservations settled, evidence verified | Coverage, results, paired difference | Decide |
| Decide | Verified evaluation | Baseline accepted; otherwise persist strict improvement decision, commit every evaluated candidate | Serialized transactions | Valid higher weighted paired game rate only | Decision, commit, history | Analyze |
| Analyze | Evaluation settled | Slice owners review every completed target loss; orchestrator merges | Whole consecutive 250-match slices queued for slots | Exactly-once coverage, source-bound report | Markdown findings/report | Replay or ceiling→Deliver |
| Replay | Eligible reasons/history | Orchestrator isolated variants and all associated losses | Measured replay pool | All settled; ≥5 and ≥5% convert with intended choice changed | Hashes, traces, outcomes | Assemble or none→Deliver |
| Assemble | Passing edits | Combine, resolve overlaps, validate/freeze | No new combined gate | Material isolated changes revalidated | Candidate/history bindings | Evaluate |
| Deliver | Final analysis/no edit | Verify, rank existing comparisons, export, consolidate, clean | No new games | Checked report/export | Retained summary/history | Closed |
| Suspended | Stop/exhaustion | Shutdown owned work, settle, checkpoint/report | Grace then owned-group termination | Authorized verified continuation | Pending work/budgets/prior stage | Prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Comparison | Pinned opponents/schedule/runtime | Accepted reference moves | Decks, engine/content, seeds, sides, initial orders | Hashes, paired intersections |
| Ordinary mode | Accepted source/analysis | Add one isolated fix | Comparator accepted | Source bindings |
| Repair mode | Valid regressing candidate | Remove/update one rule; add none | Other rules; comparator accepted | Candidate-loss evidence, new-loss metadata |
| Analysis/logs | Target-loss allowlists | Merge supported reasons globally | Unknowns and visibility boundaries | Packet hashes/decision IDs; typed lossless logs |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/evaluation | 50; 2500 total matches | Pin owner limits | Baseline excluded; four games/match; equal opponent allocation plus ordered remainder | Final analysis then deliver |
| Evaluation games | Planned 510000; recovery 51000 at defaults | Derive effective decisions | Failed/interrupted reservations count; caches add zero; separate diagnostics | Exhaust recovery: ignore interrupted remainder |
| Time/storage | 24h; decimal 50GB | Explicit resolved limits | Original start includes downtime; 16MB fixed reserve inside cap | Suspend |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay including prefix 5m; shutdown 60s | Effective overrides, capped by remaining wall | Launch-to-exit | Incident policy |
| Calibration | Workers 2…logical CPUs | Matching reuse only | Replay two repetitions/full batches; smallest within 3% fastest median; match calibrator repetitions | No qualifier/CPU<2 stops |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report, ignore; exclude paired counterpart | Never case retry | Outcome/accounting | Continue safe jobs |
| Interrupted evaluation | Recover missing work | Automatic 10% allowance only | Attempts/completions | Remaining resources |
| Calibration failure | Fresh directory, identical inputs | Once/count; then exclude | Both attempts/retry state | Successful qualifier |
| Unsupported format | Tooling-only adaptation before admission | Fresh validation; no game charge | Failure/checks | Valid protected boundaries |
| Integrity/initialization/sideboarding/validation | Stop | No generic retry | Failure evidence | Applicable authorization |
| Analyst failure/owner stop/resources | Halt admission, settle/shutdown | Explicit continuation | Claims, coverage, checkpoint | Same verified state; authorized limits |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Evidence/source builds | Logs, analyses, replay points, schedules, hashes | Existing run paths | Replay/reuse/resume dependencies finish | Checked closure; owner retention overrides |
| Compact records | Configuration, versions, W/L/D/rates, differences, coverage, rule counts, accounting/errors, accepted export/hash | State, report, Git, English history | After closure | Retain; summaries cannot seed cached evidence |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Controller/tools | Dispatcher versus enforcement | Stateless task printer/transition validator; resume accepts stage without checking authorization | Caller verifies gates; owning tools persist/account; no execution or semantic certification | No |
| A2 | Calibration | Admission classification external | Verify owning controller classification | Stop unresolved budget conflict; do not invent fallback | If unresolved |
