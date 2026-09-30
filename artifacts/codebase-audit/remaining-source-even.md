# Remaining-source audit — even partition

## Review

- R1. **Done:** 69/69 assigned text files fully read; 9,881 lines. Every read chunk ≤300 lines; continued through EOF.
- R2. **Findings:** E1 P2 keyboard-access defect; E2 P3 selector-contract violations; E3 P3 incorrect encounter label.
- R3. **Correct:** concealed card/material identities filtered in `src/battle/field/board-view-model.ts:371–450`; runtime integrity chain checked in `src/shell/adapters/legacy-prepare-installed-runtime.ts:59–155`.
- R4. **Fixed:** none. No writes, tests, probes, commits, staging, subagents.
- R5. **Blocker:** none identified within inspected scope. Runtime acceptance not performed.
- R6. Report destination: `/home/aron/Projects/ascencio/artifacts/codebase-audit/remaining-source-even.md`. Read-only constraint → complete report returned for runtime persistence.

## Assumptions

- A1. Partition: extract P109 + N32 path blocks; remove three binary fonts; sort remaining 138 paths; own indices 0,2,…,136.
- A2. Findings source-confirmed through executable branches/rendered-element semantics. Repro traces below **not executed**; tests prohibited.
- A3. Severity: P2 reachable interaction failure; P3 presentation/convention defect.
- A4. Reviewed root HEAD `26da126`. Final scoped diff against initial HEAD empty → assigned sources unchanged during review.
- A5. `graphify` unavailable: `/bin/bash: line 1: graphify: command not found`. Source inspection substituted.

## E1 — P2: insufficient DP blocks keyboard card inspection

**Evidence:** `src/story/shop/ShopCardListScreen.svelte:127–158`.

Card preview changes through tile `onmouseenter`/`onfocusin` (`:133–137`). Tile has no `tabindex`; only focusable descendant is Buy button, disabled when `dp < card.priceDp` (`:151–156`). `StoryCardTile.svelte:29–48` contributes only image/span elements.

**Source-derived repro trace:** spend DP below price of noninitial card → open set card list → navigate using Tab → disabled Buy button skipped → tile never receives focus → preview remains another card. Hover still works. Purchase affordability incorrectly gates reading card text.

Reachable wallet changes: `src/story/model/story-reducer.ts:246–257` deducts single-card price; `src/story/StoryApp.svelte:1194–1203` passes current DP into this screen. Preview defaults to first card (`ShopCardListScreen.svelte:44–50`), leaving later unaffordable cards inaccessible through keyboard preview.

**Minimal fix:** independent keyboard-focusable preview target; keep Buy disabled. Existing tile focus handler can serve focusable tile.

**Regression:** extend `tests/component/story/ShopCardList.test.ts`: ≥2 cards, insufficient DP, sequential keyboard navigation reaches second preview target; second card text appears; Buy remains disabled; no purchase callback. Confirm native Tab behavior in Chromium. Neither check run.

## E2 — P3: repeated literal `data-cy` values violate rendered-document contract

**Evidence:** `src/battle/app/components/duel-field/DuelHud.svelte:79–112`; `src/battle/app/prompts/PromptControls.svelte:332–352,394–400`.

**Source-derived repro traces:**

- D1. Enable Duel HUD → `App.svelte:1290–1297` mounts `DuelHud` → two player iterations emit identical `duel-hud-player-heading`, `duel-hud-player-name`, `duel-hud-player-life-points`, count selectors.
- D2. Open multiple-choice workspace prompt with two choices → `PromptControls.svelte:348` emits `prompt-controls-multiple-choice-text` twice.
- D3. Open ordering workspace prompt with two choices → `PromptControls.svelte:399` emits `prompt-controls-order-choice-index` twice.
- D4. HUD card loop also repeats card-position/counter/material descendants (`DuelHud.svelte:193–230`).

AGENTS requires unique rendered-document values, stable loop suffixes. Selectors become ambiguous even with otherwise-valid UI state.

**Minimal fix:** suffix player descendants with `player.player`; card descendants with `card.instanceId`; nested counter descendants with card identity + counter identity; prompt descendants with `choice.id`.

**Regression:** extend `tests/unit/data-cy-coverage.test.ts` with two-player HUD, multiple inspectable cards, multi-choice workspace prompt, ordering workspace prompt. Existing test source fully read: static scan counts source sites; rendered workspace check uses chain/single family (`:650–704`), not affected multiple/order branches. No test executed.

