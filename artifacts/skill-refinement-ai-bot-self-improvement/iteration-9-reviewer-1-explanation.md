# Explanation from reviewer 1 for independent workflow interpretation

## 1. Outcome and scope

Improve one required target `ai-bot` against frozen starting self-opponent plus optional opponents; deliver accepted source, verified paired results and compact history, honestly retaining unchanged source when nothing qualifies. Only target AI changes; decks, engine, legality and hidden-information boundaries remain protected. Owner limits and compatible checkpoints are optional inputs; current `session-typescript/v1` is mandatory.

## 2. Process overview

Prepare → Evaluate → Decide → Analyze → Replay → Assemble → Evaluate repeats until decision ceiling or no qualifying edit; final evaluation still receives analysis. Deliver closes after checked export/report. Any active stage may suspend. Diagnosis alone is delegated; orchestrator implements. Stateless dispatcher checks syntactic stage/event edges and prints inherited policy/current instructions; it neither executes, persists, verifies evidence nor authorizes resume. Owning tools enforce transactions; orchestrator verifies semantic gates and checkpoints next stage.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved target | Orchestrator pins setup, sources, seed, limits, runner; archives starting source; calibrates both pools | Calibration separate from evaluation/analysis | Valid setup and matching measured recommendations; no arbitrary fallback | Configuration, source commit, measurements | Evaluate |
| Evaluate | Frozen starting/combined source | Validate target boundary; bind accepted control/schedule; reuse matching evidence or execute missing matches | Saved optimal match workers; four games/sideboarding sequential per match | All scheduled matches finalized, reservations settled, evidence/coverage verified | Logs, results, paired difference | Decide |
| Decide | Verified evaluation | Baseline sets accepted reference; candidates require strict paired improvement; persist decision, archive every evaluated candidate, update history | Serialized | Valid strict gain accepts; tie/regression/unassessable retains accepted | Decision, SHA, history/checkpoint | Analyze |
| Analyze | Full evaluation barrier | Sync one slice per call until preparationComplete; claim whole consecutive 250-match slices, last possibly smaller; diagnose and merge | One owner per slice, queued slots; configured workers = ceil(matches/250) | Every completed target loss reviewed exactly once; final source-bound report before ceiling check | Packets, findings, final loss-analysis.md | Ceiling: Deliver; otherwise Replay |
| Replay | Selected source mode/history | Orchestrator implements isolated immutable variants; replay every associated loss at recorded primary critical decision against unchanged analysis source | Measured bounded replay workers; await every reason/case | Reason ≥5 distinct losses; retain edit only with intended-choice wins ≥5 AND ≥5% of associated losses | Hashes, rule IDs, controls/takeovers, dispositions | Passing: Assemble; none: Deliver |
| Assemble | Passing edits | Combine all from mode base; preserve validated semantics/repair rules; materially altered isolated logic repeats gate; validate/freeze | No extra combined-rule gate | Valid candidate, attributed history with rules/hash/base/references; no proposal.md | Candidate/history | Evaluate |
| Deliver | Complete analyses and eligible termination | Rank existing comparable evidence, export accepted, check consolidation, then eligible cleanup | No fresh ranking games | Accurate terminal status and checked report | Export/hash/report | Closed |
| Suspended | Stop overrides progression | Stop admission/work; settle reservations and checkpoint | Owned shutdown grace then terminate owned groups only | Verified checkpoint plus applicable explicit authorization/resources for resume | Stop reason, pending coverage, budgets, next action | Verified prior stage |

