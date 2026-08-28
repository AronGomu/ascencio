# T11: deck-select lib skeleton + boundary registration

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`
**Depends:** none
**Commit outcome:** New shared presentational lib `src/deck-select/` exists with public entry, view-model contracts, tested rank fn; ESLint zones + domain-boundaries test know it; seat colour tokens exist. App compiles, nothing consumes lib yet.

## Context (self-contained)

- Goal: implement validated deck-selection design (`docs/deck-selection-screen-design.md`) as one shared Svelte screen replacing 4 screens across shell/story/deck-editor domains.
- This slice: foundation. Contracts + ordering + boundary registration. Later tickets add components on top.
- Out of scope here: any Svelte component, any consumer change, any edit to `src/decks/deck-library-order.ts` (stays untouched).
- Assumptions in force: cross-domain shared UI needs its own public entry per ADR-022 boundary model (`docs/ADR/022_ADR_three_ui_modular_monolith_and_worktree_boundaries.md`); widening the frozen entry list is deliberate and done here.

## Requirements

- New dir `src/deck-select/` — presentational library. Imports NOTHING from `src/shell/`, `src/battle/`, `src/story/`, `src/deck-editor/`, `src/decks/`. Plain view models only.
- Public entry `src/deck-select/index.ts` exporting exactly (this list goes into the frozen test):
  - types `DeckSelectMode`, `DeckSelectScope`, `DeckCounts`, `DeckTileModel`, `DecklistRow`, `DecklistView`, `OpponentView`, `DeckSort`
  - fn `orderDeckTiles`
  - (later tickets append component exports; each edits frozen list on purpose)
- Contracts file `src/deck-select/deck-select-contracts.ts`:

```ts
export type DeckSelectMode = "duel-start" | "library";
export type DeckSelectScope = "free-play" | "story";
export type DeckSort = "modified" | "name";

export interface DeckCounts {
  readonly main: number;
  readonly extra: number;
  readonly side: number;
}

/** One deck as any grid/list/seat renders it. Pure view model — hosts map
    domain records into this; deck-select never reads storage. */
export interface DeckTileModel {
  /** Stable id, unique per rendered document; data-cy suffix. */
  readonly key: string;
  readonly name: string;
  readonly counts: DeckCounts;
  /** Meta line: "Updated <date>" | "Bundled" | block reason for illegal. */
  readonly meta: string;
  readonly coverImageUrl: string | null;
  readonly legal: boolean;
  /** Why illegal; null when legal. */
  readonly blockReason: string | null;
  readonly bundled: boolean;
  /** AI owner name → 🔒 badge + never deletable; null otherwise. */
  readonly lockedBy: string | null;
  readonly favourite: boolean;
  readonly isDefault: boolean;
  readonly deletable: boolean;
  /** ISO timestamp for "modified" sort; null sorts last within its rank. */
  readonly updatedAt: string | null;
}

export interface DecklistRow {
  readonly code: number;
  readonly name: string;
}

export interface DecklistView {
  readonly main: readonly DecklistRow[];
  readonly extra: readonly DecklistRow[];
  readonly side: readonly DecklistRow[];
}

