# Explanation from reviewer 1 for refined bot improvement execution

## 1. Outcome and scope

Improve one supplied AI package against frozen opponents including its starting self, changing only target AI. Owner overrides/checkpoints are optional; effective defaults are pinned before execution. Success delivers the best strictly qualifying accepted source, verified paired-game results and compact history; unchanged accepted source is a legitimate outcome.

## 2. Process overview

Prepare frozen inputs, current runner, version archive and separate measured worker recommendations; evaluate baseline, decide, and analyze all losses. Select ordinary addition or regression repair, replay isolated edits against the appropriate unchanged source, assemble passing edits and repeat evaluation/decision/analysis. Stop at decision ceiling or no passing edit; incidents may suspend instead. The stateless controller prints stage policy and legal transitions, while project tools own persistence and the orchestrator verifies semantic gates.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Target and compatible limits known | Orchestrator resolves contracts/defaults, freezes setup, archives initial source and calibrates both pools | Calibration separate from evaluation/analysis | Matching successful recommendations, setup and source verified | Configuration, identities, schedules, calibration evidence | Evaluate |
| Evaluate | Frozen baseline or assembled candidate | Orchestrator validates/binds source; tools reuse exact evidence or execute missing matches | Measured match pool; four games/sideboarding sequential per match | Every match finalized, reservations settled, evidence/coverage/resources verified | Logs, receipts, paired results | Decide |
| Decide | Complete evaluation | Orchestrator verifies strict paired gate; tools persist decision, archive candidate and update history | Sequential | Baseline establishes accepted reference without consuming decision; candidates accepted only on strict improvement | Commit, outcome/difference, checkpoint/history | Analyze |
| Analyze | Evaluation barrier verified | Delegated analysts own disjoint 250-match slices; orchestrator merges all supported reasons | Whole-slice owners and queued slots; incremental sync outside/inside prescribed locks | All target losses exactly once, source-bound report complete | Findings, coverage, loss report | Deliver at ceiling; otherwise Replay |
| Replay | Analyzed evaluation and remaining resources | Orchestrator chooses mode, filters history, implements immutable isolated variants and replays every associated loss | Measured bounded replay pool; await every reason | Reason has ≥5 losses; edit converts ≥5 and ≥5%, changes intended choice, all cases settled | Rule identities/hashes, controls/takeovers and dispositions | Assemble if any pass; else Deliver |
| Assemble | Passing edits | Orchestrator combines from mode base, resolves overlaps and revalidates materially changed isolated logic | Sequential assembly | Source validated/frozen; repair preserves unedited rules | Candidate binding/history; no proposal | Evaluate |
| Deliver | Ceiling after analysis or no qualifying edit | Orchestrator ranks existing comparable results, exports accepted source, verifies consolidation, then eligible cleanup | No new games | Required decisions/analyses and checked report complete | Export/hash, report and compact retained state | Closed |
| Suspend/resume | Stop incident / explicit authorized continuation | Orchestrator shuts down owned groups, settles/checkpoints; resumes verified prior stage | No new admission while suspended | Shutdown within grace; continuation has authorization and sufficient limits | Stop report, pending coverage, budgets/identities | Suspended / prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Opponents and comparison inputs | Setup package hashes, order, paired schedule and stable IDs | Accepted comparator moves on promotion | Frozen opponents including initial AI; seeds/orders/sides/rules/content and comparison identity | Exact reuse bindings; completed paired intersections, at least one pair per opponent |
| Target source | Initial archived commit | Target AI fixes only | Deck/engine/legality/hidden-information boundaries | Validation and hashes before admission |
| Mode references | Accepted commit plus separately recorded analysis/replay/base | Ordinary uses accepted; valid regression uses candidate for one removal/update, no additions | Promotion always compares accepted; isolated variants exclude earlier fixes | Source-bound reports, immutable hashes and included IDs |
| Gameplay access | Typed lossless logs | Programmatic reconstruction and target-loss projection | Analysts see only allowlisted completed target losses and visible facts | Packet/page hashes, exact IDs, resumed audit |
| Scores | Game W/L/D and ignores | Paired coverage may lose jointly ignored cases | Draws count zero wins; opponents equal weight; no confidence intervals | Independent strict paired improvement check |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/evaluation | 50 decisions; 2500 total four-game matches | Pin owner values; allocate quotient/remainder across frozen opponent order | Baseline excluded from decisions; games planned=(1+effective decisions)×matches×4; recovery=floor(10%) | Analyze final evaluation; deliver at ceiling |
| Wall/storage | 24h; 50 GB with fixed 16 MB control reserve | Explicit effective limits; original start/consumption persist | Downtime included; logical staging/log/evidence/import bytes; locked reservations, fsynced publication | Suspend; no analysis/ranking/export/cleanup |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay branch 5m; shutdown 60s | Pin per-stage/branch values; remaining wall time caps deadlines | Launch-to-exit including replay prefix | Apply incident classification |
| Calibration | Counts 2..logical CPUs; replay two repetitions | No arbitrary fallback | Required independent batches, successful repetitions and saved identities; smallest within 3% fastest median | No qualifying count stops preparation |
| Replay/diagnostics | No rule-replay game quota | Time/storage still apply | All associated losses; separate controls/takeovers/calibration from evaluation; cached games add no execution | Suspend on resource exhaustion |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report, finalize ignored; paired evaluation exclusion | Never retry case | Reason/count and outcome; replay timeout remains denominator, never converts | Safe jobs continue |
| Interrupted evaluation | Settle attempts; recover missing work | Automatic within 10% recovery; then ignore remaining interrupted games | Verified completions and all reservations | Remaining deadlines/resources |
| Calibration count failure | Fresh directory, same inputs | Once; second failure excludes count/repetitions | Both attempts and persisted retry state | Other counts continue; no qualifier stops |
| Unsupported pre-admission format | Preserve validation; adapt build/validation tools only, local checks, fresh validation | No game charge | Failed and fresh validation | Protected boundaries and valid format |
| Integrity/prefix, initialization, sideboarding or other non-timeout failure | Stop; never ignore unsafe state | No generic retry | Errors and checkpoint | Applicable incident authorization; integrity always stops |
| Exhaustion, owner stop, analyst failure | Stop admission and owned work; shutdown/settle/checkpoint | No implicit budget increase | Claims, uncovered losses and resumable detail | Explicit instruction/limit continuation; storage change follows writer-lock transaction protocol |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Shared state | Effective configuration, identities, decisions/accounting, owned-record references | Existing run.json and iteration.json paths | After closure | Consolidate; do not duplicate ledgers |
| Detailed evidence | Typed gameplay, findings, reports, replay traces, immutable variants, frozen packages, receipts/schedules/calibration records | Existing game/analysis/replay paths | All execution/validation/replay/reuse/resume needs end; accepted detail until replacement or closure | Designated pruning tool, owner retention honored; suspension prohibits closure cleanup |
| Versions/history | Initial and every evaluated candidate commit, immutable IDs/trailers/full SHA; English compact attempt lines and superseded replacements | Git and improvement-history.md | Permanent after closure | Temporary variants uncommitted; no permanent source-copy archive |
| Report/export | Baseline/all evaluated results, paired differences/coverage, rule aggregates, accounting/errors, accepted hash/ranking/issues and status | Project/artifacts and accepted export | After closure | Checked consolidation precedes removing eligible detail; summary-only closed evidence cannot seed cache |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Source selection: ordinary trigger versus regression trigger | A valid lower rate can also be unassessable if some comparisons fail, but “valid” qualifies regression | Regression mode requires a fully assessable valid negative paired comparison; otherwise ordinary accepted-source mode | Never repair from a merely partial apparent regression | No |
| A2 | Limits: “reserves through the controller” versus stateless dispatcher | Executable controller implements no reservation state | Shared owning project tools perform reservations; dispatcher supplies stage routing only | Verify accounting externally, never assume advance reserved capacity | No; wording could say shared gate explicitly |
