# T5: Center hand cards

**Plan:** `./ai-artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`
**Depends:** none
**Commit outcome:** Hand cards sit horizontally centered in the hand band (both players); overflow scrolling still reaches every card.

## Context (self-contained)

- Goal: duel feedback round 4 — YGO story duel simulator (Svelte 5). User: "The cards in the hand must be centered horizontally… naturally at the middle of the duel field."
- This slice: pure CSS on the hand band viewport. Hand cards are flex items in `.duel-field-hand-band__viewport` (`display: flex; overflow-x: auto; overflow-y: hidden`), currently left-packed (opponent: right-packed via `flex-direction: row-reverse`).
- Why not `justify-content: center`: with overflow, centered flex content clips its leading edge unreachable (scrollLeft cannot go negative). Use the auto-margin idiom: `margin-left: auto` on first item + `margin-right: auto` on last item centers when there is free space and degrades to normal scrolling when there is none. `row-reverse` flips first/last visually, still correct.
- Out of scope here: hover zoom (T6/T7), hand band height/geometry, scrollbar.
- Assumptions in force: acceptance harness scenarios `field-hand-6` (fits) and `field-hand-20` (overflows) exist and stay the fixtures.

## Requirements

- ≤ hand that fits: card cluster horizontally centered in the band viewport (±8 px).
- Hand that overflows: no regression — first and last card reachable by scrolling; overlay scrollbar still works.

## Inputs

- `src/styles/app.css` — `.duel-field-hand-band__viewport` block (~line 1828) and `.duel-field-card.is-hand-item` block (~line 1790).
- `src/battle/app/components/duel-field/HandBand.svelte` — markup (no change expected).
- Acceptance harness: `e2e-acceptance/full-height-field.spec.ts` (patterns: `page.goto("?scenario=field-hand-6")`, `boundingBox()` assertions), config `playwright.acceptance.config.ts`, scenarios in `src/battle/app/acceptance/full-height-field-scenarios.ts`.

## TDD

1. **Red** — new spec block in `e2e-acceptance/full-height-field.spec.ts`:
   - test name: `hand cards are centered when the hand fits` — goto `?scenario=field-hand-6`; viewport = `[data-cy="field-hand-p0-viewport"]`; cards = `[data-cy="field-hand-p0-viewport"] .duel-field-card`. Compute clusterCenter = (firstCard.left + lastCard.right)/2 via `boundingBox()`; assert `Math.abs(clusterCenter - (viewport.x + viewport.width/2)) <= 8`. Repeat for `field-hand-p1-viewport` (opponent).
   - test name: `an overflowing hand still scrolls to both ends` — goto `?scenario=field-hand-20`; assert `scrollLeft === 0` shows first card (`boundingBox().x >= viewport.x - 1`), then `viewport.evaluate(el => el.scrollLeft = el.scrollWidth)`; assert last card right edge `<= viewport right + 1`.
2. **Green** — CSS below.
3. **Refactor** — none.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| hand cards are centered when the hand fits | scenario field-hand-6, p0 + p1 | cluster center within 8 px of viewport center |
| an overflowing hand still scrolls to both ends | scenario field-hand-20 | first card at scrollLeft 0; last card reachable at max scroll |

## Impl steps

- [ ] 1. Add the two tests; run `npx playwright test -c playwright.acceptance.config.ts e2e-acceptance/full-height-field.spec.ts`; centered test red (build step in webServer is slow — one run covers both states).
- [ ] 2. `src/styles/app.css`, after `.duel-field-card.is-hand-item` block, add:
      ```css
      .duel-field-hand-band__viewport > .duel-field-card.is-hand-item:first-child {
        margin-left: auto;
      }
      .duel-field-hand-band__viewport > .duel-field-card.is-hand-item:last-child {
        margin-right: auto;
      }
      ```
      (Applies to both players: `row-reverse` reorders visually, auto margins still absorb free space symmetrically.)
- [ ] 3. Re-run the acceptance spec → green.
- [ ] 4. `npm run format:check && npm run lint`.
- [ ] 5. Manual check: dev duel with 5-card hand → centered under field middle; draw to overflow → scrolling intact.

## Outputs

- Files touched: `src/styles/app.css`, `e2e-acceptance/full-height-field.spec.ts`.
- Behavior: visual only; no API change.
- Migrate/config: none.

## Validation

- [ ] tests pass: `npx playwright test -c playwright.acceptance.config.ts e2e-acceptance/full-height-field.spec.ts`
- [ ] manual check: centered hand at 5 cards, scroll at 20
- [ ] app functional — no broken path from this slice
- [ ] commit msg draft: `feat(field): center hand cards inside the hand band`
