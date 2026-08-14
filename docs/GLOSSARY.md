# Glossary

[x] Activated
[x] Project scanned

Shared vocabulary between user and agents. Say the word, mean the code.

## Frontend

| word | short description | ref in code |
| ---- | ----------------- | ----------- |
| app | One browser product; current entry selects production duel or isolated prototype while shell migration is pending | `src/main.ts`, `src/app/select-app-entry.ts` |
| shell | Future thin composition/router layer owning transitions among three lazy UI domains | ADR-022, future `src/shell/` |
| duel simulator | Production battle UI plus Worker-owned rules runtime | `src/app/`, `src/duel/`, `src/field/`, `src/worker/` |
| deck editor | Local deck library/editor domain; currently integrated as isolated prototype | `src/decks/`, `src/prototypes/deck-builder/` |
| visual novel | Narrative/map/campaign domain; currently integrated as isolated prototype | `src/prototype/`, future `src/story/` |
| facade | Narrow domain-owned public lifecycle/contract boundary used by shell | future `src/battle/index.ts`, `src/decks/index.ts`, future `src/story/index.ts` |
| store | Typed duel view state store + reducer | `src/app/stores/duel-store.ts` (`createDuelStore`, `reduceDuelViewState`, `DuelViewState`) |
| client | Main-thread typed Worker client/port | `src/app/DuelWorkerClient.ts` (`DuelWorkerClient`, `DuelWorkerPort`) |
| field | Semantic DOM duel field component | `src/app/components/DuelField.svelte`, `src/app/components/duel-field/FieldBoard.svelte` |
| board | Board view model projected for rendering | `src/field/board-view-model.ts` (`BoardCardView`, `BoardZoneView`, `BoardStackView`) |
| zone | Physical zone ids + field geometry constants | `src/field/duel-field-layout.ts` (`PhysicalZoneId`, `FieldZoneKind`), `src/app/components/duel-field/ZoneControl.svelte` |
| hud | Life points / turn / phase heads-up display | `src/app/components/duel-field/DuelHud.svelte`, `.duel-hud` in `src/styles/app.css` |
| prompts | Prompt UI controls and control families | `src/app/prompts/PromptControls.svelte`, `prompt-control-family.ts` |
| selection | Prompt choice validation / field decision bar | `src/app/prompts/prompt-selection.ts` (`validatePromptSelection`), `src/app/components/duel-field/FieldActionBar.svelte` |
| interaction | Active interaction spec + session reducer | `src/app/prompts/interaction-spec.ts`, `interaction-session.ts` (`synchronizeInteractionSession`) |
| navigation | Keyboard/spatial field focus movement | `src/app/prompts/field-navigation.ts` (`reduceFieldNavigation`, `SpatialNeighbors`) |
| presentation | Event → DOM feedback commands, scheduler | `src/app/presentation/presentation-command.ts` (`PresentationScheduler`) |
| feedback | Non-authoritative CSS/SVG field feedback state | `src/app/presentation/dom-feedback-controller.ts`, `src/app/components/duel-field/FieldLines.svelte` |
| log | Duel event log formatting + panel | `src/app/presentation/format-duel-log-entry.ts`, `src/app/components/duel-field/DuelLog.svelte` |
| preview | Sticky card art + bounded scroll text column | `src/app/components/CardPreviewPanel.svelte`, `src/app/presentation/card-preview.ts` |
| rail | Right-side LP, turn, phase, status column | planned `src/app/components/DuelRail.svelte`, `docs/ADR/019_ADR_full_height_duel_shell_and_pixel_geometry.md` |
| cardlist | Browse/target floating physical-card window | `src/app/components/duel-field/ZoneListDialog.svelte`, `docs/ADR/021_ADR_card_list_dialog_modes_and_selection.md` |
| images | Card art cache, leases, placeholders | `src/app/images/card-image-cache.ts` (`CardImageLibrary`, `CardImageLease`) |
| styles | Single global stylesheet | `src/styles/app.css` |
| boundary | Field render error boundary | `src/app/components/duel-field/DuelFieldErrorBoundary.svelte` |

## Backend

Worker, engine, and asset pipeline are "backend" here — nothing runs on a server.

| word | short description | ref in code |
| ---- | ----------------- | ----------- |
| worker | Dedicated duel Worker entrypoints | `src/worker/duel.worker.ts`, `duel.worker-browser.ts`, `duel.worker-node.ts` |
| runtime | Worker-side command/event runtime loop | `src/worker/DuelWorkerRuntime.ts`, `create-browser-runtime.ts` |
| headless | Non-UI duel driver used by tests/tools | `src/worker/HeadlessDuelController.ts` |
| session | Per-duel engine session lifecycle | `src/worker/engine/DuelSession.ts` (`DuelConfiguration`, `DuelProcessBoundary`) |
| adapter | ocgcore WASM binding layer | `src/worker/engine/OcgCoreAdapter.ts` (`EngineDuelHandle`, `EngineMessage`) |
| core | Permanently frozen vendored `ocgcore.sync.wasm` 0.1.2 + loader | `vendor/ocgcore-wasm/0.1.2/`, `src/worker/engine/load-vendored-core-node.ts` |
| protocol | Engine message parsing/classification | `src/worker/protocol/message-classification.ts` (`classifyEngineMessage`) |
| registry | Prompt binding + response encoding | `src/worker/protocol/PromptRegistry.ts` (`buildEnginePrompt`) |
| projector | Engine queries → public duel state | `src/worker/projection/DuelStateProjector.ts` (`ProjectionUpdate`, `QueriedPublicCard`) |
| opponent | Deterministic computer-player policy | `src/worker/opponent/OpponentPolicy.ts` (`OpponentDecision`) |
| contracts | Shared command/event/state type surface | `src/duel/contracts/` (`duel-command.ts`, `duel-worker-event.ts`, `public-duel-state.ts`) |
| seed | Deterministic RNG seeding | `src/worker/engine/duel-seed.ts` (`DuelSeed`, `createProductionSeed`) |
| preset | MVP deck presets and `.ydk` parsing | `src/duel/presets/mvp-preset.ts`, `deck-parser.ts` (`parseYdk`) |
| dependencies | Card text/script/string bundle for a duel | `src/worker/assets/active-duel-dependencies.ts` |
| manifest | Runtime snapshot manifest parse/validate | `src/worker/assets/runtime-manifest.ts` (`parseRuntimeSnapshotManifest`) |
| snapshot | Versioned asset revision set + pointer | `src/storage/snapshot-store.ts` (`StoredSnapshot`, `SnapshotPointer`) |
| storage | IndexedDB/Cache persistence + cleanup | `src/storage/revision-cache-cleanup.ts`, `snapshot-store.ts` |
| trace | Bounded diagnostic trace ring buffer | `src/worker/diagnostics/duel-trace.ts` (`BoundedDuelTrace`) |
| errors | Typed duel error taxonomy | `src/worker/duel-errors.ts`, `src/duel/contracts/duel-error.ts` |
| bridge | Node `worker_threads` transport shim | `src/worker/worker-thread-bridge-node.ts` |

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