Analyze protocol: analysts receive only packet `jobs[].losses[].log` allowlists, read every ordered review page or entire fallback log, record duration/bytes, preserve unknowns, and never traverse two-perspective logs or nonloss gameplay. No-loss slices open nothing. First-pass submissions bind schemaVersion 1, loss-markdown-v1, job/hash, primary findings once per loss and required reasons (possibly empty). Supported primary/secondary reasons include stable IDs, exact ordered offered/chosen IDs, decision, reason/solution; tools validate and generate Markdown. Checkpoint small completed-match batches; complete remaining findings or empty after checkpointing. Identical retries are safe; changed accepted reports rejected. Release requires token and terminated:true; reassignment invalidates stale completions. Status is metadata-only. Audit resumed completed analysis before rule trust: verify source/report/page bytes and coverage. Reconcile draft after all slices finish; slice layer exclusively dispatches, underlying queue only validates/archives. Trust requires verified native receipts and authoritative logs; standalone receipt publication follows writer closure.

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Comparison | Frozen opponents including starting AI | Accepted control moves on promotion | Inputs, seeds/IDs, schedule/order, rules/content/runner and source hashes | Matching provenance/integrity; counts reused/executed |
| Scoring | Games, equal opponent weighting | Completed paired intersection | Draws count zero wins; either-side ignores excluded from both; every opponent needs pair | Rates/differences/coverage, no confidence intervals |
| Ordinary source | Accepted analysis/replay/assembly source | Add one fix per isolated variant | Analyze rejected evaluation before returning to retained analysis | Separate accepted commit and mode bindings |
| Regression repair | Valid lower-rate candidate | Remove/update one existing rule, add none | Unedited regressing rules; accepted promotion comparator | New-loss flags use metadata only; associations are hypotheses |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decide/Evaluate | 50 decisions; 2500 total four-game matches | Pin owner limits; matchesPerOpponent unset | Baseline excluded from decisions; floor allocation plus ordered remainder, ≥1/opponent; planned=(1+effective decisions)×matches×4; recovery=floor(10% planned) | Analyze final decision; exhausted recovery ignores remaining interrupted games |
| All stages | 86400000 ms; 50000000000 decimal bytes | Explicit continuation preserves original start/consumption | Downtime included; logical staging/log/evidence/import bytes; protected 16000000-byte control reserve | Suspend, no analysis/ranking/export/cleanup |
| Deadlines | Evaluation 18000000; preparation 600000; validation/replay branch 300000; shutdown 60000 ms | Resolved stage limits capped by remaining wall time | Launch-to-exit includes replay prefix; reserve/settle all attempts; cache adds no games | Incident policy |
| Calibration/replay | No rule-replay game quota | Diagnostic admission must resolve | Both pools test 2..logical CPUs; replay two repetitions, full batch/worker at largest stage, identical outcomes; smallest within 3% fastest successful median | No qualifying count stops preparation |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report, finalize ignored; safe jobs continue | Never case retry | Timeout/reason; replay denominator retained, never conversion | Already settled |
| Interrupted evaluation | Recover verified missing work within resources | Automatic 10% recovery only | All attempts/reservations | Compatible checkpoint |
| Calibration stage failure | Fresh evidence, same inputs | Once; second excludes worker count/repetitions | Both attempts/retry state | Other qualifying counts |
| Unsupported preadmission package | Adapt build/validation tooling only; fresh validation/local checks | No game charge | Failed validation | Valid protected boundaries |
| Integrity/input-prefix, initialization/sideboarding/other validation failure | Stop | No generic replay recovery | Evidence/checkpoint | Authorized applicable resolution |
| Resource/owner/analyst stop | Stop owned work; preserve claims/uncovered losses | Explicit continuation only | Shutdown/settlement/source/budget checkpoint | Same verified checkpoint; no duplicate owners |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Control/history | Identities, configuration, decisions/accounting; compact English attempt lines; SUPERSEDED replacements | run.json, iteration.json, Git/history | After closure | Preserve compact records |
| Execution/analysis | Typed lossless .log, reports, receipts, variants, replay traces, frozen bundles | Existing game/evaluation paths | All execution/validation/replay/reuse/resume needs end; accepted additionally replacement/closure | Designated pruning; owner retention wins; delivery alone insufficient |
| Closure report/export | Version W/L/D/rates/differences, rules aggregate counts, unclear coverage, actual budgets/errors, accepted SHA/export/hash/ranking | Project/artifacts | Permanent compact evidence | Checked consolidation precedes eligible removal; summary-only closure supplies no cached evidence |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Prepare / slice protocol | “Whole consecutive 250-match slices” versus smaller last slice | Last remainder allowed explicitly | Never split ownership further | No |
| A2 | Controller resume | CLI accepts any active prior stage without checkpoint proof | Caller must prove actual prior stage/authorization | CLI success is no trust evidence | No |
| A3 | Calibration deadlines | No dedicated calibration timeout default | Resolve branch timeout in pinned setup; ask if required limit absent | No invented calibration deadline | At execution if unresolved |
