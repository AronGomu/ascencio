# Baseline reconciliation implementation report

State: **done**. P1 only. Current-plan T4 not implemented.

## Outcome

| ID | Result | Evidence |
| --- | --- | --- |
| O1 | Both original histories preserved append-only. | Merge commit `cd35be0bb518de264ddc91d0cb937a287f78785b` has first parent `b197f885f0ff0122f8748249908a9e2a1fe15601`, second parent `010401956d0cd59d8e6dda91bd367040f5de669e`; `artifacts/BASELINE-RECONCILIATION/preservation.log` records both ancestry checks exit 0. |
| O2 | Independently accepted T1–T3 source/tests transferred into root. | Commit `e338808ffbe790d8dc9a3210a7467535fb293c58`; 244 inventory transfer paths, 0 collision/hash mismatches. Exact paths: `artifacts/BASELINE-RECONCILIATION/changed-files.json`. |
| O3 | Root documentation choice retained. | `docs/GLOSSARY.md` remains absent; ADR-089–094 hashes match pre-merge root; all root-only touched docs show no drift against `b197f885f0ff0122f8748249908a9e2a1fe15601`. |
| O4 | Original detached lane retained as recovery copy. | Lane HEAD, status SHA-256, and all 269 inventoried path hashes match pre-mutation inventory; `artifacts/BASELINE-RECONCILIATION/preservation.log`. |
| O5 | Existing root untracked work retained. | All 29 expanded pre-existing root status entries match hashes in `artifacts/BASELINE-RECONCILIATION-T4.json`; mismatch count 0. |

## Commits

| ID | SHA | Purpose |
| --- | --- | --- |
| C1 | `cd35be0bb518de264ddc91d0cb937a287f78785b` | `merge(content): preserve reconciled baseline histories`; merges original lane tip into root, resolves sole `docs/GLOSSARY.md` modify/delete conflict to root deletion. |
| C2 | `e338808ffbe790d8dc9a3210a7467535fb293c58` | `feat(content): integrate accepted T1-T3 baseline`; transfers exact accepted lane source/test/config delta plus pre-mutation inventory. |

No reset, rebase, amend, revert, cherry-pick, force operation, branch deletion, push, PR, deploy, system apply, or T4 implementation occurred.

## Changed paths

| ID | Set | Exact evidence |
| --- | --- | --- |
| P1 | Merge against first parent: 309 historical paths. | `artifacts/BASELINE-RECONCILIATION/changed-files.json` → `mergeCommit.changesAgainstFirstParent`. Historical `CORE_ACCEPTANCE/T4` paths belong to merged 2026-09-12 CORE history, not current content-module T4. |
| P2 | Accepted lane transfer: 244 source/test/config paths. | `artifacts/BASELINE-RECONCILIATION-T4.json` → entries with `decision: "transfer"`; duplicate exact list in `changed-files.json` → `acceptedTransferPaths`. |
| P3 | Transfer commit: 245 no-rename paths. | 244 accepted paths plus `artifacts/BASELINE-RECONCILIATION-T4.json`; `changed-files.json` → `transferCommit.changes`. Git display inferred four renames, yielding 241 displayed entries; no-rename allowlist check matched 245/245. |
| P4 | Task evidence: ledger, report, exact logs/manifests. | `artifacts/IMPLEMENTATION-LEDGER-T4-through-T11.md`, this report, `artifacts/BASELINE-RECONCILIATION/`. These remain untracked beside pre-existing owner artifacts; staging remains empty. |

## Tests added or updated

T1–T3 transfer adds 10 test/fixture paths, updates 114 test paths, deletes 0 tests. Exact 114-path update set: `artifacts/BASELINE-RECONCILIATION/changed-files.json` → `testsUpdated`.

| ID | Added path |
| --- | --- |
| T1 | `tests/component/shell-card-image-status.test.ts` |
| T2 | `tests/component/story/card-preview-host.test.ts` |
| T3 | `tests/fixtures/catalog.ts`; `tests/fixtures/fake-r2.ts`; `tests/fixtures/progressive-release.ts` |
| T4 | `tests/unit/cards.test.ts`; `tests/unit/installed-card-image-source.test.ts`; `tests/unit/progressive-fixture.test.ts` |
| T5 | `tests/unit/progressive-release.test.ts`; `tests/unit/shared-svelte-ui.test.ts` |

