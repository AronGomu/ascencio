# Decks independent review

## State
- S1. **APPROVED — scoped diff after corrective fixes.** Final independent run: **32 test files / 400 tests passed**. Changed-file lint, format, diff checks passed. Integration acceptance still requires known root fixture correction + root checks.
- S2. Reviewed actual 31 tracked modified files + new `tests/component/deck-editor/editor-tile-images.test.ts`; worker claims not treated as independent evidence. Base: `456551dc1cf8fc4e9fdb754095f3a8279f5b2c37`.
- S3. Reviewer changed five existing paths: two production files, three test files. No stage/commit/push/subagents; no shell/story/config/deps/vendor/root-cache-source edits. Shared `node_modules` symlink preserved.

## Review
- F1. **Fixed · P2 · controlled Load regression.** `src/deck-editor/DeckEditorApp.svelte:389–393`: opening controller deck before host route echo removed current editor; swallowed callback left permanent `Opening deck…` skeleton. Actual `DeckEditorApp` regression failed with `AssertionError: expected undefined to be 'Current' // Object.is equality`. Load now awaits `canLeave()`, emits `onnavigate`, leaves controller opening to echoed prop. `tests/component/deck-editor/deck-route.test.ts:191` verifies retained current editor, absent skeleton, successful echoed navigation. Existing failed-draft Load/Return/route tests remain intact.
- F2. **Fixed · P1 · pending-transition save gap remaining in F2.** `src/deck-editor/deck-editor-store.ts:203–259,575–625`: create/import/duplicate awaited queue snapshot without occupying queue. Deferred `createAndOpen` permitted old-deck mutation/save during transition; save failure could then be replaced by successful creation state. Three production-controller regressions failed with `AssertionError: expected "save" to not be called at all, but actually been called 1 times`. Complete transitions now occupy `#enqueue`; stale old-deck edits fail existing identity guard; leave checks wait. Private operation fns preserve existing bodies, in-flight guard, failure paths.
- F3. **Correct · no introduced queue self-deadlock observed.** Queued creation recovery calls private `#openDeck`, not queued public `openDeck` (`src/deck-editor/deck-editor-store.ts:242`). Added committed-create/list-failure recovery followed by library navigation + another create (`tests/component/deck-editor/deck-autosave.test.ts:399`). Six further cases verify create/import/duplicate ordered after pending success/failure save, before later navigation; failed drafts retain retry (`:234–303`). Three pending-transition cases verify no concurrent old-deck save, no early leave acknowledgment (`:306–361`). Final suite green.
- F4. **Correct · migration preservation.** `src/decks/deck-database.ts:142,290–336` compares keyed complete rows recursively, preserves array order, ignores object-key insertion order; histories/preferences alone prevent copy-over. Existing divergent-card/name/history/preference tests passed. Reviewer added history-only production preservation (`tests/unit/decks/deck-database-migration.test.ts:279`) + equivalent-row reordered-key acceptance (`:304`). All use fake IndexedDB; no user DB touched.
- F5. **Correct · bounded optional art.** `src/deck-editor/components/CardCatalog.svelte:31–37,132`, `DeckZoneGrid.svelte:19–25,80`, `CardTile.svelte:40–43`; production wiring through `DeckEditor.svelte:820,857` / `DeckWorkspace.svelte:134,163,192`. Existing `createDeckLibraryImages` limits each consumer to four active acquisitions, deduplicates codes, aborts obsolete reqs, releases stale/unmounted leases (`src/deck-editor/cards/deck-library-images.ts:32–68,90–125`). New `editor-tile-images.test.ts` independently read + executed: filter/source/code/collapse/unmount, duplicate codes, rejection. Installed-catalog boot test exercises actual app wiring. Bound is **per consumer**, not app-global.
- F6. **Correct · repair interactions/history.** Ownership deficit uses styling rather than native disabled state (`src/deck-editor/components/DeckZoneGrid.svelte:244`, `CardTile.svelte:71`); removal regression applies actual command + ownership validation. Cross-zone drag carries occurrence index (`DeckEditor.svelte:438`), tested against interleaved duplicates. Restore joins import as exact-order history replacement (`src/decks/deck-history.ts:36–41`); actual controller persistence/undo/redo regression passed.
- F7. **Correct · selectors/import races.** Mandatory marker rule has no null option (`src/deck-editor/components/AdvancedCardSearch.svelte:351`); option-role selectors avoid Field-label collision (`AdvancedSelectField.svelte:23,30`). `DecklistPanel.svelte:96–117` qualifies repeated card selectors by zone; affected component/E2E consumers updated, assertions retained. `YdkImport.svelte:48–104` invalidates previews immediately, blocks commit during reads, suppresses stale file/text/unmount completions. Focused tests passed.
- F8. **Correct · selection/menu/rejections.** `src/deck-select/DeckTileMenu.svelte:40–59,129–137` clamps both axes with scroll-constrained bounds; unit regressions passed. Active-seat arrow origin uses `activeKey` (`DeckSelectScreen.svelte:568`); current/stale/unmounted resting-preview rejections caught with generation checks (`:348–353,390–437`). Corresponding component tests passed.
- F9. **Blocker · root validation only, unchanged baseline.** `tests/fixtures/node-duel-worker-harness.ts:96`: `npm run typecheck` fails with `tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'.` File unchanged in worktree. User identified root correction; deliberately not duplicated here. Exact next action: parent integrates reviewed deck paths with root-owned fixture correction, runs `npm run typecheck`.

