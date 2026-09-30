# UI / cross-file PR review

State: **done**. Source edits: none. Remote mutations: none.

## Assumptions

- A1. Requested `/home/aron/Projects/ascencio/plan.md` plus `/home/aron/Projects/ascencio/progress.md` do not exist (`read` returned `ENOENT`; repo-wide `find` returned no matches). Review used task brief, PR JSON, PR diffs.
- A2. Parent owns test execution. Commands below are recommended, not run here.
- A3. CI failure diagnosis excluded per task. JSON metadata reports `full-gate: FAILURE` for every reviewed PR.
- A4. Review compares exact head OIDs against common base `456551dc1cf8fc4e9fdb754095f3a8279f5b2c37` plus current `origin/main` `2d721a50177994fb5003cf90b012e67a19842623`; dirty worktree ignored.

## Review

### PR #35 — Approve

SHA: `bd441e6141ef9bcda850a6c5dbe99cc919a083f2`

- P35-1 Correct: membership index rebuilds only when `listed` changes; selection changes use `Set.has`, avoiding catalog scan. Selection clears when catalog, ownership, or Show All removes code. Evidence: `src/story/collection/CollectionScreen.svelte:60-75`.

```diff
+  $: listedCodes = new Set(listed.map(({ code }) => code));
+  $: if (selected !== null && !listedCodes.has(selected.code)) selected = null;
```

- P35-2 Correct: reactive dependency chain is coherent: `ownership/cards/showAll → listed → listedCodes → selected`; `entries` remains independent from `selected`, preserving hover/click/focus bounded work. Evidence: `src/story/collection/CollectionScreen.svelte:57-75`, `src/story/collection/CollectionScreen.svelte:149-151`, `tests/component/story/collection-screen.test.ts:196-300`.
- P35-3 Test cmd: `npx vitest run tests/component/story/collection-screen.test.ts`.
- P35-4 Residual risk: same-code card metadata replacement retains old selected object because membership keys by code. PR description explicitly preserves existing behavior; no regression introduced.

### PR #42 — Approve

SHA: `98458e6c108ffcbd3728b15501ebdfb368a38662`

- P42-1 Correct: `WeakMap` keys by `ShopSetData` snapshot identity; first lookup performs one set/card pass, later lookups perform map lookup. Highest-rarity rule remains `RARITY_ORDER` rank comparison. Evidence: `src/story/shop/data/shop-set-data.ts:137-169`.

```diff
+const rarityIndexByData = new WeakMap<
+  ShopSetData,
+  ReadonlyMap<number, ShopRarity>
+>();
...
+    const rarity = rarityIndex(data).get(code);
+    if (rarity !== undefined) return rarity;
```

- P42-2 Correct: fallback behavior remains unchanged for codes missing from set data (`inferRarity(view)` then `"common"`). Existing coverage verifies printed maximum, inferred fallback, null-data fallback at `tests/unit/story/shop-set-data.test.ts:401-427`; new coverage verifies one index construction at `tests/unit/story/shop-rarity-index.test.ts:45-58`.
- P42-3 Correct: production snapshots are replacement-based. `installedShopSetData` creates frozen snapshots at `src/story/shop/data/shop-set-data.ts:32-49`; image enrichment assigns new top-level identity at `src/story/StoryApp.svelte:579-590`.
- P42-4 Test cmd: `npx vitest run tests/unit/story/shop-rarity-index.test.ts tests/unit/story/shop-set-data.test.ts tests/unit/story/shop-pack-value.test.ts`.
- P42-5 Residual risk: parsed `ShopSetData` is structurally readonly but not runtime-frozen at `src/story/shop/data/shop-set-data.ts:99-113`; unsupported in-place mutation after first lookup would stale cache. No production mutator found.

### PR #43 — Approve

SHA: `f7e88e4b56c00d6ff8678af0e8e390a2d57d32b8`

- P43-1 Correct: undo/redo now receive actual current deck order through both production callers. Evidence: `src/deck-editor/deck-editor-store.ts:422-467`.

```diff
-      const result = undoDeckUpdate(current.history);
+      const result = undoDeckUpdate(current.history, current.deck);
...
-      const result = redoDeckUpdate(current.history);
+      const result = redoDeckUpdate(current.history, current.deck);
```

