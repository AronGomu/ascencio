# T1: card frame classifier

**Plan:** `./artifacts/PLAN_2026_09_02_decklist_row_art.md`
**Depends:** none
**Commit outcome:** `cardFrameOf(rawType)` returns one of nine frame names for any card; `CARD_FRAME_COLORS` maps each frame to its approved color (consumed by `DecklistPanel` in T2 — deck-select may import `src/decks/`, see plan Assumptions).

## Context (self-contained)

- Goal: decklist rows get card art + frame-color border per approved prototype (`artifacts/PROTOTYPE_SPEC_decklist_rows.md`).
- This slice: the pure classification every host will call — no UI.
- Out of scope here: any `.svelte` file, `src/deck-select/`, host wiring, `src/decks/index.ts` (no export widening needed — deep imports of `src/decks/` are legal).
- Assumptions in force: frame derives from `DeckBuilderCardView.rawType` OCG type bitmask.

## Requirements

- New file `src/decks/card-frame.ts` (File design policy: one concern per file).
- Nine frames, precedence first-match: spell > trap > link > xyz > synchro > fusion > ritual > effect > normal.
- Palette constant colocated (it is the frame's meaning, not presentation-host styling).

## Inputs

- `src/decks/catalog/ocg-mask.ts` — `OCG_TYPE` bit constants (SPELL 0x2, TRAP 0x4, EFFECT 0x20, FUSION 0x40, RITUAL 0x80, SYNCHRO 0x2000, XYZ 0x800000, LINK 0x4000000). Read the file; use its exported names, not literals.
- `src/decks/catalog/ocg-card-mapper.ts:54` — `rawType: number` on `DeckBuilderCardView`.

## Interface contract (level 5)

- **Produces** (`src/decks/card-frame.ts`):

```ts
export type CardFrame =
  | "normal" | "effect" | "ritual" | "fusion" | "synchro"
  | "xyz" | "link" | "spell" | "trap";

export function cardFrameOf(rawType: number): CardFrame;

export const CARD_FRAME_COLORS: Readonly<Record<CardFrame, string>> = {
  normal: "#b8985a", effect: "#c26a3d", ritual: "#4a6fb5",
  fusion: "#8a63b0", synchro: "#c9c9c9", xyz: "#4a4a55",
  link: "#1d6ea8", spell: "#1d9e74", trap: "#bc5a84",
};
```

- **Consumes:** `OCG_TYPE` from `src/decks/catalog/ocg-mask.ts`.
- **Errors:** none — total function; unmatched bits → `"normal"`.
- **Invariants:** pure, deterministic; precedence exactly as listed (a Pendulum-Fusion is `fusion`; a Link monster with EFFECT bit is `link`; type `0` is `normal`).

## TDD

1. **Red** — `tests/unit/card-frame.test.ts` fails (module absent).
2. **Green** — implement `cardFrameOf` + palette.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| spell wins | `OCG_TYPE.SPELL \| OCG_TYPE.QUICKPLAY` | `"spell"` |
| trap | `OCG_TYPE.TRAP \| OCG_TYPE.COUNTER` | `"trap"` |
| link over effect | `OCG_TYPE.MONSTER \| OCG_TYPE.LINK \| OCG_TYPE.EFFECT` | `"link"` |
| xyz | `OCG_TYPE.MONSTER \| OCG_TYPE.XYZ` | `"xyz"` |
| synchro over effect | `OCG_TYPE.MONSTER \| OCG_TYPE.SYNCHRO \| OCG_TYPE.EFFECT` | `"synchro"` |
| fusion + pendulum | `OCG_TYPE.MONSTER \| OCG_TYPE.FUSION \| OCG_TYPE.PENDULUM` | `"fusion"` |
| ritual | `OCG_TYPE.MONSTER \| OCG_TYPE.RITUAL` | `"ritual"` |
| effect | `OCG_TYPE.MONSTER \| OCG_TYPE.EFFECT` | `"effect"` |
| plain normal | `OCG_TYPE.MONSTER \| OCG_TYPE.NORMAL` | `"normal"` |
| zero | `0` | `"normal"` |
| palette complete | `CARD_FRAME_COLORS` | key for all nine frames, values match spec §6 |

## Impl steps

- [ ] 1. Write `tests/unit/card-frame.test.ts` per table; run → red.
- [ ] 2. Write `src/decks/card-frame.ts` per contract; run → green.
- [ ] 3. `npm run check:headless` — boundaries untouched, still green.

## Validation

- [ ] tests pass: `npx vitest run tests/unit/card-frame.test.ts`
- [ ] manual check: n/a (pure fn)
- [ ] no silent-failure swallow added — `none`
- [ ] app functional — no runtime path changed yet
- [ ] commit msg draft: `feat(decks): classify card frame from OCG type bits for decklist row styling`
