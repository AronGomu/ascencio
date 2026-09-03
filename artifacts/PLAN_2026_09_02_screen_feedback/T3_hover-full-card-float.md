# T3: Show full card scan on decklist hover

**Plan:** `./artifacts/PLAN_2026_09_02_screen_feedback.md`  
**Depends:** T2  
**Commit outcome:** Hovering/focusing decklist rows shows readable full card scans beside the row.

## Context (self-contained)

Goal: DS1. Existing hosts appear to pass `catalog.imageUrl` directly, so actual rendered source must be proven in Chromium first. Ensure payload is a full scan and readable; preserve anchor placement. Out of scope: tile cover images, mobile tap preview.

## Requirements

R1. Red test/repro captures current float `src`. If already `/runtime/images/{code}.webp`, keep it; if cropped, convert `/runtime/images-cropped/{code}.webp` to `/runtime/images/{code}.webp` for float only.
R2. Preserve row anchor + `FLOAT_GAP=12`; clamp inside viewport.
R3. Full card aspect ratio; readable size near 2.4× current row-height baseline, with viewport clamp.
R4. Show on pointer hover and keyboard focus; hide on leave/blur/filter removal.
R5. Missing full image degrades to existing cropped image or no float; no broken-image glyph.

## Inputs

I1. Read `DeckSelectScreen.svelte` hover functions/float markup, `DecklistPanel.svelte`, `tests/component/deck-select/hover-previews.test.ts`.
I2. From T2: updated tile contract; hover list contract unchanged.

## Interface contract (level 5)

P1. `DecklistPanel` emits `onrowhover(code: number, anchor: HTMLElement)` from `pointerenter` and focus; emits `onrowleave()` from pointerleave and blur.
P2. Float source helper: `fullCardImageUrl(cropped: string | null): string | null`, replacing first `/runtime/images-cropped/` segment with `/runtime/images/`.
P3. Float remains non-interactive (`pointer-events:none`), `alt=""`, `aria-hidden="true"`; row name supplies identity.
E1. `img.onerror` falls back once to cropped source, then hides.
N1. Stale async hover results never replace current hover token.

## TDD

1. **Red** — full URL, focus path, fallback and stale-hover tests.
2. **Green** — source mapping + size/focus changes.
3. **Refactor** — reuse existing token/placement code.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Hover row | Cropped URL | Float `src` uses `/runtime/images/` |
| Focus row | Keyboard focus | Same float shown |
| Full image fails | `error` event | Cropped fallback once/no broken glyph |
| Rapid hover | A promise resolves after B | B remains |

## Impl steps

- [ ] 1. Reproduce in Chromium and record actual float `src`/dimensions; extend hover preview tests red from observed gap.
- [ ] 2. Add focus emission and full-scan mapper/fallback.
- [ ] 3. Update card-aspect sizing and viewport clamp.

## Validation

- [ ] `npx vitest run tests/component/deck-select/hover-previews.test.ts`
- [ ] `npx vitest run tests/unit/data-cy-coverage.test.ts`
- [ ] `npm run typecheck && npm run lint`
- [ ] Manual: pointer + keyboard across main/extra/side rows; full card readable, no clipping.
- [ ] No silent-failure swallow added: image failure handled by visible fallback.
- [ ] App functional: deck preview swapping unchanged.
- [ ] Commit msg draft: `feat(deck-select): make row previews readable full cards`
