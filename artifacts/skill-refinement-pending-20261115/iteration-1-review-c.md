# Explanation from review-c for fresh comprehension review

## 1. Outcome and scope

Improve the supplied target `ai-bot` using reproducible paired games against frozen opponents, including its starting source, and deliver accepted source, verified results and compact history. Additional opponents, owner limits and compatible checkpoints are optional. Only target AI may change; decks, engine, legality and hidden-information boundaries remain protected. Successful completion may honestly retain unchanged source when no edit qualifies; suspension and explicit incomplete closure are not successful completion.

## 2. Process overview

Prepare freezes identities, configuration, schedule and calibrated pools; Evaluate runs baseline or a combined candidate, Decide persists its result, and Analyze finishes source-bound loss review even after the last decision. Within remaining limits, Replay tests isolated rules, Assemble combines passing edits, and evaluation repeats. No passing rule or the decision ceiling leads to delivery; resource exhaustion suspends. The stateless controller supplies legal transitions, while owning tools persist work and the orchestrator verifies semantic gates. Delegate loss diagnosis only; the orchestrator implements edits.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Required bot resolved; compatible current runner | Orchestrator reads contracts/defaults, sets up frozen session, archives start, pins policy and calibrates | Calibration separate from evaluation/analysis | Verified setup and both matching recommendations; all worker counts accounted | Run configuration, identities, schedules, calibration measurements/exclusions | Evaluate |
| Evaluate | Valid frozen source and admission | Tools retrieve exact compatible evidence or run missing matches | Independent matches at measured optimum; four games/sideboarding sequential; gated pipeline may analyze finalized slices | Every scheduled match finalized, reservations settled, integrity/resources verified | Typed logs, receipts, outcomes, paired difference | Decide |
| Decide | Completed evaluation | Orchestrator verifies comparison; tools persist baseline reference or candidate decision and commit evaluated candidate | Serialized publication | Candidate valid and strictly better equally weighted paired game rate; otherwise retain incumbent | Decision/checkpoint/history/version commit | Analyze always |
| Analyze | Finalized allowlisted target losses | Slice owners read all ordered pages, acknowledge v2/v3, submit primary and supported secondary findings; orchestrator reconciles | One owner per immutable slice, bounded slots/RAM; no-loss slices open no gameplay | Required full coverage or explicitly labeled selected cohort; complete source-bound report | Findings, acknowledgements, report, all reasons in pending ledger | Deliver at ceiling; suspend on exhaustion; otherwise Replay |
| Replay | Completed ordinary analysis gates | Orchestrator implements isolated rule; execute fresh unchanged-current-source and plus-rule branches on every accumulated associated case | Measured bounded replay pool; no earlier fixes in isolated control | Every case settles; at least 5 wins AND 5% of denominator convert with intended choice changed | Immutable variants, traces, source/rule bindings, pending/blocked/validated/discarded disposition | Assemble if any pass; otherwise Deliver |
| Assemble | Passing isolated edits | Combine from mode base; preserve semantics and attribution; material changes repeat isolated gate; validate/freeze | Owning tools only | Candidate valid; no additional combined-rule replay gate | History with rules/hash/base/references; no proposal.md | Evaluate |
| Deliver | Required analysis done, no resource stop | Rank existing comparable results, export accepted source, check report and consolidate | No fresh ranking games | Checked actual status, evidence and export | Report, history, accepted export/hash | Closed |
| Suspend/resume | Stop incident / authorized continuation | Stop owned processes, settle and checkpoint; verify checkpoint before resume | Shutdown within grace, owned groups only | Applicable authorization and adequate remaining/increased limits | Prior stage, pending work, coverage, identities, accounting | Prior verified stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Evaluation inputs | Frozen setup | Target choices/sideboarding may alter trajectories | Opponents, starting decks/orders, seeds, sides, rules/content, runner/comparison identities, opponent order and schedule | Source hashes, paired IDs and integrity checks; exact evidence reuse provenance |
| Ordinary mode | Accepted source and matching analysis | Add one fix per isolated variant | Accepted promotion comparator; analyze rejected evaluation before returning to accepted analysis | Distinct accepted, analysis/replay and assembly-base records |
| Regression repair | Valid lower-rate evaluated candidate | Remove/update one existing rule; add none | Preserve other candidate rules; compare promotion against accepted source | Candidate-only losses; paired new-loss metadata; implicated-rule support is association |
| Scoring | Completed paired intersection per opponent | Ignore either side's ignored game from both rates | Draws denominator/zero wins; equal opponent weight; one completed pair per scheduled opponent; no confidence intervals | Unresolved comparison is unassessable; ties/regressions retain accepted source |
| Pending identity | Every reported reason, even singleton/sub-five, with stable reason/rule IDs and aliases | Explicit reconciliation; materially different correction gets new rule identity | Original provenance, disagreements, exact semantic rule hash; distinct corrections remain distinct | Durable ledger separate from findings; old unsuccessful rule exclusions do not erase pending entries |
| Accumulation | Distinct original losses in deterministic first-seen order | Extend to 300, never count repeat executions | Pinned original inputs/log hashes, decisions, offered/chosen IDs and outcomes | At each later iteration replay all old/new eligible cases against current analysis source, with fresh control and variant; historical outcomes cannot substitute |
| Current-source reconstruction | Original case inputs, current source | Trajectories may differ | Historical prefix cannot force historical policy into claimed current control | Verify addressing, legality and choice applicability; unsupported reconstruction becomes blocked, not non-conversion/rejection |
| Terminal rule status | Pending until validated or cap verdict | At 300 complete valid current-source cases, failing either threshold becomes proven-discarded | Unchanged discarded rule excluded; failed history durable | Record counts/denominator/source/rule/evidence; interruption, exhaustion or integrity failure cannot prove discard |
| Source archive | Exact start commit reused or created on main | Commit every fully evaluated candidate, including rejected | Incumbent independent of HEAD; unevaluated variants only content-hashed temporary source | Immutable IDs, trailers, full SHA/path/outcome/hash; recoverable commit journal |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Candidate decisions | 50 | Pin owner limits in authoritative setup | Persisted candidate decisions, baseline excluded | Analyze final evaluation, then deliver; no qualifying edit allows earlier finish |
| Evaluation | 250 total matches, 4 games each | Four is constant; at least one match per opponent | Floor allocation plus remainder in frozen order; leave matchesPerOpponent unset | No unauthorized extra iterations/games |
| Games | Planned=(1+effective decisions)×matches×4; recovery=floor(10% planned) | Pin separate totals and sum | Failed/interrupted reservations and recovery count; caches add zero; executed/reused separately | Ignore remaining interrupted games after recovery exhausted, continue eligible work |
| Time/storage | 24 h from original startedAt; 50 GB decimal | Explicit authorized full effective limits continuation | Downtime counts; logical staging/log/evidence/import bytes; explicit maxBytes; fixed 16 MB control reserve inside cap | Suspend, stop admission; no analysis/ranking/export/closure cleanup |
| Deadlines | Evaluation 5 h; preparation 10 min; validation/replay branch including prefix 5 min; shutdown 60 s | Resolve stage/branch values and cap by wall remainder | Launch-to-exit | Incident rules govern timeout |
| Replay | No game quota; 300 distinct cases per reason/rule | Ledger grants no additional budgets | Controls/takeovers/calibration separate from evaluation and rule validation; all consume time/storage | Preserve pending/blocked evidence for compatible authorized continuation |
| Calibration | Worker counts 2..logical CPUs | No arbitrary fallback; explicit memory exclusions allowed | Match calibrator repetitions; replay two repetitions/full independent batch per worker at largest stage, identical outcomes; smallest within 3% fastest median | No qualifying count stops preparation |
| Review | Full, 250-match slices; 12,000-byte pages | Explicit sample/two-pass seed/sampleMatches; immutable cohort and bounded capacities | Selected/full coverage distinct; feasibility measured; page byte bound is not actual tokens | Infeasible/unassessable coverage blocks admission, never silently shrinks |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual game/replay timeout | Bug report, finalized ignored outcome; safe jobs continue | Never retry case | Reasons/attempt; replay denominator includes timeout with zero conversion; paired game excluded both sides | No retry needed |
| Interrupted evaluation | Preserve verified work, settle attempts | Automatic only within recovery allowance | Reservations/timeouts/completion | Missing work fits resources/deadlines |
| Failed calibration stage | Same pinned identity, new directory | One retry then worker-count exclusion, persisted across resume | Both attempts/manifests/exclusions | Other counts may continue; all required repetitions must succeed |
| Unsupported package before admission | Preserve validation; adapt build/validation tooling only and check locally | Fresh validation directory | Failure | Valid without boundary changes; otherwise stop, no game charge |
| Integrity/input-prefix or initialization/sideboarding/other validation failure | Stop unsafe work; resolve integrity first, ask user if unresolved | No generic retry or ordinary replay recovery allowance | Diagnostics and exact inputs | Verified resolution/authorization |
| Resource exhaustion | Stop all admission; storage rejection marker blocks data writes | No implicit increase | Checkpoint and required evidence | Explicit increase/continuation, full limits, original start/consumption preserved; active writer update under gate lock then controller continuation after session lock |
| Pause/cancel/analyst execution failure | Stop owned work and retain claims/uncovered losses | No automatic restart | Ownership, pending coverage and budgets | Explicit instruction on same verified checkpoint |
| Stopped processes/lock recovery | Grace then terminate only owned groups; verify shutdown/settle | Recovery verifies owner death, child birth identities and lock token | Operation snapshots/children | Explicit child termination; fail closed without reliable identity |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Shared state | Config, identities, decisions, receipts, accounting/checkpoint | run.json; iterations/iteration-N/iteration.json | Durable compact history | Owning tools; generated JSON only |
| Temporary evidence | Typed lossless gameplay .log, schedules, packages, packets/pages/claims, Markdown analyses, replay traces/variant hashes | Existing games/game-N and evaluation paths | Execution/validation/replay/reuse/resume needs end; accepted details also replacement or closure | Designated pruning; owner retention overrides; delivery alone insufficient |
| Pending ledger/evidence | Stable IDs/aliases/hash, original cases, current-source results and blocked/pending state | Durable ledger separate from findings | Compatible future continuation or explicit authorized disposition | Overrides ordinary pruning; discarded campaign has no inherited stack absent separate authorization |
| Failed-rule history | Exact proven-discarded identity, counts and evidence | Durable failed-rule history | Future exclusion and materially changed retries remain explainable | Cannot erase on new correction |
| Bot history/export | Git commits, compact English per-attempt improvement-history.md; SUPERSEDED replacements; accepted export/hash | Existing bot/history paths | After closure | No permanent archival source copies; intended bot/history Git changes only |
| Checked report | Run identities/config/times/status; version W/L/D/rates/differences/coverage/ranking; aggregate rule counts/status; games/replays/budgets/errors; accepted SHA/export/hash and issues | Project or artifacts | Durable closure/suspension result | Consolidate before eligible closure cleanup; no detailed game/decision IDs in compact closure rule summary |

Summary-only closed runs cannot provide verified cached evidence. Preserve suspended detail until completion or explicit incomplete closure; references point to authoritative configuration/policy rather than copying overrides.

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Pending cases: “At every subsequent iteration, test” vs singleton/sub-five “wait for eligibility” | Could require replay before five associated losses | Eligibility threshold remains five; retain smaller stacks without replay until eligible | Avoid premature replay while preserving all reasons | Helpful wording clarification |
| A2 | Pending ledger durability vs closure summary omitting game IDs and evidence cleanup | No concrete ledger path/schema or explicit closed-pending evidence manifest is specified | Keep separate durable detailed ledger and every required evidence object; compact report remains aggregate | Pending retention takes precedence over cleanup; orchestrator must implement/verify persistence | Needed before tooling unsupported by existing schema |
| A3 | At 300 cases complete replay below threshold vs blocked current-source cases | Whether blocked cases permit cap verdict | No: “complete valid current-source replay” requires every accumulated case to settle validly | Remain blocked, never fabricate non-conversions or proven discard | No |

Review complete: read the complete supplied package and explanation template only; did not execute a campaign or edit the package.
