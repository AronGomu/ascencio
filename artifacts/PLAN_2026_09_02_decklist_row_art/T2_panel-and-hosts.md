# T2: contract + panel + hosts (one commit)

**Plan:** `./artifacts/PLAN_2026_09_02_decklist_row_art.md`
**Depends:** T1
**Commit outcome:** every decklist surface (deck editor library dock, story pre-battle float, free-play match setup float) renders the approved Variant A + 2L1 row with real frame colors and cropped art.

## Context (self-contained)

- Goal: decklist rows get art-strip background, frame-color border, left copy cell per `artifacts/PROTOTYPE_SPEC_decklist_rows.md` (§4–§6 hold exact structure/params/colors).
- This slice: contract widening + `DecklistPanel` visual + all three host resolvers, **one commit** — `frame`/`artUrl` are required fields; a panel-only commit leaves three hosts failing `tsc` (`npm run typecheck` runs `tsc --noEmit && svelte-check`).
- Out of scope here: e2e/build evidence (T3), classifier internals (T1), deck editor workspace zones, hover card-preview float, `DeckSelectScreen` layout.
- Assumptions in force: deck-select legally imports `src/decks/` (`tests/unit/domain-boundaries.test.ts:109` returns true for target `"decks"`; deck-select ESLint zone `eslint.config.js:180` lists no decks group). No `src/deck-select/index.ts` export change.

## Requirements

- Extend `DecklistRow` with required `frame` + `artUrl`.
- `DecklistPanel` imports `CardFrame`, `CARD_FRAME_COLORS` from `src/decks/card-frame.ts` — single palette source, no duplication.
- Keep grouped-copies behavior and `onrowhover`/`onrowleave` API unchanged; grouped `Entry` carries `frame`/`artUrl` from the first-seen row of each code.
- Copy cell 2L1 on every row; count text only when copies ≥ 2; singles keep the cell (dim) so names align.
- `artUrl === null` → no art/fade layers; frame border + name only.
- Every element carries unique `data-cy`.
- Existing assertion flip: `tests/component/deck-select/hover-previews.test.ts:147` expects `"×3"` → new contract renders `"3"`.

## Inputs

- **From T1:** `src/decks/card-frame.ts` — verbatim:

```ts
export type CardFrame =
  | "normal" | "effect" | "ritual" | "fusion" | "synchro"
  | "xyz" | "link" | "spell" | "trap";
export function cardFrameOf(rawType: number): CardFrame;
export const CARD_FRAME_COLORS: Readonly<Record<CardFrame, string>>;
```

- `src/deck-select/deck-select-contracts.ts:34` — current `DecklistRow { code, name }`.
- `src/deck-select/DecklistPanel.svelte` — `Entry` (`:15`), `entriesOf` (`:32`, rebuilds entries from `code`/`name` only — must carry the new fields through), markup + style block.
- `src/decks/deck-cover.ts:20` — `croppedCardImageUrl(imageUrl: string | null): string | null`.
- Host call sites: `src/deck-editor/components/DeckLibrary.svelte:81` `rowOf`; `src/story/screens/PreBattleScreen.svelte:118` `rows`; `src/shell/screens/FreePlayMatchSetup.svelte:404` `decklistRows`.
- Host test suites: `tests/component/deck-editor/deck-library.test.ts`, `tests/component/story/pre-battle-deck-picker.test.ts`, `tests/component/FreePlayMatchSetup.test.ts`.

## Interface contract (level 5)

- **Produces** (`src/deck-select/deck-select-contracts.ts`):

```ts
import type { CardFrame } from "../decks/card-frame.ts";

export interface DecklistRow {
  readonly code: number;
  readonly name: string;
  readonly frame: CardFrame;
  /** Cropped art URL; null = art unavailable, row degrades to color-only. */
  readonly artUrl: string | null;
}
```

- **Produces** (DOM, per grouped row, `cy` = caller prefix — real values `deck-select-docked-list` / `deck-select-hover-list`):

```html
<li class="row" data-cy="{cy}-row-{code}" style="--fc:{CARD_FRAME_COLORS[frame]};--img:url('{artUrl}')">
  <span class="cp" data-cy="{cy}-row-copies-{code}">{copies >= 2 ? copies : ""}</span>
  <span class="art" data-cy="{cy}-row-art-{code}"></span>   <!-- only when artUrl !== null -->
  <span class="fade" data-cy="{cy}-row-fade-{code}"></span> <!-- only when artUrl !== null -->
  <span class="name" data-cy="{cy}-row-name-{code}">{name}</span>
</li>
```

