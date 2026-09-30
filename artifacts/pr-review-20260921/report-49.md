# PR #49: fix(content): signal cancellation when release is disposed

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/49  
Head: `f3cbb4e76bf9a294ad85c695990abdb086367536`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 f3cbb4e76bf9a294ad85c695990abdb086367536` |
| PR-targeted tests | Pass | `validation-49.json` |
| Changed-file ESLint / Prettier | Pass | `validation-49.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-49.json`, `ci-49.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- P49-1. Verdict: **Approve**.
- P49-2. SHA: `f3cbb4e76bf9a294ad85c695990abdb086367536`.
- P49-3. Correct: media lifetime gets own controller; each actual cache read receives union of caller signal plus lifetime signal. Disposal sets `disposed` before aborting, then revokes active URLs. `src/shell/adapters/progressive-release-media.ts:28-30,58-85,132-138`.
- P49-4. Correct: caller abort contract preserved. Catch rethrows caller abort through `checkAbort(signal)`; release-lifetime cancellation becomes existing `null` result. `progressive-release-media.ts:99-105,142-145`.
- P49-5. Correct: production reader checks provided signal before cache DB read plus each stream-read iteration. `src/content/storage/progressive-content-store.ts:204-217,220-237`; `src/content/storage/progressive-storage-validation.ts:95-140`.
- P49-6. Correct: regression captures adapter-provided signal, disposes release, asserts aborted signal plus null acquisition. `tests/unit/progressive-release-media.test.ts:50-87`.
- P49-7. Actual diff snippet:

```ts
const bytes = await reader.readFile(
  manifestVersion,
  file.path,
  AbortSignal.any([signal, lifetime.signal]),
);
```

- P49-8. Test cmd for parent: `npx vitest run tests/unit/progressive-release-media.test.ts tests/unit/progressive-storage.test.ts`.
- P49-9. Residual risk, accepted: production `reader.read()` is not synchronously interrupted by signal. Abort is observed at next loop checkpoint; stalled Cache stream can remain pending. PR description disclaims synchronous interruption.
- P49-10. Residual risk, low: queued acquisitions wait on caller signal, not lifetime signal. Disposal still makes each resumed acquisition return null before starting read (`progressive-release-media.ts:74-79`), but queued promises drain only as four active slots leave.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
