# Even test/harness audit

## Review

- R1. **Partial:** 60 files FULL; `e2e/duel-smoke.spec.ts` PARTIAL, lines 1–1200; 177 files UNREAD. Total inspected: **14,870 lines**.
- R2. **Findings:** F1 P2 persistent fixture-dir leak; F2 P3 false-green CRC assertion. Source-confirmed; runtime repros prohibited.
- R3. **Correct:** source-cache tests protect parent repo state (`tests/sources.test.ts:26–35,72–118`). Selected-media fixtures verify hashes before restoration (`tests/fixtures/selected-media-profile.ts:63–77,99–118`). Programmed duels compare actual trace digests across repeated runs (`tests/integration/programmed-duel.test.ts:68–87`).
- R4. **Fixed:** none. No edits, tests, commits, staging, subagents.
- R5. **Blocker:** complete narrowed-tranche acceptance remains unmet: `e2e/duel-smoke.spec.ts:1201–6538` unread. Parent next action: assign remaining range to fresh auditor.
- R6. **Output:** `/home/aron/Projects/ascencio/artifacts/codebase-audit/tests-even-audit.md`. Read-only rule → report returned for runtime persistence; destination absent at final check.

## Assumptions

- A1. Frozen inventory: `git ls-tree -r --name-only 26da126 -- tests e2e e2e-content e2e-core e2e-acceptance`; retain `.ts,.svelte,.js,.mjs,.cjs,.sh,.html`; lexicographic sort; even zero-based positions.
- A2. Current working bytes reviewed, not historical file contents. Frozen inventory contains 475 files; even partition contains 238 files / 65,342 lines.
- A3. Parent narrowed required tranche to E2E roots, fixtures, integration, direct `tests/*.ts`: 61 files / 20,208 lines. Unit/component files deferred.
- A4. `plan.md`, `progress.md` absent. AGENTS read. Graph query failed: `/bin/bash: line 1: graphify: command not found`. Direct inspection substituted.
- A5. Known selected-content timeout excluded. Six UI findings excluded, per `remaining-source-even.md` / `remaining-source-odd.md`. Intentional stubs, missing coverage alone not promoted.
- A6. “Source-confirmed” establishes code path, not executed reproduction.

## F1 — P2: publisher tests permanently retain fixture trees

**Evidence:** `tests/progressive-publisher.test.ts:23–55,227–246`; complete file read through line 1026.

`fixture()` creates unique `os.tmpdir()/ascencio-publish-*` root, copies runtime/vendor payloads, returns root. Callers create additional release trees beneath it. File registers no cleanup hook; callers never remove roots.

Imported sibling fixture cannot clean these roots: `tests/fixtures/asset-delivery-bundle.ts:10–14,24–27` removes only paths registered in its private `ownedFixtures` array. Publisher fixture never registers there.

**Source-derived repro trace:** run publisher suite → first test invokes `candidates()` → local fixture writes runtime/vendor inputs → packs three releases → test exits → root remains. Each subsequent fixture invocation repeats accumulation. Success, assertion failure, setup failure all lack cleanup.

**Impact:** repeated local/CI runs accumulate runtime binaries, generated release trees in temp storage.

**Minimal fix:** register exact owned root for cleanup immediately after `mkdtemp`; use Node test teardown covering setup failures. Prefer repo `.tmp/` per workspace policy. Never remove pre-existing roots by prefix scan.

**Regression:** isolated run records created roots; verify absence after successful test, forced assertion failure, fixture-setup failure.

**Proposed validation, not run:**
```sh
node --test tests/progressive-publisher.test.ts
```

## F2 — P3: CRC assertion accepts unrelated SHA rejection

**Evidence:** `tests/asset-delivery-bundle.test.ts:627–633`; `scripts/lib/asset-delivery/verify-archive.ts:84–96`.

CRC case flips archive byte, retains original expected file digest, accepts either:

```text
ASSET_ARCHIVE_REJECTED|ASSET_INTEGRITY_FAILED
```

Verifier separately hashes extracted bytes. With CRC enforcement absent, mutated payload still fails original file SHA check at `verify-archive.ts:95–96`; assertion accepts that failure.

**Source-derived repro trace:** construct `"data"` ZIP → mutate byte → disable CRC checks while retaining digest check → extracted content differs → `ASSET_INTEGRITY_FAILED` → purported CRC regression stays green. Mutation experiment not executed.

