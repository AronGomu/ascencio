# T11 legacy browser assertion mapping

State: repair in progress. Original assertions recoverable from immutable baseline `f3f3c541fd912717bc743d7a6508c3ebda7c5e82`; original reports/logs retained. No production format relaxation, selector shortcut, test skip, or budget increase. Additional parent-approved private parsed-manifest memo preserves per-read persisted-row/digest verification; canonical warning latency 8993ms menu / 12420ms Battle after repair.

## Domain setup

| ID | Original | Replacement / retained obligation | Source |
| --- | --- | --- | --- |
| S1 | Domain route immediately available from compiled Content | Each browser context downloads real canonical required bytes through `ProgressiveContentStore`, verifies/seals, calls `prepareRelease` and real `ApplicationService.activate`, reloads, waits for selected readiness. No DB selector injection. | `e2e/selected-content-fixture.ts`, `tests/fixtures/selected-content-browser.ts` |
| S2 | Hundreds of runtime shards per test | Test-only parser-supported consolidated representation. Exact complete Battle DTO, WASM, scripts/text/card records, Story/Cards, every media reference equal canonical producer output; every required file digest/size checked. Canonical smoke retained in `06-consolidated-smoke.log`; equivalence `08-equivalence.log` and full headless. | `tests/fixtures/consolidated-runtime.ts`, `tests/unit/selected-content-fixture.test.ts` |
| S3 | Inject schema4 into legacy `saves` for current gameplay tests | Supported schema6 generation repository under real shared session; slot/revision semantics retained. Explicit legacy DB migration tests retain legacy input. | `putSelectedStorySave`, `selectedStorySlots`; Story/header/map/stage/editor specs |
| S4 | On-demand root image GET for art/layout | One worker-local real media download, captured only after every optional byte/path/hash/size matches selected manifest; restore only optional Cache/file rows into separately installed contexts. No selector, required receipts, saves, jobs, or settings copied. Dedicated download tests stay real. | `tests/fixtures/selected-media-profile.ts`; `installedMedia` fixture |

## Asset / deck assertions

| ID | Original | Replacement / retained obligation | Source |
| --- | --- | --- | --- |
| A1 | Root unhashed fonts return exact source bytes | Discover emitted CSS `@font-face` URL; require same-origin hashed path, font MIME, `wOF2` magic, exact SHA-256, actual loaded font. Both fonts checked. | `e2e/asset-root-urls.spec.ts`, `tests/fixtures/emitted-font-contract.ts` |
| A2 | CORE exposes runtime/WASM/card art URLs | CORE must not expose gameplay bytes (404 or HTML SPA fallback). Required runtime/WASM transfer identities checked by selected fixture; optional full/cropped identities checked by verified media profile. Runtime network remains zero after activation. | Asset URL spec; `duel-smoke.spec.ts` production initialization; S2/S4 |
| A3 | Preset tile IDs and `kind: preset` Worker inputs | Selected chapter tile IDs and exact `kind: cards` arrays from canonical prepared chapter decks. Pair persistence, local deck arrays, one Worker response per opaque prompt retained. | `e2e/duel-smoke.spec.ts`, `e2e/deck-select-layout.spec.ts` |
| A4 | Continue absent; Story DB absent on fresh menu | Continue disabled; activated generation contains no saves. Empty-generation DB creation belongs activation, not menu probing. Zero duel Worker/runtime route requests retained. | Root-route test, `selectedStorySlots` |
| A5 | Illegal local deck hidden; inline `40` reason | Tile present but disabled; exact accessible label `Select Thirty Nine, Illegal · Local deck · Main Deck needs 1 more card(s).`; player seat remains unchanged. Original 39-card invalid input retained. | `e2e/duel-smoke.spec.ts` |
| A6 | Grid tile always fills entire track | Assert actual existing `max-width: 420px` cap via `min(track, 420)`, still assert responsive column growth and phone single column. No CSS change. | `e2e/duel-smoke.spec.ts`, existing Deck Select CSS |
| A7 | Sort E2E uses modern cards outside chapter01 | All seven modes, both directions, all zones, undo/redo retained using chapter-legal canonical Fusion cards. Original exact matrix including Fusion/Synchro/Xyz/Link retained unchanged in canonical-data unit test with all zones and undo/redo (14 cases). No expected values computed using tested sorter. | `e2e/deck-editor.spec.ts`, `tests/unit/decks/canonical-sort-matrix.test.ts` |
| A8 | Long-name card outside chapter01 | Canonical chapter card `72989439`, `Black Luster Soldier - Envoy of the Beginning`; same single-line/overflow/layout assertions. | `e2e/deck-editor.spec.ts` |
| A9 | Prototype migration seeded after editor already mounted | Seed unchanged legacy schema at Main Menu, then enter editor; first-load migration assertions unchanged. | `e2e/deck-editor.spec.ts` |

