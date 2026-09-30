# PR #28: fix(content): cancel rejected progressive response streams

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/28  
Head: `7b3d205b6338e0e0fcbc1b2834e24ad488b2df5f`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 7b3d205b6338e0e0fcbc1b2834e24ad488b2df5f` |
| PR-targeted tests | Pass | `validation-28.json` |
| Changed-file ESLint / Prettier | Pass | `validation-28.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-28.json`, `ci-28.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- A1 Head: `7b3d205b6338e0e0fcbc1b2834e24ad488b2df5f`.
- A2 Correct: failed read/size validation now cancels reader before lock release while preserving primary error when `cancel()` rejects. `src/content/storage/progressive-storage-validation.ts:126-135`:

```diff
+    try {
+      await reader.cancel();
+    } catch {
+      console.warn("CONTENT_RESPONSE_CANCEL_FAILED");
+    }
     if (signal.aborted) throw new StoreContentError("CONTENT_CANCELLED");
     throw error;
```

- A3 Test adequacy: public `cacheManifest` regression proves oversized stream cancellation + `CONTENT_INTEGRITY_FAILED` (`tests/unit/progressive-download.test.ts:700-724`). Targeted add: make `cancel()` reject; assert original integrity error survives + static warning contains no response data. Add aborted-stream case.
- A4 Residual risk: `Content-Length` rejection occurs before reader acquisition (`src/content/storage/progressive-storage-validation.ts:101-113`) → response body is not explicitly canceled. Existing PR limit; no regression from patch.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
