# Explanation from orchestrator for refinement iteration 3

## 1. Outcome and scope

Given one target bot package, optional extra opponents and owner limit overrides, seek a higher paired-game win rate while changing only target AI. The input to this refinement iteration is the current 40,620-character sibling package, identified in `iteration-3-start.json`; the original package remains protected by `source-manifest.json`. Normal delivery verifies completed decisions and analyses, ranks existing comparable versions and exports accepted source; no validated edit permits early delivery, whereas resource exhaustion remains incomplete suspension.

## 2. Process overview

Prepare frozen inputs and separate calibrations, evaluate starting baseline, then loop Evaluate → Decide → Analyze → isolated replay → combined candidate. Ordinary work uses accepted source and its analysis; a measured regression instead repairs the regressing source. Decide before loss analysis, including after the final decision; suspend rather than finalize when resources expire.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| 1.1 | Bots resolved | Orchestrator finds compatible checkpoint or frozen-session setup; use main and existing project interfaces | Single matching writer | Sources/configuration and runner contract resolved | Setup, starting commit, bindings | 1.2 |
| 1.2 | Setup exists | Validate setup; load/calibrate separate match and replay recommendations; pin slice plan | Calibration count stages; no overlap with evaluation/analysis | Both recommendations match pinned environment/runtime/workload | Measurements, exclusions, settings | 2.1 |
| 2.1 | Baseline or changed combined candidate | Validate exact frozen source and target-only boundary | Before dispatch | Exact source valid | Source identity, validation evidence | 2.2 or 2.3 |
| 2.2 | Unsupported package format | Adapt build/validation tooling, preserve failure, run related checks and validate in fresh directory | No game admission | Valid without violating boundaries; otherwise stop | New validation evidence | 2.3 |
| 2.3 | Valid source | Orchestrator runs match pool, reuses compatible evidence, settles every reservation | Measured match workers; games/sideboarding sequential within match | Every scheduled match finalized | Receipts, logs, ignored reports | 2.4 |
| 2.4 | Settled evaluation | Verify evidence, score under invariant matrix and save comparator difference | No analysts yet | Valid paired intersection or explicitly unassessable | Results, coverage, usage | 3.1/3.2 |
| 3.1 | First baseline | Record accepted starting reference | Single writer | No candidate decision counted | Baseline reference | 3.3 |
| 3.2 | Evaluated candidate | Apply strict promotion rule; journal decision and archive source even if rejected | Recoverable transaction | Accepted reference independent of rejected commit/HEAD | Decision, history, full SHA | 3.3 |
| 3.3 | Decision saved | Continue required loss analysis, including final decision | — | Analysis not skipped | Next-stage checkpoint | 4.1 |
| 4.1 | Evaluation settled and decided | Orchestrator dispatches diagnosis only; reconcile all reports into one evaluation analysis | One owner per consecutive 250-match slice; queue whole slices for slots | Exactly-once completed target-loss coverage; global eligible reasons | Per-match findings, loss-analysis.md | Stop check, then 4.2 |
| 4.2 | More work eligible | Select accepted source for ordinary additions; regressing source for isolated removal/update repairs | — | Accepted comparator and analysis/replay/assembly source distinguished | Source bindings, mode | 4.3 |
| 4.3 | Mode/source selected | Read history; exclude unchanged failed attempts; implement immutable isolated variants | Orchestrator only | Material explanation for retries; stable IDs and hashes | Variants, rule mapping | 4.4 |
| 4.4 | Eligible reason and exact decision points | Replay every associated loss against unchanged analysis control; no earlier edits | Separate measured replay setting | All cases settle; ≥5 AND ≥5% convert with intended choice change; unchanged/nonwins do not convert | All outcomes, replay summaries | 4.5 |
| 4.5 | Jobs pending | Queue within resources; check time/storage before admission | Resource-bounded replay workers | Every reason job settles or stop policy activates | Threshold decisions | 4.6 |
| 4.6 | Replay review complete | Combine all passing edits from mode's source; resolve overlaps and retain attribution | Wait for all jobs | No extra combined replay gate; no passing edit ends candidate loop | Combined source/hash | 4.7 or 5 |
| 4.7 | Combined candidate | Validate/freeze, update history with rules/hash/accepted base/replays, prune eligible detail | Orchestrator | Frozen source and evidence remain usable | Candidate binding/history | 2.1 |
| 5 | Normal completion/early no-candidate or explicit closure | Verify evidence, rank existing comparable results, export accepted source and report | No fresh ranking games | Checked summaries; suspension restrictions honored | Final deliverables below | Done |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Bot boundaries | Starting target and frozen roster | Target AI only; pre-admission compatibility tooling under checks | Decks, engine, legality, hidden-information rules; starting self-opponent | Exact-source validation and target-only boundary |
| Accepted/control/repair source | Starting source commit | Strict improvement advances accepted; repair replays/assembles from regressing source | Existing commit identity, not HEAD | Separate SHA/path/hash bindings |
| Archive | Exact starting commit; candidates after decision | New immutable evaluated versions with prescribed subject/trailers | No commits for unevaluated variants; preserve unrelated work/history | Existing version search, recoverable commit journal |
| Pairing | Frozen roster order/schedule, seeds, deck orders, sides, rules/content | AI choices and sideboarding trajectories | Stable match/game-derived randomness and runner identity | Compatible receipts, inputs/settings/implementation/integrity |
| Scoring | Game wins / completed non-ignored games; draws zero wins in denominator | Completed paired intersection | Equal opponent weights; strict valid improvement; no confidence intervals | Report ignored counts/coverage; every opponent needs pairs; unresolved/mismatched evidence unassessable |
| Analysis | Machine-filtered completed target losses | Matching cached findings reused; equivalent reasons merged | Analysts see allowlisted target-loss views only, never wins/draws/ignored/full logs | Packet hashes, exact IDs, complete coverage |
| Eligibility | ≥5 distinct losses globally, count once per reason | Reasons may overlap; singleton slice findings retained | No small groups in replay jobs; unclear attribution reported | Ranked count then severity, exact replay points |
| Replay gate | Unchanged analysis source and isolated variant | Intended choice change plus takeover win counts conversion | All associated losses in denominator; timeout never converts | Five-win AND 5% gate; every case settled |
| Interfaces | campaign/round/incumbent; existing runner/commands/keys/paths | Matching settings recalibrated | No silent runner migration or fabricated worker recommendation | Pinned contract/runtime/workload identities |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Candidate decisions | 50 | Owner values pinned before launch | Baseline excluded; final analysis still required | Finish eligible normal finalization |
| Evaluation | 2,500 total four-game matches | Owner configuration; at least one per opponent | Stable floor/remainder roster allocation | Finalize scheduled evidence |
| Evaluation games | 510,000 planned + 51,000 recovery | Formula from effective iterations/matches; recovery floor 10% | Reserve attempts atomically; failures/interruption count, cache adds none; separate recovery | Ignore interrupted games beyond recovery and continue eligible work |
| Wall time | 24 h from persisted startedAt | Explicit increase; never reset on resume | Includes downtime; legacy anchor from known consumption | Suspend/checkpoint |
| Storage | 50 GB logical bytes; 16 MB control reserve inside cap | Explicit increase via gate/writer-lock/controller transaction | Includes staging/imports/active evidence; data uses remainder | Persist suspension marker; block data writes |
| Timeouts | Evaluation 5 h; preparation 10 min; check/replay branch 5 min | Existing lower evaluation pins transition automatically | Launch-to-exit; replay includes prefix; capped by remaining wall | Incident policy below |
| Calibration | All counts 2..logical CPU; replay two repetitions | Matching saved settings or recalibration | Diagnostic games/control/takeover separate; time/storage still apply | Stop if no successful eligible count |
| Rule replay | No game-count quota | All associated losses required | Separate control/takeover counts | Time/storage still suspend |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual game/replay timeout | Bug report, ignored case; continue safe jobs | None | Outcome/reason; replay denominator unchanged | Case is settled, not retried |
| Interrupted evaluation | Stop/settle owned work, verify missing prefix | Within 10% recovery only | Completed evidence, every reservation/attempt | Automatic within time/storage/timeout caps |
| Failed calibration count | Retry fresh directory with same inputs | One; then exclude count and remaining repetitions | Measurements, both failures, exclusions across resume | Other counts continue; none qualify stops |
| Non-timeout initialization/sideboard/integrity/validation failure | Stop; compatibility exception only at 2.2 | No general retry | Error and usable evidence | Appropriate explicit resolution; never mark ignored |
| Owner stop / analyst failure | Halt dispatch, preserve ownership and uncovered work | No duplicate analysts | Reports, claims, pending jobs | Explicit continuation per slice reference |
| Resource exhaustion / cancellation | Stop admission, graceful shutdown ≤60 s then owned group termination; settle and verify | No resource reset | Atomic fsynced checkpoint; indexes published last, prior skipped snapshots retained | Same checkpoint; owner pause/cancel explicit, exhausted time/storage explicit increase |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Active state/configuration | Bindings, source identities, limits, decisions, pending stage and accounting | run.json; iterations/iteration-N/iteration.json; project run paths | Summarized closure | Consolidate into existing state and one checked report |
| Gameplay/receipts | Typed lossless actor A/B game logs; match index of four games; exact IDs | games/game-N/ and owned receipt locations | Replay/validation, accepted-analysis reuse or resume | Eligible rejection/replacement or closure; honor retention requests |
| Analyses/replays | Existing English Markdown formats, packet bindings, coverage, exact primary decisions, all replay outcomes | analyses/, baseline/iteration loss-analysis.md and temporary traces | All eligible jobs processed plus reuse/resume needs | Detailed IDs removed after summary consolidation |
| Version archive/history | Full source SHA/path/outcome; compact English attempt line; SUPERSEDED replacements | Git; bot-local improvement-history.md | Permanent | No archival source copies, logs/bundles/dependencies in Git |
| Final report/export | Provenance/configuration/times/status; version W/L/D/rates/differences/outcomes; rule counts/dispositions; coverage/unclear and resource/error totals; accepted SHA/export path/hash/ranking/issues | Project report location or artifacts/; accepted export | Retained run evidence | No fresh ranking games; remove detailed schedules/logs/receipts/analyses/traces/variants/frozen copies/bundles only after checked closure |
| Suspension report | State, stage, results, decisions, budgets, checkpoint, next action and needed increases | Project report location | Resumable work ends | No ranking/export/closure cleanup while resource-suspended |