## Duel / Story assertions

| ID | Original | Replacement / retained obligation | Source |
| --- | --- | --- | --- |
| D1 | Init scripts installed before first navigation | Selected fixture already navigated; reload after capture script registration and `openDuel` navigation activates interception before app/Worker initialization. Capture retains Worker commands/events, URL leases, listeners, event-paint timings. | `e2e/duel-smoke.spec.ts` |
| D2 | Slow network runtime load and image preload | Hold actual Cache reads; refresh during required read, release/reload recovery; hold optional image reads while legal Worker response proceeds. No HTTP request fabricated for cache-only paths. | `e2e/duel-smoke.spec.ts` |
| D3 | Abort root image HTTP; expect Battle image-warning | Required-only install has absent optional bytes; deterministic data-SVG placeholders, enabled legal control, zero media GET, Shell persistent optional-media warning. Original 30s assertion timeout retained after measured production parsing repair; diagnostic baseline observed to 120s separately. Suite/perf thresholds unchanged. | `e2e/duel-smoke.spec.ts` |
| D4 | Fatal Worker timeout focuses Battle heading and creates replacement Worker | Accepted T9 disposes Battle. Parent-approved mapping: Shell recovery alert/Main Menu, zero duel, every constructed Worker terminated, unchanged selector/save rows, released lifecycle lease. Exact watchdog timeout/replacement unit assertions retained. **Old heading-focus assertion removed as not applicable; no equivalent Shell keyboard-focus coverage claimed. Missing recovery focus handoff remains residual accessibility gap.** | `e2e/duel-smoke.spec.ts`, `tests/unit/duel-worker-client.test.ts`; parent decision retry2 |
| D5 | Corrupt checkpoint/manual slot returns directly to Story | Accepted T9 `APP_SAVE_MIGRATION_FAILED` wrapper fails closed. Assert recovery, zero duel, healthy rows/selector unchanged, lifecycle lease released. Clear only injected slot via supported repository under shared session; reload; same healthy progress continues. No production corrupt-save change. | `e2e/story-duel.spec.ts`, `e2e/story.spec.ts`, `e2e/story-stage-sizing.spec.ts` |
| D6 | Stage sale-impact fixture selects unowned Blue-Eyes | Select canonical owned starter card `46986414` (Dark Magician); same sale-impact dialog geometry and recovery checks across five viewports. | `e2e/story-stage-sizing.spec.ts` |
| D7 | Shop keyed only by code, crashes on canonical regional printings | Approved production fix uses collision-safe JSON full tuple `(code, printingCode, sourceRarity, sourceRarityCode)`, URI-encoded unique DOM IDs. Every printing, price, purchase `(code,rarity)` dispatch preserved. RED `each_key_duplicate`: `12-story-defect-red.log`, `13-printing-red.log`; GREEN component/native retained. Component consumers gain explicit fixture keys, existing IDs/assertions unchanged. | `src/story/StoryApp.svelte`, `src/story/shop/ShopCardListScreen.svelte`; ShopCardList/cancel-controls/set-list-rarity-sort/story-card-tile tests |

