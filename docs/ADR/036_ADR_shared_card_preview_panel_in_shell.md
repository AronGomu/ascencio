# ADR-036: Shared Card Preview Panel Lives in the Shell

> Status: accepted; planned
> Decided: 2026-08-16
> Owners: integration/shell architecture
> Relates: ADR-022 (boundaries), ADR-014 (preview identity attestation — untouched)

## Context

Deck feedback demands the editor's card preview be *the exact component* the duel uses, shared. `CardPreviewPanel.svelte` sits in `src/battle/app/components/` — battle internals, unreachable from `src/deck-editor/` under ADR-022. `src/battle/index.ts` cannot export it either: that entry also exports `BattleFacade`, and a static import from a lazy domain would drag the whole duel chunk in eagerly (documented in `tests/unit/domain-boundaries.test.ts`). The shell public entry (`src/shell/index.ts`) is already the one module every domain imports legally.

## Decision

1. `CardPreviewPanel.svelte` and its `OverlayScrollbar.svelte` dependency move to `src/shell/card-preview/`; both are exported from `src/shell/index.ts`. Battle re-imports them through the shell public entry.
2. The panel's contract is de-branded: `CardPreviewView { code: number; name: string; description: string }` and a minimal `CardPreviewImageSource { lease(code): { url; release() } }` live in the shell. Battle's `CardCode` narrows to `number`; battle's `CardImageLibrary` structurally satisfies the image source. Battle keeps `cardPreviewForCode` / `cardPreviewForPublicCard` / `HIDDEN_CARD_PREVIEW` internally — visibility logic never leaves the battle domain.
3. The panel gains one prop, `staticImageUrl`, so a host without an image-lease library (the deck editor) can hand it a plain URL. Lease resolution still wins when a library is present.
4. The frozen shell API lists in `tests/unit/domain-boundaries.test.ts` widen accordingly — a deliberate edit, per the boundary policy.

## Alternatives rejected

- Export from `src/battle/index.ts`: eager duel chunk in the editor route (2.6 kB entry → ~340 kB precedent).
- Per-file allowance (like `admin-actions.ts`): allowances are for identifiers with *no* legal home; a shared presentation primitive has one — the shell.
- Copy the component into `src/deck-editor/`: two diverging previews; feedback explicitly says "exactly the same feature, shared".
- New top-level `src/ui/` shared folder: bigger boundary surgery than the feature warrants; the domain-boundaries test also rejects catch-all folders by name.
