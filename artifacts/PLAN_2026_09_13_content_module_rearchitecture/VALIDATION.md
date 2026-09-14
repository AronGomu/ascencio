# Planning validation

## State

A1. **done — planning only.** Markdown index, standalone HTML, 11 self-contained tickets, binding contract catalog, ADR-089–094. Every implementation ticket remains NOT STARTED.
A2. Independent index red-team corrected dependency order before ticket writing. Independent coherence review plus bounded recheck resolved R1–R5/N1–N2; zero remaining review blockers. Reports: REVIEW_INDEX.md, REVIEW_DISPOSITIONS.md, REVIEW_COHERENCE.md.
A3. No application source implementation, Git commit/push/sync, package change, system apply, remote publication or deployment. Root remains `main...origin/main [behind 15]`; unrelated dirty work preserved.

## Commands / observed evidence

| ID | Command | Actual result |
| --- | --- | --- |
| E1 | `node artifacts/PLAN_2026_09_13_content_module_rearchitecture/validate-plan.mjs` | `PASS: 11 tickets; 13 DAG edges; 60 embedded contract copies; TypeScript syntax; index links; 6 ADRs; offline HTML structure.` |
| E2 | `node artifacts/PLAN_2026_09_13_content_module_rearchitecture/validate-plan-browser.mjs` | `PASS: Chromium desktop/mobile; 11 ticket accordions; 6 ADRs; search/expand/collapse/hash navigation; no horizontal page overflow; zero external requests; zero page errors.` |
| E3 | `npx vitest run tests/unit/domain-boundaries.test.ts --reporter=verbose` | Existing root baseline: `Test Files  1 passed (1)`; `Tests  12 passed (12)`. Not target-main/new-boundary proof. |
| E4 | `git diff --check -- docs/ADR docs/README.md docs/architecture/architecture.md` | Exit 0; no whitespace errors. |
| E5 | `git diff --numstat -- docs/ADR` plus parent assertions | 14 existing ADRs each exactly +1/-0 amendment pointer; bodies unchanged. |

Additional parent assertions: no diff under src/scripts/tests/e2e/e2e-core/package/vendor; no staged files; new ADR links resolve. Chromium screenshots visually inspected: `plan-desktop.png`, `plan-mobile.png`. Existing environment sets PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS; actual browser tests still launched and passed.

## Scope of evidence

L1. Proposed TypeScript contracts syntax-checked, **not typechecked against unimplemented modules**. Independent reviewer also compared all 60 contract/prose copies: zero mismatches.
L2. Browser evidence covers generated plan document, not future application behavior. Real-WASM, progressive downloads, save migration, PWA consent, fake-R2 publisher tests are ticket acceptance obligations, not completed implementation.
L3. Full application suites not run: docs-only work; known generated/local asset readiness belongs T1 preflight. No passing whole-suite claim.
L4. Graph-first lookup ran; graph output truncated and skill/package mismatch reported. Graph rebuild/config upgrade skipped to avoid unrelated generated/config edits. Direct source inspection is authoritative.
L5. Live R2/account/rights/CORS/public deployment remains unverified and excluded from local implementation acceptance. T1 frontloads deployment-only prerequisites without recording secrets.

## Bounded repairs during planning

R1. Ticket generator first attempt failed exactly `NameError: name 'x' is not defined`; fixed missing generator iteration. Rerun created remaining tickets; existing identical T1 was preserved.
R2. First two mobile HTML checks failed exactly `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:` followed by `false !== true` at validate-plan-browser.mjs:32:10. Long unbroken contract prose caused 700px page width at 390px viewport. Scoped prose wrapping plus explicit closed-details content hiding fixed overflow. Final actual check passed.
R3. Exploratory source-path ENOENT attempts were corrected through filesystem discovery; guessed paths are not authoritative ticket inputs. Details in CONTEXT.md F10 and scout reports.

## Files touched

F1. New planning deliverables: `artifacts/PLAN_2026_09_13_content_module_rearchitecture.md`, sibling HTML, ticket directory containing T1–T11, CONTEXT/CONTRACTS/reviews/validation scripts, dependency manifest, screenshots.
F2. Interview/scout evidence: `artifacts/GRILL_2026_09_13_content_module_rearchitecture/` including original round, approved answers, two source reports.
F3. New durable records: `docs/ADR/089_ADR_canonical_cards_and_focused_decks.md` through `094_ADR_explicit_media_updates_and_cleanup.md` (six distinct decisions).
F4. Existing docs: one-line amendment pointers in ADR-022/026/036/039/075–080/082/085/086/088; surgical planned-decision register additions in docs/README.md and docs/architecture/architecture.md. Pre-existing docs/README.md dirty change retained.
F5. Harness-owned subagent transcripts/output copies retained in their runtime artifact locations. No user-authored input, feedback or handoff rewritten.

## Assumptions / next implementation gate

S1. Main is delivery target, not authorization to mutate dirty main. T1 first establishes safe clean implementation lane and file-level T7 salvage inventory. No history rewrite or discard.
S2. Full SHA-256 versions, integer compatibility epoch, separate Story generations plus sole Shell selector are explicit technical defaults supporting locked product behavior.
S3. No deployed ZIP bridge. Legacy raw slots remain preserved/incompatible; supported per-file-release saves migrate forward without silently altering previous active generation.
S4. Planning completion authorizes no implementation automatically. Next bounded action: open T1_baseline-preflight.md.

## Cleanup

C1. Removed after reading/verifying own contents: `.tmp/content-plan-generator.py`, `.tmp/render-content-plan.py`. Final HTML rendered from already-read renderer in memory after removal. Only parent-created scratch deleted; deliverables and harness evidence retained.
