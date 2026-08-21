# T13: Duel error recovery dialog

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T12
**Commit outcome:** A fatal duel error opens a dialog offering **Download diagnostics** and **Restore**, and Restore puts you back at the last decision you owned.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket completes `feedback-duel.md` item 9.
- This slice: the UI half. The replay itself already exists behind a worker command.
- Out of scope here: the replay mechanism (T12), the diagnostics payload (already shipped), non-fatal recoverable prompts (the existing Dismiss path is unchanged).
- Assumptions in force: Restore is offered whenever the trace holds at least one human response, for **any** fatal duel error; when it does not, the dialog shows Download plus Try again.

## Requirements

- On a fatal error the existing `app-error-panel` becomes a modal dialog with a clear title, the error code, the sensitive-seed note, and three possible actions: Download diagnostics, Restore (when available), Try again.
- Restore calls the worker's restore command and, on success, closes the dialog and returns the duel to the live prompt the replay stopped at.
- A failed restore keeps the dialog open and appends a message; the download button still works.
- Restore is hidden — not disabled — when `canRestore` is false.

## Inputs

- `src/battle/app/App.svelte`
  - lines 1139-1195 — the `{#if $duel.error}` block rendering `section[data-cy="app-error-panel"]` with `app-error-heading`, `app-error-code`, `app-dismiss-error-button`, `app-retry-duel-button`, `app-error-sensitive-note`, `app-error-download-diagnostics-button` and `requestDiagnostics()`.
  - `diagnosticPending` / `diagnosticMessage` state around lines 503 and 726.
- `src/battle/app/diagnostics/download-diagnostics.ts:37` — `downloadDuelDiagnostics(...)`, already wired.
- `src/battle/app/stores/duel-store.ts` — after T12 it exposes `canRestore` and the restore transition.
- `src/battle/app/DuelWorkerClient.ts` — after T12 it exposes `restore()`.
- `src/battle/app/components/duel-field/ZoneListDialog.svelte` — focus trap and `Escape` pattern to copy.
- Tests: `tests/component/BattleFacade.test.ts` (mounts the duel app), `tests/unit/download-diagnostics.test.ts`, `tests/unit/duel-store.test.ts`.

## From Depends

- T12 added to the worker a `restore` command and `restored` / `restore_failed` events, `buildRestorePlan(trace): RestorePlan | null` in `src/battle/worker/diagnostics/duel-trace.ts`, `canRestore: boolean` on the published duel state, `DuelWorkerClient.restore(): Promise<void>`, and the matching `duel-store.ts` transition. `docs/ADR/048_ADR_replay_based_duel_recovery.md` records the decision.

## TDD

1. **Red** — add to `tests/component/BattleFacade.test.ts`: `a fatal error opens the recovery dialog`, `restore is hidden when the trace holds no human response`, `restore calls the worker and closes on success`, `a failed restore keeps the dialog open`.
2. **Green** — turn the error panel into `DuelErrorDialog.svelte` and wire the store.
3. **Refactor** — keep the non-fatal recoverable-error path (Dismiss) exactly where it is.

## Test plan

| Test                                                       | Input                               | Expect                                                                              |
| ---------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| `a fatal error opens the recovery dialog`                  | store error with `status: "failed"` | `[data-cy="duel-error-dialog"]` present with heading, code and sensitive note       |
| `restore is hidden when the trace holds no human response` | `canRestore: false`                 | no `[data-cy="duel-error-restore-button"]`; `app-retry-duel-button` present         |
| `restore calls the worker and closes on success`           | `canRestore: true`, click Restore   | `client.restore()` called once; dialog unmounted; duel status back to a live prompt |
| `a failed restore keeps the dialog open`                   | `restore()` rejects                 | dialog present; a message with the failure; download button still enabled           |
| `download still works from the dialog`                     | click Download                      | `downloadDuelDiagnostics` invoked once                                              |
| `Escape does not dismiss a fatal dialog`                   | keydown `Escape`                    | dialog still present (a fatal duel has no safe dismissal)                           |

## Impl steps

- [ ] 1. Add the failing component tests; run `npx vitest run tests/component/BattleFacade.test.ts`.
- [ ] 2. Create `src/battle/app/components/DuelErrorDialog.svelte` with props `error`, `canRestore`, `diagnosticPending`, `diagnosticMessage`, `ondownload`, `onrestore`, `onretry`; `data-cy` values `duel-error-dialog`, `duel-error-heading`, `duel-error-code`, `duel-error-download-button`, `duel-error-restore-button`, `duel-error-retry-button`, `duel-error-message`.
- [ ] 3. Copy the focus trap from `ZoneListDialog.svelte`; focus the heading on mount; do not close on `Escape` or on an outside click.
- [ ] 4. In `App.svelte`, replace the fatal branch of the `{#if $duel.error}` block with `<DuelErrorDialog …>`, keeping the recoverable branch (Dismiss) as it is.
- [ ] 5. Wire `onrestore` to `duel.restore()`, showing a pending label while it runs and appending `restore_failed` messages to `diagnosticMessage`.
- [ ] 6. Read `canRestore` from the store and pass it through.
- [ ] 7. Add the dialog's styles to `src/styles/app.css` using the existing dialog tokens; the restore button is the primary action, download is secondary.
- [ ] 8. Run `npx vitest run tests/component/BattleFacade.test.ts tests/unit/duel-store.test.ts tests/unit/data-cy-coverage.test.ts`.
- [ ] 9. Update `e2e/duel-smoke.spec.ts` only if it asserts `app-error-panel`.

## Outputs

- Files touched: `src/battle/app/components/DuelErrorDialog.svelte` (new), `src/battle/app/App.svelte`, `src/styles/app.css`, `tests/component/BattleFacade.test.ts`, possibly `e2e/duel-smoke.spec.ts`.
- Behaviour change: a failed duel is recoverable instead of terminal.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/component/BattleFacade.test.ts` passes
- [ ] `npx vitest run tests/unit/data-cy-coverage.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual: force a duel failure, download the report, press Restore, keep playing from your last decision
- [ ] app functional — normal duels never see the dialog; recoverable prompts still offer Dismiss
- [ ] commit msg draft: `feat(duel): a failed duel offers a report and a restore to your last decision`
