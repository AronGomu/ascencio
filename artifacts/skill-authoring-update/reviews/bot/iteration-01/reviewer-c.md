# Explanation from reviewer-c for candidate skill comprehension

## 1. Outcome and scope

Improve one supplied `ai-bot` package against frozen opponents, including its starting version, using reproducible paired games; optional inputs are extra opponents, owner limits and a compatible checkpoint. Successful completion delivers the accepted source, verified comparable results and compact attempt history, including an honest unchanged outcome if nothing qualifies. Only target AI changes are permitted: decks, engine, legality and hidden-information boundaries stay protected. This document explains the candidate; it does not run improvement, reviews or delegation.

## 2. Process overview

Prepare establishes identities, frozen setup, starting commit and separate worker calibrations. Evaluate first measures the starting AI, then combined candidates. Decide records the result and Analyze always reviews that evaluation, including rejected and final candidates. With decisions remaining, source selection determines ordinary additive edits or regression repairs; isolated Replay gates edits before Assemble combines them and loops to Evaluate. No passing edit or the analyzed decision ceiling leads to Deliver. Stops override every edge and preserve a resumable Suspended checkpoint; closure and suspension are distinct.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Inputs resolved or authorized fresh run | Orchestrator reads contracts/defaults, resolves configuration, invokes setup, validates sources, archives starting source and calibrates | Calibration separate from evaluation/analysis; every count 2..logical CPUs tested | Exact setup valid, both recommendations match, budgets and schedule pinned | Configuration, setup seed, source commit, calibration reports/recommendations, slice plan | Evaluate via ready |
| Evaluate | Prepared baseline or frozen assembled candidate | Orchestrator validates boundary; owning tools bind source/control/schedule, reuse verified evidence or execute missing matches | Independent matches at saved optimal count; four games and sideboarding within each match sequential | Every scheduled match finalized; reservations settled; evidence, paired coverage and resources verified | Results, receipts, typed logs, paired difference | Decide via complete |
| Decide | Verified evaluation | Orchestrator checks strict paired gate; tools persist decision, archive evaluated candidate and update history; baseline establishes reference without spending a decision | One controller task at a time | Valid strictly higher weighted game rate promotes; otherwise retain accepted | Decision/reason, commit, history, checkpoint | Analyze, always |
| Analyze | Full evaluation barrier after Decide | Slice tools prepare bounded packets; delegated analysts review completed target losses; orchestrator reconciles global reasons/report | One owner per consecutive 250-match slice; queued slots; analysis-workers = ceil(total matches/250); sync publishes max one slice per transaction | Exactly-once source/hash-bound coverage; report complete before ceiling check | Claims/checkpoints, per-match Markdown, merged draft and final loss report | Deliver at ceiling; otherwise Replay; resource stop suspends |
| Replay | Analysis complete and budget remains | Orchestrator reads history, selects source mode, implements independent variants, replays all associated losses at recorded primary decisions | Measured replay pool; unchanged control and isolated variant exclude earlier fixes; all reason jobs settle | Reason covers >=5 distinct losses; retained rule changes intended choice and converts >=5 and >=5% of associated losses to wins | Immutable hashes/directories, rule IDs/operations, offered/chosen references, control/takeover results, exclusions | Assemble if any pass; otherwise Deliver |
| Assemble | Passing edits | Orchestrator combines edits from selected mode base, resolves overlaps, replays materially changed isolated logic, validates/freezes candidate; tools update history | No additional combined-rule gate | Valid semantics, attribution and protected boundaries; repair retains unedited rules | Candidate hash, sorted included IDs, accepted base/replay references; no proposal.md | Evaluate via ready |
| Deliver | Ceiling analyzed or no qualifying edit | Orchestrator verifies decisions/analyses, ranks existing comparable results, exports accepted source, checks consolidated report then eligible cleanup | No fresh ranking games | Verified delivery and lifecycle conditions | Export/hash, compact retained state/history and checked report | Closed |
| Suspended | Any active-stage stop | Orchestrator stops admission/owned work; tools settle reservations and checkpoint; report continuation requirements | Shutdown grace then terminate owned process groups only | Verified shutdown and preserved prior-stage checkpoint | Pending jobs/coverage, budgets, identities, errors and report | Prior stage only with applicable explicit authorization and verified checkpoint |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Opponents/control | Starting AI plus optional frozen packages; accepted initially starting AI | Accepted comparator advances on promotion | Opponent source/order, including frozen self-opponent | Commits/hashes and bindings |
| Paired inputs | Setup seed, schedule, rules/content, starting decks, engine seeds and sides | Choices/sideboarding can alter trajectories | Starting inputs; stable match/game-derived randomness; engine/content/runner/comparison identities | Matching receipts, schedules and integrity checks |
| Runtime | session-typescript/v1 | Fresh run for incompatible old formats | No adapting current workflow to legacy runners/checkpoints | Setup/current runner validation |
| Ordinary source | Accepted source and matching analysis | Add one fix per isolated variant | Accepted comparator; rejected evaluation still analyzed | Separate accepted, analysis/replay and assembly identities |
| Repair source | Valid lower-rate rejected candidate | Remove/update one existing rule per variant; add none | Unedited rules; promotion still versus accepted | New-loss flags from metadata; candidate-loss-only inspection |
| Scoring | Completed non-ignored games | Paired intersections determine compared rates | Draws denominator/zero wins; equal opponent weight; exclude ignored case on both sides; every opponent needs a pair | Independent gate check before decision tool; no confidence intervals |
| Archive identity | Stable bot ID, unique immutable run/version IDs | Related follow-ups reuse corresponding IDs | Accepted independent of HEAD; source hashes and full SHA/path/outcome recorded | Commit helper journal and matching trailers; git show/package extraction |
| Analyst boundary | Positive allowlisted target completed-loss projections/pages | Review all pages or full fallback; reconcile synonyms globally | No full two-actor, opponent-only, non-loss or adjacent gameplay browsing; unknowns stay unknown | Packet/page/log hashes, offered/chosen IDs, audit and exact coverage |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions | 50 | Resolve owner values during Prepare | Persisted candidate decisions only, baseline excluded; final analysis required | Analyze then Deliver at ceiling; no-edit early end allowed |
| Evaluation | 2500 total matches; four games each | Owner total pinned; require >=1 match/opponent; matchesPerOpponent unset | Floor allocation plus first remainder opponents; planned games=(1+effective decisions)*matches*4 | No extra discretionary evaluation |
| Recovery | floor(10% planned games) | No implicit increase | Separate planned/recovery counts; failures, interruptions/reservations and recovery consume allowance; cache reuse adds none | Ignore remaining interrupted games after allowance; continue eligible work |
| Wall time | 86400000 ms | Explicit authorized continuation/increase | Original startedAt includes downtime and suspension; preserved consumption | Suspend, no further analysis/ranking/export/cleanup |
| Storage | 50000000000 bytes | Pass effective cap explicitly; active-writer increase needs full persisted request, locked gate update, later controller continuation | Logical staging/log/evidence/import scope; fixed 16000000 control reserve within cap | Stop admission; persisted rejection blocks data writes; preserve required evidence |
| Deadlines | Evaluation 18000000; preparation 600000; validation/replay branch 300000; shutdown grace 60000 ms | Resolve effective timeoutsMs; cap stage launch-to-exit by wall remainder | Replay prefix included | Apply relevant incident rather than generic retries |
| Calibration/diagnostics | Match calibrator repetitions; replay two successful repetitions/count, full largest-stage batch/worker | Measured recommendations only; no arbitrary fallback | Separate from evaluation and rule validation; consume time/storage; replay picks smallest count within 3% fastest successful median | Stop if no qualifying count; below two CPUs has none |
| Rule replay | No game quota | All associated losses required | Separate controls/takeovers/diagnostics; ignored timeout remains denominator/nonconversion | Resource limits suspend; do not trim evidence |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual game/replay timeout | Bug report, finalized ignored outcome; safe jobs continue; paired evaluation exclusion on both sides | Never retry case | Ignored reason/count, completed evidence and accounting | Not interrupted work |
| Interrupted evaluation | Recover missing verified work within resources/deadlines | Automatic only within 10% recovery allowance | Attempts/reservations/timeouts and completed receipts | Matching verified checkpoint; exhausted allowance finalizes remaining ignored |
| Calibration worker stage failure | Retain failure; use fresh directory with same pinned inputs | Once for failed stage; second excludes count and its remaining repetitions | Both attempts, measurements, exclusions across resume | Other counts continue; at least one fully successful count needed |
| Unsupported package before admission | Preserve validation, adapt build/validation tooling only; related local checks and fresh validation | Specific tooling correction allowed; no game/recovery charge | Failed and fresh validation evidence | Valid protected boundaries, otherwise stop |
| Initialization, sideboarding, integrity/input-prefix or other non-timeout validation failure | Stop; never hide unsafe state as ignored | No generic retry; ordinary rule replay no automatic recovery | Failure/input/source evidence | Incident-authorized verified continuation only |
| Time/storage exhaustion | Suspend; settle/cancel owned work and retain resumable detail | No automatic quota increase | Limits, markers, pending work and checkpoint | Explicit applicable increase/continuation with full effective limits and preserved consumption |
| Owner pause/cancellation or analyst execution failure | Stop owned work/admission and retain uncovered losses/claims | No duplicate ownership or implicit restart | Ownership tokens, covered/uncovered jobs, pending state | Explicit instruction on same verified checkpoint |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Shared state | Effective configuration, identities, accounting, decisions, receipts once and checkpoint references | run.json; iterations/iteration-N/iteration.json | Compact state retained after closure | Owning tools consolidate; JSON generated by scripts |
| Gameplay and execution detail | Typed lossless .log gameplay, match indexes, receipts, immutable variants, replay traces, frozen packages, schedules, calibration records | games/game-N/ and existing session paths | All validation/execution/replay/reuse/resume needs end; accepted detail additionally until replacement or closure | Designated pruning tool; rejected detail may qualify during run; no permanent source copies, no pruning merely for delivery/cap |
| Analysis | Complete source-bound report with all affected game/critical decision replay points; per-match findings and first-pass reasons | baseline/loss-analysis.md or iterations/iteration-N/loss-analysis.md; evaluation analyses/ | Same lifecycle as necessary evidence | Checked summarized analysis/decision plus no remaining dependencies |
| Git/history/export | Starting and every evaluated candidate commit, including rejected; required subject/trailers; one English compact attempt line, SUPERSEDED replacements, accepted export/hash | Git; improvement-history.md; accepted export | After closure | Commit only intended bot/history files; temporary unevaluated variants not committed |
| Checked run report | IDs/hashes/configuration/times/status, per-version paired W/L/D/rates/differences and coverage; rule totals/status without game IDs; aggregate accounting/errors; ranking/export/unresolved issues | Project or artifacts/ | Retained after closure; also generated on suspension | Consolidate then remove eligible temporary evidence; suspended runs keep detail absent explicit incomplete closure |

