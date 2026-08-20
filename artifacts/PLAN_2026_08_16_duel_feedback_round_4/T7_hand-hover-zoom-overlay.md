# T7: Hand hover-zoom overlay

**Plan:** `./artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`
**Depends:** T6
**Commit outcome:** Hovering a known hand card renders a subtly enlarged (1.6×) fixed-position copy that overflows the duel field and every panel; its action buttons sit just above the zoomed card.

## Context (self-contained)

- Goal: duel feedback round 4 — YGO story duel simulator (Svelte 5). User: "When you hover a card and it zooms from the hand, make sure the image can overflow, appear on top, and extend beyond the duel field or any other interface. Place the buttons just above the card itself when it is zoomed."
- Today: hand cards live inside `.duel-field-hand-band__viewport` (`overflow-x: auto; overflow-y: hidden`) — the in-place 1.35 scale is clipped by the band. Fix = portal overlay, same trick as `DragGhost` (`position: fixed`, stage-frame aware).
- Predecessor T6 produced: zoom gate = `card.code !== undefined`; class `is-identity-known` on `.duel-field-card`; hand in-place zoom rule is `.duel-field-card.is-identity-known.is-hand-item:not(.is-pinned):is(:hover, :focus-within) { transform: scale(1.35); }` in `src/styles/app.css`.
- Decision (ADR-032 `docs/ADR/032_ADR_hand_zoom_overlay_layer.md`, confirmed by grill round 1 Q6/Q7 — `artifacts/GRILL_2026_08_16_duel_feedback_round_4/ANSWERS.md`): overlay is pointer-only; keyboard keeps the existing focus/pin flow (in-place zoom on `:focus-within`, chips via pin). Overlay hosts the interactive `CardActionChips` row just above the enlarged art. Scale = **1.6×, subtle** — emphasis/hover-feedback only; card information lives in the preview panel (T15 adds stats there), so the overlay must not dominate the board.
- Out of scope here: field/zone card zoom (stays in place), drag ghost, keyboard flow changes, opponent hand (no identity → gated off by T6 anyway).
- Assumptions in force: portrait rotation handled via `readStageFrame`/`toFrameRect` from `src/battle/app/presentation/stage-frame.ts` exactly like drag ghost.

## Requirements

