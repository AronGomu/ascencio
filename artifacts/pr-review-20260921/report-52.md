# PR #52: fix(story): reject queued stale deck saves

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/52  
Head: `ef353d1c79f70f50779bbc58fc14107ef4cc582c`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 ef353d1c79f70f50779bbc58fc14107ef4cc582c` |
| PR-targeted tests | Pass | `validation-52.json` |
| Changed-file ESLint / Prettier | Pass | `validation-52.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-52.json`, `ci-52.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

SHA: `ef353d1c79f70f50779bbc58fc14107ef4cc582c`

- G1 Correct: optimistic revision check now executes within repository serialization task immediately before dispatch. Second save queued behind in-flight save observes committed rev 5, rejects expected rev 4, restores same pre-dispatch state. Evidence: `src/story/decks/story-deck-repository.ts:59-100,168-183`.
- G2 Correct: deterministic regression blocks first persist, queues stale second save, releases first, then verifies conflict actual revision 5 plus retained first edit. Evidence: `tests/unit/story/story-deck-repository-concurrency.test.ts:15-69`.
- G3 Correct: cross-file revision propagation remains coherent. Story context updates persisted save revision only after written result at `src/story/decks/story-deck-context.ts:99-104`; editor maps `DeckRevisionConflictError` to conflict at `src/deck-editor/deck-editor-store.ts:778-806`.
- G4 Note [medium residual]: `create` duplicate check plus `delete` revision check remain outside serialization at `src/story/decks/story-deck-repository.ts:124-140,186-203`. PR explicitly scopes only queued stale saves; save/create/delete interleavings need separate audit.

Actual diff snippet:

```diff
   function commit(
     command: StoryCommand,
     landed: (state: StoryState) => boolean,
+    beforeDispatch?: () => void,
   ): Promise<void> {
@@
+        beforeDispatch?.();
@@
+        () => {
+          const current = find(deck.id);
+          if (current === undefined || current.revision !== expectedRevision)
+            throw new DeckRevisionConflictError(current?.revision ?? null);
+        },
```

Target test cmd (not run; parent testing separately):

```bash
npx vitest run tests/unit/story/story-deck-repository.test.ts tests/unit/story/story-deck-repository-concurrency.test.ts tests/unit/story/story-deck-context.test.ts
```

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
