# T15: Diagnose and fix story deck-builder route

**Plan:** `./artifacts/PLAN_2026_09_02_screen_feedback.md`  
**Depends:** T14  
**Commit outcome:** Deck-builder header button opens current story save's deck library instead of redirecting home.

## Context (self-contained)

Goal: M4. Root cause verified: `StoryApp` mounts `StoryTopBar` without passing `ondecks`, so its default writes `#/story/decks` directly and bypasses existing async `openDeckEditor()` at `StoryApp.svelte:777`, which persists state before navigation. Route parsing/context are correct. Out of scope: changing story/free-play ownership boundary.

## Requirements

R1. Reproduce header click bypassing `openDeckEditor()` and assert route→context→render chain.
R2. Pass existing `openDeckEditor` as unified header `ondecks`; remove direct-hash default from `StoryTopBar`.
R3. Before leaving live story for editor, persist current state through existing save repository; refused write leaves player on story with visible error.
R4. `#/story/decks` resolves current story save ownership/decks, never unlimited free-play context.
R5. Existing direct deep-link-without-save corrective redirect remains safe.

## Inputs

I1. Trace `StoryTopBar`/T14 action → `StoryApp.ondecks/openDeckEditor` → shell route → `openStoryDeckContext` → `AppShell` redirect.
I2. Read `src/story/decks/story-deck-context.ts`, save repository selection (`manual:1`, `autosave`), StoryApp autosave logic, shell context tests.
I3. From T14: unified header `ondecks` callback.

## Interface contract (level 5)

P1. Story deck action is async: persist snapshot `{ ...state, savedScreen: state.screen }` to existing `AUTOSAVE_SLOT`, then call shell `ondecks()` only when result.kind is `written`.
P2. `openStoryDeckContext(saves): Promise<DeckContext|null>` retains newest-ready-slot selection and story `CardOwnership`.
P3. On save refusal: exact existing `storageOperationError`/message path becomes visible; route stays `story`.
E1. No ready save on direct `#/story/decks` remains `null` → shell corrective HOME_ROUTE replace.
N1. Editor collection/decks match save snapshot opened from story.

## TDD

1. **Red** — regression reproducing map→decks→home; save-failure no-navigation; direct no-save redirect.
2. **Green** — fix at diagnosed persistence/handoff point, not button hash.
3. **Refactor** — reuse `openDeckEditor` persistence path if already correct; identify why header bypassed it.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Map header decks | active hydrated story | story deck library opens |
| Save failure | rejected autosave write | stay story + visible error |
| Direct deep link no save | `#/story/decks` | existing safe redirect home |
| Ownership | story collection | editor excludes unowned cards |

## Impl steps

- [ ] 1. Add failing integration/component reproduction.
- [ ] 2. Prove header default bypass in regression test.
- [ ] 3. Wire T14 header to existing pre-navigation save handoff; remove fallback hash write.
- [ ] 4. Verify context remains story-scoped.

## Validation

- [ ] `npx vitest run tests/component/story tests/integration tests/unit/story/story-deck-context.test.ts`
- [ ] `npm run typecheck && npm run lint`
- [ ] Manual: map/narrative/shop header → deck builder → return; verify current decks/collection.
- [ ] No silent-failure swallow: rejected save visible, no navigation.
- [ ] App functional: direct invalid deep link safely exits.
- [ ] Commit msg draft: `fix(story): persist context before opening its deck builder`
