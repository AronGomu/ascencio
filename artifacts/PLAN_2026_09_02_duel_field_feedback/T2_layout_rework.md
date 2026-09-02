# T2: Layout rework — narrow rail, horizontal phase bar above field, bigger field, Full Control bottom-left

**Plan:** `./artifacts/PLAN_2026_09_02_duel_field_feedback.md`
**Depends:** none
**Commit outcome:** Duel screen shows a horizontal phase bar above the field (player phases left half, opponent right half), a narrower right rail, a measurably larger field, and the Full Control toggle bottom-left.

## Context (self-contained)

- Goal: owner feedback `feedback.md` § Duel Field items 5, 6, 7, 13.
- This slice: `.duel-shell` grid restructure + PhaseBar reorientation + rail narrowing + toggle reposition. Card-level visuals untouched.
- Out of scope here: hand fanning (T5 — but note T5 depends on this ticket because field pitch changes `cardHeight`), stack rendering (T3/T4).
- Assumptions in force: A12 — horizontal bar costs height; measure before locking values so the field actually grows (item 7 is the acceptance bar, not a hope).

## Requirements

- Item 5: right rail narrower — `--rail-min` 15rem → 11rem (`src/styles/tokens…` actually `app.css:12`), ≤1500px breakpoint 12rem → 9rem (`app.css:752`). Rail content (avatars, LP, status) must not overflow/wrap brokenly at the new width.
- Item 6: PhaseBar leaves grid column 3; renders as a horizontal bar in a row ABOVE the field, spanning the field column only. Player half occupies left half (chips left→right: DRAW STANDBY MAIN1 BATTLE MAIN2 + End Turn), opponent half occupies right half (chips left→right mirrored so END is outermost right: MAIN2… order chosen so the two turn timelines meet at the center seam). Split line = horizontal center of the bar = vertical middle of the duel field.
- Item 7: field grows. `.duel-field-slot` width formula loses the `var(--phase-bar-w, 8rem)` subtraction and gains the freed rail width; bar height is subtracted from available field height (bar max-height 2.5rem). Acceptance: `duel-field` rect area strictly larger than pre-change at 1920×1080 (record before/after numbers in the report).
- Item 13: `.full-control-toggle` bottom-LEFT: `app.css:1207-1211` `right: 0.5rem` → `left: 0.5rem`; tooltip `.full-control-toggle__text` `right: 100%` → `left: 100%`.
- Portrait media query: phase bar stays horizontal above the field there too (single layout, remove `--phase-bar-w` portrait override).

## Inputs

- Grid: `app.css:527-540` `.duel-shell` (`grid-template-columns: var(--preview-w) auto var(--phase-bar-w, 8rem) minmax(var(--rail-min), 1fr)`); slot formula `app.css:1192-1195`.
- Mounts: `App.svelte:1480` shell div, `:1508` `.duel-field-slot` (`bind:this={duelFieldSlot}`), `:1560-1566` `<PhaseBar …>`, `:1567` `<DuelRail …>`.
- `PhaseBar.svelte`: props `phase, turnPlayer, spec, disabled, oninteraction`; `OPPONENT_SLOTS`/`PLAYER_SLOTS` at `:18-32`; halves CSS `app.css:1292-1330`.
- Field size chain: slot `clientWidth/clientHeight` → `DuelField.svelte:307-365` ResizeObserver → `computeFieldGeometry` (`src/battle/field/duel-field-geometry.ts`) `pitch = min(availableHeight/hP, (availableWidth-c)/wCoeff)`. Geometry code itself needs NO change; only the slot's CSS box changes.
- Toggle: `FullControlToggle.svelte`, CSS `app.css:1207-1211`.

## Interface contract (level 5)

