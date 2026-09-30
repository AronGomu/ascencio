# Battle / PWA PR Review

## State

- S1. Status: done. Reviewed PRs #38, #44, #45, #47, #59, #66, #67 at exact `headRefOid` values from supplied metadata.
- S2. Verdicts: seven Approve; zero Request changes; zero Block.
- S3. Source changes: none. Review artifact only.
- S4. Tests: not run; parent owns test execution. Read-only diff, commit, caller, merge inspection completed.
- S5. CI: ignored for code verdict per task. Supplied metadata reports red `full-gate`; parent investigating separately.

## Assumptions

- A1. `/home/aron/Projects/ascencio/plan.md` absent (`ENOENT`); `/home/aron/Projects/ascencio/progress.md` absent (`ENOENT`). Review used supplied task, PR JSON, PR diffs, exact Git objects.
- A2. Dirty local worktree ignored. Every production/test read used `git show <headRefOid>:<path>` or supplied artifact.
- A3. `graphify` skipped because task states unavailable after parent query.
- A4. `origin/main` at `2d721a55...`; all seven PR commits descend directly from base `456551dc...`. No reviewed production file changed between base and `origin/main`.

## Review

### PR #38 — Approve

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

### PR #44 — Approve

- C1. SHA: `45b41d6509b9278eaeb1da0e3aa01ce263913a81`.
- C2. Correct recovery scope: failed first install deletes only current build cache; approved update failure preserves installed caches. Evidence: `src/service-worker.ts:38-42`; `src/shell/pwa/shell-cache-policy.ts:40-50`.

```ts
      await installShellPrecache(
        firstInstall,
        async () => await precache.install(event),
        async () => await worker.caches.delete(cacheName),
      );
```

```ts
  } catch (error) {
    if (firstInstall) await removeIncompleteCache();
    throw error;
  }
```

- C3. Correct Workbox sequencing: installed `PrecacheController.install()` caches entries sequentially; rejection occurs after failed entry handling. Cleanup therefore has no outstanding parallel precache writes. Evidence: `node_modules/workbox-precaching/PrecacheController.js:139-169`.
- C4. Correct lifecycle classification: `isFirstCoreInstall()` requires no active worker plus no shell cache at `src/shell/pwa/shell-cache-policy.ts:30-37`. Deleting failed current cache restores same-build retry classification.
- C5. Regression: `tests/unit/pwa-install-retry.test.ts:5-35` covers delete/preserve branches. `e2e-core/pwa-install-retry.spec.ts:5-39` breaks `app-icon.svg`, repairs server, reloads, verifies activated controller plus offline-ready status. Fixture endpoint exists at `scripts/core-pwa-fixture-server.ts:56-86`; spec is included by `playwright.core.config.ts:7-10`.
- C6. Blocker: none.
- C7. Targeted tests: `npx vitest run tests/unit/pwa-install-retry.test.ts`; `npx playwright test -c playwright.core.config.ts --project=chromium e2e-core/pwa-install-retry.spec.ts`.
- C8. Residual risk: old partial caches created by already-deployed pre-fix builds remain shell-prefixed. New build sees non-first install, requiring normal CORE approval. Patch guarantees failures occurring under fixed worker; it does not migrate legacy partial caches.
- C9. Residual risk: cache deletion rejection replaces original install error, leaves retry blocked until Cache Storage recovers. PR description records this limit.

### PR #45 — Approve

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

### PR #47 — Approve

- E1. SHA: `9ce54562eec3099fc59578a98adfec31d35a5f17`.
- E2. Correct synchronous failure normalization: transaction construction now catches closed/versionchange DB errors. Evidence: `src/battle/storage/snapshot-store.ts:601-609`.

```ts
    const transaction = (() => {
      try {
        return this.#database.transaction("debugRuns", "readwrite");
      } catch (error) {
        throw storageError("Unable to record debug-run metadata", error);
      }
    })();
```

- E3. Correct async failure normalization: request/index/delete/commit rejection drains `transaction.done`, then throws `SnapshotStorageError`. Evidence: `src/battle/storage/snapshot-store.ts:610-622`.

```ts
    } catch (error) {
      await transaction.done.catch(() => undefined);
      throw storageError("Unable to record debug-run metadata", error);
    }
```

