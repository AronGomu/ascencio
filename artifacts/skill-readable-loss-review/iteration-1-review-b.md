# Explanation from review-b for fresh skill comprehension

## 1. Outcome and scope

I would improve the required target `ai-bot` using reproducible paired evaluation, retaining the accepted source unless a valid candidate strictly improves the equally weighted opponent game win rate. Inputs also include optional extra opponents, limits and a compatible checkpoint. Only target AI changes are allowed; decks, engine, legality, hidden information and frozen opponents (including starting AI) remain protected. Successful completion includes accepted source/export, verified results and compact history, even when no change qualifies; suspension remains incomplete.

## 2. Process overview

I would use the stateless stage controller while owning project tools persist execution and checkpoints. Prepare freezes setup and obtains both local concurrency recommendations, then Evaluate → Decide → Analyze runs for baseline and every combined candidate. Analyze selects ordinary fixes or regression repair; Replay validates isolated rules and accumulated pending cases; Assemble combines passing edits and returns to evaluation. A decision ceiling or no qualifying edit leads to delivery, while resource/incident stops override progression. The orchestrator implements changes and fresh per-loss subagents diagnose losses.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | New run or authorized compatible checkpoint | Orchestrator reads runner contract, resolves defaults/schema, setup seed, identities, explicit policy/storage, source archive and validation; obtains calibration recommendations | Calibration separately from evaluation and analysis | Verified setup/current session-typescript/v1 and both usable worker files; no invented fallback | Frozen configuration, schedules, source identities, calibration provenance | Evaluate |
| Evaluate | Frozen validated baseline or assembled candidate | Bind accepted comparator and source; reuse only exact compatible evidence; execute missing matches through admission tools | Independent matches at saved optimum; four games and sideboarding sequential within each match; admitted analysis pipeline only with explicit envelopes/runtime capacities | All scheduled matches finalized, reservations settled, integrity/resources/results verified; every opponent has a completed paired intersection | Typed logs, receipts, results, paired difference | Decide; slice-ready stays Evaluate |
| Decide | Evaluation complete | Orchestrator verifies strict paired gate independently; tools persist decision and archive candidate/history; baseline establishes reference without charging a decision | One controller task | Wins/completed nonignored games, draws zero wins; exclude either ignored side from both; equal opponent weighting; ties, regressions and unassessable retain accepted | Outcome, reason, difference, checkpoint, evaluated candidate commit | Analyze always |
| Analyze | Evaluated source and finalized loss projections | Publish bounded one-slice batches; each fresh subagent claims one complete Markdown loss, reads all and submits primary plus every supported secondary reason once; coordinator validates exact choices and merges per-match findings | Queued within declared runtime/RAM slots; publication serialized; never reslice live claims | Full mode reviews all losses; explicitly selected policy labeled partial; complete source-bound report before ceiling check | Coverage, generated match reports, loss-analysis.md, reconciled reason IDs | Deliver at decision ceiling; otherwise Replay; exhaustion suspends |
| Replay | Coverage/source gates met | Orchestrator chooses accepted-source ordinary one-fix variants, or removes/updates one existing rule from regressing candidate without additions; reads history and pending ledger | Measured resource-bound independent reason jobs; immutable isolated directories | Replay every associated case at primary decision against unchanged current analysis source. At least five distinct converted wins AND 5% denominator, intended choice changed, all cases settled | Current source/rule bindings, control/takeover outcomes, pending/blocked/validated/discarded dispositions | Any passing edit → Assemble; none → Deliver |
| Assemble | Passing isolated edits | Combine from mode base, preserve attribution/unedited repair rules; materially altered logic repeats replay gate; validate/freeze and update history; no proposal.md or additional combined-rule gate | Orchestrator implementation | Exact combined source validated and recorded with rules/hash/accepted base/replay references | Candidate package/history, lifecycle-eligible pruning | Evaluate |
| Deliver | Analyses/decisions complete and normal terminal condition | Verify, rank existing comparable results without new games, export accepted source, check consolidation then eligible cleanup | No new evaluation | Checked report and export; honest actual decision count | Final report, export/hash, durable state/history | Closed |
| Suspend/resume | Incident or authorized stop | Stop admission/owned work, bounded shutdown, settle reservations and checkpoint; resume only authorized verified prior stage | Only owned process groups terminated | Original start and budgets preserved; limits remain sufficient or explicitly increased | Stop report, incomplete status and resumable evidence | Suspended or verified prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Match identity | Pinned engine/content/runner/comparison hashes, opponent order, seeds, starting deck orders, sides/rules/content and stable match/game IDs | Play/sideboarding trajectories | Starting paired inputs and frozen opponents | Source/hash and schedule comparison before reuse/admission |
| Sources | Starting commit, separate accepted commit, analysis/replay source and assembly base | Accepted moves only on strict promotion; repair analysis uses regressing candidate | Unchanged replay control; no earlier isolated fixes in other variants | Immutable source hashes and decision bindings |
| Analysis access | Allowlisted completed target-loss Markdown and exact-choice maps | Explicit immutable cohorts/imports with provenance; new cohort for old packet continuation | Unknown information; no winning/opponent-only/two-actor gameplay access | Queue exact-ID validation, audit hashes and exactly-once coverage |
| Pending rule identity | Stable reason/aliases, rule ID and semantic/source hash | Explicit semantic alias reconciliation; materially different correction gets new rule ID | Original findings/provenance/disagreements and failed history | Current-source control plus rule branches on original pinned cases; no historical-prefix forcing |
| Version archive | Exact starting-source commit on main or reused exact commit | Commit each fully evaluated candidate including rejected; accepted independent of HEAD | Unique immutable run/version IDs and required trailers | Commit helper journal; git lookup/show and source hashes; only intended bot/history files committed |
| Formats/tool ownership | Existing campaign/round/incumbent names and paths, current runner | Tool-generated JSON metadata | Gameplay typed lossless .log, no gameplay JSON sidecars; no legacy adaptation | Owning schema/tool validation, receipts and atomic gate publication |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions | 50 | Pin owner limits in effective configuration | Persisted candidate decisions only, baseline excluded; final evaluation still analyzed | Deliver after required analysis |
| Evaluation | 250 total four-game matches | Frozen total distributed floor/remainder in opponent order, at least one each; matchesPerOpponent unset | Planned games = (1 + effective decisions) × matches × 4; recovery floor(10% planned); track attempts/reservations separately, reuse adds none | Recovery exhausted: ignore remaining interrupted games and continue eligible work |
| Time/storage | 24h from original startedAt; 50GB logical bytes | Explicit continuation with full effective limits; active storage transaction follows writer-lock/gate then session-lock continuation order | Includes downtime, logs/staging/imported scope/diagnostics; protect 16MB control reserve inside cap | Suspend, no ranking/export/analysis/closure cleanup |
| Deadlines | Evaluation 5h, preparation 10m, validation 5m, replay branch with prefix 5m, shutdown 60s | Resolved stage limits capped by remaining wall time | Launch-to-exit | Apply incident handling |
| Calibration | Counts 2 through logical CPUs | Reuse readable positive integer local files within CPU count; identities are provenance, not invalidators | Required measurements or permitted explicit exclusions; replay two repetitions, full largest-stage batch/worker, same outcomes; smallest count within 3% fastest successful median | No qualifying count stops Prepare |
| Rule cases/replays | 300 distinct first-seen cases per reason/rule; no rule-game quota | No extra resources authorized by pending entries | Replay all accumulated cases each iteration against current source, repeats do not add cases; ignored timeouts denominator/nonconversion | Below gate under 300 stays pending; valid fully settled 300-case failure proven-discarded; resource failures cannot discard |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report and finalized ignore; evaluation paired exclusion; replay never converts | Never retry case | Timeout and accounting | Continue safe jobs |
| Interrupted evaluation | Preserve verified results, recover missing work | Automatic only within recovery budget/deadlines | All reservations, attempts and timeouts | Compatible checkpoint/resources |
| Failed calibration stage | Same inputs, fresh directory | One retry, then exclude count and remaining repetitions; interrupted attempts consume attempt | Both attempts, attempts.json, exclusions | Same exact identity for unfinished calibration |
| Unsupported package pre-admission | Adapt build/validation tooling only, local checks and fresh validation | No evaluation/recovery charge | Failed validation | Stop if still invalid |
| Integrity/input-prefix failure | Solve; ask user if unable; unsafe initialization/sideboarding/validation stops | No generic replay retry | Diagnostics and unsafe state | Verified resolution and applicable authorization |
| Unreconstructable current-policy pending case | Mark entry blocked | No fabricated nonconversion/discard | Original and current source bindings/diagnostics | Exact legal current-source reconstruction established |
| Resource stop | Stop admission, quota marker blocks data writes | No implicit increases | Checkpoint, pending jobs, budgets, owned-work settlement | Explicit full-limit continuation |
| Owner stop or analyst execution failure | Stop owned work and admission | Explicit instruction required | Claims and uncovered losses; no duplicate owners on continuation | Same verified checkpoint |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Shared state | Configuration, identities, decisions, accounting, receipts/reference records | run.json and iterations/iteration-N/iteration.json | Durable compact record | Owning tools checkpoint; no improvised generated JSON edits |
| Loss evidence/reports | Full readable loss files, choice maps, source-bound per-match reports and baseline/iteration loss-analysis.md; exact affected decisions in analysis | Existing evaluation analyses and artifact paths | All execution, replay, validation, reuse and resume needs end | Rejected details after summarized analysis/decision; accepted additionally until replacement/closure; delivery alone insufficient |
| Pending ledger | Every reason including singleton/sub-five groups, original cases, hashes, critical choices, current-source outcomes, aliases and disagreements | Durable cross-iteration ledger | Compatible future continuation; discarded campaign inheritance requires separate authorization | Required evidence overrides ordinary pruning; exact proven-discarded history remains durable |
| Versions/history/export | Baseline/evaluated candidate commits, English compact attempt history with SUPERSEDED replacements, accepted source/hash | Git, improvement-history.md, export path | After closure | Unevaluated variants temporary hashed source; no permanent duplicate source archives |
| Run report | State/reason/checkpoint, source identities/config/times, per-version W/L/D/rates/paired coverage/decision/ranking, aggregate rule counts, unclear coverage, executed/reused/reserved/failed/cancelled games, replays, errors, elapsed/peak storage, export/hash and unresolved issues | Project or artifacts/ | Durable checked report | Closure consolidates without game IDs/decision detail; only then remove eligible temporary evidence; suspension disallows closure cleanup |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Incident opening versus incident table | “Solve issue” for integrity/prefix failures could conflict with stop/no generic retry | Stop unsafe execution, diagnose/repair without treating failure as ignored; ask user if unresolved and resume only verified/authorized | No blind retry or continuation on unsafe state | Only if resolution/authorization remains unclear |
| A2 | Prepare and performance protocol slice limits | Default says 250-match slices while slices are publication-only and synchronization maxSlices:1 | Use sliceMatches 250 unless explicit policy changes it; publish one bounded slice per synchronization, with independent per-loss ownership | No 250-loss ownership unit or simultaneous mass publication assumed | No |
| A3 | Pending ledger tooling | Exact durable schema/path not supplied and existing replay tools do not implement ledger automatically | Discover owning capabilities and persist scripted JSON ledger preserving required fields; never silently claim automatic support | Unsupported current-source reconstruction stays blocked, not failed | Only if no compatible storage/tooling can preserve required evidence |
