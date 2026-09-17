# T11 production repair acceptance review

State: **ACCEPTED — clean independent production/security/concurrency review**.

Baseline: `f3f3c541fd912717bc743d7a6508c3ebda7c5e82`.

## Review

- R1 Correct — per-store manifest memo preserves integrity. Every lookup rereads current IDB row, validates row/version/type/size, recomputes SHA-256 before memo access (`src/content/storage/progressive-content-store.ts:176-202`). File receipt, Cache body, exact size, SHA remain checked per read (`src/content/storage/progressive-content-store.ts:204-217`). Public manifests are deep clones (`src/content/storage/progressive-content-store.ts:170-173`). Close clears memo (`src/content/storage/progressive-content-store.ts:592-597`). Alternating/concurrent versions, caller mutation, warm corruption/eviction, body/receipt mutation, abort, close-during-digest are exercised in `tests/unit/progressive-manifest-memo.test.ts:53-266`.
- R2 Correct — Battle semantic leases acquire only mounted, allowed codes; dedupe live owners; refcount final release; abort queued/inflight ownership; drain late leases; share one physical FIFO cap of four across replacement libraries (`src/battle/app/images/semantic-image-leases.ts:24-34`, `src/battle/app/images/semantic-image-leases.ts:37-97`, `src/battle/app/images/semantic-image-leases.ts:99-164`). App no longer maps whole catalog through `lease`; source library starts with allowed codes only (`src/battle/app/App.svelte:133-143`, `src/battle/app/App.svelte:386-415`). Visible preview shares library lease plus async subscription (`src/battle/app/App.svelte:981-999`).
- R3 Correct — all seven mounted consumers subscribe to async readiness: `src/battle/app/components/duel-field/CardControl.svelte:147`, `HandZoomOverlay.svelte:86`, `StackControl.svelte:67`, `MaterialCard.svelte:43`, `ZoneListEntryTile.svelte:64`, `CardTray.svelte:86`, `MaterialSelectDialog.svelte:78`. Concealment gates remain before acquisition: face-only cards (`CardControl.svelte:72`, `HandZoomOverlay.svelte:54`), projected stack top only (`StackControl.svelte:36-41`), visible material only (`MaterialCard.svelte:20-23`), visible tray rows (`CardTray.svelte:48`, `CardTray.svelte:122-124`), attested material choices (`MaterialSelectDialog.svelte:72-75`). Hidden App preview regression stays explicit at `tests/component/AppChrome.test.ts:611-650`.
- R4 Correct — Deck Library manager owns only cover crops plus selected-deck crop/full identities; dedup key is code+variant; cap is four; obsolete queued/inflight work aborts; late result releases (`src/deck-editor/cards/deck-library-images.ts:20-29`, `src/deck-editor/cards/deck-library-images.ts:31-76`, `src/deck-editor/cards/deck-library-images.ts:79-131`). Source-backed missing media does not fall back to legacy HTTP (`src/deck-editor/components/DeckLibrary.svelte:117-175`). Focused ownership/late-result/missing-media tests live at `tests/component/deck-editor/deck-library-images.test.ts:86-325`.
- R5 Correct — DeckSelect remains pure. Resolver/key changes increment token; obsolete success/rejection cannot publish; unmount invalidates hover token; pending resolver replacement clears copied image URLs without mutating caller rows (`src/deck-select/DeckSelectScreen.svelte:343-379`). Float provenance compares code plus original source URL, invalidating revoked/stale art (`src/deck-select/DeckSelectScreen.svelte:102-116`, `src/deck-select/DeckSelectScreen.svelte:437-497`).
- R6 Correct — shop printing identity uses collision-safe canonical four-tuple `[code, printingCode, sourceRarity, sourceRarityCode]` (`src/story/StoryApp.svelte:435-458`). Rendering, preview, DOM identity use printing key while economy dispatch remains code+rarity (`src/story/shop/ShopCardListScreen.svelte:44-65`, `src/story/shop/ShopCardListScreen.svelte:126-157`). Canonical regional fixture proves seven unique tiles plus unchanged 40-DP purchase dispatch (`tests/component/story/ShopCardList.test.ts:61-105`).
- R7 Correct — Shell suppresses only exact `ResizeObserver loop completed with undelivered notifications.` when `ErrorEvent.error` is absent/null (`src/shell/AppShell.svelte:815-832`). Same-message real `Error`, different message, substring, unhandled rejection still recover/release (`tests/component/AppShell.test.ts:849-968`).
- R8 Correct — frozen-source attestation matches current tree: `sha256sum -c artifacts/T11-REPAIR-EVIDENCE/frozen-retry3-source.sha256` passed 1173/1173 entries. Recorded final gates all exit 0: browser114 1269 components + 139 E2E + 41 acceptance, headless115, core116 11/11 (`artifacts/T11-REPAIR-EVIDENCE/commands-retry3.json`).
- R9 Blocker — none.
- R10 Fixed — none; review-only task prohibited source edits.

## Validation

