# Tests odd-parity audit

## Review

- R1. **Done — narrowed tranche:** 59/59 files FULL; 15,233 lines. Reads ≤300 lines, continued through EOF. Original assignment: 237 files; remaining 178 explicitly UNREAD.
- R2. **Finding F1 — P2:** stale validation envelope masks MIME-integrity regression.
- R3. **Finding F2 — P3:** producer tests leak fixture directories.
- R4. **Correct:** migration tests isolate destructive operations inside uniquely created roots, register cleanup (`tests/asset-delivery-profiles.test.ts:58–66`). Font harness verifies emitted bytes against source SHA-256, rejects HTML fallback (`tests/fixtures/emitted-font-contract.ts:39–59`).
- R5. **Fixed:** none. No edits, tests, runtime repros, commits, staging, subagents.
- R6. **Blocker:** no P1 confirmed. Whole-assignment completion remains incomplete.
- R7. **Output:** read-only constraint overrides artifact writes. Complete report returned for persistence at `/home/aron/Projects/ascencio/artifacts/codebase-audit/tests-odd-audit.md`; final existence check returned `False`.

## Assumptions

- A1. Frozen inventory: `git ls-tree -r --name-only 26da126 -- tests e2e e2e-content e2e-core e2e-acceptance`; filter `.ts,.svelte,.js,.mjs,.cjs,.sh,.html`, lexicographic sort, odd zero-based positions.
- A2. Parent narrowed required reads to E2E roots, `tests/fixtures/`, `tests/integration/`, direct `tests/*.ts`. Component/unit files deferred.
- A3. Findings source-confirmed; described runtime traces/mutation checks **not executed**.
- A4. Known selected-content timeout, six remaining UI findings excluded. Consulted ledger, remaining-source even/odd reports, tooling audit, fixture-timeout report; searched existing reports for finding overlap.
- A5. `plan.md`, `progress.md` absent. Graph query failed: `/bin/bash: line 1: graphify: command not found`. Direct source inspection substituted.

## F1 — P2: MIME-integrity test can pass after roster guard breaks

**Evidence:** `tests/progressive-producer.test.ts:443–481,515–521,562–591`.

`rewriteManifest()` claims to rebind every local hash. Updates manifest object, manifest file, pointer, candidate. Leaves `progressive/validation.json` carrying original `manifestVersion`.

Production verifier checks roster equality at `scripts/lib/asset-delivery/progressive-producer.ts:423–436`, then independently checks validation envelope at `:518–529`. Both failures return `"CONTENT_INVALID_MANIFEST"`.

**Source-derived false-positive trace:**

- T1. `"forged MIME identity"` changes optional media from PNG to JPEG; file paths, lengths, hashes unchanged (`tests/progressive-producer.test.ts:515–521`).
- T2. Suppose roster-equality check regresses, stops rejecting MIME mismatch.
- T3. Object/source integrity checks still pass. Semantic media check accepts either MIME because it checks `"image/"` prefix (`scripts/lib/asset-delivery/progressive-semantic-validation.ts:388–402`).
- T4. Stale validation envelope still rejects with `"CONTENT_INVALID_MANIFEST"` (`progressive-producer.ts:518–529`).
- T5. Existing verify/publish assertions still pass → intended roster regression undetected.

**Minimal fix:** update validation envelope’s `manifestVersion` inside `rewriteManifest()`, preserving predecessor metadata. Assert helper leaves envelope identities consistent before testing corruption.

**Validation required:** isolated mutation check disabling roster comparison must make MIME test fail; restore production guard → pass.

```sh
node --test --test-name-pattern='inventory roster: forged MIME identity' tests/progressive-producer.test.ts
```

Command not run. Finding concerns test oracle, not confirmed production bypass.

## F2 — P3: producer fixtures retain runtime/output trees indefinitely

**Evidence:** `tests/progressive-producer.test.ts:31–36,45–67,134`.

`fixture()` creates unique `os.tmpdir()/ascencio-progressive-*` root, copies runtime/vendor files, returns root. Entire 786-line file has no cleanup registration or removal. Tests additionally write packed releases beneath root.

Imported cleanup in `tests/fixtures/asset-delivery-bundle.ts:10–15,24–27` tracks only roots created by that module’s distinct `fixture()`; producer roots never enter its registry.

