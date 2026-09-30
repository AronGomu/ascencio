# Remaining-source audit — odd positions

## Review

- R1. **Done:** 69/69 assigned files FULL; 14,857 lines. Reads ≤300 lines; no truncated source reads counted.
- R2. **Findings:** two P2 defects; one P3 defect. Source-traced; runtime reproduction not executed.
- R3. **Correct:** image leases reject stale acquisitions, release abandoned URLs (`src/battle/app/images/semantic-image-leases.ts:69–96`). No new privacy defect confirmed.
- R4. **Fixed:** none. No edits, tests, commits, staging, subagents.
- R5. **Blocker:** no new P1 confirmed. Next action: add focused regressions for F1–F3 before fixes.
- R6. **Output:** read-only restriction → report returned here. `/home/aron/Projects/ascencio/artifacts/codebase-audit/remaining-source-odd.md` not written; final existence check returned `False`.

## Assumptions

- A1. Assignment = sorted P109 + N32 paths, excluding three binary fonts **before** indexing → 138 text paths; odd zero-based positions → 69 owned files.
- A2. Findings describe root HEAD `26da126`; initial/final observed HEAD unchanged. Existing unrelated dirty files preserved.
- A3. “Confirmed” means source establishes defect. No browser/probe/test execution permitted; reproduction traces below remain unexecuted.
- A4. Graph-first attempted: `/bin/bash: line 1: graphify: command not found`. Direct source inspection used.
- A5. Additional cross-file reads/searches support findings only; no full-file/test coverage implied beyond ledger.

## F1 — P2: field error boundary hides promised fallback controls

**Evidence:** `src/battle/app/components/duel-field/DuelFieldErrorBoundary.svelte:75–108` replaces failed field with error panel claiming `"Prompt controls remain available. No private engine detail was shown."` Boundary exposes no failure state to App.

`src/battle/app/App.svelte:355–360` selects prompt surface using `duelBoard !== null`, not successful field rendering. `src/battle/app/prompts/prompt-surface.ts:18–22` consequently returns `"field"` for field-capable prompts. Dialog mounts only for `"dialog"` (`App.svelte:1278–1287`); docked controls require `showWorkspace` (`:1317–1351`), default false (`src/battle/app/stores/ui-settings-store.ts:31–35`).

**Source repro trace:** start duel with `?duelFieldFailure=once` (`App.svelte:381–384`), workspace off, nontrivial field selection pending → boundary catches injected failure → board remains non-null → surface remains `"field"` → no field controls, no prompt dialog, no docked controls. Retry exists; promised fallback does not.

**Minimal fix:** propagate boundary failed/recovered state to App; include state in field-availability argument. Restore fallback dialog while failed; remove fallback after successful retry.

**Regression:** extend `tests/component/AppChrome.test.ts` or dedicated App boundary test. Inject failure with live multi-choice prompt; assert fallback submits correct choice. Assert retry removes duplicate fallback. Test files inventoried, not reviewed/run.

## F2 — P2: Settings modal allows keyboard interaction behind backdrop

**Evidence:** `src/battle/app/components/SettingsDialog.svelte:44–57` sets initial focus, handles Escape only. No Tab trap. `:97–226` renders `aria-modal="true"` without native modal behavior.

`src/battle/app/components/portal-duel-dialog.ts:1–12` reparents backdrop only; no focus isolation. App keeps field/phase controls enabled according to response state, not modal state (`src/battle/app/App.svelte:1176–1183,1210–1232,1366–1384`). No `inert`/focus trap found in App or AppShell.

**Source repro trace:** open Settings during actionable prompt → focus first checkbox → Shift+Tab follows document tab order outside dialog → underlying controls remain focusable/actionable despite backdrop. `aria-modal` does not enforce focus containment.

**Minimal fix:** trap Tab within modal; isolate underlying app controls while open; restore trigger focus on close. Account for both portaled/non-portaled rendering.

**Regression:** extend `tests/component/SettingsDialog.test.ts`; focus first/last controls, verify backward/forward wrapping. Mounted App keyboard test verifies underlying duel cannot activate while Settings open. Tests not reviewed/run.

## F3 — P3: disabling card shadows leaves art/material shadows enabled

**Evidence:** Settings describes `"Draw a soft shadow under every card on the field."` (`src/battle/app/components/SettingsDialog.svelte:8–9`). Setting reaches board’s `data-card-shadows` (`src/battle/app/components/duel-field/FieldBoard.svelte:231–234`).

