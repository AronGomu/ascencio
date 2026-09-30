# PR #43: fix(decks): preserve manual order through membership history

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/43  
Head: `f7e88e4b56c00d6ff8678af0e8e390a2d57d32b8`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 f7e88e4b56c00d6ff8678af0e8e390a2d57d32b8` |
| PR-targeted tests | Pass | `validation-43.json`, `retry-43.log` |
| Changed-file ESLint / Prettier | Pass | `validation-43.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-43.json`, `ci-43.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

SHA: `f7e88e4b56c00d6ff8678af0e8e390a2d57d32b8`

- P43-1 Correct: undo/redo now receive actual current deck order through both production callers. Evidence: `src/deck-editor/deck-editor-store.ts:422-467`.

```diff
-      const result = undoDeckUpdate(current.history);
+      const result = undoDeckUpdate(current.history, current.deck);
...
-      const result = redoDeckUpdate(current.history);
+      const result = redoDeckUpdate(current.history, current.deck);
```

- P43-2 Correct: membership edits filter current zone by target multiplicity, preserving survivor order, then insert missing copies deterministically. Duplicate counts use occurrence counts, not set membership. Evidence: `src/decks/deck-history.ts:119-159`, duplicate regression `tests/unit/decks/deck-history.test.ts:126-144`.

```diff
+  const restored = current.filter((code) => {
+    const retained = retainedCounts.get(code) ?? 0;
+    if (retained >= (targetCounts.get(code) ?? 0)) return false;
+    retainedCounts.set(code, retained + 1);
+    return true;
+  });
```

- P43-3 Correct: rebasing moved history entry around actual before/after lists preserves round trips across unrecorded reorder. Exact snapshot reasons remain exact for `import`, `restore`, `sort`, matching ADR-037/ADR-070. Evidence: `src/decks/deck-history.ts:75-115`, `src/decks/deck-history.ts:119-130`, `src/decks/deck-history.ts:161-177`, `docs/ADR/037_ADR_manual_deck_order_position_blind_history.md:15-18`, `docs/ADR/070_ADR_explicit_sorts_are_undoable.md:14-26`.
- P43-4 Correct: repository continuity validation compares card multisets, so rebased order does not invalidate stored history. Evidence: `src/decks/indexeddb-deck-repository.ts:549-655`. Controller/IndexedDB coverage exercises add, remove, move across zones at `tests/component/deck-editor/deck-history-order.test.ts:51-139`.
- P43-5 Test cmd: `npx vitest run tests/unit/decks/deck-history.test.ts tests/unit/decks/canonical-sort-matrix.test.ts tests/component/deck-editor/deck-history-order.test.ts tests/component/deck-editor/keyboard-shortcuts.test.ts`.
- P43-6 Residual risk: no randomized long-chain duplicate/multi-zone undo-redo property test. Deterministic unit plus repository-backed component cases cover changed invariants; deck-size bounds keep splice cost negligible.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
