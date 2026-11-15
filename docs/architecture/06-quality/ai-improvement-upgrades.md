# AI improvement performance upgrades

This document maps the fifteen implementation tickets and the original thirty performance proposals plus five policy options to their owning code and validation contracts. Implementation and performance acceptance are separate: executable support does not establish better analyst throughput. The owner-stopped campaign was not resumed, its historical evidence/claims/cursors were not migrated, and the frozen vendor engine was not changed.

## Implementation boundaries

Full chronological loss review remains the default. Explicit `sample` and `two-pass` cohorts have separate immutable identities and coverage labels. Their selected-review completion cannot become full coverage. They may support an explicitly configured research workflow, while promotion still requires complete, comparable paired evaluation and strict improvement. Early research is exploratory and never advances a candidate on an incomplete evaluation.

Evaluation, preparation and analysis can use explicit concurrent storage envelopes under the shared root. Legacy exclusive leases remain readable. Reservations include staging and are released using acquisition root/token; duplicate or overlapping writers are fenced. Runtime analyst slots, preparation slots and memory estimates are explicit capability inputs, not permission to create unavailable model capacity. The pipeline uses an explicitly supplied analyst command adapter; it does not select a provider, create model access or infer unlimited resources.

New evidence is versioned independently of old packets. Reuse revalidates source bytes and identities; neither filesystem timestamps nor cached metadata are evidence of integrity. Diagnostics have their own bounds and accounting. No new gameplay or model-reading throughput is implied by synthetic test completion.

## Fifteen-ticket implementation map

| Ticket | Implementation | Validation contract / practical limit |
| --- | --- | --- |
| 1 — Representative workflow benchmark | `benchmark-review-workflow.ts`: explicitly pinned corpus, strata/tags, case/time/byte caps, phase measurements, durable analyst observations and verified replay-result ingestion | `benchmark-review-workflow.test.ts`; real analyst observations and actual tokens must be supplied to obtain throughput. Missing measurements stay null, not estimated as observed. |
| 2 — Compact review usability | `compact-loss-review.ts`, `loss-review.ts`: nested templates/deltas, reversible strings and IDs, bounded UTF-8/token-envelope fragments, independent restart blocks, event/decision/card indexes | Exact reconstruction and restart tests; token envelope is conservative byte-based, not a measured model tokenizer count. Human/model comprehension remains a measured acceptance question. |
| 3 — Concurrent storage reservations | `batch-storage-lease.ts`, `output-storage.ts`, `analysis-output.ts`, native/session/replay callers: shared root, nonoverlapping concurrent scopes and explicit envelopes | Concurrent storage, staging, late-ancestor and lease ownership regressions; legacy exclusive mode remains available. |
| 4 — Durable supervision | `operation-status.ts`, `operation-child.mjs`: supervised children, durable owner/child identities, heartbeat/events, bounded shutdown and token-checked recovery | Synthetic child-process tests cover owner loss, duplicate admission and shutdown. Platforms without a trustworthy process birth identity fail closed for unsafe recovery. |
| 5 — Evaluation/analysis pipeline | `analysis-pipeline.ts` plus slice publication: owned evaluation/analyst commands, bounded backlog, event wakeups, periodic reconciliation and resource admission | Pipeline overlap/backpressure/failure tests; adapter must complete the ordinary claim/page/findings protocol. Real campaign throughput is not inferred from synthetic overlap. |
| 6 — Verified cache and fewer copies | `verified-evidence-cache.ts` and evidence/projection consumers: bounded parse cache keyed by fresh content hashes and parser identity; existing immutable loss references reused | Corruption, invalidation and mutation-isolation tests. Fresh hashing remains intentional; authoritative logs and necessary review blocks are retained. |
| 7 — Resource and feasibility admission | `analysis-policy.ts`, slice claims and pipeline: explicit runtime capacity, free-memory admission, reserve/per-worker estimates and representative feasibility strata | Policy/capacity tests; missing strata are unassessable. Estimates are operational bounds, not guaranteed future throughput. |
| 8 — Official calibration completion | Official match/replay CLIs plus `calibration-recovery.ts`, `calibration-evidence.ts`, `calibration-memory.ts` | Durable retry/exclusion, interrupted-stage preservation, stale identity and evidence-corruption tests. Preflight requires three explicit memory amounts; no successful timing is invented for excluded counts. |
| 9 — State, report and telemetry | Operation status/events, slice coverage metadata and pipeline transitions | One operation snapshot feeds current state and report. Counts distinguish pages, reviewed losses, selected coverage and full coverage. Periodic reconciliation is lightweight; it does not repeatedly audit gameplay. |
| 10 — Reasons and incremental validation | `reason-vocabulary.ts`, `findings-validation-cache.ts`, slice integration: versioned explicit aliases, original occurrences and solutions retained, bounded validation cache | Alias cycles rejected; distinct-loss counting and complete cache bindings tested. No verdict is assigned to unread losses. |
| 11 — Two-pass analysis | `analysis-policy.ts`, immutable `triage.json`, workflow gates | Complete outcome metadata is ranked by recorded cost, interleaving representative seeded cases. This is metadata triage, not an automatic tactical diagnosis. Selected coverage stays targeted. |
| 12 — Sampling and expansion | `configure-analysis-policy.ts`, `analysis-scope.ts`, `import-analysis-findings.ts`: immutable cohorts, fixed-prefix expansion, verified finding reuse | Seed/identity/monotonicity tests and cohort import integration. Evaluation size remains frozen per setup; changing it requires a compatible new evaluation identity rather than silently extending an old schedule. |
| 13 — Dynamic analyst work allocation | Configurable small slices, cost-balanced claiming, persisted claims/page cursors and completed jobs | One owner per unit; unfinished units can be reassigned after verified owner termination. Active units are not silently split or stolen. |
| 14 — Early research and explicit resources | `workflow-gates.ts`, controller `gate`, `configureAnalysisPolicy` continuation through `controlSession` | Early research cannot promote incomplete evaluation. Full continuation limits and owner-stop token, when required, preserve the original start, consumed budgets and limit history. |
| 15 — Integration and documentation | Active skill/protocol, repository map, this mapping and targeted local validation | Tests and measurements are reported separately below; historical REFINED skill remains a snapshot. No remote CI, automatic push, merge or old-campaign restart. |

