# Explanation from reviewer B for readable-loss improvement execution

## 1. Outcome and scope

Improve one `ai-bot` through paired games; deliver accepted source, verified results and history, honestly reporting unchanged outcomes. Freeze opponents, including baseline. Modify target AI only; protect decks, engine, legality and hidden information. Checkpoints require compatibility; publishing requires authorization.

## 2. Process overview

Freeze inputs, obtain both concurrency recommendations, evaluate baseline, then decide/analyze each version. Replay isolated rules; assemble passing edits and reevaluate. Controller routes; tools persist; orchestrator verifies and implements. Analyze final decisions; resource stops override progression.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | Resolved target | Orchestrator uses setup, validation and calibration tools; pins policy | Calibration separate from evaluation/analysis | Setup and both recommendations verified | Configuration, frozen sources | Evaluate |
| Evaluate | Source | Tools reuse verified compatible results or execute missing matches | Optimal match workers; four games/sideboarding sequential | Matches finalized; reservations settled | Typed logs, paired results | Decide |
| Decide | Complete evaluation | Verify promotion; persist/archive | Serialized transaction | Baseline reference or candidate decision | Commit, decision, history | Analyze |
| Analyze | Published target losses | Fresh subagent per complete readable loss; primary/secondary findings; coordinator consolidates | Bounded per-loss queue; optional admitted pipeline | Cohort covered; report complete | Findings, coverage, report | Replay or Deliver at ceiling |
| Replay | Eligible/pending reasons | Implement isolated rules; replay all associated cases | Measured replay pool | All settle; five wins AND 5% conversion, intended choice changed | Controls, variants, ledger | Assemble if any pass; otherwise Deliver |
| Assemble | Validated edits | Combine; revalidate changed isolated logic | No additional combined replay gate | Candidate validated/frozen | Candidate hash/history | Evaluate |
| Deliver | Normal completion | Export, rank comparable results, consolidate | No games | Checked report/export | Final artifacts | Closed |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Comparison | Pinned opponents, schedule, seeds and identities | Accepted comparator advances | Frozen opponents; paired starting inputs | Completed intersections exclude either side's ignores; each opponent needs a pair |
| Scoring | Games, equal opponent weights | Completed coverage | Draws count zero wins; no confidence intervals | Strict weighted improvement alone promotes |
| Source mode | Accepted source ordinarily | Valid regression uses regressing candidate for analysis, unchanged control and assembly | Record accepted separately; repairs add no rules | Analyze rejection first; no baseline removal |
| Calibration reuse | Local match/replay recommendation paths | Recalibrate unusable file or owner request | Source/version changes alone do not invalidate usable counts | Valid count within CPUs; provenance retained |
| Pending rules | Stable reason/rule and semantic hash | Explicit aliases/reconciliation; new correction gets new identity | Case provenance/failed history | Current-source controls cannot force historical choices |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/matches | 50; 250 total four-game matches | Pin effective owner limits | Baseline excluded from decision count; distribute matches evenly with ordered remainder | Analyze final evaluation |
| Games | Planned `(1 + decisions) × matches × 4`; recovery floor 10% | No implicit extension | Attempts/reservations count; cache reuse adds none | Interrupted remainder ignored after recovery allowance |
| Time/storage | 24 hours; 50 GB | Explicit continuation | Original start includes downtime; logical imported/staged bytes; 16 MB control reserve | Suspend admission |
| Calibration | All counts 2 through CPUs | Policy-permitted exclusions | Required successful repetitions; replay two, smallest within 3% fastest median | No qualifying count stops Prepare |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | Report bug; finalized ignore, never conversion | None | Outcome/accounting | Continue safe jobs |
| Interrupted evaluation | Preserve completion, settle reservations | Missing work within recovery allowance | Attempts and checkpoint | Verified budgets/deadlines |
| Failed calibration stage | Retain attempts | One fresh retry; then exclusion | Measurements/exclusions | Exact identity for unfinished stage |
| Integrity/initialization/sideboarding failure | Stop unsafe work | No generic retry | Diagnostics/source bindings | Resolved applicable incident; ask owner if unresolved |
| Resource stop | Block writes/admission; bounded owned shutdown | Explicit increase | Pending work, budgets, claims | Authorized verified continuation; no suspension cleanup |
| Pause/cancel/analyst failure | Stop owned work | Explicit instruction | Uncovered losses and owners | Same verified checkpoint, no duplicate owners |

Unsupported formats permit tooling adaptation without game charges.

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State/report | Identities, configuration, results, decisions, coverage, budgets, errors, links | Existing state and checked report | Durable compact record | Consolidate without policy duplication |
| Evidence | Lossless logs, readable losses/maps, replay branches, receipts | Existing run paths | Execution/reuse/resume needs end; accepted until replacement/closure | Designated pruning only; delivery alone insufficient |
| Pending ledger | Every reason, 300 first-seen distinct cases maximum, bindings | Durable cross-iteration records | Compatible continuation | Valid current-source failure at 300 proves discard |
| Source/history | Starting/evaluated commits, accepted export/hash, English attempt history | Git/history/export | After closure | Unevaluated variants remain temporary hashes |

## 8. Ambiguities and interpretations

| ID | Instruction reference | Ambiguity | Chosen interpretation | Behavioral consequence | Clarification required? |
|---|---|---|---|---|---|
| A1 | Pending policy versus Replay-none edge | Pending entries need subsequent retesting, but no qualifying edit ends this run | Persistence grants no iterations | Deliver pending ledger for compatible continuation | No |
