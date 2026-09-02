# PDDR: deck_select_layout

## Decision 1: branch + question

- CHOSEN: UI branch. Question: where do mode title, screen title, filter+sort
  and Start Duel live around the fixed elements (square deck grid, action
  footer, right seat pane) under the Basilica Slate brand?
- WHY: pure layout question; no state model at stake.
- NOT CHOSEN: Logic branch — no transition/data question.
- PARAMS: fixed constraints from owner: square tiles stay; footer stays;
  right pane = opponent + opponent deck card + your deck card; seat cards
  carry ONLY deck name + Main/Extra/Side counts; Back bottom-left, red
  (danger); Start Duel inside right pane at screen bottom-right.
- DATE: 2026-09-02

## Decision 2: host

- CHOSEN: standalone HTML (`artifacts/PROTOTYPE_deck_select_layout.html`).
- WHY: production screen is a prop-driven Svelte component fed by worker-backed
  repositories; wiring 4 throwaway layouts into it costs more than it informs.
  Fidelity kept instead via real tokens (copied from `src/styles/tokens.css`),
  real fonts (`public/fonts/`), real preset deck names
  (`src/battle/duel/presets/deck-catalog.ts`) and real cropped card art
  (`generated/card-images/archive/cropped/`).
- NOT CHOSEN: integrated route in the Svelte app.
- PARAMS: relative asset paths → prototype must be opened from inside the repo.
- DATE: 2026-09-02

## Decision 3: single-file relaxation

- CHOSEN: local relative `<img>`/`@font-face` references to repo files instead
  of inlined data URIs.
- WHY: owner explicitly asked for the actual project images; inlining ~10 jpgs
  + 2 woff2 would bloat the file for zero decision value. Still zero network
  fetch.
- NOT CHOSEN: base64 inlining; placeholder SVGs.
- DATE: 2026-09-02

## Decision 4: variant set (4)

- VariantA "Altar Column": today's title/tools positions kept top-left; pane =
  portrait → opponent card → versus → your card → Start pinned pane-bottom.
  Cheapest delta from shipped screen.
- VariantB "Ceremonial Pane": mode+screen title move into the pane top under a
  gold rule; left column is pure browse (tools row + grid). Pane becomes the
  ceremony column.
- VariantC "Command Bar": title + filter/sort share one slim top bar; pane
  pairs opponent/your seat cards side-by-side as a VS block.
- VariantD "Twin Seats": pane split into opponent half (top) and your half
  (bottom) around a gold divider; filter+sort relocate into the footer beside
  the manage cluster.
- WHY 4 not 3: two distinct answers exist for "where do titles go" (left vs
  pane) and two for "where do tools go" (top vs footer); one variant each.
- NOT CHOSEN: 5th variant with vertical banner title — low legibility, brand
  uses letterspaced horizontal capitals.
- DATE: 2026-09-02

## Decision 5: seat card redesign

- CHOSEN: flat glass chip — `--glass-strong` fill, hairline border, 3px seat
  color left edge (`--seat-you` blue / `--seat-opponent` red), chamfer cut,
  three lines: seat label (Forum caps), deck name, `Main · Extra · Side`
  counts. No art, no badges, no meta.
- WHY: owner constraint — ONLY name + counts. Frees pane height; seat color
  edge keeps the you/opponent grammar the grid halos already speak.
- NOT CHOSEN: reusing full `DeckTile` (carries art/badges/meta, violates
  constraint); mini square tile (wastes pane height on empty art).
- PARAMS: chamfer follows `--chamfer` param (0–16px, default 10px).
- DATE: 2026-09-02

## Decision 6: fixed shared choices across variants

- Back: bottom-left in footer, `--danger` text on `--danger-surface` with
  `--danger-border`, hover fills `--danger-strong`.
- Start: gold chamfered Forum-caps button, always last element of the pane →
  bottom-right of overall screen.
- Grid tile: unchanged square, real cover art, name + counts overlays.
- Adjustable params exposed: pane width 17–26rem (default 21), tile min
  9–16rem (default 12), grid gap 0.25–1.5rem (default 0.75), art opacity
  0.4–1 (default 0.75), chamfer 0–16px (default 10).
- DATE: 2026-09-02

## Assumptions

- A1. Mode = duel-start free play ("Free Play" eyebrow, picker-capable
  opponent). Library mode layout untouched by this round.
- A2. Opponent portrait stays the authored SVG placeholder — no portrait art
  ships in the repo (`public/story/` holds only `shop-sets.v1.json`).
- A3. "Footer with available actions" = Back + Delete/Rename/Duplicate/Open
  cluster; Open stays in footer since only Start was ordered into the pane.
- A4. Phone/narrow layout out of scope for this round; variants target the
  wide desktop stage.

## Decision 7: round-2 feedback (owner, 2026-09-02)

- CHOSEN: single converged layout, 2 pane variants (E/F). Round-1 A–D retired.
- WHY: owner feedback fixed titlebar, footer, pane behavior; only the pane's
  internal arrangement stayed open.
- PARAMS applied:
  1. pane full height (`grid-row: 1 / -1`).
  2. one-line title bar: eyebrow + title + sort + filter; filter `flex: 1`
     stretches to the pane edge.
  3. `scrollbar-gutter: stable` on grid and each decklist — scrollbar appears
     without moving content.
  4. footer sticky at page bottom (`position: sticky; bottom: 0`).
  5. 20 deck tiles (6 real presets + clones with distinct real covers) to
     exercise the grid scrollbar.
  6. Back separated (`margin-right: auto`), enlarged (3.1rem, Forum caps),
     renamed "← Return to Menu" (X = origin screen; free play → menu).
