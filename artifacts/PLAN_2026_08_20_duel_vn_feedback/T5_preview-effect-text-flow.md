# T5: Preview effect-text flow

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T1
**Commit outcome:** The card preview's effect text reads left-aligned directly under the stats row, at the same gap the name and stats use.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is `feedback-duel.md` item 1.
- This slice: pure CSS in the shared preview panel, pinned by the stylesheet test that already guards this file.
- Out of scope here: the preview's content, the stats row's contents (shipped in round 4), the scrollbar overlay.
- Assumptions in force: effect text is left-aligned, not justified; the gap between stats and text equals the `0.35rem` gap the body grid already uses between name and stats.

## Requirements

- `.card-preview-panel__text` has no `text-align: justify` and inherits a left-aligned flow.
- The effect text sits immediately below `.card-preview-panel__stats`, separated by `0.35rem`, with no extra bottom margin on the stats row creating a second, larger gap.
- The panel keeps its scrollable text region and its overlay scrollbar behaviour.

## Inputs

- `src/styles/app.css` lines 387-441:
  - `.card-preview-panel__body` — `display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 0.35rem;`
  - `.card-preview-panel__stats` — `margin: 0.15rem 0 0.4rem;` (the extra `0.4rem` bottom margin is the double gap)
  - `.card-preview-panel__text-region`, `.card-preview-panel__text` — the scroller.
- `src/shell/card-preview/CardPreviewPanel.svelte` — markup order: `h2[data-cy=card-preview-name]`, `p[data-cy=card-preview-stats]`, `div[data-cy=card-preview-text-region] > div[data-cy=card-preview-text]`.
- `tests/unit/global-styles.test.ts` — asserts rules by reading `src/styles/app.css` as text; follow the existing `it("bounds preview art by viewport height so effect text keeps scroll space")` case for style.

## From Depends

- T1 changed documentation only; `src/` is unchanged from `main`.

## TDD

1. **Red** — add two cases to `tests/unit/global-styles.test.ts`: `preview effect text is not justified` and `preview stats and effect text share the body gap`.
2. **Green** — edit the two rules in `src/styles/app.css`.
3. **Refactor** — none.

## Test plan

| Test                                               | Input          | Expect                                                                              |
| -------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| `preview effect text is not justified`             | `app.css` text | the `.card-preview-panel__text` block does not contain `text-align: justify`        |
| `preview stats and effect text share the body gap` | `app.css` text | `.card-preview-panel__stats` declares `margin: 0;` and the body grid `gap: 0.35rem` |
| `preview text keeps its own scroll region`         | `app.css` text | `.card-preview-panel__text` still declares `overflow-y: auto`                       |

## Impl steps

- [ ] 1. Add the three assertions above to `tests/unit/global-styles.test.ts`; run `npx vitest run tests/unit/global-styles.test.ts` and see the stats-margin case fail.
- [ ] 2. In `src/styles/app.css`, change `.card-preview-panel__stats` `margin: 0.15rem 0 0.4rem;` to `margin: 0;` so the `0.35rem` body-grid gap is the only separation.
- [ ] 3. In `.card-preview-panel__text`, add `text-align: left;` explicitly so no inherited or future justified rule can reach it.
- [ ] 4. Re-run the stylesheet test; then run `npx vitest run tests/component/CardPreviewPanel.test.ts` to confirm the component test still passes.
- [ ] 5. Visually check the panel in the duel and in the deck editor (the same component serves both, ADR-036).

## Outputs

- Files touched: `src/styles/app.css`, `tests/unit/global-styles.test.ts`.
- Behaviour change: preview effect text alignment and spacing.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/unit/global-styles.test.ts` passes
- [ ] `npx vitest run tests/component/CardPreviewPanel.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual: hover a card in a duel and in the deck editor — text starts right under the stats, left-aligned
- [ ] app functional — the preview still scrolls long effect text
- [ ] commit msg draft: `fix(preview): effect text reads left-aligned under the stats row`