Summary-only closed runs cannot provide verified cached games/replays. Existing command vocabulary and paths remain campaign/round/incumbent. Push, publish and merge require separate authorization.

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Controller command and owning entry points | Candidate names the canonical .agents/skills/ai-bot-self-improvement controller, rather than its own sibling scripts | Treat literal execution paths as intentionally preserved public interfaces | Explanation does not execute or read the original counterpart; runtime would use declared path | Only if candidate must execute independently |
| A2 | runner link | Linked document lacks the named minimum-runner-interface-for-aro2-18 anchor; its parallel-execution section self-links to that missing anchor | Use explicit candidate current-runtime invariants and relevant parallel-execution/calibration prose; do not infer an unavailable schema | Exact runner contract remains unresolved before real dispatch; no legacy exception overrides candidate policy | Yes, restore/identify authoritative contract before execution |
| A3 | Limits vs Autonomy | Autonomy mentions missing required limits although defaults supply values | Defaults satisfy omitted optional owner limits; ask only when a genuinely required unresolved schema/resource value remains | Do not ask redundantly for values already defaulted and pinned | No |
| A4 | Analyze source-mode selection | A rejected evaluation must be analyzed, but ordinary mode reuses accepted analysis while repair uses regression analysis | Finish rejected-source report first, then choose the next mode and preserve source bindings | Tie/unassessable rejection returns to accepted analysis; valid regression repairs rejected candidate | No |

Model/settings disclosure: the runtime identifies this agent as GPT-6/Codex; no exact backend model identifier or thinking-level control is exposed to this child. No model switch or workflow execution was attempted. The skill's gpt-6.1-sol/low defaults describe a prospective improvement run, not verified settings of this comprehension reviewer.