- P43-2 Correct: membership edits filter current zone by target multiplicity, preserving survivor order, then insert missing copies deterministically. Duplicate counts use occurrence counts, not set membership. Evidence: `src/decks/deck-history.ts:119-159`, duplicate regression `tests/unit/decks/deck-history.test.ts:126-144`.

```diff
+  const restored = current.filter((code) => {
+    const retained = retainedCounts.get(code) ?? 0;
+    if (retained >= (targetCounts.get(code) ?? 0)) return false;
+    retainedCounts.set(code, retained + 1);
+    return true;
+  });
```

- P43-3 Correct: rebasing moved history entry around actual before/after lists preserves round trips across unrecorded reorder. Exact snapshot reasons remain exact for `import`, `restore`, `sort`, matching ADR-037/ADR-070. Evidence: `src/decks/deck-history.ts:75-115`, `src/decks/deck-history.ts:119-130`, `src/decks/deck-history.ts:161-177`, `docs/ADR/037_ADR_manual_deck_order_position_blind_history.md:15-18`, `docs/ADR/070_ADR_explicit_sorts_are_undoable.md:14-26`.
- P43-4 Correct: repository continuity validation compares card multisets, so rebased order does not invalidate stored history. Evidence: `src/decks/indexeddb-deck-repository.ts:549-655`. Controller/IndexedDB coverage exercises add, remove, move across zones at `tests/component/deck-editor/deck-history-order.test.ts:51-139`.
- P43-5 Test cmd: `npx vitest run tests/unit/decks/deck-history.test.ts tests/unit/decks/canonical-sort-matrix.test.ts tests/component/deck-editor/deck-history-order.test.ts tests/component/deck-editor/keyboard-shortcuts.test.ts`.
- P43-6 Residual risk: no randomized long-chain duplicate/multi-zone undo-redo property test. Deterministic unit plus repository-backed component cases cover changed invariants; deck-size bounds keep splice cost negligible.

### PR #53 — Approve

SHA: `86a0e799f8b0b61a22935628401646386d23d5fd`

- P53-1 Correct: reset keys on `CardPreviewView.key`, not object identity. Async image updates rebuild preview object with same key, so they do not unexpectedly reset user scroll. Evidence: `src/shared-svelte-ui/card-preview/CardPreviewPanel.svelte:9-22`, `src/story/components/CardPreviewHost.svelte:25-26`, `src/deck-editor/components/DeckEditor.svelte:157-184`.

```diff
+  let scrolledPreviewKey: string | null = null;
+  $: resetTextScroll(preview?.key ?? null);
+
+  function resetTextScroll(previewKey: string | null): void {
+    if (previewKey === scrolledPreviewKey) return;
+    scrolledPreviewKey = previewKey;
+    if (textScroller !== null) textScroller.scrollTop = 0;
+  }
```

- P53-2 Correct: during non-null card-to-card switch, existing bound scroller resets before updated content paints; new scroller after null state starts at native `0`. Regression verifies retained node resets at `tests/component/card-preview-scroll-reset.test.ts:22-41`.
- P53-3 Test cmd: `npx vitest run tests/component/card-preview-scroll-reset.test.ts tests/component/CardPreviewPanel.test.ts tests/component/deck-editor/card-preview-pane.test.ts tests/component/story/card-preview-host.test.ts`.
- P53-4 Residual risk: tracked regression uses JSDOM; browser timing remains parent-owned validation. Logic has no timer or post-paint race.

### PR #60 — Approve

SHA: `d4f966cf322b0216a5d3bfb785501efeac1afdd8`

- P60-1 Correct: modal-root bubble handler now stops key events before deck editor's window-level bubble shortcut. Native input defaults remain intact because only Escape/Tab call `preventDefault`. Evidence: `src/deck-editor/focus-trap.ts:4-30`, background handler `src/deck-editor/components/DeckEditor.svelte:565-598`.

```diff
 export function handleModalKeydown(
   event: KeyboardEvent,
   close: () => void,
 ): void {
+  event.stopPropagation();
```

