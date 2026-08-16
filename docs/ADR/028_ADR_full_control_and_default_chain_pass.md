# ADR-028: Full Control Mode And Default Chain Pass

> Status: accepted; planned
> Decided: 2026-08-16
> Owners: prompt architecture
> Plan: [`../../ai-artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`](../../ai-artifacts/PLAN_2026_08_16_duel_feedback_round_4.md) — T8

## Context

ADR-009 auto-answers only prompts that carry no decision (lone pass, forced chain, single option/position). Real play still drowns the player in chain windows for their own activations: play a spell → core asks "chain to your own spell?" → almost always pass. Product wants that window gone by default, but recoverable on demand — power users chain to their own effects (damage-step tricks, Spellbook loops).

## Decision

1. New session setting `fullControl: boolean`, default `false`, in `ui-settings-store.ts`. Not persisted.
2. `fullControl === false` (default): existing ADR-009 auto-resolution stays, plus `ownEffectChainPassResponse(prompt, snapshot, actor)` — auto-pass a `chain` prompt for player 0 when a `pass` choice exists **and** the window is attributed to the player:
   - chain non-empty → last link's `controller === 0`;
   - chain empty → `actor === 0`, where `actor` = `lastActionActor(events, turnPlayer)`: the player of the latest `summon | specialSummon | flipSummon | set | positionChanged | attack` presentation event since the last `turnStarted`, falling back to the turn player.
   Opponent's meaningful action with anything activatable always prompts — full control on or off. (Engine fact: `MSG_SELECT_CHAIN` carries timing hints but no actor; presentation events carry `player`, so attribution is client-side and attested.)
3. `fullControl === true`: every auto answer disabled — trivial prompts, own-chain pass, central auto-place. Every core decision surfaces.
4. UI: "Full Control" checkbox, bottom-right of the duel field (`FullControlToggle.svelte` in the field slot).
5. Hotkey: holding `Control` forces effective full control on. Release reverts to the manual checkbox value. Manual check survives Ctrl release. Effective value = `manual || ctrlHeld`.
6. Attempt-once semantics keep ADR-009's guard: a prompt shown to the player because full control was on is never auto-answered later by unchecking mid-prompt.

## Alternatives rejected

- Auto-pass every chain window with a pass choice: answers opponent-triggered response windows for the player → misses real decisions.
- Only explicit summon/attack events count for empty-chain attribution (phase windows always prompt): keeps end-phase noise during the player's own turn; rejected in grill round 2.
- Persist fullControl: hold-to-inspect is ephemeral by nature; persistence surprises next session.
- Detect "own effect" from the prompt choices instead of the chain: choices list *responses*, not the triggering link; chain tail controller is the attested fact.
