# PR #59: fix(field): derive pile preview from actual top card

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/59  
Head: `23cf6e3d96aaeaaad0380ce7c8128aea5317d777`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 23cf6e3d96aaeaaad0380ce7c8128aea5317d777` |
| PR-targeted tests | Pass | `validation-59.json` |
| Changed-file ESLint / Prettier | Pass | `validation-59.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-59.json`, `ci-59.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- F1. SHA: `23cf6e3d96aaeaaad0380ce7c8128aea5317d777`.
- F2. Correct visibility fix: actual pile tail selected first; identity checked only on that card. Hidden top no longer exposes lower public identity. Evidence: `src/battle/field/board-view-model.ts:500-510`.

```ts
      const topCandidate =
        zone === "deck" || zone === "extra" ? undefined : collection.at(-1);
      const top =
        topCandidate !== undefined && isProjectedCardIdentityKnown(topCandidate)
          ? topCandidate
          : undefined;
```

- F3. Correct pile order contract: graveyard/banished arrays are sequence order. Projector inserts at engine sequence, then resequences at `src/battle/worker/projection/DuelStateProjector.ts:1896-1917`; pile docs state bottom-first at `src/battle/field/zone-list.ts:16-20`. Tail is actual top.
- F4. Correct concealment: `isProjectedCardIdentityKnown()` requires projected `code` at `src/battle/duel/card-visibility.ts:8-13`. Opponent concealed non-fixed cards cannot carry code; projector asserts this at `src/battle/worker/projection/DuelStateProjector.ts:1941-1965`.
- F5. Regression: `tests/unit/board-stack-top-visibility.test.ts:10-33` verifies count/publicCount remain accurate while code, label, accessible top-card text stay absent.
- F6. Blocker: none.
- F7. Targeted tests: `npx vitest run tests/unit/board-stack-top-visibility.test.ts tests/unit/duel-field.test.ts tests/unit/card-preview.test.ts`.
- F8. Residual risk: regression is unit-level synthetic state. Native-engine scenario producing public lower banished card plus concealed tail remains unproven.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
