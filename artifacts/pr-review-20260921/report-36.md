# PR #36: fix(protocol): prevent hidden effect card identity leaks

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/36  
Head: `ab1b7de84b5af2ab0f198b94eea0a698875e1039`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 ab1b7de84b5af2ab0f198b94eea0a698875e1039` |
| PR-targeted tests | Pass | `validation-36.json` |
| Changed-file ESLint / Prettier | Pass | `validation-36.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-36.json`, `ci-36.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- D1 Head: `ab1b7de84b5af2ab0f198b94eea0a698875e1039`.
- D2 Correct: effect formatting now gates on same viewer/controller/location/position policy used by prompt-card redaction. Hidden branch short-circuits before card-name/description lookup. `src/battle/worker/protocol/PromptRegistry.ts:151-169`:

```diff
+  const contextIdentityVisible =
+    contextCard !== undefined &&
+    isPromptCardIdentityVisible(contextCard, raw.prompt.player);
...
-    message.description !== 0n
+    message.description !== 0n &&
+    contextIdentityVisible
```

- D3 Compatibility: player-1 prompts stay Worker-internal (`src/battle/worker/HeadlessDuelController.ts:218-235`); only player-0 prompt returns to UI. Visible prompts retain formatted text through existing tests (`tests/unit/prompt-registry.test.ts:353-398`).
- D4 Test adequacy: regression asserts no code, name, or message for face-down opponent banished card (`tests/unit/prompt-registry-visibility.test.ts:40-60`). Targeted add: visibility matrix for opponent hand/extra/banished, graveyard, face-up zones, fixed slots, overlay-address prompt cards.
- D5 Residual risk: direct boundary fixture does not prove native core emits exact hidden `SELECT_EFFECT_YES_NO` combination. No leak remains in exercised production formatter/redactor path.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
