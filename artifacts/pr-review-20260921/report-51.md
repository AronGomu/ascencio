# PR #51: fix(shell): preserve unrelated settings across stale sessions

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/51  
Head: `f4ff999c3cfdb71c2e75fe5d8054c3cc70fa7829`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 f4ff999c3cfdb71c2e75fe5d8054c3cc70fa7829` |
| PR-targeted tests | Pass | `validation-51.json` |
| Changed-file ESLint / Prettier | Pass | `validation-51.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-51.json`, `ci-51.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

SHA: `f4ff999c3cfdb71c2e75fe5d8054c3cc70fa7829`

- F1 Correct: store records field-level pending patch, rebases it over latest readable persisted settings per mutation, clears pending only inside successful `setItem`. Sequential stale stores preserve unrelated fields; repeated quota/read failures preserve unsaved local state. Evidence: `src/shell/settings/shell-settings-store.ts:25-59`.
- F2 Correct: focused tests cover repeated quota failure, latest dirty value, unrelated remote rebase, read/write failure recovery, null storage, two stale live stores. Evidence: `tests/unit/shell-settings-concurrency.test.ts:16-120`.
- F3 Correct: only three typed mutations exist (`src/shell/settings/shell-settings-store.ts:10-14,62-73`); callers use them in `src/shell/screens/FreePlayMatchSetup.svelte:390-398,460-470` plus `src/shell/AppShell.svelte:1155-1157`.
- F4 Note [medium residual]: no atomic cross-tab lock. Two tabs interleaving get/set can still lose updates; no `storage` event updates already-rendered UI. PR description states both limits.

Actual diff snippet:

```diff
+  let pending: Partial<ShellSettings> = {};
+
+  function persist(patch: Partial<ShellSettings>): void {
+    pending = { ...pending, ...patch };
@@
+      const value = Object.freeze({ ...current, ...pending });
@@
+              storage.setItem(key, serialized);
+              pending = {};
```

Target test cmd (not run; parent testing separately):

```bash
npx vitest run tests/unit/shell-settings.test.ts tests/unit/shell-settings-concurrency.test.ts tests/unit/persisted-ui-state.test.ts tests/unit/persisted-ui-store.test.ts
```

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
