# T2: DeckTile component

**Plan:** `./artifacts/PLAN_2026_08_27_deck_selection_screen.md`
**Depends:** T1
**Commit outcome:** `DeckTile.svelte` renders one 2:1 deck tile — full-bleed art + fade, star, checkmark, kebab button, name/stats/meta/badges, halo variants — exported from the public entry, component-tested. No screen consumes it yet.

## Context (self-contained)

- Goal: implement validated deck-selection design (`docs/deck-selection-screen-design.md` §The deck tile, §Halo & badge semantics) as shared Svelte lib `src/deck-select/`.
- This slice: the atom every context reuses (grid, library, seat cards, mobile list).
- Out of scope here: kebab menu contents (T3 — this ticket only emits `onmenu`), screen layout, hover previews, any consumer.
- Assumptions in force: T1 created `src/deck-select/` with `DeckTileModel` (fields: `key,name,counts,meta,coverImageUrl,legal,blockReason,bundled,lockedBy,favourite,isDefault,deletable,updatedAt`), tokens `--seat-you`/`--seat-opponent` exist in `src/styles/tokens.css`; app tokens `--accent`, `--selected`, `--danger` exist.

## Requirements

- New `src/deck-select/DeckTile.svelte`. Props (Svelte `export let`, callback-prop style like the rest of the repo):

```ts
export let tile: DeckTileModel;
/** Visual selection halo: null = none. "you" blue, "opponent" red, "focus" teal (--accent). */
export let halo: "you" | "opponent" | "focus" | null = null;
/** Checkmark top-right shown when true. */
export let selected = false;
/** "Yours" badge while filling the opponent seat. */
export let yours = false;
/** Hide star (story scope before favourites, seat-card context). */
export let showFavourite = true;
export let showMenu = true;
export let disabled = false;
export let onpress: () => void = () => undefined;
export let ondblpress: () => void = () => undefined;
export let onfavourite: (favourite: boolean) => void = () => undefined;
/** Kebab pressed; anchor element passed so the menu (T3) can position. */
export let onmenu: (anchor: HTMLElement) => void = () => undefined;
```

- Structure (design §The deck tile):
  - Root `<article data-cy={`deck-tile-${tile.key}`}>`, `aspect-ratio: 2 / 1`.
  - Main press surface = `<button data-cy={`deck-tile-press-${tile.key}`}` covering tile, `onclick` → `onpress`, `ondblclick` → `ondblpress`, `disabled={disabled}`.
  - Art layer: `<img src={tile.coverImageUrl} alt="">` full-bleed `object-fit: cover` when non-null; else inline SVG placeholder geometry (no external asset). Overlay gradient: `linear-gradient(to right, black 0%, black 30%, transparent 70%)` — solid at text edge, transparent by ~70%.
  - Favourite star: separate `<button data-cy={`deck-tile-fav-${tile.key}`} aria-pressed={tile.favourite}>` top-left, glyph `★`/`☆`, `onclick|stopPropagation` → `onfavourite(!tile.favourite)`. Rendered only when `showFavourite`.
  - Checkmark `✓` top-right `<span data-cy={`deck-tile-check-${tile.key}`}>` only when `selected`.
  - Kebab `<button data-cy={`deck-tile-menu-${tile.key}`} aria-label={`Actions for ${tile.name}`}>` bottom-right `⋮`, `onclick|stopPropagation` → `onmenu(event.currentTarget)`. Only when `showMenu`.
  - Body text over fade: name (`display:-webkit-box`, 2-line clamp), `Main {counts.main} · Extra {counts.extra} · Side {counts.side}` (`data-cy={`deck-tile-counts-${tile.key}`}`), meta line `{tile.meta}` (`data-cy={`deck-tile-meta-${tile.key}`}`), badge row (`data-cy={`deck-tile-badges-${tile.key}`}`).
- Badges (design §Badges), each a `<span>` with data-cy:
  - `deck-tile-badge-default-${key}`: text `Default`, shown when `tile.isDefault`. Style: gold hairline colour `var(--selected)`.
  - `deck-tile-badge-illegal-${key}`: text `Illegal`, shown when `!tile.legal` (reason itself lives in `meta`). Colour `var(--danger)`.
  - `deck-tile-badge-bundled-${key}`: text `Bundled`, shown when `tile.bundled`.
  - `deck-tile-badge-locked-${key}`: text `🔒 {tile.lockedBy}`, shown when `tile.lockedBy !== null`.
  - `deck-tile-badge-yours-${key}`: text `Yours`, shown when prop `yours`.
