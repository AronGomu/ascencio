# T10: Approved browse dialog shell

**Plan:** `./ai_artefacts/PLAN_2026_08_13_feedback_follow_up.md`
**Depends:** T9
**Commit outcome:** Browse card list has approved shell/chrome, stable privacy-safe ordering, explicit empty state, responsive field-local sizing.

## Context (self-contained)

- Goal: Start card-list redesign with complete browse vertical slice; keep current tiles/actions usable until visual tile ticket.
- This slice: Pure presentation model + source labels + browse shell/footer/order/empty/responsive/wheel/drag/dismiss.
- Out of scope here: 144px tile visual internals, Details action, projected duplicate-choice menu, target collapse/selection semantics.
- Assumptions: 1320×600 = expanded cap only when field boundary permits; field-local clamp wins. Browse has header `×` + footer red Cancel; both dismiss without engine response.

## Requirements

- Browse title is zone only: Deck, Extra Deck, Graveyard, Banished.
- Header 58px: title + count + `×`; no filter/collapse.
- Body clips vertically; one horizontal scroller; short row centered; overflow exact 8px leading/trailing margins; existing wheel conversion preserved.
- Footer 64px: checkbox label `Alphabetical` + red Cancel; no order prose/Validate.
- Off = byte-for-byte source array order. On = stable locale name + source-index tie-break. Never mutate input.
- If any identity hidden or fewer than 2 entries, alphabetical disabled/off; never sort hidden identity.
- Empty: count 0, `No cards available`, disabled checkbox.
- Browse outside/Escape/×/Cancel dismiss; drag handle remains.

## Inputs

- `ai-artifacts/PROTOTYPE_SPEC_card-list-dialog.md` §§3–5,8–10; `docs/feature/PROTOTYPE_card-list-dialog.html`.
- `docs/ADR/017_ADR_floating_field_windows_and_dismissal.md`, `021_ADR_card_list_dialog_modes_and_selection.md`.
- `src/app/components/duel-field/ZoneListDialog.svelte`, `FloatingFieldWindow.svelte`, `src/field/off-field-target-list.ts`, `src/styles/app.css`.
- `tests/component/ZoneListDialog.test.ts`, `FloatingFieldWindow.test.ts`; `tests/unit/off-field-target-list.test.ts`, `zone-list.test.ts`.
- **From Depends:** full-height field boundary/clamp functional; settings/persistence stable; acceptance harness union currently field scenarios + dedicated config.

## Exact model API

Create `src/app/presentation/card-list-dialog-model.ts`:

```ts
export function cardListDisplayEntries<
  T extends {
    readonly id: string;
    readonly label: string;
    readonly identityVisible: boolean;
  },
>(entries: readonly T[], alphabetical: boolean): readonly T[];

export function cardListBrowseTitle(
  zone: BoardStackView["zone"],
): "Deck" | "Extra Deck" | "Graveyard" | "Banished";

export function cardListAlphabeticalAllowed(
  entries: readonly { readonly identityVisible: boolean }[],
): boolean;
```

Update source badge type now for later target use:

```ts
export type OffFieldZoneBadge =
  | "HAND"
  | "EXTRA DECK"
  | "GRAVEYARD"
  | "BANISHED"
  | "DECK";
```

Fixed source order constant exported as `OFF_FIELD_ZONE_DISPLAY_ORDER` in that order.

Create `src/app/acceptance/card-list-dialog-scenarios.ts` exporting `CARD_LIST_BROWSE_SIX`, `CARD_LIST_BROWSE_OVERFLOW`, `CARD_LIST_EMPTY`, `cardListAcceptanceScenario(id)`. Extend acceptance union with `card-list-browse-six`, `card-list-browse-overflow`, `card-list-empty`; create `e2e-acceptance/card-list-dialog.spec.ts`.

## TDD

1. **Red** — pure sort/title/privacy/labels; browse component behavior; responsive Chromium shell.
2. **Green** — model/source labels/shell markup/CSS + scenarios.
3. **Refactor** — keep tile component API stable until T11; remove only obsolete browse header/body/footer rules.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `sorts visible entries stably without mutation` | frozen entries + duplicate names | locale order; source tie; input equal |
| `restores exact source order` | on→off | IDs exactly original |
| `disables sorting for hidden identities` | any hidden | source order; disabled checkbox |
| `renders approved browse chrome and physical copies` | 6 cards incl duplicate | title `Graveyard`; count 6; 6 tiles; no qty |
| `renders empty state` | [] | count 0/message/disabled sort |
| `dismisses browse through four routes` | ×/Cancel/outside/Escape | `onclose` once; no `onchoose` |
| `keeps drag and wheel behavior` | overflow | drag position change; consumable delta→scrollLeft |
| `caps/clamps expanded shell` | wide/narrow | 1320×600 when possible; inside boundary otherwise |
| `centers short row and preserves overflow edges` | 6/12 | no overflow+≤1px centre; overflow 8±0.5px edges |
| `fits 780 and 320 widths` | Chromium | no page overflow; dialog inside viewport/field |

## Impl steps

- [ ] 1. Add pure model tests + source-label test updates; prove red.
- [ ] 2. Implement stable order/title/alphabetical helpers + full badge values/order.
- [ ] 3. Rewrite browse mode header/body/footer in ZoneListDialog; local alphabetical state; exact empty state/copy/data-cy.
- [ ] 4. Keep target branch behavior compiling unchanged; do not alter exact-single callbacks yet.
- [ ] 5. Add shell grid/size cap/body scroller/centering/edge CSS scoped to zone-list window.
- [ ] 6. Preserve FloatingFieldWindow drag + browse outside/Escape; route footer Cancel to same dismiss callback.
- [ ] 7. Extend acceptance harness/scenario union; add browse/empty/overflow Chromium spec.
- [ ] 8. Run source/unit/component/browser tests + privacy check.

## Outputs

- Created: card-list model + unit test; acceptance card-list scenario source/spec.
- Modified: source badges, ZoneListDialog browse branch, styles/tests/harness union.
- Public APIs exact above; current target callbacks unchanged.

## Validation

- [ ] `npx vitest run tests/unit/card-list-dialog-model.test.ts tests/unit/off-field-target-list.test.ts tests/unit/zone-list.test.ts` → exit 0.
- [ ] `npx vitest run tests/component/ZoneListDialog.test.ts tests/component/FloatingFieldWindow.test.ts tests/unit/data-cy-coverage.test.ts` → exit 0.
- [ ] `npm run typecheck && npm run lint` → exit 0.
- [ ] `npx playwright test --config=playwright.acceptance.config.ts --project=chromium e2e-acceptance/card-list-dialog.spec.ts --grep "browse|empty|responsive"` → exit 0.
- [ ] manual check — browse actions remain usable; sorting never requests/reveals hidden art.
- [ ] app functional — `npm run build` exits 0.
- [ ] commit msg draft: `feat(card-list): ship approved browse shell and ordering`
