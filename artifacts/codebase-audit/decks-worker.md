# Decks correctness implementation
## State / evidence
- S1. **done: scoped fixes F1–F12 + parent-approved F13.** Review gate pending. 26 focused files / 361 tests green; final affected slices 6 files / 118 tests green; final advanced-search 5 tests green. Runs overlap; counts not additive.
- S2. **blocked: full typecheck**, untouched baseline only: `tests/fixtures/node-duel-worker-harness.ts:96`. Changed-file format/lint pass; final `svelte-check` reports same baseline error + four pre-existing warnings.
- S3. Worktree `/home/aron/Projects/ascencio/.tmp/codebase-audit-decks`; branch `audit/decks-correctness`; base `456551dc1cf8fc4e9fdb754095f3a8279f5b2c37`. No staged files, commits, pushes, subagents, real/user DB migration, shell/story/config/deps/vendor edits. Shared `node_modules` symlink retained.
## Assumptions / scope
- A1. Goal = surgical corrections + observable regressions, not architecture/product redesign. No new abstraction/dependency; F3 reuses existing four-acquisition image pools per rendered consumer. Overlapping valid leases may remain reusable across deck changes; obsolete leases abort/release.
- A2. Migration rows use stored plain records/arrays/primitives. Unsupported non-plain differing values fail comparison conservatively. Snapshot equality is not an inter-tab locking guarantee.
- A3. Existing explicit reload remains deliberate draft discard; ordinary navigation must first settle saves. Shell-owned unmount/navigation prevention remains outside ownership.
- A4. Graphify unavailable per task → direct source/test inspection. Read `AGENTS.md`, supplied audit, ADR-022, repo Impeccable skill/context/harden/craft-floor. Preserved incumbent Basilica Slate UI; no skill/config update.
- A5. C5 optional catalog optimization deferred: no measured win, no performance claim. Known unrelated duplicate-cover/naming drift left unchanged.
## Confirmed fixes
| ID | Implemented / regression | Source evidence | Test evidence |
|---|---|---|---|
| F1 | Full row equality before legacy deletion; production histories/preferences alone also prevent destructive copy. Divergent cards/name/history/preferences regressions. | `src/decks/deck-database.ts:142,292` | `tests/unit/decks/deck-database-migration.test.ts` |
| F2 | Navigation queues behind saves, refuses failed/conflicted draft replacement. Load/Return/create/import/duplicate guarded; explicit reload deliberate discard. Rejected route keeps recovery UI; controlled host echo preserved. | `src/deck-editor/deck-editor-store.ts:138–172,683; src/deck-editor/DeckEditorApp.svelte:118–220,345–390` | `tests/component/deck-editor/deck-route.test.ts; deck-autosave.test.ts; deck-save-conflict.test.ts` |
| F3 | Rendered catalog/zone tiles use existing createDeckLibraryImages bounded lease pools; source/filter/code/collapse/unmount invalidate obsolete leases. Required-only placeholders retained. | `src/deck-editor/components/CardCatalog.svelte:31–37,132,313; DeckZoneGrid.svelte:19–25,80,237; CardTile.svelte:12,40–43` | `tests/component/deck-editor/installed-catalog-boot.test.ts; editor-tile-images.test.ts (new)` |
| F4 | Ownership deficit styling separated from native disabled interaction; removal/inspection stay usable, controller add limits unchanged. | `src/deck-editor/components/DeckZoneGrid.svelte:244; CardTile.svelte:10–12,72,181–187` | `tests/component/deck-editor/deck-zone-grid.test.ts` |
| F5 | Legal cross-zone move carries dragged occurrence index; regression applies emitted command to duplicate-containing lists. | `src/deck-editor/components/DeckEditor.svelte:432–439` | `tests/component/deck-editor/pointer-drag.test.ts` |
| F6 | Restore joins import as exact-order history replacement; undo/redo preserve both orders. Drag reorder remains non-history. | `src/decks/deck-history.ts:36–41` | `tests/unit/decks/deck-history.test.ts; tests/component/deck-editor/deck-autosave.test.ts` |
| F7 | Mandatory marker enum disallows nullable Any; null normalized to any defensively. Active-marker rules remain valid. | `src/deck-editor/components/AdvancedSelectField.svelte:10,22–26; AdvancedCardSearch.svelte:349–359` | `tests/component/deck-editor/advanced-card-search.test.ts` |
| F8 | File reads invalidate prior preview, disable preview/commit during read, publish only current generation; text changes/unmount invalidate pending read. | `src/deck-editor/components/YdkImport.svelte:25–27,48–104` | `tests/component/deck-editor/ydk-import.test.ts` |
| F9 | Measured two-axis viewport clamp + constrained scrollable sheet; incumbent tokens/layout retained. | `src/deck-select/DeckTileMenu.svelte:40–59,129–137` | `tests/component/deck-select/deck-tile-menu.test.ts; actual Chromium scratch harness` |
| F10 | Arrow navigation starts from active seat key, not player selection. | `src/deck-select/DeckSelectScreen.svelte:565–574` | `tests/component/deck-select/seat-panel.test.ts` |
| F11 | Decklist row/child selectors include zone; known component/E2E consumers updated deliberately. | `src/deck-select/DecklistPanel.svelte:96–117` | `tests/component/deck-select/hover-previews.test.ts; seat-panel.test.ts; tests/component/deck-editor/deck-library-images.test.ts; deck-library.test.ts; e2e/deck-editor.spec.ts` |
| F12 | All resting preview loaders catch rejection with token checks; all tokens invalidated on destroy. Current/stale/unmounted library/player/opponent failures contained. | `src/deck-select/DeckSelectScreen.svelte:348–353,390–437` | `tests/component/deck-select/hover-previews.test.ts` |
| F13 | Accepted extra finding: Field option shared advanced-search-spell-property-field with label. Option-role selectors eliminate collision; full open-dialog uniqueness regression. | `src/deck-editor/components/AdvancedSelectField.svelte:15,23,30` | `tests/component/deck-editor/advanced-card-search.test.ts` |

