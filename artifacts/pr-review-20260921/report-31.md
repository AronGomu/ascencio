# PR #31: fix(delivery): restore missing objects on idempotent publish

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/31  
Head: `e0cbc6a813047f0496621545e15add7d7b296151`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 e0cbc6a813047f0496621545e15add7d7b296151` |
| PR-targeted tests | Pass | `validation-31.json`, `retry-31.log` |
| Changed-file ESLint / Prettier | Pass | `validation-31.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-31.json`, `ci-31.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- P31-1. Verdict: **Approve**.
- P31-2. SHA: `e0cbc6a813047f0496621545e15add7d7b296151`.
- P31-3. Correct: idempotent branch now validates every local file against manifest, verifies remote immutable bytes, conditionally recreates missing object, then verifies manifest before returning. `scripts/lib/asset-delivery/progressive-publisher.ts:229-267,269-283,312-332`.
- P31-4. Correct: divergent existing bytes never overwritten. `putIfAbsent` remains conditional; `verifyImmutable` maps size / missing GET / hash / byte mismatch to `PUBLISH_IMMUTABLE_CONFLICT`. `scripts/lib/asset-delivery/progressive-publisher.ts:229-258`. Matches ADR-092 D3 at `docs/ADR/092_ADR_immutable_per_file_content_delivery.md:20`.
- P31-5. Correct: regression deletes published file, retries identical candidate, asserts status `idempotent` plus restored key. `tests/progressive-publisher.test.ts:301-314`.
- P31-6. Actual diff snippet:

```ts
for (const file of candidate.manifest.files) {
  const key = `content/files/${file.version}/${file.path}`;
  await ensureImmutable(
    transport,
    key,
    await candidateFileBytes(root, run, file),
  );
}
```

- P31-7. Test cmd for parent: `node --test tests/progressive-publisher.test.ts`.
- P31-8. Residual risk, low: fake S3 test covers missing file, not missing manifest. Same `ensureImmutable` helper handles both at `progressive-publisher.ts:326-330`, reducing gap.
- P31-9. Residual risk, low: concurrent delete between successful `head` plus `get` can produce `PUBLISH_IMMUTABLE_CONFLICT` instead of restoration. Safe failure; no divergent overwrite. Live R2 behavior remains unproven, consistent with ADR-092 C2.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
