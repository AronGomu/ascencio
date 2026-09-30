# PR #60: fix(deck-editor): isolate modal keys from background shortcuts

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/60  
Head: `d4f966cf322b0216a5d3bfb785501efeac1afdd8`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 d4f966cf322b0216a5d3bfb785501efeac1afdd8` |
| PR-targeted tests | Pass | `validation-60.json`, `retry-60.log` |
| Changed-file ESLint / Prettier | Pass | `validation-60.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-60.json`, `ci-60.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

SHA: `d4f966cf322b0216a5d3bfb785501efeac1afdd8`

- P60-1 Correct: modal-root bubble handler now stops key events before deck editor's window-level bubble shortcut. Native input defaults remain intact because only Escape/Tab call `preventDefault`. Evidence: `src/deck-editor/focus-trap.ts:4-30`, background handler `src/deck-editor/components/DeckEditor.svelte:565-598`.

```diff
 export function handleModalKeydown(
   event: KeyboardEvent,
   close: () => void,
 ): void {
+  event.stopPropagation();
```

- P60-2 Correct: all deck-editor consumers attach helper at dialog/menu root, covering Advanced Search, delete, create, load, tap target, YDK export/import. Evidence: `src/deck-editor/components/AdvancedCardSearch.svelte:126-137`, `src/deck-editor/components/DeckEditor.svelte:914-922`, `src/deck-editor/components/DeckLibrary.svelte:275-292`, `src/deck-editor/components/LoadDeckDialog.svelte:25-34`, `src/deck-editor/components/TapTargetMenu.svelte:19-28`, `src/deck-editor/components/YdkExport.svelte:50-58`, `src/deck-editor/components/YdkImport.svelte:113-125`.
- P60-3 Test cmd: `npx vitest run tests/unit/deck-editor/focus-trap.test.ts tests/component/deck-editor/keyboard-shortcuts.test.ts tests/component/deck-editor/delete-dialog-focus.test.ts`.
- P60-4 Residual risk: bubble-phase isolation cannot stop hypothetical future capture-phase global shortcuts. Current production shortcut is bubble-phase `svelte:window`; no current defect.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
