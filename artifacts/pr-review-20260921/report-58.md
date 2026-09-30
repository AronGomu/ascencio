# PR #58: fix(decks): reject unusable cards at published-deck boundary

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/58  
Head: `50af8ca6c46c58ad3709304e394e8c4be72add98`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 50af8ca6c46c58ad3709304e394e8c4be72add98` |
| PR-targeted tests | Pass | `validation-58.json` |
| Changed-file ESLint / Prettier | Pass | `validation-58.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-58.json`, `ci-58.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- H1 **Verdict: Approve.** SHA `50af8ca6c46c58ad3709304e394e8c4be72add98`.
- H2 **Correct — published validator now matches draft rule.** `src/decks/validation/validate-published-decks.ts:20-28` applies TOKEN or scope bit `8` rejection to every card in main/extra/side. Existing draft validator uses identical predicate at `src/decks/deck-validation.ts:138-147`.
- H3 **Correct — both producer and legacy consumers inherit boundary.** Release semantic validation calls validator at `src/shell/release-validation.ts:87-91`; legacy installed gameplay maps `record.ot` to `scope`, then validates at `src/shell/adapters/legacy-gameplay-validation.ts:15-44`.
- H4 **Actual diff:**

```diff
-        if (hasOcgType(definition.type, OCG_TYPE.TOKEN)) fail();
+        if (
+          hasOcgType(definition.type, OCG_TYPE.TOKEN) ||
+          (definition.scope & 8) !== 0
+        )
+          fail();
```

- H5 **Test cmd:** `npx vitest run tests/unit/decks/published-deck-validation.test.ts tests/unit/cards.test.ts`.
- H6 **Residual risk:** new fixture at `tests/unit/decks/published-deck-validation.test.ts:39-47` covers normal scope `1` + exact illegal scope `8`, not composite scope bits; bitmask implementation handles composites. Live release/engine duel remains untested.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