## Validation

| ID | Command | Exit | Actual output |
| --- | --- | --- | --- |
| V1 | `git diff --check` | 0 | No output. Exact log: `artifacts/BASELINE-RECONCILIATION/git-diff-check.log`. |
| V2 | `npm run typecheck` | 0 | `tsc --noEmit` passed; `svelte-check found 0 errors and 4 warnings in 3 files`. Exact log: `artifacts/BASELINE-RECONCILIATION/typecheck.log`. |
| V3 | `npx vitest run tests/unit/cards.test.ts tests/unit/shared-svelte-ui.test.ts tests/unit/progressive-release.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose` | 0 | `Test Files  4 passed (4)`; `Tests  121 passed (121)`. Exact log: `artifacts/BASELINE-RECONCILIATION/requested-vitest.log`. |
| V4 | Baseline preservation script | 0 | Both original SHAs ancestors; root pre-existing hash mismatches 0; transfer mismatches 0; lane path mismatches 0; staged paths 0. Exact log: `artifacts/BASELINE-RECONCILIATION/preservation.log`. |
| V5 | Staged secret-pattern scans | 0 | Merge staged diff hits 0; accepted-transfer staged diff hits 0. Patterns covered private-key headers, credential assignments, AWS access-key IDs. No candidate contents printed. |

Command manifest with exit codes: `artifacts/BASELINE-RECONCILIATION/commands.json`.

## Preserved untracked work

Initial root artifacts remain byte-identical: T1–T3 ledger/report set, T4–T11 preflight report, approved Markdown/HTML plan, plan directory. Exact 29 expanded paths and SHA-256 values: `artifacts/BASELINE-RECONCILIATION-T4.json` → `rootStatusEntries`.

Lane-local 24 implementation-evidence paths remain only in recovery lane. No blanket copy of `.tmp`, generated files, artifacts, `.agents`, or skills occurred.

## Glossary attribution

Lane T3 changed `preview` definition to: “Sticky, prop-only card art + bounded scroll text view shared by duel, editor, collection, and shop hosts” at `src/shared-svelte-ui/card-preview/CardPreviewPanel.svelte` plus `src/battle/app/presentation/card-preview.ts`. Root commit intentionally deleted glossary. Reconciliation preserves this attributable implementation fact here without recreating `docs/GLOSSARY.md`.

## Assumptions

| ID | Assumption |
| --- | --- |
| A1 | Actual lane deltas under `src/`, `tests/`, `e2e-acceptance/`, plus `eslint.config.js`, are accepted T1–T3 work per root report and lane T2/T3 inventories. |
| A2 | Lane-local reports/evidence remain recovery records; current root report captures required attribution without copying all lane artifacts. |
| A3 | Requested four-file Vitest command and inspected `package.json` `typecheck` script define P1 validation scope; full suite is outside P1. |

## Residual risks

| ID | Risk |
| --- | --- |
| R1 | Validation is narrow: full unit/component/integration/browser suites not rerun during reconciliation. Prior lane reports record broader historical evidence, not fresh root proof. |
| R2 | Typecheck retains 4 known Svelte warnings in 3 files; no errors. No broad repair attempted. |
| R3 | Historical merge introduces 309 paths from accepted lane history, including old CORE evidence. Path set is exact in manifest; current-plan T4 source remains pending. |
| R4 | Task report/logs/ledger remain untracked intentionally with existing root artifacts. No staged files. |

## Parent decision

Parent confirmed route `openai-codex/gpt-5.6-sol:high`, fresh context, before first edit; child runtime lacked direct model metadata. Parent directed sole-writer P1 reconciliation, append-only preservation of both histories, root docs intent, untouched recovery lane, no user prompts, no T4 implementation. P1 complete; T4 → T5 → T6/T7 → T8 → T9 → T10 → T11 remain pending review gate.
