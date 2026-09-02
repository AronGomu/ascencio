# Implementation report — decklist row art + frame color

Plan: `artifacts/PLAN_2026_09_02_decklist_row_art.md` (committed before retirement; recover via `git show <sha>:artifacts/PLAN_2026_09_02_decklist_row_art.md`).

## Ticket State List

| Ticket | Goal | State | Commit |
| ------ | ---- | ----- | ------ |
| T1 | `cardFrameOf` classifier + `CARD_FRAME_COLORS` palette | NOT STARTED | — |
| T2 | `DecklistRow` `frame`/`artUrl`; panel + three hosts | NOT STARTED | — |
| T3 | Chromium evidence, build gates, manual checklist | NOT STARTED | — |

## Assumptions

### A1 — sequential in-place execution instead of worktrees

Plan was authored against the dirty working tree, not HEAD: `src/decks/deck-cover.ts` (ticket dependency, `croppedCardImageUrl`) is untracked, and host files (`DeckSelectScreen.svelte`, `DeckLibrary.svelte`, `FreePlayMatchSetup.svelte`, …) are modified vs `53391aa`. A worktree checked out from HEAD would lack the prerequisites. Ticket flow is also a strict chain (T1→T2→T3), so worktrees add no parallelism. Impl agents therefore run sequentially in the main working directory; orchestrator commits only ticket-intentional paths per ticket.

### A2 — pre-existing dirty files stay uncommitted

The ~96 modified/untracked files predating this round are owner work in progress. They are left byte-identical and unstaged, except files a ticket explicitly changes.

### A3 — push to main authorized by skill

`make-parallel-aron` mandates commit + push per ticket; treated as explicit authorization to push `main` to `origin`.

## User TODO

- (none so far)
