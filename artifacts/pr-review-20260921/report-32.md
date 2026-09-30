# PR #32: fix(build): serve CORE metadata URLs with query strings

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/32  
Head: `7da053c66a9c742e659f2ea49daf257e9bc4ba63`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 7da053c66a9c742e659f2ea49daf257e9bc4ba63` |
| PR-targeted tests | Pass | `validation-32.json` |
| Changed-file ESLint / Prettier | Pass | `validation-32.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-32.json`, `ci-32.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- C1 **Verdict: Approve.** SHA `7da053c66a9c742e659f2ea49daf257e9bc4ba63`.
- C2 **Correct — pathname parsed before exact allowlist dispatch.** `scripts/lib/vite-core-content.ts:114-136` rejects `%`, backslash, hash; WHATWG `URL.pathname` removes query; middleware still serves only exact `core-bootstrap.json`, `core-release.json`, `app-icon.svg`, verified object-map keys.
- C3 **Correct — method/integrity controls unchanged.** `scripts/lib/vite-core-content.ts:137-172` still limits to GET/HEAD; `verifiedObject()` hashes bytes at lines 94-106. Regression asserts 200 plus no fallthrough at `tests/unit/core-content-transport.test.ts:99-105`; traversal rejection remains at lines 121-123.
- C4 **Actual diff:**

```diff
-  if (/%|\\|\?|#/.test(requestUrl)) return null;
+  if (/%|\\|#/.test(requestUrl)) return null;
   const pathname = new URL(requestUrl, "http://vite.local").pathname;
```

- C5 **Test cmd:** `npx vitest run tests/unit/core-content-transport.test.ts`.
- C6 **Residual risk:** direct middleware test does not launch Vite/Chromium. Query support applies to every exact allowlisted object path, not only `core-release.json`; immutable object identity remains path-keyed, so query cannot widen object selection.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
