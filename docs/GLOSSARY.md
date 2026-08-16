# Glossary

[x] Activated
[x] Project scanned

Shared vocabulary between user and agents. Say the word, mean the code.

## Frontend

| word | short description | ref in code |
| ---- | ----------------- | ----------- |
| app | One browser product; current entry selects production duel or isolated prototype while shell migration is pending | `src/main.ts`, `src/battle/app/select-app-entry.ts` |
| shell | Future thin composition/router layer owning transitions among three lazy UI domains | ADR-022, future `src/shell/` |
| duel simulator | Production battle UI plus Worker-owned rules runtime | `src/battle/app/`, `src/battle/duel/`, `src/battle/field/`, `src/battle/worker/` |
| deck editor | Local deck library/editor domain; currently integrated as isolated prototype | `src/decks/`, `src/prototypes/deck-builder/` |
| visual novel | Narrative/map/campaign domain reached at `#/story` | `src/story/` |
| shop | Story card shop: keeper, 50-set browser, packs, singles, sell | `src/story/shop/` |
| dp | Duel-point wallet, starts at 1000 | `StoryState.dp`, ADR-033 |
| booster | Unopened pack count per shop set | `StoryState.boosters`, `src/story/shop/data/pack-generator.ts` |
| collection | Owned card counts by card code | `StoryState.collection` |
| rarity | Printed rarity from set data, inference fallback, halo colors | `src/story/shop/data/shop-set-data.ts`, ADR-035 |
| setdata | First-50-sets JSON asset + offline-cached loader | `public/story/shop-sets.v1.json`, `src/story/shop/data/shop-set-data.ts` |
| topbar | Story DP/shop/deck strip on narrative, map, shop | `src/story/components/StoryTopBar.svelte` |
| facade | Narrow domain-owned public lifecycle/contract boundary used by shell | future `src/battle/index.ts`, `src/decks/index.ts`, `src/story/index.ts` |
| store | Typed duel view state store + reducer | `src/battle/app/stores/duel-store.ts` (`createDuelStore`, `reduceDuelViewState`, `DuelViewState`) |
| client | Main-thread typed Worker client/port | `src/battle/app/DuelWorkerClient.ts` (`DuelWorkerClient`, `DuelWorkerPort`) |
| field | Semantic DOM duel field component | `src/battle/app/components/DuelField.svelte`, `src/battle/app/components/duel-field/FieldBoard.svelte` |
| board | Board view model projected for rendering | `src/battle/field/board-view-model.ts` (`BoardCardView`, `BoardZoneView`, `BoardStackView`) |
| zone | Physical zone ids + field geometry constants | `src/battle/field/duel-field-layout.ts` (`PhysicalZoneId`, `FieldZoneKind`), `src/battle/app/components/duel-field/ZoneControl.svelte` |
| hud | Life points / turn / phase heads-up display | `src/battle/app/components/duel-field/DuelHud.svelte`, `.duel-hud` in `src/styles/app.css` |
| prompts | Prompt UI controls and control families | `src/battle/app/prompts/PromptControls.svelte`, `prompt-control-family.ts` |
| selection | Prompt choice validation / field decision bar | `src/battle/app/prompts/prompt-selection.ts` (`validatePromptSelection`), `src/battle/app/components/duel-field/FieldActionBar.svelte` |
| interaction | Active interaction spec + session reducer | `src/battle/app/prompts/interaction-spec.ts`, `interaction-session.ts` (`synchronizeInteractionSession`) |
| navigation | Keyboard/spatial field focus movement | `src/battle/app/prompts/field-navigation.ts` (`reduceFieldNavigation`, `SpatialNeighbors`) |
| presentation | Event → DOM feedback commands, scheduler | `src/battle/app/presentation/presentation-command.ts` (`PresentationScheduler`) |
| feedback | Non-authoritative CSS/SVG field feedback state | `src/battle/app/presentation/dom-feedback-controller.ts`, `src/battle/app/components/duel-field/FieldLines.svelte` |
| log | Duel event log formatting + panel | `src/battle/app/presentation/format-duel-log-entry.ts`, `src/battle/app/components/duel-field/DuelLog.svelte` |
| preview | Sticky card art + bounded scroll text column | `src/battle/app/components/CardPreviewPanel.svelte`, `src/battle/app/presentation/card-preview.ts` |
| rail | Right-side LP, turn, phase, status column | planned `src/battle/app/components/DuelRail.svelte`, `docs/ADR/019_ADR_full_height_duel_shell_and_pixel_geometry.md` |
| cardlist | Browse/target floating physical-card window | `src/battle/app/components/duel-field/ZoneListDialog.svelte`, `docs/ADR/021_ADR_card_list_dialog_modes_and_selection.md` |
| images | Card art cache, leases, placeholders | `src/battle/app/images/card-image-cache.ts` (`CardImageLibrary`, `CardImageLease`) |
| styles | Single global stylesheet | `src/styles/app.css` |
| boundary | Field render error boundary | `src/battle/app/components/duel-field/DuelFieldErrorBoundary.svelte` |

## Backend

Worker, engine, and asset pipeline are "backend" here — nothing runs on a server.

