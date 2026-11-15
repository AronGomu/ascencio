# Explanation from review-a for pending-rule workflow comprehension

## 1. Outcome and scope

Improve one required target `ai-bot` against frozen starting-self and optional additional opponents, delivering the accepted source, verified paired-game results and compact history. Only target AI may change; decks, legality, engine and hidden-information boundaries remain protected. An unchanged result is successful honest delivery when no edit qualifies. Use current `session-typescript/v1`, default GPT-6.1 Sol/low unless explicitly overridden; incompatible legacy checkpoints require a fresh campaign.

## 2. Process overview

Prepare immutable identities, budgets, review policy and two calibrations; evaluate baseline, decide, then analyze. Each later candidate repeats evaluation, persisted decision and analysis, including the final decision. Eligible reasons become isolated replay variants; passing edits assemble into a combined candidate. Pending reasons accumulate evidence across authorized iterations but never create an extra iteration. The stateless controller reports legal edges; project tools persist transactions and the orchestrator verifies semantic gates. Stops supersede progression.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Target and compatible inputs resolved | Orchestrator reads runner/schema/defaults, runs setup/validation, archives initial source on main, pins policy and calibrations | Calibration separate from evaluation/analysis | Exact setup and both recommendations verified | Configuration, schedule, source archive, reports | Evaluate |
| Evaluate | Frozen baseline or assembled candidate | Orchestrator binds accepted control and runs missing compatible matches; reuse only verified matching evidence | Independent matches at calibrated optimum; four games/sideboarding sequential; gated pipeline may analyze finalized slices | Every scheduled match finalized; reservations/evidence/results/resources verified | Logs, receipts, paired difference | Decide |
| Decide | Complete evaluation | Baseline becomes accepted without candidate decision; otherwise independently verify strict paired improvement, persist decision, commit every evaluated candidate and update history | Sequential | Valid higher weighted rate accepts; tie/regression/unassessable retains accepted | Decision, immutable version commit, history | Analyze |
| Analyze | Evaluation decision recorded | Delegate loss diagnosis only; one owner per fixed slice. Read target-only allowlisted completed-loss evidence; preserve unknowns and all primary/secondary hypotheses | Default consecutive 250-match slices; bounded analyst/runtime/RAM slots; no duplicate owners | Complete full policy or explicitly labeled selected cohort; merge source-bound report before checking ceiling | Per-match findings, page acknowledgements, coverage, report, pending reasons | Ceiling → Deliver; resources → Suspend; otherwise Replay |
| Replay | Authorized next iteration | Orchestrator selects source mode, reads ledger/history, implements one isolated fix or repair; replays every associated accumulated loss at primary critical decision against fresh unchanged-current-source control | Measured replay pool, immutable per-variant outputs, all jobs settle | At least five converted wins AND 5% of associated accumulated losses, intended choice changed | Current-source results; validated/pending/blocked/proven-discarded status | Any passing edit → Assemble; none → Deliver |
| Assemble | Validated edits exist | Combine all from mode base; preserve attribution and unedited repair rules; materially changed logic repeats isolated replay; validate/freeze | Sequential assembly; no additional combined-rule gate | Exact candidate ready | History with rules/hash/accepted base/replay refs; no proposal.md | Evaluate |
| Deliver | Completed authorized work without resource exhaustion | Verify decisions/analysis; rank existing comparable results; export accepted source; check consolidation then eligible cleanup | No fresh ranking games | Accurate terminal status, including early no-edit completion | Report/export/hash | Closed |

