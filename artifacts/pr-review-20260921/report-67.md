# PR #67: fix(battle): disable pile controls while response is pending

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/67  
Head: `7322e4e7d9095390ab5a8d0fb289c02028dc9e06`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 7322e4e7d9095390ab5a8d0fb289c02028dc9e06` |
| PR-targeted tests | Pass | `validation-67.json`, `retry-67.log` |
| Changed-file ESLint / Prettier | Pass | `validation-67.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-67.json`, `ci-67.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- H1. SHA: `7322e4e7d9095390ab5a8d0fb289c02028dc9e06`.
- H2. Correct pending propagation: `FieldBoard` passes duel pending state into every pile control at `src/battle/app/components/duel-field/FieldBoard.svelte:327-342`.

```svelte
          actionable={!disabled &&
            spec?.stackChoices.has(stack.targetId) === true}
          {disabled}
```

- H3. Correct native activation lock: stocked piles render as buttons; `disabled` applies only to button variant at `src/battle/app/components/duel-field/StackControl.svelte:80-98`.

```svelte
  disabled={clickable ? disabled : undefined}
```

- H4. Correct end-to-end source: `DuelField` maps `pending` into `FieldBoard disabled` at `src/battle/app/components/DuelField.svelte:1445-1454`; `App` passes `$duel.responsePending` at `src/battle/app/App.svelte:1170-1182`.
- H5. Correct scope: empty piles remain non-button groups; stocked piles retain browse activation when not pending. Native disabled suppresses duplicate click before `activateStack()` at `src/battle/app/components/DuelField.svelte:1252-1267`.
- H6. Regression: direct component plus parent propagation covered at `tests/component/StackControlPending.test.ts:42-85`; both assert native disabled plus zero callback invocation.
- H7. Blocker: none.
- H8. Targeted tests: `npx vitest run tests/component/StackControlPending.test.ts tests/component/DuelField.test.ts`.
- H9. Residual risk: focused tests cover pointer click. Keyboard suppression relies native disabled-button semantics; no explicit Enter/Space regression.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