| word | short description | ref in code |
| ---- | ----------------- | ----------- |
| worker | Dedicated duel Worker entrypoints | `src/battle/worker/duel.worker.ts`, `duel.worker-browser.ts`, `duel.worker-node.ts` |
| runtime | Worker-side command/event runtime loop | `src/battle/worker/DuelWorkerRuntime.ts`, `create-browser-runtime.ts` |
| headless | Non-UI duel driver used by tests/tools | `src/battle/worker/HeadlessDuelController.ts` |
| session | Per-duel engine session lifecycle | `src/battle/worker/engine/DuelSession.ts` (`DuelConfiguration`, `DuelProcessBoundary`) |
| adapter | ocgcore WASM binding layer | `src/battle/worker/engine/OcgCoreAdapter.ts` (`EngineDuelHandle`, `EngineMessage`) |
| core | Permanently frozen vendored `ocgcore.sync.wasm` 0.1.2 + loader | `vendor/ocgcore-wasm/0.1.2/`, `src/battle/worker/engine/load-vendored-core-node.ts` |
| protocol | Engine message parsing/classification | `src/battle/worker/protocol/message-classification.ts` (`classifyEngineMessage`) |
| registry | Prompt binding + response encoding | `src/battle/worker/protocol/PromptRegistry.ts` (`buildEnginePrompt`) |
| projector | Engine queries → public duel state | `src/battle/worker/projection/DuelStateProjector.ts` (`ProjectionUpdate`, `QueriedPublicCard`) |
| opponent | Deterministic computer-player policy | `src/battle/worker/opponent/OpponentPolicy.ts` (`OpponentDecision`) |
| contracts | Shared command/event/state type surface | `src/battle/duel/contracts/` (`duel-command.ts`, `duel-worker-event.ts`, `public-duel-state.ts`) |
| seed | Deterministic RNG seeding | `src/battle/worker/engine/duel-seed.ts` (`DuelSeed`, `createProductionSeed`) |
| preset | MVP deck presets and `.ydk` parsing | `src/battle/duel/presets/mvp-preset.ts`, `deck-parser.ts` (`parseYdk`) |
| dependencies | Card text/script/string bundle for a duel | `src/battle/worker/assets/active-duel-dependencies.ts` |
| manifest | Runtime snapshot manifest parse/validate | `src/battle/worker/assets/runtime-manifest.ts` (`parseRuntimeSnapshotManifest`) |
| snapshot | Versioned asset revision set + pointer | `src/battle/storage/snapshot-store.ts` (`StoredSnapshot`, `SnapshotPointer`) |
| storage | IndexedDB/Cache persistence + cleanup | `src/battle/storage/revision-cache-cleanup.ts`, `snapshot-store.ts` |
| trace | Bounded diagnostic trace ring buffer | `src/battle/worker/diagnostics/duel-trace.ts` (`BoundedDuelTrace`) |
| errors | Typed duel error taxonomy | `src/battle/worker/duel-errors.ts`, `src/battle/duel/contracts/duel-error.ts` |
| bridge | Node `worker_threads` transport shim | `src/battle/worker/worker-thread-bridge-node.ts` |

## Other

| word | short description | ref in code |
| ---- | ----------------- | ----------- |
| scripts | Node asset/verify CLI entrypoints | `scripts/sync-assets.ts`, `verify-assets.ts`, `download-images.ts` |
| sync | Pin/clone upstream card data repos | `scripts/lib/sources.ts` (`syncRepository`, `validatePinnedRevision`) |
| catalog | SQLite card DB read + sharding | `scripts/lib/catalog.ts` (`readCatalog`), `transform.ts` (`catalogShard`) |
| strings | `strings.conf` system-string parser | `scripts/lib/strings.ts` (`parseStringsConf`) |
| tar | Minimal tar reader for downloads | `scripts/lib/tar.ts` (`readTarFiles`) |
| lock | Source pin file + run lock | `assets-source-lock.json`, `scripts/lib/run-lock.ts` |
| limits | Hard caps on untrusted asset sizes | `scripts/lib/limits.ts` (`MAX_CATALOG_RECORDS`, `MAX_DATABASE_BYTES`) |
| generated | Build output of the asset pipeline | `generated/{assets,runtime,card-images,engine}/current` |
| plugins | Vite plugins serving runtime assets/core | `scripts/lib/vite-runtime-assets.ts`, `vite-sync-core.ts` |
| vite | Build/dev config incl. worker bundling | `vite.config.ts`, `vitest.config.ts` |
| unit | Vitest unit suite | `tests/unit/` |
| component | Svelte component tests via testing-library | `tests/component/` |
| integration | Worker/session/wasm integration tests | `tests/integration/` |
| e2e | Playwright browser smoke test | `e2e/duel-smoke.spec.ts`, `playwright.config.ts` |
| fixtures | Fake adapters, harnesses, scenarios | `tests/fixtures/` (`fake-ocgcore-adapter.ts`) |
| transcripts | Recorded deterministic duel goldens | `tests/fixtures/transcripts/*.json` |
| lua | Test card scripts driving the engine | `tests/fixtures/core-scripts/*.lua` |
| architecture | Atomic numbered decision docs | `docs/architecture/architecture.md` and subfolders |
| domain | One owned UI/business module with public `index.ts`; no cross-domain deep imports | ADR-022 |
| worktree | Isolated checkout for one UI branch; integration config/contracts stay centrally owned | ADR-022 |
| adr | Accepted architecture decision records | `docs/ADR/` |
| guide | Generated HTML developer guide | `docs/developer-guide/` |
| checks | Aggregate quality gate npm scripts | `package.json` (`check`, `check:headless`, `check:browser`) |
