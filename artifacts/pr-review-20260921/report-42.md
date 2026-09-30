# PR #42: perf(story): index shop rarities for sale browsing

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/42  
Head: `98458e6c108ffcbd3728b15501ebdfb368a38662`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 98458e6c108ffcbd3728b15501ebdfb368a38662` |
| PR-targeted tests | Pass | `validation-42.json` |
| Changed-file ESLint / Prettier | Pass | `validation-42.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-42.json`, `ci-42.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

SHA: `98458e6c108ffcbd3728b15501ebdfb368a38662`

- P42-1 Correct: `WeakMap` keys by `ShopSetData` snapshot identity; first lookup performs one set/card pass, later lookups perform map lookup. Highest-rarity rule remains `RARITY_ORDER` rank comparison. Evidence: `src/story/shop/data/shop-set-data.ts:137-169`.

```diff
+const rarityIndexByData = new WeakMap<
+  ShopSetData,
+  ReadonlyMap<number, ShopRarity>
+>();
...
+    const rarity = rarityIndex(data).get(code);
+    if (rarity !== undefined) return rarity;
```

- P42-2 Correct: fallback behavior remains unchanged for codes missing from set data (`inferRarity(view)` then `"common"`). Existing coverage verifies printed maximum, inferred fallback, null-data fallback at `tests/unit/story/shop-set-data.test.ts:401-427`; new coverage verifies one index construction at `tests/unit/story/shop-rarity-index.test.ts:45-58`.
- P42-3 Correct: production snapshots are replacement-based. `installedShopSetData` creates frozen snapshots at `src/story/shop/data/shop-set-data.ts:32-49`; image enrichment assigns new top-level identity at `src/story/StoryApp.svelte:579-590`.
- P42-4 Test cmd: `npx vitest run tests/unit/story/shop-rarity-index.test.ts tests/unit/story/shop-set-data.test.ts tests/unit/story/shop-pack-value.test.ts`.
- P42-5 Residual risk: parsed `ShopSetData` is structurally readonly but not runtime-frozen at `src/story/shop/data/shop-set-data.ts:99-113`; unsupported in-place mutation after first lookup would stale cache. No production mutator found.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
