# PR #45: fix(battle): stop dialog selections at engine maximum

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/45  
Head: `c33cc15143ef1318d779e74e8a7d6f3cddf51b22`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 c33cc15143ef1318d779e74e8a7d6f3cddf51b22` |
| PR-targeted tests | Pass | `validation-45.json`, `retry-45.log` |
| Changed-file ESLint / Prettier | Pass | `validation-45.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-45.json`, `ci-45.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- D1. SHA: `c33cc15143ef1318d779e74e8a7d6f3cddf51b22`.
- D2. Correct UI legality mirror: unchecked boxes disable at engine maximum; selected boxes remain enabled for deselection. Evidence: `src/battle/app/prompts/PromptControls.svelte:289-297`.

```svelte
                disabled={selected.length >= prompt.maximum &&
                  !selected.includes(choice.id)}
```

- D3. Correct authority boundary: submit still validates IDs, min, max at `src/battle/app/prompts/prompt-selection.ts:16-68`; Worker remains final resolver. Field path independently rejects additions at cap in `src/battle/app/prompts/interaction-session.ts:129-141`.
- D4. Correct pending behavior: containing fieldset uses `disabled={controlsDisabled}` at `src/battle/app/prompts/PromptControls.svelte:273-277`; dynamic per-checkbox lock does not bypass response-pending lock.
- D5. Regression: `tests/component/prompt-selection-limit.test.ts:29-47` verifies cap plus re-enable after deselection.
- D6. Blocker: none.
- D7. Targeted tests: `npx vitest run tests/component/prompt-selection-limit.test.ts tests/component/PromptControls.test.ts tests/unit/interaction-session.test.ts`.
- D8. Residual risk: new component test uses `announceAttribute`; shared `multiple` branch also serves card/sum prompts. Cross-family behavior is structurally shared, not separately exercised here.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
