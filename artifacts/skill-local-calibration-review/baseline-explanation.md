# Explanation from orchestrator for incoming skill

## 1. Outcome and scope
Improve one target bot's paired-game weighted win rate against frozen opponents including the starting bot. Preserve target-only modifications, engine/deck/hidden-information boundaries and current session-typescript/v1 contracts. Deliver accepted source, history and verified results, including honest no-edit or incomplete results.

## 2. Process overview
Prepare frozen setup, limits, policy and both local calibrations; evaluate baseline/candidate, decide and always analyze; replay isolated qualified reasons using current analysis source, assemble passing fixes and evaluate until the decision ceiling or no qualifying edit. Suspension overrides progression.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Required bot resolved | Orchestrator pins setup, sources, schedule, limits and policy | Separate calibration pools; no evaluation/analysis overlap | Valid setup and both saved recommendations | Run config, starting commit, local files | Evaluate |
| Evaluate | Valid frozen source | Owning tools execute missing compatible paired matches | Saved match workers; sequential four games/sideboarding per match; admitted pipeline analysis | Every scheduled match finalized, reservations settled, evidence/resources verified | Results and paired difference | Decide |
| Decide | Complete evaluation | Orchestrator verifies strict paired gate; tools persist decision/archive/history | Single state writer | Baseline accepted without decision; valid strictly higher candidate accepted, otherwise retained control | Outcome/source/checkpoint/history | Analyze |
| Analyze | Finalized selected losses | Delegated analysts read only allowlisted completed target-loss pages and checkpoint findings | Whole slices, bounded declared slots | Required selected coverage and source-bound merged report | Analysis and all reason findings | Deliver at ceiling, suspend on exhaustion, otherwise Replay |
| Replay | Analysis and source mode chosen | Orchestrator implements isolated rules; tools replay every associated accumulated case | Measured resource-bounded replay workers | Current-source exact reconstruction; all settle; at least five and 5% wins, intended choice changed | Pending ledger, current-source controls/takeovers and rule statuses | Assemble if passing; else Deliver |
| Assemble | Passing edits | Orchestrator combines from selected base, replays materially changed semantics, validates/freezes | No added combined-rule gate | Valid frozen candidate; history bindings | Candidate hash/source and replay references | Evaluate |
| Deliver | Valid completion/no edit | Export accepted, rank existing comparable results, consolidate/check report, prune eligible evidence | No fresh games for ranking | Required analyses complete and lifecycle gates satisfied | Export/hash, report/history/state | Closed |
| Suspend | Exhaustion, owner stop or execution failure | Stop admission/owned jobs, settle/checkpoint/report | Shutdown grace then owned process groups only | Verified checkpoint and evidence preserved | Pending work, identities, next stage, budgets | Explicit authorized compatible resume |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Opponents/schedule | Frozen setup, starting bot included | None mid-run | Paired starting inputs, content/engine/rules, order/IDs | Owning validation and source hashes |
| Accepted control | Starting source then accepted versions | Strict paired improvement only | Independent of HEAD/rejections | Completed paired intersections, equal opponent weights; draws zero wins; no CI |
| Ordinary source | Accepted | One added fix per isolated variant | Unchanged analysis/control/base | Matching source-bound report |
| Repair source | Regressing candidate | One existing rule removed/updated; no additions | Remaining unedited rules; accepted comparator | Candidate-loss analysis and metadata-only new-loss flags |
| Calibration reuse | Two local worker files | Owner recalibration or invalid file/count | Local paths alone key completed recommendations | Readable positive integer within logical CPUs; versions/identities provenance only |
| Pending rules | Stable reason/rule IDs and semantic source hashes | Explicit alias reconciliation/new correction identity | Original provenance; fresh current-source replay every iteration | Exact reconstruction/decision applicability; no old-policy prefix masquerading |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/matches | 50; 250 total four-game matches | Pin owner limits before dispatch | Baseline excluded from decisions; floor allocation plus ordered remainder | Final analysis then delivery at decision ceiling |
| Games | (1+effective decisions) × matches ×4; recovery floor 10% | No silent extension | Failed/interrupted reservations count; reused none; separate diagnostics/replays | Interrupted allowance exhaustion ignores remaining interrupted games |
| Time/storage | 24h / 50GB including 16MB control reserve | Explicit full-limit continuation | Original start including downtime; logical bytes/import scope; shared admission and settlement | Suspend, no ranking/export/analysis/closure cleanup |
| Deadlines | Evaluation 5h, preparation 10m, validation/replay branch 5m, shutdown grace 60s | Effective pinned values, capped by remaining wall | Launch-to-exit including replay prefix | Incident-specific response |
| Calibration | Every count 2..CPUs; match calibrator protocol; replay two repetitions, full batch at largest stage | Explicit memory exclusions; no arbitrary substitute | Diagnostics consume time/storage; unfinished attempts exact identity and retained attempts | One fresh-directory stage retry then count exclusion; no qualifier stops |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Integrity/input prefix | Resolve, ask owner if unresolved | No generic retry | Errors and source evidence | Verified resolution |
| Individual timeout | Bug report, ignored finalized outcome; evaluation excluded from both paired sides; replay stays denominator/non-conversion | Never retry case | Attempt/outcome | Continue safe jobs |
| Interrupted evaluation | Recover missing work | Within 10% recovery only | Verified completions/reservations | Deadlines/resources permit |
| Failed calibration stage | Fresh evidence directory, same pinned inputs | One, then exclude worker count | Both attempts/exclusions | Other counts continue; qualifying optimum required |
| Unsupported package before admission | Adapt only validation/build tooling; fresh validation | Stop if still invalid | Failed validation | Protected boundaries hold; no game charge |
| Other validation/non-timeout | Stop unsafe state | No generic retry | Evidence | Resolution/authorization |
| Exhaustion | Stop admission; quota marker blocks writes | Explicit increase | Full checkpoint and pending coverage | Authorized continuation with limits |
| Owner/analyst stop | Stop owned work, preserve claims | Explicit instruction | Uncovered work and ownership | Same verified checkpoint; avoid duplicate owners |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Shared state/report | Identities/config/decisions/accounting/stage/results/errors | Existing run state and project/artifacts report | Compact permanent record | Consolidate/check before eligible cleanup |
| Temporary evidence | Lossless logs, slices/pages, analyses, replay controls/variants, frozen sources/schedules/receipts | Existing paths | All execution/validation/replay/reuse/resume needs end; accepted until replacement/closure | Rejected detail may prune sooner after summarized decision/analysis; owner retention and pending evidence override |
| Pending ledger | All reasons including singleton; up to 300 distinct cases first-seen; original and current bindings | Durable cross-iteration ledger | Compatible continuation or proven discard | Never discard for resource failure; at 300 complete valid below-gate replay archives exact failed rule |
| History/export | All evaluated candidate commits, compact English attempt history; accepted export/hash | Git and bot history | After closure | No logs/bundles/dependencies in Git; unevaluated variants uncommitted |

## 8. Ambiguities and interpretations

The incoming integrity sentence is informal but means resolve integrity/input-prefix failures first and ask the owner if unresolved. Completed calibration recommendations use local file paths only; unfinished calibration attempts retain exact identity. General evidence compatibility cannot override that explicit completed-recommendation exception.
