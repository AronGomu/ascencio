# Explanation from review B for pending-skill comprehension

## 1. Outcome and scope

Improve one required `ai-bot` against frozen opponents, including its starting self; additional opponents, owner limits and compatible checkpoint are optional. Deliver accepted source, verified paired-game results and compact history, honestly retaining unchanged source if nothing qualifies. Only target AI changes; decks, engine, legality and hidden-information boundaries remain protected. Use current `session-typescript/v1` only.

## 2. Process overview

Prepare frozen identities and calibrations, evaluate baseline, decide, then analyze. Replay isolated rules against the selected analysis source, assemble passing edits, evaluate and decide again. Analyze every evaluation, including the final one. Stop normally at the decision ceiling or no passing edit; resource/owner incidents suspend. The stateless controller prints legal stages; owning tools persist execution and accounting, while the orchestrator verifies semantic gates and implements edits. Delegate diagnosis only.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Inputs resolved | Orchestrator pins setup, policy, source and both calibrations | Calibration separate from evaluation/analysis | Verified setup; matching measured recommendations | Configuration, attempts, identities | Evaluate |
| Evaluate | Exact source frozen | Tools reuse compatible evidence or execute missing matches | Optimal matches parallel; four games/sideboarding sequential; gated analysis pipeline | Schedule finalized, reservations settled, evidence verified | Logs, receipts, paired difference | Decide |
| Decide | Evaluation complete | Verify strict paired improvement; persist outcome; archive evaluated source | Sequential authority | Baseline reference or candidate decision committed | Decision/history/version | Analyze |
| Analyze | Finalized loss slices | Analysts read allowlisted target-loss pages; orchestrator merges reasons | Whole-slice owners; bounded slots; acknowledgements/checkpoints | Full losses or explicit selected cohort complete and labeled | Source-bound report, all reasons | Replay or Deliver |
| Replay | Further work authorized | Orchestrator tests isolated rules and pending stacks | Measured replay pool; each case settles | Five wins AND 5%, intended choice changed | Current-source outcomes and ledger | Assemble; none → Deliver |
| Assemble | Passing edits | Combine from mode base; changed logic re-passes replay | No extra combined-rule gate | Validated frozen candidate | Hash, attribution, history | Evaluate |
| Deliver | Normal completion | Rank existing comparable results, export, consolidate/check report | No fresh games | Required decisions/analyses verified | Export and report | Closed |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Comparison | Frozen starting inputs/opponents | Accepted comparator advances | Seeds, order, schedule, engine/content/runner | Hashes; completed paired intersection; equal opponent weights; draws count zero wins |
| Ordinary mode | Accepted source/analysis | Add one fix per isolated variant | Comparator accepted | Rejected evaluation analyzed before retained accepted analysis reused |
| Repair mode | Valid lower-rate candidate | Remove/update one rule; add none | Unedited candidate rules; comparator accepted | Candidate-loss evidence; new-loss metadata; association not causation |
| Pending entry | Stable reason/rule IDs, aliases, semantic hash | Explicit reconciliation; new losses | Original findings, IDs, logs, decisions, offered/chosen choices | Deterministic first-seen distinct stack, maximum 300 |
| Pending replay | Current analysis source | Fresh control plus isolated rule | Original pinned inputs; no historical outcomes substituted | Exact reconstruction/applicability; unsupported current-policy prefix blocks |

Below five losses waits. Every eligible accumulated case replays at each otherwise authorized Replay stage. Below either threshold remains pending below 300. Only complete valid current-source failure at 300 proves that exact rule discarded; archive it durably and exclude unchanged retries. Material correction gets a new identity. Pending evidence survives pruning, grants no budget, and does not automatically transfer from discarded campaigns.

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/evaluation | 50 decisions; 250 four-game matches | Pin owner values | Baseline excluded; distribute matches evenly plus ordered remainder | Analyze final result; deliver |
| Games | `(1 + decisions) × matches × 4`; 10% recovery | Pinned authority | Failed/interrupted reservations count; caches zero; diagnostics separate | Ignore remaining interrupted games after recovery allowance |
| Time/storage | 24h; 50GB | Explicit full-limit continuation | Original start includes downtime; logical/imported bytes; fixed 16MB reserve | Suspend, block admission/writes |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay 5m; shutdown 60s | Resolved effective limits | Launch-to-exit including prefix; cap by remaining wall time | Incident policy |

Calibration must account for worker counts 2..logical CPUs by successful required measurements or permitted exclusions; no arbitrary fallback. Replay needs two repetitions and chooses smallest count within 3% of fastest successful median. Shared locked gates reserve before admission and settle attempts.

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Report; finalize ignored; evaluation excludes both paired sides | Never | Outcome/reason | Safe jobs continue; replay denominator retains timeout |
| Calibration failure | Fresh evidence directory | Once per failed stage, then exclude count | Both attempts/exclusions | Qualifying recommendation exists |
| Integrity/initialization/sideboarding | Stop; resolve prefix/integrity first | No generic retry | Errors/checkpoint | Resolution; ask if unresolved |
| Invalid package pre-admission | Adapt tooling only; validate fresh | No game charge | Failed validation | Protected boundaries hold |
| Resource/owner/analyst stop | Stop owned work, bounded shutdown, settle/checkpoint | No implicit budget increase | Claims, uncovered work, identities/budgets | Applicable explicit authorization; resources available |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State/report | Identities, versions/results, rules, budgets/errors, accepted export | Existing run state and project/artifacts report | Durable compact record | Checked consolidation |
| Execution/analysis | Typed lossless logs, pages/findings, controls, hashes, schedules | Existing run paths | All validation/replay/reuse/resume needs end; pending stacks override | Designated pruning; accepted also needs replacement/closure; suspension forbids closure cleanup |
| Versions/history | Starting and every evaluated candidate, including rejected; immutable IDs/trailers | Git and English history; accepted export | After closure | Temporary unevaluated variants need no commits; no permanent source-copy archive |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Pending ledger; performance extension | Ledger schema/tool unspecified; tools do not implement it automatically | Orchestrator persists verifiable durable bindings without pretending native support | Implementation must supply ledger before replay/pruning | Schema choice routine; unsupported reconstruction blocks |
| A2 | Semantic rule hash/materially different correction | Materiality lacks formal criterion | Changed corrective behavior requires new explained identity; aliases alone do not | Preserve failed history, avoid unchanged-rule laundering | Only disputed equivalence |
