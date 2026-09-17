# ADR-090: Shared Svelte views receive complete presentation data

> Status: accepted; implemented
> Decided: 2026-09-13
> Owners: shared-svelte-ui / shell / domain containers
> Amends: ADR-036 §§1–4; ADR-022 generic-source-folder prohibition, narrowed to named UI module
> Implemented: `e338808ffbe790d8dc9a3210a7467535fb293c58` — T1–T3 pure shared views, host-owned leases, boundary/data-cy regressions.
> Baseline: `010401956d0cd59d8e6dda91bd367040f5de669e` — inspected pre-implementation source.

## Context

CardPreviewPanel in Shell resolves image leases by card code. OverlayScrollbar imports Battle geometry. Moving files without removing those behaviors would preserve provider coupling under another name. Sources at baseline 010401956d: src/shell/card-preview/CardPreviewPanel.svelte; src/shell/card-preview/OverlayScrollbar.svelte; src/deck-select/deck-select-contracts.ts.

## Decision

D1. Exact root is `src/shared-svelte-ui/`. Focused public entries expose preview, scrollbar, generic coordinate math. No generic shared/common/utils/core catch-all.

D2. Shared components import no Cards, Decks, Story, Battle, Content, Shell, Deck Editor, Deck Select APIs, including type-only imports. Inputs are complete presentation ViewModels; outputs are callbacks/events.

D3. Domain containers acquire data/media, release leases, construct ViewModels. Shared views own ephemeral focus, hover, scrolling, expansion, drag, animation, local image-error display only.

D4. Shell owns route/stage/toast coordination, not reusable-view data access. Deck Select remains sibling-independent: hosts supply frame color, label, resolved image; no Cards/Decks type imports.

D5. Every rendered element retains unique role-based `data-cy`. Shared preview instances use explicit stable prefixes; no code-based media provider prop or card identity needed by pure view.

## Consequences

C1. Generic UI no longer creates domain-to-Shell rendering back-edges.

C2. Containers carry lease/race/disposal responsibility; prop contracts and selector tests grow. Existing visuals remain unchanged rather than redesigned.

## Alternatives rejected

A1. Move connected preview unchanged: still violates complete-ViewModel boundary.

A2. Shell UI barrel: mixes coordination with presentation reuse.

A3. Duplicate panel per domain: behavior/accessibility drift.