- Halo CSS: class per halo value; box-shadow glow `0 0 0.55rem color-mix(in srgb, <token> 55%, transparent)` + border-color, tokens `--seat-you` / `--seat-opponent` / `--accent` (repo precedent: `.deck-open.halo-valid` in current `src/deck-editor/components/DeckLibrary.svelte`). `tile.isDefault` additionally always wears gold hairline `border: 1px solid var(--selected)` with NO glow, independent of halo (design: never competes with selection glow).
- Illegal (`!tile.legal`): press surface `disabled`, tile dimmed (`opacity`), `aria-disabled` conveyed by disabled button.
- Every element carries unique role-describing `data-cy` (HTML element contract, enforced by `tests/unit/data-cy-coverage.test.ts`).

## Inputs

- `src/deck-select/deck-select-contracts.ts` — `DeckTileModel` (T1, fields listed above).
- `src/styles/tokens.css` — `--seat-you`, `--seat-opponent`, `--accent`, `--selected`, `--danger`, spacing/radius vars.
- **From Depends:** T1 exports `DeckTileModel` from `src/deck-select/index.ts`; frozen export list in `tests/unit/domain-boundaries.test.ts` must gain `DeckTile`.

## TDD

1. **Red** — `tests/component/deck-select/deck-tile.test.ts` (Vitest + Testing Library, mirror setup of existing `tests/component/deck-editor/deck-library.test.ts`). Fails: component absent.
2. **Green** — implement component, export from index, widen frozen list.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `renders name, counts and meta` | tile main 40 extra 15 side 10, meta "Updated X" | texts present, counts line exact `Main 40 · Extra 15 · Side 10` |
| `press fires onpress, dblclick fires ondblpress` | click / dblclick press surface | callbacks called |
| `favourite star toggles without pressing the tile` | click `deck-tile-fav-k1` on unfavourited tile | `onfavourite(true)` called, `onpress` NOT called |
| `kebab fires onmenu with its element, no tile press` | click `deck-tile-menu-k1` | `onmenu` called with HTMLElement, `onpress` NOT called |
| `selected shows checkmark` | `selected=true` / `false` | `deck-tile-check-k1` present / absent |
| `badges render per model` | isDefault+bundled+lockedBy "Vault Warden" + yours | 4 badges present with exact texts |
| `illegal tile is disabled and badged` | `legal=false, blockReason set` | press surface disabled, `deck-tile-badge-illegal-k1` present |
| `halo classes applied` | halo "you"/"opponent"/"focus"/null | root carries matching class, none for null |
| `no favourite star when showFavourite false` | `showFavourite=false` | `deck-tile-fav-k1` absent |

Run: `npx vitest run tests/component/deck-select/deck-tile.test.ts`

## Impl steps

- [ ] 1. Write failing `tests/component/deck-select/deck-tile.test.ts` with builder `tile(overrides: Partial<DeckTileModel>)`.
- [ ] 2. Create `src/deck-select/DeckTile.svelte` per Requirements (markup, then styles).
- [ ] 3. Export `DeckTile` from `src/deck-select/index.ts`; add name to frozen list in `tests/unit/domain-boundaries.test.ts`.
- [ ] 4. `npx vitest run tests/component/deck-select tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts` → green.
- [ ] 5. `npm run lint && npm run typecheck` → green.

## Outputs

- New: `src/deck-select/DeckTile.svelte`, `tests/component/deck-select/deck-tile.test.ts`.
- Edited: `src/deck-select/index.ts` (+`DeckTile`), `tests/unit/domain-boundaries.test.ts` (frozen list).
- Public API: `DeckTile` component with props above — T4/T5/T6 quote these prop names verbatim.

## Validation

- [ ] `npx vitest run tests/component/deck-select tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts` green
- [ ] `npm run lint && npm run typecheck && npm run build` green
- [ ] app functional — no consumer yet, no broken path
- [ ] commit msg draft: `feat(deck-select): render the shared 2:1 deck tile with halo and badge semantics`
