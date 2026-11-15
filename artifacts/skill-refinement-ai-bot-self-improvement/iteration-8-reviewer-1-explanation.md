# Explanation from reviewer 1 for independent workflow interpretation

## 1. Outcome and scope

Improve one required `ai-bot` against frozen opponents (optional additional packages), delivering accepted source, verified paired-game results and compact history. Honest unchanged completion qualifies. Modify target AI only; publication requires separate authorization. Compatible checkpoints and owner limits are optional inputs.

## 2. Process overview

Prepare → Evaluate → Decide → Analyze → Replay → Assemble loops through candidates. Final analysis precedes delivery; no passing replay permits early delivery. Incidents can suspend any active stage. The orchestrator implements; delegated analysts diagnose only.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved inputs | Orchestrator setup, archive, validate, calibrate | Separate pools; no evaluation/analysis overlap | Both matching recommendations | Configuration, identities, reports | Evaluate |
| Evaluate | Frozen validated source | Tools reuse compatible evidence/run missing matches | Measured match workers; four games/sideboarding sequential | All scheduled matches finalized, reservations settled | Logs, coverage, paired difference | Decide |
| Decide | Verified evaluation | Orchestrator verifies strict improvement; tools persist/archive | One transaction | Baseline reference or candidate decision | Commit, history, checkpoint | Analyze |
| Analyze | Settled evaluation | Slice owners inspect every target loss; orchestrator merges | One owner per consecutive 250-match slice; queue for slots | Complete source-bound report | Findings, reasons, replay points | Deliver at ceiling; otherwise Replay |
| Replay | Complete analysis | Orchestrator implements isolated edits, replays all associated losses | Measured replay workers, resource bounded | Every case settled; qualifying edits | Hashes, controls/takeovers, outcomes | Assemble or Deliver |
| Assemble | Passing edits | Combine preserving semantics; revalidate materially changed logic | Orchestrator | Valid frozen candidate | Rule attribution/history; no proposal.md | Evaluate |
| Deliver | Eligible completion | Rank existing results, export, verify report, eligible cleanup | Tools | Required analyses/decisions checked | Export/report | Closed |
| Suspended | Stop/incident | Owned shutdown, settle, checkpoint/report | No admission | Authorized verified continuation | Pending work/budgets | Prior stage |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Comparison | Starting AI self-opponent plus ordered opponents | Accepted control moves | Opponents; engine/content/runner; paired seeds/orders/sides | Hashes, bindings, integrity |
| Source modes | Accepted source | Ordinary adds one fix; valid regression removes/updates one rule on regressing source | Comparator accepted; repair preserves other rules | Separate accepted/replay/base identities |
| Evidence | Typed lossless logs | Target-loss projections for analysts | Hidden-information boundaries; exact IDs | Allowlists, receipts, hashes |
| Scoring | Completed paired intersections | Ignore either side on both | Equal opponent weights; draws denominator; every opponent paired | Strict higher weighted rate only; no confidence intervals |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/evaluation | 50 decisions; 2,500 four-game matches/evaluation | Pin owner values | Floor/remainder allocation; baseline excluded from decisions; planned games=(1+decisions)×matches×4; recovery=floor(10%) | Analyze final decision; recovery exhaustion ignores remaining interrupted games |
| Time/storage | 86,400,000 ms; 50,000,000,000 bytes | Explicit continuation; preserve consumption/start | Includes downtime, diagnostics/imports; protected 16,000,000-byte control reserve | Suspend; no export/ranking/cleanup |
| Deadlines | Evaluation 18,000,000; preparation 600,000; validation/replay 300,000; shutdown 60,000 ms | Resolved effective values | Launch-to-exit including prefix; wall cap | Incident policy |
| Calibration/replays | Workers 2…logical CPUs; replay two repetitions | Matching recommendation reuse | Replay optimum smallest within 3% fastest median; no rule-replay game quota | Below two CPUs/no qualifier stops |
| Rule gate | ≥5 distinct supported losses | None stated | Convert ≥5 AND ≥5% associated losses; intended choice changes | Exclude failing edits |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report; ignored, never conversion; replay denominator retained | Never | Outcome/reason | Continue safe work |
| Interrupted evaluation | Recover missing work | Recovery allowance only | Attempts/reservations/completions | Resources/deadlines |
| Calibration failure | Fresh directory, same inputs | Once per failed count-stage; then exclude | Both attempts/exclusions | Qualifying measurements |
| Unsupported package pre-admission | Adapt build/validation only | Fresh validation; no game charge | Failure | Valid protected boundaries |
| Integrity/initialization/sideboarding/other validation failure | Stop | No generic retry | Full checkpoint | Applicable authorization |
| Owner stop/analyst failure | Stop owned work, terminate after grace | Explicit continuation | Claims/uncovered losses | Same verified checkpoint, no duplicate owners |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State/history/report/export | Identities, versions, results, rules, accounting, status/errors, accepted hash | Existing run paths; Git; English history; project/artifacts report | Beyond closure | Compact permanent record |
| Execution detail | Logs, analyses, replay traces, immutable variants, receipts/packages | Existing evaluation paths | All execution/validation/reuse/resume needs end; accepted until replacement/closure | Checked summaries/decisions; owner retention wins; suspension forbids cleanup |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Controller/tools | “Controller” could imply enforcement | Script only validates transition vocabulary and prints inherited/stage text; resume accepts an active-stage name | No execution, state, semantic gate or authorization verification; owning tools/caller enforce these | No |
| A2 | Mandatory external contracts | Package links schemas/runner details not included | Do not infer unavailable operational interfaces | Read owning entry points before actual dispatch; this explanation cannot certify them | At execution if unresolved |
