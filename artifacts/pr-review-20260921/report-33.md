# PR #33: fix(shell): ignore stale story deck context reads

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/33  
Head: `80be82218568c1c78d7d46eb695e157e5ccf0c01`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 80be82218568c1c78d7d46eb695e157e5ccf0c01` |
| PR-targeted tests | Pass | `validation-33.json`, `retry-33.log` |
| Changed-file ESLint / Prettier | Pass | `validation-33.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-33.json`, `ci-33.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

SHA: `80be82218568c1c78d7d46eb695e157e5ccf0c01`

- C1 Correct: cancellation generation now advances on every deck-world transition, before non-story early return. Delayed Story resolution cannot overwrite synchronously installed Free Play context. Evidence: `src/shell/AppShell.svelte:620-645`.
- C2 Correct: component regression blocks both Story slot reads, navigates to Free Play, releases reads, then verifies no Story banner/deck replaces Free Play. Evidence: `tests/component/deck-editor/editor-context.test.ts:357-383`.
- C3 Note [low]: cancellation is generation-based, not physical abort; stale reads still finish. Guard prevents stale UI mutation. This is acceptable because save API has no abort signal.

Actual diff snippet:

```diff
-    if (world !== "story") return;
     const requested = ++storyDeckToken;
+    if (world !== "story") return;
```

Target test cmd (not run; parent testing separately):

```bash
npx vitest run tests/component/deck-editor/editor-context.test.ts
```

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