## Assumptions
- A1. Review scope = existing decks correctness slice; targeted safety fixes, no optional perf/refactor work. Source changes limited to verified F1/F2.
- A2. Mutations issued against old deck during pending context transition must not migrate onto new deck; existing captured-context/deck-id checks define rejection behavior.
- A3. Migration equality targets stored plain records, ordinary card/history arrays, primitives. No inter-tab locking claim.
- A4. `graphify query "deck database migration save navigation queue image leases"` failed: `/bin/bash: line 1: graphify: command not found`. Direct diff/source/test inspection used.

## Validation
- V1. Red Load: one failed targeted actual-app test. Red pending transitions: three failed production-controller tests. No whole-file test weakening, deleted assertions, or source fault-injection used.
- V2. First corrective route/autosave/conflict run: **3 files / 31 tests passed**. Broader run: **32 files / 394 tests passed**. Final run after six extra pending-save ordering cases: **32 files / 400 tests passed**, 129.68s. Counts overlap, not additive.
- V3. Final checks: `FORMAT_EXIT=0`, `LINT_EXIT=0`, `DIFF_EXIT=0`, `STAGED_EXIT=0`.
- V4. `npx svelte-check --tsconfig ./tsconfig.json`: `svelte-check found 1 error and 4 warnings in 4 files`. Error = F9. Warnings unchanged: `src/story/shop/ShopSellScreen.svelte:240`, `tests/fixtures/BattleFacadeProbe.svelte:8–9`, `tests/fixtures/DeckEditorProbe.svelte:4`.

### Shared node_modules workaround

Tracked config untouched. Scratch config `.tmp/vitest-review-decks.config.ts`:

```ts
import config from "../vitest.config.ts";
import { mergeConfig } from "vitest/config";
export default mergeConfig(config, {
  cacheDir: ".tmp/vite-cache-decks-review-astra",
  resolve: { preserveSymlinks: true },
  server: { fs: { allow: ["/home/aron/Projects/ascencio"] } },
});
```

Unique worktree-local cache prevents shared-cache collisions. Workaround matches worker's symlink-resolution constraint; reviewer runs succeeded with it.

## Files touched by reviewer
- P1. `src/deck-editor/DeckEditorApp.svelte` — guarded controlled Load.
- P2. `src/deck-editor/deck-editor-store.ts` — queued create/import/duplicate, nonqueued internal recovery.
- P3. `tests/component/deck-editor/deck-route.test.ts` — swallowed/delayed Load echo regression.
- P4. `tests/component/deck-editor/deck-autosave.test.ts` — nine pending-transition/save order cases, committed-create recovery.
- P5. `tests/unit/decks/deck-database-migration.test.ts` — history-only target, object-key order regressions.
- P6. This report; ignored scratch config/cache above. Entire inherited review scope remains 32 code/test paths; reviewer added no new permanent test file.

