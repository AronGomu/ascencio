# T13: Size story UI to shell stage

**Plan:** `./artifacts/PLAN_2026_09_02_screen_feedback.md`  
**Depends:** T5  
**Commit outcome:** Every story screen, overlay and shop flow fits/scales inside shell stage without bottom clipping.

## Context (self-contained)

Goal: VN1 foundation. Story components use `svh` inside shell's letterboxed stage, causing nested viewport overflow. Replace viewport ownership with container ownership. Out of scope: header redesign (T14), map content redesign (T17).

## Requirements

R1. Remove inappropriate viewport units (`svh`, `vh`, `vw`) from every file under `src/story/`; each retained viewport-unit occurrence needs an inline reason proving it refers to browser viewport rather than shell stage.
R2. Root story screens fill available stage (`width/height/min-height:100%` as appropriate); internal absolute layout uses container-relative percentages/clamps.
R3. Narrative background, characters and dialogue remain fully visible together while resizing.
R4. Shop, collection, overlays, battle handoff/outcome/reward/pre-battle/booster screens remain usable with internal scroll only where content exceeds stage.
R5. Preserve safe-area handling and mobile breakpoints.

## Inputs

I1. Read shell stage CSS/model (`src/shell/stage-layout.ts`, AppShell stage styles) and all `rg -l 'svh' src/story`: `CollectionScreen.svelte`, `OverlayShell.svelte`, `BattleHandoffScreen.svelte`, `IllustratedMapScreen.svelte`, `NarrativeScreen.svelte`, `OutcomeScreen.svelte`, `PreBattleScreen.svelte`, `RewardScreen.svelte`, `BoosterOpeningScreen.svelte`, `BoosterResultsScreen.svelte`, `SellImpactDialog.svelte`, `ShopBrowseScreen.svelte`, `ShopCardListScreen.svelte`, `ShopGreetingScreen.svelte`, `ShopSellScreen.svelte`.

## Interface contract (level 5)

P1. Story root (`.story-app`) owns `width:100%; height:100%; min-height:0; display:grid; grid-template-rows:auto minmax(0,1fr)`; StoryTopBar occupies row 1 after T14, one body wrapper occupies row 2. Screen roots fill the body wrapper, never `100svh`.
P2. Scroll contract: screen-level content containers use `min-height:0; overflow:auto`; overlays remain stage-contained fixed/absolute relative to story root, not viewport.
P3. Narrative `.narrative-stage` is `position:relative; width:100%; height:100%; min-height:0; overflow:hidden`.
P4. No behavioral TS/state contracts change.
E1. None.
N1. At shell-supported viewport modes, no story root exceeds stage bounding box; all interactive elements remain reachable.

## TDD

1. **Red** — browser/component resize assertions for stage bounds + dialogue visibility; source guard against story `svh`.
2. **Green** — convert roots/scroll regions file-by-file.
3. **Refactor** — share existing story CSS classes/tokens only; no new layout framework.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Narrative resize | desktop narrow/short | background + character + dialogue within stage |
| Every story screen | representative route/state | root rect ≤ stage rect |
| Long shop/collection | short stage | internal scroll; header/controls reachable |
| Source guard | `src/story/**/*.svelte` | no unexplained `svh`/`vh`/`vw` |

## Impl steps

- [ ] 1. Add failing resize/source-guard tests.
- [ ] 2. Establish story root container contract.
- [ ] 3. Convert all 15 `svh` files; classify fill vs scroll vs overlay.
- [ ] 4. Verify portrait/landscape safe areas and focus reachability.

## Validation

- [ ] `npx vitest run tests/component/story tests/unit/story`
- [ ] `npm run build:app`
- [ ] `npm run test:e2e -- --grep "story|visual novel"`
- [ ] `npm run typecheck && npm run lint`
- [ ] Manual: resize narrative/map/shop/collection to shortest supported stage; no clipped bottom.
- [ ] No silent-failure swallow added: none.
- [ ] App functional: all story screens navigable.
- [ ] Commit msg draft: `fix(story): scale every screen inside the shell stage`
