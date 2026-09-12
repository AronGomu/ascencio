# T6 final review-fix acceptance

**Next: reviewer opens full uncommitted diff. Requested blockers repaired; independent final review required. No staging/commits. Legacy asset gates remain blocked.**

## Final pass: requested blockers

| ID | Checked outcome | Implementation / red → green evidence |
| --- | --- | --- |
| F1 | Battle leases acquired before abort check; maximum six concurrent reads; first failure stops new reads; siblings drain before cleanup; each acquisition released once | `src/battle/app/images/card-image-cache.ts:75-123`; `tests/unit/installed-battle-images.test.ts` covers deferred acquire→abort, rejected promise/typed failure→late siblings, repeat disposal. `final-review/red.txt` → `final-review/final-focused.txt`. |
| F2 | Editor late image resolution disposes immediately once; no repository/controller initialization after unmount | `src/deck-editor/DeckEditorApp.svelte:165-182`; `tests/component/deck-editor/installed-image-teardown.test.ts`. Post-starter await also checks disposed before controller creation. |
| F3 | Collection null/route exit/unmount invalidate token; stale success disposes once; stale failure cannot redirect newer route | `src/shell/AppShell.svelte:406-428,450-483`; `tests/component/collection-image-teardown.test.ts` covers route exit, unmount, stale rejection, sibling-read failure with late images. Concurrent reads settle before failed-open cleanup. |
| F4 | Provenance separated from mutability; installed decks never gain Bundled/preset display copy | `DeckTileModel.meta` carries provenance; `readOnly` replaces misleading `bundled` capability across all hosts. `DeckSelectScreen` guards open/default/rename/delete; duplicate remains enabled. Free Play component/unit, DeckSelect, Story adapter regressions updated. Admin says “Launch installed duel”; durable checklist updated, manual steps unchecked. |
| F5 | Private built app installs exact run, reaches Free Play, launches emitted built Worker, surrenders through real UI at root/subpath | `e2e-content/built-installer.spec.ts`, `playwright.content-built.config.ts`. Vite preview serves private built output, not dev modules. Each run hashes 38 served JS files against emitted bytes; Worker performance resources inspected; no `/src/`, `/@vite/`, `/@fs/` requests. `built-playwright-report.json`: 2 expected, 0 unexpected/skipped/flaky. |

## Browser proof boundaries

B1. Built black-box proof: `final-review/built-installed-terminal-root.json`, `final-review/built-installed-terminal-subpath.json`; screenshots `built-installed-root.png`, `built-installed-subpath.png`. Root Worker: `assets/duel.worker-browser-DbNnsZT5.js`; subpath Worker: `/ygo-story-duel/assets/duel.worker-browser-VqL_nPUB.js`. No source imports, prototype patches, request mocks, engine counters, or source-module instrumentation in built test. Terminal assertion: heading `Duel surrendered` after menu surrender confirmation.

B2. Separate source-boundary calibrated rejection retained in `e2e-content/real-installer.spec.ts`: each out-of-pool seat produces typed rejection with Worker-local `createDuel=0`; valid duel in same instrumented Worker produces surrender with `createDuel=1`. Evidence: `final-review/production-boundary-rejected-seats.json`, `final-review/calibrated-engine-counter-valid-terminal.json`. This counter claim applies only to source-boundary test, never built test.

B3. Exact input: `generated/asset-delivery/runs/7660bc2c-520a-41fa-a6fd-dfdecc770807`; snapshot SHA `03571be5332cda2bf41de3b09a3c9350a1e82b7325aaeea48f0fafdc309808d0`; bootstrap binds index SHA `50a83e1523980debe40f2fc7633dc6faccd06b885519dcaea97fd4229f852cb4`. No fallback fixtures substituted for exact installed runtime.

B4. Source-only CORE build Chromium remains separate: 8 passing root/subpath locked/offline-shell checks. Installed offline gameplay, autonomous victory, arbitrary effects, publication permission remain unclaimed.

## Checked evidence

| ID | Check | Observed result | Evidence |
| --- | --- | --- | --- |
| V1 | Focused Worker/pool/ref/receipt/reader/image/admin/projection/storage + lifecycle tests | 14 files, 195 tests passed; includes exact installed real-WASM regressions | `final-review/final-focused.txt` |
| V2 | Full components | 133 files, 1,234 tests passed | `final-review/full-components-3.txt` |
| V3 | Full source content Chromium / built Chromium | 12 source + 2 built passed, 0 skipped/flaky; exact run included | `final-review/source-content-chromium.txt`, `final-review/built-chromium-final.txt`, Playwright JSON reports |
| V4 | Source-only CORE Chromium | 8 passed; root/subpath/offline-shell checks | `final-review/source-core-chromium.txt`, `core-source-playwright-report.json` |
| V5 | Private build/reproducibility | PASS; 105 reproducible files; emitted budgets pass | `final-review/build-reproducible.txt`, `final-review/build-verify-exact.txt` |

