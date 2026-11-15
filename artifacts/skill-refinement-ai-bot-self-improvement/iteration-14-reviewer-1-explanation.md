# Explanation from reviewer 1 for iteration 14 execution

## 1. Outcome and scope

Improve the required target `ai-bot` against frozen starting self-opponent plus optional opponents, delivering accepted source, reproducible paired evidence and compact history. Only target AI changes; decks, engine, legality and information boundaries remain protected. A valid strictly higher equally weighted paired game win rate earns acceptance; an honest unchanged result also completes the workflow.

## 2. Process overview

Prepare frozen setup and both calibrations, evaluate baseline, decide, then analyze every evaluation. Below the decision ceiling, replay isolated fixes or regression removals/updates, assemble passing edits and evaluate again. No qualifying edit or analyzed final decision leads to delivery; incidents override progression. The stateless controller prints tasks and legal edges, while project tools persist and execute work and the orchestrator verifies semantic gates.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved bot/checkpoint | Orchestrator discovers owning schemas, reads runner contract/defaults, pins setup, starting commit and schedules, validates and calibrates | Calibration separate from evaluation/analysis | Matching successful match and replay recommendations; verified current runner/setup | Frozen configuration, identities, calibrations, slice plan | Evaluate |
| Evaluate | Baseline or assembled frozen candidate | Tools bind source/control/schedule, reuse verified evidence and execute missing matches | Optimal match workers; four games and sideboarding sequential per match | Every match finalized, reservations settled, evidence/coverage/resources verified | Logs, receipts, results, paired difference | Decide |
| Decide | Complete evaluation | Orchestrator checks strict improvement; tools persist baseline reference or candidate outcome, archive candidate and history | One stage | Valid paired intersection for every opponent; ties/regressions/unassessable retain accepted | Decision, commit, hashes, checkpoint | Analyze |
| Analyze | Full evaluation barrier | Delegate only diagnosis: claim fixed whole slices, read all target-loss pages, checkpoint structured primary/secondary findings; merge source-bound report | One owner per consecutive 250-match slice; queued runtime slots | Exactly-once audited coverage, all slices and report complete | Findings, coverage, eligible reasons | Deliver at ceiling; otherwise Replay |
| Replay | History checked and source mode selected | Orchestrator builds immutable isolated variants and runs unchanged control versus each variant for every associated loss | Measured replay workers within resources | Reason affects ≥5 distinct losses; intended changed choice converts ≥5 and ≥5% of associated losses; all cases settle | Rule IDs, hashes, replay outcomes and attribution | Assemble if any pass; otherwise Deliver |
| Assemble | Passing isolated edits | Combine all from mode base; resolve overlap preserving semantics, revalidate materially changed isolated logic; validate/freeze and update history | One stage; no added combined-rule replay gate | Frozen valid candidate with bindings | Candidate hash, rules, accepted base and replay references | Evaluate |
| Deliver | Required final analysis complete or no qualifying edit | Rank existing comparable results, export accepted, check consolidated report, clean eligible evidence | No fresh games | Checked report/export and lifecycle compliance | Report, export/hash, retained history/state | Closed |
| Suspend | Incident/owner/resource stop | Stop owned work, settle accounting and checkpoint resumable state | Grace-bound owned shutdown | Verified stopped processes and preserved evidence | Reason, prior/next stage, pending jobs, budgets | Authorized verified resume or explicit incomplete closure |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Opponents/control | Starting self AI plus optional opponents; baseline accepted | Accepted control advances on promotion | Opponent packages/order | Commits/hashes and bindings |
| Paired execution | Pinned schedule, seeds, decks, sides, rules/content | Choices and sideboarding trajectories | Starting inputs and stable-ID randomness | Exact identities and paired intersections |
| Mode/source | Accepted source ordinarily | Valid regression uses regressing source for analysis/control/assembly; removes or updates one rule, adds none | Promotion compares accepted; each isolated variant excludes earlier fixes | Explicit accepted/replay/base records |
| Evidence | Current `session-typescript/v1` | Reuse only fully compatible verified evidence | Implementation, settings, input prefix and integrity | Native receipts, hashes, coverage audit |
| Review access | Allowlisted completed target-loss projections | Supported hypotheses from visible choices/events | No opponent/full/non-loss gameplay; unknown remains unknown | Packet/page hashes, IDs and complete coverage |
| Git versions | Starting commit on main or exact existing commit | Every evaluated candidate archived, accepted separate from HEAD | Immutable bot/version/run IDs and intended-only commits | Commit helper journal, trailers, SHA/source hashes |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/evaluation | 50 decisions; 2500 four-game matches per evaluation | Pin owner-resolved values | Baseline not decision; floor allocation plus ordered remainder, one match per opponent; planned games `(1 + effective decisions) × matches × 4`, recovery floor 10% | Analyzed ceiling delivers; recovery exhaustion ignores remaining interrupted games |
| Wall/storage | 24h; 50GB decimal | Explicit authorized continuation; full effective limits | Original start includes suspension; logical evidence/import bytes; 16MB protected control reserve inside cap | Suspend, block admission/data writes, no analysis/export/cleanup |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay branch 5m; shutdown 60s | Resolve effective stage values; cap by remaining wall | Launch-to-exit including replay prefix | Apply specific incident row |
| Replays/calibration | No rule replay game quota | Cannot silently borrow evaluation/recovery budget | Separate diagnostics, controls/takeovers and evaluation; all use time/storage; failed reservations count, cache adds none | Stop unresolved classification/budget conflict |
| Shared gate | Every admission | No bypass or implicit increases | Locked reservation, settlement, fsynced atomic publication; preserve skipped prefix/index-last | Preserve required evidence; never prune to fit |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report, finalize ignored; continue safe work | Never that case | Ignore reason/count; evaluation excluded both paired sides; replay denominator retained | No retry |
| Interrupted evaluation | Preserve verified completion and account attempts | Automatic missing work within recovery/deadlines | Reservations, completion and timeout records | Eligible resources remain |
| Calibration count failure | Fresh directory, same inputs | One retry; second excludes count and remaining repetitions | Both attempts, exclusions, persisted retry state | Another fully successful count; none stops Prepare |
| Unsupported package before admission | Preserve validation; adapt tooling only and locally check | Fresh validation, no games charged | Failed validation | Valid protected package, else stop |
| Integrity/prefix, initialization, sideboard or other non-timeout validation failure | Stop | No generic retry | Errors and checkpoint | Specific incident authorization; integrity always stops |
| Resource exhaustion | Suspend; no further work or closure cleanup | No implicit extension | Full resumable detail | Explicit sufficient increase/continuation; active writer uses persisted request and locked gate update before continuation commit |
| Owner stop/analyst execution failure | Stop owned work and admission | No automatic continuation | Claims, uncovered losses and budgets | Explicit instruction on verified checkpoint; no duplicate owners |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State | Configuration, identities, decisions, receipts and accounting | `run.json`, iteration state and owning records | After closure | Compact state retained |
| Temporary evidence | Typed lossless logs, schedules, packets/reports, replay traces, immutable variants and frozen copies | Existing game/evaluation/run paths | Execution, validation, reuse and resume needs end; accepted detail until replacement or closure | Rejected detail may prune earlier after analysis/decision; use designated tool; no suspension cleanup |
| Versions/history/export | All evaluated commits, compact English attempt lines, superseded replacements, accepted export/hash | Git, `improvement-history.md`, export path | Permanent after closure | No permanent source-copy archive beyond retained export |
| Checked report | State/reason, versions/paired results/coverage, rule counts, budgets/errors, identities, ranking and accepted export | Project location or `artifacts/` | After closure | Consolidate then eligible cleanup; aggregate rule coverage without game/decision detail |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Constraints: every opponent needs a completed pair | Whether a finalized ignored pair qualifies when it leaves no scored intersection for an opponent | Require at least one completed non-ignored paired game per opponent to calculate its rate | Fully ignored opponent is unassessable; other finalized ignores do not invalidate valid pairs | Only if this edge occurs |
| A2 | Calibration: representative diagnostic fixture and diagnostic admission | Exact fixture generation/schema and budget classification live in external owning contracts | Discover those entry points before execution; do not invent schema or charge diagnostics as evaluation | Preparation waits for verified diagnostic classification and matching calibrations | No; delegated to authoritative tools/contracts |
