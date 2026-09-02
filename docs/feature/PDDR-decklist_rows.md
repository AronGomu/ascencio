# PDDR: decklist_rows

## Decision 1: branch + scope

- CHOSEN: UI branch, standalone prototype `artifacts/PROTOTYPE_decklist_rows.html`.
- WHY: question is visual — how a decklist row should look (frame color and/or card art), MTG-Arena reference. Targets `src/deck-select/DecklistPanel.svelte` (float beside duel-start tile + library docked column) and deck-builder right panel.
- NOT CHOSEN: integrated host route — row treatment is pure presentation; standalone with real deck data answers it faster.
- PARAMS: real Shaddoll preset deck (40 main / 15 extra / 0 side), all codes have local cropped art.
- DATE: 2026-09-02

## Decision 2: data + art source (mock)

- CHOSEN: names + type bitmask from `generated/assets/current/catalog/`, cropped art via relative path `../generated/card-images/archive/cropped/<code>.jpg`.
- WHY: real art, zero network fetch. Production would use the runtime cropped-image cache (`croppedCardImageUrl` in `src/decks/deck-cover.ts`).
- NOT CHOSEN: inlined base64 art — 55 images bloat file; CSS-gradient placeholders — cannot judge art legibility.
- DATE: 2026-09-02

## Decision 3: frame → color mapping

- CHOSEN: 9 frames: normal, effect, ritual, fusion, synchro, xyz, link, spell, trap. Precedence for monsters: link > xyz > synchro > fusion > ritual > effect > normal (matches card frame precedence). Colors approximate physical card frames.
- PARAMS: `--c-normal #b8985a`, `--c-effect #c26a3d`, `--c-ritual #4a6fb5`, `--c-fusion #8a63b0`, `--c-synchro #c9c9c9`, `--c-xyz #4a4a55`, `--c-link #1d6ea8`, `--c-spell #1d9e74`, `--c-trap #bc5a84`.
- DATE: 2026-09-02

## Decision 4: variants (open)

- VariantA: cropped art strip as full row background, left-to-right dark fade under the name, frame-color left border. MTG Arena look.
- VariantB: small art thumbnail chip on the left, frame-tinted row background, frame-color left border. Compact, art still identifiable.
- VariantC: no art — frame-color left border + colored dot + subtle color gradient. Cheapest, works before art cache warm.
- Adjustable params: row height 22–44px, border width 0–8px, art fade point 20–90%, art opacity 0.20–1.00, color tint 0.00–0.40.
- STATUS: awaiting owner pick.
- DATE: 2026-09-02

## Assumptions

- "deck builder menu of deck selection" = the shared `DecklistPanel` used both floating (duel-start hover) and docked (library right column); one treatment serves both.
- Rows stay grouped with ×N copies (current behavior kept).

## Decision 5: row treatment

- CHOSEN: VariantA — art strip background, dark fade under name, frame-color left border.
- WHY: owner pick — "A - is best version".
- NOT CHOSEN: VariantB thumbnail, VariantC color-only.
- PARAMS: `--row-h 30px`, `--border-w 5px`, `--art-fade 38%`, `--art-opacity 0.6`, `--tint-alpha 0.2`.
- DATE: 2026-09-02

## Decision 6: copy-count design (open)

- Owner: current `×N` text "ugly". Prototype now locks VariantA and cycles 5 copy-count designs:
  - V1: pill badge — dark capsule, frame-color outline + tinted text, `×N`.
  - V2: square token flush against right edge, full row height, bold `N`, MTG-Arena-like.
  - V3: diamond pips — one frame-colored pip per copy, no numeral.
  - V4: stacked-card ledge — 2–3 offset plates implying a stack, numeral centered.
  - V5: big ghost numeral — oversized italic translucent `N` bleeding off right edge.
- Singles show nothing in all designs (unchanged).
- STATUS: awaiting owner pick.
- DATE: 2026-09-02

## Decision 7: copy-count shortlist + placement (open)

- Owner shortlist: 1 (pill), 2 (token), 3 (pips). V4 stacked ledge + V5 ghost numeral rejected.
- Right-justify fix: previous build let short names leave the marker mid-row (`max-width` capped the name's flex growth); now `margin-left:auto` pins right-side markers to the row's right edge.
- Prototype variants:
  - 1 — pill badge, right edge.
  - 2R — square token, flush right, full row height.
  - 2L1 — full-height dark cell, left after color border; column reserved on singles so names align.
  - 2L2 — 18px frame-colored square badge, left; hidden (space kept) on singles.
  - 2L3 — bare frame-tinted numeral + thin divider, left; divider kept on singles so names align.
  - 3 — diamond pips (one per copy), right edge.
- STATUS: awaiting owner pick.
- DATE: 2026-09-02

## Decision 8: copy-count = 2L1, no divider

- CHOSEN: 2L1 — full-height dark cell left of the name, after the color border; frame-color right divider removed per owner. Cell reserved on singles (dimmer `#0006`) so names align.
- NOT CHOSEN: 1 pill, 2R right token, 2L2 colored badge, 2L3 bare numeral, 3 pips.
- PARAMS: cell min-width 24px, bg `#000a` (single: `#0006`), font 12px/700 tabular-nums, no border.
- DATE: 2026-09-02

## Decision 9: approved + planned

- Owner validated 2L1 final version 2026-09-02 → prototype frozen (`docs/feature/PROTOTYPE_decklist_rows.html`), spec written (`artifacts/PROTOTYPE_SPEC_decklist_rows.md`), plan generated (`artifacts/PLAN_2026_09_02_decklist_row_art.md`, T1–T3), ADR-063 recorded.
- Coherence review adjustments: single palette source `src/decks/card-frame.ts` (panel imports it — legal), contract + hosts land as one commit, name padding fixed 6px left / 8px right.
- DATE: 2026-09-02
