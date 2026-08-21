# T9: Click-pinned hand zoom

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T8
**Commit outcome:** Clicking a hand card freezes its zoom and action list in place with the orange selected halo; clicking outside or the card again cancels; only an action button — or a drag — commits the card.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is `feedback-duel.md` item 4.
- This slice: the interaction model of a hand card. Today a click fires immediately when exactly one action is legal; after this ticket a click never commits anything.
- Out of scope here: the drop confirmation modal (T11), field cards (their pinned chip menu is unchanged), keyboard flow (ADR-032 §4 keeps the keyboard on the pin/focus path, not the zoom).
- Assumptions in force: the pin survives pointer-out; the orange halo is the existing `selected` halo from ADR-031; committing by drag-and-drop stays available.

## Requirements

- Clicking a hand card sets a pinned zoom: the overlay stays mounted at the card's anchor with its action list, regardless of pointer position.
- The pinned card renders the orange selected halo.
- Clicking the same card again, clicking anywhere outside the card+overlay union, or pressing `Escape`, cancels the pin and returns the card to its unzoomed state without dispatching a choice.
- Clicking an action button dispatches that choice **and** clears the pin, returning the card to its normal state.
- A card with exactly one legal action behaves identically: the click pins, the button commits.

## Inputs

- `src/battle/app/components/DuelField.svelte`
  - `activateCard(card)` at lines 418-438 — currently: `if (choices.length === 1) dispatch({ type: "chooseChoice", choiceId: choice.id }); else dispatch({ type: "openMenu", target: card.targetId });`. The single-choice branch is what this ticket removes for hand cards.
  - `handZoom` state and `enterHandZoom` / `leaveHandZoom` at lines 688-707, including the `insideHandZoomUnion(related)` check at line 711.
  - `<HandZoomOverlay …>` mount at lines 1038-1053 with `ondismiss={() => (handZoom = null)}`.
  - `pinnedTarget={session.menuTarget}` passed to the board at line 1000.
- `src/battle/app/prompts/interaction-session.ts` — the session reducer holding `menuTarget`, and the `openMenu` / `closeMenu` / `chooseChoice` actions.
- `src/battle/app/components/duel-field/CardControl.svelte` — `class:is-pinned={pinned}`, `class:is-selected={selected}`, and `activate()` which calls `onactivate(currentTarget)` on click while ignoring a click that followed a drag (`pointerMoved`).
- `src/styles/app.css` — `.duel-field-card.is-selected` carries the orange halo (ADR-031, `--selected`).
- Tests: `tests/component/DuelField.test.ts`, `tests/component/CardControl.test.ts`, `tests/unit/interaction-session.test.ts`.

## From Depends

- T8 gave `HandZoomOverlay.svelte` a stacked action list (`CardActionChips` with `layout="stack"`), added `--hand-zoom-width` to `overlayStyle`, and kept `onchoose` / `ondismiss` / `onzoomleave` as its outward callbacks. T4 (its own predecessor) made the overlay lease its art from `imageLibrary` and removed the `imageUrls` prop from `DuelField`, `FieldBoard` and `HandBand`.

## TDD

1. **Red** — add to `tests/component/DuelField.test.ts`: `clicking a hand card with one action pins instead of committing`, `clicking the pinned card again cancels`, `clicking an action commits and unpins`, `Escape cancels the pin`.
2. **Green** — introduce a `pinnedHandZoom: BoardTargetId | null` field beside `handZoom` in `DuelField.svelte`; make `activateCard` for a hand card set it instead of dispatching; make `leaveHandZoom` a no-op while pinned; wire a document-level pointerdown and keydown to cancel.
3. **Refactor** — keep field-card behaviour flowing through the untouched `openMenu` path.

## Test plan

| Test                                                              | Input                                       | Expect                                                                |
| ----------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| `clicking a hand card with one action pins instead of committing` | hand card, `cardChoices` of size 1, click   | no `chooseChoice` dispatched; overlay present; card has `is-selected` |
| `clicking the pinned card again cancels`                          | click the same card twice                   | overlay unmounted; no dispatch                                        |
| `clicking outside cancels`                                        | pointerdown on the board background         | overlay unmounted; no dispatch                                        |
| `Escape cancels the pin`                                          | keydown `Escape`                            | overlay unmounted; no dispatch                                        |
| `clicking an action commits and unpins`                           | click the action button                     | exactly one `chooseChoice` with that choice id; overlay unmounted     |
| `pointer leaving does not cancel a pinned zoom`                   | pointerleave outside the union while pinned | overlay still mounted                                                 |
| `dragging a pinned card still commits by drop`                    | drag to a legal zone                        | the existing drop path runs; pin cleared                              |

## Impl steps

- [ ] 1. Add the failing component tests above; run `npx vitest run tests/component/DuelField.test.ts`.
- [ ] 2. In `DuelField.svelte`, add `let pinnedHandTarget: BoardTargetId | null = null;` beside `handZoom`.
- [ ] 3. In `activateCard`, branch on the card's zone: for a hand card, set `pinnedHandTarget = pinnedHandTarget === card.targetId ? null : card.targetId` and open the zoom via `enterHandZoom(card, element)`; return before any `dispatch`. Leave the field-card branches unchanged.
- [ ] 4. In `leaveHandZoom(related)`, return early when `pinnedHandTarget !== null`.
- [ ] 5. Add an `on:pointerdown` listener on the field root that clears `pinnedHandTarget` and `handZoom` when the event target is outside the card+overlay union (reuse `insideHandZoomUnion`).
- [ ] 6. Add a `keydown` handler clearing the pin on `Escape`, placed beside the existing field key handling.
- [ ] 7. Pass `selected` to the pinned hand card so `CardControl` renders `is-selected` (orange halo); confirm `pinned` still drives the field's own chip menu.
- [ ] 8. In the overlay mount, wrap `onchoose` so it dispatches the choice and then clears `pinnedHandTarget` and `handZoom`.
- [ ] 9. Clear `pinnedHandTarget` in the existing drag-start handler so a drag out of a pinned card behaves normally.
- [ ] 10. Re-run the component tests, then `npx vitest run tests/component`.

## Outputs

- Files touched: `src/battle/app/components/DuelField.svelte`, `src/battle/app/components/duel-field/CardControl.svelte` (only if a `selected` pass-through is missing), `tests/component/DuelField.test.ts`.
- Behaviour change: a hand-card click can no longer commit a play; the action button or a drag does.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/component/DuelField.test.ts` passes
- [ ] `npx vitest run tests/component` passes
- [ ] `npm run check:headless` passes
- [ ] manual: click a one-action card — it pins with an orange halo and nothing is played until the button is pressed
- [ ] app functional — field cards, targeting prompts and drag-and-drop still work
- [ ] commit msg draft: `feat(hand): a click pins the zoom and its actions, never commits the play`
