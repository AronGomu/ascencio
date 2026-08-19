# ADR-025: Validated Card List Duel Start

> Status: accepted
> Decided: 2026-08-14
> Owners: duel-worker, deck-domain architecture
> Plan: [`../../artifacts/PLAN_2026_08_14_three_ui_restructure.md`](../../artifacts/PLAN_2026_08_14_three_ui_restructure.md) — T17, T18

## Context

The deck editor produces local decks, but they cannot reach the engine. `parseDuelCommand` rejects any deck id outside the bundled catalog, and `DuelWorkerRuntime.#startDuel` builds decks through `createPreset(playerDeckId, opponentDeckId)` and asserts `duelId === preset.id`. The MR3/MR5 rules profile and Extra Monster Zone geometry are derived from the selected pair (ADR-018), so a custom deck must flow through the same computation.

Packaged assets are finite: card data, scripts and images ship as one verified snapshot, and the build verifier ties packaged art to `reviewedCardPool(loadDeckSources())`. A local deck can reference codes the build does not ship.

`vendor/ocgcore-wasm/0.1.2` is permanently frozen (ADR-022).

## Decision

1. Extend the **wrapper**, never the engine. `startDuel` becomes `{ duelId, player: DuelDeckSelection, opponent: DuelDeckSelection }`.
2. `DuelDeckSelection` is a discriminated union: `{kind:"preset",deckId}` or `{kind:"cards",main,extra,side}`.
3. Card lists are bounded at the boundary: main 40–60, extra ≤ 15, side ≤ 15, ≤ 3 copies per code, positive safe integers, exact keys only.
4. **Strict snapshot validation.** Before any core session exists, every code must be present in packaged card data and in the packaged active-image manifest. Failure throws `unsupported_card` naming the offending codes; no duel session is created and no partial state is emitted.
5. The rules profile is computed from the resolved card lists, so custom decks get the correct MR3/MR5 mode and zone geometry.
6. Preset selections resolve through the existing `createPreset` path and must produce byte-identical setup to today.
7. The deck picker lists only decks that would pass this validation; invalid or unsupported local decks are hidden, so `unsupported_card` is a defensive path, not a user-facing flow.
8. Card lists never cross back to the main thread; opponent hidden-information rules are unchanged.

## Alternatives rejected

- **Allow missing art with placeholders.** Widens the legal pool, but deliberately weakens the verifier's image-coverage gate that keeps unapproved art honest.
- **Restrict the deck editor catalog to the packaged pool.** Simplest runtime, but cripples deck building compared to what the prototype already offers.
- **Validate only in the UI.** Worker authority would depend on a caller behaving; a forged message could reach the core.
- **New `startCustomDuel` command.** Two near-identical commands drift; one union keeps parsing and validation in a single place.
- **Ship more card art to widen the pool.** Distribution-approval question, not an architecture one; out of scope here.

## Consequences

- The Worker remains the sole authority; the engine binary is untouched.
- Deck legality has one definition, shared by picker filtering and Worker validation.
- Story and standalone duels can both use local decks through the same path.
- Widening the supported pool later is a snapshot/distribution decision, not a code change.
- Every existing `startDuel` caller and fixture updates to the selection shape in one ticket.
