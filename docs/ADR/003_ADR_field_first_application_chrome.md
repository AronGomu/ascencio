# ADR-003: Field-First Application Chrome

> Status: accepted; planned
> Decided: 2026-08-08
> Owners: presentation architecture
> Plan: [`../../ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`](../../ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md) — T2, T3, T4, T5, T8

## Context

The shell stacks panels above and below the board: `app-header` (title plus engine version), `status-panel` (session status, snapshot ids, image progress), `lifecycle-panel` (surrender), `duel-hud` (turn, phase, life points, counts, trays, chain), `workspace-grid` (prompt controls plus duel log). The board itself is capped at `min(100%, (100vh - 4rem) * 16/9)` with `min-width: 52rem` inside a scroll container that sets `overscroll-behavior: contain`.

Consequences observed: the board is a small rectangle in a column of cards, and the wheel does nothing while the pointer sits over the field.

A second defect compounds this. `.visually-hidden` is declared only inside the scoped `<style>` block of `PromptControls.svelte`, so Svelte scopes it and every other `.visually-hidden` element renders as plain visible text — the duel-field heading, both field live regions, the keyboard help span, the duel-log announcement.

## Decision

1. Delete `app-header`, `status-panel` and `lifecycle-panel`.
2. Replace them with one menubar carrying a single right-justified `Settings` button, opening a menu dialog holding a neutral `Settings` entry and a danger `Surrender` entry.
3. Move engine version and active/fallback snapshot ids into the settings dialog. They stay reachable; they stop consuming permanent screen space.
4. Keep the `message-panel` family — storage warning, image warning, engine error, duel result. They gate real recovery actions.
5. Move preload and activation progress into a slim `LoadingOverlay` pinned to the top of the viewport.
6. Hide `duel-hud` and `workspace-grid` behind settings checkboxes, both off by default.
7. Restore life points as pills inside the field, opponent top-left and player bottom-left, because the HUD was their only home.
8. Add a priority pill and a phase pill top-right of the field, formatted `prio-pill - phase-pill`.
9. Make the board `width: 100%` with no minimum, drop `overflow: auto` and `overscroll-behavior: contain` from `.duel-field`, and drop the small-screen `max-height` cap.
10. Promote `.visually-hidden` to the global stylesheet.
11. Settings are in-memory for the session. No persistence layer.

## Accepted losses

- The two duel-field `aria-live` paragraphs (`Field updates`, `Duel state updates`) are deleted at the user's explicit request. The screen-reader review in [`../architecture/05-presentation/duel-field-screen-reader-review.md`](../architecture/05-presentation/duel-field-screen-reader-review.md) credits them. The app-level announcement region survives, so response and loading state stay announced; per-move field narration does not.
- Deck, extra, graveyard and banished counts, the chain summary and the rich card list are only visible when the HUD checkbox is on.
- Settings reset on reload.

## Consequences

- Surrender must exist in the menu before the lifecycle panel is deleted; ticket order enforces this.
- Hiding `workspace-grid` hides `PromptControls`, which is the whole subject of [ADR-004](./004_ADR_prompt_surfaces_after_selection_dock.md).
- The Playwright spec loses `getByText("ocgcore 11.0")`, the surrender button and the `Current decision` region. Each affected test moves to the menubar route or to a `data-cy` selector.