## Residual risks / exact next actions
- R1. No unresolved blocker in reviewed scoped diff. Parent integration still owns F9 correction, root checks, root cache-source corrective worker changes. No whole-codebase approval implied.
- R2. Existing migration TOCTOU remains: inter-tab writes between snapshot reads, verification, deletion are not locked. Existing malformed legacy-schema cleanup behavior unchanged. No real migration executed.
- R3. Shell/browser unmount bypassing deck-local guards remains outside ownership. `deleteDeck`, explicit recovery-copy paths retain existing semantics; no blanket guarantee for every host action.
- R4. Browser/build gates not independently run. Worker report contains isolated Chromium menu evidence, not reviewer-run production E2E. Parent runs production build/E2E after integration; rotated shell-stage behavior remains unverified here. Port 4515 unused.
- R5. Ignored `.tmp/vitest-review-decks.config.ts` + `.tmp/vite-cache-decks-review-astra/` retained: reviewer tools permit read-only bash, expose no deletion tool. Parent removes those exact reviewer-owned scratch paths after any rerun. No scratch/user file deleted; shared `node_modules` symlink retained.
- R6. Writer frozen after report. No further source/report writes.

## Structured acceptance

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Independent actual 32-path review; P2 controlled Load regression and P1 pending-transition queue gap reproduced then fixed with production-seam tests. Concrete source/test locations in F1-F9; residuals R1-R6. Final 32-file/400-test focused run passed. Scoped approval; unchanged root fixture blocks whole-repo typecheck."
    }
  ],
  "changedFiles": [
    "src/deck-editor/DeckEditorApp.svelte",
    "src/deck-editor/deck-editor-store.ts",
    "tests/component/deck-editor/deck-route.test.ts",
    "tests/component/deck-editor/deck-autosave.test.ts",
    "tests/unit/decks/deck-database-migration.test.ts",
    ".tmp/vitest-review-decks.config.ts",
    "/home/aron/Projects/ascencio/artifacts/codebase-audit/decks-review.md"
  ],
  "testsAddedOrUpdated": [
    "tests/component/deck-editor/deck-route.test.ts",
    "tests/component/deck-editor/deck-autosave.test.ts",
    "tests/unit/decks/deck-database-migration.test.ts"
  ],
  "commandsRun": [
    {
      "command": "graphify query \"deck database migration save navigation queue image leases\"",
      "result": "failed",
      "summary": "graphify: command not found; direct source/diff/test fallback."
    },
    {
      "command": "npx vitest run --config .tmp/vitest-review-decks.config.ts tests/component/deck-editor/deck-route.test.ts -t 'host echoes Load' --maxWorkers=2 --reporter=dot",
      "result": "failed",
      "summary": "Red: 1 failed, 11 skipped; current editor disappeared before host echo."
    },
    {
      "command": "npx vitest run --config .tmp/vitest-review-decks.config.ts tests/component/deck-editor/deck-autosave.test.ts -t 'serializes pending' --maxWorkers=2 --reporter=dot",
      "result": "failed",
      "summary": "Red: 3 failed, 13 skipped; old-deck save ran during pending create/import/duplicate."
    },
    {
      "command": "npx vitest run --config .tmp/vitest-review-decks.config.ts tests/component/deck-editor/deck-route.test.ts tests/component/deck-editor/deck-autosave.test.ts tests/component/deck-editor/deck-save-conflict.test.ts --maxWorkers=2 --reporter=dot",
      "result": "passed",
      "summary": "Initial corrective green: 3 files, 31 tests."
    },
    {
      "command": "npx vitest run --config .tmp/vitest-review-decks.config.ts tests/unit/decks/deck-database-migration.test.ts tests/unit/decks/deck-history.test.ts tests/unit/decks/deck-model.test.ts tests/unit/decks/deck-catalog.test.ts tests/component/deck-editor/deck-route.test.ts tests/component/deck-editor/deck-save-conflict.test.ts tests/component/deck-editor/deck-autosave.test.ts tests/component/deck-editor/deck-create-failure.test.ts tests/component/deck-editor/deck-delete-failure.test.ts tests/component/deck-editor/load-deck-dialog.test.ts tests/component/deck-editor/deck-library-rename.test.ts tests/component/deck-editor/owned-only-catalog.test.ts tests/component/deck-editor/deck-entry.test.ts tests/component/deck-editor/installed-catalog-boot.test.ts tests/component/deck-editor/card-tile-art.test.ts tests/component/deck-editor/installed-image-teardown.test.ts tests/component/deck-editor/editor-tile-images.test.ts tests/component/deck-editor/deck-zone-grid.test.ts tests/component/deck-editor/deck-ownership-legality.test.ts tests/component/deck-editor/deck-click-move.test.ts tests/component/deck-editor/pointer-drag.test.ts tests/component/deck-editor/deck-reorder.test.ts tests/component/deck-editor/advanced-card-search.test.ts tests/component/deck-editor/ydk-import.test.ts tests/component/deck-editor/deck-library-images.test.ts tests/component/deck-editor/deck-library.test.ts tests/component/deck-select/deck-tile-menu.test.ts tests/component/deck-select/deck-select-screen.test.ts tests/component/deck-select/seat-panel.test.ts tests/component/deck-select/hover-previews.test.ts tests/unit/data-cy-coverage.test.ts tests/unit/domain-boundaries.test.ts --maxWorkers=2 --reporter=dot",
      "result": "passed",
      "summary": "Final: 32 files, 400 tests passed, 129.68s. Earlier same selection: 394 tests before six extra ordering cases."
    },
    {
      "command": "npx prettier --check $(git diff --name-only -- '*.ts' '*.svelte') tests/component/deck-editor/editor-tile-images.test.ts",
      "result": "passed",
      "summary": "Final All matched files use Prettier code style! Earlier reviewer-added route assertion wrapping corrected surgically."
    },
    {
      "command": "npx eslint $(git diff --name-only -- '*.ts' '*.svelte') tests/component/deck-editor/editor-tile-images.test.ts",
      "result": "passed",
      "summary": "LINT_EXIT=0; no diagnostics."
    },
    {
      "command": "npm run typecheck",
      "result": "failed",
      "summary": "Known unchanged tests/fixtures/node-duel-worker-harness.ts(96,33) TS2345 unknown-to-Error error."
    },
    {
      "command": "npx svelte-check --tsconfig ./tsconfig.json",
      "result": "failed",
      "summary": "Same baseline error; four pre-existing warnings; no scoped diagnostics."
    },
    {
      "command": "git diff --check; git diff --cached --quiet",
      "result": "passed",
      "summary": "DIFF_EXIT=0 STAGED_EXIT=0."
    },
    {
      "command": "npm run build; npm run test:e2e",
      "result": "not-run",
      "summary": "Parent integration gates; no independent Chromium run."
    }
  ],
  "validationOutput": [
    "Red Load: AssertionError: expected undefined to be 'Current' // Object.is equality",
    "Red transitions: AssertionError: expected \"save\" to not be called at all, but actually been called 1 times",
    "Test Files 32 passed (32); Tests 400 passed (400)",
    "FORMAT_EXIT=0 LINT_EXIT=0 DIFF_EXIT=0 STAGED_EXIT=0",
    "tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'.",
    "svelte-check found 1 error and 4 warnings in 4 files"
  ],
  "residualRisks": [
    "Known root-owned fixture correction required before whole-repo typecheck; left untouched.",
    "Migration inter-tab TOCTOU and malformed legacy-schema cleanup remain unchanged; no live DB migration.",
    "Shell/browser unmount bypasses deck-local guards; existing delete/recovery-copy semantics not redesigned.",
    "Production build/E2E and rotated shell-stage menu integration not independently run; worker Chromium evidence only isolated component.",
    "Ignored reviewer scratch config/cache retained due read-only bash/no deletion tool; exact cleanup paths in R5. Shared node_modules symlink preserved."
  ],
  "noStagedFiles": true,
  "diffSummary": "APPROVED scoped after fixes. Reviewer delta: guarded controlled Load; full create/import/duplicate queue occupancy with internal recovery avoiding deadlock; 13 added regression cases across three existing test files. Inherited total scope remains 32 code/test paths. No forbidden scope edits.",
  "reviewFindings": [
    "Fixed P2: src/deck-editor/DeckEditorApp.svelte:389 - Load no longer discards rendered editor before host route echo.",
    "Fixed P1: src/deck-editor/deck-editor-store.ts:203,253,575 - complete create/import/duplicate transitions now serialize against saves/navigation; no concurrent failed draft replacement.",
    "Correct: src/deck-editor/deck-editor-store.ts:242 - private recovery open prevents nested queue deadlock; actual post-commit failure test passes.",
    "Correct: src/decks/deck-database.ts:142,290 - complete-row equality, history-only target preservation verified through fake IndexedDB.",
    "No unresolved scoped blockers. Root validation blocker: tests/fixtures/node-duel-worker-harness.ts:96, unchanged known baseline."
  ],
  "manualNotes": "Files touched lists reviewer delta only, not inherited worker edits. Parent integrates root fixture/cache-source corrections separately, reruns root gates. Shared node_modules workaround uses unique worktree-local cacheDir. No staging/commit/push/subagents/live DB/Chromium activity. No further writes after report."
}
```
