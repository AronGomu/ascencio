# T7: Full-height shell

**Plan:** `./ai_artefacts/PLAN_2026_08_13_feedback_follow_up.md`
**Depends:** T6
**Commit outcome:** Preview, explicit-px board, rail form one `100svh` row with no page scroll; supported profile/viewports hit measured sizes.

## Context (self-contained)

- Goal: Unlock card size by deleting vertical chrome/dead width; board derives both px dimensions from available middle column.
- This slice: Final app shell + measured viewport/profile acceptance. All 3 columns already functional.
- Out of scope here: preview internal scrollbar, settings persistence, card-list.
- Assumptions: default preview 22rem + rail 15rem; ≤1500px preview 18rem + rail 12rem; no-EMZ 1366×768 accepts 95.7% height.

## Requirements

- Replace `.duel-row`/`data-cy="duel-row"` with `.duel-shell`/`data-cy="duel-shell"`.
- `height:100svh`; columns `var(--preview-w) auto minmax(var(--rail-min),1fr)`; no header row/gap.
- Remove old board `min-width:52rem`, fixed aspect ratio, width-only stretch, horizontal pan assumptions.
- `.duel-field-slot` remains full middle-column budget owner + ResizeObserver target. Centre inner field within it.
- Inner `.duel-field` remains geometry-sized position/clamp boundary for floating windows, `overflow:hidden`; windows stay outside any inner board content. Never observe inner field.
- Board/inner field get explicit width + height from one geometry. Unused slot slack remains around inner field; rail consumes flexible shell remainder, never stretches board.
- No document/page horizontal/vertical scrollbar at supported desktop viewports.
- Update all old `duel-row` helper/comments/selectors in real-duel E2E.

## Inputs

- `src/app/App.svelte`, `src/app/components/DuelField.svelte`, `src/styles/app.css`.
- `tests/component/AppChrome.test.ts`, `tests/unit/global-styles.test.ts`, `e2e/duel-smoke.spec.ts` (`assertSharesFieldRow`, `duel-row`).
- `ai-artifacts/DESIGN_2026_08_13_full_height_duel_field.md` §§2,10,13.
- `ai_artefacts/manual_test_checklist.md` — append/update only T7 human checks; preserve all other sections.
- **From Depends:** `.duel-field-slot[data-cy="duel-field-slot"]` is observed budget owner; inner `.duel-field` is geometry-sized floating-window boundary; `FieldGeometry`; functional preview/field/rail; no header; acceptance scenarios/config.

## DOM/CSS contract

```html
<div class="duel-shell" data-cy="duel-shell">
  <CardPreviewPanel />
  <div class="duel-field-slot" data-cy="duel-field-slot">
    <DuelField />
  </div>
  <DuelRail />
</div>
```

```css
.duel-shell {
  height: 100svh;
  display: grid;
  grid-template-columns: var(--preview-w) auto minmax(var(--rail-min), 1fr);
  align-items: stretch;
  overflow: hidden;
}
:root { --preview-w: 22rem; --rail-min: 15rem; }
@media (max-width: 1500px) {
  :root { --preview-w: 18rem; --rail-min: 12rem; }
}
```

Expected measured board matrix (≤1px browser rounding):

| Viewport | Profile | Board |
| --- | --- | --- |
| 1920×1080 | EMZ | 1229×1080 |
| 1920×1080 | no-EMZ | 1304×1080 |
| 2560×1440 | EMZ | 1638×1440 |
| 2560×1440 | no-EMZ | 1740×1440 |
| 1366×768 | EMZ | 874×768 |
| 1366×768 | no-EMZ | 886×735 |

## TDD

1. **Red** — CSS structure/unit assertions + 6 viewport/profile Chromium measurements + window clamp regression.
2. **Green** — shell markup/CSS cleanup.
3. **Refactor** — remove obsolete row/pan/aspect rules and E2E helper assumptions, not unrelated responsive UI.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `uses one full-height three-column shell` | App | one shell, order preview→field→rail, no header/row |
| `has no page scrollbar` | 3 viewports | doc scroll dims=client dims |
| `matches measured board matrix` | 6 cases | table values ±1px |
| `keeps exact geometry ratio` | each case | DOM ratio≈`geometry.width/height` |
| `accepts no-EMZ small slack` | 1366×768 | ≈735 high; preview≥288px; rail≥192px |
| `keeps floating windows field-local` | resize/drag | border inside field; positions reclamp |
| `keeps zones/phases/stacks nonoverlapping` | both profiles | required rect intersections empty |
| `removes old shell constraints` | CSS/grep | no `.duel-row`, `52rem`, fixed 16:9 owner |

## Impl steps

- [ ] 1. Update `global-styles.test.ts`, AppChrome test, acceptance matrix; prove old shell fails.
- [ ] 2. Replace App row markup with exact `duel-shell` order while preserving T3 `.duel-field-slot` wrapper/binding.
- [ ] 3. Add CSS tokens/grid/100svh/overflow; retain field as window containing block.
- [ ] 4. Remove old board min-width/aspect/pan rules; let ResizeObserver calculate middle budget.
- [ ] 5. Update acceptance harness wrapper to production shell tokens without duplicating geometry decisions.
- [ ] 6. Replace `duel-row` assertions/helpers/comments in `e2e/duel-smoke.spec.ts` with shell/column relations.
- [ ] 7. Run full 6-case acceptance; adjust only rounding/tokens, never profile formula.
- [ ] 8. Run real-duel responsive/floating-window smoke.

## Outputs

- Modified: App, DuelField, app.css, AppChrome/global style tests, acceptance + smoke specs.
- Removed DOM/CSS contract: `.duel-row`, fixed-aspect/min-width horizontal board pan.
- Added stable selector: `data-cy="duel-shell"`.

## Validation

- [ ] `npx vitest run tests/component/AppChrome.test.ts tests/unit/global-styles.test.ts tests/unit/data-cy-coverage.test.ts` → exit 0.
- [ ] `npm run typecheck && npm run lint` → exit 0.
- [ ] `npx playwright test --config=playwright.acceptance.config.ts --project=chromium e2e-acceptance/full-height-field.spec.ts` → all 6 matrix cases pass.
- [ ] `npx playwright test e2e/duel-smoke.spec.ts --project=chromium --grep "responsive|floating field windows|production bundle"` → exit 0.
- [ ] `rg "duel-row|DuelHeaderBar|52rem" src tests e2e` → no stale shell authority.
- [ ] app functional — `npm run build` exits 0.
- [ ] commit msg draft: `feat(shell): fill viewport with preview field and rail`
