# Test shard 4 audit

## Review

- R1. **Done:** 61/61 assigned files FULL; **16,213 lines**. Assigned reads ≤300 lines, through EOF. PARTIAL: none. UNREAD: none.
- R2. **F1 — P2:** stale decklist selector blocks frame assertion.
- R3. **F2 — P3:** cold-start fixture injects completion without starting duel.
- R4. **Correct:** separate cold-start test seeds fieldable deck, waits for Worker start, checks restored cards (`tests/component/StoryDuelHandoff.test.ts:347–377`).
- R5. **Fixed:** none. No edits, tests, runtime probes, commits, staging, subagents.
- R6. **Blocker:** F1 requires correction before affected component-suite acceptance.
- R7. **Output:** READ ONLY overrides writing. Report returned for runtime persistence at `/home/aron/Projects/ascencio/artifacts/codebase-audit/test-shard-4.md`.

## F1 — P2: stale selector prevents frame regression reaching assertion

**Evidence:** `tests/component/story/pre-battle-deck-picker.test.ts:139–163`; `src/deck-select/DecklistPanel.svelte:73–96`; `src/deck-select/DeckSelectScreen.svelte:770–773`.

Test waits for:

```text
deck-select-seat-list-player-row-1322368
```

Current panel emits:

```text
deck-select-seat-list-player-main-row-1322368
```

`PreBattleScreen` places fixture card in `main` (`src/story/screens/PreBattleScreen.svelte:133–142`). `DecklistPanel` includes `part.id` in every row selector.

**Static failure trace, unexecuted:** render → correct `main` row appears → obsolete selector stays null → `waitFor` fails before `--fc` assertion. Config includes affected file (`vitest.config.ts:9`).

**Correction:** update both selectors at test lines 156, 160. Preserve `"#1d6ea8"` assertion.

**Next action:** test owner applies selector correction; preserves concurrent UI worker’s Archive regression on same path; runs:

```sh
npx vitest run tests/component/story/pre-battle-deck-picker.test.ts --maxWorkers=1
```

No production frame defect inferred.

## F2 — P3: cold-start test completes duel never started

**Evidence:** `tests/component/StoryDuelHandoff.test.ts:450–475`.

Fixture spreads initial state without overriding `decks`, `defaultDeckId`, `collection`. Initial values remain empty/null (`src/story/model/story-state.ts:140–142`).

**Static trace, unexecuted:**

- T1. `encounterDeck` finds no chosen deck → returns null (`src/story/decks/encounter-deck.ts:37–38`).
- T2. Shell rebuild returns null request (`src/shell/AppShell.svelte:456–467`).
- T3. Checkpoint restoration still sets `sessionReady`; facade mounts (`src/shell/AppShell.svelte:519–524,1150–1169`).
- T4. `battle-root` proves facade mount only (`src/battle/BattleFacade.svelte:58–67`). Null request cannot auto-start (`src/battle/app/App.svelte:810–816`).
- T5. Test directly injects surrendered result through mock listeners (`tests/component/StoryDuelHandoff.test.ts:220–227,471`). Store accepts matching-context result without requiring started session (`src/battle/app/stores/duel-store.ts:161,276–291`).

**Impact:** test claims checkpoint restart → exercises mounted picker plus fabricated completion instead. Abort assertions do not establish abort-after-restored-duel behavior. Separate valid cold-start test at lines 347–377 remains useful; no blanket recovery-coverage failure claimed.

**Correction:** reuse fieldable checkpoint setup; await `startedSeats()` before injecting result. Assert restored player cards, absent picker. Alternatively relabel existing case explicitly as legacy picker handoff; do not retain automatic-restart claim.

**Next action:** test owner corrects fixture, runs:

```sh
npx vitest run tests/component/StoryDuelHandoff.test.ts --maxWorkers=1
```

## Assumptions / dedup

