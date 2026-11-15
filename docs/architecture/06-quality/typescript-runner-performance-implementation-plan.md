# TypeScript runner performance implementation plan

Status: measured optimization loop completed after five consecutive negligible-gain iterations. Prepared 2026-11-14; the final report and matrix distinguish validated changes from deferred roadmap work.

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

Historical timings and benchmark limitations are maintained in the [retrospective](bot-improvement-performance-retrospective.html) and its linked evidence snapshot.

## Required behavior

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

Use the reusable [agent tools](../../developer-guide/agent-tools.md) for small benchmark commands and review source snapshots. Historical measurements belong in the retrospective; this plan owns execution order and completion criteria.

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

## Generated benchmark provenance

Match comparisons, match worker calibration and replay worker calibration embed `provenance` from `benchmark-provenance.ts` before measured stages. It records source revision and source-byte digest (including uncommitted runner sources), frozen job/config/request digest, Node/runtime flags, CPU/load, workers, evidence mode and scope limitations. Existing raw runs and actual completed counts remain in the same report. Review those counts and behavior verification before interpreting speedups; resume verification and diagnostic compact/raw modes have separate costs and persistence contracts.

## Active optimization loop — 2026-11-14

The owner requests continued measurement/implementation/rejection iterations until five consecutive iterations show no or negligible gains. That stop condition was reached after iteration 27. Final combined confirmation and targeted validation passed. See the [final report](../../evidence/bot-improvement/performance-loop-2026-11-14.html) and [comparison graph](../../evidence/bot-improvement/performance-comparison-2026-11-14.html). No campaign, promotion, commit or push is part of these fixtures. Initial tree was clean at `6faef29a95820d0dc0467ffb4457f1b6409fb7fb`; no active bot-runner process was found.

| Phase | Validated scope | Deferred scope |
| --- | --- | --- |
| 1 | Source/input provenance, complete workflow timing, CPU/RSS samples, separate resume and final reversed 25-match pairs | Detailed engine/lock/replay events and sustained calibration |
| 2 | Reader caches, publication reuse, compact packets and bulk analysis quota leases | Conversion outside session ownership lock and per-slice early readiness |
| 3 | Decoder and canonical hashing improvements; direct serialization prototype rejected | Worker-derived target-only views and metadata-only analyst admission |
| 4 | Bounded completed-resume verification, detached actor projection and correct reused-game metrics | Durable transition journals replacing growing checkpoint files |
| 5 | Complete mechanical loss-report ingestion, target-only views and coverage checks | Semantic pagination, real analyst-time evaluation and partial-slice report resume |
| 6 | Per-case control/alternative host reuse with fresh bots and cancellation fencing | Cross-case process reuse, pool resume and production orchestration integration |
| 7 | Preflight and replay batch candidates measured and rejected | Aggregation/calibration reuse and retention redesign |

Raw observations are retained in [iteration evidence](../../evidence/bot-improvement/performance-iterations-2026-11-14.json). The fixture reuses twelve matches (48 already-played games, 30 losses, 144,968 event references); it launches no games. First cache comparison medians: publication 17,649 → 6,723 ms; resume 8,275 → 3,173 ms. Three repeats per version; an earlier overlapping exploratory run was excluded. These are analysis-path results, not full-loop speedups. These initial observations did not establish whole-loop or sustained throughput; the final combined fixture below establishes only small-fixture workflow performance.

Correctness: selected analysis-slice, match-analysis and native-runner tests initially passed (13 tests; real-engine test skipped without fixture environment). The cache regression verifies distinct outcomes/decision IDs across all four games and rejects same-length byte tampering on a subsequent reader. Subsequent checks with an explicit frozen fixture passed all 14 tests, including native execution, strict replay, verified resume, tamper rejection, timeout and quota checks. TypeScript compilation passed.

Iteration 2 removes alias expansion/re-splitting; iteration 3 reuses parsed publication results while rechecking persisted receipt, source bytes and exact inventory. Iteration 4 (array-shift removal) was reverted: publication improvement was only 1.5%, and resume differences overlapped observed variability. Iteration 5 (reuse per-actor directory inventory) was also reverted without convincing gain. Iteration 6 batches metadata reads during quota reconciliation; the 10,000-unrelated-file fixture improved twelve writes from median 1,529 to 640 ms with identical byte totals. Storage, lease and replay-pool tests passed (11 tests; one environment-gated session test skipped). This resets the consecutive negligible-gain count to zero. Analysis leases and larger replay bottlenecks remain pending.

