# PR #63: fix(shell): settle all started story clears before reset returns

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/63  
Head: `fbd4d6a0819c8c560d84321e85c98907919cdc82`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 fbd4d6a0819c8c560d84321e85c98907919cdc82` |
| PR-targeted tests | Pass | `validation-63.json` |
| Changed-file ESLint / Prettier | Pass | `validation-63.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-63.json`, `ci-63.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- P63-1. Verdict: **Approve**.
- P63-2. SHA: `fbd4d6a0819c8c560d84321e85c98907919cdc82`.
- P63-3. Correct: all five clear promises start through map; `Promise.allSettled` prevents early reset rejection while another destructive clear still runs. First rejection in stable slot order is rethrown after settlement. `src/shell/admin/admin-actions.ts:90-99`.
- P63-4. Correct: production `GenerationSaveRepository.clear` is async and each call owns transaction settlement / abort before resolving or rejecting. `src/story/saves/generation-repository.ts:194-215`.
- P63-5. Correct: regression injects immediate rejected clear plus delayed clear, confirms reset remains unsettled until delayed clear resolves, confirms original error identity. `tests/unit/admin-actions.test.ts:185-221`.
- P63-6. Actual diff snippet:

```ts
const results = await Promise.allSettled(
  STORY_SLOT_KEYS.map((slot) => saves.clear(slot)),
);
const failure = results.find(
  (result): result is PromiseRejectedResult => result.status === "rejected",
);
```

- P63-7. Test cmd for parent: `npx vitest run tests/unit/admin-actions.test.ts`.
- P63-8. Residual risk, accepted: reset remains non-atomic; one failed slot can coexist with cleared slots. Patch fixes promise lifecycle only.
- P63-9. Residual risk, low: test uses synthetic repo rather than native concurrent IndexedDB transactions.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
