# PR #29: fix(assets): reject unknown image download options

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/29  
Head: `8b263a83717e3d6d1e42db4f60d2f9335c3e20c4`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 8b263a83717e3d6d1e42db4f60d2f9335c3e20c4` |
| PR-targeted tests | Pass | `validation-29.json` |
| Changed-file ESLint / Prettier | Pass | `validation-29.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-29.json`, `ci-29.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- B1 **Verdict: Approve.** SHA `8b263a83717e3d6d1e42db4f60d2f9335c3e20c4`.
- B2 **Correct — CLI allowlist closes silent-default path.** `scripts/download-images.ts:170-200` now rejects any non-boolean option absent from value-option allowlist before value parsing. Top-level parse occurs at `scripts/download-images.ts:26`; filesystem path resolution, lock acquisition, directory creation start at lines 27, 49, 52 → malformed args fail before writes/network.
- B3 **Correct — producer callers remain compatible.** `scripts/lib/mvp-assets.ts:65-100` emits only `--concurrency`, `--requests-per-second`, `--force`, `--kind`; all accepted. Documented direct args at `README.md:225-242` remain accepted.
- B4 **Actual diff:**

```diff
+    if (
+      !argument?.startsWith("--") ||
+      ![
+        "--assets",
+        "--output",
+        "--concurrency",
+        "--requests-per-second",
+        "--limit",
+        "--kind",
+        "--chapter",
+      ].includes(argument)
+    ) {
       throw new Error(`Unknown argument: ${argument ?? "<missing>"}`);
```

- B5 **Test cmd:** `npx vitest run tests/unit/image-download-cli.test.ts`.
- B6 **Residual risk:** regression at `tests/unit/image-download-cli.test.ts:5-20` proves exit + stderr ordering, not absence of writes directly; source ordering at `scripts/download-images.ts:26-52` supplies that evidence. Live downloads intentionally untested.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
