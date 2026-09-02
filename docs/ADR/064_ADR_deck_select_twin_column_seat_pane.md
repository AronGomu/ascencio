# ADR-064: Deck select duel-start uses a twin-column seat pane with docked decklists

Status: accepted 2026-09-02. Owner-approved prototype round (PDDR
`docs/feature/PDDR-deck_select_layout.md`, frozen artifact
`docs/feature/PROTOTYPE_deck_select_layout.html` — both tracked, durable).

## Context

- Duel-start deck select showed the opponent portrait plus two square
  `DeckTile` seat cards in a 27fr/17rem right column, and previewed a hovered
  deck's list in a fixed-position floating window over the grid.
- Owner ran a 5-round prototype iteration (4 layout variants → Twin Columns
  winner) and approved exact parameters: pane 38rem, tile min 12rem, grid gap
  0.5rem, tile art opacity 0.8, avatar 8rem, chamfer 12px.
- The float occupied a second reading position and occluded the grid; the
  deck editor's library already docks its preview in the right column.
- Brand is Basilica Slate (DESIGN.md): ceremonial gold, glass panels,
  chamfered geometry, `--danger` reserved for gameplay/danger semantics.

## Decision

1. The duel-start right pane is full-height (grid rows 1/-1), 38rem, and
   holds two seat columns — player LEFT, opponent RIGHT — each an avatar
   (fixed), a deck chip carrying the deck NAME ONLY (fixed), and the seat's
   full decklist (the only scrolling region, `scrollbar-gutter: stable`).
2. Hovering a grid tile docks that deck's full list into the column of the
   seat being filled, marked by a dashed `--selected` outline; the floating
   hover window is removed from duel-start. The library's docked preview and
   card-art float are untouched.
3. Start the Duel lives at the pane's bottom — the screen's bottom-right —
   as a gold chamfered Forum-caps button; on the ≤40rem phone layout it
   stays in the sticky footer instead.
4. The header is one line: mode eyebrow · screen title · deck count · sort ·
   filter, the filter flexing to the pane edge.
5. The footer is sticky with a large danger-styled "← Return to {origin}"
   at bottom-left; deck management actions sit right, hue-coded (Delete
   red, Rename yellow, Duplicate blue, Create solid green); Open stays
   neutral and outside the manage gate because story mode (`manageable`
   false) exits through it.
6. Header/footer compact by measured overflow, not fixed breakpoints:
   overflow drops the eyebrow and shortens the title to "Select Deck", and
   folds the action cluster into a ⋯ menu.
7. The 62rem pane-collapse rule stays. Production deliberately diverges
   from the frozen prototype here (PDDR Decision 14).

## Consequences

- Seat chips carry no counts and no art; the decklist below is the detail
  surface. A deck's Main/Extra/Side totals are no longer visible in the
  pane at rest — that is the approved trade for two full lists.
- Two decklists resolve per screen instead of zero-to-one; `decklistFor`
  is called for both seats plus hover. Acceptable: lists are worker-side
  projections, already lazy.
- The compaction threshold is a function of content width, so it shifts if
  button labels change — tests must measure, not hardcode, the flip point.
- Chamfer on this screen is 12px while the token default is 10px; a
  cleanup that "unifies" them to 10px would undo an approved parameter.
- Concealed-code rules are unaffected: lists come from the same
  `decklistFor` projection the library dock uses.

## Alternatives rejected

- Titles inside the pane (ceremony column), single top command bar, stacked
  seat halves: prototyped as variants B, C, D/F; owner picked Twin Columns
  for two always-visible full lists.
- Keeping the floating hover window: occludes the grid and duplicates the
  reading position the pane already provides.
- Seat cards as square `DeckTile`s: art + badges spend pane height the
  lists need; owner ordered name-only chips.
- Fixed responsive breakpoints: break under the adjustable pane width and
  any label change; measured overflow is the rule the owner approved.
- Matching the prototype's no-collapse behavior at mid widths: starves the
  grid beside a 38rem pane; collapse kept (Decision §7).
