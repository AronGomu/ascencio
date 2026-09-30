# PR #34: fix(assets): reject mismatched source caches safely

**Approve with nits — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/34  
Head: `eaad2ee69eb5e8ce7f21f91f50d1e1320ad70d4c`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 eaad2ee69eb5e8ce7f21f91f50d1e1320ad70d4c` |
| PR-targeted tests | Pass | `validation-34.json` |
| Changed-file ESLint / Prettier | Pass | `validation-34.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-34.json`, `ci-34.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

**Parent adjudication:** original request-changes finding downgraded after independent review. `git remote get-url origin` expands `insteadOf`; malicious local Git config can defeat consistency check, but introduces no new capability versus parent. Production revision remains SHA-pinned. Normal URL rewriting can reject equivalent caches; PR explicitly discloses strict URL equality. Follow-up: compare raw `remote.origin.url`, add rewrite regressions. Source: `scripts/lib/sources.ts:63-66,76-100,115-135`; `review-34-adjudication.md`.

```diff
+    const repository = runGit(["remote", "get-url", "origin"], directory);
+    if (repository !== definition.repository) {
+      throw new Error("Cached source repository mismatch");
+    }
```

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
