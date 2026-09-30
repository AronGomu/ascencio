# PR #44: fix(pwa): recover from incomplete first precache

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/44  
Head: `45b41d6509b9278eaeb1da0e3aa01ce263913a81`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 45b41d6509b9278eaeb1da0e3aa01ce263913a81` |
| PR-targeted tests | Pass | `validation-44.json` |
| Changed-file ESLint / Prettier | Pass | `validation-44.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-44.json`, `ci-44.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- C1. SHA: `45b41d6509b9278eaeb1da0e3aa01ce263913a81`.
- C2. Correct recovery scope: failed first install deletes only current build cache; approved update failure preserves installed caches. Evidence: `src/service-worker.ts:38-42`; `src/shell/pwa/shell-cache-policy.ts:40-50`.

```ts
      await installShellPrecache(
        firstInstall,
        async () => await precache.install(event),
        async () => await worker.caches.delete(cacheName),
      );
```

```ts
  } catch (error) {
    if (firstInstall) await removeIncompleteCache();
    throw error;
  }
```

- C3. Correct Workbox sequencing: installed `PrecacheController.install()` caches entries sequentially; rejection occurs after failed entry handling. Cleanup therefore has no outstanding parallel precache writes. Evidence: `node_modules/workbox-precaching/PrecacheController.js:139-169`.
- C4. Correct lifecycle classification: `isFirstCoreInstall()` requires no active worker plus no shell cache at `src/shell/pwa/shell-cache-policy.ts:30-37`. Deleting failed current cache restores same-build retry classification.
- C5. Regression: `tests/unit/pwa-install-retry.test.ts:5-35` covers delete/preserve branches. `e2e-core/pwa-install-retry.spec.ts:5-39` breaks `app-icon.svg`, repairs server, reloads, verifies activated controller plus offline-ready status. Fixture endpoint exists at `scripts/core-pwa-fixture-server.ts:56-86`; spec is included by `playwright.core.config.ts:7-10`.
- C6. Blocker: none.
- C7. Targeted tests: `npx vitest run tests/unit/pwa-install-retry.test.ts`; `npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/pwa-install-retry.spec.ts`.
- C8. Residual risk: old partial caches created by already-deployed pre-fix builds remain shell-prefixed. New build sees non-first install, requiring normal CORE approval. Patch guarantees failures occurring under fixed worker; it does not migrate legacy partial caches.
- C9. Residual risk: cache deletion rejection replaces original install error, leaves retry blocked until Cache Storage recovers. PR description records this limit.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