- A1. Scope: shard `id: 4`, inventory frozen at `26da126`; current working bytes reviewed.
- A2. Findings source-confirmed, not executed reproductions. No test-pass claim.
- A3. `AGENTS.md` read. Requested `plan.md`, `progress.md` absent. `graphify-out/GRAPH_REPORT.md` absent; direct static inspection used.
- A4. Prior shard 1–3 findings, even/odd test findings, remaining-source findings consulted. Known storage, fixture cleanup, CRC/MIME/SW ordering, perf/teardown, LoadScreen/editor-import assertions, six UI defects excluded.
- A5. F1 differs from known Archive-label defect. F2 concerns test fixture/oracle, not new product-recovery finding.
- A6. Supporting src reads targeted; no whole-src re-audit claimed.

## Revision checks

- V1. Initial/final HEAD: `0bbe94e6115221e98a2d505c1e69241c066cde57`.
- V2. Final assigned-path diff against initial HEAD empty. Assigned working-tree diff empty.
- V3. Static inventory: 61 files; current endpoints match manifest; total 16,213 lines.
- V4. Six assigned files differ from frozen inventory; current bytes fully read, diffs inspected:

| ID | Path | Integrated delta |
|---|---|---|
| D1 | `tests/component/deck-editor/advanced-card-search.test.ts` | Loader setup, marker-rule regression |
| D2 | `tests/component/deck-editor/deck-autosave.test.ts` | Save/navigation serialization regressions |
| D3 | `tests/component/deck-editor/deck-library-images.test.ts` | Section-qualified selectors |
| D4 | `tests/component/deck-select/seat-panel.test.ts` | Section-qualified selectors, opponent-seat navigation |
| D5 | `tests/component/story/ShopGreeting.test.ts` | Keyboard-control regressions |
| D6 | `tests/unit/decks/deck-database-migration.test.ts` | Divergent-row preservation regressions |

- V5. Final `git diff --cached --name-only`: empty. No repo-wide clean claim.
- V6. Report destination absent at final check; runtime persistence pending.

## Coverage ledger

All assigned ranges **FULL through EOF**. PARTIAL: none. UNREAD: none.

