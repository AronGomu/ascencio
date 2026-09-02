# Final Implementation Report — Deck Select Layout

Status: **done**

Base: `f540340571d7b919690edfebc3ddf61b9906c118`
Final implementation: `9660e53` plus final-report commit

## Ticket State List

| ID | State | Ticket commit | Main merge | Evidence |
| --- | --- | --- | --- | --- |
| T1 | DONE | `db2487f` | `18ccc8f` | Explicit `1` copy chips + title attrs; focused component suite green |
| T2 | DONE | `8c030db` | `25ae2fc` | One-line titlebar; deck-select/data-cy suite 110/110 |
| T3 | DONE | `39e8fb9` | `550a388` | Sticky colored footer + Create host wiring; deck-select/editor suite 317/317 |
| T4 | DONE | `a87cf43` | `9c4013e` | Twin seat pane, docked preview, pane Start; suite 118/118 + build green |
| T5 | DONE | `5821935` | `101b7a4` | Probe compaction + shared kebab actions; suite 126/126 + typecheck green |
| T6 | DONE | `3d1c973` | `2a20a6c` | Chromium layout spec 5/5 + durable manual checklist |
| Review repair | DONE | `9660e53` | direct corrective commit | 3 medium review findings fixed; independent re-review clean |

## Delivered

- D1. Shared deck-select title/tools merged into one line in both modes.
- D2. Duel-start pane uses player-left/opponent-right columns with docked independently scrolling decklists.
- D3. Hover preview uses active seat list; floating duel-start decklist removed.
- D4. Wide Start stays pane-bottom; narrow Start stays footer; one rendered instance.
- D5. Footer provides danger Return, colored manage actions, Open, green Create.
- D6. Overflow probes compact header/footer at measured 788px shipped width; 789px remains full.
- D7. Compact kebab supports enabled-item focus, Escape restoration, outside/action close.
- D8. Every decklist copies chip shows count, including `1`; names expose full `title`.
- D9. Chromium evidence lives in `e2e/deck-select-layout.spec.ts`.
- D10. Human checks live in `artifacts/manual_test_checklist.md`, section “Deck select — Twin Columns”.

## Validation

- V1. `npx playwright test e2e/deck-select-layout.spec.ts` → 5 passed.
- V2. `npx vitest run tests/component/deck-select tests/unit/data-cy-coverage.test.ts` → 129 passed.
- V3. `npm run check:headless` → format, lint, typecheck, 23 legacy, 1809 unit, 40 integration, vendor/assets/snapshot verification passed.
- V4. `npm run build` after T4 → build verification passed; budgets: shell 96748, battle 351889, deck-editor 144733, story 136204 bytes.
- V5. Runtime Chromium Start click → `duel-field` visible.
- V6. Independent final repair review → no blocker; M1–M3 reproduced, fixed, rechecked.

## Review Findings Resolved

- F1. Removed pane-only Start from footer probe; corrected false 903px compaction to measured 789px/full, 788px/compact.
- F2. Compact menu now focuses first enabled action; non-deletable bundled deck Escape closes menu and restores kebab focus.
- F3. Filtering hovered tile now clears preview and invalidates pending resolver result.

## Assumptions

### A1 — Shared bars

Titlebar/footer changes apply to duel-start and library because markup is shared. Library business rules remain unchanged.

### A2 — Back origin

`backLabel` names origin. Free play/library use `Menu`; story pre-battle uses `Map` because its return handler routes there.

### A3 — Create ownership

Create raises host callback only. Free play routes to deck library; deck library owns create dialog; story omits Create.

### A4 — Responsive rules

Existing 62rem pane collapse and <40rem phone layout remain. Probe compaction handles intermediate width from actual bar overflow.

### A5 — Seat order

Player-first DOM chosen so reading order matches visual left-to-right order.

### A6 — Review fallback

Configured `reviewer-code` lacked repo tools and returned blocked without findings. Tool-enabled builtin reviewer replaced it, found three medium issues, then independently approved repairs.

## User TODO

- U1. Run unchecked “Deck select — Twin Columns” section in `artifacts/manual_test_checklist.md` for human visual/interaction confirmation.

## Residual Risks

- R1. Full multi-spec browser suite was not rerun; focused Chromium deck-select spec plus full headless suite passed.
- R2. Playwright host-requirements validation was skipped by existing `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS` environment setting.
- R3. Two pre-existing Svelte warnings remain outside scope: `src/deck-editor/components/CardCatalog.svelte:320`, `src/story/shop/ShopSellScreen.svelte:240`.
- R4. Unrelated untracked plans, prototypes, ADRs, and PDDRs present before/during this run remain untouched.
