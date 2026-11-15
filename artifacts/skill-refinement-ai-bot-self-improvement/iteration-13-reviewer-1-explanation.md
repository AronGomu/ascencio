# Explanation from reviewer 1 for refined bot-improvement execution

## 1. Outcome and scope

Improve one required target AI package against frozen starting-self and optional additional opponents, delivering only a strictly better valid accepted source, verified results and compact history. Preserve decks, engine, legality and hidden information. Owner limits and compatible checkpoints are optional; an unchanged accepted source is a valid honest result when no edit qualifies.

## 2. Process overview

Prepare frozen inputs and both calibrations; evaluate baseline, decide, and analyze all target losses. Replay isolated eligible fixes, assemble all passing edits, then repeat evaluation/decision/analysis until the decision ceiling or no qualifying edit. A valid regression switches the next attempt to removal/update repair based on that rejected source; ordinary attempts use accepted source. Deliver and close only after verification; resource exhaustion suspends instead. The stateless controller prints legal tasks, while project tools persist evidence and the orchestrator verifies gates.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved target | Orchestrator reads runner contract/defaults, discovers schemas, runs setup/validation, archives initial source, calibrates | Calibration separate from evaluation/analysis; counts 2 through logical CPUs | Exact sources/setup and both matching optimal recommendations verified | Pinned run configuration, schedules, commits, calibration reports | Evaluate |
| Evaluate | Frozen valid baseline/candidate | Orchestrator binds accepted control/source/schedule, reuses compatible evidence or runs missing matches | Optimal match pool; four games and sideboarding sequential within match | All scheduled matches finalized, reservations settled, coverage/resources verified | Typed logs, receipts, results, paired difference | Decide |
| Decide | Complete evaluation | Orchestrator independently checks strict paired improvement; tool persists decision and candidate archive/history | One controller task | Baseline sets reference without decision; candidate accepted only if valid and strictly better | Outcome/reason, SHA, checkpoint | Analyze |
| Analyze | Evaluation barrier and decision | Delegated analysts claim disjoint consecutive 250-match slices; orchestrator merges source-bound report | One owner per whole slice; queued slots; sync one slice at a time | Every completed target loss reviewed exactly once; all hypotheses retained and reconciled | Hash-bound checkpoints, per-match Markdown, full loss report | Deliver at ceiling; suspend on resources; otherwise Replay |
| Replay | Completed source analysis | Orchestrator implements isolated add-fix or repair variants; replays every associated loss at primary decision against unchanged mode source | Measured replay pool bounded by resources | Reason affects >=5 losses; all cases settled; >=5 and >=5% convert with intended choice changed | Immutable hashes/directories, rule IDs, controls/takeovers, exclusions | Assemble if any pass; otherwise Deliver |
| Assemble | Passing isolated edits | Orchestrator combines from mode base; preserves repair rules and attribution; rechecks materially changed isolated logic | No extra combined-rule gate | Validated frozen candidate; history records accepted base and replay references | Candidate hash, rules/history; no proposal | Evaluate |
| Deliver | Final analysis or no edit | Orchestrator ranks existing comparable results, exports accepted source, checks report/consolidation | No fresh comparison games | Required decisions/analyses verified and lifecycle eligibility established | Export/hash and checked report | Closed |
| Suspend | Stop condition | Orchestrator stops owned work, settles, checkpoints and reports | Bounded shutdown grace | Shutdown verified, pending work and consumed budgets preserved | Resumable checkpoint/report | Authorized verified prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Bot sources | Starting target and frozen opponents | Target only; accepted control moves after promotion | All opponents, protected boundaries | Source commits/hashes and target-only validation |
| Paired inputs | Setup seed, opponent order, schedule, deck orders, seeds, sides, rules/content | Choices/sideboarding trajectories | Starting inputs and stable-ID-derived randomness | Exact paired bindings and completed intersections |
| Comparison | Accepted versus candidate | Accepted moves on strict improvement | Game scoring, equal opponent weighting; draws zero wins in denominator | Ignore either-side ignored game from both; at least one valid pair per opponent; report coverage/reasons without confidence intervals |
| Mode | Accepted source, or valid regressing candidate | Ordinary adds one isolated fix; repair removes/updates one rule, adds none | Unchanged replay control and assembly base match mode source | Separate accepted/analysis/replay/base references; preserve unedited repair rules |
| Runtime/reuse | Current session-typescript/v1 | Fresh run for incompatible legacy state | Implementation/settings/integrity identities for reuse | Provenance and executed/reused counts; audit resumed analysis bytes |
| Analyst access | Explicit target-loss allowlist | Complete pages or full allowed loss log | No winning/opponent/full two-actor gameplay | Packet hashes, IDs, coverage, offered/chosen arrays |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions | 50 | Pin effective owner values | Persisted candidate decisions, baseline excluded; final analysis required | Deliver after analysis; no edit can finish earlier |
| Evaluation | 2500 four-game matches per evaluation | Total allocated quotient/remainder in frozen opponent order; >=1 each; matchesPerOpponent unset | Planned=(1+effective decisions)×matches×4; recovery=floor(10% planned); pin sum | Recovery exhausted: ignore remaining interrupted games, continue eligible work |
| Wall | 86400000 ms | Explicit continuation; preserve original start | Includes downtime and all work | Suspend |
| Storage | 50000000000 bytes | Always explicit; increase under writer-lock continuation protocol | Logical staged/log/evidence/import bytes; 16000000 control reserve inside cap | Suspend; marker blocks data writes; no cleanup/analysis/export |
| Deadlines | Evaluation 18000000; preparation 600000; validation and replay branch 300000 ms | Resolved stage/branch values capped by remaining wall | Launch to exit, including replay prefix | Incident-specific handling |
| Shutdown | 60000 ms | Effective configured grace | Owned groups only | Terminate, settle and checkpoint |
| Diagnostics/replays | No rule-replay game quota | Mandatory associated-loss coverage | Separate controls/takeovers/calibration from evaluation; all consume wall/storage; failed/interrupted reservations count, caches do not | Suspend if resources exhausted |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report; finalized ignored outcome; continue safe jobs | None for that case | Counts/reasons; replay timeout remains denominator, never conversion | No recovery of finalized timeout |
| Interrupted evaluation | Preserve completed work and account reservations | Automatic missing-work recovery within allowance/deadlines | Every attempt and verified completion | Remaining authorized resources |
| Calibration stage failure | Fresh evidence directory, same inputs | Once; second failure excludes count and remaining repetitions | Both attempts and exclusions across resume | At least one qualifying fully successful count; otherwise stop preparation |
| Unsupported format pre-admission | Retain failed validation; adjust build/validation tools only; local checks and fresh validation | No game charge; stop if still invalid | Validation evidence | Protected boundaries satisfied |
| Integrity/input-prefix or other non-timeout validation failure | Stop; never ignore unsafe state | No generic retry; ordinary replay has no automatic recovery | Failure/checkpoint | Applicable explicit authorization and verified checkpoint |
| Time/storage exhaustion | Stop all admission and owned work | No implicit increases | Pending jobs, claims, budgets, sources, prior stage | Explicit increase/continuation preserving consumption |
| Owner stop or analyst failure | Stop owned work and preserve uncovered losses | No duplicate ownership | Claims and partial findings | Explicit instruction on same verified checkpoint |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State | Configuration, identities, decisions, receipts/accounting | Existing run.json and iteration.json | After closure | Consolidate compact records, not duplicate ledgers |
| Source/history | Initial and evaluated candidate commits, immutable IDs/trailers, English attempt lines, SUPERSEDED replacements | Git/main starting archive, improvement-history.md | Permanent | Unevaluated variants stay temporary; no permanent package copies |
| Temporary evidence | Typed lossless .log, source-bound findings, replay traces, schedules, bundles, calibration records | Existing run/game/analysis paths | Execution, validation, replay, reuse and resume needs end; accepted detail until replacement or closure | Rejected detail may prune during run once summarized and no longer needed; owner retention overrides; never prune merely to fit cap |
| Report/export | All evaluated versions/results, attempted rules, aggregate coverage/accounting/errors, accepted SHA/export/hash, ranking, unresolved issues | Project/artifacts report and export | After closure | Checked closure consolidation permits eligible evidence removal; report omits game IDs/decision details |
| Suspended detail | Prior stage, pending work, continuation requirements | Verified checkpoint/report | Completion or explicit incomplete closure | No suspension cleanup; summary-only closed state cannot provide cached games/replays |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Prepare vs slice protocol | “Whole consecutive 250-match slices” could imply divisibility, while protocol explicitly allows a smaller last slice | Whole means indivisible assignment, with final partial slice allowed | ceil(matches/250) owners without rounding evaluation size | No |
| A2 | Incident policy | Generic integrity-stop and authorization wording does not define an automatically safe resume after corrected integrity failure | Stop and require explicit authorization plus newly verified checkpoint; do not retry by controller edge alone | Unsafe evidence cannot silently reenter comparisons | Only if such failure occurs |