- P60-2 Correct: all deck-editor consumers attach helper at dialog/menu root, covering Advanced Search, delete, create, load, tap target, YDK export/import. Evidence: `src/deck-editor/components/AdvancedCardSearch.svelte:126-137`, `src/deck-editor/components/DeckEditor.svelte:914-922`, `src/deck-editor/components/DeckLibrary.svelte:275-292`, `src/deck-editor/components/LoadDeckDialog.svelte:25-34`, `src/deck-editor/components/TapTargetMenu.svelte:19-28`, `src/deck-editor/components/YdkExport.svelte:50-58`, `src/deck-editor/components/YdkImport.svelte:113-125`.
- P60-3 Test cmd: `npx vitest run tests/unit/deck-editor/focus-trap.test.ts tests/component/deck-editor/keyboard-shortcuts.test.ts tests/component/deck-editor/delete-dialog-focus.test.ts`.
- P60-4 Residual risk: bubble-phase isolation cannot stop hypothetical future capture-phase global shortcuts. Current production shortcut is bubble-phase `svelte:window`; no current defect.

### PR #64 — Approve

SHA: `ad56fd33616c152ecb619618f512e101e59b8580`

- P64-1 Correct: option derivation now reads summon frames/traits only from monster subtypes; matcher independently enforces monster family whenever `summonFrame` is selected. Ritual spell remains available through `spellProperty`. Evidence: `src/decks/catalog/deck-catalog-advanced.ts:131-172`, `src/decks/catalog/deck-catalog-advanced.ts:349-375`.

```diff
-    for (const subtype of card.subtypes) subtypes.add(subtype);
+    if (card.family === "monster")
+      for (const subtype of card.subtypes) subtypes.add(subtype);
...
-    if (filters.summonFrame !== null && !hasSubtype(filters.summonFrame))
+    if (
+      filters.summonFrame !== null &&
+      (card.family !== "monster" || !hasSubtype(filters.summonFrame))
+    )
```

- P64-2 Correct: mapper intentionally shares `"Ritual"` subtype label across OCG card families, making family gate necessary. Evidence: `src/decks/catalog/ocg-card-mapper.ts:57-77`, `src/decks/catalog/ocg-card-mapper.ts:127-168`. Indexed and direct filtering both use `compileAdvancedDeckCatalogMatcher` at `src/decks/catalog/deck-catalog-index.ts:16-27` and `src/decks/catalog/deck-catalog.ts:46-62`.
- P64-3 Test cmd: `npx vitest run tests/unit/decks/deck-catalog-ritual-filter.test.ts tests/unit/decks/deck-catalog-index.test.ts tests/unit/decks/deck-catalog.test.ts`.
- P64-4 Residual risk: new regression is Ritual-specific, while family guard also affects overlapping `Normal` subtype. Generic family condition is direct; existing catalog suites cover normal advanced filtering.

### PR #65 — Approve

SHA: `fc813d96b3e36ab0a297e689c0c32a0ce6bc0c56`

- P65-1 Correct: arrow navigation anchors to seat-aware `activeKey`, already used by narrow pinning plus seat highlight. Opponent mode now starts at `opponentDeck`; player/library behavior remains `selectedKey`. Evidence: `src/deck-select/DeckSelectScreen.svelte:195-210`, `src/deck-select/DeckSelectScreen.svelte:553-561`.

```diff
-    const index = legal.findIndex((candidate) => candidate.key === selectedKey);
+    const index = legal.findIndex((candidate) => candidate.key === activeKey);
```

- P65-2 Correct: Free Play host updates correct seat synchronously (`playerKey` or `opponentKey`) and derives `opponentDeck` from updated key. Evidence: `src/shell/screens/FreePlayMatchSetup.svelte:118-123`, `src/shell/screens/FreePlayMatchSetup.svelte:256-263`, host wiring `src/shell/screens/FreePlayMatchSetup.svelte:482-509`. Regression checks opponent `ArrowUp` at `tests/component/deck-select/deck-select-screen.test.ts:462-480`.
- P65-3 Test cmd: `npx vitest run tests/component/deck-select/deck-select-screen.test.ts tests/component/deck-select/hover-previews.test.ts`.
- P65-4 Residual risk: regression covers opponent `ArrowUp`; `ArrowDown`, filtered-out active deck, and range ends reuse unchanged shared fallback/bounds logic at `src/deck-select/DeckSelectScreen.svelte:553-560`.

## Cross-PR notes

