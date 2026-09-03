# T14: Unify story header bar

**Plan:** `./artifacts/PLAN_2026_09_02_screen_feedback.md`  
**Depends:** T13  
**Commit outcome:** Every story screen uses one full-width header bar with consistent controls and optional title/objective slots.

## Context (self-contained)

Goal: M3 user clarification widened header consistency to all VN-owned screens: dialog/narrative, map, shop and siblings. Today `StoryTopBar` is fixed top-left with DP/shop/decks; narrative has separate utility controls. Out of scope: map body (T17), route failure diagnosis (T15).

## Requirements

R1. Convert StoryTopBar to full-width in-flow header, identical shell across story screens.
R2. Stable order: DP · shop · deck builder · title · objective · settings. Controls/slots may hide per screen.
R3. StoryApp owns single mount/config; child screens do not duplicate global controls.
R4. Settings opens existing overlay. Shop button hidden in shop. Deck button available where story context supports it.
R5. Header responds without overlap/truncation; title/objective may wrap or ellipsize by tested policy.
R6. Preserve keyboard names, 44px targets, focus-visible and `data-cy` uniqueness.

## Inputs

I1. Read `StoryTopBar.svelte`, `StoryApp.svelte`, `NarrativeScreen.svelte` utility bar, every story screen header, settings overlay flow.
I2. From T13: story container/scroll ownership.

## Interface contract (level 5)

P1. `StoryTopBar` props: `dp:number`; `showShop:boolean`; `showDecks:boolean`; `title:string|null`; `objective:string|null`; `showSettings:boolean`; `onshop():void`; `ondecks():void`; `onsettings():void`.
P2. Root `data-cy="story-top-bar"`; slots/elements retain: `story-top-bar-dp`, `-shop`, `-decks`; add `-title`, `-objective`, `-settings` when rendered.
P3. Hidden slot = element absent, not empty placeholder. `StoryApp` uses rows `auto minmax(0,1fr)` from T13: header row + `data-cy="story-screen-body"` body row (`min-height:0; overflow:hidden`); screens fill body only.
P4. StoryApp derives header props from current `StoryScreen` in one pure function/map; child screen title/eyebrow duplicates removed only where header replaces them.
E1. Settings/deck/shop action failures use existing StoryApp storage/route errors.
N1. Exactly one `story-top-bar` in rendered story document.

## TDD

1. **Red** — screen matrix for visibility/content/actions, responsive bounds, uniqueness.
2. **Green** — component API + StoryApp config + duplicate chrome removal.
3. **Refactor** — keep screen config local to StoryApp; no cross-domain abstraction.

## Test plan

| Screen | Visible |
| --- | --- |
| Narrative | DP, shop, decks, settings; optional title/objective hidden |
| Map | DP, shop, decks, title, objective, settings |
| Shop | DP, decks, title, settings; shop hidden |
| Other story | same bar shell; only relevant slots shown |

## Impl steps

- [ ] 1. Add failing StoryTopBar/StoryApp matrix tests.
- [ ] 2. Define props + in-flow responsive layout.
- [ ] 3. Hoist title/objective/config into StoryApp; remove duplicate headers selectively.
- [ ] 4. Rewire narrative utility/settings controls without duplicate actions.

## Validation

- [ ] `npx vitest run tests/component/story tests/unit/data-cy-coverage.test.ts`
- [ ] `npm run typecheck && npm run lint`
- [ ] Manual: visit narrative/map/all shop states at desktop/mobile widths.
- [ ] No silent-failure swallow: existing action error paths retained.
- [ ] App functional: shop/decks/settings actions work from header.
- [ ] Commit msg draft: `feat(story): give every screen one stable header`
