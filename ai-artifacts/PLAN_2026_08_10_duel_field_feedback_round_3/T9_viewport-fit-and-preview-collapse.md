# T9: Viewport fit and preview collapse

**Plan:** `./ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
**Depends:** T8
**Commit outcome:** Default duel mode occupies exactly one viewport with no page scrollbar; the preview takes available left width, moves below the field only when width forces it, and collapses to thumbnail/name/scrolling text on short viewports. Zone-list card art never exceeds `50svh`.

## Context (self-contained)

- Goal: ship all 30 items of `feedback.md`.
- Covers items 9, 20, 21 and 27.
- Current `main` has unconstrained block flow, `main` bottom padding `3rem`, fixed preview width `22rem`, and a narrow breakpoint that leaves the preview **above** the field. Existing e2e `wheel over the duel field scrolls the page` codifies behaviour item 9 now rejects; replace it.
- Out of scope: changing 52rem board minimum or 44 px targets; phase/hand geometry; moving modal prompt controls into the field; hiding optional HUD/workspace content when user explicitly enables it.
- Assumptions **A7/A8/A20**: default duel chrome (header + duel row) fits `100svh`; page scrollbar absent. Internal horizontal panning inside `.duel-field` remains allowed when viewport cannot fit 52rem. Preview yields before board: wide = left and elastic; narrow = below; short = small art thumbnail + name + independently scrolling effect text. Prompt/dialog preview image max `50svh`.

## Requirements

- `#app` uses exactly `height:100svh`, two rows: header auto, main `minmax(0,1fr)`. `body` and `#app` do not scroll in default duel-only mode.
- `main` gains `.is-duel-viewport` only while a board/snapshot is shown and both optional `showDuelHud` and `showWorkspace` are false. In that mode: `height:100%`, `min-height:0`, `padding-bottom:clamp(.5rem,1svh,1rem)`, `overflow:hidden`. Grid sizing includes this bottom breathing room; it never creates page scroll.
- When picker/loading/error/HUD/workspace is shown instead, normal document scrolling remains available. Do not trap settings or diagnostics offscreen.
- `.duel-row` fills available main height and has `min-height:0`.
- Wide grid: `grid-template-columns: minmax(22rem, 0.45fr) minmax(52rem, 1fr)`. Preview grows beyond 22rem when space exists; field retains ≥52rem content width.
- At the exact breakpoint where both columns plus gap/padding cannot fit (use `max-width:80rem`; verify in browser), grid becomes one column with field first and preview second. DOM order stays preview then field for screen-reader continuity; CSS `grid-row` reorders visually only.
- Narrow layout tracks are `minmax(0,1fr) auto`; field takes remaining height, preview below. Bottom preview becomes a horizontal band: art left, name/effect text right, status retained; art stays inside panel borders. `.duel-field` owns any required x/y overflow; page stays fixed.
- Short-height mode at `max-height:48rem`: horizontal preview shrinks its art column to `clamp(3rem,8svh,5rem)`; image becomes thumbnail; name remains visible; effect text has `overflow-y:auto; min-height:0`; panel does not force row growth.
- When both narrow and short rules apply, compact preview remains below the field and its total block height is capped at `clamp(5rem,18svh,8rem)`.
- Preview empty state and status remain readable; no card is required for the compact layout to hold.
- Every `.zone-list-entry > img` uses `max-height:50svh; object-fit:contain`. Zone-list tile width remains controlled by its row. Prompt-dialog images are outside item 27 and stay unchanged.
- No global scale transform is applied to field/board. Board semantics/hit targets remain real CSS pixels.

## Inputs

- **From Depends (T8):** hand content scrolls internally; hand target floor remains 44 px; no hand width can force page overflow.
- `src/app/App.svelte:697-704` — header then main; `:853-899` — `.duel-row` DOM has preview first and field second; `:914-975` — optional HUD/workspace.
- `src/styles/app.css:36-42` — body min-height; `:140-152` — main/header widths; `:248-352` — fixed two-column preview layout and 79rem stacking rule; `:365-369` — main grid and 3rem bottom padding.
- `src/styles/app.css:770-788` — `.duel-field` horizontal overflow only; T9 allows `overflow:auto` in constrained one-column mode, not global page scroll.
- `src/app/components/CardPreviewPanel.svelte:52-93` — stable art/copy/status elements.
- `src/app/components/duel-field/ZoneListEntryTile.svelte` renders the list image; `src/styles/app.css` owns `.zone-list-entry` size. Item 27 applies here only.
- `e2e/duel-smoke.spec.ts:805-820` — old page-wheel test to replace; `:1037-1138` — responsive composition expects preview above field below 1264; update to below and add vertical-fit assertions.
- Existing responsive viewport table includes 1024×768, 1280×720 and zoom equivalents; keep it and add 1366×768 / 1920×1080 only if not already present.

## Component contract

In `App.svelte`:

```ts
$: duelViewportOnly =
  (duelBoard !== null || $duel.snapshot !== null) &&
  !$uiSettings.showDuelHud &&
  !$uiSettings.showWorkspace;
```

Apply `class:is-duel-viewport={duelViewportOnly}` and `data-duel-viewport={duelViewportOnly ? "true" : undefined}` to `<main>`.

No JS resize listener. All reflow is CSS media queries. `svh` is required because browser chrome must be reflected in available height.

## TDD