## Original proposal coverage

IDs follow the prioritized table in the original propositions file. “Supported” refers to executable behavior; measured speed or storage improvements require benchmark evidence.

| ID | Proposal | Owning implementation / scope |
| --- | --- | --- |
| 1 | Encode defaults/null/repeated structures once | v3 review nested templates, dictionaries and deltas; exact reconstruction |
| 2 | Reversible long identifiers | String dictionary retains exact choice/card IDs |
| 3 | State differences with initial references | Per-kind state plus independent block restart state |
| 4 | Compact JSON and forced-choice scaffolding | Compact records retain every chronological decision and selected choice |
| 5 | Output/token-bounded pagination and hashes | Byte/token-envelope cap, block/page hashes, oversized-record fragmentation |
| 6 | Page-level verified reading checkpoint | Ordered token-bound page acknowledgements; partial reading is not a verdict |
| 7 | Early representative feasibility | Stratified observations feed admission; missing strata reject assessability |
| 8 | Identity continuity after control transfer | Projector handles engine SWAP=55 atomically with visibility filtering; historical logs remain unchanged |
| 9 | Analysis after each finalized slice | Resource-admitted pipeline and concurrent storage envelopes |
| 10 | Slice-local discovery | Range-scoped discovery; no requirement to parse later match evidence before first slice |
| 11 | Reuse verified receipts/decodings | Bounded content/parser-identity caches; bytes are rehashed, avoiding metadata-only trust |
| 12 | Loss views on demand | Slice preparation projects only selected finalized target losses |
| 13 | Compact chronological navigation | Event/decision/card indexes and block restart lookup; navigation never waives required reading |
| 14 | Reduce source/view/page duplication | Existing immutable loss references and cache reuse; necessary source and review artifacts remain |
| 15 | Runtime-compatible analyst capacity | Declared runtime slots plus resource-aware admission; generic command adapter requires actual configured capacity |
| 16 | Account for long losses | Cost-balanced units and measured strata; no short-game-only ETA presented as representative |
| 17 | Bounded preparation concurrency | Configured preparation pool, concurrent decoding, serialized publication and backlog control |
| 18 | Resumable official calibration | Both CLIs share durable attempts, one retry and explicit exclusions |
| 19 | Complete calibration compatibility | Stable source/runtime/workload identities, accepted-source binding and retained evidence manifests; volatile timestamps/load excluded from resume key |
| 20 | Worker-memory preflight | Explicit budget/reserve/per-worker estimates; durable exclusion reasons without fabricated measurements |
| 21 | Accounting before dispatch | Setup and calibrators initialize/resolve the shared storage gate before stage writers |
| 22 | Acquisition-root/token release | All touched callers use acquisition identity; late ancestor regression retained |
| 23 | Durable child-process ownership | Supervised child registration, birth identity, bounded stop and guarded recovery |
| 24 | Bounded phase telemetry/heartbeat | Durable snapshots/events include phase counts, bytes, time and RSS; heartbeat avoids rescanning logs |
| 25 | Event-driven monitoring | Publication wakeups plus periodic reconciliation; historical scheduled monitor stays disabled |
| 26 | Coverage metadata dashboard | Structured status/report counts reviewed losses, acknowledged pages and remaining/selected/full coverage separately |
| 27 | Shared reasons and explicit merging | Versioned aliases, original occurrences and disagreements retained; distinct loss counting |
| 28 | Incremental findings/context validation | Bound packet/source/report/vocabulary/validator cache plus source verification on every lookup |
| 29 | Current state/report synchronization | Operation transition snapshot/report publication; terminal failures retained |
| 30 | Separate preparation/reading/replay benchmark | Bounded workflow benchmark and independently recorded analyst/replay observations; absent measurements remain absent |
| P1 | Two-pass review | Explicit metadata-triage policy; targeted selected completion, never full-coverage relabeling |
| P2 | Sampling/smaller initial campaign | Seeded cohort selection and expansion; frozen evaluation schedule and paired-comparison identities preserved |
| P3 | Smaller/dynamic work units | Explicit unit size and cost-balanced queue with one owner; resumable claims |
| P4 | Research before global analysis completes | Explicit earlyResearch gate; speculative work cannot bypass evaluation/comparison/integrity promotion gates |
| P5 | Explicit model/resource/time increases | Slot/resource fields plus complete ledger continuation; no provider access or unlimited spending inferred |