| ID | Path | FULL range |
|---|---|---|
| C1 | `tests/component/AppChrome.test.ts` | 1–1422 |
| C2 | `tests/component/AppLocalDecks.test.ts` | 1–366 |
| C3 | `tests/component/CardPreviewPanel.test.ts` | 1–118 |
| C4 | `tests/component/FieldActionBar.test.ts` | 1–384 |
| C5 | `tests/component/MainMenuScreen.test.ts` | 1–206 |
| C6 | `tests/component/OverlayScrollbar.test.ts` | 1–167 |
| C7 | `tests/component/SettingsDialog.test.ts` | 1–143 |
| C8 | `tests/component/StoryDuelHandoff.test.ts` | 1–531 |
| C9 | `tests/component/deck-editor/advanced-card-search.test.ts` | 1–232 |
| C10 | `tests/component/deck-editor/card-tile-art.test.ts` | 1–176 |
| C11 | `tests/component/deck-editor/click-semantics.test.ts` | 1–90 |
| C12 | `tests/component/deck-editor/deck-autosave.test.ts` | 1–699 |
| C13 | `tests/component/deck-editor/deck-entry.test.ts` | 1–72 |
| C14 | `tests/component/deck-editor/deck-favourites.test.ts` | 1–57 |
| C15 | `tests/component/deck-editor/deck-library-images.test.ts` | 1–350 |
| C16 | `tests/component/deck-editor/deck-ownership-legality.test.ts` | 1–157 |
| C17 | `tests/component/deck-editor/default-deck.test.ts` | 1–220 |
| C18 | `tests/component/deck-editor/variant-b-panels.test.ts` | 1–198 |
| C19 | `tests/component/deck-editor/ydk-export.test.ts` | 1–75 |
| C20 | `tests/component/deck-select/seat-panel.test.ts` | 1–326 |
| C21 | `tests/component/deck-select/tile-builder.ts` | 1–21 |
| C22 | `tests/component/installed-free-play.test.ts` | 1–61 |
| C23 | `tests/component/story/ShopCardList.test.ts` | 1–298 |
| C24 | `tests/component/story/ShopGreeting.test.ts` | 1–134 |
| C25 | `tests/component/story/ShopSell.test.ts` | 1–187 |
| C26 | `tests/component/story/TitleAndLoad.test.ts` | 1–80 |
| C27 | `tests/component/story/pre-battle-deck-picker.test.ts` | 1–654 |
| C28 | `tests/unit/active-card-text-manifest.test.ts` | 1–26 |
| C29 | `tests/unit/agents-doc-trunk.test.ts` | 1–32 |
| C30 | `tests/unit/application-selector.test.ts` | 1–294 |
| C31 | `tests/unit/battle-contracts.test.ts` | 1–255 |
| C32 | `tests/unit/chapter-source-policy.test.ts` | 1–218 |
| C33 | `tests/unit/deck-editor/click-intent.test.ts` | 1–42 |
| C34 | `tests/unit/deck-editor/deck-library-tiles.test.ts` | 1–258 |
| C35 | `tests/unit/decks/deck-database-migration.test.ts` | 1–442 |
| C36 | `tests/unit/decks/deck-resolver.test.ts` | 1–105 |
| C37 | `tests/unit/decks/ydk-adapter.test.ts` | 1–52 |
| C38 | `tests/unit/download-diagnostics.test.ts` | 1–92 |
| C39 | `tests/unit/duel-phase-label.test.ts` | 1–37 |
| C40 | `tests/unit/duel-rules-profile.test.ts` | 1–144 |
| C41 | `tests/unit/duel-session.test.ts` | 1–66 |
| C42 | `tests/unit/end-turn-automation.test.ts` | 1–185 |
| C43 | `tests/unit/global-styles.test.ts` | 1–1002 |
| C44 | `tests/unit/immutable-choice-id-set.test.ts` | 1–40 |
| C45 | `tests/unit/installed-card-image-source.test.ts` | 1–279 |
| C46 | `tests/unit/interaction-spec.test.ts` | 1–1031 |
| C47 | `tests/unit/opponent-policy.test.ts` | 1–518 |
| C48 | `tests/unit/progressive-manifest-memo.test.ts` | 1–267 |
| C49 | `tests/unit/prompt-registry.test.ts` | 1–1114 |
| C50 | `tests/unit/replay-opponent-policy.test.ts` | 1–134 |
| C51 | `tests/unit/service-worker-install.test.ts` | 1–89 |
| C52 | `tests/unit/set-image-acquisition.test.ts` | 1–101 |
| C53 | `tests/unit/story/contrast.test.ts` | 1–118 |
| C54 | `tests/unit/story/credit-at-open.test.ts` | 1–156 |
| C55 | `tests/unit/story/opened-card-quantities.test.ts` | 1–99 |
| C56 | `tests/unit/story/shop-data.test.ts` | 1–236 |
| C57 | `tests/unit/story/shop-set-fold.test.ts` | 1–105 |
| C58 | `tests/unit/story/story-deck-context.test.ts` | 1–205 |
| C59 | `tests/unit/story/story-handoff.test.ts` | 1–109 |
| C60 | `tests/unit/story/story-state.test.ts` | 1–811 |
| C61 | `tests/unit/ui-settings-store.test.ts` | 1–127 |

## Residual risks

- U1. Static review only. Tests, mutations, browser checks, build, lint, typecheck unexecuted.
- U2. F1/F2 remain unfixed. Exact corrective actions above.
- U3. Later integrations outside final observed revision unreviewed. F1 overlaps active UI worker’s test path.
- U4. Other shards outside assignment. FULL denotes completed reads, not exhaustive correctness proof.
- U5. No files created, removed, staged. Artifact persistence requires runtime.