# Test shard 5 audit

## Review

- R1. **Done:** 61/61 assigned files FULL; **16,212 lines**. Current bytes read through EOF, source chunks ≤300 lines.
- R2. **Finding F1 — P2:** privacy assertion can reject valid random diagnostic seed.
- R3. **Correct:** image-race tests assert stale lease release, current image retention, unmount cleanup (`tests/component/story/card-preview-host.test.ts:23–73`), matching guards in `src/story/components/CardPreviewHost.svelte:28–62`.
- R4. **Fixed:** none. No edits, tests, runtime probes, commits, staging, subagents.
- R5. **Blocker:** no new P1 confirmed. F1 needs correction before reliable suite acceptance.
- R6. **Output:** READ ONLY overrides write request. Report returned for runtime persistence at `/home/aron/Projects/ascencio/artifacts/codebase-audit/test-shard-5.md`.

## F1 — P2: privacy assertion scans random diagnostic seed as card identity

**Evidence:** `tests/unit/duel-worker-runtime.test.ts:954–975,1158–1159`.

Test serializes ordinary events plus diagnostics, rejects every occurrence of opponent codes `22000`–`22039`:

```ts
const outbound = JSON.stringify([...started, ...diagnostics]);
for (const code of OPPONENT_MAIN) {
  expect(outbound).not.toContain(String(code));
}
```

Runtime starts with random seed (`src/battle/worker/DuelWorkerRuntime.ts:415–419`). Seed comes from four unrestricted `BigUint64Array` words (`src/battle/worker/engine/duel-seed.ts:4–18`). Trace serializes words as decimal strings (`src/battle/worker/diagnostics/duel-trace.ts:165–171`); diagnostic contract deliberately includes seed (`src/battle/worker/DuelWorkerRuntime.ts:798–803`).

**Source-derived false-red:** valid seed `[12200034567890123456n, 2n, 3n, 4n]` → diagnostic seed string contains `"22000"` → privacy assertion fails despite no opponent identity disclosure. Fake core program ignores seed when selecting scripted outcome (`tests/fixtures/fake-ocgcore-adapter.ts:119–169`).

**Impact:** nondeterministic suite failure from legitimate diagnostic metadata. No production privacy defect established. Repro **unexecuted**; occurrence frequency unmeasured.

**Minimal correction:** distinguish documented seed metadata from card-bearing payload. Retain privacy checks over ordinary events, diagnostic entries, remaining metadata. Assert seed separately. Alternatively pin noncolliding randomness within this test, restore stub afterward; production randomness unchanged.

**Required regression:** adversarial colliding seed must pass privacy check; injected opponent identity outside seed must fail.

**Next action:** test owner corrects oracle, adds negative controls, runs:

```sh
npx vitest run tests/unit/duel-worker-runtime.test.ts --maxWorkers=1
```

Not run here.

## Assumptions / dedup

- A1. Scope: shard `id: 5`, `inventoryCommit: "26da126"`, from `artifacts/codebase-audit/remaining-test-shards.json`. Current working bytes authoritative.
- A2. Static source trace establishes F1; no observed runtime failure claimed.
- A3. `AGENTS.md` read. Requested `plan.md`, `progress.md` absent.
- A4. Graph-first attempt failed: `/bin/bash: line 1: graphify: command not found`. Direct inspection substituted.
- A5. Prior shard 1–3 findings, even/odd test findings, remaining-source findings consulted. Report search found no F1 duplicate.
- A6. Known storage, fixture-cleanup, CRC/MIME/SW, perf/teardown, stale-fixture, six UI findings excluded.

## Revision checks

- V1. Initial/final observed HEAD: `0bbe94e6115221e98a2d505c1e69241c066cde57`.
- V2. Assigned-path diff against initial HEAD empty; scoped working status empty.
- V3. Frozen-inventory delta: `tests/component/deck-editor/deck-library.test.ts` updates zone-qualified selectors; `tests/component/deck-select/hover-previews.test.ts` updates selectors, adds uniqueness/rejection regressions. Current files fully read; diffs inspected.
- V4. Current EOFs match all 61 manifest endpoints; total **16,212 lines**.
- V5. `git diff --cached --name-only` empty. Unrelated dirty work preserved; no global clean claim.
- V6. Report destination absent at final existence check. Direct write prohibited.

## Assigned coverage ledger

Every range FULL through EOF. **PARTIAL: none. UNREAD: none within shard 5.**

