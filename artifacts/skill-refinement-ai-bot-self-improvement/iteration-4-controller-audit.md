# Iteration 4 — controller audit and approved approach mapping

The owner approved structural compression, executable/stage-specific orchestration, current-only support and a minimal example. Readable prose/tables remain mandatory; symbolic policy languages and encoding were rejected. The original package remains unchanged.

## Audited guarantees

| Responsibility | Evidence | Refinement decision |
| --- | --- | --- |
| Admission and accounting | `control-session.ts`: locked controller, frozen/accepted identity checks, attempt reservation/settlement, sticky owner token, explicit continuation, persistent wall-clock origin; `batch-session-accounting.ts` supplies shared charges | Keep effective budgets/authorization in policy; delegate reservation/ledger mechanics to owning controller |
| Storage and publication | `output-storage.ts`: cross-process lock, logical usage, 16 MB reserve, staged/fsynced atomic publication and quota marker | Retain cap/headroom/retention policy; omit duplicate lock/publication recipe, require shared gate |
| Analyst claims and loss visibility | `analysis-slices.ts`: durable whole-slice ownership, packet hashes, allowlisted target-loss projections, coverage/report verification | One mandatory slice reference; no independent ad hoc analyst claims |
| Scoring | `aggregation-statistics.ts:129` computes equal-opponent completed paired game rates, timeout exclusions and strict recommendation; aggregator additionally emits confidence/match diagnostics | Require game-decision evidence and explicit semantic verification; diagnostic output does not become promotion policy |
| Candidate publication | `apply-decision.ts` checks settled ledger, source/validation/fixture bindings and recoverable publication | Do not claim the publication transaction itself proves every acceptance/replay condition |
| Deadlines | `typescript-native-executor.ts` and `replay-pool-process.ts` enforce execution deadlines/process lifecycle | Retain timeout values, incident classes and authorization distinctions, rather than repeat implementation internals |
| New stage dispatch | Packaged `scripts/workflow-controller.mjs` validates legal transitions and emits inherited policy with one stage's action text | Executable stage interface; completion remains an evidence-backed orchestrator obligation, not an unverified boolean treated as proof |

The new stage dispatcher is stateless. It neither starts real execution nor writes run state, verifies semantic receipts, claims autonomous budget ownership or grants authorization. Existing controllers remain authoritative; required semantic gates remain in readable policy. This is a deliberate boundary, not a claim that the full improvement process has been automated.

## Approved approaches applied

| Approach | Application |
| --- | --- |
| Executable controller and one stage task | Compose existing execution controllers with a tested transition/task dispatcher; preserve unproven semantic gates |
| Readable state machine | Explicit stage/outcome/next-stage table, matching executable transitions |
| Current-only support | Remove legacy readers/runners, ledger anchoring and old-limit migration; reject incompatible checkpoints without changing old project implementations |
| Source-selection matrix | Ordinary versus repair source, operation, control/base and comparator defined once |
| Incident matrix | Timeout, interruption, calibration failure, unsafe failure, analyst stop and resource/owner stop rules centralized |
| Artifact lifecycle | One contents/retention/cleanup table and one final-summary contract |
| Inherited rules/action-only stages | Every stage inherits policy; task bodies contain actions and completion gates |
| Supporting prose and minimal example | Preserve literal log/analysis blocks; shorten explanatory text and replace fictional report under explicit owner authorization |
| Proven tool guarantees | Remove repeated mechanics only after source inspection and related local tests |
| Discoverable commands/reference links | Responsibility index and reusable Markdown destinations; owning entry points supply schemas |
| Vocabulary/positive scope | Remove glossary duplication; retain existing interface mapping and positive target-loss allowlists, with explicit critical access boundaries in slice reference |
| Ambiguity resolution | Explicit early no-candidate outcome, one-CPU stop, finalized ignores versus corruption, material overlap changes, separate diagnostic accounting and dispatcher limitations |

## Validation

`npm run test:context` completed. Exact local selection passed: `refined-improvement-controller.test.ts` (3), `bot-session-control.test.ts` (11), `bot-output-storage.test.ts` (5), `bot-analysis-slices.test.ts` (5): 24 tests. New tests cover transition order, no implicit suspended/closed progression, prototype-key rejection and inherited-policy/current-action extraction. Existing tests corroborate the mechanical guarantees above; they do not certify all replay/promotion semantics.

Syntax check and CLI task smoke check passed. Original source hashes match their initial manifest. Literal fenced output blocks in the log and both analysis references remain identical; inline and reference-style local Markdown destinations resolve. Formatting was applied only to new executable/test files. No improvement run, legacy migration or unrelated-work modification was performed.

The runtime test outputs are in `.tmp/test/logs/local-runs/1794733519717-527533/`. A bounded search initially requested a nonexistent `paired-game-decision.ts`; source discovery identified the actual implementation in `aggregation-statistics.ts`, which was then read directly. No runtime command failure required recovery.
