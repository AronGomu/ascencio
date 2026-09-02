# ADR-068: A fresh chain window holding a real option always prompts

> Status: accepted; planned
> Decided: 2026-09-02
> Owners: prompt architecture
> Amends: ADR-028 §2 (empty-chain attribution branch no longer auto-passes when an activatable choice exists; non-empty-chain branch unchanged)
> Relates: ADR-009 (trivial prompt auto-resolution, unchanged)

## Context

ADR-028 §2 auto-passes a `chain` prompt attributed to the player: chain non-empty → last link's controller is player 0; chain empty → the latest presentation-event actor is player 0. The empty-chain branch was aimed at noise windows during the player's own turn.

It also swallows real decisions. When the player's own action sends a trigger monster to the graveyard (owner feedback round 2026-09-02, Scarm: "After sending scarm to the graveyard, no action proposed me to activate its effect even though it was valid activation"), the core opens a fresh chain window — chain empty, actor player 0 — whose choices are `[activate, pass]`. The branch checks attribution but never the choices, so the trigger is passed before the player sees it. `trivialPromptResponse` (ADR-009) already auto-passes the genuinely empty windows (`pass` as the only choice), so the empty-chain branch's *only* effect on windows with real options is to swallow them.

Full Control (ADR-028 §3) already bypasses everything; the bug bites the default mode only.

## Decision

1. The empty-chain branch of `ownEffectChainPassResponse` returns "player decides" (`null`) whenever the prompt holds any non-pass choice.
2. The non-empty-chain branch is unchanged: chaining onto the player's own last link still auto-passes. That is the case ADR-028 was built for (play spell → "chain to your own spell?" → pass).
3. Opponent-attributed windows are unchanged (never auto-passed).

## Consequences

- Every own-action trigger window (mill, destruction, cost-send) now prompts in default mode. That is more prompts than ADR-028 shipped — deliberately: those windows carry decisions.
- The unit test that locked the swallowed behavior ("passes an empty-chain window after the player's own action" with an activate choice present) flips to assert the prompt surfaces. The old assertion was the bug, notarized.
- Own-link chain windows (decision §2) can still hide a competing trigger that shares the window with the chain-to-own-effect option. Accepted residual: narrowing §2 as well would re-prompt on every own activation and undo ADR-028's purpose; Full Control remains the escape hatch.

## Alternatives rejected

- **Blanket rule: never auto-pass any chain window with a non-pass choice.** Neuters `ownEffectChainPassResponse` entirely (see §2's case) — every own spell activation would re-prompt, reverting the ADR-028 default the owner asked for.
- **Whitelist trigger-style windows via engine timing hints.** `MSG_SELECT_CHAIN` hint flags are undocumented core internals; building default-mode behavior on them contradicts the projection rule that attested client-side facts drive prompts.
- **Fix by card category (graveyard triggers only).** Rules-shaped UI heuristic; the same swallow applies to hand and field triggers in fresh windows.
