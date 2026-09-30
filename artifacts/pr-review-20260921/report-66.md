# PR #66: fix(battle): expire transient field feedback at its duration

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/66  
Head: `7d8c76223633af8d2a3e556b44e05ec20cbaa3e5`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 7d8c76223633af8d2a3e556b44e05ec20cbaa3e5` |
| PR-targeted tests | Pass | `validation-66.json`, `retry-66.log` |
| Changed-file ESLint / Prettier | Pass | `validation-66.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-66.json`, `ci-66.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- G1. SHA: `7d8c76223633af8d2a3e556b44e05ec20cbaa3e5`.
- G2. Correct timer lifecycle: clear cancels prior timer, animations, highlight; expiry clears feedback state. Evidence: `src/battle/app/presentation/dom-feedback-controller.ts:45-67`.

```ts
  const clearAfter = (durationMs: number): void => {
    if (durationMs === 0) return;
    clearTimer = setTimeout(() => {
      clearTimer = null;
      clearTransient();
      onState(EMPTY_DOM_FEEDBACK_STATE);
    }, durationMs);
  };
```

- G3. Correct command scope: expiry added to line/highlight commands at `src/battle/app/presentation/dom-feedback-controller.ts:101-160`; notice/life/chain semantics remain unchanged.
- G4. Correct replacement/unmount race handling: every `present()` starts with `clearTransient()` at line 98; component teardown calls `feedbackController?.cancel()` at `src/battle/app/components/DuelField.svelte:419-429`. Old timer cannot clear newer feedback.
- G5. Correct reduced-motion behavior: zero duration schedules no timer at lines 60-61. Existing static feedback remains; regression asserts this at `tests/unit/dom-feedback-controller.test.ts:229-247`.
- G6. Regression: expiry boundary asserted at `tests/unit/dom-feedback-controller.test.ts:185-206`; explicit cancel asserts zero timers at lines 208-227.
- G7. Blocker: none.
- G8. Targeted tests: `npx vitest run tests/unit/dom-feedback-controller.test.ts tests/unit/presentation-command.test.ts`.
- G9. Residual risk: replacement-before-expiry behavior follows direct code path but lacks dedicated two-command fake-timer regression.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