Prior ChainStatus observation excluded; E2 identifies separate newly inspected sites.

## E3 — P3: Archive briefing still identifies opponent as Rin

**Evidence:** `src/story/screens/PreBattleScreen.svelte:33,93–98,197–198`; `src/story/StoryApp.svelte:1100–1113`.

`opponentName` defaults to `"Rin's Echo"`. Host never supplies it. Default feeds briefing title plus locked opponent seat.

**Source-derived repro trace:** complete first duel → acknowledge reward → reducer unlocks Archive (`src/story/model/story-reducer.ts:203–215`) → select Archive → `encounterId = "archive"`, screen becomes `pre-battle` (`:166–178`) → briefing still displays `"Rin's Echo"`. Start handoff uses `ENCOUNTER_LABELS[encounterId]` (`StoryApp.svelte:705–708`), whose Archive value is `"Archive echo"` (`src/story/handoff/story-handoff.ts:65–70`).

**Minimal fix:** supply current encounter label from existing `ENCOUNTER_LABELS` mapping at host call site. Avoid second mapping.

**Regression:** parent-mounted StoryApp test: unlock/select Archive → briefing title/locked seat show `"Archive echo"` → handoff label matches. Retain Old Arena label case. Existing `tests/component/story/pre-battle-deck-picker.test.ts` located, not reviewed/run.

## Duplication control

- X1. Root includes initial Content/Battle/Story integrations; inspected git log/stat evidence.
- X2. Deck worktree HEAD `221ec16`: changed-path inventory covers editor/deck-selection/history/import corrections; none modifies E1–E3 sites.
- X3. Tooling HEAD `6704f2a` plus dirty tooling diff: source-cache/build-server/CI changes; no E1–E3 overlap.
- X4. Runtime-followup dirty diff inspected: toggle response, draw result, greeting key handling. Known F1/F2/F3 excluded.
- X5. Battle correction modifies announcement pagination in `PromptControls.svelte`; E2 concerns untouched multiple/order selector descendants.
- X6. Story correction modifies save/navigation flow; E3 briefing call remains missing encounter-label prop.

## Assigned source coverage

All rows **FULL**. Index refers to sorted 138-text-path inventory.

