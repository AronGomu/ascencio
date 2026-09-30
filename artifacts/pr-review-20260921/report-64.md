# PR #64: fix(decks): separate Ritual summon frames from spell properties

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/64  
Head: `ad56fd33616c152ecb619618f512e101e59b8580`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 ad56fd33616c152ecb619618f512e101e59b8580` |
| PR-targeted tests | Pass | `validation-64.json` |
| Changed-file ESLint / Prettier | Pass | `validation-64.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-64.json`, `ci-64.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

SHA: `ad56fd33616c152ecb619618f512e101e59b8580`

- P64-1 Correct: option derivation now reads summon frames/traits only from monster subtypes; matcher independently enforces monster family whenever `summonFrame` is selected. Ritual spell remains available through `spellProperty`. Evidence: `src/decks/catalog/deck-catalog-advanced.ts:131-172`, `src/decks/catalog/deck-catalog-advanced.ts:349-375`.

```diff
-    for (const subtype of card.subtypes) subtypes.add(subtype);
+    if (card.family === "monster")
+      for (const subtype of card.subtypes) subtypes.add(subtype);
...
-    if (filters.summonFrame !== null && !hasSubtype(filters.summonFrame))
+    if (
+      filters.summonFrame !== null &&
+      (card.family !== "monster" || !hasSubtype(filters.summonFrame))
+    )
```

- P64-2 Correct: mapper intentionally shares `"Ritual"` subtype label across OCG card families, making family gate necessary. Evidence: `src/decks/catalog/ocg-card-mapper.ts:57-77`, `src/decks/catalog/ocg-card-mapper.ts:127-168`. Indexed and direct filtering both use `compileAdvancedDeckCatalogMatcher` at `src/decks/catalog/deck-catalog-index.ts:16-27` and `src/decks/catalog/deck-catalog.ts:46-62`.
- P64-3 Test cmd: `npx vitest run tests/unit/decks/deck-catalog-ritual-filter.test.ts tests/unit/decks/deck-catalog-index.test.ts tests/unit/decks/deck-catalog.test.ts`.
- P64-4 Residual risk: new regression is Ritual-specific, while family guard also affects overlapping `Normal` subtype. Generic family condition is direct; existing catalog suites cover normal advanced filtering.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
