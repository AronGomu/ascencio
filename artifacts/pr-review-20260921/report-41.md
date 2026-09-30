# PR #41: fix(story): classify interrupted save writes as unavailable

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/41  
Head: `314f8f657690a0aa79fa15ca16e0acce1a688fb5`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 314f8f657690a0aa79fa15ca16e0acce1a688fb5` |
| PR-targeted tests | Pass | `validation-41.json` |
| Changed-file ESLint / Prettier | Pass | `validation-41.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-41.json`, `ci-41.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

SHA: `314f8f657690a0aa79fa15ca16e0acce1a688fb5`

- D1 Correct: write catch now preserves quota classification for native `QuotaExceededError` plus normalized sentinel, maps IDB/closed-connection DOM failures plus `STORY_STORAGE_UNAVAILABLE` to unavailable, leaves semantic `Error` failures unknown. Evidence: `src/story/saves/generation-repository.ts:137-155`; sentinel definitions at `src/story/saves/generation-database.ts:7-24,70-89`.
- D2 Correct: deterministic regression pauses descriptor digest, deletes DB so version-change closes cached connection, resumes, then expects typed unavailable result. Evidence: `tests/unit/story/save-generation-errors.test.ts:14-47`; connection close/reset path at `src/story/saves/generation-database.ts:44-56`.
- D3 Correct: downstream UI already distinguishes quota, unavailable, unknown at `src/story/StoryApp.svelte:351-360`; story deck adapter maps unavailable separately at `src/story/decks/story-deck-context.ts:110-117`.
- D4 Note [low]: added race proof uses `fake-indexeddb`, not native Chromium deletion scheduling. Prod browser timing remains residual, not code defect.

Actual diff snippet:

```diff
-              error instanceof DOMException &&
-              error.name === "QuotaExceededError"
+              (error instanceof DOMException &&
+                error.name === "QuotaExceededError") ||
+              (error instanceof Error &&
+                error.message === "STORY_STORAGE_QUOTA")
                 ? "quota"
-                : "unknown",
+                : error instanceof DOMException ||
+                    (error instanceof Error &&
+                      error.message === "STORY_STORAGE_UNAVAILABLE")
+                  ? "unavailable"
+                  : "unknown",
```

Target test cmd (not run; parent testing separately):

```bash
npx vitest run tests/unit/story/save-generation-errors.test.ts tests/unit/story/save-generations.test.ts tests/unit/story/story-deck-context.test.ts
```

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
