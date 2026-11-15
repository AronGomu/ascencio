# Explanation from reviewer B for candidate comprehension

## 1. Outcome and scope

I would improve one supplied target AI package through reproducible paired evaluations, delivering the strictly improved accepted source or honestly unchanged source, verified results and compact history. Optional inputs are extra frozen opponents, owner limits and a compatible checkpoint. Only target AI changes are permitted; decks, engine, legality and hidden information remain protected. This is comprehension only: I have not run the workflow, delegated analysts, changed the candidate or invoked automatic review.

## 2. Process overview

I would use the stateless controller one task at a time, checking semantic completion and persisting the next checkpoint through owning tools before advancing. Prepare freezes setup and separately calibrates both pools; Evaluate, Decide and Analyze repeat for each candidate. Analysis always occurs after the decision, even the last one. Replay tests isolated edits; Assemble combines passing edits for full evaluation. No qualifying edit or the decision ceiling reaches Deliver; limits and incidents override that path with suspension. Only explicit authorized continuation resumes a verified prior stage.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved bot/checkpoint | Orchestrator reads defaults/contracts, discovers tool schemas, uses frozen bot:setup, archives initial source and validates bindings | Calibration separate from evaluation/analysis | Valid current runner/setup and both matching recommendations | Effective config, source identities, seeds, schedule, calibration records, slice assignments | ready → Evaluate |
| Evaluate | Frozen validated baseline or changed combined candidate | Orchestrator binds accepted control, sources and schedule; reuses verified evidence or runs missing matches using bot:session/bot:matches | Saved match optimum; four games and sideboarding sequential within each match | Every match finalizes; reservations settled; evidence, coverage, results and resources verified | Receipts, typed logs, results and candidate paired difference | complete → Decide |
| Decide | Verified evaluation | Orchestrator records baseline reference without decision charge; otherwise independently verifies strict improvement, invokes bot:decide, archives evaluated version and updates history | Sequential | Valid higher weighted paired rate promotes; all other outcomes retain incumbent | Decision/reason, full commit SHA, history and checkpoint | complete → Analyze |
| Analyze | Full evaluation barrier and decision | Orchestrator syncs slices one at a time while dispatching; analysts claim whole slices, read every permitted page and checkpoint findings; orchestrator audits/reconciles merged report | One owner per consecutive 250-match slice; queue to runtime slots | Exactly-once complete target-loss coverage, source-bound report; choose ordinary/repair source | Per-match Markdown, claims/checkpoints, final loss-analysis.md | ceiling → Deliver; otherwise continue → Replay |
| Replay | Report complete, resources available | Orchestrator checks history, implements immutable isolated variants and replays every associated loss against unchanged analysis source | Saved replay optimum bounded by resources; wait for all reason jobs | Reason has ≥5 distinct supported losses; edit converts ≥5 and ≥5% with intended choice changed; every case settles | Rule IDs, operations, hashes, all control/takeover outcomes and summaries | any passing edit → Assemble; none → Deliver |
| Assemble | Passing isolated edits | Orchestrator combines all from mode base, resolves overlaps and re-gates materially changed isolated logic, validates/freezes source and updates history | Sequential assembly | Preserved validated semantics/attribution; no extra combined replay gate | Frozen candidate, rules/hash/base/replay references; no proposal.md | ready → Evaluate |
| Deliver | Ceiling analyzed or no qualifying edit | Orchestrator verifies, ranks existing comparable evidence, exports accepted AI and checks consolidated report before eligible cleanup | No new games | Required evidence and export verified; honest actual completion status | Export/hash, checked report, retained history/state | complete → Closed |
| Suspended | Stop event from active stage | Orchestrator stops owned work, settles reservations, checkpoints and reports | Grace then terminate owned process groups only | Shutdown verified; preserve incomplete status/evidence | Prior stage, uncovered work, source bindings, budgets and next action | explicit authorized resume → prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Experiment | Pinned config, engine/content/runner/comparison identities | Explicit compatible continuation limits | Opponent order, schedule, starting inputs and source bindings | Setup/validation tools and evidence audit |
| Opponents/control | Starting AI always frozen self-opponent plus optional extras | Accepted comparator moves after promotion | Frozen opponent packages | Commit/hash checks; accepted independent of HEAD |
| Source mode | Accepted source ordinarily; regressing evaluated source for repair | Add one isolated fix ordinarily; remove/update one existing rule in repair | Unchanged analysis control and assembly base; repair adds none | Separate accepted/replay/base identities and immutable hashes |
| Scoring | Completed paired intersections | Finalized ignores excluded from both comparison sides | Game weighting; draws zero wins in denominator; opponents equally weighted | Require one completed pair per opponent; unresolved comparability unassessable; no confidence intervals |
| Analyst access | Positive allowlist of completed target-loss projections | Findings/categories reconciled globally | No full two-actor, winning, draw, ignored or opponent-only gameplay | Packet/page hashes, exact decision and choice IDs, audit; no-loss slice opens none |
| Interfaces/archive | campaign / round / incumbent; stable IDs | Unique immutable run/version IDs, new candidate commits | Existing command names/keys/paths; source/history only in Git | Commit journal, required subject/trailers, git show retrieval |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Candidate decisions | 50 | Pin owner values before launch | Persisted decisions only; baseline free | Analyze final evaluation then Deliver |
| Evaluation | 2,500 four-game matches | Pin total matches; matchesPerOpponent unset | Floor allocation per opponent plus ordered remainder, at least one each | Finish scheduled eligible work or suspend on resources |
| Evaluation games | 510,000 planned at defaults; 51,000 recovery | Formula (1 + effective decisions) × matches × 4; recovery floor 10% | Reserve through gate; failed/interrupted attempts charged; caches zero; planned/recovery separate | Recovery exhausted: ignore remaining interrupted games, request no extra games |
| Wall/storage | 86,400,000 ms; 50,000,000,000 bytes | Explicit effective config/authorized continuation | Original startedAt includes downtime; logical staged/log/evidence/import bytes; 16,000,000 protected control bytes inside cap | Suspend; no ranking/export/further analysis/closure cleanup |
| Deadlines | Evaluation 18,000,000; candidate preparation 600,000; validation/replay 300,000; shutdown 60,000 ms | Resolve timeoutsMs and cap by remaining wall time | Launch to exit, replay prefix included | Apply incident-specific handling |
| Calibration | Every worker count 2..logical CPUs | No arbitrary fallback | Match calibrator repetitions; replay two successful repetitions, full independent batch/worker at largest stage, identical outcomes; smallest count within 3% fastest median | Retry failed count stage once, then exclude; none qualifying stops |
| Rule replay | No game quota | Resource-bound measured concurrency | Every associated loss; timeouts remain conversion denominator; diagnostics/control/takeover distinct | Resources suspend; case timeout never retries |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual game/replay timeout | Bug report and finalized ignored outcome; continue safe jobs | Never case retry | Timeout reason and paired exclusion/nonconversion | Normal safe progression |
| Interrupted evaluation | Retain verified completions, settle every attempt, recover missing work | Within fixed 10% recovery and remaining deadlines/resources | Receipts/reservations and interrupted prefix | Verified missing work only |
| Calibration count failure | Fresh evidence directory, same inputs | One retry; second excludes count/repetitions | Both attempts and retry state | Other qualifying counts; integrity failures stop |
| Unsupported package pre-admission | Preserve failure; adapt build/validation tooling only, run related checks and validate fresh | No evaluation charge; stop if still invalid | Failed and fresh validation evidence | Protected boundaries hold and validation passes |
| Integrity/prefix/init/sideboarding/other validation failure | Stop; never label unsafe state ignored | No generic retry; ordinary replay recovery has none | Error and bound inputs | Applicable incident authorization and verified checkpoint |
| Time/storage limit | Halt admission, storage marker blocks data writes | No implicit increase | All resumable details/accounting | Explicit continuation; storage increase persists full request, updates gate under writer lock, commits continuation after session lock release |
| Owner stop or analyst failure | Stop admission/owned work, preserve claims/uncovered losses | No automatic reassignment/retry | Ownership and incomplete coverage | Explicit same-checkpoint instruction; no duplicate owners |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Shared state | Configuration, identities, decisions/accounting, receipts once | run.json; iterations/iteration-N/iteration.json and owned records | After closure compactly | Consolidate via tools; never hand-edit generated JSON |
| Detailed evidence | Typed .log gameplay; pages, findings, replay traces, source hashes, schedules and bundles | Existing run/game/analysis paths | All execution, validation, replay, reuse/resume needs end | Rejected details eligible after summarized analysis/decision; accepted additionally until replacement/closure; owner retention wins |
| Git/history/export | Every evaluated candidate including rejected; English compact attempt lines, SUPERSEDED replacements; accepted export/hash | Git, improvement-history.md, export destination | After closure | Unevaluated variants temporary, no permanent archival source copies |
| Checked report | IDs/hashes/config/times/status, version W/L/D and weighted/paired results, attempted rule counts/dispositions, coverage, accounting, errors and accepted export | Project report path or artifacts/ | Permanent compact record | At checked closure remove only eligible details; no game IDs/decision details in closure rule aggregates |
| Suspension checkpoint/report | Prior/next stage, pending work, used/remaining budgets and required limit change | Existing state and report | Completion or explicit incomplete closure | Suspension itself never authorizes closure cleanup; summary-only closed runs cannot provide verified cached games/replays |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Controller invocation | Candidate command names original skill directory instead of candidate directory | For a real candidate execution, use candidate-local controller; do not silently execute a different package | Verify controller identity/path before running anything | Yes if required to execute exact printed command |
| A2 | runner reference | Linked runner document has no requested minimum-runner-interface anchor and contains a full alternative workflow, including legacy paths | Candidate explicitly restricts current session-typescript/v1; use linked document only for necessary runner mechanics, not its conflicting workflow | No legacy migration or inherited conflicting limits; resolve missing authoritative interface at owning tools | If actual schemas cannot establish compatibility |
| A3 | Autonomy vs slice protocol | Delegate loss diagnosis only, but unclear whether orchestrator may personally fill analyst slots | Protocol's one analyst owner per whole slice governs; orchestrator performs merge and implementation | Runtime slots queue rather than shrinking/merging slices | No |

Actual reviewer model: inherited GPT-6 agent context; exact backend model identifier and reasoning setting were not exposed to this reviewer. Candidate defaults gpt-6.1-sol/low are proposed execution defaults, not evidence of this reviewer's runtime settings.