**Impact:** existing assertion cannot distinguish CRC rejection from independent integrity rejection. This concerns incorrect regression oracle, not proven production CRC defect.

**Minimal fix:** isolate CRC corruption from payload SHA mismatch. Preserve payload bytes/expected digest; corrupt CRC fields consistently; require `ASSET_ARCHIVE_REJECTED`. Keep separate SHA-mismatch case.

**Regression:** corrected CRC case fails when CRC enforcement disabled, passes when restored. Validate valid archive control first.

**Proposed validation, not run:**
```sh
node --test tests/asset-delivery-bundle.test.ts
```

## Final revision check

- V1. Initial/final HEAD: `26da1264d4f8a93b99059a02472de27498db43df`.
- V2. Final diff against frozen HEAD inspected for assigned changed files: `tests/fixtures/node-duel-worker-harness.ts`, `tests/integration/duel-session.test.ts`. Changes match already-reviewed working bytes: bounded forced-termination timeout/error normalization; 60-second session-reclamation test timeout.
- V3. Other changed tracked test paths belong odd partition: `tests/fixtures/selected-content-release.ts`, `tests/integration/node-worker-thread.test.ts`. New files excluded from frozen parity.
- V4. `git diff --cached --name-only` empty. Existing unrelated dirty work preserved; no clean-repo claim.
- V5. Truncated output recovered: `programmed-transcript.ts:1–60` reread; supporting `verify-archive.ts` reread fully. No truncated range counted FULL.

## Coverage — FULL

All ranges below read through EOF in chunks ≤300 lines. Position refers frozen combined inventory.

