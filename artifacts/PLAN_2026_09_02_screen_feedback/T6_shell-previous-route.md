# T6: Add shell previous-route memory

**Plan:** `./artifacts/PLAN_2026_09_02_screen_feedback.md`  
**Depends:** none  
**Commit outcome:** Shell exposes session-only previous route + stable user-facing label for contextual return controls.

## Context (self-contained)

Goal: prerequisite for DB3. Shell uses hash routes; no prior-route memory. Out of scope: rendering editor button (T7), browser-history replacement.

## Requirements

R1. `ShellState` stores prior distinct route in-session.
R2. `navigate` and browser-driven `syncFromHash` update it before current route changes.
R3. Same-route/intent-only changes do not overwrite it.
R4. Every distinct `navigate` and `syncFromHash` route change records its origin, including `replace:true`; no suppression option.
R5. Add deterministic route label helper; unknown/parameterized deck routes get useful labels.

## Inputs

I1. Read `src/shell/shell-store.ts`, `routes.ts`, shell-store/routes tests, all `navigate(...,{replace:true})` calls.

## Interface contract (level 5)

P1. `ShellState` gains `readonly previousRoute: AppRoute | null`.
P2. `createShellStore(initialHash, setHash)` initializes `previousRoute:null`.
P3. On distinct route transition A→B: state `{ route:B, previousRoute:A, storyEntryIntent:<existing rules> }`.
P4. Export `routeLabel(route: AppRoute): string` from shell public entry. Labels: `home`→`Main Menu`; `free-play`→`Deck Selection`; `free-play-decks`→`Deck Selection`; `free-play-deck`→`Deck Builder`; `story`→`Story`; `story-decks`→`Deck Library`; `story-deck`→`Deck Builder`; `*-collection`→`Collection`; `duel-session`→`Duel`; `admin`→`Admin`.
E1. Invalid hash remains parsed to HOME_ROUTE per existing contract; label never throws.
N1. Memory is not persisted and survives only current `ShellStore` instance.

## TDD

1. **Red** — transition, same-route, hash-sync, initial-null and all-label tests.
2. **Green** — state/helper implementation.
3. **Refactor** — keep apply dedupe readable.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Initial | `#/free-play` | previous null |
| Navigate | A→B | previous A |
| Same route | B→B | previous unchanged |
| Hash back | B then sync A | current A, previous B |
| Labels | every union member | exact non-empty label |

## Impl steps

- [ ] 1. Add failing shell-store/routes tests.
- [ ] 2. Add state transition memory.
- [ ] 3. Add exhaustive `routeLabel`; export through `src/shell/index.ts`.
- [ ] 4. Update frozen public export list intentionally if `domain-boundaries.test.ts` requires it.

## Validation

- [ ] `npx vitest run tests/unit/shell-store.test.ts tests/unit/shell-routes.test.ts tests/unit/domain-boundaries.test.ts`
- [ ] `npm run typecheck && npm run lint`
- [ ] No manual UI required; state helper unit-covered.
- [ ] No silent-failure swallow added: none.
- [ ] App functional: existing hash navigation tests unchanged.
- [ ] Commit msg draft: `feat(shell): retain route origin for contextual returns`