**Source-derived repro trace:** execute producer suite → fixture calls create roots → normal completion/failure never removes them → repeated runs accumulate runtime copies, generated release objects.

**Minimal fix:** pass test context into fixture; register `t.after()` immediately after successful `mkdtemp`, before remaining setup. Remove only exact owned root.

**Validation required:** successful run, deliberate setup/test failure both leave no roots created by that invocation. Preserve unrelated temp directories.

```sh
node --test tests/progressive-producer.test.ts
```

Command not run. Actual accumulated bytes not measured.

## Needs-repro note

- N1. `tests/integration/node-worker-thread.test.ts:179–197` starts 100ms deadlines immediately after Worker construction, expects forced exit `0`. Dirty changes replace prior `1` expectations. Fixture contains persistent interval (`tests/fixtures/unresponsive-worker-node.ts:1`); harness calls `worker.terminate()` (`tests/fixtures/node-duel-worker-harness.ts:280–286`). No startup-ready barrier. Startup-dependent exit behavior warrants focused investigation; **not promoted to confirmed finding**. Test warm/cold startup, then synchronize fixture readiness if exact exit code is required.

## Revision checks

- V1. Initial HEAD: `26da1264d4f8a93b99059a02472de27498db43df`.
- V2. Final observed HEAD: `5279d46cd6a95830f70bfdb17285021624c9f62f`.
- V3. Integration changed `e2e/deck-editor.spec.ts:1769` after initial read: selector became `[data-cy^="deck-select-docked-list-main-row-"]`. Inspected diff; reread current lines 1750–1810.
- V4. Other FULL files differing from frozen commit: `tests/fixtures/selected-content-release.ts`, `tests/integration/node-worker-thread.test.ts`. Current files fully read; final diffs inspected. Recorded SHA-256 unchanged between post-read/final checks.
- V5. Other 56 FULL files matched frozen commit during final comparison. Deferred component/unit changes remain UNREAD.
- V6. Final staged-path listing empty. Existing unrelated dirty work preserved.

## FULL coverage

Identifiers encode frozen zero-based position. Each range includes EOF.