- CSS (component-scoped, spec §5): `.row` `position:relative; display:flex; align-items:center; height:30px; border-left:5px solid var(--fc); border-radius:5px; overflow:hidden; background:#22252c` (`position:relative` mandatory — without it `.art` resolves against the float's `position:fixed` ancestor, `DeckSelectScreen.svelte:1160`); list `gap:3px`; `.cp` `align-self:stretch; min-width:24px; display:flex; align-items:center; justify-content:center; background:#000a; font-size:12px; font-weight:700; font-variant-numeric:tabular-nums; color:#e8e9ec; position:relative; z-index:2`, single-copy modifier `background:#0006`; `.art` `position:absolute; inset:0; z-index:0; background-image:var(--img); background-size:cover; background-position:center 20%; opacity:0.6`; `.fade` `position:absolute; inset:0; z-index:1; background:linear-gradient(90deg,#22252c 0%,#22252ccc 38%,#22252c00 100%)`; `.name` `position:relative; z-index:2; flex:1; padding:0 8px 0 6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; text-shadow:0 1px 2px rgba(0,0,0,.8)` (spec §5 padding row).
- **Produces** (each host resolver row):

```ts
{ code, name: /* existing fallback, byte-identical */,
  frame: cardFrameOf(catalog.get(code)?.rawType ?? 0),
  artUrl: croppedCardImageUrl(catalog.get(code)?.imageUrl ?? null) }
```

- **Consumes:** T1 exports verbatim; `croppedCardImageUrl` verbatim.
- **Errors:** none; catalog miss → `frame:"normal"`, `artUrl:null`, name fallback unchanged (`Missing card ${code}` / `` `#${code}` `` / `String(code)`).
- **Invariants:** grouped rows keep first-seen order; `data-cy` unique per document; copies text never renders `×`; hosts never annotate `CardFrame` explicitly (inference — no new deck-select export); imports stay directional (hosts → `src/deck-select/index.ts` + `src/decks/` deep; panel → `src/decks/card-frame.ts` only).
- **Integration links:** trigger: host resolver (paths above) → dispatch: props through `DeckSelectScreen` (`:654` docked, `:669` hover) → observe: rendered `li` style contains `--fc:` + `--img:` in component tests.

## TDD

1. **Red** — panel tests (fixtures gain `frame`/`artUrl`; assertions on `--fc`, art presence/absence, cp text incl. `"×3"`→`"3"` flip) + one row-shape test per host suite. Red on compile + assertions.
2. **Green** — contract, panel markup/CSS, three host mappings.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| frame color on row | row `frame:"spell"` | `li` style contains `--fc:#1d9e74` |
| art layers present | row `artUrl:"blob:x"` | art + fade spans exist; `--img` set |
| art degrade | row `artUrl:null` | no art/fade spans; border + name render |
| copy cell count | 3 copies of one code | one row; cp text `"3"` |
| copy cell reserved | single copy | cp span exists, empty, single-modifier class |
| deck-editor rows | fixture spell card `imageUrl:"/runtime/images/1.jpg"` | `frame:"spell"`, `artUrl:"/runtime/images-cropped/1.jpg"` |
| story rows | link monster fixture | `frame:"link"` |
| free-play rows | catalog miss | `frame:"normal"`, `artUrl:null`, name `String(code)` |
| boundaries + data-cy | frozen suites | pass unchanged (no export widening) |

## Impl steps

- [ ] 1. Red: update `tests/component/deck-select/hover-previews.test.ts` (fixtures, `--fc`/art/cp assertions, `:147` flip) + row-shape tests in the three host suites.
- [ ] 2. Contract change in `deck-select-contracts.ts`.
- [ ] 3. Panel: carry `frame`/`artUrl` through `entriesOf`, markup + CSS per contract.
- [ ] 4. Hosts: map two fields at the three call sites.
- [ ] 5. `npm run test:component` + `npm run check:headless` green (`check:headless` does **not** run component tests — both cmds required).

## Validation

- [ ] tests pass: `npm run test:component` && `npm run check:headless` (paste tails)
- [ ] manual check: dev server — dock (deck editor library) + both floats show art rows
- [ ] no silent-failure swallow added — `none`
- [ ] app functional — all three screens render decklists
- [ ] commit msg draft: `feat(deck-select,shell,story,deck-editor): decklist rows show card art and frame colour`
