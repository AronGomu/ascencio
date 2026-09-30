# PR #39: fix(content): reject unsafe progressive MIME values

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/39  
Head: `3ab646c30f39b9d1f588170aae0f0237d9194946`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 3ab646c30f39b9d1f588170aae0f0237d9194946` |
| PR-targeted tests | Pass | `validation-39.json` |
| Changed-file ESLint / Prettier | Pass | `validation-39.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-39.json`, `ci-39.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- F1 Head: `3ab646c30f39b9d1f588170aae0f0237d9194946`.
- F2 Correct: every role now requires RFC token-like `type/subtype`; media keeps allowed top-level restriction. CR/LF, whitespace, parameters cannot reach `Response` headers. `src/content/parsers/progressive-file.ts:44-49`:

```diff
+    !/^[A-Za-z0-9!#$%&'*+.^_`|~-]+\/[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(
+      v.mediaType,
+    ) ||
+    (role === "media" && !/^(?:image|audio|video)\//.test(v.mediaType)) ||
```

- F3 Compatibility: producer emits extension-mapped token/token values (`scripts/lib/asset-delivery/progressive-manifest.ts:90`); sinks set `Content-Type` only after parser validation (`src/content/storage/progressive-content-store.ts:344-357`, `src/content/create-content-installer.ts:330`).
- F4 Test adequacy: regression proves required-file CRLF injection rejection (`tests/unit/progressive-release.test.ts:308-313`). Targeted add: CR-only, LF-only, tab/space, empty side, MIME parameters; valid punctuation token case.
- F5 Residual risk: MIME is metadata, not payload proof; SHA-256 + semantic consumers remain integrity controls.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