| ID | Position | File | Read |
|---|---:|---|---|
| C1 | 0 | `e2e-acceptance/card-list-dialog.spec.ts` | 1–682 |
| C2 | 2 | `e2e-acceptance/hand-zoom.spec.ts` | 1–219 |
| C3 | 4 | `e2e-content/built-installer.spec.ts` | 1–177 |
| C4 | 6 | `e2e-content/real-installer.spec.ts` | 1–333 |
| C5 | 8 | `e2e-core/atomic-content-activation.spec.ts` | 1–448 |
| C6 | 10 | `e2e-core/content-media-cleanup.spec.ts` | 1–419 |
| C7 | 12 | `e2e-core/core-update-consent.spec.ts` | 1–205 |
| C8 | 14 | `e2e/admin-console.spec.ts` | 1–99 |
| C9 | 16 | `e2e/content-transport.spec.ts` | 1–78 |
| C10 | 18 | `e2e/deck-select-layout.spec.ts` | 1–300 |
| C11 | 22 | `e2e/selected-content-fixture.ts` | 1–269 |
| C12 | 24 | `e2e/story-header.spec.ts` | 1–299 |
| C13 | 26 | `e2e/story-shop.spec.ts` | 1–178 |
| C14 | 28 | `e2e/story-starter-save.ts` | 1–57 |
| C15 | 30 | `tests/asset-delivery-bundle.test.ts` | 1–1357 |
| C16 | 32 | `tests/asset-delivery-metadata-repairs.test.ts` | 1–313 |
| C17 | 34 | `tests/asset-delivery-repairs.test.ts` | 1–151 |
| C18 | 36 | `tests/catalog.test.ts` | 1–48 |
| C19 | 176 | `tests/fixtures/ApplicationFailureProbe.svelte` | 1–15 |
| C20 | 178 | `tests/fixtures/DeckEditorProbe.svelte` | 1–23 |
| C21 | 180 | `tests/fixtures/action-coverage.ts` | 1–194 |
| C22 | 182 | `tests/fixtures/application-locks.ts` | 1–31 |
| C23 | 184 | `tests/fixtures/asset-delivery-contracts.ts` | 1–282 |
| C24 | 186 | `tests/fixtures/asset-delivery-rehash.ts` | 1–96 |
| C25 | 188 | `tests/fixtures/atomic-application-browser.ts` | 1–148 |
| C26 | 190 | `tests/fixtures/board-public-states.ts` | 1–246 |
| C27 | 192 | `tests/fixtures/catalog.ts` | 1–320 |
| C28 | 194 | `tests/fixtures/consolidated-runtime.ts` | 1–97 |
| C29 | 196 | `tests/fixtures/content-runtime-fixture.ts` | 1–161 |
| C30 | 198 | `tests/fixtures/content-setup.ts` | 1–109 |
| C31 | 200 | `tests/fixtures/deck-editor.ts` | 1–58 |
| C32 | 202 | `tests/fixtures/duel-field-public-events.ts` | 1–122 |
| C33 | 204 | `tests/fixtures/exact-installed-runtime.ts` | 1–144 |
| C34 | 206 | `tests/fixtures/fake-r2.ts` | 1–83 |
| C35 | 208 | `tests/fixtures/installed-gameplay.ts` | 1–269 |
| C36 | 210 | `tests/fixtures/node-duel-worker-harness.ts` | 1–416 |
| C37 | 212 | `tests/fixtures/programmed-transcript.ts` | 1–416 |
| C38 | 214 | `tests/fixtures/progressive-storage.ts` | 1–117 |
| C39 | 216 | `tests/fixtures/selected-content-browser.ts` | 1–142 |
| C40 | 218 | `tests/fixtures/selected-media-profile.ts` | 1–127 |
| C41 | 220 | `tests/fixtures/story-decks.ts` | 1–69 |
| C42 | 222 | `tests/fixtures/story-session.ts` | 1–101 |
| C43 | 224 | `tests/fixtures/synthetic-catalog.ts` | 1–41 |
| C44 | 226 | `tests/fixtures/unresponsive-worker-node.ts` | 1 |
| C45 | 228 | `tests/integration/active-duel-dependencies.test.ts` | 1–45 |
| C46 | 230 | `tests/integration/cir-mill-chain-prompt.test.ts` | 1–351 |
| C47 | 232 | `tests/integration/dante-material-decision.ts` | 1–382 |
| C48 | 234 | `tests/integration/duel-session.test.ts` | 1–298 |
| C49 | 236 | `tests/integration/field-spell-activation.test.ts` | 1–181 |
| C50 | 238 | `tests/integration/headless-controller.test.ts` | 1–155 |
| C51 | 240 | `tests/integration/installed-runtime.test.ts` | 1–63 |
| C52 | 242 | `tests/integration/programmed-duel.test.ts` | 1–460 |
| C53 | 244 | `tests/integration/rules-profile-placement.test.ts` | 1–153 |
| C54 | 246 | `tests/integration/worker-runtime.test.ts` | 1–325 |
| C55 | 248 | `tests/integration/xyz-overlay-progression.test.ts` | 1–294 |
| C56 | 250 | `tests/paths.test.ts` | 1–52 |
| C57 | 252 | `tests/progressive-publisher.test.ts` | 1–1026 |
| C58 | 254 | `tests/sources.test.ts` | 1–381 |
| C59 | 256 | `tests/tar.test.ts` | 1–30 |
| C60 | 474 | `tests/vite-config.test.ts` | 1–14 |

## Coverage — PARTIAL

| ID | Position | File | Read | Unread |
|---|---:|---|---|---|
| P1 | 20 | `e2e/duel-smoke.spec.ts` | 1–1200 | 1201–6538 |

## Coverage — UNREAD component files

Parent deferred these files. Ranges indicate entire unread file.

