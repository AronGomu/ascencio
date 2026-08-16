# ADR-027: Story Duel Handoff Saga

> Status: accepted
> Decided: 2026-08-14
> Owners: story-domain, battle-domain, application-shell architecture
> Plan: [`../../ai-artifact/PLAN_2026_08_14_three_ui_restructure.md`](../../ai-artifact/PLAN_2026_08_14_three_ui_restructure.md) — T9, T19

## Context

The visual novel currently fakes battles with reviewer buttons. Real duels introduce failure modes a narrative cannot absorb blindly: the Worker dies on reload, a duel can be surrendered, engine initialization can fail, and a late result can arrive after the player has moved on. Story progress and duel state live in different databases (ADR-026), so no transaction spans them.

Two rules are non-negotiable: the engine decides duel results, and a technical failure is never a player loss.

## Decision

1. **Story never imports the duel.** It emits an encounter intent; the shell mounts `BattleFacade` from `src/battle/index.ts` and owns the lifecycle.
2. The facade settles **exactly one** normalized result per session: `resolved{player-win|player-loss|draw}`, `aborted{surrender|exit}`, or `failed{message}`. No `DuelResult`, seed, deck order or protocol index leaves the domain.
3. **Checkpoint before dispatch.** Order: write `checkpoint:pre-duel` (story state + `handoffId` + `encounterId`) → read it back → verify. A failed or mismatched write returns `checkpoint-failed` and the duel does **not** start; the story offers a retry.
4. Only after a verified checkpoint does the shell navigate to `#/duel/session/{handoffId}`.
5. **Correlation.** A result is accepted only when its `handoffId` matches the pending one. Stale, duplicate and mismatched results are ignored without mutating story state.
6. **Reload policy.** Loading a `duel-session` route reads the checkpoint: matching `handoffId` → restore state and auto-restart that encounter; missing or mismatched → return to `#/story` with the last stable state. Duel state itself is never resumed, because the Worker did not survive.
7. **Outcome mapping.** `resolved` → win/loss branch, `aborted` → abort branch, `failed` → technical-failure branch. `failed` may never map to a loss.
8. Deck selection for a story duel goes through the ordinary deck picker; the player chooses both sides, preselected from the last used pair.
9. On settle, the checkpoint is cleared and the route returns to `#/story`.

## Alternatives rejected

- **Resume the duel after reload.** Impossible without serializing live engine state, which the Worker boundary forbids.
- **Return to the map and mark the encounter unattempted.** Loses the encounter context the player just entered.
- **Offer Retry / Return instead of auto-restart.** Fewer surprises, but the product chose the shortest path back into play; surrender remains the deliberate exit.
- **Let the story call the Worker directly.** Breaks the Worker authority boundary and duplicates lifecycle handling.
- **Treat engine failure as a loss.** Punishes players for infrastructure faults and corrupts progression.
- **Story-owned checkpoint writing after dispatch.** A crash between dispatch and write loses progress.

## Consequences

- Story progress survives reloads, surrenders and engine faults.
- A player cannot escape an encounter by reloading; that is accepted, with surrender as the in-duel exit.
- The handoff is testable without a browser: coordinator, mapping and acceptance rules are pure functions.
- Adding a new battle outcome means extending one union and its exhaustive mapping.
- Cross-domain flow stays a saga of small verified steps, since no shared transaction exists.