- C1. No blockers or request-change findings found in reviewed UI behavior, Svelte reactivity, keyboard flow, history ordering, catalog correctness, or index invariants.
- C2. `git diff --check` passed for all seven exact base-to-head diffs.
- C3. Traditional three-way `git merge-tree` against current `origin/main` produced no textual conflict markers for all seven PRs. Heads remain based on older common base; semantic retest after integration still required.
- C4. Current `origin/main` adds delete-dialog focus handling (`src/deck-editor/components/DeckEditor.svelte`), complementary to PR #60 propagation isolation. No overlapping PR #60 production diff.
- C5. Recommended shared gates after integration: `npm run typecheck`; `npx vitest run tests/unit/domain-boundaries.test.ts tests/unit/data-cy-coverage.test.ts`; targeted commands above.

## Files touched

- F1. Review artifact only: `.pi-subagents/artifacts/outputs/5c8a9cb4-7bec-4d40-b209-fcabcc55777d/artifacts/pr-review-20260921/review-ui.md`.
- F2. No source/test file edited. No staged file created.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Per-PR verdicts cite exact SHAs, production paths/lines, actual diff snippets, test commands, and residual risks. No actionable defects found."
    }
  ],
  "changedFiles": [
    ".pi-subagents/artifacts/outputs/5c8a9cb4-7bec-4d40-b209-fcabcc55777d/artifacts/pr-review-20260921/review-ui.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git diff --check 456551dc1cf8fc4e9fdb754095f3a8279f5b2c37..<headRefOid> (all seven PRs)",
      "result": "passed",
      "summary": "No whitespace errors."
    },
    {
      "command": "git merge-tree 456551dc1cf8fc4e9fdb754095f3a8279f5b2c37 origin/main <headRefOid> (all seven PRs)",
      "result": "passed",
      "summary": "No textual conflict markers detected."
    },
    {
      "command": "Targeted Vitest commands listed per PR",
      "result": "not-run",
      "summary": "Parent owns tests per task routing."
    }
  ],
  "validationOutput": [
    "Exact head objects exist for PRs #35, #42, #43, #53, #60, #64, #65.",
    "All seven diffs pass git diff --check.",
    "All seven traditional merge-tree comparisons show no textual conflict markers against origin/main."
  ],
  "residualRisks": [
    "All PR JSON metadata reports full-gate FAILURE; parent diagnoses CI separately.",
    "PR heads share older base 456551dc1cf8fc4e9fdb754095f3a8279f5b2c37; targeted tests must rerun after integration.",
    "PR #42 identity cache assumes no in-place ShopSetData mutation; production paths replace snapshots.",
    "PR #43 lacks randomized long-chain history property coverage; deterministic duplicate and controller cases exist.",
    "PR #53 tracked reset test uses JSDOM; parent owns browser validation."
  ],
  "noStagedFiles": true,
  "diffSummary": "Reviewed seven PR diffs read-only; all receive Approve. Wrote review artifact only.",
  "reviewFindings": [
    "approve: PR #35 bd441e6141ef9bcda850a6c5dbe99cc919a083f2 - filtered preview invalidation uses cached membership at src/story/collection/CollectionScreen.svelte:64-67",
    "approve: PR #42 98458e6c108ffcbd3728b15501ebdfb368a38662 - rarity index preserves highest-tier/fallback semantics at src/story/shop/data/shop-set-data.ts:137-172",
    "approve: PR #43 f7e88e4b56c00d6ff8678af0e8e390a2d57d32b8 - history restoration preserves survivor order and rebases snapshots at src/decks/deck-history.ts:64-177",
    "approve: PR #53 86a0e799f8b0b61a22935628401646386d23d5fd - preview-key scroll reset at src/shared-svelte-ui/card-preview/CardPreviewPanel.svelte:9-22",
    "approve: PR #60 d4f966cf322b0216a5d3bfb785501efeac1afdd8 - modal propagation isolation at src/deck-editor/focus-trap.ts:4-14",
    "approve: PR #64 ad56fd33616c152ecb619618f512e101e59b8580 - summon-frame family gate at src/decks/catalog/deck-catalog-advanced.ts:143-149 and 363-375",
    "approve: PR #65 fc813d96b3e36ab0a297e689c0c32a0ce6bc0c56 - seat-aware navigation anchor at src/deck-select/DeckSelectScreen.svelte:195-210 and 553-560",
    "no blockers"
  ],
  "manualNotes": "Requested plan.md and progress.md were absent. Graphify remained unavailable per task context."
}
```
