# Refinement report

Five additional iterations (5–9) completed through step 3.4 using the expanded rules. No commit or improvement run. Latest corrections have not received an extra review round.

## Rules and preservation method

All14 proposed additions are saved as rules19–32 in docs/developer-guide/skill-compression-rules.md, alongside the18 earlier approved approaches and rejected readability shortcuts. Each iteration has an immutable input snapshot/manifest, incoming template explanation, three fresh low-effort GPT-6.1 Sol explanations, removed-line ledger and independent preservation assessment.

behavior-inventory.json records38 baseline behaviors plus5 pinned current-source additions. boundary-scenarios.json has26 policy cases; source-update-boundary-scenarios.json adds6. Deletion audits are independent of reviewer comprehension. These walkthroughs are reasoning checks, not real-engine executions.

## Counted scope

Count all agent-facing skill/reference/default/metadata characters including whitespace. Executable-only controller/test source, input snapshots and refinement artifacts are excluded from instruction size; every operational policy remains in counted files, not hidden in code. Full physical package size is also shown. Snapshot copies are review evidence, never execution dependencies or claimed reductions.

| Version | Instruction characters | Physical package characters |
| --- | ---: | ---: |
| Initial original baseline | 53,805 | 53,805 |
| Iteration4 entering this request | 34,619 | 37,558 |
| Iteration5 | 35,365 | 38,304 |
| Iteration6 | 34,429 | 37,368 |
| Iteration7 | 34,083 | 37,022 |
| Iteration8 | 33,468 | 36,407 |
| Iteration9 | 34,933 | 37,872 |

Final instruction size: 34,933; physical package: 37,872. Comparisons use the initial pinned baseline, not a claim that the concurrently modified original has the same current size. Iteration9 incorporates additional requirements, so its count is not a pure compression-only comparison.

## Iterations

- 5: Centralized defaults. One reviewer misread raw milliseconds; corrected to one readable table with exact numbers/units and fixed versus overridable distinctions. Added one mandatory Prepare lookup.
- 6: Shortened reference explanations and illustrative report. Review summaries implied closure-only cleanup; explicitly restored eligible in-run rejected-version pruning under dependency rules.
- 7: Combined equivalent stop branches and temporary-evidence lifecycle. Independent deletion audit restored explicit receipt membership before review. All reviewers then preserved version-specific retention.
- 8: Shortened stage bodies to actions/completion gates. Kept setup seed, actual variant implementation and overlap resolution explicit. Three reviewers agreed on retained behavior.
- 9: Consolidated controller/calibration prose and removed a derived-default example. Incorporated a pinned updated analysis contract from concurrent original edits; clarified conversion-outside/publication-under-lock, generated report ownership and new evidence lifecycle. No further fresh review after final local corrections.

## Source drift

During iteration9, preservation assertions detected original-package edits outside this refinement's targeted sibling. original-source-drift.json records initial/observed identities and subsequent observations. iteration-9-source-update/ pins the incorporated current source. New requirements cover incremental slice sync, complete review pages, first-pass secondary reasons, checkpointed generated findings and explicit resumed-analysis audit. Unrelated original/workspace edits were preserved, not restored.

The final draft targets that pinned incorporated source, not any unreviewed later live changes. Initial-source preservation assertions failed at drift and are not reported as passing; later checks validate stable iteration-input snapshots, links and literal blocks instead.

## Validation

- test:context completed for initial and final selection; unrelated source changes were not adopted as a request for a full suite.
- Three dispatcher tests passed after configuration/stage rewrites and final corrections.
- Updated current analysis-slice tests:6 passed; dispatcher:3 passed in final two-file run. Formatting of controller/test files passed.
- Local inline/reference destinations, literal log/primary-analysis fenced blocks, snapshot hashes and all15 reviewer template structures passed.
- No full application suite, real evaluation, publication, original overwrite or unrelated implementation change.

## Limitations and handoff

Reviewer agreement is evidence of comprehension, not full executable equivalence. The dispatcher remains stateless; owning tools and orchestrator verify semantic evidence/authorization. Defaults introduces a setup lookup; reduced duplication and corrected misunderstandings are observed, but runtime usability/latency was not measured. New rules must still earn their cost; this pass does not add speculative quotas or approval flows.

Stopped after iteration9 step3.4 without committing. documents-index.md links current deliverables and retained histories; historical input copies preserve their original relative-path context.

## Additional iterations10–14

See [current follow-up report](iterations-10-14-report.md) for five further reviewed passes, current counts and limitations.
