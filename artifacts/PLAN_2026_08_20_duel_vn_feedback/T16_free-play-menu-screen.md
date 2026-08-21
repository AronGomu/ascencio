# T16: Free-play menu

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T15
**Commit outcome:** `#/free-play` shows a menu with Start a match, Deck builder and Return to main menu, and each one goes where it says.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket builds the Free Play mode's own menu.
- This slice: the menu screen and its navigation. The duel it starts is today's duel entry, unchanged apart from where it is reached from.
- Out of scope here: the opponent picker (T17), the deck editor's context binding (T23), the collection screen (T29) — its entry point is added in T30.
- Assumptions in force: free play is the mode where every card is available; the menu is a peer of the story, reached from the main menu's last entry.

## Requirements

- `#/free-play` renders `FreePlayMenuScreen` with three entries: Start a match, Deck builder, Return to main menu.
- Start a match mounts the duel (the battle domain, lazily) exactly as `#/duel` used to.
- Deck builder navigates to `#/free-play/decks`.
- Return navigates to `#/`.
- The battle domain stays lazy: it is imported only when a match starts, not when the menu renders.

## Inputs

- `src/shell/AppShell.svelte` — the route-to-screen chain; the `BattleFacade` mount at lines 255-256 uses `request={null}`, which makes the duel show its own deck picker.
- `src/shell/domain-loaders.ts:51` — `duel: async () => await import("../battle/index.ts")`.
- `src/shell/screens/MainMenuScreen.svelte` — after T15, its `main-menu-free-play` button navigates here.
- `src/shell/routes.ts` — after T14, `{ kind: "free-play" }` and `{ kind: "free-play-decks" }` exist and format to `#/free-play` and `#/free-play/decks`.
- Tests: `tests/component/AppShell.test.ts`, `tests/unit/shell-routes.test.ts`.

## From Depends

- T15 added `src/shell/screens/MainMenuScreen.svelte` (`data-cy` `main-menu-screen`, entries `main-menu-new-game|continue|load|settings|free-play`), deleted `HomeScreen.svelte`, added `storyEntryIntent` to `src/shell/shell-store.ts`, and moved the menu styling into `src/styles/app.css` under `.main-menu`. `#/` renders the main menu.

## TDD

1. **Red** — add `tests/component/FreePlayMenuScreen.test.ts` with the three navigation cases and the laziness case.
2. **Green** — write the screen and mount it for `{ kind: "free-play" }`; move the duel mount behind a `matchStarted` flag inside the screen.
3. **Refactor** — reuse the `.main-menu` styles from T15 for a consistent look.

## Test plan

| Test                                            | Input               | Expect                                                                |
| ----------------------------------------------- | ------------------- | --------------------------------------------------------------------- |
| `renders three entries`                         | mount               | `free-play-start-match`, `free-play-deck-builder`, `free-play-return` |
| `Deck builder navigates to the free-play decks` | click Deck builder  | `navigate({ kind: "free-play-decks" })`                               |
| `Return goes back to the main menu`             | click Return        | `navigate({ kind: "home" })`                                          |
| `Start a match mounts the duel`                 | click Start a match | the battle loader is invoked once; the duel surface appears           |
| `the battle domain is not imported on render`   | mount only          | the battle loader spy has not been called                             |

## Impl steps

- [ ] 1. Add the failing component test file; run `npx vitest run tests/component/FreePlayMenuScreen.test.ts`.
- [ ] 2. Create `src/shell/screens/FreePlayMenuScreen.svelte` with `data-cy` values `free-play-menu-screen`, `free-play-start-match`, `free-play-deck-builder`, `free-play-return`.
- [ ] 3. Keep a local `matchStarted = false`; when Start a match is pressed, set it and render the lazily-loaded `BattleFacade` with `request={null}` — copy the loader usage from `AppShell.svelte`'s existing duel branch.
- [ ] 4. In `AppShell.svelte`, render `FreePlayMenuScreen` for `{ kind: "free-play" }` and delete the old standalone duel branch for the removed `duel` kind.
- [ ] 5. Give the duel surface a Back control that returns to `#/free-play` by clearing `matchStarted`.
- [ ] 6. Style the screen with the `.main-menu` rules from T15, adding only what differs.
- [ ] 7. Run `npx vitest run tests/component/FreePlayMenuScreen.test.ts tests/component/AppShell.test.ts tests/unit/data-cy-coverage.test.ts`.
- [ ] 8. Run `npm run build && npm run build:verify` to confirm the entry chunk still excludes the battle domain.

## Outputs

- Files touched: `src/shell/screens/FreePlayMenuScreen.svelte` (new), `src/shell/AppShell.svelte`, `src/styles/app.css`, `tests/component/FreePlayMenuScreen.test.ts` (new), `tests/component/AppShell.test.ts`.
- Behaviour change: duels are reached through Free Play instead of a top-level Duel entry.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/component/FreePlayMenuScreen.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] `npm run build && npm run build:verify` passes
- [ ] manual: main menu → Free Play → Start a match starts a duel; Return goes back
- [ ] app functional — `#/duel` still redirects here and the duel still runs
- [ ] commit msg draft: `feat(shell): a free-play menu with match, deck builder and return`
