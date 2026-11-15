# Performance protocol

Read during Prepare, when configuring a policy/cohort/pipeline, and before reviewing a newly published slice. Preserve historical packet versions, claims and cursors. New-format support does not authorize migrating or resuming an owner-stopped run.

## Readable review (current)

New packets use review version 4: one plain Markdown file per loss, with exact source hashes and a choice map. Follow the main skill’s Loss review policy and the per-loss queue protocol. Read the file once and submit findings; no page acknowledgements.

## Policy setup and cohorts

At setup, pass the policy JSON via `--analysis-policy` and the explicit storage cap via `--max-bytes`. Full mode is the default. Inspect `resolveAnalysisPolicy` for the authoritative schema. Relevant fields:

- `mode`: `full`, `sample` or `two-pass`; partial modes require explicit `sampleMatches` and `seed`.
- `sliceMatches`: 1..250; `analystSlots` and `preparationSlots`: explicit bounded capacities. Units are fixed within a cohort.
- `scheduling`: `ordered` or `cost-balanced`. Cost-balanced claims prioritize larger pending units; one owner remains responsible for each unit.
- `pipeline`: `evaluationBytes` and `analysisBytes`, each above the control reserve; this opts into explicit shared-root concurrent envelopes.
- `resources`: `runtimeSlots`, `reserveBytes`, `bytesPerAnalyst`, `bytesPerPreparer`. Analyst capacity must not exceed runtime capability; RAM admission further limits it. These declarations do not provision a provider or extra model slots.
- `feasibility`: measured `samples` with stratum/losses/elapsedMs/bytes, `remaining` counts per stratum and `remainingMs`. Unassessable or infeasible review blocks admission; never silently shrink coverage.
- `vocabulary`: explicit `version` and `aliases`. Preserve original reasons/solutions when merging aliases.
- `earlyResearch`: permit exploratory research on reviewed evidence before global completion. Evaluation and promotion authority remain unchanged.

Create an immutable cohort with `node scripts/bot-improvement/configure-analysis-policy.ts SESSION REQUEST.json`, where the request contains `id`, `policy`, and optional `expandFrom`. Supply the resulting `analysisId` on the analysis binding and subsequent claim/status/findings operations. Changing a published cohort's policy is rejected.

Sample mode selects a seeded fixed prefix of the frozen match schedule. Two-pass mode first waits for complete outcome metadata and persists `triage.json`; it interleaves representative seeded cases with high-cost cases in a fixed order. This is metadata triage, not causal diagnosis. Larger cohorts preserve the earlier prefix. `selectedReviewComplete` means the selected work finished; `fullCoverage` remains distinct. Compare evaluations on compatible paired schedules, never on a favorable selected subset alone.

`import-analysis-findings.ts SESSION REQUEST.json` accepts iteration, role, optional `sourceAnalysisId`, target `analysisId`, target slice and live claim token. It reuses only completed, identity-matching reports and verified loss projections. It imports coverage through the normal checkpoint contract and writes source/target provenance; it executes no games. Unknown/incompatible evidence requires review, not assumed completion.

For explicit time/storage increases, the configure request must include `continuation` with the **complete effective limits object**, plus the owner-stop token if required by the controller. Requested policy `maxBytes`/`maxWallMs` must match those limits. The owning `controlSession` applies continuation, preserves original start and consumed budgets, and records limit history. Merely editing a policy field does not increase a budget.

## Pipeline and process ownership

`node scripts/bot-improvement/analysis-pipeline.ts SESSION REQUEST.json` binds an evaluation command and an analyst command to the owned-process supervisor. The request includes the analysis binding/cohort, finite pipeline limits, backlog bound and explicit resource admission values. Read its CLI schema before invocation. Commands are executable/argument arrays, not shell scripts inferred by the tool. The analyst command receives a generated claim-file path and must perform the per-loss claim/findings/completion protocol. Configure the provider/model adapter explicitly; the pipeline itself grants no model access.

Finalized-slice publication wakes preparation/analysis; periodic reconciliation covers missed events. Parallel decoding is bounded, publication is serialized, and backlog applies backpressure. Full mode waits for every required loss; partial policy completion remains labeled. Shared storage leases, source identities and remaining session budgets apply throughout. A ready slice alone is not permission to bypass any gate.

Operation snapshots track owner and registered children, phases, heartbeat and outcomes. Wrapper exit is not child completion. `recoverOperation(file, token, options)` verifies owner death, child identities and the current lock token; child termination requires explicit `terminateChildren` and bounded grace. Never remove a lock based only on a shell exit or PID number. On platforms without reliable birth identity, unsafe recovery fails closed.

## Calibration and observability

Both official calibration CLIs retain `attempts.json`, evidence manifests and exclusions. Resume only the same compatible identity. Interrupted attempts consume an attempt; ordinary admissible stage failure gets one fresh-directory retry, then count exclusion. Integrity/resource/owner-stop incidents propagate for resolution. Revalidate retained evidence when resuming unfinished calibration stages. Reuse completed worker recommendations under the main skill’s Calibration policy, independently of source/version identities or historical evidence manifests.

Memory preflight is explicit: supply all three flags `--memory-budget-bytes`, `--memory-reserve-bytes`, `--memory-per-worker-bytes`. Excluded stages retain their estimate/reason and are not fabricated measurements. Replay calibration needs an existing storage root or explicit `--max-bytes`. Preparation initializes accounting before writers start.

Use metadata status and operation events for routine progress. They distinguish reviewed losses and selected/full coverage. Use audit to verify resumed evidence. Source bytes remain authoritative; caches avoid repeated decoding/validation but do not replace hashing.

## Workflow gates and measurement

`workflow-controller.mjs gate EVIDENCE.json` evaluates explicit policy and completion/comparability/integrity inputs. It does not manufacture those inputs or persist promotion. Early research may proceed on reviewed evidence; replay/assembly/promotion require their ordinary evidence and source gates, including complete paired evaluation and strict improvement for promotion.

For offline representation diagnostics, use `benchmark-compact-review.ts OUTPUT.json COPIED_LOSS_LOG...`. For bounded corpus preparation, use `benchmark-review-workflow.ts prepare REQUEST.json`; it requires explicit corpus hashes/strata, case/time/storage limits and a separate output. Record actual bounded reading via `observe OBSERVATION.json OUTPUT`. Actual tokens may remain null when unavailable. Verified diagnostic replay results are recorded separately through the benchmark API. Neither byte reduction nor synthetic tests establish model throughput.

Consult the implementation/validation mapping in `docs/architecture/06-quality/ai-improvement-upgrades.md` before reporting achieved performance. Preserve the stopped campaign and its budgets; run diagnostics on copies in a separate scope.

## Pending rule retention

Before replay, consolidation or pruning, apply the active skill’s Pending reasons and accumulated replay cases policy. Below-threshold attempts remain pending; accumulated cases are retested against the current analysis source. Reason aliases do not imply that distinct corrective rules are identical. The 300-case cap counts distinct losses, never repeated executions. Existing replay tools do not automatically implement this cross-iteration ledger: the orchestrator must persist and verify its bindings, and treat unsupported current-policy reconstruction as blocked.
