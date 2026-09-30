# PR #57: fix(assets): reject changed profile selection before sync write

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/57  
Head: `728f432ae93c83cf773e4ce12cad79758654ea6c`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 728f432ae93c83cf773e4ce12cad79758654ea6c` |
| PR-targeted tests | Pass | `validation-57.json` |
| Changed-file ESLint / Prettier | Pass | `validation-57.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-57.json`, `ci-57.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- G1 **Verdict: Approve.** SHA `728f432ae93c83cf773e4ce12cad79758654ea6c`.
- G2 **Correct — snapshot used for scan is pinned across scan/write boundary.** `scripts/lib/asset-delivery/profile-sync.ts:28-42` captures parsed selection, passes it directly to `scanAssetProfiles()` for write mode, reloads + canonical-compares before diagnostics/inventory write at lines 43-50. Changed selection returns `ASSET_SOURCE_CHANGED` through `assetCli()` → exit 2, no inventory write.
- G3 **Correct — broader scan race checks remain.** `scripts/lib/asset-delivery/scan-assets.ts:92-176` rechecks asset enumeration, per-file identity, profile declarations; lines 184-199 derive validated inventory. Common lock is acquired for write mode at `profile-sync.ts:24-27`, released in `finally` at lines 56-58.
- G4 **Actual diff:**

```diff
+      const selection = await loadSelection(root);
       const report = flags.has("--check")
         ? await checkAssetProfiles(root)
         : await scanAssetProfiles(
             root,
-            await loadSelection(root),
+            selection,
             EMPTY_RETAINED_METADATA,
             null,
           );
+      if (
+        !Buffer.from(canonicalBytes(selection)).equals(
+          Buffer.from(canonicalBytes(await loadSelection(root))),
+        )
+      )
+        fail("ASSET_SOURCE_CHANGED", "asset-profiles/nightly.json");
```

- G5 **Test cmd:** `node --test tests/profile-sync-selection-race.test.ts tests/asset-delivery-profiles.test.ts`.
- G6 **Residual risk:** cooperating writers honor common lock; uncooperative A→B→A edits or edits after final reread remain outside guarantee, matching PR limits. `--check` performs an extra internal selection load via `checkAssetProfiles()` (`scan-assets.ts:211-220`), but before/after comparison still rejects stable semantic change during check.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
