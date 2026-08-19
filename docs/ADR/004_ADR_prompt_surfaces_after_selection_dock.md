# ADR-004: Prompt Surfaces After Selection-Dock Removal

> Status: accepted; planned
> Decided: 2026-08-08
> Owners: interaction architecture
> Plan: [`../../artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`](../../artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md) — T5, T6, T7, T9

## Context

Three surfaces answer prompts today.

- `PromptControls` inside `workspace-grid` answers everything, and is the **only** surface for `yesNo`, `effectYesNo`, `option`, `selectPosition`, `sortCard`, `sortChain`, `announceNumber`, `announceAttribute`, `announceRace`, `announceCard` and `rockPaperScissors`.
- `SelectionDock` inside the field answers field-capable prompts: Confirm, Cancel, counter steppers, order arrows, validation text, global choices.
- `FieldActionMenu` is an anchored 18rem dropdown listing a card's engine-worded actions plus `Inspect …` and `Close actions`.

The overhaul hides `workspace-grid` by default and deletes `selection-dock` and the menu. Removing all three without a replacement leaves eleven prompt kinds unanswerable and the duel deadlocked, because `ocgcore` blocks until a response arrives.

## Decision

1. Add a pure router, `promptSurface(prompt, spec, showWorkspace)`, returning `none | docked | field | dialog`. Ordered rules: no prompt → `none`; workspace visible → `docked`; active spec with `fieldCapable` → `field`; otherwise → `dialog`.
2. `dialog` renders `PromptControls` inside a modal `PromptDialog`. It has no close button, ignores `Escape` and ignores backdrop clicks. Nothing to dismiss to: the engine is waiting, and cancelling — where legal — is one of the prompt's own choices.
3. `SelectionDock` becomes `FieldActionBar`: same dispatch behaviour, same confirm labels, compact bar pinned bottom-centre inside the field, lists capped at `9rem` with internal scroll, selection summary reduced to a count.
4. The bar renders only when it has content: a `cardSelection`, `placeSelection`, `counterAllocation` or `order` spec, or at least one global choice that is not `endPhase`.
5. `endPhase` leaves the bar and becomes a persistent warning-orange corner button, always mounted, enabled only when the current spec offers that choice, labelled with the engine's own wording (`End turn`, `End Battle Phase`).
6. `FieldActionMenu` becomes `CardActionChips`: fixed-size chips floating above the card, revealed on hover, focus-within or pinned state, labelled from `choice.action` rather than engine text, with no `Inspect` and no `Close actions`.
7. Pinning reuses the existing `openMenu` / `closeMenu` session actions and `session.menuTarget`. No new session state.
8. Exactly one prompt surface renders at a time. With the workspace visible the docked panel wins and no dialog appears.

## Alternatives rejected

- **Strict hide with no fallback.** Matches the literal instruction and deadlocks the duel on the first yes/no.
- **Always-visible prompt panel.** Keeps a permanent panel the user asked to remove.
- **Non-modal dialog for every prompt.** Field-capable prompts need the board clickable, so the dialog would have to be non-modal everywhere; that reintroduces the dock in all but name.

## Consequences

- Two overlay components instead of one dock. Matches the project's one-concern-per-file policy.
- Chips are deliberately smaller than the 44px pointer-target guidance. The card's own target button stays 44px and `Enter` plus arrow keys reaches every chip, so the keyboard and screen-reader paths are unaffected.
- The chip label map must stay exhaustive over the eighteen-member `ChoiceAction` union; a unit test enforces that.
- Two labels keep two words: `Special Summon` and `Change Position`. One word each would read as a different action.