- New layer token `--duel-field-layer-hand-zoom: 140;` in `src/styles/tokens.css` (below `--duel-field-layer-drag-ghost: 150`, above windows 110/120).
- New component `src/battle/app/components/duel-field/HandZoomOverlay.svelte`:
  ```ts
  export let card: BoardCardView;
  export let anchor: { left: number; top: number; width: number; height: number }; // stage-frame px
  export let imageUrl: string;
  export let choices: readonly InteractionChoice[] = [];
  export let disabled = false;
  export let scale = 1.6;
  export let onchoose: (choice: InteractionChoice) => void = () => undefined;
  export let ondismiss: () => void = () => undefined;
  export let onpointerenter: () => void = () => undefined;
  export let onpointerleave: () => void = () => undefined;
  ```
  Geometry: `w = anchor.width * scale`, `h = anchor.height * scale`; `left = clamp(anchor.left + anchor.width/2 - w/2, 8, viewportWidth - w - 8)`; `top = max(8, anchor.top + anchor.height - h)` (grows upward from the card's bottom edge). Root `<div class="hand-zoom-overlay" data-cy={\`hand-zoom-overlay-${card.id}\`}>` with inline `style` for position/size; children: `<img class="hand-zoom-overlay__art" data-cy={\`hand-zoom-overlay-image-${card.id}\`} src={imageUrl} alt={card.label}>`, name strip `<span class="hand-zoom-overlay__name" data-cy={\`hand-zoom-overlay-name-${card.id}\`}>{card.label}</span>`, and `{#if choices.length > 0}<CardActionChips cardId={card.id} cardLabel={card.label} {choices} {disabled} {onchoose} {ondismiss} />{/if}`. CSS: chips row positioned `bottom: calc(100% + 0.3rem); left: 50%; transform: translateX(-50%); display: flex;` inside overlay (override the default `display: none` with `.hand-zoom-overlay .card-action-chips { display: flex; position: absolute; }`). Repo data-cy gate: every element needs `data-cy` (`tests/unit/data-cy-coverage.test.ts`).
- Wiring in `DuelField.svelte`:
  - State: `let handZoom: { card: BoardCardView; anchor: {left,top,width,height} } | null = null;`
  - `HandBand.svelte` gains `export let oncardzoomenter: (card: BoardCardView, element: HTMLElement) => void` and `export let oncardzoomleave: () => void`, forwarded to `CardControl` new props `onzoomenter: (element: HTMLElement) => void` / `onzoomleave: () => void`; `CardControl` calls them from `onpointerenter`/`onpointerleave` on the `<article>` only when `layout === "hand"` and `card.code !== undefined`.
  - DuelField handler `enterHandZoom(card, element)`: `const frame = readStageFrame(fieldRoot); const rect = toFrameRect(frame, element.getBoundingClientRect()); handZoom = { card, anchor: rect };` — clear on `oncardzoomleave` **unless** pointer moved into the overlay (overlay's `onpointerenter` sets a flag, its `onpointerleave` clears `handZoom`). Also clear on: drag start (`startCardDrag`), prompt change (inside `cancelDragGhostOnPromptChange` or a parallel `$:` on `spec`), board change.
  - Render after `DragGhost` block: `{#if handZoom !== null}<HandZoomOverlay card={handZoom.card} anchor={handZoom.anchor} imageUrl={…} choices={spec?.cardChoices.get(handZoom.card.targetId) ?? []} disabled={pending} onchoose={(choice) => dispatch({ type: "chooseChoice", choiceId: choice.id })} ondismiss={() => (handZoom = null)} …/>{/if}`. Image URL: same resolution as HandBand (`card.image.kind === "back" ? resolvedCardBackUrl : imageUrls.get(card.image.code) ?? resolvedPlaceholderUrl`) — extract tiny helper or duplicate expression.
- CSS in `src/styles/app.css`: `.hand-zoom-overlay { position: fixed; z-index: var(--duel-field-layer-hand-zoom); pointer-events: auto; }`, art fills, name strip bottom (reuse `.duel-field-card__label` styling values). Remove `:hover` from the hand in-place zoom rule (keep `:focus-within`): `.duel-field-card.is-identity-known.is-hand-item:not(.is-pinned):focus-within { transform: scale(1.35); }`. Add `.duel-field-card.is-hand-item:not(:focus-within):not(.is-pinned):hover .card-action-chips { display: none; }` so hover no longer opens the clipped in-band chips (focus/pin keep them).

## Inputs

- `src/battle/app/components/duel-field/DragGhost.svelte` + `.drag-ghost` CSS — fixed-layer precedent.
- `src/battle/app/presentation/stage-frame.ts` — `readStageFrame(element)`, `toFrameRect(frame, rect)`.
- `src/battle/app/components/duel-field/CardActionChips.svelte` — props `cardId`, `cardLabel`, `choices`, `disabled`, `onchoose`, `ondismiss`.
- **From Depends (T6):** `is-identity-known` gate; label condition `card.code !== undefined`; both zoom CSS rules already identity-gated.
- Acceptance harness: `src/battle/app/acceptance/acceptance-scenario.ts` (`AcceptanceScenarioId` union + `SCENARIOS` set), `src/battle/app/acceptance/full-height-field-scenarios.ts`, `src/battle/app/acceptance/AcceptanceHarness.svelte`, specs in `e2e-acceptance/`.

## TDD

1. **Red**
   - Component `tests/component/DuelField.test.ts` — test name: `hovering a known hand card mounts the zoom overlay with its actions above` — mount DuelField with a cardAction spec offering 2 choices on a hand card; `fireEvent.pointerEnter` on the card article → `[data-cy^="hand-zoom-overlay-"]` in DOM, contains `CardActionChips` buttons; `fireEvent.pointerLeave` (without entering overlay) → overlay gone.
   - Component — test name: `an unknown hand card never mounts the zoom overlay` — opponent hand placeholder hover → no overlay.
   - Acceptance `e2e-acceptance/hand-zoom.spec.ts` (new) — add scenario id `field-hand-zoom` to `acceptance-scenario.ts` + `full-height-field-scenarios.ts`: 6-card own hand, cardAction spec with 2 choices on the 3rd card. Test name: `the zoomed hand card overflows the hand band and shows chips above` — hover 3rd card; overlay `boundingBox()`: `overlay.y < handBandBox.y` (extends above band) and overlay height ≈ card height × 1.6 (±10%); chips row box bottom ≤ overlay top.
2. **Green** — implement component + wiring + CSS.
3. **Refactor** — extract shared image-url helper only if duplication bothers lint.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| hovering known hand card mounts overlay | pointerEnter on actionable hand card | overlay + chips mounted; unmounts on leave |
| unknown hand card never mounts overlay | opponent hand placeholder | no overlay |
| zoomed card overflows band, chips above | acceptance scenario field-hand-zoom | overlay top above band top; chips above overlay |

## Impl steps

- [ ] 1. Component tests (red): `npm run test:component -- tests/component/DuelField.test.ts`.
- [ ] 2. Add token `--duel-field-layer-hand-zoom: 140;` in `src/styles/tokens.css` next to the other `--duel-field-layer-*`.
- [ ] 3. Create `HandZoomOverlay.svelte` per spec above.
- [ ] 4. Extend `CardControl.svelte` (props `onzoomenter`/`onzoomleave`, fired for hand layout + known identity) and `HandBand.svelte` (forward props).
- [ ] 5. Wire `DuelField.svelte` state + render + clear paths (drag start, prompt change, leave).
- [ ] 6. CSS: overlay block, chips override, in-place hover rules per Requirements.
- [ ] 7. Component tests green; then scenario + `e2e-acceptance/hand-zoom.spec.ts`; run `npx playwright test -c playwright.acceptance.config.ts e2e-acceptance/hand-zoom.spec.ts`.
- [ ] 8. `npm run test:component && npm run test:unit && npm run typecheck && npm run lint` (data-cy gate covers new elements).
- [ ] 9. Manual check: dev duel — hover hand card: subtle 1.6× lift escaping the band, over side panels where it overlaps; buttons directly above it and clickable; drag still works; Escape/pin flow unchanged.

## Outputs

- Files touched: new `HandZoomOverlay.svelte`; `CardControl.svelte`, `HandBand.svelte`, `DuelField.svelte`, `src/styles/app.css`, `src/styles/tokens.css`, `acceptance-scenario.ts`, `full-height-field-scenarios.ts`, `tests/component/DuelField.test.ts`, new `e2e-acceptance/hand-zoom.spec.ts`.
- Public API: `HandBand` + `CardControl` new optional callbacks (default no-op — other call sites unaffected).
- Migrate/config: none.

## Validation

- [ ] tests pass: `npm run test:component`, `npx playwright test -c playwright.acceptance.config.ts e2e-acceptance/hand-zoom.spec.ts`
- [ ] manual check: hover zoom overflows field; buttons above card
- [ ] app functional — no broken path from this slice
- [ ] commit msg draft: `feat(field): hand hover zoom escapes the band via a fixed overlay with actions above`