## Validation notes
- V1. P1 red: equal-revision divergent rows wrongly returned `legacyDeleted: true`; failed/conflicted open reset `saveState` to `saved`. Green covers preservation + retry after refusal, pending failure, successful flush, route-null/other-deck/Load/Return. Fake IndexedDB only.
- V2. UI red: removal callback absent; legal move omitted `index`; restore history empty; import committed stale lists; menu x=358 overflow; opponent arrow emitted b instead of c; decklist selector count 15 unique / 20 rendered; resting previews leaked nine rejections. Final focused run contains none.
- V3. F7 red initially obscured by cold lazy-import timing; test preloads existing loader. Later fault-injection temporarily removed `nullable={false}` → exact test saw `["", "any", "all", "exact"]` instead of valid options. Restored original bytes in `finally`; final five tests green. F13 separate red names exact duplicate `advanced-search-spell-property-field`.
- V4. Regression caught controlled-host echo change during impl; fixed before handoff. Saved Return keeps editor if host swallows callback; created deck waits route echo. Final route suite included in 118-test delta green.
- V5. Initial ordinary Vitest invocation failed setup with `Error: Cannot find module '/@fs/home/aron/Projects/ascencio/node_modules/@testing-library/svelte/src/vitest.js'`. `NODE_OPTIONS='--preserve-symlinks'` / `--globals` attempts also failed. Final workaround below changes scratch config only. First combined lint/typecheck attempt timed out at 180s; explicit reruns produced final results in JSON.
- V6. Chromium, real Svelte menu + incumbent tokens: 1600×900 → `(1400,673,192,198)`; 390×844 → `(190,617,192,198)`; 390×120 → `(190,8,192,104)`; 180×320 → `(8,93,164,198)`. All document widths fit; all menu edges >=8px inside viewport; zero page errors. Isolated component evidence, not production E2E.
- V7. Final Svelte warnings unchanged: `src/story/shop/ShopSellScreen.svelte:240`, `tests/fixtures/BattleFacadeProbe.svelte:8–9`, `tests/fixtures/DeckEditorProbe.svelte:4`. Parent confirms baseline Worker fixture correction exists in root user work; isolated worktree deliberately leaves it untouched.

### Worktree validation config

Recreate `.tmp/vitest-worktree.config.ts` below to rerun exact Vitest commands with shared `node_modules`. Tracked config stays unchanged.

```ts
import config from "../vitest.config.ts";
import { mergeConfig } from "vitest/config";
export default mergeConfig(config, {
  resolve: { preserveSymlinks: true },
  server: { fs: { allow: ["/home/aron/Projects/ascencio"] } },
});
```

