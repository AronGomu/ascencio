# T11: Diagnostics download button in duel settings

**Plan:** `./artifacts/PLAN_2026_09_02_duel_field_feedback.md`
**Depends:** none
**Commit outcome:** Duel settings dialog offers a "Download duel log" button that saves the full diagnostic trace JSON; disabled/absent when no trace exists yet.

## Context (self-contained)

- Goal: owner feedback `feedback.md` § Duel Field item 14 — settings button downloading the log of everything that happened, to help solve bugs.
- This slice: thread the EXISTING diagnostics download path into `SettingsDialog`. All infra exists (scout-verified): `download-diagnostics.ts` builds+downloads, `requestDiagnostics()` at `App.svelte:906` already feeds error/result dialogs.
- Out of scope here: enlarging the trace (bounded 10k entries / 900K text units in `BoundedDuelTrace` — sufficient; state in UI copy that it is the engine protocol trace), persisting traces.
- Assumptions in force: download = worker `DuelDiagnosticTrace` (protocol-level), not the 2,000-entry presentation `duelLog` — richer for debugging, matches the two existing download buttons.

## Requirements

- New button in `SettingsDialog.svelte` between reset (`settings-reset-button`) and the info rows; label "Download duel log"; `data-cy="settings-download-diagnostics-button"`.
- Clicking triggers the same flow as `DuelErrorDialog`/`DuelResultDialog` download: request trace → `downloadDuelDiagnostics(trace, environment)` → file `ygo-duel-diagnostics-{snapshotId[0..12]}.json`; also records debug-run metadata (`recordDebugRun`, existing `handleDiagnosticsDownload()` at `App.svelte:867` region).
- Unavailable state: prop is nullable; `null` → button rendered disabled with title "No duel trace yet" (visible-but-disabled beats absent: owner should discover the feature).
- Pending state: while the async request runs, button disabled (reuse existing `diagnosticPending`-style state if App tracks one; else local boolean in App).

## Inputs

- `SettingsDialog.svelte` — props list + existing `data-cy` naming (`settings-*`); tests `tests/component/SettingsDialog.test.ts`.
- `App.svelte:1672-1688` SettingsDialog mount; `:906` `requestDiagnostics()`; `handleDiagnosticsDownload()` (existing serializer + `recordDebugRun` call).
- `src/battle/app/diagnostics/download-diagnostics.ts` — `downloadDuelDiagnostics(trace, environment, documentObject?)`.
- Availability signal: `$duel.diagnostics` / `serveableDiagnostics` (held across worker replace) — same predicate error/result dialogs use.

## Interface contract (level 5)

- **Produces:**
  - `SettingsDialog.svelte` new prop (exact): `export let ondownloaddiagnostics: (() => void) | null = null;` — `null` ⇒ disabled button; markup:
    ```svelte
    <button
      type="button"
      disabled={ondownloaddiagnostics === null}
      onclick={() => ondownloaddiagnostics?.()}
      data-cy="settings-download-diagnostics-button"
    >Download duel log</button>
    ```
  - `App.svelte`: pass `ondownloaddiagnostics={diagnosticsAvailable ? handleSettingsDiagnosticsDownload : null}` where the handler reuses the exact same request/serialize path as the error-dialog download (extract shared fn if duplication would exceed a few lines — utility-reuse rule).
- **Consumes:** `DuelDiagnosticTrace` (schemaVersion 2, `sensitivity: "contains-production-seed"`), `DiagnosticEnvironment` — both unchanged.
- **Errors:** `requestDiagnostics()` returning `false` (no session) is prevented by the availability predicate; a request that never answers leaves the button disabled-pending — bounded by existing dialog behavior (mirror it; do not invent a timeout).
- **Invariants:** trace contains no card identities beyond public projection (already tested by `tests/unit/download-diagnostics.test.ts`); button unique `data-cy`.
- **Integration links:** trigger click `settings-download-diagnostics-button` → dispatch `requestDiagnostics()` worker command → receive `diagnostics` worker event → `$duel.diagnostics` → observe browser download `ygo-duel-diagnostics-*.json` + `debugRuns` IndexedDB row (component test asserts handler called; e2e asserts download event).

## TDD

1. **Red** — `SettingsDialog.test.ts`: button renders, disabled when prop null, fires when set.
2. **Green** — prop + wiring.
3. **Refactor** — extract shared download handler if duplicated; keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| component SettingsDialog | prop set | button enabled, click fires once |
| component SettingsDialog | prop null | button disabled |
| e2e | mid-duel settings → click | download event with `ygo-duel-diagnostics-` filename prefix |

## Impl steps

- [ ] 1. Red component tests.
- [ ] 2. Prop + button + App wiring.
- [ ] 3. e2e download assertion (Playwright `page.waitForEvent("download")`).

## Validation

- [ ] `npm run check:headless`; component gate (NOT in check:headless): `npx vitest run tests/component/SettingsDialog.test.ts`
- [ ] manual check: JSON opens, contains prompts/responses timeline
- [ ] silent-failure sites: none
- [ ] app functional
- [ ] commit msg draft: `feat(duel): download duel diagnostic trace from settings`