| ID | File | Read |
|---|---|---|
| C1 | `e2e-acceptance/full-height-field.spec.ts` | 1–645 |
| C3 | `e2e-acceptance/harness.spec.ts` | 1–39 |
| C5 | `e2e-content/installer.spec.ts` | 1–599 |
| C7 | `e2e-content/t7-runtime.spec.ts` | 1–236 |
| C9 | `e2e-core/chapter-content-delivery.spec.ts` | 1–48 |
| C11 | `e2e-core/core-boot.spec.ts` | 1–104 |
| C13 | `e2e-core/offline-shell.spec.ts` | 1–249 |
| C15 | `e2e/asset-root-urls.spec.ts` | 1–27 |
| C17 | `e2e/deck-editor.spec.ts` | 1–1810; final delta reread |
| C19 | `e2e/duel-portrait.spec.ts` | 1–308 |
| C21 | `e2e/scrollbar-brand.spec.ts` | 1–142 |
| C23 | `e2e/story-duel.spec.ts` | 1–357 |
| C25 | `e2e/story-map.spec.ts` | 1–367 |
| C27 | `e2e/story-stage-sizing.spec.ts` | 1–433 |
| C29 | `e2e/story.spec.ts` | 1–745 |
| C31 | `tests/asset-delivery-contracts.test.ts` | 1–1226 |
| C33 | `tests/asset-delivery-profiles.test.ts` | 1–1418 |
| C35 | `tests/asset-delivery-zip-structure.test.ts` | 1–179 |
| C177 | `tests/fixtures/BattleFacadeProbe.svelte` | 1–15 |
| C179 | `tests/fixtures/InstalledCardMediaHarness.svelte` | 1–92 |
| C181 | `tests/fixtures/active-catalog.ts` | 1–35 |
| C183 | `tests/fixtures/asset-delivery-bundle.ts` | 1–282 |
| C185 | `tests/fixtures/asset-delivery-large.ts` | 1–127 |
| C187 | `tests/fixtures/asset-delivery-zip.ts` | 1–66 |
| C189 | `tests/fixtures/battle-facade-probe.ts` | 1–15 |
| C191 | `tests/fixtures/board-view-model.ts` | 1–328 |
| C193 | `tests/fixtures/cleanup-failure-duel-worker-node.ts` | 1–21 |
| C195 | `tests/fixtures/content-install-fixture.ts` | 1–304 |
| C197 | `tests/fixtures/content-setup-files.ts` | 1–179 |
| C199 | `tests/fixtures/deck-database.ts` | 1–114 |
| C201 | `tests/fixtures/duel-field-component-failure.ts` | 1–3 |
| C203 | `tests/fixtures/emitted-font-contract.ts` | 1–61 |
| C205 | `tests/fixtures/fake-ocgcore-adapter.ts` | 1–205 |
| C207 | `tests/fixtures/installed-duel-gameplay.ts` | 1–30 |
| C209 | `tests/fixtures/missing-runtime-duel-worker-node.ts` | 1–6 |
| C211 | `tests/fixtures/programmed-scenarios.ts` | 1–219 |
| C213 | `tests/fixtures/progressive-release.ts` | 1–161 |
| C215 | `tests/fixtures/runtime-build-constants.ts` | 1–35 |
| C217 | `tests/fixtures/selected-content-release.ts` | 1–64 |
| C219 | `tests/fixtures/shell-gameplay.ts` | 1–8 |
| C221 | `tests/fixtures/story-release.ts` | 1–68 |
| C223 | `tests/fixtures/svelte-element-scan.ts` | 1–278 |
| C225 | `tests/fixtures/token-card.ts` | 1–45 |
| C227 | `tests/images.test.ts` | 1–65 |
| C229 | `tests/integration/chapter-one-duel.test.ts` | 1–107 |
| C231 | `tests/integration/custom-deck-duel.test.ts` | 1–140 |
| C233 | `tests/integration/duel-replay-restore.test.ts` | 1–306 |
| C235 | `tests/integration/falco-facedown-special-summon.test.ts` | 1–329 |
| C237 | `tests/integration/gy-trigger-chain-window.test.ts` | 1–402 |
| C239 | `tests/integration/installed-runtime-wasm.test.ts` | 1–272 |
| C241 | `tests/integration/node-worker-thread.test.ts` | 1–224 |
| C243 | `tests/integration/real-wasm-smoke.test.ts` | 1–9 |
| C245 | `tests/integration/spellbook-duel-progression.test.ts` | 1–178 |
| C247 | `tests/integration/xyz-detach-overlay-address.test.ts` | 1–528 |
| C249 | `tests/mvp-assets.test.ts` | 1–51 |
| C251 | `tests/progressive-producer.test.ts` | 1–786 |
| C253 | `tests/run-lock.test.ts` | 1–56 |
| C255 | `tests/strings.test.ts` | 1–20 |
| C257 | `tests/transform.test.ts` | 1–67 |

## UNREAD coverage — deferred by parent

Every listed file: **UNREAD, entire file**. No PARTIAL assigned files.