## Zero-test shell

Z1. `tests/component/content-installer.test.ts` baseline contains only supersession comment and `export {}`. Removal justified by exact runner error in `artifacts/T11-EVIDENCE/18-check-browser.log`: `Error: No test suite found in file /home/aron/projects/ascencio/tests/component/content-installer.test.ts`. Replacement `InstallContentScreen.test.ts` retained; no invented passing test or `--passWithNoTests`.

## Assumptions

Q1. Canonical private fixture assets remain local prerequisites; `publishReady: false` is not changed by acquisition or test installation.

Q2. Canonical chapter restrictions replace full compiled catalog availability in browser tests, not in explicit legacy/cross-era model regressions.


## Approved mounted-image, pointer-hover and native-warning repairs

| ID | Before | After / preserved proof | Evidence |
| --- | --- | --- | --- |
| I1 | Library metadata URLs null; no CardImageSource consumer | Source forwarded from host; crop covers/selected rows, full selected rows only. Full canonical optional profile3311 retained. Exact row art/frame/copy assertion retained, screenshot added. | RED44/52; component54; native75 further RED; final93 pending |
| I2 | Battle factory eagerly acquired/retained entire catalog; synchronous handle release no-op | Zero work until mounted handle, asynchronous URL subscription, per-code live refcounts, cap4 across replacement libraries, final-owner/abort/dispose release. Original native activeUrls==mountedUrls, tray/restart/destroy, perf/resource thresholds unchanged. | RED55/58; GREEN60/76; native75 lifecycle PASS |
| I3 | Old teardown tests awaited a factory-wide eager operation | Deferred acquired lease after abort still released once; source failure followed by disposal drains late siblings; repeated disposal releases all successful acquisitions once. Work begins through mounted handles, not full catalog. No failed/missing image becomes gameplay failure. | `tests/unit/installed-battle-images.test.ts`,11 cases; GREEN76 |
| I4 | App concealment test waited for eager preload then reset source call history | Assert zero pre-mount work; exact one known-code acquisition shared by visible card+preview; hidden hover keeps prior preview and makes no new lookup. Existing identity/preview assertions retained and code equality added. | RED71; GREEN76 |
| I5 | Shared art retained revoked URL on source/selection/deck changes | Private code/original-resolution provenance guard; legacy full→cropped error fallback still valid. Derived host resolver refreshes identity, no remount or shared API widening. | RED62; GREEN63/89 |
| I6 | Real pointer-enter caches hoverList before selected images arrive; restList refresh hidden underneath it | Private hover loader reacts to resolver/key; token rejects obsolete completions, optional rejection clears hover, unmount prevents publication. Same-key rows remain mounted through readiness; filter/sort/focus and no extra requests asserted. | Native75 RED, diagnostic86; pointer RED87; GREEN89 |
| I7 | Story Worker counter init registered on already loaded fixture page; hash-only route yields undefined | Reload before measuring. Zero Worker, zero runtime/wasm/prototype route requests unchanged. | RED44; native75 PASS |
| I8 | Native WebKit layout diagnostic became required-data recovery | Ignore exact `ResizeObserver loop completed with undelivered notifications.` only with absent/null Error payload. Same-message real Error, other/substring diagnostics, rejected promise still recover/dispose. Warning remains observable, not suppressed. | Native44/75 RED; component81 RED→85 GREEN43/43 |
| I9 | Random opening-hand misses called test.skip in activation/placement/spell-trap pointer evidence | Reuse bounded40-live-prompt walk, at most2 duels; real legal keyboard responses only. Original mounted/actionable guards, pointer geometry, cancel/no-response and opaque-response assertions retained. Count/title unchanged, no test.skip remains in duel smoke. | Activation native75 PASS; types91; final93 matrix pending |