Iteration 7 increased metadata batches to 64; it showed no further gain and was reverted to 32. Current consecutive negligible-gain count: one. Next: budgeted end-to-end analysis fixtures and lease-based publication, followed by replay/resume measurements.

Iteration 8 adds `target-loss-v1` internal packets for new native queues: full source bindings and loss decision allowlists remain, while unused full-timeline event addresses are empty. Queue format pins preserve existing packet hashes on resume; legacy XML and native queues retain their old representation. Aggregation checks the declared format and exact finalized loss coverage. The twelve-match mechanical publication fixture shrank 11,700,317 to 301,134 bytes and improved publication/reread timings at 0/1,000/10,000 unrelated files. This fixture excludes discovery and report ingestion. Seventeen selected tests passed, with one external XML fixture skipped; an additional native aggregation integration passed, including rejection of a changed loss allowlist after rehashing the packet.

Iteration 9 skipped event-address array allocation inside native verification. Its five alternating pairs showed only about 1% median change within observed variability, so it was reverted. Current negligible-gain streak: one. Next focus remains analysis lease accounting and replay/resume; these are not declared complete.

Iteration 10 tested skipping per-case replay rebundling with a verified prepared-bot hash. Four cases (early/deep decisions, two unchanged variants) preserved strict outcomes and choices at one and two workers in reversed order. Two-worker time changed less than 0.4%; one-worker apparent improvement was dominated by one baseline outlier. The change was reverted. Current negligible-gain streak: two. Existing replay bundling remains pending profiling at larger real reason workloads.

Compact-packet recovery also detects the format of orphan immutable packets when a crash precedes queue publication, retaining legacy bytes instead of changing their format.

Iteration 11 reserves a quota allowance for bulk analysis packet/view/report writes, using short storage acquisition/release transactions and local staging counters. Every active reservation is refused, persisted suspension is honored, local quota rejection persists suspension, and stale async-context writes are fenced after settlement. Allocation still occurs under the existing session ownership lock; initial source discovery and long conversion lock scope remain separate work. A symlink at the leased directory itself is now rejected.

The complete twelve-match synthetic preparation/claim/report fixture retained identical slice packet and consolidated summary hashes at 0/1,000/10,000 unrelated files. The reversed source-pinned baseline took median 2,562 ms at 10,000 files; the final safety-path confirmation took 652 ms (all observations, including variability, retained). Earlier confirmations were around 570 ms. Twenty-six focused tests passed, followed by explicit real session/native/replay integration. The negligible-gain counter resets to zero.

Runtime identities now include the shared game codec and storage-gate/lease sources: changes to those implementations invalidate stale calibration/resume bindings instead of silently reusing them. Historical evidence is retained; historical pinned runs require their matching tooling.

Iteration 12 moves completed-resume verification to at most two worker threads, bounded by configured workers and work size. Every request retains the execution identity/current match and all inventory, source-byte, fixture and canonical checks, without cloning the entire schedule. Verification finishes before journal admission or new game reservations; failures stop admission and drain owned threads. Signals are installed before verification. Unexpected `done.json` files inside game folders are now rejected instead of being silently excluded from inventory.

For twelve retained real matches, integrated alternating runs had median verification 3,869 ms serial versus 1,976 ms pooled. Coordinator p99 event-loop delay was roughly 161–245 ms serial versus 10–11 ms pooled. Startup/teardown are included; this is reused evidence, not simulated games/second. RSS was higher with workers; pool size is capped at two. Real session/native tests passed, including unchanged reservations, tamper rejection and cancellation. Negligible-gain streak remains zero. Whole-loop confirmation, worker-derived views, short slice locks and replay reuse remain pending.

Iteration 13 compared verification widths 2, 4 and 8 on the same twelve-match fixture with three alternating repetitions. Median times were 1,908 / 1,060 / 1,066 ms respectively, with identical verified match lists. The retained cap is four (still bounded by configured workers and work size); eight offered no median advantage and higher RSS. This is a diagnostic cap, not a production simulation/replay calibration change. Negligible-gain streak remains zero.

Iteration 14 tested direct dictionary encoding. It retained identical bytes for 48 preloaded real games and reduced serializer median time from 1,840 to 1,059 ms, but did not establish a complete-path gain: four-match runs regressed, and twelve-match evaluation-plus-analysis medians changed only 1.3%, with opposite directions in the reversed pairs. Unrelated video processing was active; raw runs and this limitation are retained. Every fresh-game timeline and outcome passed the existing strict comparison (only already-permitted hint-order normalization). The prototype was reverted. Negligible-gain streak: one.