## Changed paths
- P1. `e2e/deck-editor.spec.ts`
- P2. `src/deck-editor/DeckEditorApp.svelte`
- P3. `src/deck-editor/components/AdvancedCardSearch.svelte`
- P4. `src/deck-editor/components/AdvancedSelectField.svelte`
- P5. `src/deck-editor/components/CardCatalog.svelte`
- P6. `src/deck-editor/components/CardTile.svelte`
- P7. `src/deck-editor/components/DeckEditor.svelte`
- P8. `src/deck-editor/components/DeckWorkspace.svelte`
- P9. `src/deck-editor/components/DeckZoneGrid.svelte`
- P10. `src/deck-editor/components/YdkImport.svelte`
- P11. `src/deck-editor/deck-editor-store.ts`
- P12. `src/deck-select/DeckSelectScreen.svelte`
- P13. `src/deck-select/DeckTileMenu.svelte`
- P14. `src/deck-select/DecklistPanel.svelte`
- P15. `src/decks/deck-database.ts`
- P16. `src/decks/deck-history.ts`
- P17. `tests/component/deck-editor/advanced-card-search.test.ts`
- P18. `tests/component/deck-editor/deck-autosave.test.ts`
- P19. `tests/component/deck-editor/deck-library-images.test.ts`
- P20. `tests/component/deck-editor/deck-library.test.ts`
- P21. `tests/component/deck-editor/deck-route.test.ts`
- P22. `tests/component/deck-editor/deck-save-conflict.test.ts`
- P23. `tests/component/deck-editor/deck-zone-grid.test.ts`
- P24. `tests/component/deck-editor/editor-tile-images.test.ts`
- P25. `tests/component/deck-editor/installed-catalog-boot.test.ts`
- P26. `tests/component/deck-editor/pointer-drag.test.ts`
- P27. `tests/component/deck-editor/ydk-import.test.ts`
- P28. `tests/component/deck-select/deck-tile-menu.test.ts`
- P29. `tests/component/deck-select/hover-previews.test.ts`
- P30. `tests/component/deck-select/seat-panel.test.ts`
- P31. `tests/unit/decks/deck-database-migration.test.ts`
- P32. `tests/unit/decks/deck-history.test.ts`

## Residuals / next action
- R1. Independent acceptance review required; writer frozen after report.
- R2. Full typecheck blocked by untouched node-duel-worker-harness.ts:96 unknown-to-Error baseline. Parent confirms root user correction exists; not copied into this isolated worktree.
- R3. Migration now verifies complete snapshot rows; inter-tab writes between snapshot verification and legacy deletion remain unaddressed. Existing malformed legacy-schema cleanup behavior unchanged. No live/user DB migration run.
- R4. Deck-local route changes and Return actions guarded. Shell/browser navigation that unmounts DeckEditorApp without calling these guards remains outside owned scope; no shell/story edits.
- R5. Production build/full E2E not run. Chromium evidence covers isolated real menu component, not full app shell/rotated-stage integration. e2e/deck-editor.spec.ts selector updated only.
- R6. C5 optimization deferred: no measured win; no query/sort optimization or benchmark claim.
- R7. Pre-existing untracked node_modules symlink preserved. Four existing Svelte warnings remain outside scope.
- R8. Next owner: fresh independent reviewer; inspect unstaged diff/new regression file, review migration and route concurrency, rerun affected checks after integration with root baseline fix. Writer makes no further writes after this report.

