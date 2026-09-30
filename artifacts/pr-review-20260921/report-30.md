# PR #30: fix(assets): reject catalog records in wrong shards

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/30  
Head: `e7958de939a4f640c33ccfd4888b916a15d8a579`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 e7958de939a4f640c33ccfd4888b916a15d8a579` |
| PR-targeted tests | Pass | `validation-30.json` |
| Changed-file ESLint / Prettier | Pass | `validation-30.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-30.json`, `ci-30.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- B1 Head: `e7958de939a4f640c33ccfd4888b916a15d8a579`.
- B2 Correct: verifier checks each card/text/image record against same `numeric-id-modulo` invariant used by producer. `scripts/verify-assets.ts:301-308`:

```diff
+      const expectedShard = (record.code % shardCount)
+        .toString(16)
+        .padStart(2, "0");
+      if (expectedShard !== name) {
+        failures.push(
+          `${label} ${record.code} is in shard ${name}; expected shard ${expectedShard}`,
+        );
+      }
```

- B3 Compatibility: producer uses `catalogShard(code)` → `(code % CATALOG_SHARD_COUNT).toString(16).padStart(2, "0")` (`scripts/lib/transform.ts:46-48`). New legacy test is discovered by `node --test tests/*.test.ts` (`package.json:43`).
- B4 Test adequacy: regression proves card `65` in shard `02` fails (`tests/verify-assets.test.ts:15-126`). Targeted add: table-drive card/text/image mismatch paths; add invalid non-number, non-safe, negative code records.
- B5 Residual risk: JSON is cast, not schema-parsed (`scripts/verify-assets.ts:285-286`); negative multiples or numeric strings can satisfy modulo placement. Pre-existing broad verifier limitation; patch fulfills wrong-shard scope for valid records.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
