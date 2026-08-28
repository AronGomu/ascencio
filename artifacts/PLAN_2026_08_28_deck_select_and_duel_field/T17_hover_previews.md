# T17: Desktop hover previews

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`
**Depends:** T16
**Commit outcome:** Hovering a grid tile in duel-start mode floats its full decklist beside the card; library mode previews the hovered deck in a docked right panel and floats card art over hovered rows. `[hidden]` display trap guarded. Component-tested. No app screen consumes yet.

## Context (self-contained)

- Goal: implement validated deck-selection design (`docs/deck-selection-screen-design.md` §Desktop hover previews) in shared lib `src/deck-select/`.
- This slice: last piece of the shared screen. After this, consumers swap in (T20/T22/T24).
- Out of scope here: data fetching (hosts supply resolvers), touch behavior (previews desktop-only: disabled under `(pointer: coarse)` or narrow), real card art pipeline.
- Assumptions in force: T14-T16 `DeckSelectScreen` exists; T11 types `DecklistView = {main,extra,side: readonly {code,name}[]}`; design's implementation trap: author-origin `display` on a class beats built-in `[hidden]{display:none}` — every floating element needs explicit `.thing[hidden]{display:none}` or no `display` on the bare class.

## Requirements

- Append props to `src/deck-select/DeckSelectScreen.svelte`:

```ts
/** Full decklist for a tile key; null = no preview for that tile.
    Async so hosts may lazy-load; screen ignores stale resolutions
    (only the currently hovered key's answer renders). */
export let decklistFor: ((key: string) => Promise<DecklistView | null>) | null = null;
/** Full-size text-free card art URL for a code; null = no art float. */
export let cardImageFor: ((code: number) => string | null) | null = null;
```

- New `src/deck-select/DecklistPanel.svelte` (shared by float + dock):

```ts
export let decklist: DecklistView;
export let cy: string; // caller supplies data-cy root, e.g. "deck-select-hover-list"
export let onrowhover: (code: number, anchor: HTMLElement) => void = () => undefined;
export let onrowleave: () => void = () => undefined;
```

  Sections Main/Extra/Side with counts in headings (`{cy}-main-heading` text `Main ({n})` etc.), rows `data-cy={`${cy}-row-${code}`}` showing name.
- **Duel-start float**: pointerenter on a grid tile (mode `duel-start`, `decklistFor` non-null, not narrow/coarse) → resolve → float `DecklistPanel` `cy="deck-select-hover-list"` beside tile; flips to opposite side when off-screen right; height = viewport minus small margin (`max-height: calc(100vh - 2rem)`, design: 90-card deck visible with minimal scrolling). Pointerleave tile → disappears immediately.
- **Library dock**: mode `library` → right column (the space duel-start's seat panel occupies) hosts docked panel `data-cy="deck-select-docked-list"`: shows decklist of hovered tile without moving focus/selection; reverts to `selectedKey`'s decklist on mouseout. Empty state text when no selection (`deck-select-docked-empty`).
- **Card-art float** (library dock only): hovering a decklist row floats `<img data-cy="deck-select-card-art-float">` near cursor using `cardImageFor(code)`; null URL → no float; leaves with the row.
- All three floating/docked elements: explicit `[hidden] { display: none; }` override wherever a `display` is declared on the class (design's trap, hit once already).
- Stale-resolution guard: keep a `hoverToken`; only latest hovered key's promise result applies.

## Inputs

- `src/deck-select/DeckSelectScreen.svelte`, `deck-select-contracts.ts` (T11-T16).
- **From Depends:** T16 narrow tracking (`forceNarrow` / matchMedia) — previews inert when narrow.

## TDD

1. **Red** — `tests/component/deck-select/hover-previews.test.ts`; fail.
2. **Green** — implement.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `duel-start hover floats the decklist` | pointerenter tile k1, resolver returns 2 main 1 extra | `deck-select-hover-list` visible, headings `Main (2)`/`Extra (1)`, rows by code |
| `float leaves with the pointer` | pointerleave tile | float hidden/removed |
| `stale resolution never renders` | hover k1 (slow resolver), then k2 (fast) | only k2's list renders when k1 resolves later |
| `library hover previews in dock without moving selection` | selected k1, hover k2 | dock shows k2 list, `selectedKey` prop callbacks untouched; mouseout → k1 list |
| `dock empty state without selection` | library, no selection, no hover | `deck-select-docked-empty` present |
| `card art floats over dock row` | hover row code 123, `cardImageFor` returns url | `deck-select-card-art-float` img src = url; leave → gone |
| `hidden floats stay hidden` | force `hidden` attr on float | computed `display: none` (regression for the display trap) |
| `no float when narrow` | `forceNarrow=true`, pointerenter | no `deck-select-hover-list` |

Run: `npx vitest run tests/component/deck-select`

## Impl steps

- [ ] 1. Write failing `tests/component/deck-select/hover-previews.test.ts` (resolvers = vi.fn with controlled promises).
- [ ] 2. Create `src/deck-select/DecklistPanel.svelte`.
- [ ] 3. Wire float into grid loop (pointerenter/leave, token guard, flip + viewport-height sizing).
- [ ] 4. Wire library dock into right column + art float on row hover.
- [ ] 5. Add `[hidden]` overrides beside every `display` declaration on floating/docked classes.
- [ ] 6. Export `DecklistPanel` from index; widen frozen list in `tests/unit/domain-boundaries.test.ts`.
- [ ] 7. `npx vitest run tests/component/deck-select tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts` → green.
- [ ] 8. `npm run lint && npm run typecheck` → green.

## Outputs

- New: `src/deck-select/DecklistPanel.svelte`, `tests/component/deck-select/hover-previews.test.ts`.
- Edited: `src/deck-select/DeckSelectScreen.svelte` (+`decklistFor`, `cardImageFor`), `src/deck-select/index.ts`, boundary test.
- Public API: resolvers' signatures above — T20/T22/T24 supply them and quote verbatim.

## Validation

- [ ] `npx vitest run tests/component/deck-select tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts` green
- [ ] `npm run lint && npm run typecheck && npm run build` green
- [ ] app functional — no consumer yet
- [ ] commit msg draft: `feat(deck-select): float and dock full decklist previews on hover`
