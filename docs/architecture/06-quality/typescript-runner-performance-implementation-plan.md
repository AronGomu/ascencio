# TypeScript runner performance implementation plan

Status: ready to implement. Prepared 2026-11-14. Recheck the working tree before starting; migration work is ongoing.

## Objective

Reduce the complete AI improvement iteration time: setup, TypeScript evaluation, evidence preparation, analyst review, isolated replay, aggregation and delivery. Preserve reproducibility, evidence integrity, hidden information, complete loss coverage and resource accounting.

The implementation target is `session-typescript/v1`, entered through `npm run bot:matches`. Shared analysis and replay components are in scope because the TypeScript runner uses them. Archived Rust runners are compatibility references, not optimization targets.

## Start here in a fresh session

1. Read `AGENTS.md`, `docs/project-guide.md`, the `ai-bot-self-improvement` skill, and the `ascencio-tests` skill before selecting tests. Follow the repository's local-only validation policy.
2. Read [persistent runners](independent-batch-runner.md), [TypeScript migration](experimental-typescript-runner.md), [replay pool](experimental-replay-pool.md), and the [retrospective](bot-improvement-performance-retrospective.html). Detailed measurements and captured source hashes are in [the evidence snapshot](../../evidence/bot-improvement/performance-retrospective-2026-11-14.json).
3. Inspect `git status`, current source and active process ownership. Preserve existing dirty changes. Do not modify a live run's pinned runtime, clear a live lock, switch its backend, or silently invalidate its evidence. Use fresh isolated benchmark outputs.
4. Create a progress checklist for the phases below. Mark each item implemented, validated, blocked with evidence, or explicitly deferred. Recheck existing work before implementing it.
5. Start phase 1 immediately. This document authorizes no new AI improvement campaign, source promotion, push or production run. Performance fixtures and targeted checks belong to implementing the plan.

## Known starting state

Already implemented in the inspected working tree:

- Persistent TypeScript engine workers, cached engine/content, fresh bots per game and an in-process host frame sink.
- Session budget allocation, worker journals and leased incremental output accounting for evaluation.
- Separate TypeScript worker calibration; select the smallest count within 3% of the fastest median.
- `typescript-native-completion.ts`; finalization verification dispatched through `engine.verify` to an engine worker.
- Final outcome tally reads `match.log` summaries instead of decoding every game timeline.
- Experimental replay pool with a dynamic case queue and worker storage allowances.

Confirm these changes and their tests; do not implement them again. Sequential completed-resume verification and shared analysis overhead remained at the review snapshot.

Historical observations, not implementation promises:

- Old 10,000-game evaluation: 192.83 minutes. Post-evaluation preparation: 190.11 minutes and still incomplete.
- Preparation intervals: 89.43 minutes discovery/receipts, 37.67 minutes packet publication, 62.95 minutes loss-view creation so far.
- 2,500 packets: 2.37 GB. 4,121 loss views: 5.075 GB. One whole-run quota scan: 892 ms across roughly 27,410 files.
- Full-evidence native comparisons were mixed: 144 games at two workers favored TypeScript; later 200-game tests at four workers favored optimized Rust. Do not claim language migration alone guarantees speed.

## Non-negotiable behavior

Keep the same frozen schedule, engine seeds, deck/sideboarding rules, original policies and exact decision identities. Validate persisted bytes before trusting receipts. Analysts receive only target-loss information. Every completed target loss must be covered. All associated losses for every eligible reason must be replayed; preserve the five distinct losses and 5% conversion thresholds, intended-choice checks and timeout denominators.

Generate mechanical derivatives during evaluation if useful, but start analysts only after evaluation settlement and the decision barrier. Preserve one owner per fixed 250-match slice. Keep replacement bot state fresh at takeover and original policies warmed through the prefix.

Resolve effective limits from authoritative run state: skill default 50 GB output, up to five hours per evaluation, original 24-hour run clock, and authorized 10% evaluation recovery allowance. Replay branch, pool and run deadlines are separate. Do not reinterpret five-hour evaluation authorization as a five-hour replay-branch allowance. Retain staging charges and 16 MB control headroom.

