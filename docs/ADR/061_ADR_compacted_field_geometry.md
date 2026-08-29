# ADR-061: Compacted Field Geometry

> Status: accepted; planned
> Decided: 2026-08-29
> Owners: browser presentation architecture
> Relates: ADR-019 (pixel-grid geometry this narrows), ADR-018 (conditional EMZ this repositions), ADR-060 (the projection this feeds)

## Context

ADR-019's grid spends one full pitch column on every zone and one full pitch row on the shared Extra Monster Zones. Five zone kinds — field spell, deck, extra deck, graveyard, banished — can only ever hold an upright card: nothing in them rotates to Defense Position, so their square footprint is dead width. The EMZ row's two boxes cost a full pitch of height between the halves, and the EMZ columns sat half a pitch off the monster grid (`columnX[2] + pitch/2`), a sideways step in the field's spine. Under ADR-060's projection every wasted flat pixel is projected smaller still, so the waste compounds where the board is already smallest.

Prototype round 2026-08-29, owner-tuned live and locked.

## Decision

1. Upright-only zones (`field`, `deck`, `extra`, `graveyard`, `banished`) are `slotWidth = cardWidth + 6px` wide, not pitch-square. Monster and spell/trap zones stay square — a monster still turns a quarter turn for defence.
2. `columnX` is therefore **non-uniform by design**: columns 0, 6, 7 hug the square grid at exactly `ZONE_GAP` (5px) border-to-border, the same gap as everywhere else. Do not "fix" it back to a uniform pitch array.
3. The middle is a band, not a row: `0.78 × pitch` tall with EMZ, `0.12 × pitch` without. Both profiles share one 6-entry `rowY` and one player-row map; the EMZ variant no longer grows a seventh row.
4. EMZ zones sit **on** monster columns 1 and 3 (`columnX[2]`, `columnX[4]`), band-height tall. The half-pitch offset is gone.
5. Cards render at `CARD_INSET = 0.86` of their zone box — a card never touches its zone border.
6. Width fitting stays closed-form: slot width is linear in pitch, so `pitch = min(height-fit, (availableWidth − widthConst)/widthCoeff)` with `widthCoeff = 2·MARGIN + 5 + 3k`, `widthConst = 3(SLOT_PAD − k·ZONE_GAP) + 2·ZONE_GAP`, `k = CARD_INSET·CARD_ASPECT`.

## Consequences

- Reclaimed width and height make every zone larger at the same viewport — the point.
- EMZ cards are ~0.72× a main-monster card (band height vs. box). Deliberate trade: a full-size EMZ card cannot coexist with a tight centre, because the EMZ now sits directly between the two monster rows. Accepted by the owner on the prototype.
- Without EMZ the two sides sit `0.12 × pitch` apart — visually almost touching. That is the requested look, not a collapsed layout bug.
- Any consumer that assumed `columnX[i+1] − columnX[i] === pitch` for all `i` is now wrong at `i ∈ {0, 5, 6}`.

## Alternatives rejected

- **Keep uniform pitch columns, shrink only the drawn zone outline.** Leaves the dead width in the layout; cards and hit targets stay small. The waste was in the grid, not the paint.
- **Band 0 (halves flush at `ZONE_GAP`).** Loses the readable seam between sides; owner chose to keep a `0.12 pitch` breathing line.
- **Full-height EMZ row kept for full-size EMZ cards.** Costs the centre tightness the owner explicitly asked for, twice (once flat, once projected).
- **Per-zone-kind aspect ratios everywhere** (e.g. narrow spell/trap too). A set spell/trap and a defence monster genuinely need the square; narrowing them clips rotated cards.