- **Produces:**
  - `.duel-shell` grid: `grid-template-columns: var(--preview-w) auto minmax(var(--rail-min), 1fr);` — 3 columns. Field column becomes a flex column wrapper `div.duel-field-column[data-cy="duel-field-column"]` containing `<PhaseBar/>` then the existing `.duel-field-slot` div (slot keeps `data-cy="duel-field-slot"` and stays the ResizeObserver boundary).
  - `.duel-field-slot` width: `calc(var(--stage-h, 100svh) * 16 / 9 - var(--preview-w) - var(--rail-min))`; height: `calc(100% - var(--phase-bar-h))` with new token `--phase-bar-h: 2.5rem` in `:root`.
  - `PhaseBar.svelte`: same props, root `<aside class="phase-bar" data-cy="phase-bar">` becomes `flex-direction: row; height: var(--phase-bar-h)`. New DOM order: `.phase-bar__half--player` first (left, `data-cy="phase-bar-player"`), `.phase-bar__half--opponent` second (right, `data-cy="phase-bar-opponent"`). `PLAYER_SLOTS` order unchanged; `OPPONENT_SLOTS` order `["main2","battle","main1","standby","draw","end"]`-style mirror chosen so opponent DRAW sits nearest center seam — assert exact final order in `PhaseBar.test.ts`. Halves `flex: 0 0 50%` of width.
  - `--rail-min: 11rem` (`:root`), `9rem` (≤1500px), `7rem` portrait unchanged.
  - `.full-control-toggle { left: 0.5rem; bottom: 0.5rem; }`, tooltip flipped.
- **Consumes:** `DuelPhase`, `PlayerIndex`, `ActiveInteractionSpec` unchanged; `duel.dispatchInteraction` unchanged.
- **Errors:** none new.
- **Invariants:** `data-cy` values `phase-bar`, `phase-bar-player`, `phase-bar-opponent`, `phase-bar-opp-*`, `phase-bar-you-*`, `field-end-turn-button`, `duel-field-slot`, `full-control-toggle` all keep existing names (e2e targets); new wrapper adds `duel-field-column`. FullControlToggle checked-vs-held invariant (`FullControlToggle.svelte:4-7`) untouched.
- **Integration links:** trigger CSS box change → dispatch ResizeObserver `DuelField.svelte:362` → receive `measuredRenderLayout` → observe `section[data-cy="duel-field"]` inline width/height px larger than baseline in Chromium.

## TDD

1. **Red** — update locked exact-string tests to the NEW values first (`global-styles.test.ts:134-192`), new `PhaseBar.test.ts` horizontal-order cases, e2e geometry expectations; run → red against current code.
2. **Green** — CSS + markup changes.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `global-styles.test.ts` | stylesheet | 3-col grid string, new slot formula, `--rail-min: 11rem`, `--phase-bar-h: 2.5rem` |
| `PhaseBar.test.ts` | render | player half before opponent half in DOM; exact chip orders; End Turn in player half |
| `AppChrome.test.ts:428-437` | shell render | direct-children assertion REWRITTEN to `["card-preview-panel","duel-field-column","duel-right-rail"]`; `phase-bar` + `duel-field-slot` asserted as children of `duel-field-column` |
| e2e `duel-smoke.spec.ts:4202-4265` | live duel | phase-bar rect ABOVE `duel-field` rect; player half left of opponent half; halves split at field vertical middle (±8px) |
| e2e | live duel 1920×1080 | `duel-field` rect area > recorded baseline; Full Control toggle rect bottom-left inside field slot |

## Impl steps

- [ ] 1. Record baseline: Chromium 1920×1080, rects of `duel-field`, `phase-bar`, `duel-right-rail` (save numbers in report).
- [ ] 2. Update unit/component/e2e expectations (red).
- [ ] 3. CSS grid + tokens + slot formula; move PhaseBar mount inside new `duel-field-column` wrapper in `App.svelte`.
- [ ] 4. PhaseBar horizontal CSS + half order + opponent slot mirror.
- [ ] 5. Full Control toggle CSS flip.
- [ ] 6. Measure after: confirm field bigger; adjust `--rail-min`/`--phase-bar-h` once if not (bounded repair, E5).

## Validation

- [ ] `npm run check:headless` green; component gate (NOT in check:headless): `npx vitest run tests/component/PhaseBar.test.ts tests/component/AppChrome.test.ts tests/component/FullControlToggle.test.ts`; `npx playwright test e2e/duel-smoke.spec.ts` green
- [ ] manual check: 1920×1080 + ≤1500px + portrait — no overlap, rail content intact, End Turn clickable
- [ ] silent-failure sites: none added
- [ ] app functional
- [ ] commit msg draft: `feat(duel-field): horizontal phase bar over a wider field, slimmer rail`
