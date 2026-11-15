# Explanation from readable_i2_a for comprehension

## 1. Outcome and scope

Improve one target AI through paired evaluation; deliver accepted source, verified results and history, including unchanged acceptance. Optional: opponents, limits, checkpoint. Preserve decks, engine, legality and hidden information. Use `session-typescript/v1`, project tools, default `gpt-6.1-sol`/low. Delegate diagnosis only; orchestrator implements.

## 2. Process overview

Prepare, evaluate baseline, decide, analyze, replay isolated corrections, assemble and repeat. Analyze even final evaluations. Decision ceiling or no qualifying rule permits delivery; exhaustion suspends. Controller prints transitions; tools persist checkpoints; orchestrator verifies gates. Streaming review cannot bypass evaluation/promotion requirements.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Target identified | Orchestrator setup, source archive, policy and calibration | Calibration separate | Valid setup; both recommendations | Frozen config, cohorts | Evaluate |
| Evaluate | Bound valid source | Tools run/reuse paired matches | Saved match pool; four games sequential | All scheduled matches finalized; accounting verified | Logs, results, difference | Decide |
| Decide | Evaluation complete | Orchestrator verifies; tools persist/archive | Serialized | Baseline or strict improvement | Outcome, commit, history | Analyze |
| Analyze | Loss publication | Fresh subagent per complete readable loss; queue validates findings | Bounded runtime/RAM slots | Required full or explicitly selected coverage; source-bound report | Per-loss findings, merged reasons | Deliver or Replay |
| Replay | Eligible/pending reasons | Orchestrator implements isolated variants, runs controls/takeovers | Measured replay pool | All settle; ≥5/≥5% intended-choice win conversions | Current-source rule ledger | Assemble if passing; otherwise Deliver |
| Assemble | Passing edits | Combine; revalidate materially changed logic | Isolated work | Valid frozen candidate; no extra combined replay gate | Hash, rules, history | Evaluate |
| Deliver | Legitimate completion | Verify, rank, export, check consolidation | No new games | Accurate status/evidence | Report/export | Closed |

## 4. Identities and invariants

| Item | Initial value | Changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Comparison | Frozen configuration/order | Accepted comparator advances | Starting self-opponent, schedules, seeds, engine/content/runner identities | Hashes and paired intersections |
| Rates | Completed games; draws zero wins | Ignore finalized incidents symmetrically | Equal opponent weighting; each opponent needs a pair | No intervals; incomparable unassessable |
| Source mode | Accepted AI ordinarily | Regression repair uses regressing candidate; remove/update one rule, add none | Separate source identities | Source binding |
| Pending rule | Stable reason/rule IDs and semantic hash | Explicit alias reconciliation; new correction gets new identity | Provenance/cases | Fresh current-source controls; prefixes cannot force old policy |

## 5. Limits and accounting

| Resource/stage | Default | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/matches | 50 decisions; 250 total four-game matches | Owner limits | Baseline excluded from decisions; divide matches evenly, ordered remainder | Ceiling after analysis → Deliver |
| Evaluation games | `(1 + effective decisions) × matches × 4`; recovery floor 10% | Frozen setup | Failed/interrupted attempts count; reuse costs none | Recovery exhausted: ignore interrupted remainder |
| Time/storage | 24h; 50GB, internal 16MB control reserve | Explicit continuation, complete effective limits | Original start includes downtime; logical/import bytes; locked reservations | Suspend; block data writes |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay 5m; shutdown 60s | Effective config; remaining wall caps | Includes prefix | Incident policy |
| Calibration | Worker counts 2..logical CPUs | Usable local recommendation reused across versions | Repetitions/exclusions retained | No qualifier stops |
| Pending cases | 300 distinct per reason/rule | No extensions | Retest all current-source cases; repeated executions add no cases | Valid cap failure discards; otherwise pending/blocked |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Bug report, finalized ignore | Never retry | Reason and paired exclusion | Other safe jobs continue |
| Interrupted evaluation | Recover missing work | Remaining recovery allowance | Reservations/attempts | Deadlines/resources permit |
| Calibration stage failure | Fresh directory | One retry, then count exclusion | Both attempts | Other counts continue |
| Unsupported pre-admission package | Adapt tooling only | Fresh validation | Failure/checks | Protected boundaries valid |
| Integrity/init/sideboard/non-timeout failure | Stop unsafe work | No generic retry | Diagnostics | Resolve; ask owner if unresolved |
| Exhaustion/pause/analyst failure | Stop admission; bounded owned shutdown, settle/checkpoint | No implicit extension | Claims, uncovered losses, budgets | Explicit continuation; owner-stop authorization |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State/report | Identities, all evaluated versions, rates, dispositions, accounting, errors, pending status | Run state and report | Durable consolidation | Checked closure |
| Evidence | Typed logs, readable losses/maps, replay traces, receipts, immutable variants | Campaign paths | Until unnecessary; pending dependencies survive | Tool pruning; accepted until replaced/closed; suspension retains |
| History/export | Starting/evaluated commits, including rejections; accepted export/hash | Git, English history, export | After closure | Unevaluated variants temporary; no permanent source copies |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Controller command | Example names canonical sibling rather than candidate package | Use active package policy without assuming sibling equivalence | Verify controller path before execution | If independent |
| A2 | Pending ledger | Ledger schema/path unspecified; tooling incomplete | Durable generated state with specified bindings | Persist before replay | Discover |
| A3 | Loss review vs partial policies | Every loss language coexists with explicit sample/two-pass | Individually review selected losses; label partial | No false full-coverage claim | No |
