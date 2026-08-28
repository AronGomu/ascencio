# T2: Card action chips: bottom-anchored upward stack, kill duplicate row (items 2,3)

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`
**Depends:** none
**Commit outcome:** One vertical chip stack per card, anchored bottom growing up; pinned hand card no longer shows second horizontal set

## Context (self-contained)

- Goal: implement the 2026-08-27 owner duel-field feedback round. This ticket covers items 2 and 3, owner wording binding:
  - Item 2: "The action button for all cards in all zones should start at the bottom of the card and go up."
  - Item 3: "When I click on a card and then hover over the card, I see buttons that appear horizontally that are not the ones that are on top of the card, vertically placed. Remove them; it's a bug."
- This slice: CSS-only relayout of the card-mounted and overlay chip menus, plus one boolean class wired from `DuelField.svelte` down to `CardControl.svelte` so CSS can tell "the hand-zoom overlay is currently serving this card" and hide the card's own chips for that duration.
- How the duplicate happens (verified by inspection, 2026-08-27):
  - `CardActionChips.svelte` is mounted twice for a hand card: once inside the card (`src/battle/app/components/duel-field/CardControl.svelte:325-334`, default `layout="row"`) and once inside the hand-zoom overlay (`src/battle/app/components/duel-field/HandZoomOverlay.svelte:143-152`, `layout="stack"`, `dataCyScope="hand-zoom-overlay"`).
  - The overlay's stacked copy is unconditionally visible while the overlay is mounted: `src/styles/app.css:1557-1560` (`.hand-zoom-overlay .card-action-chips { display: flex; pointer-events: auto; }`).
  - The card's own row copy is revealed by `src/styles/app.css:2405-2409` (`.duel-field-card.is-actionable:hover`, `.duel-field-card.is-actionable:focus-within`, `.duel-field-card.is-pinned`). The hand-hover suppression at `src/styles/app.css:2414-2416` (`.duel-field-card.is-hand-item:not(:focus-within):not(.is-pinned):hover .card-action-chips { display: none; }`) deliberately excludes `:focus-within` and `.is-pinned`.
  - A pointer click on a hand card pins the zoom (`toggleHandPin`, `src/battle/app/components/DuelField.svelte:751-761`; state `pinnedHandTarget` at line 215) and leaves focus inside the card's target button. Now `:focus-within` reveals the card's row chips *and* the overlay shows its stack — the owner's "horizontal buttons that are not the ones on top of the card". The keyboard pin (`session.menuTarget` → `pinnedTarget` prop → `.is-pinned`) mounts no overlay, so its in-band chips are legitimate and the keyboard's only route (ADR-032 §4, asserted by `tests/component/DuelField.test.ts:2904` "keyboard activation still opens the hand card's pinned chip menu").
- Hover-continuity invariant (documented at `src/styles/app.css:2365-2372`, must survive): chips live inside the card's own box with no gap for a pointer travelling card→chip to cross, so the `:hover` that reveals them can never be dropped in transit.
- Out of scope here: no choice filtering (T5), no selection/halo styling (T6), no zone-list chip changes (`.zone-list-entry .card-action-chips` at `src/styles/app.css:1911-1934` keeps its own top/bottom anchor and row layout — see Decisions), never edit `feedback.md` or any `feedback*.md`, never touch `vendor/`, never change `CardActionChips.svelte` public props or `data-cy` scheme.
- Assumptions in force:
  - `CardActionChips` API FROZEN — siblings T5/T6 build on it. Props `choices`, `layout`, `dataCyScope` and class names `.card-action-chips` / `.card-action-chip` / `data-cy` values `card-action-chips-{cardId}` and `card-action-chip-{choiceId}` unchanged.
  - Choice order stays prompt order (`orderedIds` built in prompt order at `src/battle/app/prompts/interaction-spec.ts:301-347`); `column-reverse` changes visual anchor only, not DOM order. Keyboard walking in `CardActionChips.svelte` (`handleKeydown`) operates on DOM order and is intentionally left as-is: ArrowDown/ArrowRight = next DOM chip = visually one chip *up* in the reversed stack. Recorded as accepted, see Decisions.
  - Chips are always mounted for an actionable card and merely hidden by CSS (comment at `src/styles/app.css:2403-2404`); all tests assert visibility/classes, never element count.

## Requirements

- R1 (item 2): every card-mounted chip menu — hand, monster zones, spell/trap zones, every zone that mounts `CardControl` — renders as one vertical stack anchored at the card's bottom edge, growing upward, first choice nearest the bottom.
- R2 (item 2, overlay): the hand-zoom overlay's stacked chips are also anchored at the bottom of the zoomed card box, growing upward, first choice nearest the bottom.
- R3 (item 3): while the hand-zoom overlay is mounted for a card (hover *or* pointer pin), that card's own in-band chips are `display: none`, whatever `:hover`/`:focus-within`/`.is-pinned` say. Exactly one chip set visible: the overlay's.
- R4: the keyboard pin on a hand card (no overlay mounted) still shows the card's own in-band chips — the keyboard's only route to hand-card actions.
- R5: non-hand pinned cards keep their chips, now bottom-anchored.
- R6 (overflow guard): a stack taller than the card clips inside the card box (`max-height: 100%; overflow-y: auto`) instead of overflowing the top edge and reopening the hover-gap dropout. Hover-continuity comment at `src/styles/app.css:2365-2372` updated to describe the new anchor.
- R7: `data-cy` values, DOM order of chips, and the `CardActionChips` prop surface are byte-identical to before.
- R8: `npm run check:headless` and `npm run test:component` green.

## Inputs

- `src/styles/app.css` — chip rules at lines 1557-1560, 1566-1568, 1911-1934, 2365-2416; overlay stack rule 2389-2402.
- `src/battle/app/components/duel-field/CardActionChips.svelte` — frozen component, read-only here.
- `src/battle/app/components/duel-field/CardControl.svelte` — `export let pinned = false;` (line 27), article classes at 263-282 (`class:is-pinned={pinned}` line 269, `class:is-hand-item` line 274), chips mount 324-334.
- `src/battle/app/components/duel-field/HandBand.svelte` — props block lines 18-50, `CardControl` mount lines 93-119 (`pinned={pinnedTarget === card.targetId}` line 104).
- `src/battle/app/components/duel-field/FieldBoard.svelte` — `export let pinnedTarget` line 41, two `HandBand` mounts lines 234-257 and 259-282.
- `src/battle/app/components/DuelField.svelte` — `handZoom` state lines 203-210, `pinnedHandTarget` line 215, `FieldBoard` mount lines 1100-1128, `HandZoomOverlay` mount 1153-1169.
- `src/battle/app/components/duel-field/HandZoomOverlay.svelte` — stacked chips mount 143-152, read-only here.
- Tests: `tests/component/DuelField.test.ts` (helpers `renderDraggableHand` line 4447, `handCardArticle` 4550, `clickHandCard` 4568, `handZoomOverlay` 4578; hand-zoom describe block ~2660-2940), `tests/component/CardActionChips.test.ts`, `tests/component/HandZoomOverlay.test.ts`, `tests/component/HandBand.test.ts` (no chip assertions — inspected, zero `chip` matches).
- E2E: `e2e/duel-smoke.spec.ts` (`handChip` helper 2057-2059; focus-reveal chips blocks at ~2640-2650, ~2676-2687; hit-test loop 2830-2860), `e2e-acceptance/hand-zoom.spec.ts` (centre-anchor assertion lines 57-73).
- **From Depends:** none.

## Interface contract (level 5)

- **Produces (Svelte props — new, additive, default preserves current behavior):**

  ```ts
  // src/battle/app/components/duel-field/FieldBoard.svelte
  export let zoomServedTarget: BoardTargetId | null = null;

  // src/battle/app/components/duel-field/HandBand.svelte
  export let zoomServedTarget: BoardTargetId | null = null;

  // src/battle/app/components/duel-field/CardControl.svelte
  export let zoomServed = false;
  ```

  `BoardTargetId` is the existing branded id from `src/battle/field/board-view-model.ts`, already imported in all three files.

- **Produces (DOM class):** `is-zoom-served` on the `<article class="duel-field-card">` element in `CardControl.svelte`, present iff `zoomServed === true`. No new element, no new `data-cy`.

- **Produces (CSS, verbatim):**

  Replace `src/styles/app.css:2365-2386` (the comment block plus the `.card-action-chips` base rule) with:

  ```css
  /* Chips sit on top of the card, anchored to its bottom edge and growing
     upward: `column-reverse` keeps prompt order in the DOM while drawing the
     first choice nearest the bottom. The stack is capped at the card's own
     height and scrolls past that, so it always stays inside the card's box —
     there is no gap at all for a pointer travelling from card to chip to
     cross, and the `:hover` that reveals them can never be dropped in
     transit. Every other host of this class — the zone list — sets its own
     `top`/`bottom` pair and keeps its own anchor. */
  .card-action-chips {
    position: absolute;
    z-index: var(--duel-field-layer-menu);
    top: auto;
    bottom: 0;
    left: 50%;
    display: none;
    flex-direction: column-reverse;
    height: fit-content;
    max-height: 100%;
    gap: 0.15rem;
    padding: 0.12rem;
    border-radius: 0.3rem;
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    transform: translateX(-50%);
    overflow-y: auto;
  }
  ```

  (Diff vs today: `top: 0` → `top: auto`; `bottom: 0` kept; `margin-block: auto` removed; `flex-direction: column-reverse`, `max-height: 100%`, `overflow-y: auto` added. The zone list is unaffected because `.zone-list-entry .card-action-chips` at 1917-1927 sets its own `top`/`bottom: auto`, **but** it would inherit `flex-direction: column-reverse` — so it gets an explicit reset, next item.)

  Insert into the `.zone-list-entry .card-action-chips, .projected-choice-menu` rule at `src/styles/app.css:1917-1927` one declaration (place after `bottom: auto;`):

  ```css
    flex-direction: row;
  ```

  Replace `src/styles/app.css:2388-2401` (comment plus `.card-action-chips.is-stacked` rule) with:

  ```css
  /* The hand zoom overlay hands its chips a whole enlarged card box, so they
     stop competing for space and take one full-width row each — still bottom-
     anchored and growing upward, the same reading order as a field card's own
     stack. Declared after the overlay's own `display: flex` rule above, which
     it carries the same specificity as and therefore overrides on source
     order alone — do not hoist it. */
  .card-action-chips.is-stacked {
    display: flex;
    flex-direction: column-reverse;
    gap: var(--space-1);
    width: var(--hand-zoom-width);
    padding: 0;
  }
  ```

  (Diff vs today: `display: grid; grid-template-columns: 1fr` → `display: flex; flex-direction: column-reverse`. Bottom anchor, `max-height`, `overflow-y` inherit from the base rule; the old centring came from the base rule's `top: 0` + `margin-block: auto`, both now gone. Flex column stretches buttons full-width exactly as the grid's `1fr` did.)

  Replace the hand-hover suppression at `src/styles/app.css:2412-2416` (comment plus rule) with:

  ```css
  /* Hand hover opens the overlay instead; suppress the clipped in-band chips
     on plain hover so they do not peek out below the overlay. Focus and pin
     keep their own reveal path (the rule above) — except while the overlay is
     actually serving this card (`is-zoom-served`, set from the mounted
     overlay's target): then the overlay's stack is the one chip set on
     screen, whatever :focus-within or the pin say. The keyboard pin mounts no
     overlay, so its in-band chips survive this rule untouched (ADR-032 §4). */
  .duel-field-card.is-hand-item:not(:focus-within):not(.is-pinned):hover
    .card-action-chips,
  .duel-field-card.is-actionable.is-hand-item.is-zoom-served
    .card-action-chips {
    display: none;
  }
  ```

  Specificity check (binding): the reveal rules at 2405-2409 weigh (0,3,0) for `:hover`/`:focus-within` variants and (0,2,0) for `.is-pinned`. The new suppressor `.duel-field-card.is-actionable.is-hand-item.is-zoom-served .card-action-chips` weighs (0,4,0) and beats all three regardless of source order. `.is-actionable` is always present when chips are mounted (`CardControl.svelte` renders them only inside `{#if actionable}`), so it costs nothing and buys the weight.

- **Consumes:** `handZoom: { card: BoardCardView; ... } | null` in `DuelField.svelte:203-210` — the single source of "overlay is mounted for card X". `zoomServedTarget` is derived as `handZoom === null ? null : handZoom.card.targetId` at the `FieldBoard` mount. Do not derive from `pinnedHandTarget` (hover-only overlays must suppress too) and not from `session.menuTarget` (keyboard pin must not suppress).

- **Errors:** none — no runtime failure paths added; pure CSS + prop plumbing.

- **Invariants:**
  - DOM order of `.card-action-chip` buttons inside `.card-action-chips` = prompt order. `column-reverse` is visual only. Focus order (Tab/`focusFirstChip`/Arrow walking) follows DOM order; accepted and noted in the suppression comment's sibling tests, not changed.
  - `.card-action-chips` bottom edge coincides with the card box bottom edge (`bottom: 0`, no gap) — hover continuity.
  - `getComputedStyle(chips).flexDirection === "column-reverse"` for both card-mounted and `.is-stacked` chips; `.zone-list-entry` chips stay `row`.
  - At most one visible chip set per card at any instant: overlay mounted for card → overlay stack only; otherwise → card's own stack only (per existing reveal rules).
  - `is-zoom-served` is true on at most one card article at a time (single `handZoom` slot) and only on hand cards (only `HandBand` receives the prop; `FieldBoard`'s zone/stack mounts do not).

- **Integration links:** all inside one Svelte render tree, no process/host boundary. Trigger `src/battle/app/components/DuelField.svelte:1100` (`<FieldBoard ... zoomServedTarget={...}>`) → dispatch: prop drilling `FieldBoard` → both `HandBand` mounts → `CardControl` `zoomServed` → observe: `article.duel-field-card` carries class `is-zoom-served` in the rendered document (asserted in component tests below).

## TDD

1. **Red** — add the three `DuelField.test.ts` tests below (they fail: class never rendered) and the two e2e geometry assertions (fail: chips centred, row direction). Component tests are the gate; write them first.
2. **Green** — wire the prop chain + class (steps 1), then the CSS (step 2).
3. **Refactor** — none expected; keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `tests/component/DuelField.test.ts` (new, in the hand-zoom describe block near line 2679) `"marks the hovered hand card as zoom-served while the overlay is mounted"` | `renderDraggableHand()`; `fireEvent.pointerEnter(handCardArticle())` | `handCardArticle().classList.contains("is-zoom-served")` is `true`; after `fireEvent(article, new MouseEvent("pointerleave", { relatedTarget: document.querySelector('[data-cy="duel-field"]') }))` it is `false` |
| `tests/component/DuelField.test.ts` (new) `"a pinned hand card is zoom-served and keeps only the overlay's chip copy revealed"` | `renderDraggableHand()`; `pointerEnter`; `await clickHandCard()` | `handZoomOverlay()` not null; `handCardArticle().classList.contains("is-zoom-served")` is `true`; card's own chips element `handCardArticle().querySelector('[data-cy^="card-action-chips-"]')` still mounted (CSS hides, never unmounts); overlay chips `document.querySelector('[data-cy^="hand-zoom-overlay-card-action-chips-"]')` not null |
| `tests/component/DuelField.test.ts` (new) `"the keyboard pin never marks the hand card zoom-served"` | as existing test at line 2904: focus `handDragTarget()`, `user.keyboard("{Enter}")` | `handZoomOverlay()` null; `handCardArticle().classList.contains("is-zoom-served")` is `false` |
| Existing `tests/component/DuelField.test.ts` chip tests (lines 934, 1001, 1103, 1148, 2113, 2679-2940) | unchanged | still green — no assertion edits needed (all class/visibility/dispatch based, none asserts row layout) |
| Existing `tests/component/CardActionChips.test.ts`, `HandZoomOverlay.test.ts`, `HandBand.test.ts` | unchanged | still green — `CardActionChips.test.ts:70/86` assert only `is-stacked` class presence; `HandZoomOverlay.test.ts` asserts scoped `data-cy` and bridge geometry; `HandBand.test.ts` has no chip assertions. Do not edit these files |
| `e2e/duel-smoke.spec.ts` (edit, inside the focus-reveal block at ~2832-2860, after `await expect(chips).toBeVisible();`) | focused field card with chips | add: `expect(await chips.evaluate((e) => getComputedStyle(e).flexDirection)).toBe("column-reverse");` and bottom-edge alignment: `const cardBox = await field.locator(`[data-card-id="${cardId}"]`).boundingBox(); const chipsBox = await chips.boundingBox(); expect(Math.abs(cardBox!.y + cardBox!.height - (chipsBox!.y + chipsBox!.height))).toBeLessThanOrEqual(2);` |
| `e2e-acceptance/hand-zoom.spec.ts:57-73` (edit) | zoomed hand card overlay | replace the centre-match assertion (`overlayCentre`/`chipsCentre` lines 66-69) with bottom-edge alignment: `expect(Math.abs(chipsBox!.y + chipsBox!.height - (overlayBox!.y + overlayBox!.height))).toBeLessThanOrEqual(2);` keep `expect(chipsBox!.y).toBeGreaterThan(overlayBox!.y);` drop the strict `chipsBox.bottom < overlayBox.bottom` check (they now coincide); update test name to `"the zoomed hand card overflows the hand band and bottom-anchors its chips on it"` and the comment above the assertion to say bottom-anchored per 2026-08-27 item 2 |

Run commands: `npm run test:component`, `npm run check:headless`. E2E specs are updated in this ticket but their execution is not a gate (plan A11 gates are the two commands above); run `npx playwright test e2e/duel-smoke.spec.ts` locally if the environment has browsers.

## Impl steps

- [x] 1. Red: component tests for the `is-zoom-served` wiring
  - [x] 1.1 In `tests/component/DuelField.test.ts`, after the test `"hovering a known hand card mounts the zoom overlay with its actions above"` (ends ~line 2694), add the three tests from the Test plan verbatim (names, inputs, expects as specified; reuse helpers `renderDraggableHand`, `handCardArticle`, `clickHandCard`, `handZoomOverlay`, `handDragTarget`).
  - [x] 1.2 Run `npx vitest run tests/component/DuelField.test.ts` — the three new tests fail on the missing class, everything else green.
- [x] 2. Green: prop chain `DuelField` → `FieldBoard` → `HandBand` → `CardControl`
  - [x] 2.1 `src/battle/app/components/duel-field/CardControl.svelte`: add `export let zoomServed = false;` directly under `export let pinned = false;` (line 27), and add `class:is-zoom-served={zoomServed}` on the `<article>` directly under `class:is-pinned={pinned}` (line 269).
  - [x] 2.2 `src/battle/app/components/duel-field/HandBand.svelte`: add `export let zoomServedTarget: BoardTargetId | null = null;` directly under `export let pinnedTarget: BoardTargetId | null = null;` (line 29), and on the `CardControl` mount add `zoomServed={zoomServedTarget === card.targetId}` directly under `pinned={pinnedTarget === card.targetId}` (line 104).
  - [x] 2.3 `src/battle/app/components/duel-field/FieldBoard.svelte`: add `export let zoomServedTarget: BoardTargetId | null = null;` directly under `export let pinnedTarget: BoardTargetId | null = null;` (line 41), and add `{zoomServedTarget}` to **both** `HandBand` mounts, each directly under the `{pinnedTarget}` line (lines 246 and 271).
  - [x] 2.4 `src/battle/app/components/DuelField.svelte`: on the `FieldBoard` mount (line 1100), add `zoomServedTarget={handZoom === null ? null : handZoom.card.targetId}` directly under `pinnedTarget={session.menuTarget}` (line 1109).
  - [x] 2.5 Run `npx vitest run tests/component/DuelField.test.ts` — all green including the three new tests.
- [x] 3. Green: CSS — bottom-anchored upward stack + duplicate suppression
  - [x] 3.1 `src/styles/app.css`: replace the comment block + `.card-action-chips` base rule (lines 2365-2386) with the base rule given verbatim in `## Interface contract`.
  - [x] 3.2 `src/styles/app.css`: in the `.zone-list-entry .card-action-chips, .projected-choice-menu` rule (lines 1917-1927), add `flex-direction: row;` after `bottom: auto;` with the inline comment `/* Reset the card stack's column-reverse: the list keeps its dropdown row. */` on the line above.
  - [x] 3.3 `src/styles/app.css`: replace the comment + `.card-action-chips.is-stacked` rule (lines 2388-2401) with the `.is-stacked` rule given verbatim in `## Interface contract`.
  - [x] 3.4 `src/styles/app.css`: replace the hand-hover suppression comment + rule (lines 2412-2416) with the two-selector suppression rule given verbatim in `## Interface contract`.
- [x] 4. E2E assertion updates (geometry now bottom-anchored)
  - [x] 4.1 `e2e/duel-smoke.spec.ts`: in the focus-reveal chips block (~2832-2860), after `await expect(chips).toBeVisible();` insert the `flexDirection === "column-reverse"` and bottom-edge alignment assertions exactly as written in the Test plan row.
  - [x] 4.2 `e2e-acceptance/hand-zoom.spec.ts`: apply the Test plan row — rename the first test to `"the zoomed hand card overflows the hand band and bottom-anchors its chips on it"`, replace the centre-match assertion (lines 66-69) with the bottom-edge alignment assertion, delete the `chipsBox.bottom < overlayBox.bottom` strict check (line 70-72), keep `chipsBox!.y > overlayBox!.y`, and rewrite the comment at 57-59 to cite the 2026-08-27 item-2 bottom anchor.
- [x] 5. Gates
  - [x] 5.1 `npm run test:component` — green.
  - [x] 5.2 `npm run check:headless` — green (format, lint, typecheck, legacy/unit/integration tests, vendor/assets/snapshot verify).
  - [x] 5.3 Manual Chromium spot-check (dev server `npm run dev`): (a) hover a field monster with 2+ actions → vertical stack rises from card bottom, first choice at the bottom; (b) click a hand card → exactly one stack visible (the overlay's), bottom-anchored on the zoomed card; hover on/off the pinned card → still one stack; (c) Tab to a hand card, press Enter → in-band stack appears (keyboard route intact).
    - Taken as automated Chromium evidence instead of a manual pass, per the
      repo rule that field acceptance uses automated Chromium evidence only.
      (a) `npx playwright test -g "item 5: field cards stay outside the hand
      band"` — passed, asserting `flexDirection === "column-reverse"` and the
      chip stack's bottom edge within 2px of the card's. (b) Chromium probe on
      `?scenario=field-hand-zoom`: on hover *and* after a pointer pin, exactly
      one visible `.card-action-chips` (the overlay's, `display: flex`), the
      card's own copy `display: none`, one `.is-zoom-served` card. (c) the same
      `item 5` run focuses a hand card's opener with no pointer — no overlay
      mounts, the in-band stack is visible and every chip wins its own hit test.

## Outputs

- Files touched: `src/styles/app.css`, `src/battle/app/components/DuelField.svelte`, `src/battle/app/components/duel-field/FieldBoard.svelte`, `src/battle/app/components/duel-field/HandBand.svelte`, `src/battle/app/components/duel-field/CardControl.svelte`, `tests/component/DuelField.test.ts`, `e2e/duel-smoke.spec.ts`, `e2e-acceptance/hand-zoom.spec.ts`.
- Behavior change: card-mounted and overlay chip menus render bottom-anchored growing upward; a hand card served by the zoom overlay never shows a second in-band chip set. No public API widened; new Svelte props are internal to `src/battle/` (no `index.ts` change, boundary test untouched).
- No migration, no config.

## Validation

- [x] tests pass: `npm run test:component` && `npm run check:headless`
- [x] manual check per step 5.3
- [x] no silent-failure swallow on a path this slice adds — none: no `|| true`, no empty catch, no redirects; CSS + prop plumbing only
- [x] app functional — duel field loads, hand pin/hover/keyboard flows all commit actions (covered by existing `DuelField.test.ts` pin suite staying green)
- [x] commit msg draft: `fix(duel): bottom-anchor card action chips as an upward stack and drop the pinned hand card's duplicate row`
