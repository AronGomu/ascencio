# PR #47: fix(battle): normalize debug-run storage failures

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/47  
Head: `9ce54562eec3099fc59578a98adfec31d35a5f17`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 9ce54562eec3099fc59578a98adfec31d35a5f17` |
| PR-targeted tests | Pass | `validation-47.json` |
| Changed-file ESLint / Prettier | Pass | `validation-47.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-47.json`, `ci-47.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- E1. SHA: `9ce54562eec3099fc59578a98adfec31d35a5f17`.
- E2. Correct synchronous failure normalization: transaction construction now catches closed/versionchange DB errors. Evidence: `src/battle/storage/snapshot-store.ts:601-609`.

```ts
    const transaction = (() => {
      try {
        return this.#database.transaction("debugRuns", "readwrite");
      } catch (error) {
        throw storageError("Unable to record debug-run metadata", error);
      }
    })();
```

- E3. Correct async failure normalization: request/index/delete/commit rejection drains `transaction.done`, then throws `SnapshotStorageError`. Evidence: `src/battle/storage/snapshot-store.ts:610-622`.

```ts
    } catch (error) {
      await transaction.done.catch(() => undefined);
      throw storageError("Unable to record debug-run metadata", error);
    }
```

- E4. Correct caller behavior: diagnostic file download remains successful; metadata persistence failure becomes transient error at `src/battle/app/App.svelte:646-665`. Store closes in `finally` at lines 656-658.
- E5. Regression: `tests/unit/snapshot-store.test.ts:243-259` deletes DB, exercises versionchange-closed connection, asserts exact typed error.
- E6. Blocker: none.
- E7. Targeted tests: `npx vitest run tests/unit/snapshot-store.test.ts tests/component/BattleFacade.test.ts`.
- E8. Residual risk: added regression directly proves transaction-creation failure. Async `put`/`transaction.done` rejection branches are implemented consistently with existing store methods but lack new fault-injection coverage.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
