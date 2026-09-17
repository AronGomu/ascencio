# Content module rearchitecture — consolidated PR report

State: implemented, independently accepted. Source acceptance commit: `9bfd04e`.

## Results

| ID  | Gate                          | Verified result                                                                                                      |
| --- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| V1  | `npm run check:browser`       | 1,269 component tests; 139/139 E2E; 41/41 acceptance; zero skips; build/budgets/reproducibility pass                 |
| V2  | `npm run check:headless`      | 220 legacy; 2,732 unit; 54 integration; types/lint/format/vendor/assets/snapshot pass; four existing Svelte warnings |
| V3  | `npm run test:core`           | 11/11 native Chromium                                                                                                |
| V4  | Independent production review | 287 targeted tests; 1,173/1,173 frozen source hashes match; no blockers                                              |
| V5  | Independent acceptance review | Final command exits, stage JSON, fixture integrity, assertion mapping verified; no blockers                          |

Evidence: `IMPLEMENTATION-REPORT-T11-repair.md`, `REVIEW-T11-production.md`, `REVIEW-T11-acceptance.md`. Exact successful runs: T11 repair 114 (browser), 115 (headless), 116 (native core). Earlier failed/interrupted runs remain recorded; they are not counted as passes.

## Delivered scope

- D1. T1–T3: canonical Cards, focused Decks APIs, shared presentation boundaries; accepted baseline transferred append-only.
- D2. T4–T6: immutable per-file publication, verified progressive download/resume/storage, forward-safe copy-on-write Story save generations.
- D3. T7–T9: semantic Battle runtime injection, Shell semantic preparation, atomic content/save selector with cross-tab lifecycle leases.
- D4. T10: explicit content/media downloads, owned asset cleanup, durable exact-build CORE update consent.
- D5. T11: integrated regression evidence; mounted image ownership, stale hover, canonical printing keys, bounded manifest parse memo, precise nonfatal browser warning handling.

## Git / Forgejo scope

- G1. One PR groups all commits ahead of original Forgejo `main`, preserving both reconciled histories. No squash, rebase, reset, force push, or merge performed.
- G2. Original `aron/ascencio` is a mirror with pull requests disabled. Writable `aron/ascencio-review` fork hosts review; original mirror stays unchanged.
- G3. PR source: `review/content-module-rearchitecture`; target: review fork `main`, initially `b197f885f0ff0122f8748249908a9e2a1fe15601`.
- G4. Source/tests/docs and selected implementation/review reports included. Multi-gigabyte browser traces, raw transcripts, process IDs, temporary runtime evidence, generated asset bytes, and unrelated untracked artifacts remain local. No mass staging/deletion.

## AI telemetry

- A1. `AGENTIC-REPORT-content-module-rearchitecture.html`: standalone dark report with model/thinking aggregation, task/run table, filters/sorting, timeline, JSON export.
- A2. Companion JSON contains sanitized metrics and source hashes only; no raw prompts or tool transcripts.
- A3. Recorded harness cost estimates are not invoices. Available parent/child usage includes repeated context/cache tokens; interrupted unlogged work and later report/PR actions may be absent.
- A4. Report scope starts with this orchestration session; earlier T1–T3 implementation sessions outside its transcript tree are not priced. T1–T3 integration work within this session is included.

## Residuals / process deviations

- R1. Original T10 strict test-first chronology was missed. Retrospective RED evidence does not retroactively satisfy TDD.
- R2. Four image providers that never settle after abort can occupy all physical acquisition slots; optional art stays placeholder. Legal input remains independent. Library acquisition cap is per mount.
- R3. Shell recovery keyboard-focus handoff and mixed menu/hover interaction overlap remain documented gaps; no claim of equivalent removed fatal-heading focus coverage.
- R4. Graph refresh deferred after quota exhaustion. No redistribution approval, publication, deployment, or physical-device certification implied. `publishReady: false` remains a separate rights gate.
- R5. Two long-running T11 repair runners disappeared. Retained partial work was recovered; final complete gates supersede interrupted runs without erasing them.

## Assumptions

- S1. “Everything new” means accepted project changes and useful sanitized reports, not raw multi-gigabyte traces or private session transcripts.
- S2. Writable review fork is required because mirror cannot host PRs; no mutation of original mirror settings or history.
- S3. No full source revalidation required for report-only additions after accepted source gates; HTML/JSON functionality and final staged diff are checked separately.