1. **Red** — class-state component checks plus real-browser geometry assertions at every viewport.
2. **Green** — shell/grid/compact CSS and image cap.
3. **Refactor** — delete stale comments/test assertions about page wheel and preview-above-field.

## Test plan

Extend `tests/component/AppChrome.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `marks default board mode as viewport constrained` | board/snapshot, default settings | main has `.is-duel-viewport`, `data-duel-viewport="true"` |
| `restores document mode for optional HUD` | show HUD | class/data absent |
| `restores document mode for workspace` | show workspace | class/data absent |

Extend `tests/component/CardPreviewPanel.test.ts` only for stable compact selectors: art, copy, name/text/status remain direct descendants with existing `data-cy`; no markup change is required unless CSS grid needs one wrapper.

Extend `tests/component/ZoneListDialog.test.ts`: target/browse list images retain the direct `.zone-list-entry > img` selector needed by the cap.

Replace/extend e2e:

| Browser check | Expect |
| ---- | ---- |
| default duel at every supported viewport | `document.documentElement.scrollHeight <= innerHeight + 1`, `body.scrollHeight <= innerHeight + 1`, `scrollY === 0` after wheel |
| wide (`>80rem`) | preview left of field, same top/bottom row within 2 px; preview width ≥22rem; field content width ≥52rem |
| narrow (`<=80rem`) | field top < preview top; both same available width; preview bottom ≤ viewport bottom |
| short (`height<=48rem`) | preview image height ≤`min(5rem,8svh)` tolerance; name visible; text clientHeight < scrollHeight for long fixture and `overflowY` auto/scroll |
| duel row | top ≥ header bottom; bottom ≤ viewport bottom − computed main bottom padding; no overlap |
| field | 52rem board preserved; if it overflows, `.duel-field` overflow is auto/scroll and page does not overflow |
| zone-list preview image | open a deck/GY/banished list; each entry image bounding height ≤`innerHeight * .5 + 1` |

Replace test `wheel over the duel field scrolls the page` with `wheel over the duel field never scrolls the default duel page`; assert `scrollY` stays 0. Internal field/hand scrolling gets its own targeted checks and must not bubble page movement.

## Impl steps

- [ ] 1. Add three `AppChrome` tests; run focused component test red.
- [ ] 2. Add `duelViewportOnly`, main class/data attr. Re-run green.
- [ ] 3. Rewrite responsive e2e expectations first: wide preview left; narrow field before preview; no page vertical overflow; wheel no page movement; short compact metrics. Run focused test red against current CSS.
- [ ] 4. Add `height:100svh; overflow:hidden` grid shell to `#app`; keep body `min-width:320px`, change min-height to `100svh`. In non-duel document mode main supplies `overflow:auto`/normal min-height so picker/errors remain reachable.
- [ ] 5. Replace duplicate main rules with one base rule and `.is-duel-viewport` modifier. Replace the constrained mode's `3rem` padding with `clamp(.5rem,1svh,1rem)`; retain normal document padding for non-duel content.
- [ ] 6. Change `.duel-row` wide columns to elastic preview formula. Give preview/field `min-height:0`; field wrapper is the minmax track that may scroll.
- [ ] 7. Replace 79rem stacking rule with verified 80rem field-first/preview-second areas. In this width fallback make preview a horizontal art-left/copy-right band. Do not reorder DOM.
- [ ] 8. Add short-height refinement that shrinks the horizontal art column to a thumbnail. Constrain copy/effect text exactly as Requirements; keep status visible.
- [ ] 9. In narrow constrained mode set `.duel-field { overflow:auto; min-height:0; }`; preserve `scroll-padding`; never reduce `.duel-field-stage` / board 52rem minimum.
- [ ] 10. Add `max-height:50svh; object-fit:contain` to `.zone-list-entry > img` in `app.css`; do not touch PromptControls images.
- [ ] 11. Run responsive e2e. Adjust only breakpoint/track constants needed for measured acceptance; record final values in CSS comments and tests.
- [ ] 12. Run all component/e2e checks affected by scroll/drag: pointer drag uses viewport coordinates, so confirm hand card and target are both reachable by internal scroll without moving page.

## Outputs

- Files edited: `src/app/App.svelte`, `src/styles/app.css`, `tests/component/AppChrome.test.ts`, `tests/component/CardPreviewPanel.test.ts`, `tests/component/ZoneListDialog.test.ts`, `e2e/duel-smoke.spec.ts`.
- Public API: none.
- Behaviour: default duel uses a fixed viewport shell; optional diagnostic workspace restores document scrolling.
- Migration / config: none.

## Validation

- [ ] `npm run test:component -- AppChrome CardPreviewPanel ZoneListDialog` passes
- [ ] `npm run typecheck`, `npm run lint`, `npm run format:check` pass
- [ ] `npm run build` succeeds
- [ ] full chromium e2e passes with pinned command from T5
- [ ] at 1024×768, 1280×720, 1366×768, 1920×1080 and configured zoom equivalents: no page x/y scrollbar in default duel mode
- [ ] short-height preview keeps thumbnail + name; effect text scrolls inside panel
- [ ] narrow preview is visibly below, never above, the field
- [ ] zone-list card image measured ≤50% viewport height
- [ ] app functional — picker/error/settings/HUD/workspace paths remain reachable
- [ ] commit msg draft: `fix(layout): fit the default duel into one viewport`
