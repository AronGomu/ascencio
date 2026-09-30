# PR #54: fix(asset-delivery): reject malformed numeric prerelease versions

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/54  
Head: `fcfe2cd8dd44dfe7f9165a1a495e558b223b80fd`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 fcfe2cd8dd44dfe7f9165a1a495e558b223b80fd` |
| PR-targeted tests | Pass | `validation-54.json` |
| Changed-file ESLint / Prettier | Pass | `validation-54.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-54.json`, `ci-54.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- D1 **Verdict: Approve.** SHA `fcfe2cd8dd44dfe7f9165a1a495e558b223b80fd`.
- D2 **Correct — SemVer prerelease numeric rule enforced.** `scripts/lib/asset-delivery/schema.ts:88-97` accepts numeric `0` or nonzero-leading digits; alphanumeric/hyphen identifiers use `\d*[A-Za-z-][0-9A-Za-z-]*`; build metadata retains leading-zero allowance. `parseChannel()` consumes parser at `scripts/lib/asset-delivery/identity.ts:10-16`; asset inventory package version consumes it at `scripts/lib/asset-delivery/scan-assets.ts:184-190`.
- D3 **Correct — boundary controls cover malformed + valid near-neighbors.** `tests/asset-delivery-release-version.test.ts:11-23` rejects `1.0.0-01`, `1.0.0-alpha.01`; accepts `-0`, `-alpha.01x`, `+01`.
- D4 **Actual diff:**

```diff
-    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
+    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
```

- D5 **Test cmd:** `node --test tests/asset-delivery-release-version.test.ts`.
- D6 **Residual risk:** focused test omits empty/double-dot prerelease cases; regex rejects them, while existing parser suites provide broader grammar coverage per PR description. Input already capped to 512 chars by `text()` at `schema.ts:41-50`.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