Gameplay JSON/XML/replay JSONL is not generated; typed source records are reconstructed in memory, with legacy adapters readable only. Report References link shared policy and authoritative effective configuration. Summary-only closed runs cannot supply verified cache/replay inputs.

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Execution/calibration links | Exact request schemas, match repetitions/selection and validation commands external | Read project contracts during execution | No invented implementation | Only if contract cannot resolve |
| A2 | Calibration policy | CPU bound below two has empty range | No qualifying count | Stop rather than invent fallback | Environment-specific |
| A3 | Diagnostic accounting | No separate numerical calibration game ceiling | Separate counters; shared wall/storage; consult admission contract | No evaluation-game relabeling or budget reset | If contract ambiguous |
| A4 | Limits vs no validated candidate | Planned completion versus early terminal path | Report actual early stop; never claim all decisions completed | Exhaustion remains incomplete | No |
| A5 | Combined candidate | Overlap resolution versus isolated validation | Preserve validated semantics and attribution; materially different rule needs its isolated gate | No new combined replay requirement | Only for irreconcilable edits |

The exact output formats, thresholds, ownership and recovery distinctions remain essential. The incoming draft now centralizes slice ownership/access/coverage in its mandatory reference. This iteration targets repeated constraints, execution metadata and prose within the main file; external dependencies remain unchanged and relocation is not counted as reduction.
