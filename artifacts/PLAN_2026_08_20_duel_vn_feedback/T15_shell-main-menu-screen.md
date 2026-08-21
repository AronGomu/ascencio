# T15: Shell main menu

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T14
**Commit outcome:** The app opens on a story-styled main menu offering New Game, Continue, Load, Settings and Free Play last — and the story domain is still loaded lazily.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket replaces the shell's home screen with the game's main menu.
- This slice: the menu screen itself, in the shell, styled like the visual novel's title screen. Choosing a story entry navigates into the lazily-loaded story domain at the right screen.
- Out of scope here: the free-play submenu (T16), the story's own in-playthrough screens, save management internals.
- Assumptions in force: the story domain must not become eager — the per-domain chunk budget in `scripts/lib/domain-chunk-closure.ts` is enforced by `build:verify`; Free Play is the last entry; settings stays a dialog.

## Requirements

- `#/` renders `MainMenuScreen` from the shell, not `HomeScreen`.
- Entries, in order: New Game, Continue (only when a save exists), Load, Settings, Free Play.
- New Game / Continue / Load navigate to `#/story` and tell the story which entry was chosen; Free Play navigates to `#/free-play`; Settings opens `ShellSettingsDialog` in place.
- "Continue" visibility is decided without importing the story domain: the shell reads save presence through the already-public `createStorySaveRepository` from `src/story/index.ts`… which would be eager, so instead it reads the same IndexedDB database name (`STORY_SAVES_DATABASE_NAME`, already exported and a plain string constant) and checks for any record. No story component is imported at boot.
- The static entry chunk does not grow by the story chunk: `npm run build:verify` stays green.

## Inputs

- `src/shell/screens/HomeScreen.svelte` — the screen being replaced; lists Story, Decks, Duel, Settings and a fullscreen hint; `data-cy` values `home-screen`, `home-title`, `home-entries`, `home-entry-*`.
- `src/story/screens/TitleScreen.svelte` — the visual reference: eyebrow, oversized serif heading `Echoes of the Draw`, tagline, a `nav` of buttons; props `hasProgress`, `onnewgame`, `oncontinue`, `onload`, `onsettings`, `onmainmenu`.
- `src/shell/screens/ShellSettingsDialog.svelte` — the settings dialog already used by `HomeScreen`.
- `src/story/index.ts` — exports `STORY_SAVES_DATABASE_NAME` (a string constant) and `createStorySaveRepository`; importing the latter pulls the story chunk, the former does not pull any component.
- `src/shell/shell-store.ts` — `navigate(route)`.
- `scripts/lib/domain-chunk-closure.ts` — `DOMAIN_BUDGET_BYTES` and `staticHtmlScriptClosure`, asserted by `tests/unit/domain-chunk-closure.test.ts` and `npm run build:verify`.
- Tests: `tests/component/HomeScreen.test.ts` (to be replaced), `tests/component/AppShell.test.ts`, `tests/unit/domain-chunk-closure.test.ts`.

## From Depends

- T14 widened `AppRoute` with `free-play`, `free-play-decks`, `free-play-deck`, `free-play-collection`, `story-decks`, `story-deck`, `story-collection`; `#/duel` now parses to `free-play` and `#/decks` to `free-play-decks`; `formatAppRoute` covers every kind; `ROUTE_INDEX` in `src/shell/admin/admin-actions.ts` lists them; `AppShell.svelte` already maps each new route to a screen. ADR-051 records the navigation decision.

## TDD

1. **Red** — add `tests/component/MainMenuScreen.test.ts` with the cases below; add a case to `tests/unit/domain-chunk-closure.test.ts` asserting the entry closure does not contain the story chunk.
2. **Green** — write `MainMenuScreen.svelte`, mount it at `#/`, delete `HomeScreen.svelte`.
3. **Refactor** — move the shared title styling into `src/styles/app.css` rather than duplicating the story's scoped styles.

## Test plan

| Test                                            | Input            | Expect                                                          |
| ----------------------------------------------- | ---------------- | --------------------------------------------------------------- |
| `renders the five entries with Free Play last`  | save exists      | buttons in order: new-game, continue, load, settings, free-play |
| `hides Continue when no save exists`            | empty save store | no `[data-cy="main-menu-continue"]`                             |
| `Free Play navigates to the free-play route`    | click Free Play  | `navigate({ kind: "free-play" })`                               |
| `New Game navigates into the story`             | click New Game   | `navigate({ kind: "story" })` with the new-game intent recorded |
| `Settings opens the dialog in place`            | click Settings   | `[data-cy="shell-settings-dialog"]` present, route unchanged    |
| `entry chunk does not include the story domain` | built `dist/`    | the static closure of `index.html` excludes the story chunk     |

## Impl steps

- [ ] 1. Add the failing component test file and the chunk-closure case; run `npx vitest run tests/component/MainMenuScreen.test.ts`.
- [ ] 2. Create `src/shell/screens/MainMenuScreen.svelte` with `data-cy` values `main-menu-screen`, `main-menu-title`, `main-menu-entries`, `main-menu-new-game`, `main-menu-continue`, `main-menu-load`, `main-menu-settings`, `main-menu-free-play`.
- [ ] 3. Read save presence in `onMount` by opening the database named by `STORY_SAVES_DATABASE_NAME` and counting records in the `saves` store; treat any failure as "no save" and log a warning.
- [ ] 4. Add a `storyEntryIntent` field to `src/shell/shell-store.ts` (`"new" | "continue" | "load" | null`), set it before navigating to `#/story`, and have `AppShell.svelte` pass it into the story component's props.
- [ ] 5. In `AppShell.svelte`, render `MainMenuScreen` for `{ kind: "home" }`.
- [ ] 6. Delete `src/shell/screens/HomeScreen.svelte` and `tests/component/HomeScreen.test.ts`.
- [ ] 7. Move the title/eyebrow/tagline styling into `src/styles/app.css` under a `.main-menu` block using existing tokens; do not copy raw colours (the stylesheet test forbids them).
- [ ] 8. Run `npx vitest run tests/component tests/unit/domain-chunk-closure.test.ts`.
- [ ] 9. Run `npm run build && npm run build:verify` and confirm the budgets still pass; re-baseline a budget only if the restructure genuinely moved code, recording the measurement in the comment above the number.

## Outputs

- Files touched: `src/shell/screens/MainMenuScreen.svelte` (new), `src/shell/screens/HomeScreen.svelte` (deleted), `src/shell/AppShell.svelte`, `src/shell/shell-store.ts`, `src/styles/app.css`, `tests/component/MainMenuScreen.test.ts` (new), `tests/component/HomeScreen.test.ts` (deleted), `tests/unit/domain-chunk-closure.test.ts`.
- Behaviour change: the app's first screen is the game's main menu.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/component/MainMenuScreen.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] `npm run build && npm run build:verify` passes with the story still lazy
- [ ] manual: cold load shows the main menu; Continue appears only with a save
- [ ] app functional — every route from T14 is still reachable
- [ ] commit msg draft: `feat(shell): the game opens on its own main menu, with Free Play last`