## Phase 1 — Instrument and establish a reproducible baseline

Owners: `session-batch-runner.ts`, `run-typescript-native.ts`, `typescript-native-{executor,worker,evidence,completion}.ts`, shared analysis/replay entry points.

- Add durable stage events and separate monotonic durations for setup, calibration, admission, worker startup, engine/bot/projection, serialization, persisted verification, final tally, settlement, discovery, parsing, quota accounting, view/packet publication, lock wait/hold, report validation, replay preparation/prefix/branches and cleanup.
- Record runtime/source identity, work size, workers, bytes, counts, CPU/RSS, event-loop delay, cache hits and stop reason. Status must not trigger a full filesystem walk.
- Preserve fresh execution and resume measurements separately. Reused games must not inflate simulated games/second. Include calibration verification/setup in calibration's total cost.
- Capture equal-work full-evidence comparisons in both orders under quiet load; use identical workers and frozen inputs. Preserve raw observations and source hashes.

Done: timings reconcile with outer elapsed time, overlaps are explicit, and a later change can be compared against the same workload. Verify the two existing migration optimizations above before attributing savings to them.

## Phase 2 — Remove shared analysis storage and parsing bottlenecks

Owners: `output-storage.ts`, `batch-storage-lease.ts`, `replay-output-budget.ts`, `analysis-text-evidence.ts`, `analysis-evidence.ts`, `prepare-analyses.ts`, `analysis-slices.ts`.

1. Introduce an analysis output lease using existing quota architecture. Reconcile once at acquisition/recovery; use local counters for normal writes, staging and replacements; settle after owned writers stop. Keep administrative transactions short.
2. Cache decoded game/match objects within one verified reader, keyed by verified bytes/hash. Virtual `game.json`, `a.json`, `b.json` must share one parse. Bound memory per match or small batch.
3. Carry verified results through receipt publication instead of immediately repeating complete validation with a new reader. Define where byte checks remain required across processes/resumes.
4. Replace all-events analysis packets with a dedicated loss contract: source identities, outcome, view hash/path, allowed decision IDs and coverage. Keep legacy adapters explicit.
5. Convert outside the session lock; publish each immutable slice in a short checked transaction. Persist per-slice readiness and claims so early ready slices can start after the evaluation barrier while later slices prepare.
6. Apply the same accounting and short transactions to report completion. Avoid per-match global scans, repeated full-source reads and duplicate canonical report storage where compatible.

Done: routine analysis publication performs no whole-run quota walk; one decode serves virtual records within a trust boundary; packet size no longer grows with both actors' complete event lists; controller/claim operations stay responsive. Crash, tamper, quota and duplicate-owner checks still pass.

## Phase 3 — Produce analysis-ready evidence in TypeScript workers

Owners: `typescript-native-worker.ts`, `typescript-native-evidence.ts`, `typescript-native-executor.ts`, `typescript-native-completion.ts`, `game-log.ts`, completion/analysis contracts.

- Derive the permitted target-only loss view directly from already separated actor records once a completed loss is known. Handle swapped starters without confusing actor identity.
- Emit compact outcome and decision summaries with hashes, schema and transformation version. Publish source/derivative bindings atomically with validated match completion.
- Adapt analysis discovery to consume these outputs; preserve a bounded fallback for older runs. Do not add per-game JSON gameplay duplicates.
- Include projection cost in evaluation benchmarks. Bound queued output and memory; apply backpressure.
- Replace expanded-text-then-dictionary rewriting with direct typed serialization only after profiling; prove equivalent decoded records and canonical hashes.

Done: a new TypeScript evaluation reaches analyst admission through metadata assembly without decoding and rewriting every loss after completion. Full authoritative logs remain replayable; target views match the permitted old transformation exactly.

## Phase 4 — Finish TypeScript coordinator and resume optimization