Iteration 15 prototyped direct canonical hash text generation. All 48 real-game hashes matched, but it was slower than the existing canonical-tree plus native JSON serializer (five-pair medians 985 versus 614 ms). Rejected before production integration. Negligible-gain streak: two.

Measurement correctness: result reporting now separates newly executed completed games from reused completed games and records `resumeVerificationMs`. A fully completed resume reports zero simulated games/second. Real-engine resume assertions and TypeScript compilation passed; this accounting correction is not counted as a performance-gain iteration.

Iteration 16 removes the redundant deep clone immediately before detached actor-seat projection in native and diagnostic workers. Opaque object-valued actor/life-point fields still receive an independent copy, and delayed prompt snapshots remain protected. Ten selected real/unit tests, TypeScript compilation and docs checks passed. Existing strict comparison verified 96 paired game timelines and outcomes.

The twelve-match evaluation-plus-finalized-analysis fixture improved from median 17,639 to 16,141 ms across two reversed pairs. Both pairs improved, but the later pair improved only 2.2%; unrelated video processing and substantial baseline variability limit this to directional evidence. CPU usage also decreased. The in-memory projection fixture improved from median 947 to 429 ms. The change is retained and the negligible-gain streak resets to zero. Complete report-ingestion integration, worker-derived loss views, short conversion locks and replay reuse remain pending.

Iteration 17 removes a replay transcript formatting pass whose output was discarded. Eight four-case replay runs at one/two workers retained identical outcomes and choices. Two-worker median changed only 1.2%, and the later one-worker pair only 1.1%; the initial baseline outlier is retained. This is kept as dead-code removal, with no material performance claim. Selected decision/replay-pool/real-replay tests passed. Negligible-gain streak: one.

Iteration 18 reuses one serialized engine host across the control and alternative of each replay case. Duel and bot instances remain fresh per branch, while initialized engine/content stay local to the case. The host is fenced after timeout, malformed protocol, missing/unbalanced cleanup or owner termination, and is reaped before case completion. Existing branch limits and writer quotas remain in force; final shared stderr is retained.

Eight four-case runs at one/two workers preserved outcomes, turns and target choices. Full strict comparison additionally verified 64 actor timelines across both branches. Median pool times changed from 11,062 to 9,463 ms at one worker and 5,908 to 5,093 ms at two; both reversed pairs improved. Node strip-only constructor syntax initially failed and was fixed through the test skill’s delegated workflow. Seven helper tests (including active cancellation), real replay integration, decision tests and TypeScript compilation passed. This remains within-case reuse only; cross-case reuse, resume and integrated whole-loop confirmation are pending. Negligible-gain streak: zero.

The new `benchmark-improvement-workflow.ts` command copies and verifies initial frozen inputs into an isolated diagnostic fixture (1–25 matches), performs real evaluation and complete mechanical loss-report ingestion, verifies every analyst view against its permitted transformation, and resumes without extra game reservations. A four-match smoke completed 16 games and ten loss reports. These reports are explicitly unclear fixtures, not AI analysis. The required final 25-match combined confirmation remains pending.

Iteration 19 avoids descriptor allocation for ordinary decoded object fields, retaining explicit own data properties whenever a name exists on `Object.prototype`. Prototype names, inherited setters and descriptors retain tested behavior. Nine targeted tests passed. Five alternating 48-game decoder trials improved median time from 2,210 to 1,570 ms. Both full twelve-match evaluation/preparation/report-ingestion comparisons improved (35,396 → 33,432 ms and 20,526 → 19,107 ms); the combined median change was about 6%. Heavy unrelated video processing caused substantial timing variation and is disclosed in the raw evidence. Full strict comparison verified 96 paired games, terminal outcomes and complete loss-report coverage. Retained; negligible-gain streak remains zero.

Iteration 20 compiles dictionary parent paths and escaped keys once per game. Per-record parent existence, root order, array order and duplicate validation remain unchanged. Ten selected tests and TypeScript compilation passed. Both complete twelve-match workflow pairs improved (18,003 → 16,689 ms and 18,394 → 16,980 ms), with preparation and verified resume also lower. Strict verification covered 96 paired games and all loss views/reports. External host load remains uncontrolled; these are directional fixture results. Retained; negligible-gain streak remains zero.

Iteration 21 tested numeric dictionary slots for per-record parent/duplicate lookup. All five paired decodes were slower (median 984 → 1,016 ms), despite identical decoded fingerprints. Rejected before production integration. The first pair was affected by higher unrelated host load; all raw observations remain recorded. Negligible-gain streak: one.

