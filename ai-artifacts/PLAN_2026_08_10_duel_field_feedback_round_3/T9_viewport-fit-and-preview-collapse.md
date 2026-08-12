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

- **From Depends (T8), as actually shipped in `3f0e437`:** hand content scrolls internally; hand target floor remains 44 px; no hand width can force page overflow. Concretely:
  - Hands render through the new `src/app/components/duel-field/HandBand.svelte`, not through `ZoneControl`. There is no painted hand zone and no `[data-zone-kind="hand"]` CSS left to style.
  - `data-cy` handles: root `field-hand-band-p{player}`, viewport `field-hand-p{player}-viewport`, arrows `field-hand-p{player}-previous` / `-next`, status `field-hand-p{player}-page-status`.
  - The band root carries `data-feedback-zone-id` (deliberately **not** `data-zone-id`) so the drag hit test's `closest("[data-zone-id]")` still resolves a hand card's action chip to no zone. `src/app/presentation/dom-feedback-controller.ts` has a fallback lookup on that attribute. Do not rename either.
  - Both arrows and the scrollable viewport carry `tabindex="-1"` on purpose: the board keeps exactly one visible 44 px keyboard entry point and no Tab trap. Any CSS or markup you touch must not reintroduce extra Tab stops.
  - Hand cards are normal-flow (`.is-hand-item`, `CardControl` `layout="hand"`) at a fixed `4.5rem` width inside an `overflow-x:auto` viewport with `overscroll-behavior-x:contain`. Page-level scroll suppression must not defeat that internal scroll — the ticket's Impl step 12 check applies directly.
  - Layout constants after T8: hand width `462/1280` centred at `640`; Deck and GY x `925/1280`; Banished x `1020/1280`. Central columns from T7 stay `450,545,640,735,830`, Field/Extra x `330`.
- **From T6/T7:** presentation code decides card identity through `isProjectedCardIdentityKnown(card)`; `grep -Rni "isCardIdentityVisible" src/app src/field` must stay empty. `BoardZoneView`/`BoardStackView` carry both `label` (short, visible) and `accessibleLabel` (owner-aware, ARIA only).

### Environment facts for validation

- Playwright is chromium-only on this host. Run browser checks as:
  `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers npx playwright test --project=chromium`
  Bare `npm run check` cannot exit 0 here because `playwright.config.ts` includes a `webkit-smoke` project unsupported on this machine. Use `npm run check:headless` plus the explicit Chromium invocation instead.
- Known flake: Vitest integration occasionally dies with `Worker exited unexpectedly`. Re-run once before diagnosing.
- Known flake: the duel seed is random per run; re-run a failing Chromium walker twice before diagnosing.
- The app now opens on a deck picker (shipped in T3), not straight into a duel. Any e2e that needs a board must go through the picker exactly as the existing specs in `e2e/duel-smoke.spec.ts` already do.
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

