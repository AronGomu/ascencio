# Implementation report — decklist row art + frame color

Plan: `artifacts/PLAN_2026_09_02_decklist_row_art.md` (retired after completion; recover via `git show 124e824:artifacts/PLAN_2026_09_02_decklist_row_art.md`).

## Ticket State List

| Ticket | Goal | State | Commit |
| ------ | ---- | ----- | ------ |
| T1 | `cardFrameOf` classifier + `CARD_FRAME_COLORS` palette | DONE — 11/11 focused tests; headless green | `3023162` |
| T2 | `DecklistRow` `frame`/`artUrl`; panel + three hosts | DONE — 1059/1059 component tests; headless green | `518c911` |
| T3 | Chromium evidence, build gates, manual checklist | DONE — Chromium 1/1; build/headless/component green | pending commit |

## Assumptions

### A1 — sequential in-place execution instead of worktrees

Plan was authored against the dirty working tree, not HEAD: `src/decks/deck-cover.ts` (ticket dependency, `croppedCardImageUrl`) is untracked, and host files (`DeckSelectScreen.svelte`, `DeckLibrary.svelte`, `FreePlayMatchSetup.svelte`, …) are modified vs `53391aa`. A worktree checked out from HEAD would lack the prerequisites. Ticket flow is also a strict chain (T1→T2→T3), so worktrees add no parallelism. Impl agents therefore run sequentially in the main working directory; orchestrator commits only ticket-intentional paths per ticket.

### A2 — pre-existing dirty files stay uncommitted

The ~96 modified/untracked files predating this round are owner work in progress. They are left byte-identical and unstaged, except files a ticket explicitly changes.

### A3 — push to main authorized by skill

`make-parallel-aron` mandates commit + push per ticket; treated as explicit authorization to push `main` to `origin`.

### A4 — stage minimal prerequisite from owner WIP

T2 imports `croppedCardImageUrl` from untracked `src/decks/deck-cover.ts`. Remote validation would fail if T2 committed imports without that module. T2 commit therefore stages a minimal version containing only `croppedCardImageUrl`; unrelated owner-WIP cover-selection helpers remain unstaged in the working tree.

## User TODO

- (none so far)