- Measure worker-side finalization verification and match-summary tally already present.
- Parallelize completed-resume verification with a bounded worker pool; retain exact file inventories, bytes and canonical checks. Do not trust mtime alone.
- Replace growing `matches.json`, worker owned lists and progress snapshots with durable transitions plus periodic compact checkpoints. Reservations remain durable before dispatch; receipts follow durable files.
- Profile structured cloning, actor mapping, recursive size checks, log transfer, sideboard histories and initialization cache hits. Optimize only measured costs; keep external decision deadlines responsive and memory bounded.

Done: sustained throughput does not collapse as the schedule or output grows; coordinator event-loop delay is bounded; completed resume launches no games or new reservations; interrupted attempts remain charged.

## Phase 5 — Make complete loss review practical

- Provide a deterministic readable target-only view with card names/stable IDs, concise visible changes, choices, turns, sideboarding and results. Keep indexed lossless backing evidence accessible by turn/decision.
- Paginate by semantic boundaries and avoid sending repeated state snapshots/field paths through model context. Record bytes/tokens supplied and review duration per loss.
- Preserve ten fixed slice owners; queue immediately as slots free. Checkpoint completed match reports within each slice so interruptions resume uncovered work.
- Use stable reason IDs and compact examples; merge equivalent reasons across slices before applying the five-loss threshold. Similarity clustering may assist navigation but cannot replace loss review.

Done: every loss has a validated report, no hidden opponent information enters analyst input, truncation cannot masquerade as review, and a fixed 10-loss review fixture demonstrates reduced input volume/time with audited findings. A full slice is an optional later confirmation.

## Phase 6 — Integrate and optimize TypeScript replay execution

Owners: `prepare-replay-pool.ts`, `run-replay-pool.ts`, `replay-game-decision.ts`, `replay-work-queue.ts`, writer allowances and host command API.

1. Integrate the existing pool with skill orchestration; collect all eligible reasons into one dynamic queue. Calibrate replay independently from evaluation.
2. Freeze/compile once per variant, reuse paired schedules and parsed source records through bounded hash-keyed caches. Avoid CLI rebundling of prepared variants.
3. Add verified resume using case receipts and journals. Reuse complete cases; obey timeout no-retry policy and original deadlines. Reconcile worker byte deltas instead of rescanning accumulated outputs per case.
4. Extract an importable replay executor using persistent TypeScript workers and cached engine/content. Preserve strict two-actor prefix checks, fresh replacement state and warmed originals; test cross-case state isolation.
5. Reuse an independently verified control only for an identical game, actor, decision, source/runtime/content and replay semantics. Keep exact choice/outcome proof. Investigate prefix snapshots only after a complete engine/bot/RNG state contract exists.
6. Replace growing progress rewrites with durable case transitions. Allow coordinator-mediated quota top-ups within the unchanged global allowance if unequal case sizes strand capacity.

Done: all cases settle with identical decisions/outcomes to the reference executor; failures/cancellation stop admission correctly; resume preserves work; all threshold calculations include timeouts as required. No representative sampling or early-success cutoff substitutes for required cases.

## Phase 7 — Preflight, aggregation, calibration and retention

- Implement a target-AI-only changed-package validation boundary and check support before long evaluations. Preserve immutable non-AI dependencies and failed evidence.
- Aggregate paired results from verified outcome summaries; reuse compatible accepted baseline and analysis. Avoid full timeline reconstruction for counts.
- Resolve limits once and publish one authoritative status. Remove contradictory stale totals/error fields; distinguish preparation, review and replay coverage.
- Reuse valid TypeScript calibration. A 2–16 sweep with two repetitions and 16 matches costs 1,920 games plus verification. Optimize cache/revalidation identity carefully; changing exhaustive calibration policy requires updating the skill explicitly.
- Prune eligible rejected evidence in accounted batches; preserve accepted/resumable dependencies. Rank existing results and export once at closure.

Done: no late package-format block, redundant baseline simulation or hidden repeated calibration; status agrees with receipts; cleanup preserves references and correct quota totals.

## Validation and performance gates

