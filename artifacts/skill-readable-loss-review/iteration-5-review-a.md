# Explanation from reviewer A for fresh execution comprehension

## 1. Outcome and scope

Improve one supplied target AI package against frozen opponents, including its starting self-opponent, and deliver accepted source, verified paired results and compact history. Change only target AI, preserving decks, engine, legality and information boundaries. No qualifying edit leaves source unchanged; incomplete closure remains incomplete.

## 2. Process overview

Prepare reproducible setup and separate worker recommendations; evaluate baseline, decide, then analyze losses. Replay isolated corrections, assemble passing edits, evaluate the combination, decide and analyze again, including the final evaluation. Owning tools persist state; the controller prints transitions. The orchestrator implements edits and verifies semantic gates, delegating diagnosis only. Slice analysis can overlap evaluation through configured envelopes.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Valid inputs | Orchestrator freezes setup, validates, calibrates | Calibration isolated | Both recommendations and setup verified | Configuration, initial commit | Evaluate |
| Evaluate | Frozen source | Tools run/reuse paired schedule | Matches parallel; four games/sideboarding sequential | All scheduled work finalized and settled | Logs, rates, paired difference | Decide |
| Decide | Verified comparison | Orchestrator checks strict improvement; tool persists | Serial | Baseline reference or candidate outcome archived | Decision, candidate commit/history | Analyze |
| Analyze | Completed target losses | Fresh subagent per whole readable loss; queue validates findings | Bounded runtime/RAM slots | Required full or explicitly selected coverage complete | Per-match findings, source-bound report | Replay or Deliver at ceiling |
| Replay | Source mode selected | Orchestrator tests each isolated rule | Measured replay pool | Every associated case settles; qualifying rule exists | Controls/takeovers, ledger | Assemble; otherwise Deliver |
| Assemble | Passing rules | Combine, resolve overlap, validate/freeze | Serial binding | Changed isolated semantics revalidated | Candidate hash/history | Evaluate |
| Deliver | Authorized completion | Rank existing comparisons, export, check report | No fresh games | Consolidation verified | Export and report | Closed |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Experiment | Setup seed, opponent order, source/engine/content/runner hashes | Explicit compatible continuation | Paired starting inputs, schedule, randomness IDs | Identity/hash checks before reuse |
| Source mode | Ordinary accepted source | Valid regression uses regressing candidate for analysis/control/assembly | Promotion comparator remains accepted | Separate accepted, analysis and assembly bindings |
| Rule operation | Ordinary adds one fix | Regression removes/updates one existing rule, adds none | Unedited repair rules | Isolated hashes and attribution |
| Scoring | Wins/completed nonignored games | Paired intersections exclude either-side ignores | Draws count as zero wins; opponents equally weighted | Every opponent has completed pair; unresolved mismatch unassessable |
| Promotion | Accepted reference | Strictly higher valid weighted paired rate only | Ties/regressions/unassessable retain source | Independent check before decision tool |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Evaluation | 50 decisions; 250 matches/evaluation | Pin owner values | Baseline plus 50 = 51 evaluations; 51×250×4 = 51,000 planned games; floor(10%) = 5,100 recovery; total 56,100 | Analyze last decision; no forced empty candidate |
| Schedule | 1,000 games/evaluation | Total matches divided over opponents | Floor(250/opponents), first remainder get one extra; require one each | Invalid allocation blocks |
| Time/storage | 24 hours; 50,000,000,000 bytes | Explicit full-limits continuation | Original start includes downtime; 16,000,000 protected reserve leaves 49,984,000,000 data bytes | Suspend admission |
| Deadlines | Evaluation 5h; preparation 10m; validation/replay branch 5m; shutdown 60s | Effective configured values | Launch-to-exit, replay prefix included, capped by remaining wall time | Incident-specific handling |
| Replay/calibration | No rule-replay game quota | No implicit budget extension | Controls, takeovers, diagnostics consume time/storage separately; caches add no executed games | Suspend when shared limits end |

Calibration reuses readable positive-integer local match/replay files within CPU count regardless of source/version changes. Missing/unusable files trigger measurement across counts 2 through logical CPUs, with documented exclusions. Replay requires two repetitions, sufficient independent largest-stage batches, identical outcomes, and smallest count within 3% of fastest successful median. Fewer than two CPUs or no qualifier stops preparation.

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Report, finalize ignored; evaluation excludes both paired sides | Never retry case | Timeout/accounting | Continue safe jobs |
| Interrupted evaluation | Preserve completions/reservations | Only 5,100 default recovery allowance | Attempts/checkpoint | Remaining deadlines/resources; otherwise ignore interrupted remainder |
| Failed calibration stage | Fresh evidence directory | One retry, then exclude count | Both attempts/exclusions | Same identity/output resume |
| Integrity/non-timeout failure | Stop unsafe execution | No generic replay retry | Logs and diagnostics | Resolved applicable incident |
| Resource or owner/analyst stop | Stop owned work, bounded shutdown, settle | No automatic extension | Claims, uncovered losses, budgets | Explicit compatible continuation |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| Pending ledger | Stable reason/rule IDs, reconciled aliases, source hashes, original cases and current outcomes | Durable cross-iteration state | Compatible future continuation | Overrides ordinary failed-rule exclusions/pruning |
| Replay evidence | Every associated loss at primary critical decision | Immutable variant/evidence directories | Validation/reuse/resume needs end | Eligible lifecycle pruning only |
| Versions/report | All evaluated commits, accepted export/hash, rates, coverage, attempts and budgets | Git, history, existing state/report | After closure | Temporary detail only after checked consolidation |

Eligibility starts at five distinct losses globally. Retest accumulated cases against current analysis source, with fresh controls; historical forced prefixes are insufficient. Require five converted wins AND 5% with intended choice changed. Ignored timeouts remain denominator nonconversions. Below threshold remains pending; at 300 distinct first-seen cases, complete valid below-threshold replay proves only that exact rule discarded. Blocked reconstruction or exhaustion never does. Accepted detail lasts until replacement/closure; rejected detail can prune earlier only after all needs end. Suspension forbids closure cleanup.

## 8. Ambiguities and interpretations

No ambiguity identified. Full review means every readable loss file, preserving unknowns and exact choices; explicit sampled review changes coverage labels only, never paired evaluation authority. Authoritative typed lossless logs remain separate programmatic replay evidence, with target-loss allowlists.
