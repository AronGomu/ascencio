# Explanation from reviewer 2 for independent workflow comprehension

## 1. Outcome and scope

Improve one required `ai-bot` against frozen starting self-opponent plus optional opponents; deliver accepted source, verified game results and history, honestly unchanged if nothing qualifies. Only target AI changes; decks, engine, legality and information boundaries remain protected. Owner limits/checkpoint are optional inputs subject to compatibility.

## 2. Process overview

Prepare once; evaluate baseline, decide, then analyze. Replay isolated eligible edits, assemble passing edits and repeat evaluation. Always analyze the final evaluation. Decision ceiling or no qualifying edit leads to delivery; exhaustion/stop suspends. Orchestrator implements; delegated analysts diagnose only.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Inputs resolved | Orchestrator setup, archive starting source, calibrate both pools | Calibration excludes evaluation/analysis | Compatible frozen setup, matching recommendations, slice plan | Configuration/checkpoint/calibration | Evaluate |
| Evaluate | Frozen baseline/candidate | Owning tools validate, bind, reuse or execute | Saved match optimum; four games/sideboarding sequential | Every match finalized, reservations settled, evidence/coverage verified | Logs/results/paired difference | Decide |
| Decide | Completed evaluation | Verify strict weighted paired improvement; persist decision, commit evaluated candidate/history | Serialized publication | Baseline reference or accepted/rejected candidate recorded | Commit/decision/history | Analyze |
| Analyze | Settled evaluation | Slice owners inspect allowlisted target losses; orchestrator merges | One owner per consecutive 250-match slice, queued for slots | Exactly-once complete loss coverage, source-bound report | Per-match findings/final analysis | Replay; ceiling → Deliver |
| Replay | Eligible reasons/history checked | Orchestrator creates immutable isolated variants, replays every associated loss | Saved replay optimum | All cases settled; ≥5 and ≥5% convert to wins with intended choice changed | Hashes/control/takeover evidence | Passing → Assemble; none → Deliver |
| Assemble | Passing edits | Combine from mode base; preserve semantics/attribution, validate/freeze | No specified parallelism | Changed isolated logic revalidated; history bindings saved | Candidate/history; no proposal | Evaluate |
| Deliver | Authorized normal termination | Verify, rank existing comparisons, export/check report, eligible cleanup | No new games | Checked consolidation | Export/report | Closed |
| Suspended | Active-stage stop | Shutdown owned work, settle/checkpoint/report | Grace-bounded shutdown | Explicit authorization and verified checkpoint/limits for resume | Resumable state | Prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Execution | Pinned configuration/sources/runtime/schedule | Matching reuse only | Paired starting inputs, IDs/randomness, opponents/order | Hashes, receipts, integrity |
| Source mode | Accepted reference separate from HEAD | Ordinary adds one fix from accepted; valid regression removes/updates one rule from regressing source | Repair unedited rules; comparator always accepted | Record accepted, analysis/replay and assembly identities |
| Scoring | Completed nonignored games | Accepted moves only on strict improvement | Equal opponent weights; draws zero wins; paired ignores excluded both sides; each opponent paired | Coverage/provenance/executed/reused counts; no confidence intervals |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/evaluation | 50 decisions; 2,500 four-game matches | Pin owner values; require ≥one match/opponent | Baseline excluded decisions; floor/remainder allocation; planned games=(1+decisions)×matches×4; recovery=floor(10%) | Ceiling after analysis; exhausted recovery ignores remaining interrupted games |
| Time/storage | 86,400,000 ms; 50,000,000,000 bytes | Explicit effective limits; preserve consumption/start | Downtime counts; logical bytes/imports; protected 16,000,000-byte control reserve | Suspend; explicit continuation |
| Deadlines | Evaluation 18,000,000; preparation 600,000; validation/replay 300,000; shutdown 60,000 ms | Resolve branches, cap by remaining wall | Launch-to-exit including prefix | Incident policy |
| Calibration/replays | Workers 2…logical CPUs; replay two repetitions | Matching recommendations only | Separate diagnostics; no rule-replay game quota; all time/bytes count | No qualifying calibration stops Prepare |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report, finalize ignored; never conversion | None | Outcome/reason | Safe jobs continue |
| Interrupted evaluation | Recover missing work | Within recovery allowance | Attempts/reservations/completions | Deadlines/resources hold |
| Calibration stage failure | Fresh evidence, same inputs | Once; second excludes count | Both attempts/retry state | Other counts qualify |
| Unsupported pre-admission package | Tooling-only adaptation/checks | Fresh validation; no game charge | Failed validation | Valid protected boundaries |
| Integrity/prefix, initialization, sideboarding, other validation failure | Stop | No generic retry | Exact failure/checkpoint | Applicable authorized recovery |
| Exhaustion/pause/cancel/analyst failure | Stop admission/owned work; settle | No implicit increase/reassignment | Claims, uncovered losses, identities/budgets | Explicit verified continuation; quota marker blocks data writes |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State/history/report/export | Identities, configuration, versions/results, rule totals, coverage/accounting/errors, accepted SHA/hash, status | Existing run/iteration JSON; Git; English history; project/artifacts report | After closure | Compact retained; tools generate JSON |
| Temporary evidence | Typed lossless logs, findings, replay traces, schedules, packages/receipts | Existing game/analysis/run paths | All execution/validation/replay/reuse/resume needs end; accepted additionally replacement/closure | Designated pruning after summaries; owner retention wins; suspension forbids closure cleanup |
| Source | Every evaluated version, including rejection | Git helper journal/immutable IDs | Permanent history | Unevaluated variants temporary; no permanent source copies; summary-only closure cannot provide cached evidence |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Controller implementation / workflow gates | CLI could appear authoritative | Dispatcher validates stage/event syntax and prints policy/task only; resume accepts a named active stage without checking authorization | Caller verifies semantic gates, authorization and checkpoint; project tools own locks, accounting/publication; no CLI state persistence | No |
