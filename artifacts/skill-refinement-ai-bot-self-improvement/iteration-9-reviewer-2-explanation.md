# Explanation from reviewer 2 for independent workflow review

## 1. Outcome and scope

Improve required `ai-bot` against frozen starting-self and optional opponents; deliver accepted source, verified paired-game results and compact history. Only target AI changes: decks, engine, legality and hidden-information boundaries stay protected. Owner limits/checkpoint are optional; incompatible legacy execution requires a fresh `session-typescript/v1` run. Honest unchanged completion is valid.

## 2. Process overview

The orchestrator implements; analysts diagnose only. Prepare → Evaluate → Decide → Analyze → Replay → Assemble loops until the decision ceiling or no qualifying edit; Deliver closes. Any active stage can suspend. Scripts own execution/storage/claims; dispatcher output is guidance, never evidence or authorization.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved target | Orchestrator pins setup, identities, seed; archives initial source; validates; calibrates both pools | Calibration separate from evaluation/analysis | Matching saved recommendations, verified setup | Configuration, measurements | Evaluate |
| Evaluate | Frozen baseline/candidate | Bind accepted control/schedule; reuse verified evidence or execute missing work | Measured match optimum; four games/sideboarding sequential | All matches finalized, reservations settled, comparability/resources verified | Logs, coverage, paired difference | Decide |
| Decide | Verified evaluation | Record baseline without decision charge; otherwise decide/archive every evaluated candidate | Sequential | Strict paired improvement only promotes | Outcome, checkpoint, Git/history | Analyze |
| Analyze | Full evaluation barrier | Repeated `sync` with `maxSlices:1` prepares bounded publications outside session ownership; claim whole consecutive 250-match slices, last smaller | One owner/slice; queued runtime slots; setup workers = ceil(matches/250) | All slices complete; merge draft into source-bound final report before checking ceiling | Packets, per-match findings, report | Deliver at ceiling; otherwise Replay |
| Analyze: review | Claimed packet | Read every ordered review page or entire allowlisted fallback; record duration/bytes; preserve unknowns | No evaluation overlap | Complete target-loss coverage, including secondary/singleton reasons; no-loss slice opens nothing | Structured first-pass submission | Checkpoint/complete |
| Analyze: submission/trust | Job not completed | Submit schemaVersion 1, loss-markdown-v1, job/hash, primary findings and required reasons; each reason includes game/id/decision/ordered offered/chosen/reason/solution | Small completed-match batches | Tool validates bindings, IDs, unique coverage; generates Markdown; reconcile synonymous reason IDs globally | `analyses/`, slice coverage | Merge |
| Replay | Source mode selected | Exclude unchanged failed contexts; implement immutable isolated variants; replay every associated loss at primary critical decision against unchanged analysis source | Measured replay optimum, resources bounded | All cases settle; ≥5 and ≥5% convert to wins with intended choice changed | Rule IDs, hashes, controls/takeovers, counts | Assemble if any pass; else Deliver |
| Assemble | Passing edits | Combine all from mode base; preserve semantics/attribution; materially changed isolated logic repeats gate | Sequential assembly | Validate/freeze; no combined-rule gate or proposal.md | History rules/hash/base/replay links | Evaluate |
| Deliver | Required analyses complete | Rank existing comparable results, export accepted source, check consolidation | No fresh games | Verified report and eligible cleanup | Export/hash/report | Closed |
| Suspended | Stop condition | Shutdown owned groups, settle/checkpoint/report | Grace bounded | Explicit authorized continuation, verified checkpoint, adequate limits | Prior/next stage, coverage/budgets | Prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Opponents/inputs | Frozen starting-self plus extras | Accepted control moves | Seeds, deck orders, sides, rules/content, stable IDs, opponent order/schedule | Source hashes and paired bindings |
| Ordinary mode | Accepted source and matching analysis | Add one isolated fix | Rejected evaluation still analyzed first | Accepted comparator |
| Regression repair | Valid lower-rate candidate | Remove/update existing rule, add none | Unedited regressing rules; analysis/control/base = regressing candidate | Accepted comparator; new-loss metadata only |
| Score | Wins/completed nonignored games; draws zero wins | Paired intersection | Equal opponent weighting; each opponent needs pair | Ignore either side on both; unresolved comparison unassessable |
| Evidence | Matching identities/settings/implementation/integrity | Verified reuse | Provenance/executed-versus-reused distinction | Resumed analysis requires audit of source/report/page bytes and coverage |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/evaluation | 50 decisions; 2500 four-game matches/evaluation | Pin owner values; matchesPerOpponent unset | Baseline excluded; floor allocation plus ordered remainder | Final analysis then Deliver |
| Evaluation games | 510000 planned + 51000 recovery | Formula uses effective limits | Failed/interrupted reservations count; caches zero; recovery separate | Ignore remaining interrupted games; continue eligible work |
| Wall/storage | 86400000 ms; 50000000000 decimal bytes | Explicit effective limits | Original start includes downtime; logical staging/import/evidence; 16000000 bytes control reserve inside cap | Suspend |
| Deadlines | Evaluation 18000000; preparation 600000; validation/replay including prefix 300000; shutdown 60000 ms | Resolve effective values | Launch-to-exit, capped by remaining wall | Incident policy |
| Calibration/replay | Workers 2…logical CPUs; no replay-game quota | No invented fallback | Replay: two repetitions/full worker batches, identical outcomes; smallest within 3% fastest successful median | No qualifier stops preparation |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Report bug, finalize ignored; replay denominator retained, never conversion | None | Outcome/accounting | Continue safe jobs |
| Evaluation interruption | Recover missing work | 10% allowance only | Every reservation/attempt | Existing deadlines/resources |
| Calibration stage failure | Fresh directory, same inputs | Once; second excludes count/repetitions | Both attempts, exclusions | Other qualifying counts |
| Invalid format before admission | Adapt build/validation tooling only | Fresh validation, no game charge | Failed validation | Valid protected boundaries |
| Integrity/prefix/init/sideboarding/non-timeout failure | Stop | No generic replay retry | Unsafe evidence | Applicable explicit continuation |
| Resources/owner/analyst stop | Stop admission; settle/cancel, bounded owned shutdown | No implicit increase | Claims, uncovered losses, checkpoint | Explicit instruction; full limits preserved; storage increase: persist request → writer-locked gate update → continuation after session unlock |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State/history | Identities, decisions/accounting; immutable versions, one English line/attempt, SUPERSEDED replacements | Existing run.json/iteration.json, Git/history | After closure | Compact retained |
| Execution evidence | Typed lossless logs; hashes/pages/replays/receipts/schedules/packages | Existing evaluation paths | All execution/validation/replay/reuse/resume needs end | Rejections additionally summarized; accepted additionally replaced/closed; owner retention wins |
| Checked report/export | Versions, opponent/weighted W/L/D/rates/differences, coverage, rule counts/dispositions, budgets/errors/ranking, accepted SHA/path/hash | Project/artifacts | After closure | Closure aggregates omit game IDs/decision details; then eligible detail removed |

Suspension forbids ranking/export/further analysis/closure cleanup. Delivery alone permits no pruning. Explicit incomplete closure stays incomplete; summary-only closure cannot support cached reuse. Source archives use Git, not permanent copies.

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Controller versus admission wording | “Controller” could imply this dispatcher reserves resources | Actual code only validates stage/event syntax and prints text; resume accepts any active stage without evidence checks | Orchestrator verifies authorization/gates and checkpoints via owning tools | No |
| A2 | External entry-point contracts | Package does not specify actual request schemas, match-calibration repetitions or runtime slot ceiling | Resolve from mandatory owning contracts during execution, not invent values | Package-only explanation cannot certify those implementations | Before execution |
| A3 | Slice release/resume | Retained claims versus reassignment | Owner retry returns claim; completed findings persist; release requires token and terminated:true, invalidates stale completions | Resume uncovered jobs only; identical submissions safe, changed accepted reports rejected; never mix per-match claims | No |
