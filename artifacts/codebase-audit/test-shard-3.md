# Test shard 3 audit

## Review

- R1. **Done:** 58/58 assigned files FULL; **16,212 lines**. Reads ≤300 lines, continued through EOF. No assigned PARTIAL/UNREAD ranges.
- R2. **Finding F1 — P2:** stale occupied-save fixture dereferences absent Delete control.
- R3. **Correct:** semantic-image tests exercise delayed completion, replacement, cancellation, lease release (`tests/component/semantic-image-readiness.test.ts:293–376`), matching lifecycle guards (`src/battle/app/images/semantic-image-leases.ts:69–96,145–157`).
- R4. **Fixed:** none. No edits, tests, runtime probes, commits, staging, subagents.
- R5. **Blocker:** F1 requires fixture correction before affected component suite can pass. No new P1 confirmed.
- R6. **Output:** read-only constraint overrides file write. Report returned for runtime persistence at `/home/aron/Projects/ascencio/artifacts/codebase-audit/test-shard-3.md`.

## F1 — P2: destructive-confirmation test no longer creates occupied slot

**Evidence:** `tests/component/story/cancel-controls.test.ts:183–188` renders:

```ts
render(LoadScreen, { showCorrupt: false });
```

Then queries `story-load-slot-manual-delete`, calls `trigger.click()`.

Current contract: `src/story/screens/LoadScreen.svelte:6` defaults `manualSummary` to `null`. Lines 64–76 render empty manual slot for null summary. Delete control exists only in occupied branch, lines 94–100.

**Source-confirmed failure:** fixture omits summary → empty slot → query returns null → TypeScript assertion supplies no runtime guard → `.click()` fails before intended danger/cancel assertions at lines 196–199.

**Origin:** Story save-contract correction already integrated; source history identifies `1bb9697`, `fix(story): preserve progress across saves and route transitions`. This leftover test-fixture regression differs from previously reported product empty-slot defect.

**Impact:** configured component suite includes affected file (`vitest.config.ts:9`). Test cannot reach its intended assertion under current source contract. Runtime reproduction prohibited; no observed error string claimed.

**Minimal correction:** supply non-null `manualSummary` representing occupied save. Keep production empty-slot behavior unchanged. Preserve existing danger/cancel assertions; assert Delete control exists before activation.

**Regression / exact next action:** parent corrects fixture, runs:

```sh
npx vitest run tests/component/story/cancel-controls.test.ts --maxWorkers=1
```

Not run here. Existing empty-slot tests must remain intact.

## Assumptions / dedup

- A1. Assignment uses shard `id: 3` from `artifacts/codebase-audit/remaining-test-shards.json`; inventory frozen at `26da126`; inspected current working bytes.
- A2. AGENTS read. Requested `plan.md`, `progress.md` absent. Graph query failed: `/bin/bash: line 1: graphify: command not found`. Direct inspection substituted.
- A3. Consulted ledger, initial Battle/Story/Tooling findings, Content/Decks reviews, remaining-source reports, prior even/odd test findings. F1 search found only prior unread-path entry, no duplicate finding.
- A4. Known Node26 JSDOM storage, producer/publisher cleanup, CRC false-green, stale validation-envelope findings excluded. Six active UI findings excluded.
- A5. Findings require concrete assertion/source mismatch; missing coverage alone, style, speculative product changes excluded. No further new finding confirmed.

## Revision check

- V1. Initial/final observed HEAD: `0bbe94e6115221e98a2d505c1e69241c066cde57`.
- V2. Assigned-path diff against initial HEAD empty. Assigned working-tree diff empty.
- V3. Against frozen `26da126`, two assigned files changed: `tests/component/BattleFacade.test.ts` (+34 lines, draw regression); `tests/unit/content-tooling-gates.test.ts` (+24 lines, browser-gate assertions). Both current files fully read; exact diffs inspected.
- V4. Current per-file lengths match manifest endpoints; total 16,212 lines.
- V5. Final `git diff --cached --name-only` empty. Existing unrelated dirty work preserved. No repo-wide clean claim.
- V6. Report destination absent at final existence check; runtime persistence pending.

## Assigned coverage ledger

Every range includes EOF. **PARTIAL: none. UNREAD: none.**

