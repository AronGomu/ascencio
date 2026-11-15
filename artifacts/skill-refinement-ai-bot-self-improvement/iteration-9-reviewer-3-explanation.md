# Explanation from reviewer 3 for independent workflow interpretation

## 1. Outcome and scope

Improve one supplied `ai-bot` through paired evaluation against frozen starting self and optional opponents, changing target AI only. Deliver accepted source/export, verified results and compact history; unchanged acceptance is legitimate. Decks, engine, legality and hidden-information boundaries remain protected. This interpretation reads only this package and the explanation template; linked implementation contracts were not inspected.

## 2. Process overview

Prepare freezes identities, schedule, limits and calibrations. Evaluate/Decide/Analyze repeats through isolated Replay and combined Assemble. Every evaluated candidate receives analysis, including rejection and the final decision. Decision ceiling or no passing edit leads to Deliver; exhaustion or stopping incidents lead to Suspended. Orchestrator implements and verifies; delegated analysts diagnose only.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Required bot resolved | Orchestrator setup, archive initial source, validate, calibrate | Separate pools; no evaluation/analysis overlap | Valid current runner and both matching recommendations | Pinned configuration/checkpoint | Evaluate |
| Evaluate | Frozen initial/assembled source | Bind accepted control; reuse verified evidence/run missing work | Optimal match workers; four games/sideboarding sequential | All scheduled matches finalized, reservations settled, evidence checked | Results, paired difference | Decide |
| Decide | Complete evaluation | Baseline accepted without decision charge; otherwise strict improvement gate, archive even rejection, history | Serialized | Persist verified outcome | Decision, SHA, history | Analyze |
| Analyze: prepare | Full evaluation barrier | Repeated `sync` with `maxSlices:1`; claim whole consecutive 250-match slices, last smaller | Queued slots; one owner/slice | `preparationComplete`; source/range/packet hashes bound | Packets/claims | Analyze: review |
| Analyze: review | Claimed slice | Analyst reads every ordered review page or full allowlisted loss log; records duration/bytes | Independent slices; no split/merge | Every completed target loss covered once; zero-loss opens nothing | First-pass findings | Analyze: submit |
| Analyze: submit | Completed match subsets | Checkpoint structured schema-v1 Markdown findings and all supported primary/secondary reasons; complete remaining/empty findings | Small match batches | Validate packet, choices, IDs and unique coverage; reconcile merged draft | Generated per-match reports, final source-bound analysis | Ceiling: Deliver; otherwise Replay |
| Replay | Eligible reasons, history checked | Orchestrator isolated add, or remove/update in repair mode; unchanged source controls | Measured bounded replay workers | Every associated case settles; conversion threshold passes | Immutable hashes, traces, dispositions | Passing: Assemble; none: Deliver |
| Assemble | Passing isolated edits | Combine preserving semantics/attribution; changed logic repeats isolated gate; validate/freeze | Serialized assembly | No extra combined replay gate | History with rules/hash/base/references; no proposal | Evaluate |
| Deliver | Analyses/decisions verified | Rank comparable existing results, export, check report, eligible cleanup | No fresh ranking games | Honest complete/no-edit status | Export/hash, consolidated report | Closed |
| Suspended | Stop overrides progression | Owned shutdown, settlement, checkpoint/report | Grace then owned groups terminated | Authorized verified continuation with limits | Pending coverage/jobs and prior stage | Prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Sources | Starting commit; accepted reference | Accepted moves only on strict improvement | Frozen opponents include starting AI | Source commits/hashes; accepted independent of HEAD |
| Ordinary mode | Accepted analysis/replay/assembly source | Add one isolated fix | Comparator accepted | Analyze rejected evaluation before returning to accepted analysis |
| Repair mode | Valid lower-rate candidate | Remove/update one existing rule, add none | Candidate unedited rules; accepted comparator | New-loss metadata only; analysts see candidate losses |
| Pairing | Frozen opponent order, seeds, decks, sides, rules/content | Choices/sideboarding trajectories | Starting inputs, runner/comparison identities | Completed paired intersections; every opponent has pair |
| Evidence | Typed lossless `.log` | In-memory reconstruction | Unknowns and legitimate perspective | Allowlisted target-loss projections; never adjacent gameplay |
| Versions | Stable bot, unique run/version IDs | Every evaluated candidate committed | Immutable IDs, required trailers | Recoverable commit journal; temporary variants content-hashed |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions | 50 | Pin owner values | Persisted candidate decisions, excludes baseline | Analyze last evaluation, Deliver |
| Evaluation | 2500 four-game matches/evaluation | Total allocation floor/remainder; at least one/opponent | Planned `(1+effective decisions)×matches×4`; recovery floor 10%; failed/interrupted charged; cache zero | Recovery exhausted: ignore remaining interrupted games |
| Time/storage | 86,400,000 ms; 50,000,000,000 decimal bytes | Explicit continuation preserves start/consumption | Downtime counts; logical imported/staging/evidence bytes; 16,000,000-byte control reserve inside cap | Suspend; no analysis/export/cleanup |
| Stage timeouts | Evaluation 18,000,000; preparation 600,000; validation/replay-prefix 300,000; shutdown 60,000 ms | Resolved configuration, capped by remaining wall time | Launch-to-exit | Incident policy |
| Calibration | Workers 2 through logical CPUs | No arbitrary fallback | Replay two successful repetitions; largest stage independent full batch/worker; smallest within 3% fastest median | No qualifier stops Prepare |
| Replay | No game quota | All associated losses mandatory | Separate diagnostics/controls/takeovers; all time/bytes count | Retain only ≥5 wins AND ≥5% associated losses, intended choice changed |
| Scoring | Equal opponent weights | None stated | Wins/completed nonignored games; draws zero wins; symmetric paired ignores | Tie/regression/unassessable retains accepted |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report; finalize ignore; safe work continues | Never that case | Reason/count; replay denominator retains timeout | No retry; not conversion |
| Interrupted evaluation | Recover missing work | Automatic within recovery budget | Every reservation/attempt/completion | Deadlines/resources permit |
| Calibration stage failure | Fresh evidence, same inputs | Once; second excludes count/repetitions | Both attempts/exclusions across resume | Other counts qualify |
| Unsupported pre-admission package | Adapt tooling only, local checks/fresh validation | No evaluation charge | Failed validation | Valid protected boundaries |
| Integrity/prefix/initialization/sideboarding/non-timeout validation | Stop | No generic retry | Unsafe state never ignored | Applicable explicit authorization |
| Owner stop/analyst failure/resources | Stop admissions/owned work; settle/checkpoint | Explicit continuation | Claims/uncovered losses, budgets/source/pending stage | Same verified checkpoint; no duplicate owners |
| Analysis continuation | Metadata status; release requires token and `terminated:true` | Identical submissions safe; changed accepted reports rejected | Completed jobs survive reassignment | Audit bytes/pages/reports/coverage before trusting rules; stale completions invalidated |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State | Configuration, identities, decisions/accounting | `run.json`, iteration JSON, receipts | Compact permanent record | Owning tools only |
| Detailed evidence | Logs, schedules, packets/reports, replay cases/hashes, packages, machine records | Existing game/analysis/run paths | All execution/validation/replay/reuse/resume needs end; accepted until replacement/closure | Rejected details eligible earlier after summary; owner retention overrides |
| Final record | Version results, rule counts/dispositions, coverage, accounting/errors, accepted export/hash/ranking | Checked run report plus state | After closure | Consolidate before removing eligible detail; no game IDs/decision detail required in compact rule summary |
| History/source | English compact attempt lines; superseded replacements; Git versions | `improvement-history.md`, Git/export | After closure | No permanent source copies; summary-only closure cannot supply cached evidence |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Prepare/slice protocol | “Whole consecutive 250-match slices” versus smaller last slice | Protocol explicitly permits remainder | Slice count is ceil(total/250) | No |
| A2 | Controller | Legal edge could appear to authorize progression/resume | Actual dispatcher checks arguments/stage edges only; resume accepts any active prior-stage name without checking suspended state | Orchestrator verifies evidence/authorization; owning tools persist checkpoints, enforce budgets/claims/publication | No |
| A3 | Linked owning contracts | Exact schemas and native trust mechanisms absent here | Do not infer implementation from entry-point names | Read owning contracts before real execution; package alone cannot certify them | Yes, before execution |
