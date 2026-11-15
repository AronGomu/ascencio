# Explanation from reviewer 2 for refined bot-improvement workflow

## 1. Outcome and scope

Improve one supplied target bot through reproducible four-game matches against frozen starting-self and optional additional opponents, retaining only strictly better paired game performance. Owner limits and a compatible checkpoint are optional inputs. Completion delivers accepted source, verified results and compact attempt history; an unchanged source is a valid result when no edit qualifies. Only target AI changes are permitted; publication requires separate authorization.

## 2. Process overview

Prepare identities, limits, frozen setup and separate calibrations; evaluate baseline, persist its accepted reference, then analyze all completed target losses. Delegated whole-slice diagnosis produces source-bound hypotheses; the orchestrator implements and replays isolated variants. Passing edits are assembled and evaluated against accepted control, followed by decision and analysis even at the decision ceiling. Rejection by valid regression changes the next repair base; other outcomes return to accepted-source addition. No qualifying edit or the ceiling leads to delivery. Incidents override progression with verified suspension or stopping. The stateless controller prints tasks and checks legal edges, leaving evidence and authorization checks to the orchestrator and owning tools.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Target resolved; fresh or authorized compatible resume | Orchestrator reads external runner contract and schemas, defaults, freezes setup and archives starting source | Calibrations separate; no evaluation/analysis overlap | Valid current runner, exact sources and both identity-matching recommendations | Configuration, schedule, commits, calibration reports | Evaluate |
| Evaluate | Frozen baseline or assembled candidate | Orchestrator validates/binds source, retrieves compatible evidence, runs missing matches | Measured match workers; four games and sideboarding sequential within match | All scheduled matches finalized, reservations settled, paired coverage and resources verified | Logs, receipts, results, paired difference | Decide |
| Decide | Verified evaluation | Orchestrator records baseline reference or candidate promotion decision and archives candidate | Sequential transaction | Strict valid weighted improvement accepts; tie/regression/unassessable retains control | Decision/checkpoint, evaluated-version commit/history | Analyze |
| Analyze | Evaluation complete and decided | Slice tools publish/claim whole 250-match slices; analysts review every allowed target loss; orchestrator merges reasons | One owner per slice, queued runtime slots; full evaluation barrier | Exactly-once audited coverage and final source-bound report; then ceiling/resource check | Findings, report, reason replay inputs | Replay, Deliver at ceiling, or suspension |
| Replay | Eligible reasons and correct mode base | Orchestrator implements isolated add or repair variants; compares unchanged analysis-source controls | Measured replay workers; wait for all reason jobs | All associated cases settled; each retained rule changes intended choice and wins at least five and 5% of associated losses | Immutable hashes, controls/takeovers, rule dispositions | Assemble if any pass; otherwise Deliver |
| Assemble | Passing isolated edits | Orchestrator combines edits, resolves overlap and rechecks materially changed isolated logic | No additional combined-rule gate | Candidate validated/frozen with preserved semantics and attribution | Candidate/history bindings | Evaluate |
| Deliver | No qualifying edit or ceiling, resources still available | Orchestrator ranks existing comparable results, exports accepted source, verifies consolidation | No fresh ranking games | Required analyses/decisions checked; cleanup only eligible evidence | Checked report, export/hash, compact history | Closed |
| Suspend/resume | Incident or exhaustion / explicit applicable authorization | Stop owned work, settle reservations, preserve checkpoint; resume verified prior stage | Shutdown bounded by grace | Owned shutdown verified; resumed budgets and identities compatible | Stop report and resumable evidence | Suspended or prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Target/opponents | Supplied target and frozen setup | Target AI only | Starting-self opponent, additional opponents, decks/engine/legality/information boundary | Validation and hashes before admission |
| Accepted/control versus analysis base | Baseline initially | Acceptance moves control; regression analysis uses rejected candidate | Comparator stays accepted; repair preserves unedited regressing rules | Separate source/commit records per iteration |
| Paired inputs | Pinned schedule and IDs | Decisions/sideboarding trajectories | Starting deck orders, seeds, sides, rules/content; stable derived randomness | Source/input/schedule/integrity matching |
| Scoring | Completed paired intersections | Final ignores excluded symmetrically | Equal opponent weights; draws denominator zero wins; one completed pair per opponent | Per-opponent rates, ignored reasons/counts, coverage; no confidence intervals |
| Source archive | Exact initial source commit on main | Commit each evaluated version, even rejection | Immutable bot/version/run IDs, trailers and independent accepted pointer | Commit helper journal and full SHA/path/hashes |
| Analyst visibility | Packet loss allowlist | Matching reuse only | Target completed-loss projections only; unknowns stay unknown | Packet/page/log hashes, actual decision IDs and audited coverage |
| Controller | Packaged transitions | Verified legal edge or authorized prior-stage resume | No implied execution, evidence certification or permission | Orchestrator verification plus project checkpoints |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/matches | 50 decisions; 2500 total matches | Resolve owner limits in setup | Baseline not decision; allocate floor plus ordered remainder; four games/match | Analyze last evaluation then deliver at ceiling |
| Evaluation games | Planned=(1+effective decisions) × matches × 4; recovery=floor(10% planned) | Pin resolved budgets | Failed/interrupted reservations and recovery executions count; reused games add none; distinct planned/recovery | Recovery exhaustion finalizes remaining interrupted games ignored; no request for extra games |
| Wall/storage | 86400000 ms; 50000000000 bytes | Explicit authorized increase/continuation | Original start including downtime; logical evidence/import scope; fixed 16000000-byte control reserve inside cap | Suspend; no ranking, export, analysis or closure cleanup |
| Stage deadlines | Evaluation 18000000; preparation 600000; validation/replay branch 300000; shutdown 60000 ms | Resolve effective timeouts | Launch-to-exit, replay prefix included; cap by remaining wall time | Incident-specific timeout handling |
| Calibration | Every worker count 2..logical CPUs | No invented worker fallback | Match calibrator repetitions; replay two successful repetitions, full batch/worker largest stage, outcome consistency; smallest within 3% fastest median | No qualifying count stops preparation |
| Replays/diagnostics | No rule-replay game quota | All associated losses mandatory | Time/storage always; controls, takeovers, diagnostic calibration distinct from evaluation | Applicable resource/incident policy |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual game/replay timeout | Report bug, finalize ignored, continue safe work; no conversion | None | Timeout and paired exclusions | Case stays settled |
| Interrupted evaluation | Recover missing work, preserve verified completion | Automatic within pinned recovery allowance | Every attempt/reservation/timeout | Remaining deadlines/resources |
| Calibration measurement-stage failure | Retain failed stage, fresh directory and same inputs | Once; second excludes count and remaining repetitions | Both attempts and persistent retry state | Other qualifying counts may proceed |
| Unsupported pre-admission format | Adapt only build/validation tooling; related checks; fresh validation | Tooling adaptation allowed; still invalid stops | Failed validation | Protected boundaries and valid package |
| Initialization/sideboarding/integrity/input-prefix/other non-timeout validation failure | Stop; unsafe state never ignored | No generic retry | Failure evidence and checkpoint | Applicable explicit authorization; integrity must be resolved |
| Exhaustion | Stop admission, quota marker blocks data writes | No implicit increase | Incomplete work, reservations, budgets and stage | Explicit continuation/increase; storage transaction follows full request, writer-lock update, session-lock release ordering |
| Owner stop or analyst execution failure | Stop admission and owned jobs; preserve claims | No automatic continuation | Covered/uncovered losses and identities | Explicit instruction on same verified checkpoint; no duplicate owners |
| Any stopped owned process | Graceful shutdown then terminate owned groups only | Effective shutdown grace maximum | Settled/cancelled reservations, verified shutdown, next action | Verified checkpoint; explicit closure remains incomplete |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State | Configuration/identities, decisions, receipts/accounting, checkpoints | Existing run.json and iterations/iteration-N/iteration.json | Compact state survives closure | Consolidate without redundant ledgers |
| Execution/analysis evidence | Typed lossless gameplay logs, indexes, packets/pages, findings/reports, replay controls/traces, hashes, schedules, frozen packages | Existing games/game-N/, analyses/, baseline/loss-analysis.md or iteration loss-analysis.md and owning-tool paths | All execution/validation/replay/reuse/resume needs end; accepted detail until replacement or closure | Designated pruning tool; rejected detail may qualify before closure; never prune merely for cap or during suspension |
| Version/history/export | Evaluated Git versions; compact English attempt lines, superseded replacements; accepted export/hash | Git, improvement-history.md, export path | After closure | Temporary unevaluated variants need no commits; no permanent archival source copies |
| Report | Run identities/configuration/times/status, version W/L/D/rates/paired differences, rule counts, coverage, accounting, errors, ranking, accepted export and unresolved issues | Project or artifacts/ | After closure | Checked consolidation precedes eligible temporary cleanup; summary-only closed runs cannot supply caches |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Prepare “whole consecutive 250-match slices”; slice reference “last may be smaller” | Whether total matches must be divisible by 250 | Whole means unsplit ownership of each schedule slice, allowing final remainder | Arbitrary valid match totals use ceil(matches/250) owners | No; reference resolves wording |
| A2 | Defaults and limits deadline resolution | Defaults omit explicit calibration and analysis stage timeout keys, although deadlines cover each stage/branch | Discover supported schema at owning tools, resolve/pin missing deadlines before dispatch; do not invent setup keys | Package alone cannot state all effective deadline values | Yes if owning contracts do not resolve them |
| A3 | Calibration diagnostic admission classification | Package requires classification verification and stopping unresolved budget conflicts, but does not define diagnostic admission fields | Obtain classification from owning runner/calibrator contracts before launching | No assumption that diagnostic matches are free evaluation games | Yes if external contract is silent |
| A4 | Regression ranking by count then severity | Severity has no defined scale or tie-break procedure | Use grounded qualitative severity only after distinct-loss counts, recording rationale | Ties may have judgment-dependent ordering, without altering replay eligibility | Optional for deterministic ranking |
| A5 | Ordinary mode “Add one fix”; Assemble combines all passing edits | Whether one-fix wording limits whole iteration to one rule | One fix per isolated variant; combine all passing variants | Multiple independently qualifying additions can enter one evaluation | No; Replay/Assemble resolve scope |

This explanation uses only the refined package and the supplied explanation template. External linked runner/tool contracts were not inspected, so their schemas and behavior are prerequisites rather than verified facts here.
