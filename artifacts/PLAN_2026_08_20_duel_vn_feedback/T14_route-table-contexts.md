# T14: Route table

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T1
**Commit outcome:** The app's hash routes carry a context — free play or story — and old duel/deck links redirect to their new homes.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket opens the navigation restructure: the visual novel's menu becomes the game's main menu and `Duel` becomes `Free Play`.
- This slice: the route contract alone — parsing, formatting, redirects and the store's navigation. No screen changes yet; every new route renders the existing screen it maps to.
- Out of scope here: the main-menu screen (T15), the free-play menu (T16), the deck editor's context binding (T23), the collection screen (T29).
- Assumptions in force: `#/duel` and `#/decks` redirect to `#/free-play` and `#/free-play/decks` so old bookmarks and the PWA start URL keep working; `#/admin` stays; settings is a dialog, never a route.

## Requirements

- `AppRoute` gains: `free-play`, `free-play-decks`, `free-play-deck` (with `deckId`), `free-play-collection`, `story-decks`, `story-deck` (with `deckId`), `story-collection`.
- `parseAppRoute` accepts `#/free-play`, `#/free-play/decks`, `#/free-play/decks/:id`, `#/free-play/collection`, `#/story`, `#/story/decks`, `#/story/decks/:id`, `#/story/collection`, `#/duel/session/:handoffId`, `#/admin`, `#/`.
- `#/duel` parses to `free-play`; `#/decks` parses to `free-play-decks`; `#/decks/:id` parses to `free-play-deck`.
- `formatAppRoute` is exhaustive over the union (the existing `switch` has no `default`, so a missing case is a type error).
- An unknown path still falls back to `HOME_ROUTE`.

## Inputs

- `src/shell/routes.ts` — the whole file: `ROUTE_ID = /^[A-Za-z0-9_-]{1,128}$/`, `HandoffId`, `AppRoute`, `HOME_ROUTE`, `parseAppRoute(hash)`, `formatAppRoute(route)`.
- `src/shell/shell-store.ts` — `navigate(route)` and the hash listener.
- `src/shell/domain-loaders.ts:51-53` — `duel: () => import("../battle/index.ts")`, `decks: () => import("../deck-editor/index.ts")`, `story: () => import("../story/index.ts")`. The loader chosen per route lives here.
- `src/shell/AppShell.svelte` — the `{#if}` chain mapping a route to a screen, including the `BattleFacade` mount at lines 255-256 (`request={null}`).
- `src/shell/admin/admin-actions.ts:47-58` — `ROUTE_INDEX`, keyed by `AppRoute["kind"]`, so every new kind must be added there or the build breaks.
- Tests: `tests/unit/shell-routes.test.ts`, `tests/unit/shell-store.test.ts`, `tests/unit/admin-actions.test.ts`.

## From Depends

- T1 changed documentation only; `src/` is unchanged from `main`.

## TDD

1. **Red** — extend `tests/unit/shell-routes.test.ts` with the parse, format and redirect cases below.
2. **Green** — widen `AppRoute`, `parseAppRoute` and `formatAppRoute`; extend `ROUTE_INDEX`; map new routes to existing screens in `AppShell.svelte`.
3. **Refactor** — group the two-segment parsing into one helper if the branch list becomes hard to read.

## Test plan

| Test                                             | Input                    | Expect                                                 |
| ------------------------------------------------ | ------------------------ | ------------------------------------------------------ |
| `parses the free-play menu`                      | `#/free-play`            | `{ kind: "free-play" }`                                |
| `parses free-play decks and one deck`            | `#/free-play/decks/abc`  | `{ kind: "free-play-deck", deckId: "abc" }`            |
| `parses the story deck routes`                   | `#/story/decks`          | `{ kind: "story-decks" }`                              |
| `parses both collection routes`                  | `#/story/collection`     | `{ kind: "story-collection" }`                         |
| `redirects the old duel route`                   | `#/duel`                 | `{ kind: "free-play" }`                                |
| `redirects the old decks routes`                 | `#/decks`, `#/decks/abc` | `free-play-decks`, `free-play-deck`                    |
| `keeps the duel session route`                   | `#/duel/session/h1`      | `{ kind: "duel-session", handoffId: "h1" }`            |
| `keeps admin`                                    | `#/admin`                | `{ kind: "admin" }`                                    |
| `formats every route back to its canonical hash` | each route               | round-trips through `parseAppRoute(formatAppRoute(r))` |
| `rejects an id that is not route-safe`           | `#/free-play/decks/a/b`  | `HOME_ROUTE`                                           |

## Impl steps

- [ ] 1. Add the failing route tests; run `npx vitest run tests/unit/shell-routes.test.ts`.
- [ ] 2. Widen the `AppRoute` union in `src/shell/routes.ts` with the seven new kinds listed under Requirements.
- [ ] 3. Extend `parseAppRoute`: handle the one-segment cases (`free-play`, `story`, `admin`, plus the `duel` and `decks` redirects) and the two- and three-segment cases under `free-play/` and `story/`, validating every id with `ROUTE_ID`.
- [ ] 4. Extend `formatAppRoute` with a case per new kind; confirm `tsc` reports no missing case.
- [ ] 5. Add every new kind to `ROUTE_INDEX` in `src/shell/admin/admin-actions.ts` (`free-play` → `{ kind: "free-play" }`; id-bearing kinds → `null`).
- [ ] 6. In `AppShell.svelte`, map: `free-play` and `duel-session` → the battle loader; `free-play-decks`/`free-play-deck`/`story-decks`/`story-deck` → the deck-editor loader; `story`/`story-collection`/`free-play-collection` → their current or nearest existing screen so nothing renders blank before T15/T16/T29.
- [ ] 7. Run `npx vitest run tests/unit/shell-routes.test.ts tests/unit/shell-store.test.ts tests/unit/admin-actions.test.ts`.
- [ ] 8. Run `npx vitest run tests/component/AppShell.test.ts`.
- [ ] 9. Write `docs/ADR/051_ADR_main_menu_free_play_mode_and_route_contexts.md`: context (the shell home duplicated the story's own title screen; deck screens now mean two different things), decision (context-carrying routes, `#/` is the main menu, `#/duel`→`#/free-play` redirect, story stays lazily loaded), consequences.

## Outputs

- Files touched: `src/shell/routes.ts`, `src/shell/admin/admin-actions.ts`, `src/shell/AppShell.svelte`, `tests/unit/shell-routes.test.ts`, `docs/ADR/051_ADR_main_menu_free_play_mode_and_route_contexts.md` (new).
- Public API change: `AppRoute` gains seven kinds; two old paths redirect.
- Migration/config: none — hash routes are not persisted.

## Validation

- [ ] `npx vitest run tests/unit/shell-routes.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual: visiting `#/duel` lands on the free-play route; `#/decks/<id>` opens that deck
- [ ] app functional — every existing screen is still reachable
- [ ] commit msg draft: `feat(shell): context-carrying routes for free play and story, with redirects for old links`