Use the test skill to select exact related files. Likely suites: `typescript-native-runner.test.ts`, `bot-session-batch.test.ts`, `bot-output-storage.test.ts`, `bot-analysis-slices.test.ts`, `bot-match-analysis.test.ts`, `bot-session-aggregation.test.ts`, `bot-candidate-session.test.ts`, `replay-pool.test.ts`, `replay-pool-real.test.ts`, `worker-calibration.test.ts`, and `decision-replay.test.ts`. Confirm paths exist before invoking them.

Example after selection:

```sh
npm test -- --tests test/tooling/typescript-native-runner.test.ts test/tooling/bot-analysis-slices.test.ts test/tooling/bot-output-storage.test.ts
npm run bot:typescript:migration:test -- --session FIXTURE_SESSION --out FRESH_OUTPUT --workers 2 --matches 4 --max-wall-ms 120000
# Repeat to another fresh output with --native-first.
```

Read current CLI help/source before running. Use this small default ladder for fast implementation iterations:

| Check | Default workload | When |
| --- | --- | --- |
| Related correctness | Only exact affected test files; narrow to relevant cases where supported | After a meaningful change |
| Match smoke/performance | 4 matches / 16 games per backend, 2 workers, one run | During implementation |
| Comparison confirmation | 12 matches / 48 games per backend, 2 workers, two runs with reversed order | Once the phase is stable |
| Preparation/report fixture | Reuse 12 finalized matches, including losses and empty-loss cases; no new simulation | For analysis changes |
| Analyst-view review | 10 fixed losses spanning short/long games and pre/post-sideboarding | For review-format changes |
| Replay fixture | 4 cases spanning short/deep prefixes and at least two variants, 1 and 2 workers | For replay changes |
| Directory scaling | Reuse the same small game fixture in fresh directories with synthetic unrelated file counts of 0, 1,000 and 10,000 | For storage/index changes; do not simulate extra games |
| Integrated confirmation | 25 matches / 100 games plus complete preparation and report ingestion | Once after the combined implementation is stable |

Keep failure, quota, cancellation, tamper and resume coverage in focused fixtures; reducing game counts must not remove those checks. For analyst fixtures, validate all fixture losses. For slice scheduling, use synthetic metadata to test 250-match boundaries and ten-owner dispatch without playing 2,500 matches. Fixture reports may test ingestion mechanically; label them as fixtures and do not count them as actual AI analysis.

Do not run full worker calibration or a 2,500-match benchmark in the normal implementation loop. Explicit fixed worker counts in these diagnostic comparisons do not change production calibration recommendations. A 2,500-match sustained benchmark is optional and requires a separate request. Small fixtures establish correctness and directional performance only; report their limited scale, and leave sustained performance unverified until measured. Record all benchmark games/output separately from improvement results.

Acceptance gates:

- Identical deterministic gameplay and strict replay behavior; any permitted annotation normalization remains narrowly scoped.
- No normal per-file whole-run scan, no repeated decode for virtual views in one verified transaction, bounded memory and lock duration.
- Performance measured at increasing directory/schedule sizes, with setup, verification and durable output included.
- New pipeline improves total evaluation-plus-preparation time against its captured baseline; moved work is counted once, not hidden.
- No regression in hidden information, quotas, crash recovery, cancellation, timeout treatment, complete review or promotion evidence.
- Publish median/tail timings and raw data; set quantitative regression thresholds from repeated measurements rather than inventing an ETA.

## Deliverables and handoff

For each phase record files changed, checks run, before/after measurements, remaining risks and the next action. Keep paths synchronized in `AGENTS.md` and documentation navigation. Update runner/analysis/replay documentation and skill references when their implemented contracts change. Preserve unrelated migration work; commit or push only within the user's instructions.

Final delivery includes a small integrated benchmark report with its scale limitations, source/runtime identities, raw measurements, phase completion matrix, remaining bottlenecks and verified resume procedure.

Fresh-session prompt:

> Implement docs/architecture/06-quality/typescript-runner-performance-implementation-plan.md for the TypeScript runner. Start by reconciling current code and active runs with its known state, then execute the phases in order. Preserve unrelated changes and frozen run identities. Use targeted local validation and measure complete workflow gains. Keep the plan's completion matrix current and continue through implementation, reporting any concrete blocker with evidence.
