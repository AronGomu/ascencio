# Explanation from reviewer B for fresh comprehension

## 1. Outcome and scope

Improve one `ai-bot` against frozen opponents including its starting AI. Deliver accepted source, paired results and history; unchanged acceptance is legitimate. Preserve decks, engine, legality and information boundaries. Require `session-typescript/v1`; default model is GPT-6.1 Sol/low.

## 2. Process overview

Prepare frozen configuration and match/replay recommendations. Evaluate, decide against accepted control, then analyze even rejected/final evaluations. Review losses individually, replay isolated corrections and assemble passing edits. Stop at decision ceiling/no edit; resources suspend. Controller prints transitions; tools persist state; orchestrator verifies gates.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved bot/checkpoint | Discover schemas, setup, calibrate if needed | Calibration excludes evaluation/analysis | Verified setup and recommendations | Configuration, source commit, measurements | Evaluate |
| Evaluate | Frozen baseline/candidate | Bind controls/schedule; reuse or run matches | Saved workers; games sequential; admitted pipeline | Finalized matches, settled reservations, verified evidence | Logs, receipts, paired difference | Decide |
| Decide | Completed comparable evidence | Verify strict improvement; persist decision | Serial | Baseline reference; valid strict improvement promotes | Evaluated-version commit, history, checkpoint | Analyze |
| Analyze | Finalized target losses | Fresh subagent per loss; consolidate all findings | Declared slots; one publication batch | Required coverage/report complete | Per-loss queue, match reports, evaluation report | Deliver at ceiling; otherwise Replay |
| Replay | Analysis complete, resources available | Implement isolated rules; reconcile ledger; replay | Measured replay pool, resource admission | All settled; five wins AND 5%, choice changed | Immutable hashes, current-source outcomes, ledger | Assemble if any pass; otherwise Deliver |
| Assemble | Validated rules | Combine; changed logic repeats gate | No extra combined-rule gate | Validated frozen target-only candidate | Candidate hash/history with rule attribution | Evaluate |
| Deliver | Required analyses finished | Rank results, export, verify report | No fresh games | Checked consolidation/cleanup | Export/hash and report | Closed |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Evaluation | Pinned commits/hashes, seed, engine/content/runner, ordered opponents | Accepted comparator advances after promotion | Paired starting orders, seeds, sides, rules, schedule | Identity/integrity; paired intersections |
| Scoring | Completed non-ignored games | Valid paired coverage grows | Draws count zero wins; equal opponent weights; one completed pair each | Rates/differences/ignores/coverage; no confidence intervals |
| Pending ledger | Stable reason/rule identities and original cases | Explicit alias reconciliation; distinct corrections get new IDs | Provenance, order, current-source retesting | Reconstruction/legal-address/choice-applicability checks |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/evaluation | 50 decisions; 250 four-game matches | Pin owner values; leave matchesPerOpponent unset | Baseline excluded from decisions; distribute quotient/remainder by frozen order | Final analysis, then delivery |
| Games | Planned = (1 + effective decisions) × matches × 4; recovery floor 10% | No implicit extension | Failed/interrupted reservations count; caches add none | Ignore unrecovered interrupted games after allowance |
| Time/storage | 24h; 50GB, including protected 16MB reserve | Explicit complete-limit continuation | Downtime and logical bytes count; locked reservations | Suspend admission and data writes |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay branch 5m; shutdown 60s | Resolved configuration, remaining-wall cap | Launch to exit, including replay prefix | Incident handling |
| Calibration | Counts 2..logical CPUs | Saved usable local counts survive identity changes | Match designated repetitions; replay two, smallest within 3% fastest median | No qualifying count stops Prepare |
| Pending cases | 300 distinct losses per reason/rule | No extra budgets | Retest stack against current source | Valid failure at cap proves discard |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report; finalize ignored, exclude both paired sides | Never retry case | Incident/outcome | Continue safe jobs |
| Interrupted evaluation | Preserve completion, account reservations | Recovery allowance only | Attempts/checkpoint | Remaining deadlines/resources |
| Calibration-stage failure | Fresh evidence directory | One retry, then exclude count | Both attempts/exclusions | Other counts may proceed |
| Integrity/initialization/other validation failure | Stop unsafe work | No generic retry | Diagnostics | Resolved incident authorization |
| Resource/owner/analyst stop | Stop owned jobs, bounded shutdown, settle and checkpoint | No implicit continuation | Claims, uncovered losses, budgets, identities | Explicit applicable authorization; sufficient limits |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Durable state/history | Configuration/accounting; evaluated commits; English attempts | Existing run state, Git/history | After closure | Preserve compact history |
| Temporary evidence | Logs, projections/maps, reports, replay branches, packages | Existing game/analysis paths | Needs end; accepted until replacement/closure | Designated eligible pruning; pending evidence overrides |
| Report/export | Identities, results, rules, coverage, budgets/errors, ranking, accepted commit/path/hash | Project or artifacts | Permanent compact delivery | Checked closure only; suspension forbids cleanup |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Pending retention / Replay none | “Every subsequent iteration” versus immediate delivery when none pass | Retest during otherwise authorized iterations; no empty candidates or extra iterations | Pending rules can survive delivery without another immediate attempt | No |
| A2 | Pending performance note | Existing tools do not implement cross-iteration ledger | Orchestrator must supply durable bindings and verification without inventing schema/tool support | Unsupported current-policy reconstruction becomes blocked evidence | Implementation schema discovery required |
