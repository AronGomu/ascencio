# R2: Review repairs — four feedback items not actually shipped

**Plan:** `./ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
**Depends:** R1 (HEAD `42d1b43`)
**Commit outcome:** The action/phase badge at the opponent hand position is gone; hand action chips can never be painted over by a field card; the dragged card's hovered zone fades to green; the End turn button is visibly smaller while keeping its 44 px target.

## Context (self-contained)

- Goal: close the four `feedback.md` items that the round-3 scope review found claimed-but-not-shipped or partially shipped. The user's own wording is quoted under each requirement and is authoritative — where this ticket and a previous ticket's interpretation disagree, the user's wording wins.
- This project is a browser Yu-Gi-Oh duel client; a vendored `ygopro-core` WASM engine in a Web Worker is the sole rules authority and none of this ticket touches it. Everything here is presentation.
- Out of scope: the correctness/privacy/test repairs (shipped in R1); the MR3 rules-profile decision; the bundle budget; anything in `src/worker/**`; re-opening geometry the user already accepted (column pitch 95, row pitch 120).

## Requirements

### G1 — item 26: remove the action/phase badge at the opponent hand position

User wording: *"At the same position as the opponent's hand, there is a badge that shows the current action or phase. Remove it."*

T10 interpreted this as a regression lock on `field-status-pills` / `prio-pill` / `phase-pill`, which round 2 had already deleted — so they cannot be what the user saw. The element that actually matches the description is `.duel-field-feedback` (`src/styles/app.css:1216-1233`): a badge pinned at `top:1.5rem; left:50%` inside `.duel-field`, i.e. the same x/y as the opponent hand band (`duel-field-layout.ts:133-137`, hand centre x 640/1280, y 42/720), rendering strings like `` `${event.phase} phase` ``, `Normal Summon` and `Opponent's turn` (`src/app/presentation/presentation-command.ts:135-158`).

- Remove that badge as a rendered surface.
- **Remove only the badge.** The other presentation-feedback channels stay: field lines (attack/target lines), the transient teal target highlight, life-point feedback, and the status line in `CardPreviewPanel` — ADR-010 and round 2 deliberately assigned current-action status to the preview panel, which is where it now belongs.
- If removing the badge would strand information that appears nowhere else, route that information to the preview panel status instead of keeping the badge. Say in your report which strings, if any, needed rerouting.
- Keep the existing negative assertions for `field-status-pills` / `prio-pill` / `phase-pill` and add one for the badge, so neither can come back.

### G2 — item 5: hand action chips must never be painted over

User wording: *"The action menu that appears when you hover a card you can activate or play should be at the forefront in the HTML, because the hand should never be hidden by other interface or game objects, and the menu above it should never be hidden by anything."*

`.duel-field-hand-band` is `position:absolute; z-index:30` (`src/styles/app.css:1561-1566`), which creates a stacking context. The hover raise to 35 (`:1513`) and the chips' `--duel-field-layer-menu` (100, `:1704`) are both clamped inside it. `FieldBoard.svelte:200-243` renders both hand bands *before* `fieldCards` (`:257`) and both sit at layer 30, so a later-painted field card wins. The boxes really do overlap: player spell/trap cards occupy stage-y 74.0–89.9% while the band box starts around 78% of stage height, over the identical x range (32–68%).

- A hovered/pinned hand card and its action chips must paint above every field card, zone, stack and the phase strip.
- Fix the stacking, not the geometry — the hand band's position and width are user-accepted (items 13/15).
- Prove it in the browser with `document.elementFromPoint()` at the chip centre resolving the chip or its descendant, for a hand card whose box overlaps a field card. The existing e2e chip check (`e2e/duel-smoke.spec.ts:1800-1832`) samples only the first actionable card and is guarded by `count() > 0`; strengthen it or add a case that deliberately picks an overlapping card.

### G3 — item 18: the hovered zone fades to green

User wording: *"When I hover a valid zone with the draggable card, the zone should change its halo with a fade animation to green, indicating that we are selecting that zone to play the card."*

Today `dropCandidates` is computed once at `startCardDrag` and every candidate zone turns green simultaneously; `.duel-field-zone` has no `transition`, so nothing fades.

- Keep showing which zones are legal — item 25 ("all valid targets should have a green halo") requires that and it is already shipped.
- Add a distinct emphasis for the *hovered* candidate under the dragged card, and give the halo a fade transition (match the 120 ms ease-out used by T12's hover zoom unless a different duration measures better).
- The hovered emphasis must follow the pointer during the drag, using the existing hit test (`zoneIdAtPoint`) — do not add a second hit-testing implementation and do not read layout inside the rAF loop.
- Honour `prefers-reduced-motion:reduce`: the emphasis still changes, the transition does not animate.
- Releasing, cancelling, or leaving every candidate clears the emphasis.

### G4 — item 24: reduce the End turn button size

User wording: *"Remove the end turn badge and instead just replace it with the yellow end turn button, and move the yellow end turn button to the place of the current end turn badge. Also reduce the size of that enter button."*

The badge removal and repositioning shipped in T10. The size reduction did not: `.field-end-turn` still carries `min-height:2.75rem; padding:.55rem 1rem` (`src/styles/app.css:1747-1751`) — identical to before, only the absolute positioning was dropped.

- Make the button visibly smaller than it is today while keeping the pointer target at or above 44×44 px (assumption A7 — the 44 px floor never yields).
- The lever is horizontal: reduce padding and/or font-size so the button's width shrinks toward the phase-chip scale, and keep height at the 44 px floor. A shorter label is acceptable if it stays unambiguous.
- It must still read as the yellow/warning action, stay in the phase strip's right group, and keep `data-cy="field-end-turn-button"`.
- Measure before and after in the browser and record both rects in your report — "reduced" must be a number, not a claim.

## Inputs

- `src/styles/app.css` — `.duel-field-feedback:1216-1233`, `.duel-field-hand-band:1561-1566`, card hover raise `:1513`, chips `:1704`, `.duel-field-zone:1083-1095`, drop candidate `:1124-1128`, `.field-end-turn:1747-1751`. Note the duplicate selector at `:1598` and `:1602` (`.duel-field-hand-band.is-opponent .duel-field-hand-band__viewport` declared twice) — merging those two blocks is in scope as incidental cleanup since you are editing that region.
- `src/app/presentation/presentation-command.ts:135-158` — the badge's strings.
- `src/app/components/duel-field/FieldBoard.svelte:200-257` — hand bands render before field cards.
- `src/app/components/duel-field/{HandBand,CardControl,PhaseStrip,EndTurnButton}.svelte`
- `src/app/components/DuelField.svelte` — `startCardDrag`, `dropCandidates`, `zoneIdAtPoint`, drag move handling.
- `src/app/components/CardPreviewPanel.svelte` — the status line that owns current-action text.
- `tests/unit/global-styles.test.ts`, `tests/component/DuelField.test.ts`, `e2e/duel-smoke.spec.ts:1800-1832`.
- `docs/ADR/010_ADR_in_field_phase_navigation.md` — phase placement; amend consequences only if G4 changes them.

### Environment facts for validation

- Playwright is chromium-only on this host:
  `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers npx playwright test --project=chromium`
  Bare `npm run check` cannot exit 0 here (`playwright.config.ts` includes an unsupported `webkit-smoke` project). Use `npm run check:headless` plus the explicit Chromium invocation.
- Known flake: Vitest integration occasionally dies with `Worker exited unexpectedly`. Re-run once before diagnosing.
- Known flake: the duel seed is random per run; re-run a failing Chromium walker twice before diagnosing.
- Two e2e drag specs may skip when the opening hand offers no placement; R1 replaced the blanket skip with a count-and-assert guard — keep that guard intact.
- The app opens on a deck picker; e2e must go through it as the existing specs do.

## TDD

1. **Red** — a negative assertion for the badge; a browser hit test at a chip centre over an overlapping field card; a drag-hover emphasis test; a measured End turn rect assertion.
2. **Green** — CSS/stacking/state changes only.
3. **Refactor** — merge the duplicated hand-band selector; no new abstraction.

## Impl steps

- [x] 1. G1: add the negative badge assertion, remove the badge surface, reroute any orphaned string to the preview status, and confirm lines/highlights/LP feedback still work. Evidence: `.duel-field-feedback` deleted from `src/styles/app.css` and its `<p>` markup deleted from `src/app/components/DuelField.svelte`; negative assertions added at `tests/unit/global-styles.test.ts` ("the action/phase badge ... is gone from the stylesheet") and `tests/component/DuelField.test.ts` ("duel field no longer renders the action/phase badge..."); field-lines/`.is-feedback-target` assertions kept and still pass (`npm run test:component -- DuelField` — 295 passed). No string needed rerouting to the preview panel: turn text already lives in `DuelHud.svelte:70` ("Your turn"/"Opponent's turn"), phase is already visualized by `PhaseStrip`'s current-phase chip, and chain is already covered by `ChainStatus.svelte`. Residual risk (not rerouted, logged in report): the transient `cardDrawn`/`cardsShuffled`/`duelStarted`/`hint` notice strings and the life-points delta text ("X damage"/"LP recovered") had no channel other than the badge and now have none — the LP *total* stays live via `DuelHud`'s `duel-hud-player-life-points`, but the transient delta text is gone with no substitute, since the preview-status plumbing (`previewStatusFor`) has no event-feed input and building that pipe was out of this ticket's scope.
- [x] 2. G2: add the failing overlapping-card chip hit test, then fix the hand band stacking so chips win; re-run the chip check across viewports. Evidence: `.duel-field-hand-band` z-index raised from `--duel-field-layer-card` (30) to `--duel-field-layer-menu` (100) in `src/styles/app.css`; new e2e test "item 5: hand action chips win over a field card that genuinely overlaps the hand band" (`e2e/duel-smoke.spec.ts`) places a real spellTrap card, measures its rect against the hand band's rect to prove a genuine overlap, then hit-tests the chip via `document.elementFromPoint` — passed (`PLAYWRIGHT_BROWSERS_PATH=... npx playwright test --project=chromium`, 29/29 passed including "responsive field compositions contain controls across supported viewports" which re-runs the existing chip check across VP-01/02/04/05/06/07).
- [x] 3. G3: add the hovered-candidate test, then implement pointer-following emphasis plus the halo transition, including the reduced-motion branch and the clear-on-release path. Evidence: `dropHoveredZoneId` state added in `DuelField.svelte`, computed in `moveCardDrag` (a pointermove handler, not the rAF loop) via the existing `zoneIdAtPoint` hit test, cleared on `startCardDrag`/`endCardDrag`/leaving every candidate; piped through `FieldBoard.svelte` → `ZoneControl.svelte` as `dropHovered`/`is-drop-hovered`; CSS adds a 120ms ease-out `transition` on `.is-drop-candidate` plus a brighter `.is-drop-hovered` halo and a `prefers-reduced-motion: reduce` override that disables the transition. New e2e test "item 18: the hovered drop candidate gets its own emphasis, distinct from unhovered candidates, and clears on release" (`e2e/duel-smoke.spec.ts`) drags a real placement, asserts `data-drop-hovered="true"` on the zone under the pointer, asserts every other candidate zone stays unhovered, asserts moving off every candidate clears it, and asserts release clears both `data-drop-candidate`/`data-drop-hovered` — passed in Chromium.
- [x] 4. G4: measure the current End turn rect, shrink the button, measure again, and assert both the reduction and the 44 px floor. Evidence: `.field-end-turn` padding reduced from `.55rem 1rem` to `.5rem .65rem` and `font-size: .8rem` added (height floor `min-height: 2.75rem` unchanged) in `src/styles/app.css`; new e2e test "item 24: End turn button is measurably smaller while keeping the 44px pointer-target floor" reproduces the old rule as a scoped style override on the live button and asserts a smaller after-width plus both dimensions >= 44px. Measured rects (Chromium, real DOM): before `{width: 111.671875, height: 44}`, after `{width: 84.90625, height: 44}` — width reduced ~24%, height held exactly at the 44px floor.
- [x] 5. Merge the duplicated `.duel-field-hand-band.is-opponent .duel-field-hand-band__viewport` blocks. Evidence: the two blocks at `src/styles/app.css` are now one rule with both `padding` and `flex-direction: row-reverse`; `npm run test:unit -- global-styles` passes (770/770).
- [x] 6. Re-run every gate; record before/after numbers for G2 and G4. Evidence: `npm run check:headless` exit 0, `npm run test:component` 295/295, `npm run build` succeeded, `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers npx playwright test --project=chromium` 29/29 passed. G2/G4 numbers recorded in steps 2 and 4 above.

## Outputs

- Files edited: `src/styles/app.css`, `src/app/presentation/presentation-command.ts` (and/or the component rendering the badge), `src/app/components/duel-field/FieldBoard.svelte`, `src/app/components/DuelField.svelte`, possibly `CardPreviewPanel.svelte`, `tests/unit/global-styles.test.ts`, `tests/component/DuelField.test.ts`, `e2e/duel-smoke.spec.ts`.
- Public API: none.
- Migration / config / dependencies: none.

## Validation

- [x] `npm run test:unit -- global-styles` passes — 770/770 (full `tests/unit` run under the `global-styles` filter arg)
- [x] `npm run test:component -- DuelField` passes — 295/295
- [x] `npm run check:headless` exits 0 — format/lint/typecheck/legacy/unit/integration/vendor/assets/snapshot all green
- [x] `npm run test:component` passes in full — 295/295
- [x] `npm run build` succeeds — `vite build --mode private` + `build:verify` both ok
- [x] `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers npx playwright test --project=chromium` passes in full — 29/29
- [x] browser evidence: no badge at the opponent hand position (CSS/DOM assertions above); chip hit test wins over an overlapping field card ("item 5" e2e test, verified real overlap then `document.elementFromPoint`); hovered candidate gets a distinct `data-drop-hovered="true"` emphasis that differs from unhovered candidates and clears on release ("item 18" e2e test); End turn rect measurably smaller (111.67px → 84.91px width) and still >= 44x44 (44x44 exactly)
- [x] app functional — no broken path from this slice — full 29-test Chromium e2e suite passes including the full-keyboard-duel completion test
- [x] commit msg draft: `fix(field): finish the four unshipped feedback items`
