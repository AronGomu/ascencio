# PR #37: fix(projection): redact opponent cards when position conceals them

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/37  
Head: `a2a9f70ed5bd14d0d81285d9df672410e2af13c5`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 a2a9f70ed5bd14d0d81285d9df672410e2af13c5` |
| PR-targeted tests | Pass | `validation-37.json` |
| Changed-file ESLint / Prettier | Pass | `validation-37.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-37.json`, `ci-37.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- E1 Head: `a2a9f70ed5bd14d0d81285d9df672410e2af13c5`.
- E2 Correct: opponent card moving to concealed non-fixed state loses code + correlation ID; fixed-slot remembered identity remains allowed. `src/battle/worker/projection/DuelStateProjector.ts:1416-1424`:

```diff
+    else if (
+      playerIndex === 1 &&
+      !isFixedLocation(publicLocation) &&
+      card.code !== undefined
+    ) {
+      this.#rotatePublicIdentity(card);
+      delete card.code;
+    }
```

- E3 Compatibility: emitted `positionChanged` already omits opponent code when face-down (`src/battle/worker/projection/DuelStateProjector.ts:428-434`); snapshot invariant rejects concealed opponent codes outside fixed slots (`:1955-1973`). Patch repairs producer before validator boundary.
- E4 Test adequacy: regression verifies code omission, ID rotation, face-down state (`tests/unit/opponent-position-concealment.test.ts:10-53`); modified legacy test also parses public event (`tests/unit/duel-state-projector.test.ts:249-281`). Targeted add: face-up→face-down opponent Extra Deck case; fixed monster/spell slot keeps attested code + ID; own-card transition keeps identity.
- E5 Residual risk: exact transition uses synthetic engine messages, not native duel. Existing snapshot assertion remains fail-closed backstop.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
