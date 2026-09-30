# Test shard 6 audit

## Review

- R1. **Done:** 61/61 assigned files FULL; **16,214 lines**, 88 chunks ≤300 lines, through EOF. PARTIAL: none. UNREAD: none.
- R2. **F1 — P3:** Shell purity assertion discards dependencies it claims to reject.
- R3. **Correct:** late-repository teardown test checks release after unmount, prevents initialization (`tests/component/deck-editor/installed-image-teardown.test.ts:25–45`); matches disposal guard (`src/deck-editor/DeckEditorApp.svelte:143–150`).
- R4. **Fixed:** none. No edits, tests, runtime probes, staging, commits, subagents.
- R5. **Blocker:** no new P1 confirmed. F1 requires correction before relying on claimed purity gate.
- R6. **Output:** READ ONLY overrides writing. Complete report returned for runtime persistence at `/home/aron/Projects/ascencio/artifacts/codebase-audit/test-shard-6.md`; destination absent at final check.

## F1 — P3: Shell purity check cannot detect forbidden external imports

**Evidence:** `tests/unit/domain-boundaries.test.ts:197–201,1048–1061`.

Purity assertion explicitly rejects `idb`, `node:*`:

```ts
target === "idb" ||
target.startsWith("node:")
```

Its `importsOf()` collector retains nonrelative specifiers only for `content` or `cards`. Target file belongs to `shell` → external imports discarded before assertion.

**Static false-green trace, unexecuted:** add `import "idb";` to `src/shell/release-validation.ts` → collector returns existing relative imports only → `.some(...)` remains false. Export inventory unchanged. Same blind spot affects `node:*` imports.

**Impact:** concrete regression oracle cannot enforce two explicitly forbidden dependency classes. No existing production purity violation established. Current validator imports semantic public entries (`src/shell/release-validation.ts:1–18`), composes validators (`:35–98`); architecture specifies pure semantic validation (`docs/ADR/091_ADR_shell_composes_semantic_content_ports.md:20`).

**Minimal correction:** purity-specific collector must retain external specifiers. Preserve existing general boundary behavior; blindly retaining every external specifier would require corresponding `isLegalImport()` handling.

**Required regression:** synthetic Shell source containing `import "idb";`, `import "node:fs";` must produce purity violations. Existing validator remains accepted.

**Next action:** test owner corrects collector/assertion, adds negative fixtures, runs:

```sh
npx vitest run tests/unit/domain-boundaries.test.ts --maxWorkers=1
```

Not run here.

## Assumptions / dedup

- A1. Scope exactly shard `id: 6` in `artifacts/codebase-audit/remaining-test-shards.json`; `26da126` fixes path inventory only. Current working bytes authoritative.
- A2. F1 source-derived; no executed reproduction claimed.
- A3. `AGENTS.md` read. Graph-first attempt failed: `/bin/bash: line 1: graphify: command not found`. Direct inspection substituted.
- A4. Prior shard 1–5, even/odd test summaries, remaining-source summaries consulted. Report search found no F1 duplicate.
- A5. Known storage, cleanup, CRC/MIME/SW/perf/URL oracles, stale fixtures, cold-start outcome, privacy RNG seed, six UI findings excluded. Missing coverage/style alone not promoted.

## Revision checks

- V1. Initial/final HEAD identical: `0bbe94e6115221e98a2d505c1e69241c066cde57`.
- V2. Initial assigned dirty paths: none. Final assigned status empty; assigned diff against initial HEAD empty.
- V3. Five assigned paths differ from frozen inventory commit; current bytes fully read, diffs inspected:

| ID | Path | Integrated change |
|---|---|---|
| D1 | `tests/component/deck-editor/deck-zone-grid.test.ts` | Deficit-copy removal regression |
| D2 | `tests/component/deck-editor/pointer-drag.test.ts` | Duplicate-copy move regression |
| D3 | `tests/component/deck-editor/ydk-import.test.ts` | Pending/superseded import regressions |
| D4 | `tests/unit/contracts.test.ts` | Draw result fixtures |
| D5 | `tests/unit/decks/deck-history.test.ts` | Exact-order restore regression |

- V4. Current EOFs match all manifest endpoints; 61 files, 16,214 lines.
- V5. Final `git diff --cached --name-only` empty. Existing unrelated dirty work preserved. No whole-repo clean claim.

## Coverage ledger

Every range FULL through EOF. **PARTIAL: none. UNREAD: none within shard 6.**

