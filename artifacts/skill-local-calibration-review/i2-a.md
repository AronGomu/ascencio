# Explanation from review_i2a for local calibration skill comprehension

## 1. Outcome and scope

Improve one required `ai-bot` against frozen opponents (always its starting self, optionally supplied opponents), retaining accepted source unless a valid candidate strictly improves equally weighted paired game win rate. Resolve owner limits/checkpoints, use only `session-typescript/v1`, change target AI alone, and deliver accepted source, verified results and compact history; an honest no-edit result is valid completion. This is a reading-only explanation of this package, not an executed campaign.

## 2. Process overview

Prepare frozen identities, configuration, archived initial source and separate local match/replay worker recommendations; evaluate baseline, decide, then analyze. Subsequent loops select accepted-source ordinary additions or regressing-source single-rule repairs, replay isolated rules against unchanged current analysis source, assemble passing rules, evaluate against accepted control, archive the decision and analyze even the last rejected candidate. Stop at decision ceiling or no qualifying edit; resource/owner incidents suspend with evidence instead of manufacturing completion. Stage controller reports legal edges; owning tools persist state and the orchestrator verifies semantic gates.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Bot/limits resolved | Orchestrator setup, validation, initial archive, calibration, accounting/policy | No calibration/evaluation/analysis overlap | Both usable recommendations and verified setup | Frozen configuration | Evaluate |
| Evaluate | Frozen valid source | Tools reuse exact compatible evidence/run missing matches | Match recommendation; games/sideboarding sequential; gated slice pipeline | All matches finalized/reservations settled | Results, logs, difference | Decide |
| Decide | Evaluation complete | Verify paired improvement; persist decision/archive/history | One stage | Baseline accepted without decision; only strict improvement promotes | Commit/decision | Analyze always |
| Analyze | Finalized slices | Delegate diagnosis only; ordered target-loss page reading/acknowledgement and findings | One owner/slice, default 250 matches; bounded declared slots | Full coverage or labeled explicit cohort; source report complete | Findings/report/ledger | Ceiling → Deliver; otherwise Replay |
| Replay | Source mode selected | Orchestrator isolated variants/current-source controls, every accumulated case | Saved replay recommendation, resource bounded | All cases settle; conversion gate below | Outcomes/dispositions | Passing → Assemble; none → Deliver |
| Assemble | Passing rules | Combine from mode base, preserve semantics; materially changed rule replays | Orchestrator implements | Valid frozen candidate; no combined-rule gate | Hash/history; no proposal.md | Evaluate |
| Deliver | Ceiling or no edit | Rank existing results, export accepted, verify/consolidate | No new games | Honest checked completion | Report/export/hash | Closed |
| Suspend | Incident | Stop/settle/checkpoint/report | Owned groups only | Verified checkpoint, authorization/resources for resume | Pending work/budgets | Verified prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Evaluation identities | Setup source commits/hashes, engine/content/runner/comparison, opponent order and schedule | Target candidates; moving accepted reference | Frozen opponents including starting self; paired deck orders/seeds/sides/rules/content; stable match/game-derived randomness | Admission bindings, integrity/hash checks; reuse only exact compatible evidence |
| Scoring | Game wins/completed non-ignored games; draws zero wins in denominator | Accepted source after promotion | Equal opponent weights; paired intersection excludes either side's ignored game; every scheduled opponent has completed pair | Report W/L/D, rates/difference, ignores and paired coverage; no confidence intervals |
| Ordinary source | Accepted bot and matching analysis, including after tie/unassessable | Add one fix per isolated variant | Replay control/assembly base accepted; rejected evaluation still analyzed first | Separate accepted commit, analysis/replay source and assembly base records |
| Repair source | Valid lower-rate evaluated candidate | Remove/update one existing rule, no additions | Regressing source controls/assembly, its unedited rules, accepted promotion comparator | New-loss metadata accepted-win/candidate-loss; candidate losses only; rank implicated additions by supported distinct losses, not causal assertion |
| Pending ledger | Stable reason/aliases, rule ID and exact semantic hash, original cases/provenance | Explicit alias reconciliation; new matching losses extend first-seen stack to 300; different correction gets new identity | Original IDs/log hashes/critical decisions/offered-chosen IDs and disagreements; current iteration source bindings | Replay all old/new cases from original inputs under current policy; historical results never substitute; unsupported reconstruction blocks |
| Local recommendations | Exact two machine-local file paths | Recalibrate if unusable/missing/unreadable or owner requests | Source/skill/runner/runtime/fixture/version changes and missing historical manifests do not invalidate usable saved count | Read count and CPU range; identities/measurements are provenance |
| Versions | Exact starting source reused/committed on main | Commit all fully evaluated candidates; temporary isolated variants content-hashed only | Accepted independent of HEAD; unique immutable run/version IDs, stable bot ID, required subject/trailers | Commit helper recoverable journal, full SHA/path/outcome/hash, git-show retrieval; only intended bot/history committed |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions | 50 | Resolve/pin owner limits in authoritative run config | Persisted candidate decisions only; baseline excluded; final evaluation analyzed | Deliver after analysis; early no-edit allowed |
| Evaluation | 250 total matches × four games | Require ≥one match/opponent; `matchesPerOpponent` unset | Floor(total/opponents), remainder to first opponents; default planned (1+50)×250×4 = 51,000 games; recovery floor(10%) = 5,100, sum 56,100 | Interrupted recovery allowance exhausted: ignore remaining interrupted games, continue eligible work without asking more games |
| Game usage | Pinned planned/recovery totals | No implicit increases | Failed/interrupted reservations and recovery count; exact caches add no games; executed/reused/reserved/failed/cancelled distinct | Shared admission gate blocks excess |
| Wall/storage | 24h from original startedAt; 50,000,000,000 logical bytes | Explicit full effective limits continuation; retain consumed budgets/start, active writer lock update followed by controller continuation on lock release | Includes downtime, staging/log/evidence/import scope; 16,000,000-byte control reserve inside cap; reserve/settle through owning tools | Suspend; quota marker blocks writes; no ranking/export/analysis/closure cleanup |
| Stage deadlines | Evaluation 5h; preparation 10m; validation 5m; replay branch including prefix 5m; shutdown grace 60s | Resolve/pin effective timeouts capped by remaining wall time | Launch-to-exit; controls/takeovers and diagnostics distinguished | Incident rules apply |
| Replays/calibration | No rule-replay game quota | Cannot add iterations/games/time/storage via pending policy | All associated losses required; diagnostics/calibration separated from evaluation/rule validation but consume time/storage; verify diagnostic admission before calibration | Stop unresolved budget classification conflict |
| Rule stack | 300 distinct losses per reason/rule | Different semantics requires new identity/explanation | Eligibility ≥5 globally; every case denominator includes recorded ignored replay timeouts; repeated executions add no cases | Below either conversion gate and <300 → pending; complete valid current-source test at 300 below either → proven-discarded; incomplete/resource/integrity cannot discard |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual game/replay timeout | Bug report, finalized ignored outcome, continue safe jobs; paired evaluation drops both sides; replay never converts and stays denominator | Never retry case | Timeout and accounting | No unfinished-work interpretation |
| Interrupted evaluation | Preserve verified completion and reservations, recover missing work | Automatic within recovery budget/deadlines | Every attempt/reservation/timeout | Verified remaining work and resources |
| Calibration failed/interrupted stage | Same pinned identity/input, fresh evidence directory; interrupted attempt consumes attempt | One fresh-directory retry, second failure excludes count/remaining repetitions; other counts continue | Both attempts, attempts.json, exclusions; revalidate unfinished retained evidence | Resume same output directory only exact identity; successful required repetitions alone qualify |
| Calibration integrity/resource/owner stop | Propagate applicable incident | Not ordinary retry/exclusion | Diagnostics and attempt state | Resolution/authorized continuation |
| Unsupported package pre-admission | Preserve validation failure; adapt build/validation tooling alone and run relevant checks | Fresh validation directory; no game/recovery charge | Failed validation | Valid protected boundaries, otherwise stop |
| Initialization/sideboarding/integrity/non-timeout validation | Stop; unsafe state never ignored; resolve integrity/input-prefix first, ask owner if unresolved | No generic retry; ordinary replay has no automatic recovery allowance | Failure and source/prefix evidence | Explicit applicable resolution |
| Owner pause/cancel or analyst execution failure | Stop admissions and owned work | Explicit instruction on same verified checkpoint | Claims, uncovered losses, completed work | Resume uncovered work without duplicate owners |
| Current-policy reconstruction unavailable | Keep rule blocked with diagnostics | No fabricated rejection/non-conversion | Original case plus failed reconstruction | Establish exact legal current-source control/choice applicability |
| All stopped work | Grace then terminate owned groups; verify shutdown, settle/cancel, checkpoint | No lock deletion based merely on PID/wrapper exit | Children identities, claims, next stage, identities/budgets | Verified checkpoint; explicit incomplete closure stays incomplete |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State | Config/identities/decisions/receipts/accounting/checkpoints | Existing run.json, iteration.json | After closure | Tool-generated JSON/consolidation |
| Evidence | Typed lossless .log gameplay, findings/pages/replays, hashes, copies, schedules | Existing games/analyses/baseline/iteration paths | Execution/validation/replay/reuse/resume needs end; accepted also replacement/closure | Rejected detail may prune after summarized analysis/decision; pending/owner retention overrides; suspension forbids cleanup |
| Ledger/history | Singleton/sub-five reasons, case provenance/current results; discarded exact-rule evidence | Durable pending/failed history | Compatible continuation/required history | No inherited stack from discarded campaign without authorization |
| Versions | Every evaluated candidate committed with prescribed immutable IDs/trailers; accepted independent of HEAD; compact English attempt lines, SUPERSEDED replacements | Git, improvement-history.md, accepted export/hash | After closure | Temporary unevaluated variants hash-only; logs/dependencies outside Git; no permanent source copies |
| Report | Identities/config/times/status; per-version paired W/L/D/rates/differences/outcomes/ranking; rule/coverage counts; execution/reuse/reservation/failure/cancellation/replay/time/peak-storage/errors; accepted export/hash/issues | Project or artifacts/ | After closure/suspension | Checked consolidation before eligible cleanup; no game IDs/decision details in closure aggregates; summary-only closure cannot supply verified caches |
| Suspension | Reason/checkpoint/pending work/next action/limit change | State/report plus evidence | Completion or explicit incomplete closure | Delivery alone never authorizes pruning |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Calibration vs performance protocol calibration | Local-file broad reuse coexists with exact-identity resume | Completed recommendations use file-path/count validity alone; unfinished attempts require exact identity, retained evidence validation and persistent retry accounting | Source changes do not force completed recalibration, but cannot bless incompatible unfinished stages | No |
| A2 | Pending policy and Replay none edge | Pending entries accumulate over iterations, but no passing edit ends run | Accumulation occurs only on otherwise authorized iterations; no empty candidates/extra iterations to gather cases | Deliver ledger for compatible future continuation when none passes | No |
| A3 | Limits and external owning schemas | Package intentionally references implementation contracts outside supplied reading scope | Do not invent schema/controller persistence; inspect owning entry points during an actual authorized execution | This explanation cannot establish operational readiness or exact schemas without that later discovery | No for comprehension review |