- DATE: 2026-09-02

## Decision 8: hover preview → pane, no float

- CHOSEN: hovering a grid tile previews its full decklist inside the pane
  section of the seat currently being filled (player by default, opponent
  while their seat is active), dashed gold outline + "Previewing: X" note;
  pointer leaves → section returns to the picked deck's list. Floating
  window removed.
- WHY: owner order — match the deck editor's docked preview behaviour.
- NOT CHOSEN: keeping the fixed-position float (occludes grid, second
  reading position).
- DATE: 2026-09-02

## Decision 9: pane = two seat sections, avatar + full decklist

- CHOSEN: each seat section = avatar (SVG placeholder, seat-tinted, name
  overlay) above + entire decklist (Main/Extra/Side headers with totals,
  `Card Name ×N` rows) below. Seat chip (deck name + counts only) kept
  between them as the seat-toggle control.
- Variant E "Twin Columns": sections side-by-side, full pane height each.
- Variant F "Stacked Halves": sections stacked around gold rule; avatar+chip
  left column, list right, half height each.
- PARAMS: pane width 22–38rem (default 30), avatar height 4–11rem (default 7).
- Real decklists: parsed from `src/battle/duel/presets/decks/*.ydk`, names
  from `generated/assets/current/catalog/texts/en/`.
- DATE: 2026-09-02

## Decision 10: variant E validated + round-3 tweaks (owner, 2026-09-02)

- CHOSEN: Twin Columns (E) is the layout. Variant F retired; switcher removed.
- PARAMS applied:
  1. 36 deck tiles (6 real presets × 6 name/cover variants).
  2. Grid and each decklist scroll independently (`overflow-y: auto` +
     `scrollbar-gutter: stable`).
  3. Pane rows `minmax(0,1fr) max-content`: avatars + seat chips fixed top,
     Start fixed bottom, only decklists scroll.
  4. Seat order swapped: you LEFT, opponent RIGHT.
  5. Decklist rows rebuilt on production `DecklistPanel.svelte` grammar —
     30px rows, 5px frame-color left edge (`CARD_FRAME_COLORS` from
     `src/decks/card-frame.ts`), cropped art background at 0.6 opacity,
     left fade gradient, tabular copies chip (blank when 1).
  6. Footer = grid `1fr auto 1fr`: Return to Menu at left, manage cluster
     centered on the deck section's own width (pane excluded — it is another
     grid column).
- Frames derived from `generated/assets/current/catalog/cards/` type masks,
  same bit test as `cardFrameOf`.
- DATE: 2026-09-02

## Decision 11: round-4 polish (owner, 2026-09-02)

- CHOSEN:
  1. Copies chip always shows the number — "1" for singles (dimmer `#0006`
     background kept), was blank before.
  2. Hover preview keeps only the dashed gold outline; "Previewing: X" text
     removed.
  3. Seat chip reduced to deck name only; Main/Extra/Side counts row removed
     (supersedes the Decision 1 "name + counts" constraint — owner order).
- DATE: 2026-09-02

## Decision 12: round-5 — footer actions + responsiveness (owner, 2026-09-02)

- CHOSEN:
  1. Manage cluster right-justified (supersedes Decision 10.6 centering);
     green "+ Create" button (--legal #7ee2a8, dark ink) at far right.
  2. Action hues: Delete red (--danger), Duplicate blue (--seat-you),
     Rename yellow (--selected); tinted rest state, solid hue on hover.
     Open stays neutral.
  3. Responsive by probe measurement, not fixed breakpoints — hidden
     max-content probes of the FULL header/footer are compared to the live
     bars' width on resize/param change, so compaction triggers on real
     overflow whatever pane width is set.
     Header compact: eyebrow + separator drop, title swaps to "Select Deck".
     Footer compact: Return shrinks (2.5rem, --text-sm), manage cluster
     collapses into a ⋯ menu opening upward with all 5 actions.
- Verified in Chromium: 1600px wide = full bars; 950px = "Select Deck", no
  eyebrow, ⋯ menu with 5 items. Zero page errors.
- DATE: 2026-09-02

## Decision 13: APPROVED (owner, 2026-09-02)

- CHOSEN: Twin Columns (E) frozen with params: pane 38rem, tile min 12rem,
  grid gap 0.5rem, art opacity 0.8, avatar 8rem, chamfer 12px.
- Validation: owner message "I validate prototype with those parameters" +
  full param list (accepted in lieu of exact phrase — params fully fixed).
- Fixed prototype: `docs/feature/PROTOTYPE_deck_select_layout.html`.
- Spec: `artifacts/PROTOTYPE_SPEC_deck_select_layout.md`.
- DATE: 2026-09-02

## Decision 14: production divergence — 62rem pane collapse stays

- CHOSEN: production keeps the existing 62rem pane-collapse media rule; the
  frozen prototype never collapses its 38rem pane. Consequence: header/footer
  compaction (Decision 12.3) fires below the collapse point, not ~950px.
- WHY: mid-width usability — a 38rem pane at 62rem viewport starves the grid.
- NOT CHOSEN: dropping the collapse to match the prototype pixel-for-pixel.
- DATE: 2026-09-02 (plan coherence review, finding 1)
