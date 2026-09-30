# PR #46: fix(battle): isolate concurrent Worker watchdogs

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/46  
Head: `28120fee56620faf76c3b85178122b0f8a655a46`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 28120fee56620faf76c3b85178122b0f8a655a46` |
| PR-targeted tests | Pass | `validation-46.json` |
| Changed-file ESLint / Prettier | Pass | `validation-46.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-46.json`, `ci-46.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

- P46-1. Verdict: **Approve**.
- P46-2. SHA: `28120fee56620faf76c3b85178122b0f8a655a46`.
- P46-3. Correct: diagnostics now owns `#diagnosticsWatchdog`; prompt response / initialization / restore / surrender continue using `#watchdog`. Diagnostic completion clears only diagnostics timer. `src/battle/app/DuelWorkerClient.ts:117-118,480-483,526-537,699-727`.
- P46-4. Correct: all worker-failure / replacement / shutdown / termination paths clear both timers. `DuelWorkerClient.ts:504-508,558-562,571-585,603-613,681-684`.
- P46-5. Correct: Worker can process diagnostics concurrently in command queue and returns typed `diagnostics` event. Caller evidence: `src/battle/worker/DuelWorkerRuntime.ts:285-301`; worker dispatch chain `src/battle/worker/duel.worker.ts:90-108`.
- P46-6. Correct: regression orders diagnostics request → response command → diagnostics reply → timeout; asserts original Worker termination, replacement, `process_timeout`. `tests/unit/duel-worker-client.test.ts:422-462`.
- P46-7. Actual diff snippet:

```ts
if (event.type === "diagnostics") {
  this.#diagnosticsPending = false;
  this.#clearDiagnosticsWatchdog();
}
```

- P46-8. Test cmd for parent: `npx vitest run tests/unit/duel-worker-client.test.ts`.
- P46-9. Residual risk, low: new regression covers diagnostics-first ordering only. Inverse ordering follows separate clear paths but lacks direct concurrent test.
- P46-10. Residual risk, accepted: any generic Worker `error` clears both timers at `DuelWorkerClient.ts:504-508`; PR description explicitly retains this behavior.

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