- V1 `npx vitest run tests/unit/progressive-manifest-memo.test.ts tests/unit/progressive-content-store.test.ts tests/unit/installed-battle-images.test.ts tests/component/semantic-image-readiness.test.ts tests/component/deck-editor/deck-library-images.test.ts tests/component/deck-select/hover-previews.test.ts tests/component/story/ShopCardList.test.ts tests/component/AppShell.test.ts tests/unit/card-visibility.test.ts tests/unit/duel-state-projector.test.ts --reporter=verbose` → PASS, 9 files / 199 tests. Named nonexistent `tests/unit/progressive-content-store.test.ts` was ignored by Vitest; actual storage suite run separately in V2.
- V2 `npx vitest run tests/component/AppChrome.test.ts tests/unit/progressive-storage.test.ts tests/unit/progressive-download.test.ts --reporter=verbose` → PASS, 3 files / 88 tests.
- V3 `sha256sum -c artifacts/T11-REPAIR-EVIDENCE/frozen-retry3-source.sha256` → PASS, 1173 entries.
- V4 `git diff --check f3f3c54` → PASS.
- V5 `git diff --cached --quiet` → PASS; no staged files.

## Residual risks

- K1 Accepted limitation — four source operations that ignore abort forever retain all shared Battle physical slots; later optional art remains placeholder. No legality impact. Evidence: `src/battle/app/images/semantic-image-leases.ts:24-33`, `src/battle/app/images/semantic-image-leases.ts:70-97`; documented in `artifacts/IMPLEMENTATION-REPORT-T11-repair.md` R5.
- K2 Accepted limitation — Deck Library cap is per mounted manager, not global across remounts; selection size is not hard-capped by manager. Evidence: manager-local queue/active state at `src/deck-editor/cards/deck-library-images.ts:25-29`; documented in repair report R7.
- K3 Existing accessibility gap — fatal Battle recovery has no explicit Shell keyboard-focus handoff. Parent-approved assertion removal; outside bounded repair. Documented in repair report R2.
- K4 Input note — requested root `plan.md` plus `progress.md` were absent (`ENOENT`). Review used `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T11_acceptance.md`, full repair report, ledger, design/evidence records.

## Assumptions

- A1 Approved decisions recorded in T11 ticket, full repair report, `battle-lease-design.md`, `performance-review-notes.md` are authoritative substitutes for absent root `plan.md`/`progress.md`.
- A2 Recorded browser114/headless115/core116 gates need not be rerun because current 1173-entry source hash manifest verifies byte identity; task explicitly prohibited concurrent hour browser rerun.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Clean review with concrete path:line findings R1-R8; no blockers; residual risks K1-K4 recorded."
    }
  ],
  "changedFiles": [
    "artifacts/REVIEW-T11-production.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "npx vitest run tests/unit/progressive-manifest-memo.test.ts tests/unit/progressive-content-store.test.ts tests/unit/installed-battle-images.test.ts tests/component/semantic-image-readiness.test.ts tests/component/deck-editor/deck-library-images.test.ts tests/component/deck-select/hover-previews.test.ts tests/component/story/ShopCardList.test.ts tests/component/AppShell.test.ts tests/unit/card-visibility.test.ts tests/unit/duel-state-projector.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "9 files, 199 tests passed; nonexistent progressive-content-store path ignored, covered by separate storage run."
    },
    {
      "command": "npx vitest run tests/component/AppChrome.test.ts tests/unit/progressive-storage.test.ts tests/unit/progressive-download.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "3 files, 88 tests passed."
    },
    {
      "command": "sha256sum -c artifacts/T11-REPAIR-EVIDENCE/frozen-retry3-source.sha256",
      "result": "passed",
      "summary": "1173/1173 frozen source entries match current tree."
    },
    {
      "command": "git diff --check f3f3c54",
      "result": "passed",
      "summary": "No whitespace errors."
    },
    {
      "command": "git diff --cached --quiet",
      "result": "passed",
      "summary": "No staged files."
    }
  ],
  "validationOutput": [
    "Focused security/storage/lease/consumer/concealment validation: 287 tests passed.",
    "Recorded frozen-source gates: browser114, headless115, core116 exit 0.",
    "Current frozen manifest verification: 1173 entries OK."
  ],
  "residualRisks": [
    "Four abort-ignoring Battle source calls can indefinitely occupy shared physical slots; optional art stalls, legality remains independent.",
    "Deck Library cap is per mounted manager; no cross-remount global cap or hard selection-size bound.",
    "Fatal Battle recovery lacks explicit Shell keyboard-focus handoff.",
    "Root plan.md and progress.md absent; authoritative T11 ticket/report/design records used."
  ],
  "noStagedFiles": true,
  "diffSummary": "Independent read-only review of T11 production repair versus f3f3c54; only review artifact added.",
  "reviewFindings": [
    "no blockers",
    "accepted: manifest memo preserves per-read IDB row and SHA integrity plus mutation/version/close isolation",
    "accepted: mounted Battle leases, concealment guards, Library ownership, DeckSelect invalidation, shop printing identity, Shell exact warning guard"
  ],
  "manualNotes": "Accepted clean. Full browser gate not rerun; byte-identical frozen-source evidence verified."
}
```
