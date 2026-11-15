# Explanation from reviewer 3 for execution review

## 1. Outcome and scope

Improve one supplied target AI against frozen starting-self and optional opponents, delivering strictly improved accepted source or an honest unchanged result, verified paired results and compact history. Only target AI changes; decks, engine, legality and information boundaries remain protected. Owner limits/checkpoint are optional unless unresolved mandatory values require clarification.

## 2. Process overview

Prepare reproducible frozen setup and separate calibrations, evaluate baseline, decide and analyze every evaluation. Below the decision ceiling, diagnose all completed target losses, replay isolated eligible fixes, combine passing edits and repeat evaluation. A valid regression switches to removal/update repair of the regressing source against accepted control. No qualifying edit or completed ceiling delivers; incidents override progression with stop/checkpoint behavior.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Target resolved | Orchestrator discovers owning schemas, pins setup/defaults, archives source and calibrates | Calibration separate from evaluation/analysis | Valid current runner, frozen inputs, two matching recommendations | Run configuration, source commit, calibration evidence | Evaluate |
| Evaluate | Verified candidate/baseline | Orchestrator validates, binds and runs/reuses matching paired matches | Measured match workers; four games/sideboarding sequential | All scheduled work finalized, reservations settled and comparison verified | Typed logs, receipts, results, paired difference | Decide |
| Decide | Evaluation complete | Orchestrator verifies strict game-weighted improvement and persists decision/archive/history | Sequential | Baseline reference or accepted/rejected candidate recorded | Decision, candidate commit, history | Analyze |
| Analyze | Decision recorded | Delegated analysts review whole fixed slices; orchestrator audits and merges all reasons | One owner per 250-match slice; queued slots | Source-bound complete report, including final/rejected evaluation | Findings, coverage, loss report | Deliver at ceiling; otherwise Replay |
| Replay | Eligible reasons/source mode selected | Orchestrator implements isolated rules, replays every associated loss against unchanged source | Measured replay workers, bounded resources | Every case settled; each retained rule converts ≥5 and ≥5% with intended choice changed | Immutable variants, hashes, traces, dispositions | Assemble if any pass; otherwise Deliver |
| Assemble | Passing isolated edits | Orchestrator combines, resolves overlaps, revalidates materially changed logic and freezes | Sequential assembly | Valid combined source, correct base/attribution, history bound | Candidate hash/rule IDs/replay references | Evaluate |
| Deliver | Normal terminal condition | Rank existing comparable evidence, export accepted source, check report, prune eligible details | No fresh ranking games | Required analyses/decisions checked and consolidation complete | Export/hash, report, compact state/history | Closed |
| Suspend | Incident/resource/owner stop | Stop owned work, settle/checkpoint and report | Grace bounded shutdown | Shutdown verified; resume authorization and budget checked | Pending coverage/jobs, identities, budgets, next stage | Authorized prior stage or explicit incomplete closure |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Target/control/opponents | Starting target plus frozen opponents | Accepted control advances on qualifying decision | Starting self/opponents and protected domains | Source hashes, validation and transaction bindings |
| Paired evaluation | Pinned schedule/order/seeds/sides/content/rules | Gameplay trajectories | Starting inputs, runner/engine/comparison identities | Reuse integrity and paired intersections; every opponent represented |
| Next edit source | Accepted ordinary; regressing candidate for repair | One additive ordinary fix or existing-rule repair | Unchanged isolated replay control/base; unedited repair rules | Source-bound analysis and variant hashes |
| Analysis | Frozen evaluation and slice packet hashes | Reconcile synonymous reasons | Whole disjoint slice ownership; target-loss allowlists | Audit, exact choice IDs, exactly-once loss coverage |
| Version history | Starting commit on main/exact reuse | Commit every evaluated candidate | Stable bot IDs, immutable unique run/version IDs, independent accepted reference | Commit journal, trailers/full SHA/path |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions | 50 | Pin resolved owner values | Persisted candidates; baseline excluded | Analyze final then deliver |
| Evaluation | 2500 four-game matches | Pin total/order; at least one/opponent | Floor allocation plus ordered remainder; planned=(1+decisions)×matches×4 | No qualifying edit may end early |
| Recovery | Floor 10% planned games | No implicit extra games | Failed/interrupted reservations and recovery count; cached executions add none | Ignore remaining interrupted games; continue eligible work |
| Time/storage | 24h / 50GB | Explicit continuation; full effective limits | Original start including downtime; logical/import bytes; 16MB protected control reserve | Suspend; no ranking/export/analysis/cleanup |
| Stage deadlines | Evaluation 5h; preparation 10m; validation/replay 5m; shutdown 60s | Pin effective timeouts | Launch-to-exit including replay prefix, capped by wall remainder | Apply incident row |
| Calibration/replays | Workers 2..logical CPUs; replay two repetitions | No invented worker fallback | Diagnostics separate from evaluation; time/storage apply | Stop if no qualifier or unresolved admission conflict |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report; finalized ignore, safe jobs continue | Never retry case | Ignored reason/count; replay stays denominator, no conversion | Safe work continues |
| Interrupted evaluation | Preserve completion and recover missing jobs | Within recovery allowance/deadlines | Every attempt/reservation/timeout | Remaining resources; exhaustion ignores interrupted remainder |
| Failed calibration stage | Fresh directory, same inputs | Once; second failure excludes count/repetitions | Both attempts and retry state | Other counts may qualify |
| Unsupported pre-admission package | Adapt build/validation tooling only | Fresh validation after related checks | Failure evidence | Valid protected boundaries, else stop |
| Integrity/prefix/init/sideboard/other validation failure | Stop | No generic retry | Unsafe-state evidence | Applicable authorized verified continuation only |
| Resource/owner/analyst stop | Stop admission, bounded owned shutdown and settle | No implicit extension | Claims, uncovered work, checkpoint/budgets | Explicit instruction/increase as applicable; no duplicate owners |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Shared state | Configuration, identities, decisions, receipts/accounting | Existing run.json and iteration.json paths | After closure compactly | Consolidate through owning tools |
| Execution evidence | Typed logs, packets/findings, reports, replay traces, hashes, schedules/frozen packages | Existing game/evaluation directories | All execution/validation/reuse/resume needs end; accepted additionally replacement/closure | Designated pruning; owner retention wins; no suspension cleanup |
| Permanent result | Git versions, English attempt lines/statuses, accepted export/hash | Bot history, Git and export | After closure | No permanent archival source copies |
| Checked report | Version/per-opponent results, paired coverage, rule counts, errors, budgets, accepted reference/ranking | Project/artifacts | After closure | Aggregate only; omit game/decision detail; summary-only runs cannot supply caches |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Prepare versus slice protocol | “whole consecutive 250-match slices” versus explicit final smaller slice | Whole means never divide a slice assignment; permit final partial slice | Nonmultiples of 250 use ceil(total/250) owners | No; protocol resolves |
| A2 | Calibration identity | Representative logs/fixture required before baseline evaluation | Use retained compatible losses or deterministic diagnostic fixture, classified diagnostics before admission | Preparation does not run evaluation early to manufacture losses | No; stated alternatives resolve |
| A3 | Analyst dispatch | Setup analysis-workers equals slice count but runtime slots queued | Assignment count is not unrestricted simultaneous worker count | Preserve one whole-slice owner while respecting actual resource slots | No; operational slot selection discovered from owning tools |

No unresolved misunderstanding identified within the supplied package. Linked external contracts were intentionally not read in this restricted review; exact execution schemas remain an explicit discovery dependency.