## Validation and measurement interpretation

Targeted suites cover storage concurrency and staging; projection/control-transfer identity; compact reconstruction/restarts; slice publication, checkpoints, claims and imports; cache invalidation; calibration recovery and memory exclusions; process lifecycle; pipeline admission/failures; cohort/gate semantics; and benchmark provenance. Final aggregate test counts and benchmark measurements are recorded by the integrating implementation run; intermediate per-agent counts are not summed as distinct tests.

The initial three-loss offline benchmark used copied short/median/long losses and established exact reconstruction plus a serialization-size change for v2. Those timings do not characterize v3 restart blocks and are not carried forward as a v3 speed claim. `benchmark-review-workflow.ts` records fresh v3 preparation and supplied observations under an explicit request identity. Actual model tokens, comprehension and losses/hour require actual bounded analyst observations. Replay throughput requires separately verified diagnostic replay results. Synthetic tests demonstrate contracts, not an end-to-end speedup.

The independent Swap fix passed focused and existing projector/classification tests during the initial implementation. The source cause was a previously ignored SWAP message, not a vendor-engine change. Old ambiguous labels are preserved as historical evidence rather than rewritten into apparent certainty.

## Final local validation — 2026-11-15

The final 25-file targeted run passed **98 tests**, with **2 explicitly skipped opt-in real-engine tests** and zero failures. TypeScript checking passed. Additional replay-pool checks passed after adding concurrent-lease awareness. No remote CI, real campaign evaluation or rule replay was launched. The targeted suites include synthetic subprocess and multiprocess reservation races, interrupted-wrapper recovery, parallel slice preparation, completed-finding import and monotone cohort expansion.

The v3 offline diagnostic used three copied size strata, capped at three cases, 600000 ms and 20000000 bytes. Every source and reconstructed stream was verified. Peak process RSS was 209924096 bytes.

| Stratum | Legacy bytes | v3 bytes | v3 pages | v3 preparation ms | Receipt validation ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| short | 214880 | 129428 | 12 | 20.31 | 3.11 |
| medium | 886310 | 517074 | 48 | 66.00 | 10.26 |
| long | 2312879 | 1334890 | 124 | 135.56 | 25.97 |

A separate Astra/high diagnostic fully read the shortest copied loss: 12 pages, 322 decoded rows, 317 events and 72 decisions. Recorded elapsed reading time was 187257 ms, including interruption/instrumentation. The final loss outcome was cross-checked against the authoritative copied source. Actual model token counts were unavailable and remain null. One shortest-loss sample is not representative and is not a before/after throughput comparison. Medium/long analyst throughput and real replay throughput remain **unmeasured**, rather than reported as an achieved speedup.

The new public commands are `bot:analysis:pipeline`, `bot:analysis:policy`, `bot:analysis:import`, `bot:analysis:benchmark` and `bot:workflow:status`. Pipeline storage envelopes are session-global and configured at setup; named cohorts may not override them. Original session limits and start time remain authoritative.
