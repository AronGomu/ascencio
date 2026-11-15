# Protocol and Public State

> Status: implemented

Current implementation preserves fixed-slot projection, reconciles populated overlays, exposes visibility-tagged Extra Deck collections, projects counters plus actual chain provenance, and maintains a bounded semantic log.

## Protocol adapter

- Parse bounded raw message buffers inside the Worker.
- Convert every classified message into a typed domain event, prompt, or result.
- Keep protocol indexes/bytes private; UI choices use stable opaque IDs and card-instance IDs.
- Encode responses only after validating current prompt constraints.
- Unknown or malformed messages fail deterministically and retain type/bytes in diagnostics.
- Every supported binary shape has a permanent fixture; the pinned constant inventory must have a parser classification.

## Public state projector

Project immutable snapshots from core messages plus synchronous Worker-owned card/location queries when reconciliation is needed. Include LP, turn, phase, deck/Extra Deck counts, field zones, hand state, fixed slot sequences, positions, ownership/control, populated overlays, public counters, and actual chain provenance/status. Own Extra identities seed from the trusted preset then follow authoritative query order. Offline projected state may retain opponent identities from trusted deck/message/query evidence even when presentation visibility is hidden. Overlay materials use exactly `{ instanceId, sequence, code, identityVisible }`, cannot recursively contain materials, and inherit placement context from their host instead of guessing material owner/controller.

Each card carries sorted unique counters shaped exactly `{ type, name, count }`, where type/count are positive uint16 values. Names resolve from trusted lowercase hexadecimal counter strings, with deterministic `Counter 0xHEX` fallback. Snapshots allow at most 256 counter types per card and 1,024 counter entries globally. Unknown hosts, underflow, or overflow query-reconcile from authoritative `COUNTERS` evidence before publication; malformed or unavailable evidence terminates without partial state.

Chain links use native one-based indices and exactly preserve triggering controller, presentation-safe source identity, optional resolved description, phase (`pending | solving | solved`), and outcome (`normal | negated | disabled`). Phase and outcome are orthogonal. Concealed/unresolved sources expose only generic `Card effect`; raw code, instance ID, and encoded/resolved description remain absent. `CHAINING` appends, indexed status messages update existing links without resizing, and `CHAIN_END` clears.

## Control swaps and observation identity

`MSG_SWAP` (55) carries two **pre-swap** field addresses. The projector removes both occupants before inserting each at the opposite address; physical instance IDs, battle positions, counters and overlay materials travel with the cards. Public codes are refreshed only under the destination viewer's visibility rules. Missing, duplicate or non-field source slots fail before mutation. Frozen engine code remains unchanged.

This handler fixes the observed Creature Swap discrepancy where fresh legal prompts had current card codes but event observations retained the previous occupants' codes. Previously 55 was classified as an event but fell through the projector's default branch. Old logs retain that historical defect and must not be rewritten or treated as newly verified evidence. Identity-dependent findings from those logs remain ambiguous unless independently established. Regression coverage is in `test/unit/duel-state-projector-swap.test.ts`, including both transfer directions and concealed identities.

## Visibility and invariants

- Offline solo play has no secrecy boundary between Worker and main thread. Hidden identities may exist in projected/store state, but explicit visibility metadata must prevent plain display through DOM text, accessible names, card images, screenshots, routine logs, or diagnostics.
- Opponent policy receives only legally visible information so it cannot cheat.
- One physical card instance cannot occupy two top-level/Extra/material collections; public snapshots contain at most 256 physical instances globally.
- Every MOVE touching Extra or the raw overlay bit reconciles before opponent policy or snapshot publication. Host `overlayCards` is authoritative for material count/order/code. Valid code-consistent detailed material queries may enrich `identityVisible`; absent, unavailable, malformed, or contradictory detail falls back to prior visibility, then visible for own hosts and hidden for opponent hosts. Invalid host material lists terminate the session without publishing partial state.
- DOM/presentation state is never queried as duel truth.
- Monster and Spell/Trap field sequences are fixed-slot addresses; only ordered collections may be dense-resequenced.
- Public state contains no raw handles, response indexes, functions, or non-cloneable values.
- Every projection or presentation-visibility bug receives a minimal fixture before its fix.
