# ADR-029: Prompt-Attested Private Identity In Selection Lists

> Status: accepted; planned
> Decided: 2026-08-16
> Owners: prompt + projection privacy architecture
> Plan: [`../../artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`](../../artifacts/PLAN_2026_08_16_duel_feedback_round_4.md) — T3

## Context

Card identity has three states: PUBLIC (both players), PRIVATE (one player), HIDDEN (none). Searching your own deck makes its contents PRIVATE to you for the prompt's lifetime — the engine literally sends you every candidate's code. Yet the target list rendered "Face-down card" for all of them: `offFieldTargetEntries` (ADR-014 discipline) trusts only the projected snapshot, and ADR-008 deliberately does not model deck contents beyond top-offset reveals.

The information is not secret. `validatePromptCard` in `duel-worker-event.ts` already enforces concealment only for opponent-controlled concealed cards; own-card prompt entries legitimately carry `code`/`name`. Refusing to render them invents hidden information in the wrong direction — the same failure ADR-008 rejected for opponent excavates.

## Decision

1. `InteractionChoice` gains `cardCode?: CardCode`, populated by `sanitizeChoice` **only** when the prompt card's `controller === 0` and the engine sent a code.
2. `offFieldTargetEntries` resolves identity as: projector-attested snapshot code first, else prompt-attested `cardCode` (controller 0 only). Either yields `identityVisible: true`, face art, real name.
3. Opponent addresses never use the fallback — the worker-event validator remains the enforcement point, and the client stays belt-and-braces with the explicit `controller === 0` guard.
4. Scope = prompt lifetime. Nothing is written into the projection; the browse list and board keep ADR-008/ADR-014 behavior. Prompt resolves → shuffle → knowledge evaporates with the entries.

## Alternatives rejected

- Project search identities into the snapshot deck: contradicts ADR-008's refusal to trust engine deck sequences; leaks into browse list after the prompt.
- Reveal-token machinery (ADR-014 style) for search prompts: heavy; prompt entries already carry the attested fact with the exact lifetime needed.
- Show identities for opponent's searches of their own deck: that is their PRIVATE knowledge, not yours; validator already strips it.