Review mechanics: sync discovers at most one slice per call; claims own whole slices, checkpoint small completed-match batches, complete/release through tokens. Version 1 reads every page or whole allowlisted fallback; version 2/3 require ordered contiguous hash-bound acknowledgements, separate from findings. Version 3 restart metadata requires rereading earlier block pages for decoder context. Findings retain exact ordered offered/chosen IDs and one critical decision per reason/game; aliases merge explicitly without erasing original reasons. Audit resumed evidence; import only completed identity-matching coverage with provenance. Full is default; sample/two-pass require seed and sampleMatches, immutable cohorts and honest selected/full labels. Two-pass waits for outcome metadata; earlyResearch permits hypotheses only, not bypassing replay/promotion gates.

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Evaluation | Pinned source commits/hashes, runner/engine/content, configuration and opponent order | Accepted comparator advances only on promotion | Frozen opponents including starting self; paired deck order, seeds, sides/rules/content; stable game-ID randomness | Compare completed paired intersections; either-side ignores remove both; every opponent needs a completed pair |
| Score | Wins / completed nonignored games | Trajectories/choices may differ | Draws count zero wins in denominator; equal opponent weights; no confidence intervals | Report rates/differences/ignores/coverage; unresolved mismatch unassessable |
| Ordinary mode | Accepted source and matching analysis | Add one fix per isolated variant | Comparator accepted; rejected evaluation still analyzed | Source/report hashes |
| Regression repair | Valid lower-rate candidate | Remove/update one existing rule, add none | Candidate is analysis/control/assembly base; preserve unedited rules; comparator accepted | New-loss metadata flags accepted-win/candidate-loss; rank implicated rules by distinct losses, not causal claims |
| Pending ledger | Stable reason/rule IDs, explicit aliases, exact semantic rule/source hashes | Add/reconcile distinct losses in deterministic first-seen order, max 300 per rule; different corrections get separate identities | Original findings, source/log hashes, primary decisions, offered/chosen IDs, outcomes and disagreements | At each authorized Replay, eligible groups (≥5 losses globally) replay entire stack on current analysis source; incompatible mode blocks |
| Current-source replay | Pinned original case inputs | Fresh current-source control and current-source-plus-rule branches | Historical prefixes cannot force old-policy choices; historical outcomes cannot substitute | Verify reconstruction, legal addressing and applicability; unsupported reconstruction blocks with diagnostics |
| Terminal rule failure | Exactly 300 distinct accumulated losses | Materially different correction gets new identity/explanation | Only complete valid current-source replay below either gate proves discard; unchanged rule excluded thereafter | Durable failed-rule history with counts/denominator/source/rule/evidence; interruptions/resources/integrity never prove failure |
| Archive | Stable bot ID, unique immutable version/run IDs | Accepted reference independent of HEAD; follow-ups reuse identities | Required commit subject/trailers and full SHA/path/outcome; intended bot/history only | Recoverable commit journal, git show/package retrieval; no permanent source copies |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/matches | 50 decisions; 250 total four-game matches | Pin effective owner values; require ≥1 match/opponent, leave matchesPerOpponent unset | Floor allocation plus first-order remainder; baseline not a decision | Final evaluation analyzed; ceiling delivers |
| Evaluation games | Planned=(1+effective decisions)×matches×4; recovery=floor(10% planned) | Pin both and sum | Separate planned/recovery; failed/interrupted reservations and recovery executions count; cache adds none; all attempts settled | Recovery exhausted: ignore remaining interrupted games, continue eligible work |
| Wall/storage | 24h from original startedAt; 50GB decimal | Explicit authorized continuation with complete effective limits; preserve consumption/start | All downtime and logical staging/log/evidence/import bytes; 16MB control reserve inside cap, explicit maxBytes | Suspend; block admission/data writes, no ranking/export/analysis/closure cleanup |
| Stage deadlines | Evaluation 5h; preparation 10m; validation 5m; replay branch including prefix 5m; shutdown 60s | Resolve/pin effective timeouts; cap by remaining wall | Launch-to-exit; controls/takeovers/calibration separate from evaluation but consume time/storage | Incident policy |
| Replays | No game quota; every associated case required | No pending-entry budget extension | Ignored replay timeouts stay denominator, never convert; unchanged choice/nonwinning takeover nonconversion | Below 300 retain pending; at 300 apply valid terminal gate |
| Calibration | Every worker count 2..logical CPUs measured or policy-excluded | Explicit memory preflight needs budget/reserve/per-worker flags | Match designated repetitions; replay two repetitions, full independent batch/worker at largest stage, identical outcomes; smallest count within 3% fastest successful median | No qualifying count or <2 CPUs stops preparation |