| ID | Index | File |
|---|---:|---|
| C1 | 0 | `src/battle/app/acceptance/AcceptanceHarness.svelte` |
| C2 | 2 | `src/battle/app/acceptance/card-list-dialog-scenarios.ts` |
| C3 | 4 | `src/battle/app/components/DeckPicker.svelte` |
| C4 | 6 | `src/battle/app/components/DuelRail.svelte` |
| C5 | 8 | `src/battle/app/components/duel-field/CardActionChips.svelte` |
| C6 | 10 | `src/battle/app/components/duel-field/CardTray.svelte` |
| C7 | 12 | `src/battle/app/components/duel-field/DuelHud.svelte` |
| C8 | 14 | `src/battle/app/components/duel-field/FloatingFieldWindow.svelte` |
| C9 | 16 | `src/battle/app/components/duel-field/HandZoomOverlay.svelte` |
| C10 | 18 | `src/battle/app/components/duel-field/StackControl.svelte` |
| C11 | 20 | `src/battle/app/components/duel-field/ZoneListEntryTile.svelte` |
| C12 | 22 | `src/battle/app/presentation/card-list-dialog-model.ts` |
| C13 | 24 | `src/battle/app/presentation/end-turn-automation.ts` |
| C14 | 26 | `src/battle/app/presentation/prompt-context-message.ts` |
| C15 | 28 | `src/battle/app/prompts/PromptControls.svelte` |
| C16 | 30 | `src/battle/app/prompts/auto-response.ts` |
| C17 | 32 | `src/battle/app/prompts/duel-priority.ts` |
| C18 | 34 | `src/battle/app/prompts/hand-activation-choices.ts` |
| C19 | 36 | `src/battle/app/prompts/pending-placement.ts` |
| C20 | 38 | `src/battle/app/prompts/prompt-control-family.ts` |
| C21 | 40 | `src/battle/app/stores/persisted-ui-state.ts` |
| C22 | 42 | `src/battle/app/stores/ui-settings-store.ts` |
| C23 | 44 | `src/battle/duel/presets/decks/burning-abyss.ydk` |
| C24 | 46 | `src/battle/duel/presets/decks/chapter-one-starter.ydk` |
| C25 | 48 | `src/battle/duel/presets/decks/opponent.ydk` |
| C26 | 50 | `src/battle/duel/presets/decks/shaddoll.ydk` |
| C27 | 52 | `src/battle/field/board-view-model.ts` |
| C28 | 54 | `src/battle/field/duel-field-layout.ts` |
| C29 | 56 | `src/battle/field/placement-candidates.ts` |
| C30 | 58 | `src/battle/storage/snapshot-digest.ts` |
| C31 | 60 | `src/battle/worker/assets/active-duel-dependencies-node.ts` |
| C32 | 62 | `src/battle/worker/assets/runtime-manifest.ts` |
| C33 | 64 | `src/shell/adapters/legacy-battle-runtime.ts` |
| C34 | 66 | `src/shell/adapters/legacy-content-api.ts` |
| C35 | 68 | `src/shell/adapters/legacy-gameplay-validation.ts` |
| C36 | 70 | `src/shell/adapters/legacy-prepare-installed-runtime.ts` |
| C37 | 72 | `src/shell/adapters/legacy-runtime-manifest.ts` |
| C38 | 74 | `src/shell/adapters/runtime-activation.ts` |
| C39 | 76 | `src/shell/admin/admin-actions.ts` |
| C40 | 78 | `src/shell/application/installer-chapter-sizes.ts` |
| C41 | 80 | `src/shell/application/legacy-installer.ts` |
| C42 | 82 | `src/shell/application/shell-bootstrap.ts` |
| C43 | 84 | `src/shell/content/content-error-copy.ts` |
| C44 | 86 | `src/shell/index.ts` |
| C45 | 88 | `src/shell/screens/FreePlayMatchSetup.svelte` |
| C46 | 90 | `src/shell/screens/MainMenuScreen.svelte` |
| C47 | 92 | `src/shell/screens/free-play-deck-actions.ts` |
| C48 | 94 | `src/shell/screens/free-play-opponents.ts` |
| C49 | 96 | `src/shell/settings/shell-settings-store.ts` |
| C50 | 98 | `src/shell/stage-layout.ts` |
| C51 | 100 | `src/shell/toast/toast-context.ts` |
| C52 | 102 | `src/story/cards/deck-cover.ts` |
| C53 | 104 | `src/story/components/CardZoomInspector.svelte` |
| C54 | 106 | `src/story/components/RaritySortButton.svelte` |
| C55 | 108 | `src/story/components/icons/DeckIcon.svelte` |
| C56 | 110 | `src/story/components/icons/ShopIcon.svelte` |
| C57 | 112 | `src/story/index.ts` |
| C58 | 114 | `src/story/overlays/LoadOverlay.svelte` |
| C59 | 116 | `src/story/overlays/SaveLoadOverlay.svelte` |
| C60 | 118 | `src/story/playback/story-playback-settings-store.ts` |
| C61 | 120 | `src/story/playback/story-playback.ts` |
| C62 | 122 | `src/story/saves/index.ts` |
| C63 | 124 | `src/story/screens/NarrativeScreen.svelte` |
| C64 | 126 | `src/story/screens/PreBattleScreen.svelte` |
| C65 | 128 | `src/story/shop/BoosterInventoryDialog.svelte` |
| C66 | 130 | `src/story/shop/BoosterResultsScreen.svelte` |
| C67 | 132 | `src/story/shop/SetTile.svelte` |
| C68 | 134 | `src/story/shop/ShopCardListScreen.svelte` |
| C69 | 136 | `src/story/shop/ShopSetDialog.svelte` |

## Residual risks

- U1. No assigned unread ranges remain. Odd partition outside ownership; no full-review claim for cross-file references.
- U2. Additional full reads: AGENTS, prior remaining-source report, `StoryCardTile.svelte`, `shop-pricing.ts`, `story-handoff.ts`, `tests/unit/data-cy-coverage.test.ts`.
- U3. `StoryApp.svelte`, `AppShell.svelte`, battle `App.svelte`, story reducer/state received targeted reads/search only.
- U4. No tests/probes/browser checks/build/lint/typecheck/benchmarks executed. Proposed regressions remain pending.
- U5. Other test sources unreviewed. YDK text reviewed; card/script legality not independently validated.
- U6. Existing unrelated dirty files preserved. Final staged-file listing empty; no claim whole repo clean.
- U7. Next action: implement E1–E3 narrowly; execute described regressions; obtain Chromium keyboard evidence for E1.