Iteration 22 builds canonical evidence objects with one sorted-key traversal, preserving omission rules, ordinary prototypes and special own-property behavior. Ten selected tests and TypeScript compilation passed. Both complete workflow pairs improved (16,415 → 15,839 ms and 15,932 → 15,632 ms), with lower evaluation CPU in both pairs and lower verified-resume cost. Strict comparison verified 96 paired games and complete loss-report coverage. Retained as a modest directional gain; the second pair improved only 1.9%, and shared-host variability remains a limitation. Negligible-gain streak resets to zero.

Iteration 23 tested batches of four reads during frozen-input verification. Seven alternating pairs verified all 36 pinned inputs and the full 2,500-match schedule without simulation. Median time changed 506 → 509 ms with mixed pair directions; rejected before production integration. Negligible-gain streak: one.

Iteration 24 compared replay scheduler batches of one versus two at two workers. All three paired four-case runs were slower with larger batches (medians 5,637 → 5,653 ms; one larger-batch outlier reached 6,448 ms). Strict comparison verified 48 actor timelines and identical outcomes/choices. Existing batch size one remains; no production setting changed. Negligible-gain streak: two.

Iteration 25 tested a key loop in the conservative event-size counter. All accounting totals matched across seven alternating pairs, but steady-state time did not improve (medians 91 → 94 ms); the initial baseline warm-up outlier is retained in raw data. Rejected before production integration, leaving evidence limits unchanged. Negligible-gain streak: three.

Iteration 26 tested Node’s single-call SHA-256 helper. Frozen-input verification improved, but complete workflow pairs moved in opposite directions (20,711 → 19,258 ms and 15,627 → 16,215 ms), as did evaluation CPU. Shared-host load changed substantially. Twelve selected setup/native tests passed, and strict comparison verified 96 paired games and complete review coverage. Reverted because a repeatable full-workflow gain was not established. Negligible-gain streak: four.

Iteration 27 tested a single key traversal for actor projection. Isolated projection improved, but the first complete workflow pair regressed slightly (21,014 → 21,146 ms). The fourth wrapper exited with code 143 without a report; its partial output is excluded, and a fresh control completed in 16,824 ms versus the prototype’s 21,147 ms under changing host load. Ten selected tests, TypeScript compilation and strict verification of 96 paired games passed. Reverted because a whole-workflow gain was not established. Negligible-gain streak: **five**. The optimization search stops; final combined comparison, validation and handoff follow.

### Final combined confirmation

The retained implementation completed two reversed pairs against the starting runtime snapshot, each with 25 matches / 100 games and two workers. Median evaluation plus complete loss preparation/reporting fell from 71,424 to 35,115 ms (50.8%). Evaluation medians were 31,465 → 27,807 ms, preparation 38,340 → 6,382 ms, and completed resume 7,719 → 2,393 ms. Every run covered all 57 target losses. These short shared-host fixtures do not establish sustained throughput or tail percentiles.

Strict comparison verified 200 paired game timelines, sideboarding and terminal outcomes; all target-only views and report coverage were checked independently. Completed resumes made no new game reservations. Sixty-six targeted tests passed, with one unavailable external legacy XML fixture skipped. Fifteen affected tests passed again after static cleanup; TypeScript, ESLint, Prettier, documentation and diff checks passed. No campaign, promotion, commit or push occurred.

The [final report](../../evidence/bot-improvement/performance-loop-2026-11-14.html) records the source identities, raw-evidence location, limitations, phase matrix and verified resume procedure. The loop is complete; deferred roadmap items are not claimed as implemented.


### Loss-analysis follow-up implementation

The loss-analysis path now supports worker-derived target-only projections with transformation/version/hash bindings, metadata admission for new native evidence, and the existing parser fallback for older runs. Finalization checks projection equivalence before publishing the receipt. Slice conversion happens outside session ownership and `sync` with `maxSlices: 1` permits admission of each ready 250-match slice after the complete evaluation barrier.

Review packets include ordered readable pages, exact event/decision coverage and byte counts. Analysts submit primary classifications and all supported secondary reasons together; offered/chosen IDs are checked against pinned loss decisions and Markdown is generated mechanically. `checkpoint` publishes validated match subsets within the slice, allowing a replacement owner to skip completed jobs. `status` reads the cached summary; `audit` performs explicit full evidence verification. Legacy packets and Markdown remain readable. These additions implement previously deferred functionality; prior benchmark numbers do not measure this follow-up or establish analyst-time savings.
