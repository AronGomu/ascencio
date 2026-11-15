# Explanation from reviewer 3 for refined improvement execution

## 1. Outcome and scope

Improve one required target AI against frozen starting-self plus optional opponents; deliver accepted source, verified paired-game results and compact history, honestly retaining unchanged source if nothing qualifies. Owner limits and a compatible checkpoint are optional inputs. Only target AI changes; engine, decks, legality and information boundaries remain protected.

## 2. Process overview

Prepare → Evaluate → Decide → Analyze; then Replay → Assemble → Evaluate repeats until decision ceiling or no qualifying edit sends delivery. Final evaluation still receives analysis. Resources and owner stops override progression. The stage printer validates transition syntax only: it neither executes, persists state, verifies evidence nor authorizes resume. Session, match, storage, slice, decision and archive tools retain their respective authority.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved input | Orchestrator sets up, archives start, validates, calibrates | Separate pools; no evaluation/analysis overlap | Matching successful recommendations and verified setup | Configuration, identities, slice plan | Evaluate |
| Evaluate | Frozen baseline/candidate | Match tools reuse verified evidence/run missing work | Optimal matches; four games/sideboarding sequential | All scheduled matches finalized, reservations settled, coverage verified | Logs, receipts, paired results | Decide |
| Decide | Complete evaluation | Independently verify improvement; decision/archive tools persist | Serial | Baseline accepted without decision; candidate strictly improves valid weighted paired rate | Decision, commit, history | Analyze |
| Analyze | Settled evaluation | Diagnosis-only analysts; orchestrator merges | One whole consecutive 250-match slice per owner, queued slots | Every completed target loss exactly once; source-bound report | Bound Markdown reports | Deliver at ceiling, otherwise Replay |
| Replay | Eligible source reasons | Orchestrator implements isolated rules | Measured replay pool | All associated cases settle; ≥5 and ≥5% convert with intended choice changed | Hashes, control/takeover evidence | Assemble if passing, else Deliver |
| Assemble | Passing edits | Combine preserving semantics/attribution; validate/freeze | Serial | Changed isolated logic re-gated; no combined gate | Candidate/history references | Evaluate |
| Deliver | Ceiling/no edit | Rank existing comparisons, export, check consolidation | Serial | Required evidence verified | Report/export | Cleanup then Closed |
| Suspended | Stop/exhaustion | Stop owned work, settle, checkpoint/report | Grace then owned-group termination | Explicit authorized verified resume | Pending coverage/budgets/prior stage | Prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Comparison | Starting self/opponents, pinned schedule | Accepted comparator advances | Opponents, starting paired inputs, stable-ID randomness | Hashes, identities, intersections |
| Source modes | Ordinary: accepted analysis/base | Add one fix; repairs remove/update one existing rule | Repair uses regressing source, preserves unedited rules; comparator accepted | Separate accepted/replay/base bindings |
| Evidence | Typed lossless logs | Generated metadata only | Analyst target-loss allowlists/visible unknowns | Packet hashes, exact decisions, unique coverage |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/evaluation | 50; 2500 matches | Pin owner values | Four games/match; equal allocation plus ordered remainder; baseline excluded from decisions | Analyze last evaluation then deliver |
| Games | 510000 planned + 51000 recovery | Derived from effective decisions/matches | Failed/interrupted reservations count; cache zero; diagnostics separate | Ignore interrupted remainder after recovery allowance |
| Wall/storage | 86400000 ms; 50000000000 decimal bytes | Explicit continuation/increase | Original start includes downtime; 16000000-byte protected reserve | Suspend, no ranking/export/cleanup |
| Deadlines | Evaluation 18000000; preparation 600000; validation/replay 300000; shutdown 60000 ms | Effective pinned values, remaining wall cap | Launch-to-exit includes prefix | Incident policy |
| Calibration | Workers 2 through logical CPUs | Matching recommendations reusable | Replay two successful repetitions, independent largest-stage batches; smallest within 3% fastest median | No qualifier or CPUs <2 stops |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Report, finalize ignored; paired exclusion | None | Reason/count | Continue safe work; replay denominator retained |
| Interrupted evaluation | Recover missing jobs | Automatic 10% games | All attempts/reservations | Resources/deadlines available |
| Calibration stage failure | Fresh evidence, identical inputs | Once; second excludes count | Both attempts/exclusions | Other counts may qualify |
| Unsupported format | Tooling-only adaptation before admission | Fresh validation/local checks | Failure | Valid protected package; zero game charge |
| Integrity/initialization/sideboarding/other failure | Stop | No generic retry | Unsafe evidence | Applicable explicit recovery |
| Analyst/owner/resource stop | Halt owned dispatch and settle | Explicit continuation | Claims/uncovered work/checkpoint | Authorization and verified remaining/increased limits |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Durable record | Identities/configuration, versions/results, rule counts, accounting/errors, ranking/export hash | Existing state, checked report, English history, Git | After closure | Keep; no detailed decision/game IDs in compact rule summary |
| Detailed execution | Logs, receipts, analyses, replay points/traces, packages/schedules/variants | Existing run paths | Validation/replay/accepted-analysis/resume dependencies end | Checked closure consolidation; owner retention overrides |
| Versions | Starting source and every evaluated candidate, including rejected | Main/archive journal | Permanent | Temporary unevaluated hashes never committed |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Controller versus workflow gates | CLI accepts events/resume without evidence | Caller enforces semantic gates and authorization | Syntax success never certifies readiness | No |
| A2 | Calibration admission | External controller classification unspecified here | Verify owning tool before dispatch | Stop unresolved diagnostic-budget conflict | At execution if unresolved |
