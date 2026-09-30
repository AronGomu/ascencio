# PR #53: fix(shared-ui): reset effect scroll when preview changes

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/53  
Head: `86a0e799f8b0b61a22935628401646386d23d5fd`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 86a0e799f8b0b61a22935628401646386d23d5fd` |
| PR-targeted tests | Pass | `validation-53.json`, `retry-53.log` |
| Changed-file ESLint / Prettier | Pass | `validation-53.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-53.json`, `ci-53.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

SHA: `86a0e799f8b0b61a22935628401646386d23d5fd`

- P53-1 Correct: reset keys on `CardPreviewView.key`, not object identity. Async image updates rebuild preview object with same key, so they do not unexpectedly reset user scroll. Evidence: `src/shared-svelte-ui/card-preview/CardPreviewPanel.svelte:9-22`, `src/story/components/CardPreviewHost.svelte:25-26`, `src/deck-editor/components/DeckEditor.svelte:157-184`.

```diff
+  let scrolledPreviewKey: string | null = null;
+  $: resetTextScroll(preview?.key ?? null);
+
+  function resetTextScroll(previewKey: string | null): void {
+    if (previewKey === scrolledPreviewKey) return;
+    scrolledPreviewKey = previewKey;
+    if (textScroller !== null) textScroller.scrollTop = 0;
+  }
```

- P53-2 Correct: during non-null card-to-card switch, existing bound scroller resets before updated content paints; new scroller after null state starts at native `0`. Regression verifies retained node resets at `tests/component/card-preview-scroll-reset.test.ts:22-41`.
- P53-3 Test cmd: `npx vitest run tests/component/card-preview-scroll-reset.test.ts tests/component/CardPreviewPanel.test.ts tests/component/deck-editor/card-preview-pane.test.ts tests/component/story/card-preview-host.test.ts`.
- P53-4 Residual risk: tracked regression uses JSDOM; browser timing remains parent-owned validation. Logic has no timer or post-paint race.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