- [x] 1. Add three `AppChrome` tests; run focused component test red. Evidence: `npx vitest run tests/component/AppChrome.test.ts` failed 3/20 before the impl commit (attribute assertions returned `null`).
- [x] 2. Add `duelViewportOnly`, main class/data attr. Re-run green. Evidence: same file, 20/20 pass after `App.svelte` change.
- [x] 3. Rewrite responsive e2e expectations first: wide preview left; narrow field before preview; no page vertical overflow; wheel no page movement; short compact metrics. Run focused test red against current CSS. Evidence: rewrote `wheel over the duel field never scrolls the default duel page`, the `responsive field compositions...` wide/narrow branch, and added 3 new e2e tests before the CSS steps below; verified green only after steps 4-10 landed (see step 11).
- [x] 4. Add `height:100svh; overflow:hidden` grid shell to `#app`; keep body `min-width:320px`, change min-height to `100svh`. In non-duel document mode main supplies `overflow:auto`/normal min-height so picker/errors remain reachable. Evidence: `src/styles/app.css` `#app`/`body` rules; `npx playwright test -g "panels stay hidden|deck picker persists"` pass (picker/settings still reachable).
- [x] 5. Replace duplicate main rules with one base rule and `.is-duel-viewport` modifier. Replace the constrained mode's `3rem` padding with `clamp(.5rem,1svh,1rem)`; retain normal document padding for non-duel content. Evidence: single `main {}` rule plus `main.is-duel-viewport` in `app.css`; `npm run test:component` 220/220 pass.
- [x] 6. Change `.duel-row` wide columns to elastic preview formula. Give preview/field `min-height:0`; field wrapper is the minmax track that may scroll. Evidence: `grid-template-columns: minmax(22rem,.45fr) minmax(52rem,1fr)` in `app.css`; e2e `default duel occupies exactly one viewport...` asserts the 22rem/52rem floors at 1366×768 and 1920×1080.
- [x] 7. Replace 79rem stacking rule with field-first/preview-second areas (landed at **79rem**, not 80rem — see step 11 for why). In this width fallback make preview a horizontal art-left/copy-right band. Do not reorder DOM. Evidence: `@media (max-width: 79rem)` grid-row reorder + `grid-template-areas: "art copy" "status status"` in `app.css`; e2e narrow branch of `responsive field compositions...` and `default duel occupies exactly one viewport...` both green; DOM order unchanged in `App.svelte` (preview still renders before field).
- [x] 8. Add short-height refinement that shrinks the horizontal art column to a thumbnail. Constrain copy/effect text exactly as Requirements; keep status visible. Evidence: `@media (max-width:79rem) and (max-height:48rem)` in `app.css`; e2e `short-height duel keeps the compact preview thumbnail, name and scrolling text` passes (art ≤52px, name visible, text `overflow-y` auto/scroll).
- [x] 9. In narrow constrained mode set `.duel-field { overflow:auto; min-height:0; }`; preserve `scroll-padding`; never reduce `.duel-field-stage` / board 52rem minimum. Evidence: `@media (max-width:79rem){.duel-field{overflow:auto}}` in `app.css` (base rule keeps `min-height:0`/`overflow-x:auto`/`scroll-padding` unconditionally); `tests/unit/global-styles.test.ts` (unchanged, still asserts the base block literally contains `overflow-x: auto`) passes; `.duel-field-board`/`.duel-field-stage` min-width untouched.
- [x] 10. Add `max-height:50svh; object-fit:contain` to `.zone-list-entry > img` in `app.css`; do not touch PromptControls images. Evidence: rule added; e2e `zone-list preview image never exceeds half the viewport height` passes; `grep -n "PromptControls" src/styles/app.css` shows no changes near it (not present in this file, `PromptDialog`/`PromptControls` images live in `PromptControls.svelte`, untouched).
- [x] 11. Run responsive e2e. Adjust only breakpoint/track constants needed for measured acceptance; record final values in CSS comments and tests. Evidence: the initial 80rem breakpoint (a literal reading of the Requirements' "use max-width:80rem; verify in browser" starting point) broke `a full preset duel can be completed using keyboard controls only...` at the default 1280×720 Playwright viewport — at exactly 80rem/1280px the row fell into narrow/stacked mode, squeezing `.duel-field` short enough that its internal `overflow:auto` scroll, combined with `.field-action-bar`'s `position:absolute` being anchored to `.duel-field`'s own (now short) box, put the action bar over the board. Re-derived the original floor (`52rem field + 22rem preview + 1rem gap + 2rem field padding + 2rem main margin = 79rem`, matching the pre-T9 comment) and landed on 79rem instead; also moved the action bar's gutter/positioning from `.duel-field` onto `.duel-field-stage` (see `DuelField.svelte`/`app.css`, and the companion `tests/component/DuelField.test.ts` update) so it stays pinned to the board's true bottom edge even when `.duel-field` itself is height-clipped and scrolling. Full `PLAYWRIGHT_BROWSERS_PATH=... npx playwright test --project=chromium` (24/24) green after the fix, rerun once for the noted seed/flake risk (6 targeted tests including the full-duel walker) also green.
- [x] 12. Run all component/e2e checks affected by scroll/drag: pointer drag uses viewport coordinates, so confirm hand card and target are both reachable by internal scroll without moving page. Evidence: `dragging a hand card onto a highlighted zone plays it` and `spatial field navigation has one visible 44px keyboard entry without a trap` both pass in the full chromium run above.

## Outputs

- Files edited: `src/app/App.svelte`, `src/styles/app.css`, `tests/component/AppChrome.test.ts`, `tests/component/CardPreviewPanel.test.ts`, `tests/component/ZoneListDialog.test.ts`, `e2e/duel-smoke.spec.ts`. Also (necessary consequence of step 11's fix, not scope creep): `src/app/components/DuelField.svelte` (moved `FieldActionBar` and its gutter attributes from `.duel-field` to `.duel-field-stage` so the bar stays pinned to the board when `.duel-field` is height-clipped/scrolling) and its companion `tests/component/DuelField.test.ts` (two assertions retargeted from `.duel-field` to `.duel-field-stage` to match).
- Public API: none.
- Behaviour: default duel uses a fixed viewport shell; optional diagnostic workspace restores document scrolling.
- Migration / config: none.

## Validation

- [x] `npm run test:component -- AppChrome CardPreviewPanel ZoneListDialog` passes. Evidence: `npx vitest run tests/component/AppChrome.test.ts tests/component/CardPreviewPanel.test.ts tests/component/ZoneListDialog.test.ts` → 43/43 pass.
- [x] `npm run typecheck`, `npm run lint`, `npm run format:check` pass. Evidence: all three ran clean (0 errors/warnings) as part of `npm run check:headless`, final run after the 79rem fix.
- [x] `npm run build` succeeds. Evidence: `npm run build` → `build:app`/`build:verify` both `"status":"ok"`, final run after the 79rem fix.
- [x] full chromium e2e passes with pinned command from T5. Evidence: `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers npx playwright test --project=chromium` → 24/24 pass (2.7–3.1min), run twice (including once after the 79rem/DuelField.svelte fix) with no flake.
- [x] at 1024×768, 1280×720, 1366×768, 1920×1080 and configured zoom equivalents: no page x/y scrollbar in default duel mode. Evidence: e2e `default duel occupies exactly one viewport at every supported viewport` asserts `document.documentElement.scrollHeight`/`body.scrollHeight` ≤ `innerHeight+1` and `scrollY===0` after a wheel, at 1280×720 (added explicitly), 1366×768, 1920×1080, 1024×768, 667×375, 375×667 and the 640×360 (1280×720@200%) zoom-equivalent — all pass.
- [x] short-height preview keeps thumbnail + name; effect text scrolls inside panel. Evidence: e2e `short-height duel keeps the compact preview thumbnail, name and scrolling text` passes at 900×420 (narrow+short).
- [x] narrow preview is visibly below, never above, the field. Evidence: same test file's `default duel occupies exactly one viewport...` and `responsive field compositions...` both assert `panelTop >= fieldBottom` (field renders first) at every viewport `<1264px`; both pass.
- [x] zone-list card image measured ≤50% viewport height. Evidence: e2e `zone-list preview image never exceeds half the viewport height` passes (asserts every `.zone-list-entry > img` bounding height ≤ `innerHeight*.5+1`).
- [x] app functional — picker/error/settings/HUD/workspace paths remain reachable. Evidence: `deck picker persists a chosen pair...`, `panels stay hidden until settings enable them`, `duel HUD keeps hidden stacks count-only...`, `missing active images use deterministic placeholders...`, and `injected DOM field failure preserves fallback controls...` all pass in the same chromium run — none of these paths lost reachability under the new `#app`/`main` grid shell.
- [x] commit msg draft: `fix(layout): fit the default duel into one viewport`. Evidence: used verbatim for the commit below.
