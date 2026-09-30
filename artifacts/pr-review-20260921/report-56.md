# PR #56: fix(content): reject noncanonical producer candidates

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/56  
Head: `3a92443b7214c297e37100eeab1e993e4a6d299c`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 3a92443b7214c297e37100eeab1e993e4a6d299c` |
| PR-targeted tests | Pass | `validation-56.json` |
| Changed-file ESLint / Prettier | Pass | `validation-56.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-56.json`, `ci-56.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- F1 **Verdict: Approve.** SHA `3a92443b7214c297e37100eeab1e993e4a6d299c`.
- F2 **Correct — producer/verifier byte contract aligned.** Producer writes `canonicalBytes(candidate)` at `scripts/lib/asset-delivery/progressive-producer.ts:209-221`. Verifier parses strict candidate shape at lines 262-301; new check at lines 409-425 requires parsed value’s canonical bytes equal stored bytes before identity relations pass.
- F3 **Correct — all consumers cross same verifier.** CLI verify uses `verifyProgressiveRelease()` at `scripts/lib/asset-delivery/content-cli.ts:83-101`; pack validates predecessor at `progressive-producer.ts:160-175`; publisher validates before upload + immediately before pointer CAS at `scripts/lib/asset-delivery/progressive-publisher.ts:261-270,309-317`.
- F4 **Actual diff:**

```diff
       !Buffer.from(canonicalBytes(pointer)).equals(Buffer.from(pointerBytes)) ||
+      !Buffer.from(canonicalBytes(candidate)).equals(
+        Buffer.from(candidateBytes),
+      ) ||
       pointer.releaseSequence !== manifest.releaseSequence ||
```

- F5 **Test cmd:** `node --test tests/progressive-producer.test.ts`.
- F6 **Residual risk:** canonicality is integrity/format enforcement, not authenticity; authorized metadata replacement remains possible. Test at `tests/progressive-producer.test.ts:595-617` covers pretty-print alteration; alternate noncanonical key order/escape spellings follow same byte comparison.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
