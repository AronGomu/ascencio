# PR #55: fix(assets): bind archive verification to object digest

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/55  
Head: `7f05b75c5e49e5288e16ae97c0cbf4261abbbcb5`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 7f05b75c5e49e5288e16ae97c0cbf4261abbbcb5` |
| PR-targeted tests | Pass | `validation-55.json` |
| Changed-file ESLint / Prettier | Pass | `validation-55.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-55.json`, `ci-55.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- E1 **Verdict: Approve.** SHA `7f05b75c5e49e5288e16ae97c0cbf4261abbbcb5`.
- E2 **Correct — structure, entries, digest share one fd.** `scripts/lib/asset-delivery/verify-archive.ts:40-57` captures pathname stat, opens with `O_NOFOLLOW`, binds handle identity; lines 57-108 verify ZIP structure + declared entry digests; lines 109-132 hash exact same `ZipFileReader` handle in 1 MiB reads, recheck pathname/handle identity, compare `ref` bytes/hash.
- E3 **Correct — pre-hash removal does not leave binary refs unchecked.** `scripts/lib/asset-delivery/verify-bundle.ts:43-63` records binary refs without independent path read. Every dev/core archive is immediately passed to `verifyArchive()` at lines 85-123. `walkContentClosure()` discovers each content part; `verify-bundle.ts:210-285` verifies every manifest part. Exact closure equality remains at lines 294-299.
- E4 **Correct — bounded reads preserved.** `verifyArchive.ts:31-37` applies archive/file-count limits before open. `ZipFileReader.readUint8Array()` at `scripts/lib/asset-delivery/zip-file-reader.ts:14-41` rejects invalid ranges, caps allocation, fails on short reads.
- E5 **Actual diff:**

```diff
+  const before = await sourceStat(root, relative);
+  if (!before?.isFile() || before.size !== BigInt(ref.bytes))
+    fail("ASSET_INTEGRITY_FAILED", ref.key);
...
+    const archiveHash = createHash("sha256");
+    let archiveBytes = 0;
+    while (archiveBytes < source.size) {
+      const chunk = await source.readUint8Array(
+        archiveBytes,
+        Math.min(1024 * 1024, source.size - archiveBytes),
+      );
+      archiveHash.update(chunk);
+      archiveBytes += chunk.length;
+    }
...
+    if (
+      !sameDigest(ref, {
+        bytes: archiveBytes,
+        sha256: archiveHash.digest("hex"),
+      })
+    )
+      fail("ASSET_INTEGRITY_FAILED", ref.key);
```

- E6 **Test cmd:** `node --test tests/asset-delivery-archive-identity.test.ts tests/asset-delivery-bundle.test.ts tests/asset-delivery-zip-structure.test.ts`.
- E7 **Residual risk:** no hostile-filesystem transaction guarantee after final stat; PR states same limit. New regression `tests/asset-delivery-archive-identity.test.ts:12-46` covers valid ZIP + wrong ObjectRef digest, not active in-place mutation or >4 GiB real archive.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