| ID | Path | Coverage |
|---|---|---|
| C1 | `tests/component/BattleFacade.test.ts` | FULL 1–667 |
| C2 | `tests/component/DuelHud.test.ts` | FULL 1–200 |
| C3 | `tests/component/MaterialSelectDialog.test.ts` | FULL 1–176 |
| C4 | `tests/component/ProjectedChoiceMenu.test.ts` | FULL 1–140 |
| C5 | `tests/component/deck-editor/advanced-search-load-error.test.ts` | FULL 1–38 |
| C6 | `tests/component/deck-editor/advanced-search-loader-generation.test.ts` | FULL 1–40 |
| C7 | `tests/component/deck-editor/catalog-infinite-scroll.test.ts` | FULL 1–316 |
| C8 | `tests/component/deck-editor/deck-editor-a11y.test.ts` | FULL 1–119 |
| C9 | `tests/component/deck-editor/load-deck-dialog.test.ts` | FULL 1–330 |
| C10 | `tests/component/deck-editor/quantity-badge.test.ts` | FULL 1–53 |
| C11 | `tests/component/deck-select/compact-layout.test.ts` | FULL 1–183 |
| C12 | `tests/component/deck-select/deck-select-screen.test.ts` | FULL 1–576 |
| C13 | `tests/component/deck-select/deck-tile.test.ts` | FULL 1–265 |
| C14 | `tests/component/semantic-image-readiness.test.ts` | FULL 1–377 |
| C15 | `tests/component/shell/toast-host.test.ts` | FULL 1–42 |
| C16 | `tests/component/story/BattleHandoff.test.ts` | FULL 1–86 |
| C17 | `tests/component/story/ShopBrowse.test.ts` | FULL 1–212 |
| C18 | `tests/component/story/cancel-controls.test.ts` | FULL 1–202 |
| C19 | `tests/component/story/card-zoom-inspector.test.ts` | FULL 1–240 |
| C20 | `tests/component/story/installed-story.test.ts` | FULL 1–107 |
| C21 | `tests/component/story/single-pack-reveal.test.ts` | FULL 1–189 |
| C22 | `tests/unit/acceptance-scenario.test.ts` | FULL 1–18 |
| C23 | `tests/unit/active-duel-dependencies.test.ts` | FULL 1–150 |
| C24 | `tests/unit/auto-response.test.ts` | FULL 1–278 |
| C25 | `tests/unit/capped-response-body.test.ts` | FULL 1–101 |
| C26 | `tests/unit/card-frame.test.ts` | FULL 1–68 |
| C27 | `tests/unit/card-mapping.test.ts` | FULL 1–118 |
| C28 | `tests/unit/cards.test.ts` | FULL 1–223 |
| C29 | `tests/unit/content-storage.test.ts` | FULL 1–76 |
| C30 | `tests/unit/content-tooling-gates.test.ts` | FULL 1–54 |
| C31 | `tests/unit/core-gate.test.ts` | FULL 1–82 |
| C32 | `tests/unit/deck-editor/tap-targets.test.ts` | FULL 1–92 |
| C33 | `tests/unit/deck-sources-node.test.ts` | FULL 1–109 |
| C34 | `tests/unit/decks/deck-grid-plan.test.ts` | FULL 1–67 |
| C35 | `tests/unit/decks/deck-model.test.ts` | FULL 1–523 |
| C36 | `tests/unit/decks/deck-repository-context.test.ts` | FULL 1–171 |
| C37 | `tests/unit/decks/ownership-validation.test.ts` | FULL 1–282 |
| C38 | `tests/unit/decks/starter-deck.test.ts` | FULL 1–246 |
| C39 | `tests/unit/decks/ydk-history.test.ts` | FULL 1–156 |
| C40 | `tests/unit/drag-ghost-physics.test.ts` | FULL 1–234 |
| C41 | `tests/unit/duel-field-geometry.test.ts` | FULL 1–210 |
| C42 | `tests/unit/duel-field.test.ts` | FULL 1–893 |
| C43 | `tests/unit/duel-priority.test.ts` | FULL 1–30 |
| C44 | `tests/unit/duel-state-projector.test.ts` | FULL 1–4280 |
| C45 | `tests/unit/installed-assets.test.ts` | FULL 1–354 |
| C46 | `tests/unit/programmed-scenarios.test.ts` | FULL 1–99 |
| C47 | `tests/unit/prompt-context-message.test.ts` | FULL 1–415 |
| C48 | `tests/unit/semantic-release-preparation.test.ts` | FULL 1–789 |
| C49 | `tests/unit/shell/free-play-opponents.test.ts` | FULL 1–29 |
| C50 | `tests/unit/shell/handoff-coordinator.test.ts` | FULL 1–443 |
| C51 | `tests/unit/snapshot-store.test.ts` | FULL 1–261 |
| C52 | `tests/unit/story/card-ownership.test.ts` | FULL 1–65 |
| C53 | `tests/unit/story/collection-grouping.test.ts` | FULL 1–91 |
| C54 | `tests/unit/story/encounter-deck.test.ts` | FULL 1–127 |
| C55 | `tests/unit/story/new-game-grant.test.ts` | FULL 1–104 |
| C56 | `tests/unit/story/story-boundaries.test.ts` | FULL 1–127 |
| C57 | `tests/unit/story/story-release-adapter.test.ts` | FULL 1–149 |
| C58 | `tests/unit/sum-selection.test.ts` | FULL 1–140 |

## Residual risks

- U1. Static audit only. No tests, browser checks, runtime probes, build, lint, typecheck executed.
- U2. F1 correction unimplemented/unvalidated. Active workers’ later changes outside final observed revision not covered.
- U3. Other shards outside ownership. Assigned FULL means source read, not exhaustive proof of correctness.
- U4. Supporting source reads targeted contracts; no fresh whole-source audit claimed.