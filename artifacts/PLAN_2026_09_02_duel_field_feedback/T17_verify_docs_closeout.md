# T17: Full verification, DESIGN.md + checklist closeout

**Plan:** `./artifacts/PLAN_2026_09_02_duel_field_feedback.md` (§ Basilica residual pass, T13–T17)
**Depends:** T14, T15, T16
**Commit outcome:** whole gate green (`check:headless`, `build:verify`, e2e), DESIGN.md residual note rewritten to reflect shipped pass, manual test checklist covers the three restyled surfaces.

## Context (self-contained)

- Goal: Basilica Slate VariantB applied to dialogs, deck editor panels, story overlays.
- This slice: cross-cutting verification + durable doc closeout. No new styling.
- Out of scope here: any further visual change (defect found → fix goes to owning ticket's files as follow-up commit, not silent expansion here); duel HUD; deck select.
- Assumptions in force: T14/T15/T16 landed; tokens brand-wide (T13).

## Requirements

- Run full gate + per-domain build budgets.
- Rewrite DESIGN.md "Applying it" residual bullet: dialogs/deck-editor/story-overlays no longer residual; duel HUD remains excluded by owner decision (2026-09-02); selection amber kept, ambiguity not flagged.
- Extend `artifacts/manual_test_checklist.md` (durable, never retired) with VariantB checks for the three surfaces.
- Durable docs cite commit SHAs / PDDR path, never `artifacts/PLAN_*` (AGENTS.md → Document rules).

## Inputs

- files: `DESIGN.md` (→ Applying it, last bullet), `artifacts/manual_test_checklist.md`, `docs/feature/PDDR-basilica_residual_ui.md`.
- **From Depends:** T14 restyled shared `app.css` `.dialog-panel`/`.dialog-backdrop` to VariantB (opaque `--surface-panel` + chamfer + gold line + blur-12 backdrop; 5 titled dialogs carry `ui-dialog-title`; `DropConfirmDialog`/`ShellSettingsDialog` inherit); T15 gave editor panels `ui-glass-panel ui-chamfer`, editor dialogs `ui-dialog-panel ui-chamfer` + `ui-dialog-title`, context menus square; T15 gave `OverlayShell` `--bg-deep`-55% blur-6 scrim + `ui-glass-panel ui-chamfer` panel. Source-text rules + class names are the checkable surface.
- cmds: `npm run check:headless && npm run check:browser`. Rationale: `check:headless` runs **no** `test:component` (where T14–T16 tests live); standalone `build:verify` reads an existing `dist/` (`scripts/verify-browser-build.ts:31-34`) — stale or missing on clean tree; bare `npx playwright test` runs chromium + firefox-smoke + webkit-smoke projects (`playwright.config.ts:24-45`). `check:browser` = `test:component && build && build:reproducible && test:e2e && test:acceptance`, and `build` chains `build:app` before `build:verify` — covers all three correctly (`package.json:28,45`).

## Interface contract (level 5)

- **Produces:** green outputs of `npm run check:headless && npm run check:browser` (captured in commit/PR notes); DESIGN.md bullet replacing the residual list, citing `docs/feature/PDDR-basilica_residual_ui.md`; checklist section `## Basilica VariantB residual pass` with one step per surface.
- **Consumes:** T13–T16 class names verbatim.
- **Errors:** any red cmd = ticket not done; quote exact failing output, bounded repair (E5), else report blocker.
- **Invariants:** no visual diffs introduced here; docs cite immutable anchors only.
- **Integration links:** trigger e2e specs `e2e/*.spec.ts` → dispatch Playwright Chromium against `vite preview` build → observe assertions on `data-cy` selectors (unchanged by T14–T16, so pre-existing specs must stay green).

## TDD

1. **Red** — n/a for gate runs; checklist additions written before final gate so a human can falsify them.
2. **Green** — all cmds green.
3. **Refactor** — none.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| full gate | `npm run check:headless` | exit 0 |
| browser gate | `npm run check:browser` | exit 0 (component tests, build + budgets, reproducible build, e2e, acceptance) |
| docs | read DESIGN.md | residual bullet rewritten, HUD exclusion recorded |

## Impl steps

- [ ] 1. Extend `artifacts/manual_test_checklist.md` (duel dialogs, editor panels, story overlays — open each, verify chamfer/gold/title, verify interactions).
- [ ] 2. Rewrite DESIGN.md residual bullet.
- [ ] 3. Run `npm run check:headless && npm run check:browser`; capture outputs.
- [ ] 4. Failures → bounded repair in owning ticket's scope; re-run.

## Validation

- [ ] tests pass: `npm run check:headless && npm run check:browser`
- [ ] manual check: run new checklist section once, tick results
- [ ] no silent-failure swallow added: `none`
- [ ] app functional — all three domains reachable through `index.html`
- [ ] commit msg draft: `docs(design): close basilica residual pass — VariantB shipped to dialogs, editor, story overlays`
