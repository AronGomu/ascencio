# ADR-005: Optimistic Drag Placement With Engine Reconciliation

> Status: accepted; planned
> Decided: 2026-08-08
> Owners: interaction architecture
> Commit: `f0139d0` — T10

## Context

Requested behaviour: drag a playable hand card, see the legal destinations light up, drop on one, and have the action plus the zone reach `ocgcore` as a single gesture.

The engine does not work that way. `SELECT_IDLE_COMMAND` lists card actions with no placement data. Only after the client answers with an action does the engine emit `SELECT_PLACE`, carrying a `field_mask` the client decodes into `place: { player, location, sequence }` choices. At drag time the legal zone set is therefore unknown, and there is no single message that carries both facts.

Architecture rule in force: `ocgcore` is the sole authority for legality; presentation state never determines legality.

## Decision

1. The drag halo is a **local, non-authoritative guess**. `placementZoneCandidates(action, board)` returns unoccupied `p0:mainMonster:*` for `summon` and `setMonster`, those plus both `shared:extraMonster:*` for `specialSummon`, and unoccupied `p0:spellTrap:*` for `activate` and `setSpellTrap`. Every other action returns nothing.
2. `p0:field` is never a candidate. `PublicCard` carries no card type, so a field-spell destination cannot be derived without guessing wrong for every other spell.
3. A drop resolves one action through `dropChoiceForZone`: monster zones prefer `summon`, then `specialSummon`, then `setMonster`; spell/trap zones prefer `activate`, then `setSpellTrap`. Non-primary actions stay reachable through the hover chips.
4. On drop the store arms a `PendingPlacement { zoneId, armedAtPromptId }`, then dispatches the action choice.
5. When the next prompt arrives, `resolvePendingPlacementChoice` answers it automatically only if every condition holds: a different prompt id, kind `selectPlace`, `minimum === 1`, `maximum === 1`, and exactly one choice whose `place` maps to the armed zone. Otherwise it returns `null`.
6. `pendingPlacement` is cleared on every `prompt`, `result` and `error` event. It survives `state` and `event` traffic, which is what arrives between the action and the placement prompt.
7. A guess that misses degrades to the normal path: the engine's own `selectPlace` prompt renders with true zone highlights and the player picks. No stuck state, no retry, no second response.
8. The gesture is pointer-event based, not HTML5 drag-and-drop, and reuses the existing 8px move threshold. The drop hit test is an injected function so component tests stay deterministic under jsdom, which implements neither `DataTransfer` nor `elementFromPoint`.

## Alternatives rejected

- **Two-step, engine-truth only.** Always correct, never a wrong halo, but it is two gestures and no drag affordance — the thing that was asked for.
- **Deriving legality in the UI.** Would duplicate rules logic in presentation and directly violate the engine-authority boundary.
- **Holding the response until the placement prompt arrives.** Would stall the worker queue and break the one-response-per-prompt invariant the browser tests assert.

## Consequences

- The halo can be wrong: it may light a zone the engine rejects, or omit one it would allow (field spells, some special summons). Wrong halos cost one extra prompt, never a bad response.
- Automatic answering is a response the player did not click. It is bounded to a single-count `selectPlace` that exactly matches the zone the player dropped on, so it is the answer they already gave.
- The store gains one field and one method. Response accounting in the browser tests must expect the extra placement response after a drag.
