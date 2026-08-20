# ADR-042: Editor Viewport Budget

> Status: accepted; planned
> Decided: 2026-08-20
> Owners: integration/shell architecture
> Relates: ADR-019 (full-height duel shell and pixel geometry), ADR-024 (responsive stage), ADR-036 (shared preview panel)
> Plan: [`../../ai-artifact/PLAN_2026_08_20_decks_feedback_round_2.md`](../../ai-artifact/PLAN_2026_08_20_decks_feedback_round_2.md) — T4, T5, T8

## Context

Feedback round 2 reports three symptoms of one cause: unused margins on a 1080p screen, a scrollbar on `shell-region-decks` before the mobile layout is reached, a card viewer far wider than the card it shows. Two more items — extra/side wasting three rows for fifteen cards, and tiles showing the top-left corner of their art — are the same theme: the editor spends viewport it does not have.

The scrollbar has a precise cause. The editor sized its panes with `calc(100vh - 5.5rem)` while the shell letterboxes the app into a 16:9 stage whose height is `--stage-h`. Whenever the stage is shorter than the viewport, the panes overshoot by exactly the difference, and `.shell-region--decks { overflow: auto }` renders that difference as a scrollbar. Measuring the viewport inside a domain is the bug; ADR-019 already made the duel read the stage.

## Decision

1. **Domains size themselves from the stage.** The editor's layout is `calc(var(--stage-h, 100svh) - var(--deck-editor-header-h))` tall with `grid-template-rows: minmax(0, 1fr)`; its three panes are `height: 100%` and scroll internally. No `100vh` remains under `src/deck-editor/`.
2. **`--preview-w` is the one preview-width knob**, shared by the duel shell and the editor's first column, and it drops from `22rem` to `15.5rem` (sub-breakpoint `18rem` → `13.5rem`). The panel is a card plus its text; sizing it to the card is what feedback asked for, and the duel gets the same benefit from the same edit.
3. **Full-bleed gutters.** Header, message strip and layout span the stage width with a `0.25rem` gutter instead of a centred `calc(100% - 0.5rem)`; the workspace column takes the slack (`minmax(0, 1fr)`).
4. **Fifteen-card zones are one row.** `FIFTEEN_CARD_GRID` becomes `{ columns: 15, rows: 1, slots: 15, compact: true }`. A zone header is one full-width button carrying chevron, heading and count, so the whole bar toggles.
5. **A tile shows its whole card.** Tile art fills the tile with `object-fit: cover`; tile geometry (`59 / 86` ≈ 0.686) matches card scans (~421×614 ≈ 0.686), so "cover" crops nothing. The name overlays the art bottom with a scrim, and stays a plain row when there is no art.
6. **The budget is machine-checked**: an e2e assertion that at 1920×1080 `shell-region-decks` has `scrollHeight <= clientHeight` and `scrollWidth <= clientWidth`, plus a stylesheet test that no editor component mentions `100vh`.

## Consequences

- The duel's preview column narrows too. That is intended by the feedback and covered by the duel smoke test.
- A future editor pane that wants height must take it from the grid, not from the viewport; the e2e assertion fails loudly if it does not.

## Alternatives rejected

- `overflow: hidden` on `.shell-region--decks`: hides the symptom, and clips the library, which is a document-shaped page that legitimately scrolls.
- Publishing the stage height from `AppShell` in JS: a published box trails the layout pass by a frame; `--stage-h` is recomputed by the same pass that applies the resize (ADR-019, ADR-024).
- `object-fit: contain` on tiles: letterboxes every tile to hide a crop that the matching aspect ratio means does not happen.
</content>
