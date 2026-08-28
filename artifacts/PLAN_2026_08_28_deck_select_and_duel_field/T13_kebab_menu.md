# T13: DeckTileMenu kebab action sheet

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`
**Depends:** T12
**Commit outcome:** `DeckTileMenu.svelte` action sheet (Open in deck builder / Rename / Duplicate / Delete) with outside-press + Escape dismissal and delete-guard, plus shared Rename dialog and Delete confirm dialog. Component-tested, exported. No screen consumes yet.

## Context (self-contained)

- Goal: implement validated deck-selection design (`docs/deck-selection-screen-design.md` §Deck actions (kebab menu)) in shared lib `src/deck-select/`.
- This slice: menu + the two dialogs its actions need. Desktop and mobile share it.
- Out of scope here: wiring to real rename/duplicate/delete operations (hosts do that in T21/T22/T24), footer buttons (T14), positioning relative to viewport edges beyond simple flip.
- Assumptions in force: T12's `DeckTile.svelte` emits `onmenu(anchor: HTMLElement)`; repo has focus-trap helper `handleModalKeydown` in `src/deck-editor/focus-trap.ts` — deck-select must NOT import it (cross-domain); copy the minimal pattern locally.

## Requirements

- New `src/deck-select/DeckTileMenu.svelte`. Props:

```ts
export let tile: DeckTileModel;
export let anchor: HTMLElement;
/** Menu closes itself on any choice, outside press, or Escape; host clears state. */
export let onclose: () => void = () => undefined;
export let onopen: () => void = () => undefined;
export let onrename: () => void = () => undefined;
export let onduplicate: () => void = () => undefined;
export let ondelete: () => void = () => undefined;
```

- Sheet root `data-cy={`deck-tile-menu-sheet-${tile.key}`}`, `role="menu"`, absolutely positioned near `anchor` (`anchor.getBoundingClientRect()`, below-right, flip above when past viewport bottom).
- Items in exact order (design §Deck actions), each `role="menuitem"` button:
  1. `deck-tile-menu-open-${key}` — "Open in deck builder" → `onopen()` then `onclose()`
  2. `deck-tile-menu-rename-${key}` — "Rename" → `onrename()` then `onclose()`
  3. `deck-tile-menu-duplicate-${key}` — "Duplicate" → `onduplicate()` then `onclose()`
  4. `deck-tile-menu-delete-${key}` — "Delete" → `ondelete()` then `onclose()`; `disabled={!tile.deletable}` (bundled/AI-owned never deletable)
- Dismissal: `Escape` keydown and pointerdown outside sheet → `onclose()` without firing an action. Focus moves into sheet on mount (first item), returns to `anchor` on close.
- **`[hidden]` trap guard** (design §Desktop hover previews warning): if any rule sets `display` on the sheet class, also add explicit `[hidden] { display: none; }` override in the component style.
- New `src/deck-select/RenameDeckDialog.svelte`:

```ts
export let deckName: string;
export let maxLength = 64;
export let oncancel: () => void = () => undefined;
export let onsubmit: (name: string) => void = () => undefined;
```

  - `role="dialog" aria-modal="true"`, `data-cy="deck-select-rename-dialog"`, input `data-cy="deck-select-rename-input"` prefilled `deckName`, submit `data-cy="deck-select-rename-submit"` disabled while trimmed input empty, cancel `data-cy="deck-select-rename-cancel"`, Escape = cancel. Modal keydown pattern: copy shape from `src/deck-editor/components/DeckLibrary.svelte` create-dialog (local helper, no cross-domain import).
- New `src/deck-select/DeleteDeckConfirm.svelte`:

```ts
export let deckName: string;
export let oncancel: () => void = () => undefined;
export let onconfirm: () => void = () => undefined;
```

  - `data-cy="deck-select-delete-confirm"`, body names the deck, confirm `data-cy="deck-select-delete-confirm-button"`, cancel `data-cy="deck-select-delete-cancel"`, Escape = cancel.

## Inputs

- `src/deck-select/deck-select-contracts.ts` — `DeckTileModel` (T11).
- **From Depends:** T12 `DeckTile.svelte` emits `onmenu(anchor: HTMLElement)`; menu is a sibling the host screen renders when that fires.

## TDD

1. **Red** — `tests/component/deck-select/deck-tile-menu.test.ts` + `tests/component/deck-select/deck-dialogs.test.ts`; fail (components absent).
2. **Green** — implement, export, widen frozen list.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `menu renders four items in order` | deletable tile | 4 menuitems, texts exact, order Open/Rename/Duplicate/Delete |
| `delete disabled for undeletable tile` | `deletable=false` | `deck-tile-menu-delete-k1` disabled |
| `choosing an item fires its callback then closes` | click duplicate | `onduplicate` then `onclose`, once each |
| `Escape closes without action` | Escape keydown | `onclose` only |
| `outside pointerdown closes without action` | pointerdown on document body | `onclose` only |
| `rename dialog submits trimmed name` | type " New Name ", submit | `onsubmit("New Name")` |
| `rename submit disabled on empty` | clear input | submit disabled |
| `delete confirm names the deck and confirms` | deckName "Blue Fleet", click confirm | body contains "Blue Fleet", `onconfirm` called |

Run: `npx vitest run tests/component/deck-select`

## Impl steps

- [ ] 1. Write failing `tests/component/deck-select/deck-tile-menu.test.ts` (anchor = rendered dummy button element).
- [ ] 2. Write failing `tests/component/deck-select/deck-dialogs.test.ts`.
- [ ] 3. Create `src/deck-select/DeckTileMenu.svelte` per Requirements.
- [ ] 4. Create `src/deck-select/RenameDeckDialog.svelte` + `src/deck-select/DeleteDeckConfirm.svelte`.
- [ ] 5. Export `DeckTileMenu`, `RenameDeckDialog`, `DeleteDeckConfirm` from `src/deck-select/index.ts`; extend frozen list in `tests/unit/domain-boundaries.test.ts`.
- [ ] 6. `npx vitest run tests/component/deck-select tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts` → green.
- [ ] 7. `npm run lint && npm run typecheck` → green.

## Outputs

- New: `src/deck-select/DeckTileMenu.svelte`, `src/deck-select/RenameDeckDialog.svelte`, `src/deck-select/DeleteDeckConfirm.svelte`, 2 test files.
- Edited: `src/deck-select/index.ts`, `tests/unit/domain-boundaries.test.ts`.
- Public API: three components with props above — T14 hosts the menu/dialog state machine and quotes these names verbatim.

## Validation

- [ ] `npx vitest run tests/component/deck-select tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts` green
- [ ] `npm run lint && npm run typecheck && npm run build` green
- [ ] app functional — no consumer yet
- [ ] commit msg draft: `feat(deck-select): add the kebab action sheet with rename and delete dialogs`
