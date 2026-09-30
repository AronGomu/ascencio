# PR #65: fix(deck-select): navigate from active seat deck

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/65  
Head: `fc813d96b3e36ab0a297e689c0c32a0ce6bc0c56`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 fc813d96b3e36ab0a297e689c0c32a0ce6bc0c56` |
| PR-targeted tests | Pass | `validation-65.json`, `retry-65.log` |
| Changed-file ESLint / Prettier | Pass | `validation-65.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-65.json`, `ci-65.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

SHA: `fc813d96b3e36ab0a297e689c0c32a0ce6bc0c56`

- P65-1 Correct: arrow navigation anchors to seat-aware `activeKey`, already used by narrow pinning plus seat highlight. Opponent mode now starts at `opponentDeck`; player/library behavior remains `selectedKey`. Evidence: `src/deck-select/DeckSelectScreen.svelte:195-210`, `src/deck-select/DeckSelectScreen.svelte:553-561`.

```diff
-    const index = legal.findIndex((candidate) => candidate.key === selectedKey);
+    const index = legal.findIndex((candidate) => candidate.key === activeKey);
```

- P65-2 Correct: Free Play host updates correct seat synchronously (`playerKey` or `opponentKey`) and derives `opponentDeck` from updated key. Evidence: `src/shell/screens/FreePlayMatchSetup.svelte:118-123`, `src/shell/screens/FreePlayMatchSetup.svelte:256-263`, host wiring `src/shell/screens/FreePlayMatchSetup.svelte:482-509`. Regression checks opponent `ArrowUp` at `tests/component/deck-select/deck-select-screen.test.ts:462-480`.
- P65-3 Test cmd: `npx vitest run tests/component/deck-select/deck-select-screen.test.ts tests/component/deck-select/hover-previews.test.ts`.
- P65-4 Residual risk: regression covers opponent `ArrowUp`; `ArrowDown`, filtered-out active deck, and range ends reuse unchanged shared fallback/bounds logic at `src/deck-select/DeckSelectScreen.svelte:553-560`.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
