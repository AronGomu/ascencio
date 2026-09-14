# ADR-089: Canonical Cards ownership

> Status: accepted; planned
> Decided: 2026-09-13
> Owners: cards / decks / consumer adapters
> Amends: ADR-022 dependency direction; ADR-043 catalog ownership
> Baseline: `010401956d0cd59d8e6dda91bd367040f5de669e` — inspected integration source, not implementation evidence for this decision.

## Context

Battle brands CardCode while Decks contains immutable OCG masks, catalog records, frame mapping. At baseline 010401956d0cd59d8e6dda91bd367040f5de669e, consumers deep-import those Decks files. Card definition, deck membership, mutable duel instance are different semantic owners. Sources: src/battle/duel/contracts/ids.ts; src/decks/catalog/ocg-card-mapper.ts; src/decks/card-frame.ts.

## Decision

D1. `src/cards/` owns `CardCode`, its validating constructor, immutable printed definitions/text, OCG classification, card-frame mapping, semantic image references. Battle imports this single brand; `CardInstanceId` remains Battle-owned.

D2. Cards imports no Decks, Story, Battle, Content, Shell, Deck Editor, Deck Select API. No Cards engine initializer, deck quantity rule, collection ownership, price, unlock, mutable duel state.

D3. Decks retains records/history/repositories, quantity rules, ownership inputs, deck-specific projection/query APIs. Cross-domain imports use explicit public sub-entrypoints, never internal source paths. Decks depends on Cards; reverse edge is forbidden.

D4. Consumer-owned adapters map definitions into local semantics. Shared primitives cross directly only with explicit ownership, such as Decks-owned `DeckId`. No universal shared-types barrel.

D5. Battle resolves Cards data only after visibility attestation. Opponent concealed cards/materials cause zero identifying lookup or image acquisition. Owner-visible face-down cards remain distinguishable from concealed opponent cards.

## Consequences

C1. One immutable definition source removes competing brands/classification rules.

C2. Numerous imports move; export freezes, type checks, concealment tests must change together. Focused APIs cost explicit adapters where semantics differ.

## Alternatives rejected

A1. Generic shared/types folder: erases authority.

A2. Decks as global card authority: conflates printed data with deck rules.

A3. Catalog record reused as duel instance: loses instance identity and concealed-state guarantees.
