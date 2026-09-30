# PR #62: fix(assets): contain runtime verification within snapshot root

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/62  
Head: `fdbc3317dfa0c13c13372240acdbf424d6e8f6e5`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 fdbc3317dfa0c13c13372240acdbf424d6e8f6e5` |
| PR-targeted tests | Pass | `validation-62.json` |
| Changed-file ESLint / Prettier | Pass | `validation-62.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-62.json`, `ci-62.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- G1 Head: `fdbc3317dfa0c13c13372240acdbf424d6e8f6e5`.
- G2 Correct: lexical path validation now precedes canonical containment; metadata/hash reads use resolved target, rejecting directory + leaf symlinks outside root. `src/battle/worker/assets/runtime-snapshot-node.ts:112-128`:

```diff
+      canonicalRoot ??= await realpath(assetRoot);
+      const canonicalPath = await realpath(absolutePath);
+      const relative = path.relative(canonicalRoot, canonicalPath);
+      if (
+        relative === ".." ||
+        relative.startsWith(`..${path.sep}`) ||
+        path.isAbsolute(relative)
+      )
+        throw new Error(`Artifact path escapes snapshot root: ${file.path}`);
+      const metadata = await stat(canonicalPath);
...
+      const digest = sha256(await readFile(canonicalPath));
```

- G3 Compatibility: Node runtime verifies snapshot before dependency reads (`src/battle/worker/create-node-runtime.ts:47-58,96-104`). Existing `safeArtifactPath` lexical contract remains unchanged for loader callers.
- G4 Test adequacy: regression proves directory-symlink escape rejection (`tests/unit/runtime-snapshot-root-containment.test.ts:10-35`). Targeted add: leaf symlink escape; in-root symlink acceptance; missing root; manifest with zero files.
- G5 Residual risk: loader later reopens lexical paths (`src/battle/worker/assets/active-duel-dependencies-node.ts:16-22`) → mutable hostile FS can swap links/files after verification. PR explicitly excludes TOCTOU. `buildRuntimeSnapshotManifest` also reads `manifest.json` before this canonical verifier (`runtime-snapshot-node.ts:38-43`); treat root/manifest as trusted bootstrap input or harden separately.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
