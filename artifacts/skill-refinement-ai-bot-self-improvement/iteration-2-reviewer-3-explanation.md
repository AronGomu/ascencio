# Explanation from reviewer 3 for refined AI bot self-improvement execution

## 1. Outcome and scope

Given a target bot package, optional additional opponents and optional owner limits, I would seek a valid AI with a strictly higher paired-game weighted win rate against the pinned roster, always including the frozen starting AI. Only target AI behavior changes; decks, engine, legality and information boundaries remain intact. Successful completion requires the planned decisions and their analyses, verified ranking, accepted-source export and checked report; exhaustion instead produces a resumable suspension.

## 2. Process overview

I would prepare identities, frozen inputs, budgets and separate concurrency calibrations, then evaluate the baseline. Each evaluation proceeds through evidence verification, decision and complete delegated loss diagnosis before candidate preparation. Isolated reason edits undergo replay validation, surviving edits form one candidate, and evaluation repeats. Regression repair uses the rejected source as its repair base; ties and unassessable rejections return to accepted-source analysis. Completion or no validated edit leads to delivery; limits and incidents use the checkpoint policy.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| 1.1 | Target identified | Orchestrator resolves project commands, archives initial source on main, resumes verified checkpoint or runs frozen-session setup with pinned configuration | One compatible writer | Required identities/limits resolved; at least one match per opponent | run.json, setup, source SHA, roster, schedule and budget origin | 1.2 |
| 1.2 | Setup available | Orchestrator validates evaluator/strategy and runner contract; loads matching or performs separate match/replay calibrations; pins slice plan | Calibration separate from evaluation/analysis; counts 2 through CPU bound | Both recommendations match inputs/environment; valid counts only | Measurements, exclusions, separate replay cache, frozen snapshots, slice assignments | 2.1 |
| 2.1 | Baseline or combined candidate ready | Orchestrator validates exact frozen source and target-only boundary, binds persistent TypeScript runner | No analysis | Exact source valid | Validation evidence and execution bindings | 2.2 if unsupported; otherwise 2.3 |
| 2.2 | Unsupported package format | Orchestrator adapts validation/build tooling, preserves failed evidence, checks locally in new evidence directory | Before game admission | Source boundaries preserved and validation succeeds; otherwise stop | Failed/new validation evidence | 2.3 or failure checkpoint |
| 2.3 | Valid execution inputs | Scripted pool executes/reuses verified paired games across roster | Measured match workers; four games and sideboarding sequential per match | Every match finalized and reservations settled | Typed game/match logs, receipts, timeout reports, reused/executed counts | 2.4 |
| 2.4 | Pool settled | Orchestrator verifies evidence, computes per-opponent/weighted game rates and accepted comparison | No analysts yet | Completed paired intersection per opponent; mismatches unresolved imply unassessable | Results, coverage, ignored counts, difference, resource usage | 3.1 or 3.2 |
| 3.1 | Initial baseline | Orchestrator records accepted reference | Serial | Baseline recorded without candidate decision count | Accepted identity | 3.3 |
| 3.2 | Candidate evaluation finalized | Orchestrator applies strict promotion rule; scripts journal, commit and record every evaluated candidate, including rejected ones | Serial recoverable commit | Valid strict gain accepts; tie/regression/unassessable retains incumbent | iteration.json, SHA, checkpoint, compact history | 3.3 |
| 3.3 | Decision persisted, including last | Orchestrator admits loss diagnosis | Only after evaluation | Analysis remains required after final decision | Next-stage checkpoint | 4.1 |
| 4.1 | Settled evaluation | Orchestrator syncs/claims whole slices; analysts diagnose allowlisted completed target losses only; orchestrator validates coverage and merges report | One owner per consecutive 250-match slice, queued for capacity; no evaluation overlap | Exactly-once loss coverage, all slices complete; all globally supported reasons with at least five distinct losses ranked | Bound per-match findings and evaluation loss-analysis.md with all replay points | 5 if stop condition; otherwise 4.2 |
| 4.2 | Analysis complete | Orchestrator records accepted start separately; chooses accepted-source additions or lower-rate rejected-source repair removing/updating one rule per variant | Serial choice | Correct source/control/base selected; initial baseline has no removals | Mode and source identities | 4.3 |
| 4.3 | Mode selected | Orchestrator reads history, excludes unchanged failures, creates isolated immutable variants | Independent variant preparation possible; no delegated implementation | Material retry explained; IDs and operations attributed | Hash storage, stable rule IDs, sorted rule sets and source identities | 4.4 |
| 4.4 | Eligible reasons/variants available | Scripts run control/takeover from every associated recorded critical choice against unchanged analysis source | Independent replay cases, within replay recommendation | All cases settled; changed intended choice yields wins in at least five cases and 5% of associated losses | Control/takeover outcomes, unchanged/failed choices and timeout counts | 4.5 |
| 4.5 | Replay jobs admitted/pending | Orchestrator queues remaining reasons and checks wall/storage before admission | Measured replay concurrency; await every reason | Below either threshold excluded; no replay count quota | Reason summaries and review evidence | 4.6 |
| 4.6 | All reason gates decided | Orchestrator combines validated edits, resolves overlap, preserves unedited repair-source rules | Serial assembly | No extra combined replay gate; no validated edit retains accepted source | Combined source/hash and rule attribution | 4.7 or 5 |
| 4.7 | Combined candidate exists | Orchestrator validates/freezes and scripts history update with rule/hash/base/replay references; eligible pruning only | Serial | Candidate valid, required evidence retained; no proposal.md | Frozen candidate, updated history, checkpoint | 2.1 |
| 5 | Planned work complete, no validated candidate, or explicit closure | Orchestrator verifies decisions/analyses, ranks existing comparable results, exports accepted source and checks report | No fresh ranking games | Consolidation verified before eligible cleanup; resource exhaustion suspends instead | Final report/export or suspension checkpoint/report | Closed or authorized resume |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| I1 Target and opponents | Required package plus optional roster and starting self-opponent | Target AI only | Frozen starting self-opponent, roster/order, decks and boundaries | Source hashes and target edit boundary |
| I2 Accepted/candidate lineage | Existing exact-source initial commit | Strictly improved valid candidate becomes accepted; rejected commits still archived | Iteration starting accepted commit independent of HEAD; unique version/run IDs | Full SHA, trailers, parent and journal; git show extraction |
| I3 Replay/assembly source | Accepted source ordinarily; regressing source in repair | Isolated add versus remove/update operations according to mode | Control unchanged; repair comparator remains accepted; no earlier variant fixes in controls | Recorded source versions/hashes and rule attribution |
| I4 Pairing and scoring | Stable match/game IDs, seeds, orders, sides, rules/content | AI choices/sideboarding trajectories | Determinism across scheduling; equal opponent weights; draws zero wins in denominator | Evidence identity checks; intersection excludes either-side timeouts; report coverage |
| I5 Runtime and caches | session-typescript/v1 and pinned runtime/engine/content | Workers may change without inputs/budgets; legacy only if explicitly pinned | Cache identity/integrity; match/replay recommendations separate | Calibration provenance, receipts, workload/environment matching |
| I6 Analyst ownership/access | Frozen slice plan and packet hashes | Resume uncovered work, reassign only after terminated release | Diagnosis only; allowlisted target losses; unknowns preserved; no wins/opponent-only timelines | Slice tokens, exact decision IDs, hashes, exactly-once coverage |
| I7 Storage/checkpoints | Shared Node/Rust gate and atomic run state | Authorized continuation under locks | Original setup, consumed budgets, startedAt and owned records | fsync/atomic publication, match index last, prior skipped snapshots retained |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| L1 Decisions | 50 candidate decisions | Owner-pinned limits | Baseline excluded; analyses/ranking/export still required | Finish required analysis/delivery unless resource suspended |
| L2 Evaluation size | 2,500 total matches, four games each | Owner override before launch; roster requires one each | Floor allocation plus roster-order remainder | Invalid allocation requires resolution before launch |
| L3 Evaluation game budget | 510,000 planned + 51,000 recovery = 561,000 | Pin effective formula; authorized recovery via full controller limits transition | Reserve before launch; failed/interrupted/recovery executions count; verified cache zero; planned/recovery separate | Recovery exhausted: ignore remaining interrupted games, continue eligible work without extra budget request |
| L4 Wall time | 24 hours from persisted startedAt | Explicit increase; legacy anchor known consumed time once | Includes suspension; all stage caps bounded by remaining time | Suspend, no analysis/rank/export/cleanup |
| L5 Storage | 50,000,000,000 logical bytes; explicit stop.maxBytes | Explicit increase, active transaction request persisted and gate updated under writer lock | Includes staging/imports; reserve 16,000,000 control bytes before dispatch | Marker and blocked data writes; preserve needed evidence |
| L6 Stage duration | Evaluation five hours; preparation ten minutes; each validation and individual control/takeover five minutes | Owner limits; automatic five-hour transition for lower-pinned existing evaluation allowance | Launch-to-exit, replay prefix included; calibration separately counted | Apply incident policy |
| L7 Replay/calibration | No rule-replay game quota; separate diagnostic accounting | Calibration stage one retry, never reset on resume | Control/takeover counted separately; replay two repetitions, full largest-stage batch; smallest count within 3% fastest median | Stop if no qualifying count or global limit; ordinary replay no automatic retries |
| L8 Stop grace | 60 seconds | No override specified | Owned work only; admission halts immediately | Terminate owned process group, settle/cancel reservations, verify shutdown |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| C1 Individual game/replay timeout | Bug report, ignored status, continue safe jobs | None | Reason/count, prefix and outcome; timeout never conversion | Other work continues; paired exclusions or replay denominator applied |
| C2 Interrupted evaluation | Reuse verified completion, recover missing work | Within pinned 10% recovery allowance and stage/global caps | Every attempt, reservations and pending work | Automatic execution recovery; exhaustion follows L3 |
| C3 Calibration worker failure | Fresh evidence directory with identical inputs | One retry per count/stage; second excludes count and remaining repetitions | Both attempts, exclusions/measurements persisted | Other counts continue; all failed stops |
| C4 Other failure | Stop for initialization, sideboarding, integrity, validation or other non-timeout failure | No automatic replay recovery; unsupported format uses 2.2 | Command errors, unsafe-state evidence and checkpoint | Cause resolved with valid boundaries and applicable continuation |
| C5 Time/storage exhaustion | Halt admission and owned work, checkpoint/report | No implicit increase | Complete resumable detail, pending coverage, budgets | Explicit increase/continuation; no closure work meanwhile |
| C6 Owner pause/cancel | Halt admission, stop/settle owned work | No automatic resume | Same verified checkpoint and source identities | Explicit instruction |
| C7 Active storage continuation | Persist full request; update gate under writer lock, commit controller continuation when session lock releases | Authorized increase only | Request, transition and original budgets | Locks release and continuation committed |
| C8 Identity/checkpoint ambiguity | Ask about ambiguous bot, multiple checkpoints or missing required limits | None until resolved | Existing evidence untouched | Identity/limits resolved; incompatible constraints stop |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| D1 Durable source history | Initial/evaluated version commits, full identities/outcomes, English compact attempt history; superseded statuses | Git main and bot-local improvement-history.md | Durable | No routine deletion; push/publish/merge separately authorized |
| D2 Shared control | run.json, iteration-N/iteration.json, setup/config and owned-record references | Run directory | Compact state remains after closure | Consolidate without copying receipts/records |
| D3 Detailed execution evidence | Frozen sources, schedules, typed logs, receipts, checkpoints, variant/replay evidence, loss reports with exact points | Run directory and temporary hashed storage | Validation, accepted-analysis reuse, resume and owner retention satisfied | Rejected detail may prune after summarized decision/analysis; closure removes details only after checked consolidation |
| D4 Run report | Identities/config links, timings/status, per-version W/L/D and paired decisions, reason/replay aggregates, coverage/unclear counts, resource totals/errors, ranking and unresolved issues | Project report location or artifacts/ | Durable | Detailed IDs/evidence replaced with compact aggregates at closure; no policy copies/overrides section |
| D5 Accepted export | Final accepted commit, package export path/hash and changes | Recorded export destination | Durable | Export on finalization; exhaustion produces no export |
| D6 Calibration records | Separate matching recommendations, attempts, exclusions and report identities | Match settings and .cache/replay-workers.json | Reusable while compatible | Stale identities require recalibration; never borrow fictional example settings |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Calibration policy: counts 2 through logical CPU bound | No stage exists on a one-CPU environment | No qualifying recommendation can be established under the stated rule | Stop preparation rather than invent one-worker calibration | Yes if environment has fewer than two logical CPUs |
| A2 | Calibration policy: match required repetitions | Match repetition count not stated in package; linked runner implementation is outside this exercise | Obtain operational repetition requirements from required runner contract/calibrator during actual execution, without guessing here | Preparation remains gated on complete successful required measurements | Only if required contract/tool does not resolve it |
| A3 | Workflow 3.2 versus evidence unassessable | Non-timeout integrity failure stops, while unresolved evidence can yield unassessable rejection | Fatal integrity failures take incident precedence; otherwise finalized but incomparable evidence is unassessable | Do not continue analysis/candidates through a known integrity failure | No; conservative reconciliation |
| A4 | Stop conditions versus workflow 5 completion | No validated candidate permits stopping before 50 decisions, despite completion requirement wording | Fifty is decision ceiling; explicit no-candidate stop is a legitimate terminal outcome reported honestly | Verify/export accepted result without claiming all 50 decisions executed | No; explicit workflow branch governs |
| A5 | Owner retention versus closure deletion | Closure lists detailed reports for removal but also honors retention requests | Explicit owner retention overrides routine cleanup scope | Retain requested evidence and account its bytes | No |