Calibration identities include machine/runtime/workload/batch and source/input/log identities, plus replay Node flags/version and engine/content. Save separate matching recommendations, replay `.cache/replay-workers.json`, attempts, measurements/exclusions. No arbitrary worker fallback. Shared locked gate handles reservations and staged fsynced atomic publication/index-last; active-writer storage increase persists request, updates gate under writer lock, commits continuation after session lock release.

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual game/replay timeout | Bug report; finalize ignored; safe jobs continue | Never retry case | Timeout/outcome/accounting | Evaluation excludes paired game both sides; replay timeout remains denominator |
| Interrupted evaluation | Preserve verified completions, recover missing | Automatic only within recovery allowance/deadlines/resources | Reservations/attempts/timeouts | Verified compatible checkpoint |
| Calibration count failure | Fresh directory, same pinned inputs | Once; second failure excludes count and remaining repetitions | Both attempts and retry state | Continue other counts; integrity/resource/owner stops propagate |
| Unsupported pre-admission package | Preserve validation; adapt build/validation tooling only; related checks | Fresh validation, no game charge | Failed validation | Valid without protected changes, otherwise stop |
| Integrity/prefix/init/sideboard/other non-timeout failure | Stop and resolve; never ignore unsafe state | No generic replay retry | Errors and exact bindings | Ask owner if integrity/prefix unresolved |
| Time/storage exhaustion | Suspend admission and owned work | No implicit increase | Checkpoint prior stage, completed/pending work, coverage/claims, interrupted reservations and budgets | Explicit authorized increase/continuation |
| Owner pause/cancel or analyst execution failure | Stop admission/owned work | No automatic continuation | Claims/uncovered losses | Explicit instruction on same verified checkpoint |

All stopped owned work gets bounded shutdown grace then only owned process groups terminate; verify shutdown and settle/cancel reservations. Operation recovery verifies owner death, child birth identities and lock token; wrapper exit/PID alone never permits lock removal. Explicit incomplete closure remains incomplete. Routine progress uses metadata; diagnostics use separate copied scope and do not revive stopped campaign budgets.

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State/history | Configuration/identities/accounting, decisions, receipts; compact English line per attempt and SUPERSEDED replacements | run.json, iterations/iteration-N/iteration.json, improvement-history.md, Git | Durable after closure | Owning tools, not hand-edited generated JSON |
| Execution/review evidence | Typed lossless .log, four-game index, receipts, review pages/packets/findings/reports, immutable variants/replays/schedules/packages | Existing games/game-N and analysis paths; English baseline or iteration loss-analysis.md | All execution/validation/replay/reuse/resume needs end; accepted additionally replacement or closure | Summarized rejected evidence may prune during run; designated tool, owner retention overrides; delivery alone insufficient |
| Pending/failed rules | Original provenance and accumulated cases, current-source outcomes, rule identities/status; terminal failed counts/evidence | Durable cross-iteration ledger separate from findings and durable failed-rule history | Pending future compatible continuation needs; failed history remains | Pending requirements override ordinary unsuccessful-rule exclusions and pruning; discarded campaign inherits none without authorization |
| Report/export | State/stage/reason/times/IDs, all versions with paired/per-opponent WLD/rates/outcomes/ranking, rule counts/status, unclear/coverage totals, execution/reuse/reserved/failed/cancelled and replay accounting, elapsed/peak bytes/errors, accepted commit/export/hash and unresolved issues | Project or artifacts; accepted export | Durable | Checked closure consolidation permits only eligible temporary cleanup; no game/decision details in compact rule summary |

Suspension report gives checkpoint, next action and needed limit change; retains resumable detail. Closed summary-only runs cannot supply verified cached games/replays. Reports reference effective configuration/shared policy without duplicating it. No qualifying rule preserves accepted and delivers pending ledger when no further iteration is authorized; never force an empty candidate. Push/publish/merge need separate authorization.

## 8. Ambiguities and interpretations

No material behavioral ambiguity identified. The package explicitly assigns cross-iteration ledger persistence and unsupported current-policy replay detection to the orchestrator rather than claiming existing replay tools implement them. Tool schemas and external runner contracts remain prerequisites to execution, not inferred schemas from this explanation.
