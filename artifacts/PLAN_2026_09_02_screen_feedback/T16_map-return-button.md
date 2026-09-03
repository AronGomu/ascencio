# T16: Remember story screen origin for map return

**Plan:** `./artifacts/PLAN_2026_09_02_screen_feedback.md`  
**Depends:** T15  
**Commit outcome:** Map shows red bottom-left Return to X and returns to actual prior story screen, with legacy saves compatible.

## Context (self-contained)

Goal: M1. Story screen is persisted state; adding previousScreen changes save schema. `StoryApp.svelte` already has local `previousScreen` for playback—rename/reconcile. Out of scope: map sidebar/popover (T17).

## Requirements

R1. Story state records prior distinct screen on internal transitions.
R2. Old saves lacking field load with `previousScreen:null`.
R3. Map button label derives from previous story screen; fallback target narrative/dialog.
R4. Red button bottom-left. No generic browser history.
R5. Do not record transient same-screen state updates as origin; shop sub-screen navigation should preserve meaningful return chain.

## Inputs

I1. Read `story-state.ts`, `story-reducer.ts`, StoryApp `go()`, save contracts/migrations, local playback `previousScreen`, map component.
I2. From T15: story deck round-trip behavior.

## Interface contract (level 5)

P1. `StoryState` gains `readonly previousScreen: StoryScreen | null`.
P2. Initial/legacy normalized value = `null`.
P3. Any reducer/navigation command changing `screen` A→B writes `previousScreen:A`; A→A preserves existing value. Centralize in one helper if transitions are scattered.
P4. `storyScreenLabel(screen): string`; at minimum narrative→`Dialog`, map→`Map`, shop screens→`Shop`, pre-battle→`Duel Setup`, outcome/reward→`Duel Result`; exhaustive over `StoryScreen`.
P5. `IllustratedMapScreen` props: `returnLabel:string`, `onreturn():void`; button text `Return to ${returnLabel}`, class `story-danger`, `data-cy="story-map-return"`.
P6. Fallback: target `"narrative"`, label `Dialog`.
E1. Invalid saved previousScreen → normalize `null`; do not reject otherwise-valid legacy save.
N1. Returning map→origin itself records map as prior only after navigation, enabling coherent forward return if exposed later.

## TDD

1. **Red** — transition memory, same-screen, old-save, invalid-save normalization, map copy/action tests.
2. **Green** — save contract first; reducer/helper; UI.
3. **Refactor** — rename playback-local `previousScreen` to avoid shadowing.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Narrative→map | transition | previous narrative; `Return to Dialog` |
| Legacy save | missing field | loads with null |
| Invalid field | unknown string | normalize null |
| Same screen | state update | prior unchanged |
| Click return | prior narrative | reducer goes narrative |

## Impl steps

- [ ] 1. Add red save/reducer/map tests.
- [ ] 2. Add tolerant normalization/validation.
- [ ] 3. Add transition memory + exhaustive labels; rename playback local.
- [ ] 4. Replace old Back control with contextual red button.

## Validation

- [ ] `npx vitest run tests/unit/story tests/component/story`
- [ ] `npm run typecheck && npm run lint`
- [ ] Manual: enter map from dialog/reward/shop where reachable; label + target correct.
- [ ] No silent-failure swallow: invalid legacy field normalized explicitly.
- [ ] App functional: save/load round-trip preserves prior screen.
- [ ] Commit msg draft: `feat(story): make map return to its true origin`