## Scratch cleanup
- C1. Removed `.tmp/final-delta.log`.
- C2. Removed `.tmp/final-format.log`.
- C3. Removed `.tmp/final-lint.log`.
- C4. Removed `.tmp/final-svelte-check.log`.
- C5. Removed `.tmp/final-typecheck.log`.
- C6. Removed `.tmp/focused-final.log`.
- C7. Removed `.tmp/format-2.log`.
- C8. Removed `.tmp/format-check-final.log`.
- C9. Removed `.tmp/format.log`.
- C10. Removed `.tmp/green-final-core.log`.
- C11. Removed `.tmp/green-ui-2.log`.
- C12. Removed `.tmp/green-ui.log`.
- C13. Removed `.tmp/lint-final.log`.
- C14. Removed `.tmp/lint.log`.
- C15. Removed `.tmp/menu-chromium.log`.
- C16. Removed `.tmp/menu-chromium.mjs`.
- C17. Removed `.tmp/menu-harness.html`.
- C18. Removed `.tmp/red-art-route.log`.
- C19. Removed `.tmp/red-route-echo.log`.
- C20. Removed `.tmp/red-selector.log`.
- C21. Removed `.tmp/red-ui.log`.
- C22. Removed `.tmp/selector-final.log`.
- C23. Removed `.tmp/svelte-check-final.log`.
- C24. Removed `.tmp/svelte-check.log`.
- C25. Removed `.tmp/testing-library-setup.ts`.
- C26. Removed `.tmp/typecheck-2.log`.
- C27. Removed `.tmp/typecheck.log`.
- C28. Removed `.tmp/vitest-worktree.config.ts`.
- C29. Removed `.tmp/red-marker-rule.log`.
- C30. Removed `.tmp/final-marker-rule.log`.