- E4. Correct caller behavior: diagnostic file download remains successful; metadata persistence failure becomes transient error at `src/battle/app/App.svelte:646-665`. Store closes in `finally` at lines 656-658.
- E5. Regression: `tests/unit/snapshot-store.test.ts:243-259` deletes DB, exercises versionchange-closed connection, asserts exact typed error.
- E6. Blocker: none.
- E7. Targeted tests: `npx vitest run tests/unit/snapshot-store.test.ts tests/component/BattleFacade.test.ts`.
- E8. Residual risk: added regression directly proves transaction-creation failure. Async `put`/`transaction.done` rejection branches are implemented consistently with existing store methods but lack new fault-injection coverage.

### PR #59 — Approve

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

### PR #66 — Approve

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

### PR #67 — Approve

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

## Cross-PR checks

- I1. `git diff --check 456551dc...<head>` passed for all seven PRs.
- I2. `git merge-tree` against `origin/main` reported no conflict markers for all seven heads.
- I3. `git diff --cached --name-only | wc -l` returned `0`; no staged files.
- I4. No cross-PR semantic collision found. PR #45 controls dialog multi-select; PR #67 locks pile browsing/activation pending; both retain Worker legality authority.
- I5. No visibility regression found. PR #59 removes lower-card disclosure; PR #38 policy still receives count-only visible state.
- I6. No timer/lifecycle leak found. PR #66 cancels timeout on replacement/unmount; PR #44 deletes only failed first-install current cache.

## Final verdict

- J1. Approve: #38, #44, #45, #47, #59, #66, #67.
- J2. Request changes: none.
- J3. Block: none.
- J4. Next human action: parent run targeted commands above; resolve independent red CI before merge.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "AR1: Per-PR findings cite exact SHA, production path:line, test path:line, actual diff snippet; residual risks B8/C8-C9/D8/E8/F8/G9/H9 recorded."
    }
  ],
  "changedFiles": [
    "/home/aron/Projects/ascencio/.pi-subagents/artifacts/outputs/5c8a9cb4-7bec-4d40-b209-fcabcc55777d/artifacts/pr-review-20260921/review-battle-pwa.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git diff --check 456551dc...<each-head>",
      "result": "passed",
      "summary": "AR2: All seven PR diffs passed whitespace/error check."
    },
    {
      "command": "git merge-tree $(git merge-base origin/main <head>) origin/main <head>",
      "result": "passed",
      "summary": "AR3: All seven heads showed no conflict markers against origin/main."
    },
    {
      "command": "git diff --cached --name-only | wc -l",
      "result": "passed",
      "summary": "AR4: Returned 0; no staged files."
    },
    {
      "command": "targeted Vitest/Playwright commands listed per PR",
      "result": "not-run",
      "summary": "AR5: Parent owns tests per task."
    }
  ],
  "validationOutput": [
    "AR6: Exact head objects verified: 6068ee12, 45b41d65, c33cc151, 9ce54562, 23cf6e3d, 7d8c7622, 7322e4e7.",
    "AR7: All heads use base 456551dc; reviewed production files unchanged on origin/main since base.",
    "AR8: Seven Approve; zero Request changes; zero Block."
  ],
  "residualRisks": [
    "AR9: #44 does not migrate partial shell caches left by pre-fix builds.",
    "AR10: #47 async transaction rejection branch lacks dedicated injected regression.",
    "AR11: #59 native-engine concealed-top scenario remains unproven.",
    "AR12: #66 replacement-before-expiry race lacks dedicated two-command timer test.",
    "AR13: #67 keyboard suppression relies native disabled-button semantics."
  ],
  "noStagedFiles": true,
  "diffSummary": "AR14: Review-only artifact covering seven battle/PWA PRs; no source edits.",
  "reviewFindings": [
    "AR15: approve: PR #38 src/battle/worker/opponent/OpponentPolicy.ts:246-253 - finish choice preferred when core exposes it.",
    "AR16: approve: PR #44 src/service-worker.ts:38-42 - failed first-install cache cleanup scoped to current build.",
    "AR17: approve: PR #45 src/battle/app/prompts/PromptControls.svelte:289-297 - unchecked options lock at maximum.",
    "AR18: approve: PR #47 src/battle/storage/snapshot-store.ts:601-622 - sync/async debug-run failures normalized.",
    "AR19: approve: PR #59 src/battle/field/board-view-model.ts:500-510 - only actual visible pile top can expose identity.",
    "AR20: approve: PR #66 src/battle/app/presentation/dom-feedback-controller.ts:45-67 - feedback timer cleared on expiry/replacement/cancel.",
    "AR21: approve: PR #67 src/battle/app/components/duel-field/StackControl.svelte:80-98 - pending stocked pile uses native disabled button.",
    "AR22: blocker: none."
  ],
  "manualNotes": "AR23: plan.md plus progress.md were absent. CI failures intentionally excluded from verdict; parent investigating."
}
```
