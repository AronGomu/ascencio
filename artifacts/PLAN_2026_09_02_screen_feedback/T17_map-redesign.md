# T17: Redesign map around hotspots

**Plan:** `./artifacts/PLAN_2026_09_02_screen_feedback.md`  
**Depends:** T16  
**Commit outcome:** Map art fills screen; sidebar/chapter/choice clutter is gone; hotspots expose complete location info by pointer, keyboard and touch.

## Context (self-contained)

Goal: M2, M5, M6, M7 plus header integration from M3. T14 owns title/objective header. T16 owns Return to X. Out of scope: changing story location data/progression.

## Requirements

R1. Remove map eyebrow `Chapter 1 · River district`, local title/objective duplicate, choice-acknowledgment, sidebar location list and detail panel.
R2. Map art fills freed content region below shared header; maintain image aspect/crop without hiding hotspots.
R3. Hotspot hover/focus opens anchored popover with name, marker type, summary, access/locked reason and completed state.
R4. Touch first tap selects/opens info; second tap on same available hotspot activates. Tapping another hotspot switches info. Outside/Escape closes.
R5. Locked hotspot never activates; first/second interaction only shows reason.
R6. Preserve accessible label/state; popover info linked with `aria-describedby`; keyboard Enter behavior follows same two-stage rule or explicit accessible equivalent tested.
R7. Return button remains bottom-left without covering hotspot.

## Inputs

I1. Read `IllustratedMapScreen.svelte`, story location contracts/reducer tests, T14 header API, T16 return API.
I2. From T14: title/objective now in shared header. From T16: map return props/button.

## Interface contract (level 5)

P1. Internal state: `selectedId: LocationId|null` plus `selectionOwner: "hover"|"focus"|"tap"|null`. Pointerleave closes only owner `hover`; blur closes only owner `focus`; tap persists until outside/Escape/other hotspot.
P2. Popover `role="tooltip"` for hover/focus or accessible non-modal region; root `data-cy={\`story-map-popover-${id}\`}`.
P3. Popover fields: `name`, `${marker} · ${access}${completed?" · completed":""}`, `summary`, optional `Locked: ${lockedReason}`.
P4. Hotspot activation: available + already touch-selected → `onselect(id)`; locked → never callback.
P5. Map body has no `story-map-sidebar`, `story-map-location-list`, `story-map-eyebrow`, `story-map-choice-acknowledgment` nodes.
E1. Missing detail entry is impossible for `LocationId`; exhaustive `Record<LocationId,...>` remains compiler-enforced.
N1. Every visible location has exactly one hotspot and one unique `data-cy` family; hidden locations render neither hotspot nor popover.

## TDD

1. **Red** — removed nodes, popover content, pointer/focus/touch states, locked/no-callback, fill/bounds.
2. **Green** — simplify markup + state machine + CSS.
3. **Refactor** — remove sidebar-only styles/helpers.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Hover/focus | available hotspot | anchored full-info popover |
| First touch | available | info only |
| Second touch | same available | onselect once |
| Locked | repeated interaction | reason visible, no select |
| Hidden | hidden-gate | no DOM |
| Structure | map render | no sidebar/eyebrow/ack; art fills body |

## Impl steps

- [ ] 1. Add failing map component + responsive browser tests.
- [ ] 2. Remove local header/sidebar/ack markup.
- [ ] 3. Implement input-owner/two-stage popover behavior.
- [ ] 4. Expand map art/layout; place return safely.

## Validation

- [ ] `npx vitest run tests/component/story/IllustratedMap.test.ts tests/unit/story`
- [ ] `npx vitest run tests/unit/data-cy-coverage.test.ts`
- [ ] `npm run build:app && npm run typecheck && npm run lint`
- [ ] Manual: pointer, keyboard, touch emulation; every access/completed state.
- [ ] No silent-failure swallow added: none.
- [ ] App functional: Old Arena/shop activation + locked Archive progression unchanged.
- [ ] Commit msg draft: `feat(story): let map hotspots carry location context`