| ID | Position | File | Unread |
|---|---:|---|---|
| U1 | 38 | `tests/component/AppBoardMapping.test.ts` | 1–283 |
| U2 | 40 | `tests/component/AppLocalDecks.test.ts` | 1–366 |
| U3 | 42 | `tests/component/BattleFacade.test.ts` | 1–633 |
| U4 | 44 | `tests/component/CardControl.test.ts` | 1–281 |
| U5 | 46 | `tests/component/DeckPicker.test.ts` | 1–219 |
| U6 | 48 | `tests/component/DuelField.test.ts` | 1–5625 |
| U7 | 50 | `tests/component/DuelRail.test.ts` | 1–281 |
| U8 | 52 | `tests/component/FieldActionBar.test.ts` | 1–384 |
| U9 | 54 | `tests/component/FloatingFieldWindow.test.ts` | 1–507 |
| U10 | 56 | `tests/component/FreePlayUniqueOwner.test.ts` | 1–28 |
| U11 | 58 | `tests/component/HandBand.test.ts` | 1–361 |
| U12 | 60 | `tests/component/InstallContentScreen.test.ts` | 1–142 |
| U13 | 62 | `tests/component/MainMenuScreen.test.ts` | 1–206 |
| U14 | 64 | `tests/component/MenuDialog.test.ts` | 1–24 |
| U15 | 66 | `tests/component/PhaseBar.test.ts` | 1–208 |
| U16 | 68 | `tests/component/PromptContextMessage.test.ts` | 1–82 |
| U17 | 70 | `tests/component/PromptDialog.test.ts` | 1–109 |
| U18 | 72 | `tests/component/StackControl.test.ts` | 1–130 |
| U19 | 74 | `tests/component/StoryMenuEntry.test.ts` | 1–339 |
| U20 | 76 | `tests/component/collection-image-teardown.test.ts` | 1–104 |
| U21 | 78 | `tests/component/deck-editor/advanced-card-search.test.ts` | 1–202 |
| U22 | 80 | `tests/component/deck-editor/advanced-search-load-lifecycle.test.ts` | 1–85 |
| U23 | 82 | `tests/component/deck-editor/card-catalog.test.ts` | 1–103 |
| U24 | 84 | `tests/component/deck-editor/card-tile-art.test.ts` | 1–176 |
| U25 | 86 | `tests/component/deck-editor/catalog-infinite-scroll.test.ts` | 1–316 |
| U26 | 88 | `tests/component/deck-editor/catalog-type-input.test.ts` | 1–155 |
| U27 | 90 | `tests/component/deck-editor/deck-autosave.test.ts` | 1–456 |
| U28 | 92 | `tests/component/deck-editor/deck-context-menu.test.ts` | 1–199 |
| U29 | 94 | `tests/component/deck-editor/deck-crud.test.ts` | 1–31 |
| U30 | 96 | `tests/component/deck-editor/deck-editor-a11y.test.ts` | 1–119 |
| U31 | 98 | `tests/component/deck-editor/deck-editor-shell.test.ts` | 1–204 |
| U32 | 100 | `tests/component/deck-editor/deck-favourites.test.ts` | 1–57 |
| U33 | 102 | `tests/component/deck-editor/deck-library-images.test.ts` | 1–344 |
| U34 | 104 | `tests/component/deck-editor/deck-library-rename.test.ts` | 1–101 |
| U35 | 106 | `tests/component/deck-editor/deck-library.test.ts` | 1–400 |
| U36 | 108 | `tests/component/deck-editor/deck-ownership-legality.test.ts` | 1–157 |
| U37 | 110 | `tests/component/deck-editor/deck-reorder.test.ts` | 1–152 |
| U38 | 112 | `tests/component/deck-editor/deck-save-conflict.test.ts` | 1–73 |
| U39 | 114 | `tests/component/deck-editor/deck-workspace-selectors.test.ts` | 1–56 |
| U40 | 116 | `tests/component/deck-editor/default-deck.test.ts` | 1–220 |
| U41 | 118 | `tests/component/deck-editor/editor-import.test.ts` | 1–198 |
| U42 | 120 | `tests/component/deck-editor/installed-catalog.test.ts` | 1–65 |
| U43 | 122 | `tests/component/deck-editor/keyboard-shortcuts.test.ts` | 1–100 |
| U44 | 124 | `tests/component/deck-editor/missing-card-placeholder.test.ts` | 1–122 |
| U45 | 126 | `tests/component/deck-editor/pointer-drag.test.ts` | 1–219 |
| U46 | 128 | `tests/component/deck-editor/quantity-badge.test.ts` | 1–53 |
| U47 | 130 | `tests/component/deck-editor/variant-b-panels.test.ts` | 1–198 |
| U48 | 132 | `tests/component/deck-editor/ydk-import.test.ts` | 1–78 |
| U49 | 134 | `tests/component/deck-select/deck-dialogs.test.ts` | 1–171 |
| U50 | 136 | `tests/component/deck-select/deck-tile-menu.test.ts` | 1–189 |
| U51 | 138 | `tests/component/deck-select/hover-previews.test.ts` | 1–752 |
| U52 | 140 | `tests/component/deck-select/seat-panel.test.ts` | 1–299 |
| U53 | 142 | `tests/component/installed-card-media.test.ts` | 1–250 |
| U54 | 144 | `tests/component/semantic-image-readiness.test.ts` | 1–377 |
| U55 | 146 | `tests/component/shell/toast-host.test.ts` | 1–42 |
| U56 | 148 | `tests/component/story/BoosterOpening.test.ts` | 1–139 |
| U57 | 150 | `tests/component/story/IllustratedMap.test.ts` | 1–218 |
| U58 | 152 | `tests/component/story/OutcomeProgression.test.ts` | 1–87 |
| U59 | 154 | `tests/component/story/ShopCardList.test.ts` | 1–298 |
| U60 | 156 | `tests/component/story/ShopSell.test.ts` | 1–187 |
| U61 | 158 | `tests/component/story/StoryOverlays.test.ts` | 1–235 |
| U62 | 160 | `tests/component/story/StoryTopBar.test.ts` | 1–98 |
| U63 | 162 | `tests/component/story/booster-open-all.test.ts` | 1–410 |
| U64 | 164 | `tests/component/story/cancel-controls.test.ts` | 1–202 |
| U65 | 166 | `tests/component/story/card-zoom-inspector.test.ts` | 1–240 |
| U66 | 168 | `tests/component/story/collection-screen.test.ts` | 1–207 |
| U67 | 170 | `tests/component/story/pre-battle-deck-picker.test.ts` | 1–654 |
| U68 | 172 | `tests/component/story/set-list-rarity-sort.test.ts` | 1–246 |
| U69 | 174 | `tests/component/story/single-pack-reveal.test.ts` | 1–189 |

