# ADR-033: Story economy lives in StoryState (save schema v2)

Status: accepted · 2026-08-16 · Commit: `d81f2fb`

## Context

VN feedback adds DP currency (start 1000), booster inventory, card collection. Need persistence + a home. Candidates: new dedicated IndexedDB store, or fields inside `StoryState`.

Story already has a full save pipeline: versioned envelopes, three manual slots, autosave, pre-duel checkpoint, admin reset by database name (ADR-026, ADR-027).

## Decision

Economy = part of `StoryState`:

- `dp: number` (init 1000), `boosters: Record<setId, count>`, `collection: Record<code, count>`, plus shop-session fields (`shopReturnScreen`, `shopSetId`, `openedCards`, `openingMode`).
- Save schema bumps 1 → 2 once for the whole plan. v1 reads migrate in memory by defaulting the new fields; writes always v2; versions > 2 stay `incompatible`.
- All mutation flows through `reduceStory` commands (`buy-packs`, `open-boosters`, `sell-cards`) with guards — UI cannot mint DP or cards.

## Consequences

- One atomic snapshot: save/load/checkpoint carries progress and wallet together. No cross-store consistency problem, no dupe-exploit asymmetry — loading a save rolls story and economy back as one.
- Free rides on existing machinery: slots, revisions, admin reset, duel-handoff checkpoint.
- Collection is counts-only (`code → qty`), so state stays small even with hundreds of cards.
- Cost: economy resets with story reset; a future "account-level collection independent of save slot" needs its own ADR and a dedicated store. Accepted for the prototype.

## Rejected

- Separate `ygo-story-shop` database: two sources of truth for one player timeline, checkpoint/restore would need a saga across stores (ADR-027 pain, doubled) — no benefit at this scale.