| ID | File |
|---|---|
| U37 | `tests/component/AdminConsole.test.ts` |
| U39 | `tests/component/AppChrome.test.ts` |
| U41 | `tests/component/AppShell.test.ts` |
| U43 | `tests/component/CardActionChips.test.ts` |
| U45 | `tests/component/CardPreviewPanel.test.ts` |
| U47 | `tests/component/DuelErrorDialog.test.ts` |
| U49 | `tests/component/DuelHud.test.ts` |
| U51 | `tests/component/DuelResultDialog.test.ts` |
| U53 | `tests/component/FieldBoard.test.ts` |
| U55 | `tests/component/FreePlayMatchSetup.test.ts` |
| U57 | `tests/component/FullControlToggle.test.ts` |
| U59 | `tests/component/HandZoomOverlay.test.ts` |
| U61 | `tests/component/LoadingOverlay.test.ts` |
| U63 | `tests/component/MaterialSelectDialog.test.ts` |
| U65 | `tests/component/OverlayScrollbar.test.ts` |
| U67 | `tests/component/ProjectedChoiceMenu.test.ts` |
| U69 | `tests/component/PromptControls.test.ts` |
| U71 | `tests/component/SettingsDialog.test.ts` |
| U73 | `tests/component/StoryDuelHandoff.test.ts` |
| U75 | `tests/component/ZoneListDialog.test.ts` |
| U77 | `tests/component/core-menu.test.ts` |
| U79 | `tests/component/deck-editor/advanced-search-load-error.test.ts` |
| U81 | `tests/component/deck-editor/advanced-search-loader-generation.test.ts` |
| U83 | `tests/component/deck-editor/card-preview-pane.test.ts` |
| U85 | `tests/component/deck-editor/catalog-index-wiring.test.ts` |
| U87 | `tests/component/deck-editor/catalog-scrollbar.test.ts` |
| U89 | `tests/component/deck-editor/click-semantics.test.ts` |
| U91 | `tests/component/deck-editor/deck-click-move.test.ts` |
| U93 | `tests/component/deck-editor/deck-create-failure.test.ts` |
| U95 | `tests/component/deck-editor/deck-delete-failure.test.ts` |
| U97 | `tests/component/deck-editor/deck-editor-blocked.test.ts` |
| U99 | `tests/component/deck-editor/deck-entry.test.ts` |
| U101 | `tests/component/deck-editor/deck-history-ui.test.ts` |
| U103 | `tests/component/deck-editor/deck-library-order.test.ts` |
| U105 | `tests/component/deck-editor/deck-library-toolbar.test.ts` |
| U107 | `tests/component/deck-editor/deck-migration-error.test.ts` |
| U109 | `tests/component/deck-editor/deck-page-actions.test.ts` |
| U111 | `tests/component/deck-editor/deck-route.test.ts` |
| U113 | `tests/component/deck-editor/deck-validation-ui.test.ts` |
| U115 | `tests/component/deck-editor/deck-zone-grid.test.ts` |
| U117 | `tests/component/deck-editor/editor-context.test.ts` |
| U119 | `tests/component/deck-editor/installed-catalog-boot.test.ts` |
| U121 | `tests/component/deck-editor/installed-image-teardown.test.ts` |
| U123 | `tests/component/deck-editor/load-deck-dialog.test.ts` |
| U125 | `tests/component/deck-editor/owned-only-catalog.test.ts` |
| U127 | `tests/component/deck-editor/portrait-layout.test.ts` |
| U129 | `tests/component/deck-editor/token-cards.test.ts` |
| U131 | `tests/component/deck-editor/ydk-export.test.ts` |
| U133 | `tests/component/deck-select/compact-layout.test.ts` |
| U135 | `tests/component/deck-select/deck-select-screen.test.ts` |
| U137 | `tests/component/deck-select/deck-tile.test.ts` |
| U139 | `tests/component/deck-select/mobile-layout.test.ts` |
| U141 | `tests/component/deck-select/tile-builder.ts` |
| U143 | `tests/component/installed-free-play.test.ts` |
| U145 | `tests/component/shell-card-image-status.test.ts` |
| U147 | `tests/component/story/BattleHandoff.test.ts` |
| U149 | `tests/component/story/BoosterOpeningScreen.test.ts` |
| U151 | `tests/component/story/NarrativeScreen.test.ts` |
| U153 | `tests/component/story/ShopBrowse.test.ts` |
| U155 | `tests/component/story/ShopGreeting.test.ts` |
| U157 | `tests/component/story/StoryApp.test.ts` |
| U159 | `tests/component/story/StoryPlayback.test.ts` |
| U161 | `tests/component/story/TitleAndLoad.test.ts` |
| U163 | `tests/component/story/booster-reveal.test.ts` |
| U165 | `tests/component/story/card-preview-host.test.ts` |
| U167 | `tests/component/story/choice-list.test.ts` |
| U169 | `tests/component/story/installed-story.test.ts` |
| U171 | `tests/component/story/sell-confirmation.test.ts` |
| U173 | `tests/component/story/shop-set-tiles.test.ts` |
| U175 | `tests/component/story/story-card-tile.test.ts` |
| U259 | `tests/unit/active-card-text-manifest.test.ts` |
| U261 | `tests/unit/active-image-manifest.test.ts` |
| U263 | `tests/unit/agents-doc-trunk.test.ts` |
| U265 | `tests/unit/application-readiness.test.ts` |
| U267 | `tests/unit/auto-placement.test.ts` |
| U269 | `tests/unit/battle-contracts.test.ts` |
| U271 | `tests/unit/battle/selectable-decks.test.ts` |
| U273 | `tests/unit/capped-response-body.test.ts` |
| U275 | `tests/unit/card-frame.test.ts` |
| U277 | `tests/unit/card-list-dialog-model.test.ts` |
| U279 | `tests/unit/card-preview.test.ts` |
| U281 | `tests/unit/cards.test.ts` |
| U283 | `tests/unit/chapter-one-decks.test.ts` |
| U285 | `tests/unit/chapter-set-media.test.ts` |
| U287 | `tests/unit/content-actions.test.ts` |
| U289 | `tests/unit/content-recovery.test.ts` |
| U291 | `tests/unit/content-setup-authoring.test.ts` |
| U293 | `tests/unit/content-setup-runtime.test.ts` |
| U295 | `tests/unit/content-storage.test.ts` |
| U297 | `tests/unit/contracts.test.ts` |
| U299 | `tests/unit/core-content-transport.test.ts` |
| U301 | `tests/unit/core-precache.test.ts` |
| U303 | `tests/unit/data-cy-coverage.test.ts` |
| U305 | `tests/unit/deck-editor/click-intent.test.ts` |
| U307 | `tests/unit/deck-editor/editor-layout.test.ts` |
| U309 | `tests/unit/deck-editor/tap-targets.test.ts` |
| U311 | `tests/unit/deck-parser.test.ts` |
| U313 | `tests/unit/deck-sources-node.test.ts` |
| U315 | `tests/unit/decks/card-ownership.test.ts` |
| U317 | `tests/unit/decks/deck-buildable-cards.test.ts` |
| U319 | `tests/unit/decks/deck-catalog-performance.test.ts` |
| U321 | `tests/unit/decks/deck-database-migration.test.ts` |
| U323 | `tests/unit/decks/deck-history.test.ts` |
| U325 | `tests/unit/decks/deck-model.test.ts` |
| U327 | `tests/unit/decks/deck-resolver-integration.test.ts` |
| U329 | `tests/unit/decks/deck-validation.test.ts` |
| U331 | `tests/unit/decks/installed-gameplay-cards.test.ts` |
| U333 | `tests/unit/decks/ocg-mask-parity.test.ts` |
| U335 | `tests/unit/decks/packaged-catalog.test.ts` |
| U337 | `tests/unit/decks/starter-deck.test.ts` |
| U339 | `tests/unit/decks/ydk-history.test.ts` |
| U341 | `tests/unit/dom-feedback-controller.test.ts` |
| U343 | `tests/unit/domain-chunk-closure.test.ts` |
| U345 | `tests/unit/drag-ghost-physics.test.ts` |
| U347 | `tests/unit/duel-deck-selection.test.ts` |
| U349 | `tests/unit/duel-field.test.ts` |
| U351 | `tests/unit/duel-priority.test.ts` |
| U353 | `tests/unit/duel-restore-plan.test.ts` |
| U355 | `tests/unit/duel-seed.test.ts` |
| U357 | `tests/unit/duel-state-projector.test.ts` |
| U359 | `tests/unit/duel-worker-attachment.test.ts` |
| U361 | `tests/unit/duel-worker-runtime.test.ts` |
| U363 | `tests/unit/field-navigation.test.ts` |
| U365 | `tests/unit/format-duel-presentation-event.test.ts` |
| U367 | `tests/unit/global-styles.test.ts` |
| U369 | `tests/unit/headless-lifecycle.test.ts` |
| U371 | `tests/unit/image-content-lock.test.ts` |
| U373 | `tests/unit/installed-assets.test.ts` |
| U375 | `tests/unit/installed-card-image-source.test.ts` |
| U377 | `tests/unit/installed-free-play.test.ts` |
| U379 | `tests/unit/installed-images.test.ts` |
| U381 | `tests/unit/installed-worker-deck-validation.test.ts` |
| U383 | `tests/unit/interaction-spec.test.ts` |
| U385 | `tests/unit/material-list.test.ts` |
| U387 | `tests/unit/ocgcore-adapter.test.ts` |
| U389 | `tests/unit/opponent-policy.test.ts` |
| U391 | `tests/unit/persisted-ui-state.test.ts` |
| U393 | `tests/unit/perspective.test.ts` |
| U395 | `tests/unit/placement-candidates.test.ts` |
| U397 | `tests/unit/programmed-scenarios.test.ts` |
| U399 | `tests/unit/progressive-download.test.ts` |
| U401 | `tests/unit/progressive-manifest-memo.test.ts` |
| U403 | `tests/unit/progressive-release.test.ts` |
| U405 | `tests/unit/progressive-storage.test.ts` |
| U407 | `tests/unit/prompt-control-family.test.ts` |
| U409 | `tests/unit/prompt-selection.test.ts` |
| U411 | `tests/unit/replay-opponent-policy.test.ts` |
| U413 | `tests/unit/reviewed-card-pool.test.ts` |
| U415 | `tests/unit/runtime-manifest.test.ts` |
| U417 | `tests/unit/selected-content-fixture.test.ts` |
| U419 | `tests/unit/semantic-release-preparation.test.ts` |
| U421 | `tests/unit/set-image-acquisition.test.ts` |
| U423 | `tests/unit/settle-once.test.ts` |
| U425 | `tests/unit/shell-routes.test.ts` |
| U427 | `tests/unit/shell-store.test.ts` |
| U429 | `tests/unit/shell/free-play-deck-tiles.test.ts` |
| U431 | `tests/unit/shell/handoff-coordinator.test.ts` |
| U433 | `tests/unit/shell/story-battle-request.test.ts` |
| U435 | `tests/unit/snapshot-store.test.ts` |
| U437 | `tests/unit/stage-layout.test.ts` |
| U439 | `tests/unit/story/auto-flip.test.ts` |
| U441 | `tests/unit/story/collection-cards.test.ts` |
| U443 | `tests/unit/story/contrast.test.ts` |
| U445 | `tests/unit/story/encounter-deck.test.ts` |
| U447 | `tests/unit/story/opened-card-quantities.test.ts` |
| U449 | `tests/unit/story/pre-battle-tiles.test.ts` |
| U451 | `tests/unit/story/sell-impact.test.ts` |
| U453 | `tests/unit/story/shop-pack-value.test.ts` |
| U455 | `tests/unit/story/shop-set-fold.test.ts` |
| U457 | `tests/unit/story/story-deck-context.test.ts` |
| U459 | `tests/unit/story/story-decks.test.ts` |
| U461 | `tests/unit/story/story-playback-settings.test.ts` |
| U463 | `tests/unit/story/story-read-log.test.ts` |
| U465 | `tests/unit/story/story-release.test.ts` |
| U467 | `tests/unit/story/story-state.test.ts` |
| U469 | `tests/unit/sum-selection.test.ts` |
| U471 | `tests/unit/ui-settings-store.test.ts` |
| U473 | `tests/unit/zone-list.test.ts` |

