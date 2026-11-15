# Explanation from reviewer A for bot skill comprehension

## 1. Outcome and scope

Given a target `ai-bot`, optional opponents, owner limits and compatible checkpoint, I would seek improved paired-game performance and deliver the accepted source, verified results and history. Only target AI changes; decks, legality, engine and information boundaries remain protected. Successful completion includes required analyses and checked delivery, even when no edit qualifies. Suspended or explicitly closed incomplete work remains incomplete. This is prospective review only; no workflow was run.

## 2. Process overview

A stateless controller presents one stage at a time; project tools persist execution and checkpoints while I verify semantic gates. Prepare precedes baseline Evaluate → Decide → Analyze. Eligible hypotheses pass isolated Replay, then Assemble returns to Evaluate. Analyze at the decision ceiling, or Replay without qualifying edits, leads to Deliver → Closed. Any active stage can suspend. I implement edits and delegate only loss diagnosis; no proposal generator participates.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Inputs resolved | Orchestrator reads contracts/defaults, freezes setup, archives start, validates; tools calibrate both pools | Calibration separate from evaluation/analysis | Exact sources, current runner, both matching recommendations | Configuration, commits, measurements, slice plan | Evaluate |
| Evaluate | Frozen baseline or changed candidate | Tools bind source/control/schedule, reuse verified evidence or execute missing work | Measured match pool; four games/sideboarding sequential | All scheduled matches finalized, reservations settled, evidence/resources verified | Logs, receipts, results, paired coverage/difference | Decide |
| Decide | Verified evaluation | Orchestrator checks strict improvement; tools persist decision, candidate commit/history | Sequential | Baseline accepted without decision charge; candidates accepted/rejected with reason | Checkpoint, immutable version SHA | Analyze |
| Analyze | Full evaluation barrier | Slice analysts review every completed target loss; orchestrator merges reasons/report | Whole consecutive 250-match slices; queue runtime slots | Exactly-once coverage; final report complete, including last decision | Findings, coverage, source-bound report | Ceiling: Deliver; otherwise Replay |
| Replay | Eligible merged reasons | Orchestrator creates isolated variants; tools replay all associated losses against unchanged source | Separate measured replay pool, resource bounded | All settle; each retained edit changes intended choice and converts ≥5 and ≥5% | Hashes, rule IDs, traces, failed/unchanged outcomes | Passing: Assemble; none: Deliver |
| Assemble | Passing isolated edits | Combine from correct mode base; revalidate materially altered isolated logic | Sequential assembly | Semantics/attribution preserved; candidate validated/frozen | History with rules/hash/base/replays; no proposal.md | Evaluate |
| Deliver | Normal completion gate | Verify analyses/decisions, rank existing comparable results, export and check report, eligible cleanup | No fresh games | Checked consolidation and truthful status | Accepted export/hash, report/history | Closed |
| Suspended | Stop overrides progression | Shut down owned work, settle, checkpoint/report | Grace bounded | Verified checkpoint, authorization and remaining/increased limits | Pending coverage, budgets, next stage | Verified prior stage or explicit incomplete closure |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Experiment | Frozen setup | Authorized limits with ledger continuity | Opponent roster/order, starting self-opponent, paired seeds/orders/sides, engine/content/runner/comparison | Hashes, schedule, receipts |
| Accepted | Starting commit | Strict valid paired improvement | Independent of HEAD/rejected commits | Retrieve committed package; verify bindings |
| Ordinary mode | Accepted source/report | Add one fix per isolated variant | Replay control and assembly base accepted | Source hashes |
| Repair mode | Valid regressing candidate/report | Remove/update one rule; add none | Unedited candidate rules; accepted comparator | Separate accepted/replay/base records |
| Evidence | Completed typed .log | Programmatic projection/reconstruction | Exact IDs, hidden-information boundary | Allowlisted target-loss views, hashes/pages/counts |
| Scoring | Games per opponent | Completed paired intersection | Equal opponent weighting; draws zero wins; either ignore excludes both | Every opponent has pair; unresolved integrity/comparability unassessable; no confidence intervals |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/matches | 50; 2,500 four-game matches | Pin effective owner values | Baseline free; floor allocation plus ordered remainder; ≥1/opponent | Analyze last decision, then deliver |
| Evaluation games | 510,000 planned +51,000 recovery at defaults | Formula from effective decisions/matches | Reservations/failed/interrupted attempts count; caches zero; recovery separate | Ignore remaining interrupted games, continue eligible work |
| Time/storage | 24h; 50GB explicit | Authorized continuation, full effective limits | Original start includes suspension; logical staging/import/evidence bytes; protected 16MB control reserve | Suspend; no ranking/export/analysis/closure cleanup |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay branch 5m; shutdown 60s | Effective pinned timeout, remaining-wall cap | Launch-to-exit including replay prefix | Incident-specific stop/ignore |
| Calibration/replay | All worker counts 2…CPUs; replay two repetitions | Matching measured recommendations only | Diagnostics separate; replay all losses without game quota; time/storage charged | No qualifier stops Prepare |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report, ignored case; safe jobs continue | None | Timeout/outcome; replay denominator retained | Continue other jobs |
| Evaluation interruption | Recover missing verified work | Remaining 10% allowance | Every attempt/reservation/prefix | Same identities and resources |
| Calibration stage failure | Fresh directory, same inputs | Once; second excludes count/repetitions | Both attempts and exclusions | Other counts may qualify |
| Unsupported package pre-admission | Adapt build/validation tooling only; local related checks | Fresh validation, no game charge | Failed evidence | Valid protected package, otherwise stop |
| Integrity/prefix, initialization, sideboarding, other validation failure | Stop; never unsafe ignored outcome | No generic replay retry | Verified checkpoint/errors | Applicable explicit authorization and integrity |
| Resource or owner/analyst stop | Stop admissions/work; grace then owned groups only; settle/checkpoint | No implicit limit increase | Claims, uncovered losses, budgets | Explicit same-checkpoint continuation where required |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State | Identities/configuration, accounting, decisions, receipts | run.json; iteration-N/iteration.json | Beyond closure compactly | Consolidate existing records |
| Detailed evidence | Typed logs, indexes, projections, reports, replay traces, variants, schedules/bundles | Existing run paths | Execution/validation/reuse/resume needs end; accepted until replacement/closure | Designated pruning; no resource-suspension cleanup |
| Versions/history | Initial and every evaluated candidate, exact trailers/SHA/hash; English compact attempts, SUPERSEDED replacements | Git main; improvement-history.md | Permanent | Never archive unevaluated variants in Git |
| Delivery report/export | Per-version W/L/D/rates/differences/coverage, all rule dispositions/counts, budgets/errors, accepted export/hash, status/ranking/issues | Project report or artifacts/ | After closure | Checked consolidation before eligible deletion; no game IDs/decision details in closure aggregate |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Runner contract link | Linked document has no named minimum-interface anchor and contains broader historical policy | Candidate policy governs; inspect owning CLI/schema before actual dispatch | Do not silently import conflicting legacy allowances | Only if required runtime interface remains unresolved |
| A2 | Controller command example | Example points at canonical skill directory, while reviewed package has its own controller | Review candidate semantics; deployment must bind intended controller/package | Avoid executing a different installed policy accidentally | Resolve package selection before execution |
