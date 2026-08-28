# T15: Seat panel + opponent picking mode

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`
**Depends:** T14
**Commit outcome:** `DeckSelectScreen` grows the right seat column (opponent portrait + opponent deck card + your deck card), opponent-seat picking mode with red halos and "Yours" badge, and the opponent picker overlay. Component-tested. No app screen consumes yet.

## Context (self-contained)

- Goal: implement validated deck-selection design (`docs/deck-selection-screen-design.md` §Desktop layout right column, §Opponent selection (free play only), §Halo & badge semantics) in shared lib `src/deck-select/`.
- This slice: duel-start mode's second column + seat-mode switching. Library mode ignores all of it (its docked list panel is T17).
- Out of scope here: mobile placement of the opponent card (T16), hover previews (T17), real persona data (T19), consumers.
- Assumptions in force: T14 `DeckSelectScreen` exists with props `mode,eyebrow,title,tiles,sort,selectedKey,startLabel,canStart,blockNotice,onselect,onstart,onback,onopen,onrename,onduplicate,ondelete,onfavourite`; T12 `DeckTile` has `halo` ("you"|"opponent"|"focus"|null) + `yours` + `showFavourite` + `showMenu` props; T11 `OpponentView = {id,name,line,locked}`.

## Requirements

- Append props to `src/deck-select/DeckSelectScreen.svelte`:

```ts
/** Duel-start only; null hides the whole right column (library mode passes null). */
export let opponent: OpponentView | null = null;
/** Free-play picker options; empty + opponent.locked → no picker (story). */
export let opponents: readonly OpponentView[] = [];
/** Opponent's current deck tile; rendered as the red seat card. */
export let opponentDeck: DeckTileModel | null = null;
/** Your current deck tile; rendered as the blue seat card. */
export let playerDeck: DeckTileModel | null = null;
/** Which seat grid presses fill. Host owns it; card toggle reports. */
export let seat: "player" | "opponent" = "player";
export let onseat: (seat: "player" | "opponent") => void = () => undefined;
export let onpickopponent: (id: string) => void = () => undefined;
```

- Right column `data-cy="duel-start-seat-panel"`, rendered only `mode === "duel-start" && opponent !== null`; ≈27% width, `min-width: 17rem`; below `62rem` container width collapses above grid (CSS container query or media query — match design §Desktop layout).
- Opponent identity block:
  - Portrait `<button data-cy="duel-start-opponent-portrait" aria-label={`Change opponent: ${opponent.name}`}>` — inline SVG placeholder + name + `line`. **The portrait is the control** (no "Change opponent" button): hover/focus shows persistent chip `⇄ Change` (`data-cy="duel-start-opponent-change-chip"`; chip always visible via CSS when `:hover,:focus-visible` — permanent when `coarse` pointer, handled T16). Press → opens picker overlay. When `opponent.locked` → rendered as non-interactive `<div>` + caption; no picker.
- Opponent deck card: `DeckTile` with `tile=opponentDeck`, `halo="opponent"`, `showFavourite=false`, `showMenu=false`, wrapped in toggle button `data-cy="duel-start-opponent-deck"` with `aria-pressed={seat === "opponent"}`. Press → `onseat(seat === "opponent" ? "player" : "opponent")` (**the card is the control** — press again returns to picking for yourself). When `opponent.locked` → not a button; caption `data-cy="duel-start-opponent-deck-locked"` text `🔒 Set by the story`.
- Your deck card: `DeckTile` `tile=playerDeck`, `halo="you"`, `showMenu=false`, wrapper `data-cy="duel-start-your-deck"`; press → `onseat("player")`.
- Grid behavior by seat mode (extends T14):
  - `seat === "player"`: selected tile halo `"you"`, `selected` on `selectedKey`.
  - `seat === "opponent"`: tile whose key === `opponentDeck?.key` gets halo `"opponent"` + `selected`; tile whose key === `playerDeck?.key` gets `yours=true` badge (design: your pick must not disappear from view); presses `onselect(key)` still — host interprets per `seat`.
- Picker overlay `data-cy="duel-start-opponent-picker"`, `role="dialog" aria-modal="true"`: one tile-grammar card per `opponents` entry `data-cy={`duel-start-opponent-option-${o.id}`}` (name + line, no stats row), current one marked `aria-pressed`. Press → `onpickopponent(id)` + close. Escape/outside press closes. Same `[hidden]`/display guard rule as T13.

## Inputs

- `src/deck-select/deck-select-contracts.ts` — `OpponentView`, `DeckTileModel` (T11).
- **From Depends:** T14 screen + prop list quoted above; T12 `DeckTile` props.

## TDD

1. **Red** — extend `tests/component/deck-select/deck-select-screen.test.ts` + new `tests/component/deck-select/seat-panel.test.ts`; fail.
2. **Green** — implement.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `panel renders opponent identity and both seat cards` | opponent + both decks | portrait, opponent deck red-halo tile, your deck blue-halo tile present |
| `panel absent in library mode` | `mode="library"` | `duel-start-seat-panel` absent |
| `portrait opens picker, choice reported` | press portrait, press option "blaze-circuit" | `onpickopponent("blaze-circuit")`, picker closes |
| `locked opponent has no controls` | `opponent.locked=true` | portrait not a button, no picker, `duel-start-opponent-deck-locked` text `🔒 Set by the story` |
| `opponent deck card toggles seat` | press card, press again | `onseat("opponent")` then `onseat("player")` |
| `opponent seat mode paints grid red and badges yours` | `seat="opponent"`, opponentDeck k2, playerDeck k1 | tile k2 halo opponent+selected, tile k1 shows Yours badge |
| `your deck card returns to player seat` | `seat="opponent"`, press `duel-start-your-deck` | `onseat("player")` |
| `picker escape closes without pick` | open picker, Escape | closed, `onpickopponent` not called |

Run: `npx vitest run tests/component/deck-select`

## Impl steps

- [ ] 1. Write failing `tests/component/deck-select/seat-panel.test.ts`.
- [ ] 2. Add props + right column markup to `DeckSelectScreen.svelte`; two-column layout + `62rem` collapse.
- [ ] 3. Implement seat-mode grid halo/badge switching in the grid loop.
- [ ] 4. Implement picker overlay + dismissal.
- [ ] 5. `npx vitest run tests/component/deck-select tests/unit/data-cy-coverage.test.ts` → green.
- [ ] 6. `npm run lint && npm run typecheck` → green.

## Outputs

- New: `tests/component/deck-select/seat-panel.test.ts`.
- Edited: `src/deck-select/DeckSelectScreen.svelte` (+8 props above).
- Public API: screen prop names above — T16/T20/T24 quote verbatim. No new index exports (props only) → frozen list unchanged.

## Validation

- [ ] `npx vitest run tests/component/deck-select tests/unit/data-cy-coverage.test.ts` green
- [ ] `npm run lint && npm run typecheck && npm run build` green
- [ ] app functional — no consumer yet
- [ ] commit msg draft: `feat(deck-select): add the seat panel with opponent picking as the cards themselves`