| ID | Path | Coverage |
|---|---|---|
| C1 | `tests/component/AppShell.test.ts` | FULL 1–1043 |
| C2 | `tests/component/DuelErrorDialog.test.ts` | FULL 1–28 |
| C3 | `tests/component/HandBand.test.ts` | FULL 1–361 |
| C4 | `tests/component/InstallContentScreen.test.ts` | FULL 1–142 |
| C5 | `tests/component/StoryMenuEntry.test.ts` | FULL 1–339 |
| C6 | `tests/component/deck-editor/catalog-type-input.test.ts` | FULL 1–155 |
| C7 | `tests/component/deck-editor/deck-click-move.test.ts` | FULL 1–184 |
| C8 | `tests/component/deck-editor/deck-context-menu.test.ts` | FULL 1–199 |
| C9 | `tests/component/deck-editor/deck-create-failure.test.ts` | FULL 1–52 |
| C10 | `tests/component/deck-editor/deck-delete-failure.test.ts` | FULL 1–131 |
| C11 | `tests/component/deck-editor/deck-validation-ui.test.ts` | FULL 1–233 |
| C12 | `tests/component/deck-editor/deck-workspace-selectors.test.ts` | FULL 1–56 |
| C13 | `tests/component/deck-editor/deck-zone-grid.test.ts` | FULL 1–223 |
| C14 | `tests/component/deck-editor/installed-image-teardown.test.ts` | FULL 1–46 |
| C15 | `tests/component/deck-editor/keyboard-shortcuts.test.ts` | FULL 1–100 |
| C16 | `tests/component/deck-editor/pointer-drag.test.ts` | FULL 1–257 |
| C17 | `tests/component/deck-editor/token-cards.test.ts` | FULL 1–71 |
| C18 | `tests/component/deck-editor/ydk-import.test.ts` | FULL 1–177 |
| C19 | `tests/component/story/BoosterOpening.test.ts` | FULL 1–139 |
| C20 | `tests/component/story/BoosterOpeningScreen.test.ts` | FULL 1–100 |
| C21 | `tests/component/story/booster-open-all.test.ts` | FULL 1–410 |
| C22 | `tests/component/story/choice-list.test.ts` | FULL 1–253 |
| C23 | `tests/component/story/story-card-tile.test.ts` | FULL 1–215 |
| C24 | `tests/unit/battle-runtime-input.test.ts` | FULL 1–187 |
| C25 | `tests/unit/card-visibility.test.ts` | FULL 1–21 |
| C26 | `tests/unit/chapter-set-media.test.ts` | FULL 1–123 |
| C27 | `tests/unit/content-setup-authoring.test.ts` | FULL 1–236 |
| C28 | `tests/unit/content-setup-runtime.test.ts` | FULL 1–326 |
| C29 | `tests/unit/contracts.test.ts` | FULL 1–1235 |
| C30 | `tests/unit/data-cy-coverage.test.ts` | FULL 1–704 |
| C31 | `tests/unit/deck-editor/editor-layout.test.ts` | FULL 1–39 |
| C32 | `tests/unit/decks/deck-history.test.ts` | FULL 1–157 |
| C33 | `tests/unit/decks/indexeddb-deck-repository.test.ts` | FULL 1–569 |
| C34 | `tests/unit/decks/ocg-card-mapper.test.ts` | FULL 1–67 |
| C35 | `tests/unit/domain-boundaries.test.ts` | FULL 1–1250 |
| C36 | `tests/unit/domain-chunk-closure.test.ts` | FULL 1–279 |
| C37 | `tests/unit/duel-deck-selection.test.ts` | FULL 1–204 |
| C38 | `tests/unit/duel-worker-client.test.ts` | FULL 1–813 |
| C39 | `tests/unit/hand-activation-choices.test.ts` | FULL 1–36 |
| C40 | `tests/unit/image-content-lock.test.ts` | FULL 1–167 |
| C41 | `tests/unit/installed-images.test.ts` | FULL 1–103 |
| C42 | `tests/unit/manifest-closure-reduction.test.ts` | FULL 1–90 |
| C43 | `tests/unit/material-list.test.ts` | FULL 1–92 |
| C44 | `tests/unit/persisted-ui-state.test.ts` | FULL 1–207 |
| C45 | `tests/unit/phase-transitions.test.ts` | FULL 1–75 |
| C46 | `tests/unit/progressive-release.test.ts` | FULL 1–431 |
| C47 | `tests/unit/prompt-control-family.test.ts` | FULL 1–61 |
| C48 | `tests/unit/prompt-surface.test.ts` | FULL 1–297 |
| C49 | `tests/unit/runtime-manifest.test.ts` | FULL 1–122 |
| C50 | `tests/unit/settle-once.test.ts` | FULL 1–30 |
| C51 | `tests/unit/shell-routes.test.ts` | FULL 1–270 |
| C52 | `tests/unit/story/auto-flip.test.ts` | FULL 1–80 |
| C53 | `tests/unit/story/collection-cards.test.ts` | FULL 1–114 |
| C54 | `tests/unit/story/pre-battle-tiles.test.ts` | FULL 1–145 |
| C55 | `tests/unit/story/save-generations.test.ts` | FULL 1–486 |
| C56 | `tests/unit/story/shop-pack-value.test.ts` | FULL 1–110 |
| C57 | `tests/unit/story/story-deck-repository.test.ts` | FULL 1–659 |
| C58 | `tests/unit/story/story-save-repository.test.ts` | FULL 1–1027 |
| C59 | `tests/unit/story/zoom-window-position.test.ts` | FULL 1–109 |
| C60 | `tests/unit/toast-store.test.ts` | FULL 1–89 |
| C61 | `tests/unit/verify-gameplay-parity.test.ts` | FULL 1–290 |

## Residual risks

- K1. Runtime validation prohibited; F1 mutation/regression unexecuted.
- K2. Existing catalog perf failures remain separately recorded (`artifacts/codebase-audit/catalog-perf-isolated.log:5,14–64`). No causal code claim; no budget relaxation proposed.
- K3. Owner-dirty Node Worker exit assertion remains separately recorded: `"AssertionError: expected 1 to be +0 // Object.is equality"` (`artifacts/codebase-audit/integrated-integration.log:10–19`). Existing hunks untouched; not new shard finding.
- K4. Scope excludes whole-repo acceptance. Report persistence delegated to runtime under read-only constraint.