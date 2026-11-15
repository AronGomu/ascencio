# Explanation from review-a for fresh candidate comprehension

## 1. Outcome and scope

Given a target `ai-bot`, optional opponents, owner overrides and possibly a compatible checkpoint, I would seek strictly higher equally weighted paired-game win rate while changing only target AI. Completion delivers the accepted source, verified results and compact attempt history, including an honest unchanged outcome when nothing qualifies. Decks, engine, legality, hidden information and frozen opponents are protected; the initial AI is always an opponent. Push, publication and merge need separate authorization.

## 2. Process overview

I would drive the stateless controller one stage at a time while owning project tools persist work: Prepare → Evaluate → Decide → Analyze → Replay → Assemble → Evaluate. Baseline establishes acceptance without consuming a candidate decision. Every evaluated candidate, including the final or rejected one, is analyzed before continuation or delivery. The decision ceiling or no qualifying replay edit ends the loop; resource/owner incidents suspend it. Slice preparation and declared analysis may overlap evaluation, but global consolidation waits for evaluation and decision, and no exploratory work bypasses replay or promotion gates.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved target/checkpoint | Orchestrator reads contracts/defaults, inspects owning schemas, sets up frozen session, archives initial source, pins limits/policy/schedule and both worker recommendations | Calibration separate from evaluation/analysis | Current runner/setup valid; both recommendations usable; admission feasible | Configuration, source bindings, calibration provenance | Evaluate |
| Evaluate | Exact validated frozen source | Project tools bind accepted control and paired inputs; reuse compatible evidence or execute missing matches | Saved match workers; four games and sideboarding sequential per match; declared pipeline envelopes | Every scheduled match finalized, reservations settled, integrity/resources verified, paired difference saved | Typed logs, receipts, results and finalized slices | Decide |
| Decide | Complete baseline/candidate results | Orchestrator verifies strict paired improvement; tools persist decision, commit evaluated candidate and update history | One transaction at a time | Valid higher weighted rate accepts; tie/regression/unassessable retains accepted; baseline consumes no decision | Decision/checkpoint, full SHA and history | Analyze |
| Analyze | Allowlisted finalized target losses | Fresh subagent for each whole readable loss; one queue submission with primary and supported secondary reasons; coordinator validates and merges match reports | Queue within actual analyst slots, RAM and storage; slices only publication batches | Selected explicit policy covered and labeled; default every loss reviewed exactly once; source-bound report complete | Readable files/maps, findings, coverage, report and durable reasons | Deliver at ceiling; otherwise Replay |
| Replay | Analysis complete, authorized resources | Orchestrator implements isolated rules, reconciles aliases, updates ledger and runs every associated accumulated case with fresh unchanged-current-source control | Measured bounded replay workers; wait for all reason jobs | At least 5 changed-choice winning conversions AND 5% of associated cases; all cases settled; blocked reconstruction cannot count as rejection | Immutable hashes, controls/takeovers, pending/validated/blocked/discarded results | Assemble if any pass; otherwise Deliver |
| Assemble | Passing isolated rules | Orchestrator combines all passing edits from correct mode base; resolves overlaps and validates/freezes candidate | No unvalidated concurrent source mutation | Materially changed logic re-passes isolated gate; no separate combined-rule gate | Attribution/history with rules, hash, base and replay references; no proposal.md | Evaluate |
| Deliver | Authorized terminal branch | Verify analyses/decisions, rank comparable existing evidence, export accepted source, check consolidated report, then eligible cleanup | No fresh ranking games | Honest status, verified export and retention obligations satisfied | Checked report, export/hash and compact history | Closed |
| Suspend/resume | Incident / authorized continuation | Stop admission and owned work; settle, checkpoint and report; verify checkpoint before resuming prior stage | Bounded owned shutdown only | Applicable explicit authorization and remaining/increased budgets | Pending jobs/coverage, reservations, identities, budgets, stop reason | Suspended / prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Evaluation identity | Pinned sources, engine/content/runner/comparison, opponents and schedule | Accepted comparator moves after promotion | Frozen opponents, initial self-opponent, paired orders/seeds/sides/rules; stable-ID randomness | Hashes and exact compatibility before reuse; completed paired intersections |
| Scoring | Completed nonignored games | Finalized ignore removes corresponding game from both sides | Draws denominator/zero wins; equal opponent weights; every scheduled opponent has a pair; strict improvement only | Independently check aggregate rather than confidence/match diagnostics |
| Ordinary source | Current accepted commit | Add one fix per isolated variant | Accepted analysis/replay/assembly base and comparator | Separate accepted commit from HEAD and rejected commits |
| Regression repair | Valid lower-rate candidate | Remove/update one existing rule, add none | Regressing source for analysis/control/assembly, unedited rules preserved; accepted comparator | New-loss metadata only; analysts still read candidate losses only |
| Pending rule | Stable reason/rule IDs, semantic hash, explicit aliases and provenance | Reconcile aliases explicitly; different correction gets new identity | Original loss inputs/hashes/decisions, failed history; current-source results cannot reuse historical outcomes | Fresh control and rule branch; verify reconstruction and legal applicability |
| Logs/review | Lossless typed .log and generated readable projection | In-memory reconstruction; tool-generated metadata JSON | Target-only completed-loss allowlist; unknowns remain unknown; no opponent/winning gameplay review | Choice-map exact IDs and source/report hashes |
| Tool vocabulary | campaign / round / incumbent and existing paths/keys | None silently | Current session-typescript/v1 only | Fresh run for incompatible legacy checkpoint; controller does not execute/persist gates itself |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/matches | 50 decisions; 250 total four-game matches per evaluation | Pin owner values in effective setup; matchesPerOpponent unset | Candidate persisted decisions only; allocate floor plus remainder in frozen opponent order, at least one each | Ceiling still requires final analysis; then deliver |
| Evaluation games | (1 + effective decisions) × matches × 4, plus floor(10% planned) recovery | Pin both and sum | Failed/interrupted reservations and recovery count; cached reuse costs zero; planned/recovery separate | Interrupted remainder ignored after recovery allowance, no extra-game request |
| Wall/storage | 24h from original start; 50GB logical bytes | Explicit continuation preserves start/consumption; full effective limits; writer-lock gate update protocol | Downtime counts; staging/log/import/evidence count; 16MB control reserve inside cap; shared reservations and settlement | Suspend; no ranking/export/analysis/closure cleanup |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay branch incl. prefix 5m; shutdown grace 60s | Resolved stage limits capped by wall remainder | Launch-to-exit; controls, takeovers and diagnostics consume time/storage | Apply corresponding incident, terminate only owned groups after grace |
| Calibration | Every count 2..logical CPUs measured or policy-excluded | Reuse readable local positive integer within CPUs; path is key, source/version changes do not invalidate | Match designated repetitions; replay two reps/full largest-stage batch, identical outcomes, smallest within 3% fastest median | Missing qualifier stops preparation; no invented single-worker fallback |
| Rule cases | Max 300 distinct first-seen losses per reason/rule; eligibility ≥5 losses globally | Pending does not grant budgets/iterations | Repeated executions do not add cases; replay every associated loss; timeout denominator/nonconversion | Below threshold under cap pending; valid complete below threshold at cap proven-discarded |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual game/replay timeout | Bug report; finalize ignored; continue safe work | Never retry case | Timeout and paired exclusions / replay denominator | No interrupted-work retry |
| Interrupted evaluation | Preserve verified work, settle attempts and recover missing work | Within explicit 10% allowance only | All reservations, completions and timeouts | Remaining deadlines/resources |
| Calibration failed count stage | Fresh directory, same pinned inputs | One retry; second excludes count/repetitions | attempts.json, both attempts, exclusions | Same exact identity for unfinished-stage resume |
| Unsupported format pre-admission | Preserve failure; adapt only build/validation tools; related checks and fresh validation | No game charge; stop if still invalid | Validation evidence | Protected boundaries intact |
| Integrity/input-prefix issue | Solve; ask owner if unsolvable | No generic automatic replay retry | Failure and diagnostics | Verified safe repair; never convert unsafe state to ignored |
| Initialization/sideboard/other non-timeout validation failure | Stop | None generic | Evidence and checkpoint | Incident authorization/safe resolution |
| Exhaustion, owner stop, analyst execution failure | Stop admission/owned work, settle/cancel and checkpoint | No automatic extension | Claims, uncovered losses, sources, pending jobs and budgets | Applicable explicit instruction on same verified checkpoint; full effective limits for increase |
| Unreconstructable current-policy accumulated case | Retain blocked rule with diagnostics | No fabricated outcome | Original provenance and current binding | Exact current-source replay established |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State/checkpoints | Configuration, identities, decisions, receipts/accounting | run.json; iterations/iteration-N/iteration.json | Durable compact record | Consolidate through owning tools |
| Source versions/history | Initial and every evaluated accepted/rejected candidate; intended bot/history changes only; stable IDs/trailers/full SHAs | Git main initial archive; improvement-history.md; export/hash | After closure | Unevaluated variants temporary hashes; recover commit journal rather than duplicate |
| Execution/review/replay evidence | Logs, readable losses/maps, exact decisions, reports, source packages, receipts and immutable variants | Existing game/match/evaluation paths | All execution, validation, replay, reuse and resume needs end; accepted additionally replacement/closure | Designated eligible pruning only; delivery alone insufficient; pending evidence overrides ordinary pruning |
| Pending/failed rules | Every reason including singleton; original evidence, aliases, rule hashes, counts and outcomes | Durable cross-iteration ledger / failed-rule history | Compatible authorized continuation; failed history permanent | No inherited stack from discarded campaign without authorization |
| Run report | Identities/config/times/status; each version W/L/D/rates/difference/outcome; rule aggregate counts; coverage, budgets/errors, accepted source/export/ranking and unresolved issues | Project/artifacts, linked shared policy and pinned config | After closure | Checked consolidation before eligible temporary removal; summary-only closed run cannot provide cached evidence |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Controller example command | Candidate package is suffixed but command names canonical skill path | This explanation describes candidate semantics; real execution must invoke the intended installed controller/package rather than accidentally another version | Verify installation/path before dispatch; do not assume command points to this candidate | Only if installation intent remains unresolved |
| A2 | Incident policy integrity preamble vs stop row | “Solve issue” could imply immediate recovery despite generic stop | Stop unsafe execution first; preserve evidence, diagnose and resolve without generic retry, ask if unsolvable | No ignored integrity failures or invented automatic replay allowance | If safe continuation authority cannot be established |
| A3 | Pending accumulation vs Replay none → Deliver | Pending entries need later iterations but no passing edit leads delivery | Pending accumulation applies only to otherwise authorized subsequent iterations or explicitly compatible continuation | No empty candidate or automatic extra iteration to grow pending cases | No |
