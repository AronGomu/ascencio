# T8: Import into open deck

**Plan:** `./artifacts/PLAN_2026_09_02_screen_feedback.md`  
**Depends:** T7  
**Commit outcome:** Header Import opens existing YDK dialog and replaces current lists in one undoable save.

## Context (self-contained)

Goal: DB4. `YdkImport.svelte` exists in library flow. `DeckCommand` already has `{ type:"import"; cards:DeckCardLists }`, producing one history entry. Out of scope: new formats, rename, Load/autosave behavior.

## Requirements

R1. Add header `Import` button separate from `Load`.
R2. Reuse `YdkImport`; inside editor `requireName=false`; imported name ignored.
R3. Commit exact parsed lists via one `import` command; one undo restores previous lists; redo reapplies.
R4. Unknown codes remain placeholder tiles (`Missing card {code}`).
R5. Story unowned codes remain in lists but greyed/disabled; do not drop imported entries.
R6. Save failure uses existing store error/retry behavior; dialog stays open when import returns false/throws.

## Inputs

I1. Read `YdkImport.svelte`, library import mount, `DeckEditor.svelte`, `DeckEditorApp.svelte`, `deck-editor-store.ts`, `deck-model.ts`, ownership mapper.
I2. From T7: stabilized editor header/layout.

## Interface contract (level 5)

P1. Button: text `Import`, `data-cy="deck-editor-import"`.
P2. Dialog props: `requireName={false}`, `catalogCodes={new Set(catalog.keys())}`, `existingDeckNames={[]}`; `onimport(cards)` dispatches exactly `{ type:"import", cards }`.
P3. Change controller `mutate(command: DeckCommand): Promise<void>` to `mutate(command: DeckCommand): Promise<boolean>`: `true` only when command validates and save completes; `false` on validation/save/conflict failure after state error is published. Existing callers may ignore return. Editor import adapter returns this boolean to `YdkImport`; dialog closes only on `true`, then focus returns to Import button.
P4. Undo/redo histories each gain one snapshot for full-list replacement.
E1. Existing exact parser messages from `importYdk` remain unchanged. Store save failures use current `state.saveState/state.message`.
N1. `deck.name` and `deck.id` unchanged; imported list order preserved.

## TDD

1. **Red** — header/dialog, success, undo/redo, unknown/unowned and failure-focus tests.
2. **Green** — reuse component + existing import command.
3. **Refactor** — share modal focus pattern with Load without abstracting dialogs.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Valid YDK | main/extra/side lists | current deck lists replaced, name unchanged |
| Undo | after import | all prior lists restored in one step |
| Unknown code | valid YDK unknown to catalog | placeholder remains |
| Story unowned | known but not owned | greyed/disabled tile remains |
| Save rejection | repository fails | dialog error visible; no silent close |

## Impl steps

- [ ] 1. Add failing editor/import + store history tests.
- [ ] 2. Mount dialog/backdrop/focus lifecycle from header.
- [ ] 3. Dispatch existing import command; preserve ownership/placeholder rendering.

## Validation

- [ ] `npx vitest run tests/component/deck-editor tests/unit/decks/ydk-adapter.test.ts tests/unit/decks/deck-model.test.ts`
- [ ] `npm run typecheck && npm run lint`
- [ ] Manual: import .ydk + pasted YDK, undo, redo, Load still distinct.
- [ ] No silent-failure swallow: file-read/save paths show existing errors.
- [ ] App functional: autosave/reload preserves imported list.
- [ ] Commit msg draft: `feat(deck-editor): make YDK replacement undoable in place`
