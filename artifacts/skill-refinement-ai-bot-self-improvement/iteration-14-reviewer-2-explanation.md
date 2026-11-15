# Explanation from reviewer 2 for AI bot improvement execution

## 1. Outcome and scope

Improve one supplied target package using paired games against frozen starting AI plus optional opponents, retaining only strictly superior valid candidates. Deliver accepted committed source/export, verified results and compact history; unchanged accepted source is a valid outcome. Changes remain within target AI and current session-typescript/v1 contracts.

## 2. Process overview

Prepare identities, limits, frozen setup and both calibrated pools; evaluate baseline, decide, then analyze every completed evaluation. Merge delegated loss findings before implementing isolated additions or regression repairs. Replay all associated losses, combine passing edits, evaluate and repeat until the decision ceiling or no qualifying edit. Stops suspend with preserved checkpoint; authorized continuation resumes the prior stage. The stateless controller routes stages while project tools persist transactions and the orchestrator checks semantic gates.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Target resolved | Orchestrator reads contracts/defaults, freezes setup, archives initial source, calibrates pools | Separate calibration, no evaluation/analysis overlap | Valid setup and matching optimal recommendations | Configuration, hashes, schedule, calibration records | Evaluate |
| Evaluate | Frozen baseline/candidate | Tools bind accepted control and paired schedule; execute missing verified matches | Optimal match workers; four games/sideboarding sequential | Every match final, settled reservations, verified evidence/resources | Logs, results, paired coverage/difference | Decide |
| Decide | Evaluation complete | Orchestrator verifies promotion; tools persist decision, commit candidate and history | Sequential | Baseline accepted without decision charge; candidate strictly improves valid equal-opponent paired game rate | Decision, source commit, checkpoint/history | Analyze |
| Analyze | Full evaluation barrier | Slice tools assign whole consecutive 250-match slices; analysts inspect target completed losses only; orchestrator reconciles all reasons | One owner per slice, queued runtime slots; no independent match claims | Exactly-once complete source-bound report, including final evaluation | Checkpointed findings, per-match Markdown, loss-analysis.md | Ceiling: Deliver; otherwise Replay |
| Replay | Merged reasons/source mode selected | Orchestrator implements isolated variants; tools replay each associated primary decision against unchanged analysis source | Measured replay pool, wait for every reason | Reason affects ≥5 distinct losses; retain edit converting ≥5 and ≥5% with intended choice changed | Stable IDs/hashes, controls/takeovers, complete outcomes | Passing edit: Assemble; none: Deliver |
| Assemble | Passing isolated edits | Orchestrator combines edits from mode base, resolves overlap, validates/freezes; tools update history | Sequential | Materially changed isolated logic re-passes; no extra combined gate | Candidate/hash, attribution, replay references | Evaluate |
| Deliver | Final analysis or no qualifying edit | Tools export accepted source; orchestrator checks report/ranking before eligible cleanup | Sequential | Required analyses/decisions and checked consolidation | Report, export/hash, compact permanent state | Closed |
| Suspend | Any overriding stop | Stop owned work, settle, verify shutdown, checkpoint and report | Grace-bound shutdown | Preserve incomplete state, identities, pending coverage and budgets | Resumable checkpoint and stop report | Authorized verified prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Target/opponents | Supplied target, starting self-opponent and extras | Target AI edits; accepted reference moves | Opponents, decks, engine, legality, hidden-information boundary | Exact source validation/hashes |
| Comparison | Frozen ordered schedule and stable game IDs | Decisions/sideboarding trajectories | Paired starting orders, seeds, sides, content/rules and randomness derivation | Completed paired intersection; exclude ignored on both sides; every opponent represented |
| Source roles | Accepted, analysis/replay source, assembly base separately recorded | Ordinary uses accepted; valid regression repair uses regressing candidate | Comparator always accepted; repair preserves other rules and adds none | Binding records and immutable isolated sources |
| Evidence reuse | Matching identities/settings/implementation/schedule/integrity | Compatible cached completions/findings | Provenance and original coverage | Native receipts, source/hash audits; summary-only closed runs cannot supply cache |
| Versioning | Initial exact commit on main or reused commit | Every evaluated candidate gets immutable version commit | Accepted independent of HEAD; unevaluated variants uncommitted | Helper journal, trailers, full SHA/path/hash |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions | 50 | Pin owner limits in configuration | Persisted candidates only; baseline excluded | Analyze final evaluation then Deliver |
| Evaluation | 2500 four-game matches/evaluation | Pin total; require ≥1/opponent, distribute floor plus ordered remainder | Planned=(1+effective decisions)×matches×4; recovery=floor(10% planned); caches zero | Interrupted recovery exhausted: ignore remaining interrupted games and continue eligible work |
| Wall/storage | 24h / 50GB | Explicit effective limits; storage always passed | Original start includes downtime; logical imports/evidence/staging count; 16MB control reserve inside cap | Suspend, block new data writes; explicit increase/continuation only |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay branch 5m; shutdown 60s | Resolve stage/branch values | Launch-to-exit including replay prefix, capped by remaining wall time | Apply relevant incident policy |
| Replay/calibration | No rule-replay game quota | Diagnostic admission classification must resolve | Time/storage charged; diagnostics separate from evaluation/rule validation | Resource policy applies |
| Calibration workers | Every count 2 through logical CPUs | No arbitrary substitute | Match calibrator repetitions; replay two full qualifying repetitions, smallest within 3% fastest median | No qualifying count stops preparation |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual game/replay timeout | Bug report, finalize ignored; never conversion | None for that case | Timeout/reason and settled accounting | Continue safe jobs |
| Interrupted evaluation | Recover verified missing work | Automatic within recovery allowance/deadlines | Completed evidence and all reservations/attempts | Comparable verified work remains |
| Failed calibration stage | Fresh directory, identical pinned inputs | Once; second failure excludes count and remaining repetitions | Both attempts and persisted retry state | Other counts may continue |
| Unsupported package before admission | Adapt build/validation tooling only, check locally | Fresh validation, no game charge | Failed validation | Protected boundary valid; otherwise stop |
| Integrity/prefix, initialization, sideboarding or other non-timeout validation failure | Stop | No generic retry | Failure and checkpoint | Applicable explicit verified continuation; never ignore unsafe state |
| Resource/owner stop or analyst failure | Stop admission/owned work, settle after grace then terminate owned groups | No implicit budget increase | Claims, uncovered losses, pending jobs and consumed budgets | Explicit same-checkpoint authorization; storage transaction follows writer-lock continuation protocol |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State | Configuration, identities, decisions, receipts/accounting/checkpoints | Existing run.json and iteration.json paths | Permanent compact records | Consolidate through owning tools |
| Detailed evidence | Typed lossless .log, target projections/pages, findings, replay traces, variant hashes, packages, schedules, native receipts | Existing games/analyses/evaluation paths | All execution/validation/replay/reuse/resume needs end; accepted detail until replacement or closure | Designated pruning only; no cleanup during resource suspension |
| Source/history/export | All evaluated version commits, English compact attempt lines, superseded markings, accepted export/hash | Git, improvement-history.md, export path | After closure | No permanent archival source copies beyond retained version/history/export |
| Report | Identities, version W/L/D/rates/paired differences, rule totals, coverage, accounting, errors, ranking, accepted export and unresolved issues | Project location or artifacts/ | Permanent checked closure report | Closed cleanup only after consolidation; suspended report records next action/limit need |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Inputs; Limits; Autonomy | “Missing required limits” is not distinguished from optional owner limits given complete defaults | Defaults resolve absent ordinary limits; ask only if required setup values cannot be resolved | Avoid needless permission requests while stopping unresolved schema/admission conflicts | No, unless owning schema disagrees |
| A2 | Incident policy versus Analyze ordinary unassessable branch | Some unassessable comparisons are permitted while integrity failures always stop | Missing valid paired coverage may reject as unassessable; known integrity/prefix failures always suspend | Never route a corrupt run into another ordinary candidate | No |
