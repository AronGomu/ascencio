# Explanation from reviewer 3 for independent refined-package interpretation

## 1. Outcome and scope

Improve one required target AI package against frozen opponents, including its own starting version, using reproducible paired games. Optional inputs are additional opponents, owner limits and a compatible checkpoint. Only target AI changes are permitted. Success delivers the best strictly improving accepted source, verified comparison results and compact history; an honestly unchanged result is valid when no edit qualifies.

## 2. Process overview

The orchestrator resolves and freezes setup, archives starting source and separately calibrates match and replay pools. Each evaluation is decided and then fully analyzed by delegated loss analysts. Eligible global reasons produce isolated variants, which pass loss replays before assembly into a combined candidate and another evaluation. Strict improvement moves the accepted reference; regression switches the next attempt to rule removal/update. The loop ends after final analysis at the decision ceiling or when no edit qualifies. Incidents can suspend any active stage; the stateless controller only routes verified outcomes.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| 1. Prepare | Target and resolvable inputs | Orchestrator reads runner/defaults, discovers owning schemas, sets up frozen session, archives initial source, validates and calibrates | Calibration separate from evaluation/analysis | Verified setup and matching successful match/replay recommendations | Configuration, schedule, source IDs, calibration measurements/checkpoint | Evaluate |
| 2. Evaluate | Baseline or frozen combined candidate | Orchestrator binds source/control/schedule; reuses matching evidence or executes missing matches | Saved optimal match pool; four games and sideboarding sequential within each match | Every scheduled match finalized, accounting settled and comparability/integrity verified | Results, logs, receipts, paired difference | Decide |
| 3. Decide | Verified evaluation | Orchestrator records baseline reference or persists candidate decision, archive and history | Serial decision | Candidate valid and strictly higher equal-opponent paired rate to promote; otherwise keep incumbent | Decision, commit, history, checkpoint | Analyze |
| 4. Analyze | Full evaluation barrier | Slice tooling publishes bounded slices; delegated analysts inspect complete allowlisted target losses; orchestrator merges report | Whole consecutive 250-match slices, one owner each, queued runtime slots | Exactly-once verified coverage and source-bound report | Per-match findings, coverage, final loss-analysis.md | Deliver at ceiling; otherwise Replay |
| 5. Replay | Eligible global reasons and chosen source mode | Orchestrator implements isolated add-one-fix or repair variants and replays all associated losses against unchanged source | Measured bounded replay pool; wait for all jobs | At least five and 5% of associated losses convert to wins with intended choice changed, every case settled | Rule IDs, hashes, traces, conversion/non-conversion counts | Assemble if any pass; otherwise Deliver |
| 6. Assemble | Passing isolated edits | Orchestrator combines all passing edits, resolves overlaps, replays materially changed logic, validates/freezes | No extra combined-rule replay gate | Valid semantics, attribution and preserved repair rules | Candidate binding/history with rules, base and replay references | Evaluate |
| 7. Deliver | Completed required analysis; no suspension | Orchestrator ranks existing comparable results, exports incumbent, checks consolidation, prunes eligible detail | No fresh evaluation | Required verified report/export and lifecycle cleanup | Retained compact state, report, history/export | Closed |
| 8. Suspend/resume | Incident or resource/owner stop | Orchestrator stops owned jobs, settles reservations, checkpoints; authorized verified continuation returns to prior stage | No admission while stopped | Shutdown verified; authorization and effective resources available for resume | Stop reason, pending coverage/jobs, budgets, source IDs and prior stage | Suspended or verified prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Target/opponents | Supplied target plus frozen starting self-opponent and optional opponents | Target AI only | Decks, engine, legality, hidden-information boundaries; opponent packages | Validation and pinned commits/hashes |
| Accepted reference | Baseline accepted source | Strict paired improvement only | Independence from HEAD/rejected archives | Decision/source transaction bindings plus independent promotion check |
| Paired execution | Pinned schedule/order, IDs, seeds, sides, deck orders, rules/content and implementation IDs | Decisions/sideboarding can alter trajectories | Starting paired inputs and stable ID-derived randomness | Evidence integrity and completed paired intersections |
| Comparison | Wins/completed non-ignored games, draws zero wins; equal opponent weight | Pairwise coverage can exclude either-side ignored games | Each scheduled opponent has completed pair; no confidence intervals for promotion | Rates, paired differences, coverage and ignore reasons |
| Next attempt sources | Accepted commit separately recorded | Ordinary uses accepted; regression repair uses regressing source for analysis/control/base | Promotion comparator always accepted; repair preserves unedited rules | Explicit source/base/replay provenance |
| Analysis access | Packet target-loss allowlist | Matching finding reuse after audit | No opponent views, wins/draws/unsafe gameplay or hidden information | Hashes, IDs, pages/events counts and coverage audit |
| Controller | Stateless stage routing script | Legal event advances/resume | Does not execute, authorize, certify or persist | Orchestrator verifies gates and owning tools checkpoint |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions | 50 | Pin effective owner value | Persisted candidate decisions only; baseline excluded | Analyze final evaluation then Deliver |
| Evaluation volume | 2500 four-game matches per evaluation | Total allocated floor per opponent plus remainder in frozen order; at least one each | Planned games = (1 + effective decisions) × matches × 4; recovery floor 10% planned; failed/interrupted reservations count; caches do not | Recovery exhaustion ignores remaining interrupted games; no extra-game request |
| Wall time | 24 hours | Effective pinned stop.maxWallMs; resume preserves start and consumption | Includes downtime/suspension | Suspend, no further analysis/ranking/export/cleanup |
| Storage | 50 GB decimal | Explicit resolved stop.maxBytes; authorized active-writer increase follows locked continuation protocol | Logical staging/log/evidence/import bytes; 16 MB fixed protected control reserve | Block data writes and suspend; never prune needed evidence to fit |
| Stage deadlines | Evaluation 5 h; candidate prep 10 min; validation/replay branch 5 min; shutdown grace 60 s | Resolve effective per-stage/branch values; cap by remaining wall time | Launch-to-exit, replay prefix included | Apply specific incident handling |
| Match/replay pools | Every worker count 2..logical CPUs | No arbitrary fallback; matching measured optimum required | Replay two repetitions, independent full batch per worker at largest stage, identical outcomes; smallest within 3% fastest median | No qualifying count stops preparation |
| Rule replays/diagnostics | No game quota | Time/storage still bind | Controls/takeovers/calibration diagnostics separate from evaluation/rule validation | Suspend on resources; replay failures follow Incident policy |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual game/replay timeout | Bug report and finalized ignored outcome; evaluation ignore removes both paired sides; replay ignore stays denominator | Never retry case | Timeout/accounting and safe completed work | Safe jobs continue |
| Interrupted evaluation | Recover missing work with deadlines/resources | Automatic within 10% recovery budget only | Verified completions and all attempts/reservations | Remaining allowance; otherwise finalize remaining interrupted games ignored |
| Calibration stage failure | Fresh directory and same inputs | One retry; second failure excludes worker count and remaining repetitions | Both attempts and persistent retry state | Other counts continue; no qualifier stops preparation |
| Unsupported format before admission | Preserve validation; adapt build/validation tooling and validate fresh with related checks | Tooling correction only; no game charge | Failed validation | Valid current format without protected-boundary changes |
| Integrity/input-prefix/init/sideboarding/other non-timeout failure | Stop; never mark unsafe state ignored | No generic retry, no automatic ordinary replay recovery | Failure/source evidence | Applicable explicit verified continuation; integrity failure remains stopping condition |
| Time/storage exhaustion | Suspend admission/owned work; quota marker blocks data writes | No implicit increase | Full resumable detail/checkpoint | Explicit increased limit/continuation |
| Owner stop or analyst execution failure | Stop admission and owned work, retain claims/uncovered losses | No automatic restart | Ownership and coverage | Explicit instruction on same verified checkpoint |
| All stopped owned work | Grace then terminate only owned groups; settle/cancel and verify shutdown | Effective shutdown grace only | Pending jobs, interruptions, next stage, identities and budgets | Verified checkpoint and incident authorization |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Shared state | Configuration, identities, accounting, decisions and receipts referenced once | run.json and iterations/iteration-N/iteration.json | After closure compact state remains | Consolidate via owning tools |
| Temporary evidence | Typed lossless gameplay logs, match indexes, projections/pages, findings, reports, replay evidence, variant hashes, frozen packages, schedules, receipts and calibration records | Existing run paths, games/game-N and evaluation analyses | All execution/validation/replay/reuse/resume needs end; accepted detail until replacement or closure | Designated pruning; no suspension closure cleanup; delivery alone insufficient |
| Version archive | Starting source on main if no exact commit; every fully evaluated candidate, including rejects; immutable IDs/trailers and hashes | Git via commit helper recoverable journal | Permanent history | No unevaluated variant commits or permanent source copies |
| Attempt history/export | One English compact line per attempt across runs, status/change/version/evidence/result; superseded markers; accepted export/hash | improvement-history.md and accepted export | After closure | Retain |
| Run report | State/reason/times, identities, results/ranking, rule aggregates, budgets/errors, accepted export and unresolved issues | Project location or artifacts/ | Retain checked closure report | Remove only eligible temporary detail after consolidation; closed summary cannot prove cached gameplay |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Prepare: “whole consecutive 250-match slices”; slice protocol: “last may be smaller” | Prepare's wording could imply multiples of 250 despite arbitrary owner match totals | Whole means indivisible assignment; final slice may be shorter | analysis-workers remains ceil(total/250); no discarded remainder | No; reference resolves |
| A2 | Source selection: ordinary “Add one fix”; Assemble: combine all passing edits | Could read one fix as one total candidate edit rather than one isolated variant | One fix per isolated variant; combined candidate contains all passing edits | Multiple qualifying reasons may contribute to a candidate | No; assembly clarifies |
| A3 | Limits: maxDecisions; Inputs/Autonomy: ask for “missing required limits” | Defaults cover many limits but package does not enumerate which missing values must be owner-supplied | Use defaults for listed fields; ask only for unresolved owning-schema mandatory values | External owning contract discovery is necessary before dispatch | Only if owning schemas leave required values unresolved |
| A4 | Calibration: identity and “representative workload”; no-loss baseline/available fixture | Representative verified losses or deterministic fixture allowed, but exact fixture selection/representativeness is not defined locally | Use owning calibrator's valid deterministic diagnostic fixture when compatible retained losses absent | Preparation cannot substitute arbitrary gameplay or count diagnostics as evaluation | Only if no valid owning fixture/contract exists |
| A5 | Incident policy: integrity failures always stop; resume authorization | Stop is explicit but permanence versus repaired fresh evidence is not fully specified here | Never auto-retry or resume unsafe evidence; require explicit authorized verified checkpoint with integrity resolved | May need fresh setup instead of continuing corrupted run | Yes when integrity failure occurs |

This explanation reads only the refined package and the explanation template. Linked repository runner/tool contracts were not read, so exact owning request schemas and persistence implementation are intentionally unresolved rather than inferred.
