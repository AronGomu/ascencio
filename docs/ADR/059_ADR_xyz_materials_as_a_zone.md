# ADR-059: Xyz materials are a first-class, browsable, addressable zone

> Status: accepted; planned
> Decided: 2026-08-27
> Owners: field presentation architecture, worker protocol
> Relates: ADR-007 (stack zones as interaction targets), ADR-021 (card-list dialog modes), ADR-014 (public knowledge for face-down cards)

## Context

Materials are already fully projected on the wire. `PublicOverlayMaterial` (`src/battle/duel/contracts/public-duel-state.ts:28`) carries `instanceId`, `code`, `identityVisible`, `sequence` per material, and every `PublicCard` already lists them: `readonly overlayMaterials: readonly PublicOverlayMaterial[]` (`public-duel-state.ts:59`). `board-view-model.ts` derives `BoardMaterialView` (`board-view-model.ts:47`) and attaches `readonly materials: readonly BoardMaterialView[]` to every `BoardCardView` (`board-view-model.ts:84`). None of this is missing data — nothing on the field renders it. The only place a material was visible to a player was the HUD inspector's list.

The gap is not on the read side, it is on the prompt side. `engineToPublicLocation` masks the overlay bit before switching on location: `switch (location & ~EngineLocation.OVERLAY)` (`src/battle/worker/protocol/PromptRegistry.ts:1174`), and `PublicLocation` has no `overlay` member — its union is `"deck" | "hand" | "monster" | "spellTrap" | "field" | "graveyard" | "banished" | "extra"` (`public-duel-state.ts:18-26`). A detach prompt's choice cards therefore arrive tagged with the host's plain location (`"monster"`), not distinguishable from the host itself. `card-mapping.ts:62` resolves each choice card through `findPublicCard(snapshot, choice.card)` (`card-mapping.ts:81`), which matches on location/controller/sequence against the board — and a material sharing its host's location resolves onto the host's own field slot. Nothing downstream of the worker can tell a material apart from the monster carrying it. "List the materials to detach" was unimplementable in the UI layer alone; the bit the UI would need was thrown away one layer earlier.

The owner's 2026-08-27 feedback round asked for material parity with the field's other zones — visible on the field itself, not confined to the HUD inspector.

## Decision

1. **Materials render on the field, behind their host.** Each `BoardMaterialView` on a monster's `materials` list draws offset to the right of the host card and at a lower z-index than it, so the host stays the readable, interactive card in its zone and the materials read as attached rather than as competing occupants of the same slot.
2. **Materials are non-interactive as field art.** A rendered material is not a drop target, not draggable, and not directly clickable; it exists to answer "what is this card made of" at a glance.
3. **The worker keeps the OVERLAY bit as a marker on `PromptCard`, not as a new `PublicLocation` member.** `toPromptCard` (`PromptRegistry.ts:1145`) reads the bit it already has and sets `PromptCard.overlay?: true` when `location & EngineLocation.OVERLAY` is set, leaving `engineToPublicLocation`'s existing switch and the rest of `PublicLocation`'s eight-member union untouched. Every existing consumer of `PublicLocation` — the projector's zone mapping, `findPublicCard`, presentation code — sees the same location it always saw; only a caller that reads the new field learns anything new.
4. **Materials are reached through a card-anchored local action, not a pile stack.** A material belongs to the card carrying it, not to a zone the way deck/extra/graveyard/banished piles do (ADR-007), so opening "list materials" is an action on the host card rather than a fifth kind of stack. This introduces `LocalCardAction` as a concept distinct from a `PromptChoice`: a local card action opens a list or a view and never sends anything back to the engine, where every `PromptChoice.action` (`player-prompt.ts:33-42`) is an answer the engine is waiting for.
5. **`LocalCardAction` survives prompt suppression.** Because it never answers the engine, it is not gated by whatever rule suppresses prompt-derived affordances while a duel is between decisions — the list-materials action is always available on a card that has materials, prompt or no prompt.

Whether a detach prompt's engine payload actually distinguishes an overlay sequence from its host's own sequence — as opposed to sharing one, which would make the OVERLAY bit necessary but not sufficient to resolve a specific material — is confirmed by an integration test before anything downstream relies on the widened contract for detach resolution. Absent that test, this ADR records the field-rendering and marker-bit decisions as ready to build; the detach-specific resolution path stays gated on the test passing.

## Consequences

- `PromptCard` gains a field, `overlay?: true`, that only one caller reads today — a small, deliberate contract widening for a narrow need, not a general-purpose flag.
- Materials are drawn but inert. A player can try to click one directly on the field and get nothing; the only path to acting on a material is through the host's local action, which the owner accepted as the cost of keeping the field's one-card-per-zone geometry intact.
- The field now has two ways to open a card list that look the same to a player — the pile-stack click (ADR-007, ADR-021) and the card-anchored local action — while being wired through entirely different code paths underneath. A future prompt kind that needs "list of things attached to this card" should reuse `LocalCardAction` rather than inventing a third path.
- Because `LocalCardAction` never answers the engine, it is exempt from any future prompt-suppression rule by construction, not by an explicit exception list. A rule writer who forgets this will not find "materials" named in their suppression logic and may assume it was missed rather than deliberately out of scope.

## Alternatives rejected

- **Add `"overlay"` to `PublicLocation`.** Rejected: every consumer of the nine-case union — including the projector's own zone mapping and `findPublicCard` — would need a ninth case for exactly one prompt family, when a marker bit on `PromptCard` answers the same question for the one caller that needs it.
- **Infer materials by matching sequence numbers against the host's material list.** Rejected: this guesses at engine payload semantics the repo has no source-level way to verify — whether a detach choice's sequence aligns with `PublicOverlayMaterial.sequence` on the host is exactly the fact the integration test above exists to confirm, not something safe to assume from the outside.
- **Make each material its own clickable card on the field.** Rejected: a material occupies no zone of its own: giving it a real hit area either overlaps the host's hit area or forces a second slot per monster, both of which break the field's one-card-per-zone geometry that every other ADR in this area (007, 015, 058) is built on.
- **Keep materials HUD-only.** Rejected: the owner's 2026-08-27 feedback asked for parity with the field's other zones; a list that only exists in the inspector is not a zone, it is a sidebar.
