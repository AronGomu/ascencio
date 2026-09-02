# ADR-063: Decklist rows carry frame colour + art; deck-select reads `src/decks/card-frame.ts`

> Status: accepted; planned
> Decided: 2026-09-02
> Owners: deck-select presentation, decks shared library
> Relates: ADR-022 (modular monolith boundaries), ADR-045 (single trunk)

## Context

`DecklistPanel` rows were name + `×N` text only. Owner asked for MTG-Arena-style rows; prototype round (frozen at `docs/feature/PROTOTYPE_decklist_rows.html`, decisions in `docs/feature/PDDR-decklist_rows.md`) fixed the treatment: cropped-art strip background fading under the name, 5px left border in the card's frame colour, full-height left copy cell.

Frame colour is card-type semantics — nine frames (normal/effect/ritual/fusion/synchro/xyz/link/spell/trap) classified from OCG type bits with precedence spell > trap > link > xyz > synchro > fusion > ritual > effect > normal. Three hosts (deck editor library, story pre-battle, free-play match setup) resolve rows; the panel renders them. Duplicating the nine-colour palette between `src/decks/` and the panel would drift silently — nothing ties two hex lists together.

AGENTS.md describes `src/deck-select/` as importing "no sibling domain at all". The machine checks are narrower: `tests/unit/domain-boundaries.test.ts:109` returns true for target `"decks"` for every domain, and the deck-select ESLint zone lists no decks group — `src/decks/` is the shared deck-data library, not a sibling UI domain.

## Decision

1. `DecklistRow` widens to `{ code, name, frame: CardFrame, artUrl: string | null }`. Both new fields required; hosts resolve them, the panel stays read-only.
2. Frame classification and palette live once, in `src/decks/card-frame.ts`: `cardFrameOf(rawType): CardFrame` + `CARD_FRAME_COLORS`. `DecklistPanel` imports both directly.
3. "Deck-select imports nothing" is hereby narrowed to: deck-select imports no sibling **UI** domain. `src/decks/` (shared data library, already open to every domain in both machine checks) is legal.
4. `artUrl` is the cropped-art URL via `croppedCardImageUrl`; `null` degrades the row to frame colour + name — never a broken image.
5. Visual params (30px row, 5px border, 38% fade, 0.6 art opacity, cell metrics, nine hex colours) are fixed by the frozen prototype and its spec; they live in the component and `CARD_FRAME_COLORS`, not here.

## Consequences

- One palette source; a colour change lands everywhere or nowhere.
- deck-select gains its first import from outside its own directory. The "purely presentational, zero imports" purity claim is gone; the narrower rule (no sibling UI domain) is the one both checks always enforced.
- Every future `DecklistView` producer must resolve two more fields; a host that cannot classify a card must still emit `frame:"normal"`, `artUrl:null`.
- Rows now trigger up to ~90 cropped-image fetches per shown decklist; served from the runtime image cache, accepted.

## Alternatives rejected

- **Duplicate `CardFrame` union + palette inside deck-select contracts** — keeps the zero-import purity, buys silent palette drift with no failing test. Rejected in coherence review (F2/F3).
- **Optional `frame?`/`artUrl?` fields** — hosts compile without resolving them; the compiler stops driving the wiring and unstyled rows rot in place.
- **Export the palette through `src/deck-select/index.ts`** — widens a frozen public entry with a name no consumer needs (hosts infer `CardFrame` from `cardFrameOf`).
- **Panel resolves art/frame itself from a catalog prop** — makes the panel read domain data, exactly what its host-maps-view-models design exists to prevent.