`src/styles/app.css:2592–2594` disables shadow on `.duel-field-card` only. Descendant `.duel-field-card__material` retains independent shadow (`:2781–2790`); `.duel-field-card__art` retains independent shadow (`:2806–2814`). `box-shadow` is not inherited.

**Source repro trace:** ordinary non-actionable card → disable Show card shadows → article shadow becomes none → art shadow remains. Xyz material shadows remain too.

**Minimal fix:** control decorative article/art/material shadows through shared setting-dependent value. Preserve legality/selection/focus halos.

**Regression:** Chromium computed-style check with ordinary card plus materials: setting off removes decorative shadows; legal/selected halos remain. No browser validation executed.

## Duplication control

- D1. Existing toggle/draw/Shop-key findings excluded. Runtime follow-up diff inspected; changes address those paths, not F1–F3 above.
- D2. Deck fix commit `221ec16` changed-file summary inspected: editor/deck-selection/data fixes; no overlap with reported locations.
- D3. Tooling commit `6704f2a`, current tooling diff stats inspected: scripts/config/tests; no overlap.
- D4. Prior Battle audit/review inspected; listed protocol/LP/announcement findings differ. Root mapping-failure fallback exists; F1 concerns **component boundary failure after successful mapping**, not mapping failure.

## Coverage — all assigned files FULL