## Coverage — UNREAD unit files

| ID | Position | File | Unread |
|---|---:|---|---|
| N1 | 258 | `tests/unit/acceptance-scenario.test.ts` | 1–18 |
| N2 | 260 | `tests/unit/active-duel-dependencies.test.ts` | 1–150 |
| N3 | 262 | `tests/unit/admin-actions.test.ts` | 1–183 |
| N4 | 264 | `tests/unit/app-build-identity.test.ts` | 1–52 |
| N5 | 266 | `tests/unit/application-selector.test.ts` | 1–294 |
| N6 | 268 | `tests/unit/auto-response.test.ts` | 1–278 |
| N7 | 270 | `tests/unit/battle-runtime-input.test.ts` | 1–187 |
| N8 | 272 | `tests/unit/browser-runtime-assets.test.ts` | 1–317 |
| N9 | 274 | `tests/unit/card-action-label.test.ts` | 1–65 |
| N10 | 276 | `tests/unit/card-image-cache.test.ts` | 1–459 |
| N11 | 278 | `tests/unit/card-mapping.test.ts` | 1–118 |
| N12 | 280 | `tests/unit/card-visibility.test.ts` | 1–21 |
| N13 | 282 | `tests/unit/chapter-gameplay.test.ts` | 1–331 |
| N14 | 284 | `tests/unit/chapter-one-image-lock.test.ts` | 1–67 |
| N15 | 286 | `tests/unit/chapter-source-policy.test.ts` | 1–218 |
| N16 | 288 | `tests/unit/content-installer.test.ts` | 1–659 |
| N17 | 290 | `tests/unit/content-runtime-activation.test.ts` | 1–133 |
| N18 | 292 | `tests/unit/content-setup-files.test.ts` | 1–419 |
| N19 | 294 | `tests/unit/content-setup.test.ts` | 1–531 |
| N20 | 296 | `tests/unit/content-tooling-gates.test.ts` | 1–30 |
| N21 | 298 | `tests/unit/core-bootstrap.test.ts` | 1–102 |
| N22 | 300 | `tests/unit/core-gate.test.ts` | 1–82 |
| N23 | 302 | `tests/unit/core-update-approval.test.ts` | 1–95 |
| N24 | 304 | `tests/unit/deck-catalog.test.ts` | 1–46 |
| N25 | 306 | `tests/unit/deck-editor/deck-library-tiles.test.ts` | 1–258 |
| N26 | 308 | `tests/unit/deck-editor/result-window.test.ts` | 1–41 |
| N27 | 310 | `tests/unit/deck-order-projection.test.ts` | 1–282 |
| N28 | 312 | `tests/unit/deck-select/order-deck-tiles.test.ts` | 1–116 |
| N29 | 314 | `tests/unit/decks/canonical-sort-matrix.test.ts` | 1–141 |
| N30 | 316 | `tests/unit/decks/catalog-fixture.test.ts` | 1–32 |
| N31 | 318 | `tests/unit/decks/deck-catalog-index.test.ts` | 1–364 |
| N32 | 320 | `tests/unit/decks/deck-catalog.test.ts` | 1–406 |
| N33 | 322 | `tests/unit/decks/deck-grid-plan.test.ts` | 1–67 |
| N34 | 324 | `tests/unit/decks/deck-library-order.test.ts` | 1–41 |
| N35 | 326 | `tests/unit/decks/deck-repository-context.test.ts` | 1–171 |
| N36 | 328 | `tests/unit/decks/deck-resolver.test.ts` | 1–105 |
| N37 | 330 | `tests/unit/decks/indexeddb-deck-repository.test.ts` | 1–569 |
| N38 | 332 | `tests/unit/decks/ocg-card-mapper.test.ts` | 1–67 |
| N39 | 334 | `tests/unit/decks/ownership-validation.test.ts` | 1–282 |
| N40 | 336 | `tests/unit/decks/runtime-catalog.test.ts` | 1–364 |
| N41 | 338 | `tests/unit/decks/ydk-adapter.test.ts` | 1–52 |
| N42 | 340 | `tests/unit/dialog-chrome.test.ts` | 1–55 |
| N43 | 342 | `tests/unit/domain-boundaries.test.ts` | 1–1250 |
| N44 | 344 | `tests/unit/download-diagnostics.test.ts` | 1–92 |
| N45 | 346 | `tests/unit/drop-target.test.ts` | 1–139 |
| N46 | 348 | `tests/unit/duel-field-geometry.test.ts` | 1–210 |
| N47 | 350 | `tests/unit/duel-phase-label.test.ts` | 1–37 |
| N48 | 352 | `tests/unit/duel-rail-status.test.ts` | 1–102 |
| N49 | 354 | `tests/unit/duel-rules-profile.test.ts` | 1–144 |
| N50 | 356 | `tests/unit/duel-session.test.ts` | 1–66 |
| N51 | 358 | `tests/unit/duel-store.test.ts` | 1–1030 |
| N52 | 360 | `tests/unit/duel-worker-client.test.ts` | 1–813 |
| N53 | 362 | `tests/unit/end-turn-automation.test.ts` | 1–185 |
| N54 | 364 | `tests/unit/floating-window-position.test.ts` | 1–73 |
| N55 | 366 | `tests/unit/format-selection-status.test.ts` | 1–224 |
| N56 | 368 | `tests/unit/hand-activation-choices.test.ts` | 1–36 |
| N57 | 370 | `tests/unit/headless-reconciliation.test.ts` | 1–1068 |
| N58 | 372 | `tests/unit/immutable-choice-id-set.test.ts` | 1–40 |
| N59 | 374 | `tests/unit/installed-battle-images.test.ts` | 1–256 |
| N60 | 376 | `tests/unit/installed-duel-command.test.ts` | 1–44 |
| N61 | 378 | `tests/unit/installed-gameplay.test.ts` | 1–307 |
| N62 | 380 | `tests/unit/installed-runtime-receipt-validation.test.ts` | 1–19 |
| N63 | 382 | `tests/unit/interaction-session.test.ts` | 1–346 |
| N64 | 384 | `tests/unit/manifest-closure-reduction.test.ts` | 1–90 |
| N65 | 386 | `tests/unit/message-classification.test.ts` | 1–49 |
| N66 | 388 | `tests/unit/off-field-target-list.test.ts` | 1–355 |
| N67 | 390 | `tests/unit/pending-placement.test.ts` | 1–161 |
| N68 | 392 | `tests/unit/persisted-ui-store.test.ts` | 1–185 |
| N69 | 394 | `tests/unit/phase-transitions.test.ts` | 1–75 |
| N70 | 396 | `tests/unit/presentation-command.test.ts` | 1–195 |
| N71 | 398 | `tests/unit/programmed-transcript.test.ts` | 1–142 |
| N72 | 400 | `tests/unit/progressive-fixture.test.ts` | 1–338 |
| N73 | 402 | `tests/unit/progressive-manifest.test.ts` | 1–90 |
| N74 | 404 | `tests/unit/progressive-response.test.ts` | 1–114 |
| N75 | 406 | `tests/unit/prompt-context-message.test.ts` | 1–415 |
| N76 | 408 | `tests/unit/prompt-registry.test.ts` | 1–1114 |
| N77 | 410 | `tests/unit/prompt-surface.test.ts` | 1–297 |
| N78 | 412 | `tests/unit/resolve-duel-decks.test.ts` | 1–273 |
| N79 | 414 | `tests/unit/revision-cache-cleanup.test.ts` | 1–53 |
| N80 | 416 | `tests/unit/runtime-source-path.test.ts` | 1–22 |
| N81 | 418 | `tests/unit/selected-hand-zoom.test.ts` | 1–121 |
| N82 | 420 | `tests/unit/service-worker-install.test.ts` | 1–89 |
| N83 | 422 | `tests/unit/set-image-manifest.test.ts` | 1–186 |
| N84 | 424 | `tests/unit/shared-svelte-ui.test.ts` | 1–91 |
| N85 | 426 | `tests/unit/shell-settings.test.ts` | 1–274 |
| N86 | 428 | `tests/unit/shell/free-play-deck-actions.test.ts` | 1–200 |
| N87 | 430 | `tests/unit/shell/free-play-opponents.test.ts` | 1–29 |
| N88 | 432 | `tests/unit/shell/session-saves.test.ts` | 1–71 |
| N89 | 434 | `tests/unit/snapshot-copy-plan.test.ts` | 1–35 |
| N90 | 436 | `tests/unit/stage-frame.test.ts` | 1–192 |
| N91 | 438 | `tests/unit/story-save-presence.test.ts` | 1–108 |
| N92 | 440 | `tests/unit/story/card-ownership.test.ts` | 1–65 |
| N93 | 442 | `tests/unit/story/collection-grouping.test.ts` | 1–91 |
| N94 | 444 | `tests/unit/story/credit-at-open.test.ts` | 1–156 |
| N95 | 446 | `tests/unit/story/new-game-grant.test.ts` | 1–104 |
| N96 | 448 | `tests/unit/story/pre-battle-decks.test.ts` | 1–307 |
| N97 | 450 | `tests/unit/story/save-generations.test.ts` | 1–486 |
| N98 | 452 | `tests/unit/story/shop-data.test.ts` | 1–236 |
| N99 | 454 | `tests/unit/story/shop-set-data.test.ts` | 1–516 |
| N100 | 456 | `tests/unit/story/story-boundaries.test.ts` | 1–127 |
| N101 | 458 | `tests/unit/story/story-deck-repository.test.ts` | 1–659 |
| N102 | 460 | `tests/unit/story/story-handoff.test.ts` | 1–109 |
| N103 | 462 | `tests/unit/story/story-playback.test.ts` | 1–60 |
| N104 | 464 | `tests/unit/story/story-release-adapter.test.ts` | 1–149 |
| N105 | 466 | `tests/unit/story/story-save-repository.test.ts` | 1–1027 |
| N106 | 468 | `tests/unit/story/zoom-window-position.test.ts` | 1–109 |
| N107 | 470 | `tests/unit/toast-store.test.ts` | 1–89 |
| N108 | 472 | `tests/unit/verify-gameplay-parity.test.ts` | 1–290 |

## Residual risks

- Q1. Remaining assigned source: **50,472 lines** — smoke-spec remainder 5,338; deferred unit/component files 45,134.
- Q2. No test execution, browser checks, probes, builds, lint, typecheck. Findings require focused runtime validation before repair acceptance.
- Q3. Additional FULL supporting reads: `scripts/lib/asset-delivery/verify-archive.ts`, `src/battle/app/stores/persisted-ui-state.ts`, `package.json`, `vitest.config.ts`. Other supporting source reads targeted only.
- Q4. Initial-advance leak suspicion rejected: controller failure path already closes session (`src/battle/worker/HeadlessDuelController.ts:103–109,534–561`). No finding.
- Q5. No production destructive-FS defect confirmed within inspected tranche. This does not clear unread sources or prior known findings.
- Q6. No scratch files deliberately created. Tool-managed truncated-output logs not modified. Report persistence pending runtime.