## Blocker repairs: Worker

| ID | Requirement | Implementation / regression |
| --- | --- | --- |
| R1 | Runtime support separate from deck permission | `src/battle/worker/assets/installed-runtime-dependencies.ts` derives codes from exact verified runtime catalog shards; preloads all card-script shards plus globals. Exact run: 14,794 card/text/image records; 13,549 scripts; 25 globals. `create-browser-runtime.ts:136-166` keeps `allowedCardCodes` chapter-only. Real-WASM test legally activates Scapegoat, resolves four Sheep Tokens; either seat sleeving support-only code 73915052 is rejected before `createDuel`. |
| R2 | Full deck validation before engine | `src/battle/worker/decks/resolve-duel-decks.ts:70-94` calls existing `validateDeckDraft` against installed catalog / `PROTOTYPE_RULESET`. Both seats tested for wrong Main/Extra zones, tokens, forbidden cards, limited/semi-limited quantities; invalid cases observe `createDuel=0`. |
| R3 | Immutable first initialize identity | `src/battle/worker/DuelWorkerRuntime.ts:214,354-383` clones queued input; pins complete catalog/snapshot/runtime/chapter identity before async initialization. Identical clones are idempotent; concurrent differing refs produce typed `snapshot_validation_failed`. Mutation-after-enqueue regression included. New content requires new Worker. |
| R4 | Receipt binds actual installed files | `src/battle/worker/create-browser-runtime.ts:189-247` compares all three receipt records with verified installed manifest records; hashes exact raw bytes; checks lengths. Existing runtime loader then verifies asset/engine manifests against pinned runtime manifest. Forged asset/engine/runtime digests or lengths reject; production initializer returns typed failure, closes reader, creates no duel. |

## Blocker repairs: lifecycle / UI

| ID | Requirement | Implementation / regression |
| --- | --- | --- |
| R5 | Remove production admin bundled source path | `src/shell/admin/admin-actions.ts` seeds installed default starter; `AdminConsole.svelte` requires installed gameplay. Removed obsolete deep-import allowances. Unit/component tests pass. |
| R6 | Owned closable reader | Public `OwnedContentReader` names ownership. `core-gate.ts:157` closes every non-ready path, including throws. Worker closes reader after preload/failure. Facade distinguishes borrowed shell reader from owned reader; tested ready/failure/cancel/borrowed teardown. Shell closes late startup results, replaced readers, final reader. |
| R7 | Installed copy / remove probes | DeckPicker fallback says installed deck. All `FACADE_` / `INSPECT_` production logging removed. |
| R8 | Restore diagnostic persistence | `src/battle/app/App.svelte:623-641` opens `SnapshotStore`, calls `recordDebugRun`, closes in `finally`; write failures remain visible. Component download test asserts production call; existing storage tests also pass. |

## Blocker repairs: acceptance / cleanup

| ID | Requirement | Implementation / regression |
| --- | --- | --- |
| R9 | Strengthen Chromium boundary proof | `e2e-content/real-installer.spec.ts` posts both out-of-pool seat attempts to actual production Worker entry/parser. Worker-local test instrumentation observes `createDuel=0`; valid duel in same Worker reaches surrender with counter=1, calibrating instrumentation. Later installed Free Play UI duel also reaches surrender. Readable evidence: `review-repair/production-boundary-rejected-seats.json`, `review-repair/calibrated-engine-counter-valid-terminal.json`. |
| R10 | Durable checklist ready behavior | `artifacts/manual_test_checklist.md` now expects verified install → ready → installed chapter tiles, not locked-after-install. Manual items remain unchecked. |
| R11 | Abort releases acquired images | `src/content/load-installed-images.ts:30,43` checks abort after lease registration. Tests abort during final card/final set acquisition; every acquired lease releases exactly once. |
| R12 | Scope preservation | No new Story/save/narrative implementation. Inherited Story changes remain installed-gameplay adapters/props. Real Scapegoat exposed `Unsupported card location: 0`; narrow token creation/removal projection fix added with unit/WASM regressions, without widening public locations or inventing deck movement. |

## Full-gate limitations

