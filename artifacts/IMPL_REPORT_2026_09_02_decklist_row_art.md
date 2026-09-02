# Final implementation report — decklist row art + frame color

State: **done**. All tickets implemented, committed, pushed to `origin/main`.

Plan anchor: `124e824` (`git show 124e824:artifacts/PLAN_2026_09_02_decklist_row_art.md`).

## Ticket State List

| Ticket | Outcome | State | Commit |
| ------ | ------- | ----- | ------ |
| T1 | `cardFrameOf(rawType)` + nine-value `CARD_FRAME_COLORS` | DONE | `3023162` |
| T2 | Required `frame`/`artUrl`, grouped art rows, three host resolvers | DONE | `518c911` |
| T3 | Chromium assertion, build evidence, checklist + glossary | DONE | `461b372` |

## Evidence

| Gate | Result |
| ---- | ------ |
| `npx vitest run tests/unit/card-frame.test.ts` | 1 file passed; 11 tests passed |
| `npm run test:component` | 112 files passed; 1059 tests passed |
| `npm run check:headless` | exit 0; snapshot/assets checks status `ok` |
| `npx playwright test e2e/deck-editor.spec.ts --grep "deck library shows art rows with frame and copy count"` | Chromium 1 passed |
| `npm run build:verify` | status `ok`; shell 96,733 B; battle 351,936 B; deck-editor 142,331 B; story 133,689 B |
| TDD red evidence | T1 missing-module red; T2 five expected assertion/compile failures; T3 mutated-selector failure |

## Files touched

| Area | Paths |
| ---- | ----- |
| Classifier | `src/decks/card-frame.ts`, `tests/unit/card-frame.test.ts` |
| Contract/panel | `src/deck-select/deck-select-contracts.ts`, `src/deck-select/DecklistPanel.svelte` |
| Art URL | `src/decks/deck-cover.ts` |
| Hosts | `src/deck-editor/components/DeckLibrary.svelte`, `src/story/screens/PreBattleScreen.svelte`, `src/shell/screens/FreePlayMatchSetup.svelte` |
| Component tests | `tests/component/deck-select/hover-previews.test.ts`, `tests/component/deck-editor/deck-library.test.ts`, `tests/component/story/pre-battle-deck-picker.test.ts`, `tests/component/FreePlayMatchSetup.test.ts` |
| Browser evidence | `e2e/deck-editor.spec.ts` |
| Durable docs | `artifacts/manual_test_checklist.md`, `docs/GLOSSARY.md` |

## Assumptions

### A1 — sequential in-place execution

Plan depended on dirty-tree prerequisite `src/decks/deck-cover.ts`; tickets formed strict T1→T2→T3 chain. Clean HEAD worktrees lacked prerequisite, offered no parallelism. Impl agents ran sequentially in main cwd.

### A2 — owner WIP preserved

Pre-existing modified/untracked files stayed unstaged. Ticket hunks in already-modified host/docs files were staged surgically. No stash/reset/clean used.

### A3 — push authorization

`make-parallel-aron` required commit + push per ticket; commits pushed directly to `origin/main`.

### A4 — minimal prerequisite commit

Untracked `src/decks/deck-cover.ts` included unrelated owner-WIP cover helpers. Commit `518c911` contains only ticket-required `croppedCardImageUrl`; extra helpers remain unstaged locally.

## Residual risks

R1. Existing Svelte warning remains: `src/deck-editor/components/CardCatalog.svelte:320:6` — ``<div>` with a mouseleave handler must have an ARIA role``. Pre-existing, out of scope.

R2. Human checklist steps remain unchecked until owner performs manual checks; automated Chromium gate proves docked deck-editor row only.

R3. Working tree remains dirty from owner WIP by design. No unrelated changes included in ticket commits.

## User TODO

U1. Run new `Decklist row art` section in `artifacts/manual_test_checklist.md` when manual coverage desired.

## Cleanup

C1. Retired plan index, ticket directory, prototype spec after preserving plan at `124e824`.

C2. Removed orchestrator `.tmp` patches/snapshots and impl output artifact.
