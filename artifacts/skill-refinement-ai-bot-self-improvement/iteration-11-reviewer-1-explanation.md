# Explanation from reviewer 1 for refined skill execution

## 1. Outcome and scope

Given one target AI package, optional opponents, owner limits and possibly a compatible checkpoint, improve only the target AI through reproducible paired games against frozen opponents including its starting source. Success is a verified accepted export, evaluated-version history and checked report; unchanged accepted source is a valid result when no edit qualifies. Engine, decks, legality and information boundaries remain protected.

## 2. Process overview

Use the stateless controller one stage at a time while project tools persist and enforce transactions. Prepare and calibrate, evaluate the unchanged baseline, decide, then analyze all completed target losses. Replay isolated fixes, assemble all qualifying edits and repeat evaluation/decision/analysis until the decision ceiling or no qualifying edit. A valid regression switches the next attempt to removal/update repair of the regressing source. Resource and incident stops override progression; delivery consolidates evidence before eligible cleanup.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Inputs resolved | Orchestrator discovers runner/schema, pins setup, validates sources, archives baseline and calibrates both pools | Calibration separate from evaluation/analysis; test counts 2..logical CPUs | Verified setup and matching successful recommendations | Configuration, source commit, schedules, measurements | Evaluate |
| Evaluate | Valid frozen baseline/candidate | Orchestrator binds accepted comparator and schedule; tools reuse verified evidence/run missing matches | Optimal match pool; four games and sideboarding sequential per match | All matches finalized, reservations settled, coverage/resources verified | Typed logs, receipts, paired results | Decide |
| Decide | Completed evaluation | Orchestrator verifies strict paired improvement; tools persist decision, archive evaluated source and history | Sequential | Baseline accepted without decision charge; candidate promoted only if valid strict improvement | Outcome, difference, commit/checkpoint | Analyze |
| Analyze | Full evaluation barrier | Delegated slice owners review every allowlisted completed target loss; orchestrator merges/reconciles report | Whole consecutive 250-match slices, one owner each; queued slots | Complete audited source-bound coverage/report | Findings, per-match Markdown, loss-analysis.md | Deliver at ceiling; otherwise Replay |
| Replay | Next source mode selected | Orchestrator reads history, implements isolated rules and replays all associated losses against unchanged source | Measured replay pool, immutable variants | Reasons need ≥5 losses; rule needs ≥5 and ≥5% conversions, intended choice changed; all cases settle | Rule IDs/hashes, controls/takeovers, counts | Assemble if any pass; otherwise Deliver |
| Assemble | Passing rules | Orchestrator combines fixes or repairs from proper base; changed logic repeats isolated gate; tools validate/freeze and record history | No combined-rule gate | Preserved validated semantics and target-only boundary | Candidate hash, rules, base/replay bindings | Evaluate |
| Deliver | Ceiling analyzed or no edit | Orchestrator ranks comparable existing results, exports accepted source, checks consolidation, prunes eligible evidence | No fresh games | Required analysis/decisions and checked report complete | Export/hash, compact state/history/report | Closed |
| Suspend/resume | Stop or authorized continuation | Stop owned work, settle/checkpoint, preserve prior stage; resume verified checkpoint only | Shutdown grace then owned process termination | Authorization and sufficient remaining/increased limits | Stop reason, pending coverage, identities, budgets | Prior stage or explicit incomplete closure |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Opponents | Frozen supplied bots plus starting AI | None | Packages/order | Hashes and setup |
| Accepted control | Starting source | Strictly improving accepted candidate | Independent of HEAD and rejected versions | Paired intersections and persisted decision |
| Paired execution | Pinned schedule/configuration | Trajectories via choices/sideboarding | Starting decks, seeds, sides, rules/content and stable randomness derivation | Binding/integrity checks |
| Source modes | Accepted source ordinary; regressing candidate repair | Add one ordinary fix; remove/update one existing repair rule | Unchanged analysis/replay control; unedited repair rules | Source hashes, rule IDs and replay evidence |
| Analysis access | Packet loss allowlists | Matching audited reuse | Target perspective only; unknowns preserved | Page/log hashes, exact IDs and unique coverage |
| Version archive | Exact initial commit or creation on main | Commit every evaluated candidate | Stable bot ID, immutable version/run IDs, full provenance | Helper journal and Git trailers |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions | 50 | Pin owner override | Persisted candidate decisions only | Analyze final evaluation then Deliver |
| Evaluation | 2500 four-game matches/evaluation | Pin total; at least one/opponent | Equal allocation plus ordered remainder; planned=(1+effective decisions)×matches×4; recovery=floor(10% planned) | Interrupted missing games beyond recovery ignored |
| Wall time | 24h | Explicit effective limit/continuation | Original start includes downtime | Suspend |
| Storage | 50GB decimal | Explicit cap; authorized locked increase | Logical staging/log/evidence/import bytes; 16MB control reserve inside cap | Block data writes, suspend without cleanup |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay branch 5m; shutdown 60s | Resolved stage deadlines bounded by wall remainder | Launch-to-exit, including replay prefix | Incident-specific handling |
| Diagnostics/replays | No rule-replay game quota | Must fit time/storage | Separate controls/takeovers/calibration from evaluation; failed/cancelled reservations count, cache adds zero | Suspend on resource exhaustion |
| Calibration | Required match repetitions; replay two | No arbitrary worker fallback | Failed attempts and exclusions persist | Retry failed count stage once; stop if none qualifies |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report; ignored evaluation game excluded from both paired rates; replay ignored stays denominator, never conversion | None for that case | Timeout record and accounting | Safe jobs continue |
| Interrupted evaluation | Recover missing verified work | Automatic within recovery allowance/deadlines | Completed work and all reservations | Remaining interrupted games ignored after allowance |
| Calibration count failure | Fresh evidence directory, same inputs | Once, then exclude count/repetitions | Both attempts and retry state | Other counts continue |
| Unsupported format before admission | Adapt build/validation tooling only, local checks, fresh validation directory | No generic count stated | Failed validation | Valid protected-boundary-preserving package; otherwise stop |
| Integrity/input-prefix, initialization, sideboarding or other non-timeout validation failure | Stop | No generic retry | Failure and checkpoint | No automatic continuation specified |
| Time/storage stop | Stop admission; bounded owned shutdown; checkpoint/report | No implicit increase | All resumable detail | Explicit increase/continuation |
| Owner stop or analyst execution failure | Stop owned work; preserve claims/uncovered losses | Explicit instruction | Coverage, claims, pending jobs | Same verified checkpoint, no duplicate owners |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Compact control state | Configuration, identities, decisions, budgets, checkpoint references | Existing run.json and iteration.json | After closure | Preserve |
| Execution evidence | Typed .log gameplay, receipts, slices/findings, replay traces, variant hashes, frozen sources/schedules | Existing run artifact paths | No remaining execution/validation/replay/reuse/resume needs; accepted details until replacement/closure | Lifecycle-eligible tool pruning; no suspension cleanup |
| History/versions | All evaluated commits, English compact attempt lines, supersession, source hashes | Git and improvement-history.md | After closure | Preserve; no permanent source copies |
| Report/export | Version results, paired coverage, attempts/counts, budgets/errors, accepted commit/export/hash and unresolved issues | Project/artifacts plus accepted export | After closure | Checked consolidation precedes eligible temporary deletion; summary-only runs cannot provide caches |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Calibration identity / replay fixture | Fresh runs require verified completed losses before baseline, while calibrations precede baseline | Use retained compatible logs or the explicitly allowed deterministic diagnostic fixture | Preparation can proceed without spending baseline evaluation before calibration | No; external runner contract must supply fixture details |
| A2 | Slice protocol / analysis-workers | Worker count equals slice count, but queued runtime slots have no explicit runtime concurrency value | Slice count controls ownership; owning tool's supported queue/resource controls determine simultaneous analysts | Do not interpret all slice owners as necessarily simultaneous executions | Tool discovery needed if no queue policy exists |
| A3 | Regression repair source mode | Several valid lower-rate candidates could occur consecutively | Each next repair diagnoses the latest evaluated regressing candidate, retaining accepted comparator | Repair source can move while accepted source stays fixed | No |
