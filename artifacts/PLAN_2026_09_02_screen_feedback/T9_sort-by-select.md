# T9: Replace sort buttons with undoable Sort By

**Plan:** `./artifacts/PLAN_2026_09_02_screen_feedback.md`  
**Depends:** T8  
**Commit outcome:** One Sort By select + direction toggle applies seven deterministic, undoable deck sorts.

## Context (self-contained)

Goal: DB5. Current sort has alpha/type only and is deliberately excluded from undo history. Locked decision reverses that: every sort is an undoable mutation. Metadata already exists on `DeckBuilderCardView`. Out of scope: catalog-result sorting.

## Requirements

R1. Replace both buttons with `<select>` placeholder `Sort By` and asc/desc toggle.
R2. Modes: A–Z; CardType>A–Z; Level>CardType>A–Z; Attribute>CardType>A–Z; MonsterType>CardType>A–Z; ATK>CardType>A–Z; DEF>CardType>A–Z.
R3. Selection immediately mutates all deck zones; one undo history entry. Direction toggle re-applies current mode and creates one undoable mutation.
R4. Desc reverses primary key only; tie chain remains ascending, ending A–Z.
R5. Null/unknown numeric/text metadata sorts last in both directions; stable original index final tie-break.

## Inputs

I1. Read `src/decks/deck-model.ts`, `ocg-card-mapper.ts`, `deck-editor-store.ts` positional-history comment, `DeckEditor.svelte`, sort tests.
I2. From T8: editor header state after Import button.

## Interface contract (level 5)

P1. `export type SortMode = "alpha" | "type" | "level" | "attribute" | "race" | "atk" | "def"`.
P2. `export type SortDirection = "asc" | "desc"`.
P3. `DeckCommand` sort shape: `Readonly<{ type:"sort"; mode:SortMode; direction:SortDirection }>`.
P4. Comparator chains: `alpha=[name]`; `type=[family/frame,name]`; `level=[levelRankLink,type,name]`; `attribute=[attribute,type,name]`; `race=[race,type,name]`; `atk=[attack,type,name]`; `def=[defense,type,name]`. Normalize text with existing locale/case convention.
P5. Store positional exclusion becomes reorder-only: `command.type === "reorder"`; sort passes ordinary history append.
P6. UI select `data-cy="deck-workspace-sort-mode"`; toggle `data-cy="deck-workspace-sort-direction"`, accessible name `Sort ascending`/`Sort descending` describing next/current state consistently in tests.
E1. Missing catalog record uses deterministic fallback name `Card {code}` and null metadata.
N1. Card multiset per zone unchanged; repeat same sort is deterministic.

## TDD

1. **Red** — comparator table tests, null/stability, UI dispatch, undo/redo history tests.
2. **Green** — widen shared command first, then store semantics, then UI.
3. **Refactor** — focused comparator helpers only where reused across modes.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Each mode | mixed cards | exact chain order |
| Desc | ties | primary reversed, ties ascending |
| Null values | missing metadata | last |
| Undo | sort once | prior order restored |
| UI | choose mode/toggle | exact command per action |

## Impl steps

- [ ] 1. Add red model/store/component tests.
- [ ] 2. Widen `DeckCommand`; implement comparator chains.
- [ ] 3. Remove sort from non-history positional branch; update design comment/tests.
- [ ] 4. Replace header controls with select/toggle.

## Validation

- [ ] `npx vitest run tests/unit/decks/deck-model.test.ts tests/component/deck-editor/deck-reorder.test.ts tests/component/deck-editor/deck-autosave.test.ts`
- [ ] `npm run typecheck && npm run lint`
- [ ] Manual: each mode asc/desc, undo/redo, export reflects order.
- [ ] No silent-failure swallow added: none.
- [ ] App functional: autosave history includes sorts.
- [ ] Commit msg draft: `feat(deck-editor): make richer deck sorting reversible`
