# PR #40: fix(content): cancel rejected install responses

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/40  
Head: `c67e02f702c5d491363716f3d5704daa1a73695b`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 c67e02f702c5d491363716f3d5704daa1a73695b` |
| PR-targeted tests | Pass | `validation-40.json` |
| Changed-file ESLint / Prettier | Pass | `validation-40.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-40.json`, `ci-40.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- P40-1. Verdict: **Approve**.
- P40-2. SHA: `c67e02f702c5d491363716f3d5704daa1a73695b`.
- P40-3. Correct: non-OK / redirected response with body now awaits body cancellation before fixed sanitized `CONTENT_NETWORK_FAILED`. Cancellation failure logs fixed string, never remote data. `src/content/install/verified-fetch.ts:29-37`.
- P40-4. Correct: success-stream read failure retains existing reader cancellation / lock release at `src/content/install/verified-fetch.ts:38-62`; patch aligns rejection path with existing cleanup semantics.
- P40-5. Correct: test uses open `ReadableStream`, HTTP 503, asserts exact failure code plus one cancellation. `tests/unit/verified-fetch-cancellation.test.ts:6-33`.
- P40-6. Actual diff snippet:

```ts
if (!response.ok || response.redirected || !response.body) {
  if (response.body)
    try {
      await response.body.cancel();
    } catch {
      console.warn("CONTENT_RESPONSE_CANCEL_FAILED");
    }
  throw failure("CONTENT_NETWORK_FAILED");
}
```

- P40-7. Test cmd for parent: `npx vitest run tests/unit/verified-fetch-cancellation.test.ts tests/unit/content-installer.test.ts`.
- P40-8. Residual risk, low: fixture is WHATWG stream, not Chromium HTTP transport. A transport whose cancellation promise never settles can delay failure; same awaited-cancel pattern already exists for body-read failures at `verified-fetch.ts:51-56`.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
