# T2: Redesign deck tile around default star

**Plan:** `./artifacts/PLAN_2026_09_02_screen_feedback.md`  
**Depends:** T1  
**Commit outcome:** Local deck tiles show name + one tag line + top-right set-default star; old counts/date/checkmark clutter is gone.

## Context (self-contained)

Goal: implement Deck Selection tile cleanup. T1 removed favourites. This slice changes presentation/default action only. Out of scope: bundled-open refusal (T5), hover preview (T3), grid sizing (T4). Bundled presets cannot be persisted as default; render no star for them.

## Requirements

R1. Remove selected checkmark, Main/Extra/Side counts, modified date text and `Default` text badge.
R2. Keep deck name plus exactly one tag/meta line aligned on same bottom row as kebab menu.
R3. Local/story editable non-default deck: outline star button top-right; click sets it default.
R4. Current default: filled gold star top-right, disabled, accessible label `Default deck`.
R5. Setting one deck default clears prior tile's filled state through host state refresh.
R6. Bundled preset: no default-star control. Locked story-owned decks follow host default capability, not `bundled` alone.
R7. Preserve illegal/locked/bundled tags needed to explain availability; collapse into one concise tag line.

## Inputs

I1. Read `src/deck-select/DeckTile.svelte`, `deck-select-contracts.ts`, `DeckSelectScreen.svelte`, host mappings under `src/shell/screens/`, `src/story/decks/`, `src/deck-editor/components/deck-library-tiles.ts`.
I2. From T1: `DeckTileModel` has no favourite field/handlers; default repository/reducer actions remain.

## Interface contract (level 5)

P1. `DeckTileModel` retains `isDefault`, `bundled`, `lockedBy`, `legal`, `blockReason`, `deletable`; removes obsolete `counts` and `updatedAt` only if no consumer remains after DS2 sort/filter inspection. If sort still consumes `updatedAt`, keep it model-only and never render it.
P2. `DeckTile.svelte` adds `export let onsetdefault: () => void = () => undefined` and `export let canSetDefault = true`.
P3. Star renders iff `canSetDefault`; non-default button: `aria-label={\`Set ${tile.name} as default deck\`}`, `aria-pressed="false"`; default: disabled, `aria-label="Default deck"`, `aria-pressed="true"`.
P4. Host callback maps local/free-play to repository `setDefaultDeck(id)`; story to reducer `{ type: "deck-set-default", id }`.
E1. Persist failure uses existing host toast/error path; tile never owns storage.
N1. Deck-select remains presentation-only: no imports from sibling domains.

## TDD

1. **Red** — tests for star states/action, previous default clearing, bundled no-star, removed copy.
2. **Green** — minimal model/host/component changes.
3. **Refactor** — collapse tag rendering without new generic abstraction.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Non-default local | `isDefault:false`, capable | Outline enabled star; callback once |
| Default local | `isDefault:true` | Filled disabled star, label `Default deck` |
| Bundled preset | `canSetDefault:false` | No star |
| Host update | Click deck B while A default | B filled; A outline after state refresh |
| Tile copy | Any tile | No checkmark/count/date/default badge; one tag line |

## Impl steps

- [ ] 1. Add failing component + host tests.
- [ ] 2. Define default capability/action props and host mappings.
- [ ] 3. Rewrite tile markup/styles; retain required `data-cy` uniqueness.
- [ ] 4. Remove only now-orphaned model fields/imports.

## Validation

- [ ] `npx vitest run tests/component/deck-select/deck-tile.test.ts tests/component/deck-select/deck-select-screen.test.ts tests/component/story/pre-battle-deck-picker.test.ts`
- [ ] `npx vitest run tests/unit/data-cy-coverage.test.ts tests/unit/domain-boundaries.test.ts`
- [ ] `npm run typecheck && npm run lint`
- [ ] Manual: set A default, then B; star moves; bundled has no star.
- [ ] No silent-failure swallow added: none.
- [ ] App functional: default persists after reload.
- [ ] Commit msg draft: `feat(deck-select): make default status the tile's sole mark`
