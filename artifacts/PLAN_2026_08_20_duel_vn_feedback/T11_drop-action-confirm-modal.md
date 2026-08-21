# T11: Drop action confirm modal

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T9
**Commit outcome:** Dropping a card on a zone that offers two or more legal actions opens a centred modal listing them plus Cancel, instead of silently picking one.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is `feedback-duel.md` item 6.
- This slice: replace the drop auto-pick with a confirmation whenever the gesture is ambiguous. A drop with exactly one legal action stays instant.
- Out of scope here: which actions the engine offers, the placement round-trip after the action is chosen (`pending-placement.ts` is unchanged), the hand zoom (T8/T9).
- Assumptions in force: the modal is centred (not anchored to the zone); Cancel and `Escape` both return the card to its origin with nothing dispatched.

## Requirements

- `dropChoiceForZone` is replaced by a function returning **all** legal choices for that zone, in the existing preference order.
- Zero choices → the drop is refused exactly as today. One choice → dispatched immediately, as today. Two or more → the modal opens.
- The modal lists one button per choice using the same labels the card's action chips use, plus a Cancel button styled as the cancelling action.
- Cancelling dispatches nothing and leaves the card where it was.

## Inputs

- `src/battle/app/prompts/drop-target.ts` — the whole file. `dropChoiceForZone(zone, choices)` returns the first match of `MONSTER_PREFERENCE = ["summon","specialSummon","setMonster"]`, `SPELL_TRAP_PREFERENCE = ["activate","setSpellTrap"]`, or `EXTRA_MONSTER_PREFERENCE = ["specialSummon"]` for the ids `shared:extraMonster:left|right`.
- `src/battle/app/components/DuelField.svelte` — `endCardDrag` (wired at line 1013 as `oncarddragend`) is the only caller of `dropChoiceForZone`.
- `src/battle/app/presentation/card-action-label.ts` — the label function the chips use; the modal must use it too.
- `src/battle/app/components/duel-field/ZoneListDialog.svelte` — an existing centred dialog to copy focus-trap and `Escape` handling from.
- `src/battle/app/prompts/interaction-session.ts` — `chooseChoice` is the action to dispatch on confirm.
- Tests: `tests/unit/drop-target.test.ts`, `tests/component/DuelField.test.ts`.

## From Depends

- T9 added `pinnedHandTarget: BoardTargetId | null` to `DuelField.svelte`, made a hand-card click pin the zoom rather than dispatch, made `leaveHandZoom` a no-op while pinned, and clears the pin on drag start, on `Escape`, on an outside pointerdown and after an action fires. A drag therefore always begins from an unpinned state.

## TDD

1. **Red** — in `tests/unit/drop-target.test.ts`, add `returns every legal action for the zone in preference order` and `returns an empty list for a zone that hosts none`; in `tests/component/DuelField.test.ts`, add `an ambiguous drop opens the confirm modal` and `cancelling the modal dispatches nothing`.
2. **Green** — rename the function to `dropChoicesForZone`, return an array, add `DropConfirmDialog.svelte`, and branch in `endCardDrag`.
3. **Refactor** — keep the preference constants and the extra-monster-zone rule exactly as they are; they now order the modal's buttons.

## Test plan

| Test                                                          | Input                                                   | Expect                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| `returns every legal action for the zone in preference order` | spell/trap zone, choices `[setSpellTrap, activate]`     | `["activate", "setSpellTrap"]`                                       |
| `returns a single action unchanged`                           | monster zone, only `summon`                             | `["summon"]`                                                         |
| `returns an empty list for a zone that hosts none`            | deck zone                                               | `[]`                                                                 |
| `extra monster zone still offers only specialSummon`          | EMZ, choices include `summon`                           | `["specialSummon"]`                                                  |
| `an ambiguous drop opens the confirm modal`                   | drop a spell on an empty spell zone with activate + set | `[data-cy="drop-confirm-dialog"]` present, 2 action buttons + cancel |
| `a single-action drop dispatches immediately`                 | drop a monster whose only action is `summon`            | no dialog; one `chooseChoice`                                        |
| `cancelling the modal dispatches nothing`                     | open the modal, press Cancel                            | no dispatch; dialog closed                                           |
| `Escape cancels the modal`                                    | open the modal, press `Escape`                          | no dispatch; dialog closed                                           |

## Impl steps

- [ ] 1. Add the failing unit and component tests above.
- [ ] 2. In `src/battle/app/prompts/drop-target.ts`, rename `dropChoiceForZone` to `dropChoicesForZone` and return `preference.flatMap((action) => choices.filter((c) => c.action === action))`; keep `preferenceForZone` unchanged.
- [ ] 3. Create `src/battle/app/components/duel-field/DropConfirmDialog.svelte` with props `card: BoardCardView`, `zone: BoardZoneView`, `choices: readonly InteractionChoice[]`, `onconfirm: (choice) => void`, `oncancel: () => void`; render a centred modal with `data-cy="drop-confirm-dialog"`, one button per choice at `data-cy={`drop-confirm-action-${choice.id}`}` labelled through `card-action-label.ts`, and a cancel button at `data-cy="drop-confirm-cancel"` carrying the danger styling.
- [ ] 4. Copy the focus trap and `Escape` handling from `ZoneListDialog.svelte`; focus the first action on mount.
- [ ] 5. In `DuelField.svelte`, change `endCardDrag` to call `dropChoicesForZone`; on `length === 0` keep the current refusal, on `1` dispatch as today, on `>= 2` set `dropConfirm = { card, zone, choices }`.
- [ ] 6. Mount `<DropConfirmDialog>` when `dropConfirm !== null`, dispatching `chooseChoice` on confirm and clearing state on both paths.
- [ ] 7. Add the modal's rule to `src/styles/app.css` reusing the existing dialog tokens.
- [ ] 8. Run `npx vitest run tests/unit/drop-target.test.ts tests/component/DuelField.test.ts`, then `npx vitest run tests/unit/data-cy-coverage.test.ts`.

## Outputs

- Files touched: `src/battle/app/prompts/drop-target.ts`, `src/battle/app/components/duel-field/DropConfirmDialog.svelte` (new), `src/battle/app/components/DuelField.svelte`, `src/styles/app.css`, `tests/unit/drop-target.test.ts`, `tests/component/DuelField.test.ts`.
- Behaviour change: ambiguous drops ask; `dropChoiceForZone` no longer exists.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/unit/drop-target.test.ts tests/component/DuelField.test.ts` passes
- [ ] `npx vitest run tests/unit/data-cy-coverage.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual: drag a spell onto an empty spell/trap zone — activate, set and cancel are offered; cancel returns the card
- [ ] app functional — unambiguous drops still play in one gesture
- [ ] commit msg draft: `feat(duel-drop): an ambiguous drop asks which action instead of guessing`