| ID | Sorted position | File | Coverage |
|---|---:|---|---|
| C1 | 1 | `src/battle/app/acceptance/acceptance-scenario.ts` | FULL 1–39 |
| C2 | 3 | `src/battle/app/acceptance/full-height-field-scenarios.ts` | FULL 1–280 |
| C3 | 5 | `src/battle/app/components/DuelField.svelte` | FULL 1–1673 |
| C4 | 7 | `src/battle/app/components/SettingsDialog.svelte` | FULL 1–226 |
| C5 | 9 | `src/battle/app/components/duel-field/CardControl.svelte` | FULL 1–378 |
| C6 | 11 | `src/battle/app/components/duel-field/DuelFieldErrorBoundary.svelte` | FULL 1–144 |
| C7 | 13 | `src/battle/app/components/duel-field/FieldBoard.svelte` | FULL 1–377 |
| C8 | 15 | `src/battle/app/components/duel-field/HandBand.svelte` | FULL 1–152 |
| C9 | 17 | `src/battle/app/components/duel-field/MaterialSelectDialog.svelte` | FULL 1–176 |
| C10 | 19 | `src/battle/app/components/duel-field/ZoneListDialog.svelte` | FULL 1–298 |
| C11 | 21 | `src/battle/app/images/semantic-image-leases.ts` | FULL 1–165 |
| C12 | 23 | `src/battle/app/presentation/dom-feedback-controller.ts` | FULL 1–331 |
| C13 | 25 | `src/battle/app/presentation/presentation-command.ts` | FULL 1–267 |
| C14 | 27 | `src/battle/app/presentation/selected-hand-zoom.ts` | FULL 1–41 |
| C15 | 29 | `src/battle/app/prompts/auto-placement.ts` | FULL 1–45 |
| C16 | 31 | `src/battle/app/prompts/drop-target.ts` | FULL 1–58 |
| C17 | 33 | `src/battle/app/prompts/field-navigation.ts` | FULL 1–168 |
| C18 | 35 | `src/battle/app/prompts/interaction-spec.ts` | FULL 1–587 |
| C19 | 37 | `src/battle/app/prompts/phase-transitions.ts` | FULL 1–52 |
| C20 | 39 | `src/battle/app/prompts/prompt-surface.ts` | FULL 1–24 |
| C21 | 41 | `src/battle/app/stores/persisted-ui-store.ts` | FULL 1–63 |
| C22 | 43 | `src/battle/components/RotationNotice.svelte` | FULL 1–73 |
| C23 | 45 | `src/battle/duel/presets/decks/chapter-one-practice.ydk` | FULL 1–44 |
| C24 | 47 | `src/battle/duel/presets/decks/nekroz.ydk` | FULL 1–59 |
| C25 | 49 | `src/battle/duel/presets/decks/player.ydk` | FULL 1–44 |
| C26 | 51 | `src/battle/duel/presets/decks/spellbook.ydk` | FULL 1–59 |
| C27 | 53 | `src/battle/field/duel-field-geometry.ts` | FULL 1–271 |
| C28 | 55 | `src/battle/field/perspective.ts` | FULL 1–12 |
| C29 | 57 | `src/battle/storage/revision-cache-cleanup.ts` | FULL 1–48 |
| C30 | 59 | `src/battle/storage/snapshot-store.ts` | FULL 1–761 |
| C31 | 61 | `src/battle/worker/assets/browser-runtime-assets.ts` | FULL 1–512 |
| C32 | 63 | `src/battle/worker/assets/runtime-snapshot-node.ts` | FULL 1–148 |
| C33 | 65 | `src/shell/adapters/legacy-collection.ts` | FULL 1–24 |
| C34 | 67 | `src/shell/adapters/legacy-frozen-vendor-pin.ts` | FULL 1–3 |
| C35 | 69 | `src/shell/adapters/legacy-installed-runtime-receipt.ts` | FULL 1–251 |
| C36 | 71 | `src/shell/adapters/legacy-runtime-digest.ts` | FULL 1–31 |
| C37 | 73 | `src/shell/adapters/legacy-verify-runtime-support.ts` | FULL 1–96 |
| C38 | 75 | `src/shell/admin/AdminConsole.svelte` | FULL 1–279 |
| C39 | 77 | `src/shell/application/core-startup.ts` | FULL 1–10 |
| C40 | 79 | `src/shell/application/legacy-content.ts` | FULL 1–58 |
| C41 | 81 | `src/shell/application/saved-content-refs.ts` | FULL 1–82 |
| C42 | 83 | `src/shell/cards/deck-cover.ts` | FULL 1–37 |
| C43 | 85 | `src/shell/domain-loaders.ts` | FULL 1–115 |
| C44 | 87 | `src/shell/screens/DomainLoadError.svelte` | FULL 1–75 |
| C45 | 89 | `src/shell/screens/InstallContentScreen.svelte` | FULL 1–242 |
| C46 | 91 | `src/shell/screens/ShellSettingsDialog.svelte` | FULL 1–59 |
| C47 | 93 | `src/shell/screens/free-play-deck-tiles.ts` | FULL 1–55 |
| C48 | 95 | `src/shell/screens/story-save-presence.ts` | FULL 1–102 |
| C49 | 97 | `src/shell/settings/shell-settings.ts` | FULL 1–157 |
| C50 | 99 | `src/shell/toast/ToastHost.svelte` | FULL 1–147 |
| C51 | 101 | `src/shell/toast/toast-store.ts` | FULL 1–137 |
| C52 | 103 | `src/story/components/CardPreviewHost.svelte` | FULL 1–75 |
| C53 | 105 | `src/story/components/ChoiceList.svelte` | FULL 1–52 |
| C54 | 107 | `src/story/components/StoryCardTile.svelte` | FULL 1–75 |
| C55 | 109 | `src/story/components/icons/GearIcon.svelte` | FULL 1–22 |
| C56 | 111 | `src/story/components/zoom-window-position.ts` | FULL 1–99 |
| C57 | 113 | `src/story/overlays/HistoryOverlay.svelte` | FULL 1–48 |
| C58 | 115 | `src/story/overlays/PauseOverlay.svelte` | FULL 1–121 |
| C59 | 117 | `src/story/overlays/SettingsOverlay.svelte` | FULL 1–146 |
| C60 | 119 | `src/story/playback/story-playback-settings.ts` | FULL 1–83 |
| C61 | 121 | `src/story/playback/story-read-log.ts` | FULL 1–72 |
| C62 | 123 | `src/story/screens/BattleHandoffScreen.svelte` | FULL 1–113 |
| C63 | 125 | `src/story/screens/OutcomeScreen.svelte` | FULL 1–126 |
| C64 | 127 | `src/story/screens/RewardScreen.svelte` | FULL 1–128 |
| C65 | 129 | `src/story/shop/BoosterOpeningScreen.svelte` | FULL 1–463 |
| C66 | 131 | `src/story/shop/SellImpactDialog.svelte` | FULL 1–135 |
| C67 | 133 | `src/story/shop/ShopBrowseScreen.svelte` | FULL 1–180 |
| C68 | 135 | `src/story/shop/ShopSellScreen.svelte` | FULL 1–285 |
| C69 | 137 | `src/styles/app.css` | FULL 1–3099 |

## Residual risks

- U1. No assigned source ranges remain. Even-position coverage belongs to other auditor.
- U2. No tests reviewed/run. No browser, build, lint, typecheck, performance or real-WASM acceptance claim.
- U3. Findings require focused mounted regressions; static traces do not establish browser acceptance.
- U4. Deck data read fully; asset availability/card legality not revalidated.
- U5. Output persistence pending because read-only instruction prohibited artifact writes.