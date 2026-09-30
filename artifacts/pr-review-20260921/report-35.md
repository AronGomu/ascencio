# PR #35: fix(story): clear filtered previews without rescanning on hover

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/35  
Head: `bd441e6141ef9bcda850a6c5dbe99cc919a083f2`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 bd441e6141ef9bcda850a6c5dbe99cc919a083f2` |
| PR-targeted tests | Pass | `validation-35.json`, `retry-35.log` |
| Changed-file ESLint / Prettier | Pass | `validation-35.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-35.json`, `ci-35.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

SHA: `bd441e6141ef9bcda850a6c5dbe99cc919a083f2`

- P35-1 Correct: membership index rebuilds only when `listed` changes; selection changes use `Set.has`, avoiding catalog scan. Selection clears when catalog, ownership, or Show All removes code. Evidence: `src/story/collection/CollectionScreen.svelte:60-75`.

```diff
+  $: listedCodes = new Set(listed.map(({ code }) => code));
+  $: if (selected !== null && !listedCodes.has(selected.code)) selected = null;
```

- P35-2 Correct: reactive dependency chain is coherent: `ownership/cards/showAll → listed → listedCodes → selected`; `entries` remains independent from `selected`, preserving hover/click/focus bounded work. Evidence: `src/story/collection/CollectionScreen.svelte:57-75`, `src/story/collection/CollectionScreen.svelte:149-151`, `tests/component/story/collection-screen.test.ts:196-300`.
- P35-3 Test cmd: `npx vitest run tests/component/story/collection-screen.test.ts`.
- P35-4 Residual risk: same-code card metadata replacement retains old selected object because membership keys by code. PR description explicitly preserves existing behavior; no regression introduced.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
