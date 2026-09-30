# PR #26: fix(battle): keep installed deck rows revision-consistent

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/26  
Head: `ebc5f7fc09fe3e9ba3ef602ddef53bcc3bb5da54`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 ebc5f7fc09fe3e9ba3ef602ddef53bcc3bb5da54` |
| PR-targeted tests | Pass | `validation-26.json` |
| Changed-file ESLint / Prettier | Pass | `validation-26.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-26.json`, `ci-26.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

SHA: `ebc5f7fc09fe3e9ba3ef602ddef53bcc3bb5da54`

- A1 Correct: ready local row now derives key, label, displayed lists, start selection from same immutable `resolveDeck` snapshot. Prevents list/load revision race from showing rev 3 while starting rev 4. Evidence: `src/battle/decks/installed-selectable-decks.ts:43-65`; start consumers match `selection` by key in `src/battle/app/App.svelte:735-756`.
- A2 Correct: regression creates stale listed rev 3 plus loaded rev 4, then asserts key/name/list/start payload all use rev 4. Evidence: `tests/unit/installed-free-play.test.ts:105-145`.
- A3 Note [low]: invalid result still lacks loaded deck snapshot by contract (`src/decks/deck-resolver.ts:42-47`), so concurrently changed invalid rows can retain listed key/name/lists while showing latest validation error. No wrong duel can start because `selection` stays `null`; remaining UI inconsistency lacks coverage. `updatedAt` intentionally remains list-time value at `src/battle/decks/installed-selectable-decks.ts:65`.

Actual diff snippet:

```diff
+    const ready = resolved.type === "ready" ? resolved.deck : null;
@@
-        key: `local:${record.id}:${record.revision}`,
-        label: record.name,
+        key: `local:${ready?.ref.deckId ?? record.id}:${ready?.ref.revision ?? record.revision}`,
+        label: ready?.name ?? record.name,
@@
-          main: Object.freeze([...record.main]),
+          main: ready?.main ?? Object.freeze([...record.main]),
```

Target test cmd (not run; parent testing separately):

```bash
npx vitest run tests/unit/installed-free-play.test.ts tests/component/installed-free-play.test.ts tests/component/FreePlayMatchSetup.test.ts
```

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
