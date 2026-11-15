# Explanation from review_i2b for local-calibration skill comprehension

## 1. Outcome and scope

Improve one supplied `ai-bot` against frozen opponents, including its starting AI, and deliver accepted source, verified paired results and compact history; unchanged acceptance is a valid honest outcome. Optional inputs are additional opponents, owner limits and a compatible checkpoint. Modify target AI only, preserving deck, engine, legality and hidden-information boundaries. Use `session-typescript/v1`; incompatible old runs start fresh. This explanation reads only this skill package and the explanation template, without gameplay or execution.

## 2. Process overview

Prepare frozen configuration, sources, budgets and both local worker recommendations; evaluate baseline, decide, and analyze. Build isolated fixes from the selected analysis source, replay all eligible accumulated cases, assemble passing edits and repeat evaluation/decision/analysis. Final analysis is mandatory even at the decision ceiling. No passing edit or completed ceiling leads to delivery; resource exhaustion suspends. The stateless controller describes legal edges, while owning project tools persist gates, reservations, claims and checkpoints and the orchestrator verifies semantic authorization.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Bot identified | Orchestrator pins defaults/overrides, identities, schedule, policy; setup/validate/archive starting source; resolve calibration | Calibration separate from evaluation/analysis | Verified current setup and both recommendations | Configuration, commit, provenance | Evaluate |
| Evaluate | Frozen source | Reuse exact compatible evidence or run missing matches | Saved match workers; four games/sideboarding sequential per match | All scheduled work finalized, settled and verified | Results, receipts, paired difference | Decide |
| Decide | Complete evaluation | Persist baseline reference or verify promotion; commit every evaluated candidate and history | One controller task | Strict valid paired improvement accepts; otherwise retain accepted | Decision/commit/checkpoint | Always Analyze |
| Analyze | Finalized slice | Delegate diagnosis only; acknowledge ordered pages, checkpoint findings, merge report | Default 250-match slices, one owner each; bounded runtime/RAM/storage slots; pipeline only by admission | Full coverage default; explicit partial coverage labeled; ceiling delivers only after analysis | Findings, coverage, source-bound report | Replay/Deliver |
| Replay | Analysis complete | Orchestrator builds isolated variants and retests accumulated cases | Measured bounded replay workers | All cases settle; >=5 distinct losses eligible; >=5 converted wins AND >=5% associated losses, intended choice changed | Immutable hashes/traces/ledger | Assemble if any pass; otherwise Deliver |
| Assemble | Passing rules | Combine from mode base; changed semantics repeat isolated replay, no combined gate | Isolated immutable inputs | Validate/freeze; history binds rules/hash/base/replays; no proposal.md | Candidate | Evaluate |
| Deliver | Required analysis complete | Rank existing comparable results, export/check report, eligible cleanup | No fresh ranking games | Actual outcome/progress reported | Report/export/hash | Closed |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Execution identities | Pinned configuration, commits/hashes, runner/engine/content/comparison, opponent order/schedule | Accepted reference moves only after qualifying decision | Frozen opponents including starting self; paired starting orders/seeds/sides/rules/content and stable-ID randomness | Exact compatibility and integrity before reuse/admission |
| Source mode | Ordinary: accepted source; regression repair: valid lower-rate evaluated candidate | Ordinary adds one fix per variant; repair removes/updates one existing rule, adds none | Analysis, unchanged control and assembly base agree; comparator always accepted | Record accepted commit separately; analyze rejected evaluation before returning to retained accepted analysis; baseline has no removal analysis |
| Game scoring | Completed paired intersections | Finalized ignored games removed from both evaluation sides | Games, not matches; draws denominator zero wins; equal opponent weights; every opponent needs completed pair | Report per-opponent/weighted rates, differences, coverage and ignores; no confidence intervals |
| Local recommendations | `.cache/typescript-native-workers.json`, `.cache/replay-workers.json` | Owner recalibration or unusable file triggers fresh calibration | Reuse keys are local paths; readable positive integer <=logical CPUs suffices | Source/runtime/runner/bot/fixture/version changes or missing historical manifests do not invalidate completed recommendation; identities are provenance |
| Pending rule identity | Stable reason/aliases, rule ID, semantic/source hash and original case evidence | Explicit semantic reconciliation extends matching stack; materially different correction gets new rule identity | First-seen distinct case order, cap 300, provenance/disagreements | Retest every old/new case on current analysis source; historical outcomes cannot substitute; impossible reconstruction becomes blocked |
| Rule terminal state | Below-threshold stays pending | Complete valid current-source replay at 300 cases below either threshold proves exact rule discarded | Interruptions, resource/integrity failures never prove discard | Archive denominator/counts/source/rule identities; unchanged proven-discarded rules excluded |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/evaluation | 50 decisions; 250 total four-game matches | Pin owner overrides in effective configuration | Baseline not a decision; allocate floor(matches/opponents) plus ordered remainder, >=1 each; leave matchesPerOpponent unset | Final evaluation analysis then Deliver; no qualifying edit allows earlier stop |
| Evaluation games | Planned=(1+effective decisions)*matches*4; recovery=floor(10% planned) | Pin separately and sum | Reservations, failed/interrupted and recovery executions count; verified reuse adds no execution | Exhausted recovery ignores remaining interrupted games; no extra-game request |
| Time/storage | 24h from original startedAt; 50,000,000,000 logical bytes | Explicit authorized continuation with full effective limits; active writer storage increase uses gate writer lock then session-lock continuation | Downtime included; staging/log/evidence/import bytes and imported scope counted; 16,000,000 control reserve inside cap | Suspend, no admission/ranking/export/analysis/cleanup |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay branch including prefix 5m; shutdown grace 60s | Resolve per branch/stage and cap by remaining wall time | Launch-to-exit | Incident policy |
| Replays/diagnostics | No rule-replay game quota | Still bounded by time/storage | Separate controls/takeovers/calibration diagnostics from evaluation/rule-validation counts | Suspend on resource cap; ledger grants no extra budget |
| Calibration attempts | Required successful repetitions; one retry per failed stage | Exact identity for unfinished same-directory resume | Interrupted attempts consume attempt; save attempts.json and evidence, revalidate unfinished evidence; explicit three-flag memory preflight may exclude counts | Fresh-directory retry once, then exclude count/remaining repetitions; no qualifier or <2 CPUs stops preparation |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual game/replay timeout | Bug report, finalized ignored outcome, safe work continues; evaluation excludes both paired sides, replay stays denominator and never converts | Never retry case | Timeout/report/accounting | Continue eligible jobs |
| Interrupted evaluation | Recover missing work safely | Automatic only within recovery allowance/deadlines | Verified completions, every reservation/attempt/timeout | Remaining resources; exhaustion settles remaining interrupted games ignored |
| Failed calibration stage | Same pinned inputs, fresh evidence directory | One retry then exclusion; not ordinary rule replay | Both attempts and exclusions | Other counts proceed; exact-identity unfinished resume only |
| Initialization/sideboarding/integrity/non-timeout validation failure | Stop; resolve integrity/input-prefix failures first, ask owner if unresolved | No generic retry or automatic ordinary replay recovery | Failure diagnostics, bindings and incomplete work | Authorized safe verified continuation |
| Time/storage exhaustion | Stop admissions; storage rejection persists write-block marker | Explicit limit increase/continuation only | Resumable evidence and budgets | Applicable authorization and remaining/increased limits |
| Owner pause/cancel or analyst failure | Stop admission/owned work; retain claims/uncovered losses | Explicit instruction, same verified checkpoint | Coverage/claims, pending work | No duplicate owners; verified checkpoint |
| Any stopped owned work | Wait at most effective grace, terminate owned process groups only, settle/cancel reservations, verify shutdown and checkpoint | Never infer child completion from wrapper exit or remove lock from PID alone | Source identities, next stage, budgets, interrupted reservations | Report reason/checkpoint/next action/needed increase; explicit incomplete closure remains incomplete |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Pending ledger and failed history | All reported reasons including singleton/sub-five groups; source/log hashes, IDs, offered/chosen, outcomes; blocked/pending/discard evidence | Durable cross-iteration ledger separate from findings | Pending evidence retained across iterations and compatible future continuation | Pending overrides ordinary failed-rule exclusion/pruning; discarded campaigns inherit no stack without separate authorization |
| Git/history/export | Required version subjects/trailers, full SHA/path/hash/outcome; English one compact attempt line with SUPERSEDED replacements; accepted export/hash | Git, improvement-history.md, accepted export | After closure | Commit intended bot/history only; no logs/bundles/dependencies |
| Checked report | IDs/config/identities/times/status; baseline/every evaluated version W/L/D, rates, paired differences/outcomes/rank; all rule counts/dispositions/coverage; accounting, errors, accepted export/hash/issues | Project location or artifacts | After closure | Closure aggregates omit game IDs/decision detail; checked consolidation precedes eligible removal |
| Suspension detail | Stop/checkpoint/next stage, used/remaining resources and pending work | Report and checkpoint | Completion or explicit closure | No resource-suspension closure cleanup; summary-only closed runs cannot supply verified cached games/replays |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Controller and owning tools | Copied package references canonical commands/external implementations | Policy walkthrough only; actual execution discovers owning schemas and verifies gates | No external verification or gameplay performed here | Only if execution contracts cannot be resolved |
