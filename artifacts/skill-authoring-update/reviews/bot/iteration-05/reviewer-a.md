# Explanation from reviewer A for prospective bot improvement execution

## 1. Outcome and scope

Given a target `ai-bot`, optional opponents, owner limits and a compatible checkpoint, I would seek strictly better paired-game performance, deliver the accepted source and verified history, and report unchanged outcomes honestly. Only target AI may change; decks, engine, legality and information boundaries remain protected. This explanation describes execution without running it. Default model/thinking are `gpt-6.1-sol`/low, subject to explicit settings and available controls.

## 2. Process overview

The orchestrator follows the stateless controller one task at a time; owning tools persist state before controller advancement. Prepare leads through Evaluate, Decide and mandatory Analyze. Replay and Assemble loop into another evaluation; decision ceiling or no qualifying edit leads to Deliver. Stops override every edge. Only loss diagnosis is delegated; implementation remains with the orchestrator.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | New compatible run | Orchestrator reads contracts/defaults, resolves inputs, freezes setup, archives starting source, calibrates both pools | Calibration isolated | Valid setup, matching recommendations; CPUs support qualifying counts | Configuration, identities, slice schedule | Evaluate |
| Evaluate | Ready baseline/assembled source | Validate/freeze; bind control/schedule; reuse verified results or dispatch missing matches | Measured match workers; four games/sideboarding sequential | Every match finalized; reservations settled; paired coverage verified | Logs, receipts, aggregate/difference | Decide |
| Decide | Completed evaluation | Baseline establishes reference; otherwise independently verify promotion, persist outcome, commit candidate and history | Sequential | Strict valid improvement accepts; otherwise retain reference | Decision/checkpoint, immutable version | Analyze |
| Analyze | Every decision, including final | Analysts review all allowlisted completed losses in fixed 250-match slices; orchestrator reconciles report | One owner per slice; queued slots; no evaluation overlap | Exactly-once audited coverage, source-bound final report | Findings, report, supported reasons | Ceiling: Deliver; otherwise Replay |
| Replay | Analysis complete, resources remain | Read history; implement isolated additions or regression removals/updates; replay every associated loss | Measured replay pool | All cases settle; retain conversions ≥5 and ≥5% with changed intended choice | Immutable variants, traces, rule outcomes | Passing: Assemble; none: Deliver |
| Assemble | Passing edits | Combine from mode base, preserve attribution; revalidate materially changed isolated logic | Sequential assembly | Frozen valid combined candidate; no combined replay gate | Hash/history with rules/base/references | Evaluate |
| Deliver | Ceiling or no edit | Verify analyses/decisions, rank existing comparable results, export accepted source, check consolidation | No new matches | Report checked before eligible cleanup | Export/hash, report, history | Closed |
| Suspend/resume | Any stop | Halt owned work, settle and checkpoint; resume verified prior stage only with authorization | Shutdown grace bounded | Limits permit authorized continuation | Pending coverage, budgets, next stage | Suspended/prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Opponents/control | Starting AI plus optional opponents; accepted reference | Accepted moves after promotion | Frozen opponents, separate self/control bindings | Source commits/hashes |
| Comparison | Pinned ordered schedule | Trajectories/sideboarding choices | Starting orders, seeds, sides, rules/content; stable-ID randomness | Paired intersections; every opponent represented |
| Scoring | Completed nonignored games | Ignore finalized incidents symmetrically | Draws denominator, zero wins; equal opponent weights | Rates/differences/coverage; no confidence intervals |
| Analysis/base | Accepted ordinarily; regressing candidate for repair | One isolated fix per variant | Unchanged replay control; repair preserves unedited rules | Source binding, hashes, sorted rule IDs |
| Archives | Starting commit on main or exact reuse | Evaluated versions committed, including rejected | Unique immutable run/version IDs; accepted independent of HEAD | Required subject/trailers, full SHA/path/hash; journal reuse |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/matches | 50; 2500 total | Pin effective owner values | Decisions exclude baseline; allocate quotient/remainder by opponent, minimum one | Analyze final evaluation, then deliver |
| Evaluation games | 510000 planned; 51000 recovery at defaults | Derived from effective decisions/matches | Attempts consume allowances; caches none; diagnostics separate | Ignore remaining interrupted games after recovery allowance |
| Time/storage | 24h; 50GB | Authorized explicit continuation | Original start includes downtime; logical staging/import scope; 16MB protected control reserve | Suspend; block data writes |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay 5m; shutdown 60s | Resolved effective stage limits | Launch-to-exit, prefix included, capped by wall remainder | Incident handling |
| Calibration/replays | CPUs 2 through logical maximum; replay two repetitions | Matching measured recommendations mandatory | Replay optimum: smallest within 3% fastest successful median; no replay game quota | No qualifying worker count stops preparation |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report, ignored outcome; safe jobs continue | Never that case | Reasons/counts; replay timeout denominator | Finalized incident |
| Interrupted evaluation | Recover verified missing work | Remaining 10% allowance | Reservations/attempts/completions | Deadlines/resources permit |
| Calibration failure | Fresh directory, same inputs | Once per failed worker-count stage; then exclude | Both attempts and exclusions | Other successful counts qualify |
| Unsupported package | Adapt build/validation tooling only | Fresh validation; no game charge | Failed validation/local checks | Protected boundaries hold |
| Integrity, initialization, sideboarding/other failure | Stop, never unsafe ignore | No generic retry | Source/prefix/error evidence | Incident-authorized verified checkpoint |
| Owner stop, analyst failure, resource exhaustion | Stop admission; terminate only owned groups after grace; settle | Explicit continuation | Claims, uncovered work, pending jobs, budgets | Applicable authorization and sufficient limits; closure stays incomplete |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Shared state | Configuration, decisions, receipts, accounting | `run.json`, `iterations/iteration-N/iteration.json` | Durable compact record | Consolidate via owning tools |
| Temporary evidence | Typed lossless logs, findings, replay traces, hashes, snapshots, measurements | Existing game/analysis/evaluation paths | All validation/reuse/resume needs end; accepted until replacement/closure | Eligible designated pruning; never suspension cleanup |
| History/export | English attempt lines, SUPERSEDED replacements, versions/export hash | Git and `improvement-history.md` | After closure | No permanent archival source copies |
| Report | Identities, W/L/D/rates, paired decisions, rules/coverage, budgets/errors, ranking/export | Project or artifacts | After closure | Checked consolidation before cleanup; closed summaries cannot seed cache reuse |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Defaults versus Autonomy | Defaults supplied, yet missing required limits trigger questions | Use resolvable documented defaults; ask only when a required effective binding cannot resolve | Routine execution avoids redundant approval | Only unresolved binding |
| A2 | Replay gate | “Primary critical decision” alongside secondary hypotheses | One recorded critical decision per game/reason from first-pass contract | Replay secondary supported groups without discarding them | No |
| A3 | Linked runner contract | Broader reference mentions legacy execution | Candidate's explicit current-runtime-only constraint governs | Incompatible checkpoints require fresh runs | No |
