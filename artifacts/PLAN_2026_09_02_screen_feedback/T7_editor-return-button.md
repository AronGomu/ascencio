# T7: Add contextual editor return button

**Plan:** `./artifacts/PLAN_2026_09_02_screen_feedback.md`  
**Depends:** T2, T6  
**Commit outcome:** Editor header loses Deck Library; red button below preview returns to named origin.

## Context (self-contained)

Goal: DB3. T6 exposes shell previous route/label. Button belongs below `card-preview-panel`, bottom-left, same width as preview, outside panel section. Out of scope: generic browser back.

## Requirements

R1. Remove header `Deck Library` button.
R2. Add red `Return to {originLabel}` below preview panel; same column/width; not inside `CardPreviewPanel`.
R3. Click navigates exact prior route captured when deck editor was entered.
R4. If prior route absent or itself a deck editor route, fallback to context deck library labeled `Deck Selection` per locked decision.
R5. Keep responsive tabs: button stays with details/preview pane and remains keyboard reachable.

## Inputs

I1. Read `DeckEditor.svelte`, `DeckEditorApp.svelte`, shell `AppShell.svelte`, route context helpers, preview CSS.
I2. From T6: `ShellState.previousRoute`, `routeLabel(AppRoute)`.

## Interface contract (level 5)

P1. Shell retains `AppRoute`; `DeckEditorApp` receives only `returnLabel: string`, `onreturn: () => void`. Do not expose `AppRoute` through deck-editor or widen deck-editor public exports.
P2. `DeckEditor` receives `returnLabel: string`, `onreturn: () => void`.
P3. Button text exactly `Return to ${returnLabel}`, class `danger`, `data-cy="deck-editor-return"`.
P4. Fallback route = `deckRoute(context, null)`; fallback label = `Deck Selection`.
E1. Missing previous route is normal fallback, not error.
N1. Clicking once issues one shell navigation.

## TDD

1. **Red** — button position/copy/callback/fallback tests; header absence.
2. **Green** — shell→app→editor prop wiring and layout.
3. **Refactor** — remove orphan `onlibrary` prop/import only.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Enter from map/story | previous route story | `Return to Story`, navigates story |
| Direct deep link | previous null | `Return to Deck Selection`, library route |
| Header | any deck | no Deck Library button |
| Tabs/mobile | details pane | button rendered under preview |

## Impl steps

- [ ] 1. Add failing shell/component tests.
- [ ] 2. Derive safe origin/fallback in shell integration.
- [ ] 3. Thread props; remove header control; render/style return control.

## Validation

- [ ] `npx vitest run tests/component/deck-editor tests/unit/shell-store.test.ts tests/unit/data-cy-coverage.test.ts`
- [ ] `npm run typecheck && npm run lint`
- [ ] Manual: enter editor from free-play library/story; button copy + destination correct.
- [ ] No silent-failure swallow added: none.
- [ ] App functional: direct hash editor route returns to correct scoped library.
- [ ] Commit msg draft: `feat(deck-editor): return players to their entry screen`