## Supporting reads

- S1. FULL: `scripts/lib/asset-delivery/progressive-producer.ts:1–556`; `scripts/lib/asset-delivery/progressive-semantic-validation.ts:1–412`.
- S2. FULL, outside odd partition: `tests/fixtures/node-duel-worker-harness.ts:1–417`; `tests/fixtures/unresponsive-worker-node.ts:1`.
- S3. Search-only: narrative-background attributes in `src/story/screens/NarrativeScreen.svelte`; Worker API declarations in `node_modules/@types/node/worker_threads.d.ts`. Neither counted FULL.
- S4. Initial `wc -l` reported 416 newline-terminated lines for Worker harness; read tool returned final non-newline line too → 417 logical lines.

## Residual risks / next action

- Q1. Parent: fix F1 helper, execute targeted mutation check; fix F2 teardown, verify cleanup on success/failure.
- Q2. Parent: assign 178 UNREAD files to fresh auditors. No whole-suite/codebase completion claim.
- Q3. No tests, browser sessions, mutation probes, builds, lint, typecheck executed. Findings lack runtime reproduction.
- Q4. New files after frozen commit excluded; independently reviewed elsewhere per parent steering.
- Q5. Imported helpers outside supporting-read list not fully audited. FULL describes assigned source bytes, not transitive dependency closure.
- Q6. N1 remains uncertain pending startup-timing evidence. No corrective action taken.
- Q7. Runtime/parent must persist report at authoritative path.