| ID | Path | Coverage |
|---|---|---|
| C1 | `tests/component/AppBoardMapping.test.ts` | FULL 1–283 |
| C2 | `tests/component/CardActionChips.test.ts` | FULL 1–236 |
| C3 | `tests/component/DeckPicker.test.ts` | FULL 1–219 |
| C4 | `tests/component/DuelResultDialog.test.ts` | FULL 1–131 |
| C5 | `tests/component/FieldBoard.test.ts` | FULL 1–149 |
| C6 | `tests/component/FloatingFieldWindow.test.ts` | FULL 1–507 |
| C7 | `tests/component/HandZoomOverlay.test.ts` | FULL 1–419 |
| C8 | `tests/component/LoadingOverlay.test.ts` | FULL 1–36 |
| C9 | `tests/component/MenuDialog.test.ts` | FULL 1–24 |
| C10 | `tests/component/ZoneListDialog.test.ts` | FULL 1–1156 |
| C11 | `tests/component/collection-image-teardown.test.ts` | FULL 1–104 |
| C12 | `tests/component/core-menu.test.ts` | FULL 1–149 |
| C13 | `tests/component/deck-editor/advanced-search-load-lifecycle.test.ts` | FULL 1–85 |
| C14 | `tests/component/deck-editor/card-preview-pane.test.ts` | FULL 1–175 |
| C15 | `tests/component/deck-editor/deck-editor-shell.test.ts` | FULL 1–204 |
| C16 | `tests/component/deck-editor/deck-history-ui.test.ts` | FULL 1–84 |
| C17 | `tests/component/deck-editor/deck-library.test.ts` | FULL 1–400 |
| C18 | `tests/component/deck-editor/editor-context.test.ts` | FULL 1–575 |
| C19 | `tests/component/deck-editor/installed-catalog.test.ts` | FULL 1–65 |
| C20 | `tests/component/deck-editor/missing-card-placeholder.test.ts` | FULL 1–122 |
| C21 | `tests/component/deck-editor/portrait-layout.test.ts` | FULL 1–319 |
| C22 | `tests/component/deck-select/deck-dialogs.test.ts` | FULL 1–171 |
| C23 | `tests/component/deck-select/hover-previews.test.ts` | FULL 1–815 |
| C24 | `tests/component/installed-card-media.test.ts` | FULL 1–250 |
| C25 | `tests/component/shell-card-image-status.test.ts` | FULL 1–139 |
| C26 | `tests/component/story/IllustratedMap.test.ts` | FULL 1–218 |
| C27 | `tests/component/story/StoryPlayback.test.ts` | FULL 1–123 |
| C28 | `tests/component/story/StoryTopBar.test.ts` | FULL 1–98 |
| C29 | `tests/component/story/card-preview-host.test.ts` | FULL 1–73 |
| C30 | `tests/component/story/sell-confirmation.test.ts` | FULL 1–207 |
| C31 | `tests/unit/auto-placement.test.ts` | FULL 1–112 |
| C32 | `tests/unit/battle/selectable-decks.test.ts` | FULL 1–280 |
| C33 | `tests/unit/card-preview.test.ts` | FULL 1–256 |
| C34 | `tests/unit/content-installer.test.ts` | FULL 1–659 |
| C35 | `tests/unit/core-bootstrap.test.ts` | FULL 1–102 |
| C36 | `tests/unit/deck-editor/result-window.test.ts` | FULL 1–41 |
| C37 | `tests/unit/decks/canonical-sort-matrix.test.ts` | FULL 1–141 |
| C38 | `tests/unit/decks/deck-catalog-index.test.ts` | FULL 1–364 |
| C39 | `tests/unit/decks/deck-library-order.test.ts` | FULL 1–41 |
| C40 | `tests/unit/decks/ocg-mask-parity.test.ts` | FULL 1–33 |
| C41 | `tests/unit/dialog-chrome.test.ts` | FULL 1–55 |
| C42 | `tests/unit/duel-store.test.ts` | FULL 1–1030 |
| C43 | `tests/unit/duel-worker-runtime.test.ts` | FULL 1–1269 |
| C44 | `tests/unit/field-navigation.test.ts` | FULL 1–343 |
| C45 | `tests/unit/floating-window-position.test.ts` | FULL 1–73 |
| C46 | `tests/unit/format-duel-presentation-event.test.ts` | FULL 1–94 |
| C47 | `tests/unit/headless-lifecycle.test.ts` | FULL 1–235 |
| C48 | `tests/unit/headless-reconciliation.test.ts` | FULL 1–1068 |
| C49 | `tests/unit/installed-gameplay.test.ts` | FULL 1–307 |
| C50 | `tests/unit/installed-worker-deck-validation.test.ts` | FULL 1–105 |
| C51 | `tests/unit/persisted-ui-store.test.ts` | FULL 1–185 |
| C52 | `tests/unit/progressive-download.test.ts` | FULL 1–724 |
| C53 | `tests/unit/progressive-manifest.test.ts` | FULL 1–90 |
| C54 | `tests/unit/revision-cache-cleanup.test.ts` | FULL 1–53 |
| C55 | `tests/unit/runtime-source-path.test.ts` | FULL 1–22 |
| C56 | `tests/unit/set-image-manifest.test.ts` | FULL 1–186 |
| C57 | `tests/unit/shell-settings.test.ts` | FULL 1–274 |
| C58 | `tests/unit/shell/free-play-deck-actions.test.ts` | FULL 1–200 |
| C59 | `tests/unit/shell/story-battle-request.test.ts` | FULL 1–63 |
| C60 | `tests/unit/stage-layout.test.ts` | FULL 1–114 |
| C61 | `tests/unit/story/sell-impact.test.ts` | FULL 1–157 |

## Residual risks

- U1. Static audit only. No tests, probes, browser checks, build, lint, typecheck executed.
- U2. F1 remains unfixed; deterministic regression required. No additional concrete assertion defect confirmed.
- U3. Supporting runtime-source reads targeted; no whole-source audit claimed.
- U4. Other shards outside ownership. FULL denotes complete reading, not exhaustive correctness proof.
- U5. Runtime persistence required for authoritative report path.