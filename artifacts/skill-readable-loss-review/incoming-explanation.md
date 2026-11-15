# Explanation from orchestrator for incoming skill

## 1. Outcome and scope
Improve one target AI against frozen opponents including starting self, delivering accepted source, verified paired results and history; unchanged completion is valid.

## 2. Process overview
Prepare pins inputs/limits/schedule and both calibrations; evaluate baseline/candidates, decide, analyze every required loss, replay isolated eligible rules, assemble passing edits and loop. Final decision still receives analysis. Exhaustion suspends.

## 3. Execution matrix

| Step | Entry condition | Action and owner | Concurrency | Decision/completion criterion | Saved output | Next step |
|---|---|---|---|---|---|---|
| Prepare | valid target/limits | Orchestrator freeze setup, archive source, reuse/calibrate pools | calibration separate | setup and two valid local recommendations | configuration | Evaluate |
| Evaluate | frozen source | run missing paired matches | saved workers; four games sequential | all matches finalized and reservations settled | evidence, paired rate | Decide |
| Decide | valid comparison | strict improvement decision/archive | serial | persisted baseline or candidate decision | checkpoint/history | Analyze |
| Analyze | completed target losses | fresh subagent per loss, coordinator merge | bounded loss queue | every required selected loss/report complete | source-bound analysis | Replay or Deliver |
| Replay | eligible/pending reasons | orchestrator isolated current-source variants | measured pool | all cases settled; five wins AND 5% | ledger and evidence | Assemble or Deliver |
| Assemble | validated edits | combine from mode base | serial | changed semantics revalidated, candidate frozen | candidate | Evaluate |
| Deliver | complete/no qualifying edits | rank existing comparable results/export/report | serial | checked closure | accepted export/history | Closed |

## 4. Identities and invariants

| Item | Initial source/value | Allowed changes | Must remain fixed | Verification |
|---|---|---|---|---|
| Opponents/schedule | pinned setup including starting self | none | decks, engine, legality, hidden information | hashes and paired inputs |
| Accepted | starting AI | strict valid improvement | comparison authority | paired intersections |
| Analysis/base | accepted ordinarily; regressing candidate for repair | mode-dependent isolated fixes/removals | unchanged replay control | source hashes |
| Calibration | local match/replay files | recalibrate unusable file or explicit request | version-independent reuse | positive workers within CPUs |

## 5. Limits and accounting

| Resource/stage | Default limit | Override rule | Accounting | Action at exhaustion |
|---|---|---|---|---|
| Decisions/matches | 50 / 250 four-game matches | pinned owner overrides | baseline excluded from decisions | finish required analysis |
| Evaluation | planned (1+decisions)*matches*4; recovery 10% floor | explicit configuration | failed/interrupted count, reuse zero | interrupted remainder ignored after allowance |
| Time/storage | 24 hours / 50 GB | full explicit continuation | original start, logical bytes; 16 MB reserve | suspend |
| Replays | all associated cases; no quota | ordinary limits apply | diagnostics separate | suspend |

## 6. Incidents and continuation

| Incident | Immediate action | Retry allowance | Evidence preserved | Resume condition |
|---|---|---|---|---|
| Individual timeout | report/ignore, continue safe jobs | none | incident | finalized |
| Calibration failure | fresh directory | one then exclude count | attempts/exclusions | qualifying measurements |
| Integrity/initialization/sideboard failure | stop; solve, ask if unresolved | no generic retry | all diagnostics | safe verified checkpoint |
| Exhaustion/owner pause/analyst failure | stop owned work, settle/checkpoint | no implicit extension | claims, uncovered jobs | applicable explicit authorization/limits |

## 7. Delivery and retention

| Artifact | Required contents | Destination | Retain until | Cleanup condition |
|---|---|---|---|---|
| State/report | identities, budgets, decisions, results/errors | run state and checked report | durable summary | consolidate before cleanup |
| Evidence | loss/replay/variant/source bindings | run evidence | validation/reuse/resume/pending need ends | eligible closure only |
| Versions/history/export | every evaluated candidate, accepted source and attempts | Git/history/export | after closure | temporary evidence only pruned |

## 8. Ambiguities and interpretations
Incoming refs contain current v4 per-loss instructions beside historical v1-v3 encoded/slice dispatch language. Interpret historical text as evidence retention only under explicit owner current-policy authorization; remove obsolete operational directions in candidate. Full review is default; partial policies require explicit authorization and never alter paired promotion authority.
