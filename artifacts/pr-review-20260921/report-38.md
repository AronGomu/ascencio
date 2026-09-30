# PR #38: fix(opponent): finish valid toggle selections

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/38  
Head: `6068ee1279b5f6c20a4273e8358fd741e0f0dc55`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 6068ee1279b5f6c20a4273e8358fd741e0f0dc55` |
| PR-targeted tests | Pass | `validation-38.json` |
| Changed-file ESLint / Prettier | Pass | `validation-38.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-38.json`, `ci-38.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- B1. SHA: `6068ee1279b5f6c20a4273e8358fd741e0f0dc55`.
- B2. Correct: opponent now consumes engine-offered `finish` before another toggle. Evidence: `src/battle/worker/opponent/OpponentPolicy.ts:246-253`.

```ts
      case "selectUnselectCard": {
        const finish = prompt.choices.find(
          (choice) => choice.action === "finish",
        );
        return {
          choiceIds: [(finish ?? prompt.choices[0]!).id],
          reason: "select_first_legal",
        };
      }
```

- B3. Correct legality boundary: `finish` exists only when core message sets `can_finish`; producer adds it at `src/battle/worker/protocol/PromptRegistry.ts:489`. Resolver accepts exactly one choice, maps `finish` to core sentinel `null` at `src/battle/worker/protocol/PromptRegistry.ts:504-516`.
- B4. Correct privacy boundary: policy receives identity-free `OpponentVisibleDuelState`; `src/battle/worker/opponent/OpponentPolicy.ts:46-61,70-94` carries counts only.
- B5. Regression: `tests/unit/opponent-policy.test.ts:334-361` proves `finish` wins despite earlier selectable/selected choices.
- B6. Blocker: none.
- B7. Targeted tests: `npx vitest run tests/unit/opponent-policy.test.ts tests/unit/prompt-registry.test.ts`.
- B8. Residual risk: focused test covers finish-present path. Finish-absent fallback relies unchanged first-choice behavior; no new explicit fallback test.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
