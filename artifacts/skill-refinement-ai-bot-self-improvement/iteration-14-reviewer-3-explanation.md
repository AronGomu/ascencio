# Explanation from reviewer 3 for AI bot improvement execution

## 1. Outcome and scope

Improve one required target AI package against its frozen starting source and any additional opponents, accepting only strict paired-game improvement. Owner limits and a compatible checkpoint optionally modify a fresh run. Success delivers the accepted source, checked results and compact attempt history; unchanged accepted source is an honest completed outcome when no edit qualifies. Only target AI may change.

## 2. Process overview

Prepare reproducible inputs and separately measured worker pools, evaluate baseline, record its accepted reference and analyze every target loss. Build isolated fixes or regression repairs from the prescribed source, replay all associated cases, combine passing edits, evaluate and decide, then analyze again. Repeat until the persisted decision ceiling or no passing edit; exhaustion instead suspends. The stateless stage controller prints tasks and legal edges while owning project tools persist evidence and the orchestrator verifies gates.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved target and limits | Orchestrator discovers schemas, freezes setup, archives start, validates and calibrates | Calibration separate from evaluation/analysis | Both matching optimal recommendations and verified setup | Configuration, identities, schedules, calibration evidence | Evaluate |
| Evaluate | Valid frozen baseline/candidate | Tools bind accepted control and retrieve matching evidence or execute missing matches | Measured match workers; four games/sideboarding sequential per match | All scheduled matches finalized, reservations settled and coverage verified | Logs, receipts, aggregate paired results | Decide |
| Decide | Complete evaluation | Orchestrator verifies strict paired gate; tools persist decision, candidate commit and history | Sequential | Baseline reference or candidate outcome recorded | Commit, outcome, difference, checkpoint | Analyze |
| Analyze | Full evaluation barrier | Delegated analysts own consecutive whole 250-match slices; orchestrator merges reasons | Slice slots, exactly one owner each; all losses reviewed | Source-bound report complete before ceiling/resource branch | Hash-bound findings, per-match Markdown, loss report | Deliver at ceiling; otherwise Replay |
| Replay | Eligible global reasons and selected source | Orchestrator implements isolated variants; tools run unchanged controls/takeovers | Measured replay workers within resources | Every case settled; each retained edit changes intended choice and wins at least five and 5% of associated losses | Immutable variants, rule IDs, traces, outcomes | Assemble if any pass; otherwise Deliver |
| Assemble | Passing isolated edits | Orchestrator combines from mode base, resolves overlaps, replays materially changed logic, validates | No extra combined-rule gate | Frozen valid candidate and attributed history | Candidate hash, sorted rules, replay references | Evaluate |
| Deliver | Completed required analysis | Rank existing comparable results, export accepted source, check report and consolidate | No fresh games | Verified delivery and lifecycle cleanup | Export/hash, report, persistent history | Closed |
| Suspended | Stop condition | Stop owned work, settle reservations, checkpoint and report | Shutdown grace only | Verified checkpoint plus authorized continuation and sufficient limits | Pending work, coverage, source/budget identities | Verified prior stage or explicit incomplete closure |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Opponents and paired inputs | Frozen setup including starting target | Target trajectories through choices | Opponent sources/order, seeds, starting decks, sides, rules/content and schedule | Source hashes, bindings and integrity receipts |
| Accepted control | Baseline then promoted source | Strictly improved valid candidate only | Independent of HEAD and rejected commits | Paired intersections, every opponent represented, equal weighting; draws zero wins |
| Ordinary source | Accepted source/matching analysis | Add one fix per isolated variant | Unchanged replay control and assembly base | Variant/source hashes |
| Repair source | Valid regressing candidate | Remove/update one existing rule, add none | Unedited rules; comparator remains accepted | Candidate losses and paired new-loss metadata |
| Evidence/access | Typed lossless logs and target-only loss projections | Tool-generated state and findings | No concealed information or adjacent gameplay browsing | Allowlists, hashes, decision IDs and resumed analysis audit |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions | 50 | Pin owner limit | Persisted candidate decisions; baseline excluded | Analyze last evaluation then Deliver |
| Evaluation | 2500 four-game matches | Pin owner total; at least one per opponent | Floor allocation plus remainder by fixed order; planned games = (1 + effective decisions) × matches × 4 | No qualifying edit may end early |
| Recovery | Floor(10% planned games) | Not implicitly increased | Failed/interrupted reservations and recovery consume budget; caches do not | Ignore remaining interrupted games and continue eligible work |
| Wall/storage | 24h / 50 GB decimal | Explicit authorized increase preserves consumption and start | Includes downtime; logical evidence/import/staging bytes; 16 MB control reserve inside cap | Suspend, block admission/data writes; no cleanup/export/ranking |
| Stage timeouts | Evaluation 5h; preparation 10m; validation/replay branch 5m; shutdown 60s | Resolve effective configuration; cap by remaining wall time | Launch to exit including replay prefix | Incident-specific handling |
| Diagnostics | No rule-replay quota | Time/storage still apply | Separate calibration, controls/takeovers and diagnostics from evaluation | Suspend at resource cap |
| Worker pools | Every count 2..logical CPUs | No arbitrary substitute | Separate saved matching recommendations; replay two repetitions and smallest count within 3% fastest successful median | No qualifying count stops preparation |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report, finalize ignored; evaluation excludes both paired sides; replay timeout stays nonconversion denominator | Never retry case | Reason and attempt accounting | Continue safe jobs |
| Interrupted evaluation | Recover missing work under resources/deadlines | Automatic within recovery allowance | Verified completions and all reservations | Missing eligible work only |
| Calibration stage failure | Same inputs, fresh directory | Once per worker-count stage; second failure excludes count/remainder repetitions | Both attempts and retry state | Other counts; stop if none qualify |
| Unsupported format before admission | Adapt only build/validation tools, local checks, fresh validation | No game charge | Failed validation | Valid protected boundaries |
| Integrity/input-prefix, initialization, sideboarding or other non-timeout validation failure | Stop | No generic retry | Unsafe state and evidence | Applicable authorized verified recovery |
| Owner stop or analyst execution failure | Stop admission/owned work; preserve claims and uncovered losses | Explicit instruction | Checkpoint and slice ownership | Same verified checkpoint without duplicate owners |
| Resource exhaustion | Suspend; owned shutdown, settlement and checkpoint | Explicit increase/continuation | All resumable detail | Authorized sufficient limits; storage increase obeys writer-lock transaction sequence |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State | Pinned configuration, bindings, decisions, receipts/accounting | Existing run.json and iteration state | Persistent compact record | Consolidate through owning tools |
| Execution/analysis | Logs, packets, findings, replay traces, variants, frozen packages, schedules and calibration measurements | Existing game/evaluation/analysis paths | All validation, replay, accepted-analysis reuse and resume needs end | Rejected details may prune after summarized analysis/decision; accepted after replacement or closure; owner retention overrides |
| Version/history | Starting and every evaluated candidate commit, parent/outcome/hash; one English line per attempt, SUPERSEDED replacements | Git and improvement-history.md | After closure | No permanent archival source copies; logs/dependencies outside Git |
| Final/suspension report | Version/opponent rates, paired coverage, rules/counts, accounting, errors, ranking, source/export links and state | Project location or artifacts | Persistent checked report | Closure consolidation precedes eligible detail removal; suspension permits no closure cleanup |
| Accepted export | Accepted commit, package and hash | Existing export path | After closure | Summary-only closed evidence cannot support cache reuse |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Autonomy versus Inputs/defaults | “Missing required limits” are not enumerated beyond supplied defaults | Defaults satisfy listed limits; ask only when owning schema requires an unresolved additional value | Avoid needless owner interruption while refusing invented schema requirements | Only if discovery reveals an unresolved required value |
| A2 | Calibration versus incident/resource policy | A failed calibration stage might be a timeout, integrity failure or resource stop | Strong stop rules and never-retry individual cases override calibration’s one retry | Retry only safely retryable failed measurement stages | No |
| A3 | Source selection after unassessable rejection | Ordinary mode requires matching accepted analysis while also analyzing rejection | Finish rejected analysis, then reuse verified retained accepted analysis for next ordinary variants | Rejected report does not replace the accepted-source replay base | No |