## Structured acceptance

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "F1-F12 fixed with regressions; parent-approved F13 option/label selector collision fixed. 15 scoped source files + 17 relevant test files; no story/shell/config/deps/vendor edits."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Red failure evidence, 26-file/361-test focused green, final affected-slice 6-file/118-test green, final F7 5-test green, actual Chromium bounds, clean changed-file format/lint, exact baseline typecheck blocker, no-staged-files check. Independent review still required."
    }
  ],
  "changedFiles": [
    "e2e/deck-editor.spec.ts",
    "src/deck-editor/DeckEditorApp.svelte",
    "src/deck-editor/components/AdvancedCardSearch.svelte",
    "src/deck-editor/components/AdvancedSelectField.svelte",
    "src/deck-editor/components/CardCatalog.svelte",
    "src/deck-editor/components/CardTile.svelte",
    "src/deck-editor/components/DeckEditor.svelte",
    "src/deck-editor/components/DeckWorkspace.svelte",
    "src/deck-editor/components/DeckZoneGrid.svelte",
    "src/deck-editor/components/YdkImport.svelte",
    "src/deck-editor/deck-editor-store.ts",
    "src/deck-select/DeckSelectScreen.svelte",
    "src/deck-select/DeckTileMenu.svelte",
    "src/deck-select/DecklistPanel.svelte",
    "src/decks/deck-database.ts",
    "src/decks/deck-history.ts",
    "tests/component/deck-editor/advanced-card-search.test.ts",
    "tests/component/deck-editor/deck-autosave.test.ts",
    "tests/component/deck-editor/deck-library-images.test.ts",
    "tests/component/deck-editor/deck-library.test.ts",
    "tests/component/deck-editor/deck-route.test.ts",
    "tests/component/deck-editor/deck-save-conflict.test.ts",
    "tests/component/deck-editor/deck-zone-grid.test.ts",
    "tests/component/deck-editor/editor-tile-images.test.ts",
    "tests/component/deck-editor/installed-catalog-boot.test.ts",
    "tests/component/deck-editor/pointer-drag.test.ts",
    "tests/component/deck-editor/ydk-import.test.ts",
    "tests/component/deck-select/deck-tile-menu.test.ts",
    "tests/component/deck-select/hover-previews.test.ts",
    "tests/component/deck-select/seat-panel.test.ts",
    "tests/unit/decks/deck-database-migration.test.ts",
    "tests/unit/decks/deck-history.test.ts"
  ],
  "testsAddedOrUpdated": [
    "e2e/deck-editor.spec.ts",
    "tests/component/deck-editor/advanced-card-search.test.ts",
    "tests/component/deck-editor/deck-autosave.test.ts",
    "tests/component/deck-editor/deck-library-images.test.ts",
    "tests/component/deck-editor/deck-library.test.ts",
    "tests/component/deck-editor/deck-route.test.ts",
    "tests/component/deck-editor/deck-save-conflict.test.ts",
    "tests/component/deck-editor/deck-zone-grid.test.ts",
    "tests/component/deck-editor/editor-tile-images.test.ts",
    "tests/component/deck-editor/installed-catalog-boot.test.ts",
    "tests/component/deck-editor/pointer-drag.test.ts",
    "tests/component/deck-editor/ydk-import.test.ts",
    "tests/component/deck-select/deck-tile-menu.test.ts",
    "tests/component/deck-select/hover-previews.test.ts",
    "tests/component/deck-select/seat-panel.test.ts",
    "tests/unit/decks/deck-database-migration.test.ts",
    "tests/unit/decks/deck-history.test.ts"
  ],
  "commandsRun": [
    {
      "command": "npx vitest run tests/unit/decks/deck-database-migration.test.ts tests/component/deck-editor/deck-autosave.test.ts tests/component/deck-editor/deck-save-conflict.test.ts tests/component/deck-editor/deck-route.test.ts --maxWorkers=2 --reporter=dot",
      "result": "failed",
      "summary": "Initial red: 6 failed, 26 passed; route suite blocked by symlinked Testing Library setup resolution."
    },
    {
      "command": "npx vitest run --config .tmp/vitest-worktree.config.ts tests/unit/decks/deck-history.test.ts tests/component/deck-editor/pointer-drag.test.ts tests/component/deck-editor/deck-zone-grid.test.ts tests/component/deck-editor/advanced-card-search.test.ts tests/component/deck-editor/ydk-import.test.ts tests/component/deck-select/deck-tile-menu.test.ts tests/component/deck-select/seat-panel.test.ts tests/component/deck-select/hover-previews.test.ts --maxWorkers=2 --reporter=dot",
      "result": "failed",
      "summary": "Initial UI red: 13 failed, 75 passed, 9 unhandled preview rejections. Two advanced-search failures were cold dynamic-import timing, corrected by test preloading."
    },
    {
      "command": "npx vitest run --config .tmp/vitest-worktree.config.ts tests/component/deck-editor/advanced-card-search.test.ts --maxWorkers=2 --reporter=dot -t 'offers only non-null'",
      "result": "failed",
      "summary": "Red F13: duplicate advanced-search-spell-property-field. Separate fault-injection red F7: temporarily omitted nullable={false}, observed unwanted empty option. Original bytes restored in finally."
    },
    {
      "command": "npx vitest run --config .tmp/vitest-worktree.config.ts tests/unit/decks/deck-database-migration.test.ts tests/unit/decks/deck-history.test.ts tests/unit/decks/deck-model.test.ts tests/unit/decks/deck-catalog.test.ts tests/component/deck-editor/deck-route.test.ts tests/component/deck-editor/deck-save-conflict.test.ts tests/component/deck-editor/deck-autosave.test.ts tests/component/deck-editor/installed-catalog-boot.test.ts tests/component/deck-editor/card-tile-art.test.ts tests/component/deck-editor/installed-image-teardown.test.ts tests/component/deck-editor/editor-tile-images.test.ts tests/component/deck-editor/deck-zone-grid.test.ts tests/component/deck-editor/deck-ownership-legality.test.ts tests/component/deck-editor/deck-click-move.test.ts tests/component/deck-editor/pointer-drag.test.ts tests/component/deck-editor/deck-reorder.test.ts tests/component/deck-editor/advanced-card-search.test.ts tests/component/deck-editor/ydk-import.test.ts tests/component/deck-editor/deck-library-images.test.ts tests/component/deck-editor/deck-library.test.ts tests/component/deck-select/deck-tile-menu.test.ts tests/component/deck-select/deck-select-screen.test.ts tests/component/deck-select/seat-panel.test.ts tests/component/deck-select/hover-previews.test.ts tests/unit/data-cy-coverage.test.ts tests/unit/domain-boundaries.test.ts --maxWorkers=2 --reporter=dot",
      "result": "passed",
      "summary": "26 files, 361 tests passed, 172.28s. Before final controlled-route-echo regression/F13 option-role adjustment; affected slices revalidated below."
    },
    {
      "command": "npx vitest run --config .tmp/vitest-worktree.config.ts tests/component/deck-editor/deck-route.test.ts tests/component/deck-editor/deck-autosave.test.ts tests/component/deck-editor/deck-save-conflict.test.ts tests/component/deck-editor/advanced-card-search.test.ts tests/unit/data-cy-coverage.test.ts tests/unit/domain-boundaries.test.ts --maxWorkers=2 --reporter=dot",
      "result": "passed",
      "summary": "Final affected slices: 6 files, 118 tests passed, 41.48s; includes controlled-route-echo regression and F13. Overlaps prior run."
    },
    {
      "command": "npx vitest run --config .tmp/vitest-worktree.config.ts tests/component/deck-editor/advanced-card-search.test.ts --maxWorkers=2 --reporter=dot",
      "result": "passed",
      "summary": "Final F7 fault-injection recovery: 1 file, 5 tests passed, 13.87s; original source restored exactly."
    },
    {
      "command": "node .tmp/menu-chromium.mjs",
      "result": "passed",
      "summary": "Actual DeckTileMenu mounted via scratch Vite/Svelte harness; Chromium passed 1600x900, 390x844, 390x120, 180x320; all menu edges >=8px inside viewport, no page errors."
    },
    {
      "command": "npx prettier --check $(git diff --name-only -- '*.ts' '*.svelte') tests/component/deck-editor/editor-tile-images.test.ts",
      "result": "passed",
      "summary": "All matched files use Prettier code style!"
    },
    {
      "command": "npx eslint $(git diff --name-only -- '*.ts' '*.svelte') tests/component/deck-editor/editor-tile-images.test.ts",
      "result": "passed",
      "summary": "Exit 0; no diagnostics."
    },
    {
      "command": "npm run typecheck",
      "result": "failed",
      "summary": "Untouched baseline: tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'."
    },
    {
      "command": "npx svelte-check --tsconfig ./tsconfig.json",
      "result": "failed",
      "summary": "1 baseline error, 4 pre-existing warnings, 4 files. No scoped source/test diagnostics remain."
    },
    {
      "command": "git diff --check; git diff --cached --quiet",
      "result": "passed",
      "summary": "Both exit 0. No staged files."
    }
  ],
  "validationOutput": [
    "Test Files 26 passed (26); Tests 361 passed (361)",
    "Final affected slices: Test Files 6 passed (6); Tests 118 passed (118)",
    "Final advanced search: Test Files 1 passed (1); Tests 5 passed (5)",
    "Chromium bounds: 1600x900 -> x1400 y673 w192 h198; 390x844 -> x190 y617 w192 h198; 390x120 -> x190 y8 w192 h104; 180x320 -> x8 y93 w164 h198; documentFits=true throughout",
    "FORMAT_EXIT=0 LINT_EXIT=0 DIFF_CHECK_EXIT=0 CACHED_DIFF_EXIT=0",
    "tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'.",
    "svelte-check found 1 error and 4 warnings in 4 files"
  ],
  "residualRisks": [
    "Independent acceptance review required; writer frozen after report.",
    "Full typecheck blocked by untouched node-duel-worker-harness.ts:96 unknown-to-Error baseline. Parent confirms root user correction exists; not copied into this isolated worktree.",
    "Migration now verifies complete snapshot rows; inter-tab writes between snapshot verification and legacy deletion remain unaddressed. Existing malformed legacy-schema cleanup behavior unchanged. No live/user DB migration run.",
    "Deck-local route changes and Return actions guarded. Shell/browser navigation that unmounts DeckEditorApp without calling these guards remains outside owned scope; no shell/story edits.",
    "Production build/full E2E not run. Chromium evidence covers isolated real menu component, not full app shell/rotated-stage integration. e2e/deck-editor.spec.ts selector updated only.",
    "C5 optimization deferred: no measured win; no query/sort optimization or benchmark claim.",
    "Pre-existing untracked node_modules symlink preserved. Four existing Svelte warnings remain outside scope."
  ],
  "noStagedFiles": true,
  "diffSummary": "32 code/test paths: complete migration row comparison, guarded draft navigation, bounded existing image leases, removable ownership deficits, occurrence-aware drag, order-sensitive restore, non-null marker enum, import read generations, clamped menu, active-seat keys, qualified selectors, contained preview rejection. 31 tracked modified paths + 1 new 128-line regression file; report separate.",
  "reviewFindings": [
    "F1-F12 implemented; independent reviewer gate pending",
    "F13 parent-approved: spell-property Field option collided with label data-cy; role-qualified option selectors now regression-tested",
    "Baseline typecheck blocker retained per parent steering"
  ],
  "manualNotes": "No staging/commits/pushes/subagents. No real DB migration. Impeccable context/harden/craft-floor read; incumbent design retained. Scratch configs/harness/logs removed after preserving evidence here. Shared node_modules symlink retained. No further writer edits after this report."
}
```
