# T7: Hand band safe centring

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T1
**Commit outcome:** Both hands group together at the horizontal centre, including the opponent's, and a hand wider than its band still scrolls from its first card.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is `feedback-duel.md` item 10.
- This slice: replace an auto-margin centring hack that breaks under `flex-direction: row-reverse` with `justify-content: safe center`.
- Out of scope here: hand ordering (T10), the zoom overlay (T4/T8/T9), the hand count badge.
- Assumptions in force: the opponent band stays visually mirrored; only the centring mechanism changes.

## Requirements

- With three opponent cards, the cards sit adjacent at the centre of the band — no card pinned to the left or right edge.
- With more cards than fit, the viewport scrolls and the first card remains reachable (this is why `safe` is required: plain `center` clips the overflow start in a scroll container).
- The player's own hand centring is unchanged in appearance.

## Inputs

- `src/styles/app.css`:
  - lines 2019-2025 — the hack to delete:
    ```css
    .duel-field-hand-band__viewport
      > .duel-field-card.is-hand-item:first-child {
      margin-left: auto;
    }
    .duel-field-hand-band__viewport > .duel-field-card.is-hand-item:last-child {
      margin-right: auto;
    }
    ```
  - lines 2043-2053 — `.duel-field-hand-band__viewport` (`display: flex; gap: var(--zone-gap); overflow-x: auto;`).
  - line 2059 — `.duel-field-hand-band.is-opponent .duel-field-hand-band__viewport { flex-direction: row-reverse; }`, which is why both auto margins land on the same visual side.
- `src/battle/app/components/duel-field/HandBand.svelte` — renders `.duel-field-hand-band__viewport` with `data-cy={`field-hand-p${player}-viewport`}`.
- `tests/unit/global-styles.test.ts` — the stylesheet assertion suite.
- `tests/component/HandBand.test.ts` — the component test.

## From Depends

- T1 changed documentation only; `src/` is unchanged from `main`.

## TDD

1. **Red** — add `hand viewports centre with safe centring, not auto margins` to `tests/unit/global-styles.test.ts`: assert `.duel-field-hand-band__viewport` contains `justify-content: safe center` and that the file no longer contains `is-hand-item:first-child`.
2. **Green** — delete the two hack rules, add the declaration.
3. **Refactor** — none.

## Test plan

| Test                                                         | Input          | Expect                                                                               |
| ------------------------------------------------------------ | -------------- | ------------------------------------------------------------------------------------ |
| `hand viewports centre with safe centring, not auto margins` | `app.css` text | contains `justify-content: safe center`; does not contain `is-hand-item:first-child` |
| `opponent hand keeps its mirrored direction`                 | `app.css` text | `.duel-field-hand-band.is-opponent` still declares `flex-direction: row-reverse`     |
| `hand viewport still scrolls horizontally`                   | `app.css` text | `.duel-field-hand-band__viewport` still declares `overflow-x: auto`                  |

## Impl steps

- [ ] 1. Add the three assertions to `tests/unit/global-styles.test.ts`; run `npx vitest run tests/unit/global-styles.test.ts` and see the first two fail.
- [ ] 2. Delete the `:first-child { margin-left: auto; }` and `:last-child { margin-right: auto; }` rules at `src/styles/app.css:2019-2025`.
- [ ] 3. Add `justify-content: safe center;` to `.duel-field-hand-band__viewport`.
- [ ] 4. Re-run the stylesheet test.
- [ ] 5. Run `npx vitest run tests/component/HandBand.test.ts`.
- [ ] 6. Manually check a duel opening: three opponent cards adjacent and centred; then a hand of 10+ cards scrolls with the first card reachable.

## Outputs

- Files touched: `src/styles/app.css`, `tests/unit/global-styles.test.ts`.
- Behaviour change: opponent hand no longer spreads to the band edges.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/unit/global-styles.test.ts` passes
- [ ] `npx vitest run tests/component/HandBand.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual: duel start shows the opponent's three cards grouped at the centre
- [ ] app functional — a large hand still scrolls and every card is reachable
- [ ] commit msg draft: `fix(hand-band): centre both hands with safe centring instead of auto margins`
