# PR #27: fix(decks): preserve modified order across clock rollback

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/27  
Head: `7dfac2aa5b192da92c04442f75901d439a49c4a3`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 7dfac2aa5b192da92c04442f75901d439a49c4a3` |
| PR-targeted tests | Pass | `validation-27.json` |
| Changed-file ESLint / Prettier | Pass | `validation-27.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-27.json`, `ci-27.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

SHA: `7dfac2aa5b192da92c04442f75901d439a49c4a3`

- B1 Correct: save computes timestamp inside same read-write transaction from persisted `current.updatedAt`, not original creation time. Clock rollback cannot decrease stored modification order. Evidence: `src/decks/indexeddb-deck-repository.ts:214-240`; list sorts descending by `updatedAt` at `src/decks/indexeddb-deck-repository.ts:123-139`.
- B2 Correct: fake-IDB regression moves injected clock from Jan 3 to Jan 2 after creation, then verifies saved timestamp stays Jan 3. Evidence: `tests/unit/decks/indexeddb-deck-repository.test.ts:202-228`.
- B3 Note [low]: repository assumes callers preserve immutable `createdAt`; `save` does not explicitly compare it with persisted record. Existing app callers save loaded records, so reviewed path remains valid.

Actual diff snippet:

```diff
-        updatedAt: latestTimestamp(deck.createdAt, this.#now()),
+        updatedAt: latestTimestamp(current.updatedAt, this.#now()),
```

Target test cmd (not run; parent testing separately):

```bash
npx vitest run tests/unit/decks/indexeddb-deck-repository.test.ts
```

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