M1. Battle diagnostic image statuses are now mounted-observed, narrower than prior catalog inventory. Shell's full inventory warning remains; do not treat mounted statuses as full-media verification.

M2. Library full art is selection-scoped preload for existing synchronous hover API, not hover-only or viewport-aware acquisition. Persisted lists have no90-card hard cap; no broader preload or hidden limit claimed.

M3. Private hover refresh treats the latest same-key resolver result as replacement; Library resolves in-memory rows with Promise.resolve. Existing valid hovered rows/focus retained until current result; pointer-out/key removal/token replacement cancels old publication. Only optional hover rejection is cleared; authoritative session/save/runtime failure paths remain unchanged.


## Frozen-source follow-up

F1. Pending cropped URL validity: RED98 proves stale blob:x while replacement resolver awaits; approved Main/Extra/Side presentation-row copies clear imageUrl only, retaining keyed rows/text/focus and original caller data. Current token alone may restore images; obsolete rejection cannot clear latest result. GREEN100166/166; native101 Library7.9s.

F2. No-skip real-prompt acquisition:93 exposes auto-chain race, not app failure. Existing UI manual settings stabilize bounded setup;96 activation + three placement cases pass. Field-set probe now only detects legal chip; original automatic settings restored before original keyboard set/geometry/response assertions. Native101 passes.

F3. Geometry: original2px bottom-anchor threshold unchanged. Wait actual120ms focus transform to settle before original paired bounding boxes; retain atomic comparison as extra diagnostic. Native101 both deltas0.624755859375px; chip visibility/column-reverse/hit-test/response assertions remain. No CSS change, forced style, fixed sleep, timeout or budget increase.

F4. Native93 DF-16 profile unchanged: Chromium149.0.7827.55,1280x720,scale1,CPU4x,5 warmups/30 samples, nearest-rank p95. Update-to-paint29.5ms<50; input17.8ms<100; no normal long task>50. Full106 repeats original gate rather than substituting this focused pass.


## Retry3 test-only prompt setup

R1. Interrupted106 case68 expected Main2 enabled while manual chain prompt remained. Existing40-step legal walker now accepts battle readiness, checks control attachment before enabled state, waits command for current requested phase. Original Battle/Main2 clicks, phase assertions, first single EndTurn click retained. Focused111 exposed additional End-phase chain after final EndTurn; chain-only40-step wait now answers only attached/unanswered real prompts, verifies exactly one response per prompt, never presses EndTurn again or forces phase. Original opponent-phase and disabled-controls assertions retained.

R2. Interrupted106 activation setup exhausted40 prompts during opponent Battle chain; immediate restart opened menu beneath floating confirm (`floating-field-window-confirm-handle` intercepts pointer events). Existing bounded actual-prompt walker reaches next player idle before same surrender/restart UI. No forced click, style mutation, hidden overlay, seeded hand, fake engine response or skipped random miss. Original measured activation-zone/drop-confirm/cancel/no-response assertions unchanged. Product menu/floating-window overlap not fixed, remains residual.

R3. Interrupted106 keyboard trace first monster Enter → hidden in-band chips → helper assumes submission, but screenshot shows hover zoom Summon/Set and same prompt10. Mouse-based settings setup now parks pointer at(0,0), asserts no `.hand-zoom-overlay`, before keyboard-only timing/response loop begins. No pointer inside measured walk; keyboard spatial/tab/chip navigation, defense-focus, geometry checks, every prompt exactly once, unsurrendered win/loss, diagnostics unchanged. Focused111 completed57 prompts with zero duplicates. Mixed-input hover/keyboard interaction not claimed repaired.

R4. Full106 never completed: no exit/stage JSON; log111/139 plus interrupted112 context-close artifact. Full6GiB `retained-interrupted106-output/` preserved. Three completed failures retain traces/snapshots; `109-trace-call-mapping.json` records calls and trace hashes. Original44 remains complete failed131/7/1.
