# PROTOTYPE_SPEC: decklist_rows

## 1. Scope

Visual upgrade of every `DecklistPanel` row (float beside duel-start tile + library docked column, all three hosts). Out of scope: tile grid, hover card-preview float, deck editor workspace zones, narrow/mobile layout (panel hidden there already).

## 2. Question + verdict

Question: plain name rows → frame color and/or card art, MTG-Arena-style. Verdict: **Variant A** (cropped-art strip background, dark left-to-right fade, frame-color left border) + **copy cell 2L1** (full-height dark cell left of name). Owner validated 2026-09-02.

## 3. Branch + target tech

UI branch, standalone prototype. Target: Svelte component `src/deck-select/DecklistPanel.svelte`, contract `src/deck-select/deck-select-contracts.ts`, hosts `src/deck-editor/components/DeckLibrary.svelte`, `src/story/screens/PreBattleScreen.svelte`, `src/shell/screens/FreePlayMatchSetup.svelte`.

## 4. Row structure (per grouped card)

```
li.row [--fc, --img]        border-left: 5px solid var(--fc); height 30px; radius 5px; overflow hidden; bg #22252c
├─ span.cp                  copy cell: full height, min-width 24px, order first (after border)
├─ span.art                 absolute inset 0, z0, background-image var(--img), cover, position center 20%, opacity 0.6
├─ span.fade                absolute inset 0, z1, linear-gradient(90deg, #22252c 0%, #22252ccc 38%, #22252c00 100%)
└─ span.name                z2, flex 1, ellipsis, 13px, text-shadow 0 1px 2px rgba(0,0,0,.8)
```

Copies stay grouped (`entriesOf` behavior kept): one row per code, cell shows plain count `N` (no `×`).

## 5. Fixed param table

| Param | Value |
|---|---|
| Row height | 30px |
| Frame border width (left) | 5px |
| Art fade endpoint | 38% |
| Art opacity | 0.6 |
| Copy cell min-width | 24px |
| Copy cell bg (N≥2) | `#000a` |
| Copy cell bg (single, reserved) | `#0006` |
| Copy cell font | 12px, weight 700, tabular-nums, `#e8e9ec` |
| Name padding | 6px left (after cell), 8px right |
| Row gap | 3px |
| Singles | cell rendered empty (space reserved → names align) |

## 6. Frame → color

Precedence (first match on OCG type bits): spell > trap > link > xyz > synchro > fusion > ritual > effect > normal. Single palette source in production: `CARD_FRAME_COLORS` (`src/decks/card-frame.ts`, T1); `DecklistPanel` imports it — deck-select may import `src/decks/` per `tests/unit/domain-boundaries.test.ts:109`.

| Frame | Color |
|---|---|
| normal | `#b8985a` |
| effect | `#c26a3d` |
| ritual | `#4a6fb5` |
| fusion | `#8a63b0` |
| synchro | `#c9c9c9` |
| xyz | `#4a4a55` |
| link | `#1d6ea8` |
| spell | `#1d9e74` |
| trap | `#bc5a84` |

## 7. Mocked vs production

- Mock: art via relative fs path `../generated/card-images/archive/cropped/<code>.jpg`.
- Production: `croppedCardImageUrl(catalog.get(code)?.imageUrl ?? null)` from `src/decks/deck-cover.ts` (runtime `/runtime/images-cropped/` cache).
- Mock: frame classified in prototype python. Production: derive from `DeckBuilderCardView.rawType` bits (`OCG_TYPE`).

## 8. Empty/error states

- `artUrl === null` (image not in catalog/cache yet) → no `.art`/`.fade` layers or transparent art; row degrades to frame border + name on `#22252c`. Never broken-image icon.
- Unknown card name fallback stays host behavior (`#<code>` / `Missing card <code>`).
- Concealed codes: not applicable — decklists here are the player's own decks.

## 9. Accessibility

- Name remains text node (screen reader unchanged). Copy count is text content of cell.
- Contrast: name has text-shadow over art; fade guarantees dark bg under text to 38%.
- No new interactive elements; hover behavior (`onrowhover` art float) unchanged.
- Every new element carries `data-cy` per HTML element contract.

## 10. PDDR

`docs/feature/PDDR-decklist_rows.md` — Decisions 1–8.

## 11. Acceptance checks

- Row shows cropped art fading under name, frame-colored 5px left border, per §5 params.
- Multi-copy rows show count in left cell; singles reserve dim cell; names align across all rows.
- All three hosts (deck editor library dock, story pre-battle float, free-play match setup float) render the treatment.
- Missing art degrades gracefully (frame color + name only).
- `npm run check:headless` green incl. domain-boundaries + data-cy coverage tests.