export interface OpponentView {
  readonly id: string;
  readonly name: string;
  /** One-line tagline under the name. */
  readonly line: string;
  /** Story: true → portrait not a control, deck card shows "🔒 Set by the story". */
  readonly locked: boolean;
}
```

- Ordering file `src/deck-select/order-deck-tiles.ts`:

```ts
export function orderDeckTiles(
  tiles: readonly DeckTileModel[],
  sort: DeckSort,
): readonly DeckTileModel[];
```

Rank per design §List ordering: 1) `legal === false` sinks to bottom unconditionally; 2) `isDefault` first among rest; 3) `favourite` next; 4) rest by `sort` — `"modified"` = `updatedAt` desc (null last), `"name"` = `localeCompare`. Within illegal group same 2-4 sub-order. Returns frozen new array, input untouched.

- Boundary registration:
  - `eslint.config.js`: add `no-restricted-imports` zone for `src/deck-select/` mirroring existing domain zones — cross-domain imports must target `src/deck-select/index.ts`; deck-select internals must not import other domains (message names the public entry). Read the existing zone entries in that file and copy their shape.
  - `tests/unit/domain-boundaries.test.ts`: add domain `"deck-select"` with `PUBLIC_ENTRY` `"src/deck-select/index.ts"`, extend `domainOf` path prefix mapping, add frozen export-name list for the new entry (the exact exports above).
- Tokens: append to `:root` in `src/styles/tokens.css` under a new comment `/* deck-select seat halos */`:

```css
--seat-you: #4ea3ff;
--seat-opponent: var(--danger);
```

## Inputs

- `tests/unit/domain-boundaries.test.ts` — existing frozen-entry pattern (`PUBLIC_ENTRY` record ~line 25, `describe("public domain APIs are frozen")` ~line 180).
- `eslint.config.js` — existing `no-restricted-imports` zones.
- `src/styles/tokens.css` — token file, append only.
- **From Depends:** none.

## TDD

1. **Red** — write `tests/unit/deck-select/order-deck-tiles.test.ts` first; fails (module absent). Update `tests/unit/domain-boundaries.test.ts` expectations; fails (entry absent).
2. **Green** — create contracts + fn + index + eslint zone + tokens.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `illegal decks sink below every legal deck` | 1 illegal favourite+default, 1 legal plain | legal plain first |
| `default outranks favourite` | legal favourite, legal default | default first |
| `favourite outranks plain` | legal plain, legal favourite | favourite first |
| `modified sort orders by updatedAt desc, null last` | 3 plain tiles, updatedAt 2026-01-02 / 2026-01-01 / null | that order |
| `name sort uses localeCompare` | "b", "A" | "A" first |
| `input array is not mutated and result is frozen` | any list | `Object.isFrozen(result)`, input order unchanged |
| domain-boundaries: deck-select entry frozen | — | export names exactly as listed above |

Run: `npx vitest run tests/unit/deck-select tests/unit/domain-boundaries.test.ts`

## Impl steps

- [x] 1. Write failing `tests/unit/deck-select/order-deck-tiles.test.ts` with the 6 tests above (helper `tile(overrides)` builder inline in test file). — red proven: `Error: Cannot find module '../../../src/deck-select/order-deck-tiles.ts'`
- [x] 2. Create `src/deck-select/deck-select-contracts.ts` with types verbatim from Requirements. — file exists, `npm run typecheck` green
- [x] 3. Create `src/deck-select/order-deck-tiles.ts` implementing rank fn. — 6 rank tests green
- [x] 4. Create `src/deck-select/index.ts` re-exporting the exact list from Requirements. — `deck-select public API is exact` green
- [x] 5. Add deck-select zone to `eslint.config.js` (copy shape of an existing domain zone; message: "Import deck-select through src/deck-select/index.ts"). — `npm run lint` green
- [x] 6. Extend `tests/unit/domain-boundaries.test.ts`: `PUBLIC_ENTRY`, `domainOf`, frozen export list for `src/deck-select/index.ts`. — `tests/unit/domain-boundaries.test.ts` 10 passed
- [x] 7. Append `--seat-you`/`--seat-opponent` to `src/styles/tokens.css`. — both declared at end of `:root`
- [x] 8. `npm run lint && npm run typecheck && npx vitest run tests/unit/deck-select tests/unit/domain-boundaries.test.ts` → green. — lint clean, `TYPECHECK_EXIT=0`, `Test Files  2 passed (2) / Tests  16 passed (16)`

## Outputs

- New: `src/deck-select/index.ts`, `src/deck-select/deck-select-contracts.ts`, `src/deck-select/order-deck-tiles.ts`, `tests/unit/deck-select/order-deck-tiles.test.ts`.
- Edited: `eslint.config.js`, `tests/unit/domain-boundaries.test.ts`, `src/styles/tokens.css`.
- Public API: new domain entry `src/deck-select/index.ts` (types + `orderDeckTiles`).

## Validation

- [x] `npx vitest run tests/unit/deck-select tests/unit/domain-boundaries.test.ts` green — `Test Files  2 passed (2) / Tests  16 passed (16)`
- [x] `npm run lint && npm run typecheck` green — `eslint .` silent; `svelte-check found 0 errors and 2 warnings in 2 files` (both pre-existing, in `CardCatalog.svelte` and `ShopSellScreen.svelte`)
- [x] `npm run build` succeeds (app functional, nothing consumes lib yet) — `BUILD_EXIT=0`, `build:verify` `"status": "ok"`, chunk bytes shell 92305 / battle 334069 / deck-editor 109440 / story 106674
- [x] commit msg draft: `feat(deck-select): add shared deck-selection view contracts and rank fn behind a new public entry`