| ID | Gate | Exact observed limitation |
| --- | --- | --- |
| L1 | `npm run check:headless` / `npm run format:check` | Stops at pre-existing untouched `e2e/asset-root-urls.spec.ts`: `Code style issues found in the above file. Run Prettier with --write to fix.` All 149 changed/new TS/Svelte/JS files pass targeted formatting. `final-review/check-headless.txt`, `final-review/final-format.txt`, `final-review/changed-source-format.txt`. |
| L2 | Full units | 179 files / 2,225 tests passed; 12 files failed, 11 tests failed, 7 skipped. Missing legacy assets cause catalog/image/ready-input failures. Separate performance file: 9 passed. `final-review/full-unit.txt`, `final-review/performance.txt`. |
| L3 | Full integration | 3 files / 14 tests passed; 17 files failed, 11 tests failed, 28 skipped. Legacy data absent, e.g. `ENOENT: no such file or directory, open '/home/aron/projects/ascencio/.tmp/worktrees/core-install-t6/assets/shared/data/current/catalog/cards/1b.json'`. Exact installed-runtime tests pass independently. `final-review/full-integration.txt`, `final-review/final-focused.txt`. |
| L4 | Assets/snapshot/legacy browser acceptance | Missing `assets/shared/data/current/manifest.json`; snapshot gate prevents legacy E2E / acceptance servers from starting: `Error: Process from config.webServer was not able to start. Exit code: 1`. `final-review/assets-verify.txt`, `final-review/snapshot-verify.txt`, `final-review/legacy-e2e.txt`, `final-review/legacy-acceptance.txt`. Prior individual set/image/readiness limitations remain; no asset downloads/source-tree reconstruction attempted. |
| L5 | Static / legacy checks that pass | ESLint pass; TypeScript/Svelte 0 errors, 5 existing warnings; vendor 21 frozen files verified; legacy Node 172 passed; `git diff --check` pass. Logs in `final-review/`. |

## Commands / exact input

```sh
CONTENT_RUN=generated/asset-delivery/runs/7660bc2c-520a-41fa-a6fd-dfdecc770807 npx playwright test -c playwright.content.config.ts --project=chromium
CONTENT_RUN=generated/asset-delivery/runs/7660bc2c-520a-41fa-a6fd-dfdecc770807 npx playwright test -c playwright.content-built.config.ts --project=chromium
CONTENT_RUN=generated/asset-delivery/runs/7660bc2c-520a-41fa-a6fd-dfdecc770807 npm run build
CONTENT_RUN=generated/asset-delivery/runs/7660bc2c-520a-41fa-a6fd-dfdecc770807 npm run build:reproducible
```

C1. Candidate snapshot SHA: `03571be5332cda2bf41de3b09a3c9350a1e82b7325aaeea48f0fafdc309808d0`. Exact fixture checks snapshot/catalog/manifest/archive/file hashes; never substitutes legacy assets.

C2. Full command inventory: `commands-run.json`; final-pass inventory: `final-review/commands-run.json`. Changed/new source inventory: `changed-files.json`. Final red evidence: `final-review/red.txt`, `final-review/red-read-only.txt`; green evidence: `final-review/green-focused.txt`, `final-review/final-focused.txt`.

C3. Bounded repair history preserved: initial built harness compared ObjectRef `key` against bootstrap digest/length, corrected to actual contract; initial full components exposed two stale Bundled expectations, updated; one later `StoryMenuEntry.test.ts` 15s timeout passed isolated/full retry without source changes. Initial lint scanned generated subpath output; scoped global teardown now removes it, final lint passes. One standalone build verifier invocation omitted `CONTENT_RUN`, returned `Error: CORE build invented a content delivery pin`; exact-env rerun passes. No failures hidden.

## Assumptions / remaining review

A1. Installed editor's existing `PROTOTYPE_RULESET` remains authoritative deck-validation policy. Runtime support closure does not grant chapter/deck permission.

A2. Source-boundary instrumentation and black-box built acceptance are separate proofs, per B1/B2. Built root/subpath terminal evidence is real UI surrender, not autonomous victory; installed offline gameplay and arbitrary card-effect coverage are not claimed.

A3. Missing graph corpus required direct source inspection. Existing unrelated source formatting/legacy input failures remain untouched.

A4. No staged files; no commits; vendor unchanged. Own generated scratch `.tmp/t6-installed-built-subpath`, `.tmp/core-source-only-root`, `.tmp/core-source-only-subpath`, `dist-repro-a`, `dist-repro-b` removed by guarded/existing harness teardown. Existing `.tmp/ship-t3-20260909/` preserved. New T4 screenshot relocated into `final-review/source-installer-core-locked.png`; CORE report/output routed to T6 without altering T9 evidence.

A5. Final reviewer gate required; no self-approval. Open `changed-files.json`, inspect full diff against F1–F5, then rerun exact built Chromium command above. Full legacy gates cannot be called green until separately restoring approved legacy fixtures / resolving unrelated format input.
