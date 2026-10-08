# Test review and benchmark notes

Baseline revision: `2cc608112ff96da07c63c9b1e89025902aa27594`.

Reviewed all 476 TypeScript test files and 36 Rust tests. Removed 93 test declarations, including 10 whole files; active collected cases fell from 4,689 to 4,591. All runs were headless. Pipeline timing improvement remains inconclusive. Existing readiness/manifest failures and a reproduced original-version card-list hit-testing bug are documented below.

## Work checklist

- [x] Frame: inventory every tracked executable test and benchmark the unchanged headless pipeline.
- [x] Fan out: read every test body, assess its regression value, and record keep/delete decisions.
- [x] Aggregate: apply justified deletions only and verify complete inventory coverage.
- [x] Report: verify headlessly, benchmark the reduced suite, and record comparison and deferred refactors.

The review includes tooling, unit, component, integration, browser, and embedded Rust tests. Frozen vendor code and archived evidence copies are outside the executable project suite. A retained test must protect observable behavior, a meaningful boundary, or a failure mode not adequately protected by cheaper retained tests. Source-text assertions, type-only checks, retired-platform tests, and repeated assertions are candidates, not automatic deletions. Failures alone never justify deletion.

Measured scope: local Windows headless pipeline stages with unchanged runner settings. The timing conclusion is inconclusive, not a hosted CI speed claim. Successful work and failures are reported separately. Temporary raw logs and review ledgers live outside the repository in the system temporary directory.

## Deferred refactors

These need additions or rewrites, so they are outside this deletion-only change.

1. Remove repeated CI execution. `.github/workflows/ci.yml` runs the headless checks in its isolated-checkout step and later invokes `npm run check`, which repeats those checks. Keep the clean-checkout assurance while scheduling each expensive suite once.
2. Make collection explicit. The current Playwright configurations collect `e2e-native` and `e2e-acceptance`; the 13 `e2e-global` files are not collected. Port their useful persistence, input, accessibility, geometry, and Worker regressions to the native fixture. Put the Chromium resource/performance acceptance case in a pinned environment. A filename inventory alone must not stand in for a runner collection check.
3. Share immutable fixture inputs, not writable test state. The tooling and storage suites repeatedly materialize large directory trees and thousands of content records. Cache verified immutable source inputs, then give each mutation/failure scenario its own writable area. Preserve fault injection, traversal protection, and recovery assertions.
4. Replace remaining CSS-source checks with a small collected headless-browser matrix where layout or accessibility is the requirement. Keep real geometry, hit testing, focus, forced-colors, and reduced-motion assertions; literal selector/token matches alone do not prove the painted result.
5. Isolate content readiness from the checkout. `content-setup-authoring.test.ts` asks the current working tree to be code-ready, so generated asset state affects its outcome. Supply explicit complete/incomplete fixture roots and test the real checkout in a separate release gate.
6. Investigate the existing Windows HTTP-boundary timeout. The baseline `app-content-boundary.test.ts` request to `/@vite/client` timed out after ten seconds. Preserve its containment/security assertions; distinguish server readiness and compilation latency from a forbidden-path failure.
7. Audit command assertions against behavior. The desktop launch command now delegates to `scripts/start-desktop.ts`; the baseline literal test expected an inline Linux executable invocation. This change removes that stale assertion and keeps validation that referenced npm commands exist. Use the desktop setup tests for actual launch behavior.
8. Make the acceptance web-server command portable. `playwright.acceptance.config.ts` uses POSIX inline environment assignment. Set that variable through the process environment or Playwright configuration so the same headless command works on Windows.
9. Measure runner/setup overhead separately from test bodies. Vitest uses two workers on Windows and starts isolated workers for many small files. Consolidating related tiny suites may reduce repeated imports, but requires a separate change and checks for leaked mocks/global state.
10. Give resource tests observable budgets. The deleted session-create/dispose smoke loop checked a disposed flag, not retained memory or live native handles. A future resource gate should measure the resource it claims to protect.
11. Keep the ignored Rust I/O acceptance tests explicit. They require trace instrumentation and serialized execution; ordinary unit success is not evidence that those acceptance gates ran.
12. Repair the existing published runtime manifest mismatch separately. `content:source-manifest:verify` fails before visual acceptance starts. An external diagnostic configuration can exercise the actual browser cases without that preflight, but it does not satisfy the release gate.
13. Remove disconnected mock assertions. The remaining CORE startup test had an unconnected local `fetch` mock; asserting that it was not called proved nothing about network use. This change deletes that mock/assertion. A future network-isolation claim should instrument the actual boundary and use a matching test name.
14. Fix card-list hit testing when selected cards scale over neighboring targets. The post-deletion browser run found two click-interception timeouts in unchanged test bodies. An original-version headless control with `slowMo: 200` reproduced the selected preceding card intercepting the next target; the trace and screenshot confirm the overlap. Keep these tests and fix the interaction separately. A forced click would bypass the behavior being checked.

## Baseline environment

- Windows; Intel Core Ultra 5 235U, 14 logical processors.
- Node 26.4.0; npm 11.11.1; repository dependencies unchanged.
- `CI=1`, `PLAYWRIGHT_HTML_OPEN=never`, and no `PWDEBUG`. Vitest/Node/Rust runs have no UI; Playwright uses its default headless mode. No native application window was launched.
- Tests run sequentially by suite, with the repository's worker settings unchanged. Other owner processes remained running; their load limits the precision of elapsed-time comparisons.
- Inventory: 476 TypeScript test files, 3,839 test declaration sites (parameterized cases expand further), and 36 Rust tests across 11 files. No additional test declarations were found outside the test/browser directories and embedded Rust sources; frozen vendor and archived copies are excluded.
- The benchmark continues through independent suites after a failure. That measures the available pipeline stages; it is not the fail-fast wall time of `npm run check`.

## Benchmark comparison

**Pipeline speedup is inconclusive.** The affected component subset measured 82.05 s before versus 65.09 s after (medians of five alternating runs per version; observed change -20.68%). Ranges: 64.47–84.01 s before and 60.14–80.47 s after. Machine load and overlapping ranges prevent treating this as a reliable full-pipeline improvement. The reduction in test count is certain.

An exact two-sided rank-sum calculation gives p = 0.095 for these ten samples (no ties). With this small sample and uncontrolled shared-machine load, this does not establish a reliable timing separation.

| Pair | Before (s) | After (s) | Exit codes before / after |
|---:|---:|---:|---|
| 1 | 83.33 | 76.41 | 0 / 0 |
| 2 | 84.01 | 60.14 | 0 / 0 |
| 3 | 64.47 | 65.09 | 0 / 0 |
| 4 | 80.17 | 63.45 | 0 / 0 |
| 5 | 82.05 | 80.47 | 0 / 0 |

The subset is the same 24 affected component-file paths: 219 expanded cases across 24 files before, 176 across 20 surviving files after. All ten runs passed, with these case counts verified in every runner log. Original and final file bytes were alternated sequentially; the final version was restored afterward. Runner settings, Node version, production code, and fixtures were unchanged.

### Complete stage measurements

One complete before/after pass was measured by stage. The harness continues after failures to expose later stages, so these rows are not the fail-fast duration of `npm run check`. The original acceptance preflight is reported separately from the diagnostic run. Rust originally compiled dependencies; its warm post-run must not be counted as a deletion-related saving.

| Stage / command | Before (s; exit) | After (s; exit) |
|---|---:|---:|
| `npm run format:check` | 15.71; 0 | 34.11; 0 |
| `npm run lint` | 31.01; 0 | 23.23; 0 |
| `npm run typecheck` | 52.25; 0 | 37.50; 0 |
| `npm run test:tooling` | 343.00; 0 | 275.99; 0 |
| `npm run test:unit-and-performance` | 750.49; 1 | 610.39; 1 |
| `npm run test:component` | 408.68; 0 | 403.68; 0 |
| `npm run test:integration` | 37.26; 0 | 33.54; 0 |
| `npm run test:native:rust` | 307.82; 0 | 16.58; 0 |
| `npm run test:browser:native-bridge` | 60.78; 0 | 99.12; 0 |
| `npm run test:browser:visual-acceptance` | 2.30; 1 | 3.09; 1 |
| `node node_modules/vitest/vitest.mjs run tests/unit/decks/deck-catalog-performance.test.ts` | 3.18; 0 | 3.56; 0 |
| `npm run vendor:verify` | 0.42; 0 | 0.56; 0 |
| `npm run assets:verify-all` | 21.00; 0 | 31.36; 0 |
| `npm run content:source-manifest:verify` | 0.43; 1 | 0.73; 1 |
| `npm run frontend:build` | 4.90; 0 | 6.72; 0 |
| `npm run frontend:verify-reproducible` | 5.13; 0 | 17.81; 0 |
| `Playwright acceptance with external diagnostic config` | 43.43; 0 | 420.23; 1 |

Catalog performance runs separately because the preceding failed unit phase prevents the script’s `&&` tail from running. The formatting row uses the successful repeat after deleting surplus whitespace and formatting a surviving import. Lint/type checking passed; the four existing Svelte warnings remain.

The unchanged large promotion fixture took **294.24 s before and 196.40 s after**. It checks the over-32-MiB wrapper boundary through real filesystem fixtures. This large timing change in an untouched test shows why the overall tooling difference cannot be attributed to deleting three small tests. It is a concrete target for the deferred fixture refactor.

### Executed case counts

| Suite | Before: passed / failed / skipped | After: passed / failed / skipped |
|---|---:|---:|
| tooling | 111 / 0 / 1 | 108 / 0 / 1 |
| unit | 3006 / 3 / 0 | 2961 / 1 / 0 |
| catalog-performance | 9 / 0 / 0 | 9 / 0 / 0 |
| component | 1421 / 0 / 0 | 1378 / 0 / 0 |
| integration | 58 / 0 / 0 | 55 / 0 / 0 |
| rust | 33 / 0 / 2 | 33 / 0 / 2 |
| native | 4 / 0 / 0 | 4 / 0 / 0 |
| acceptance-diagnostic | 41 / 0 / 0 | 37 / 2 / 0 |

Active collected cases, including existing skips and failures: **4689 → 4591** (98 fewer). This includes parameter expansion and four native browser projects. It excludes the uncollected global browser suite and excludes repeated benchmark samples.

The post-run unit failure is the same content-readiness assertion seen before deletion. The baseline HTTP timeout did not recur. The original manifest/visual-preflight failures remain; the diagnostic browser suite does not replace those gates. The diagnostic acceptance rerun completed all 39 cases: 37 passed and two unchanged card-list cases timed out because the selected preceding card intercepted the next target’s click. Both failing test bodies were checked byte-for-byte against the original version. These failures are preserved and are not counted as successful timing improvements.

### Pointer-interception control

A focused headless rerun of the two unchanged cases, using a 30-second diagnostic timeout, passed 2/2 with the original file (21.51 s) and 1/2 with the pruned file (42.72 s). To test the timing dependency, the original file was then run with Playwright `slowMo: 200`, still headless and with the same 30-second bound. Its range-selection case failed (39.33 s including build/startup). The original-version trace repeatedly records the selected first card intercepting pointer events for the next target; its screenshot shows the first card overlapping the second target’s center. This confirms that the interaction defect exists before the deletions. These diagnostic runs are excluded from benchmark medians and active-suite totals. The pruned files were restored afterward.

### Interpretation and reproducibility

- The original unit run has three failures: checkout-dependent content readiness, an obsolete exact desktop-command assertion, and a ten-second `/@vite/client` timeout. The command assertion was removed for its independent low-value/stale-implementation rationale; the dynamic referenced-command check remains. Other failures were not deleted.
- The normal visual-acceptance command stops at the independently derived runtime-manifest mismatch before collecting browser cases. The external diagnostic config keeps the same Chromium tests, worker count, base URL and build flags, sets the acceptance environment variable portably, and omits the failing preflight. It demonstrates browser behavior, not a passing release gate.
- The 13 global browser files are outside current Playwright collection. Removing their three redundant cases does not shorten the currently configured pipeline.
- Runtime count, exit status and runner summaries were checked for each measured run. Tooling has one existing skipped case. Windows Rust runs 33 tests with two ignored; one of the 36 source-declared tests is conditionally compiled for another platform.
- The main costs retained include real filesystem/content fixtures, engine integration, per-file worker setup and jsdom initialization. Assertion count alone does not predict elapsed time. Vitest reports substantial setup/import/environment durations, and unmodified tooling fixtures dominate their phase. Parallel worker-duration totals overlap and must not be added as wall time.
- This was a shared local Windows machine, not a controlled hosted-CI benchmark. No conclusion about hosted CI speed follows from the single stage pass. No profiler-isolated bottleneck measurement was made, so the timing conclusion remains inconclusive.
- Raw timing records, logs, audit ledgers and the external harnesses are in `C:/Users/NF3526/AppData/Local/Temp/ascencio-test-audit-20261008`. This document preserves the commands, versions, counts and timings even if temporary files are retired.


## Review outcome

All 476 TypeScript files and all 36 embedded Rust tests were read, including helpers, parameter rows, disabled cases, and currently uncollected browser groups. Component coverage was reconciled against the tracked inventory: two certificates cover 148 unique paths with no gaps or extra paths.

Removed 93 TypeScript declaration sites and 10 test files. Retained 3,746 TypeScript declaration sites across 466 files, plus every Rust test. These are source declaration counts, not expanded runner case counts. Production code, configuration, dependencies, frozen vendor files, and owner feedback files are unchanged.

The review preserved security/privacy boundaries, atomicity and recovery, actual core-engine regressions, state and input behavior, accessibility, domain/import rules, and negative type fixtures. It did not delete tests merely because they failed, used SQLite in their name, used mocks, or inspected source.

## Applied deletions

### tests/asset-delivery-contracts.test.ts

The retained canonical encoding tests cover byte limits, delimiters, Unicode, ordering and exact output more thoroughly than this smoke assertion.

- canonical metadata smoke: compact UTF-8 plus LF

### tests/content-browser-run.test.ts

Removed retired-command/source-string checks. The retained test actually checks failure without native storage.

- production commands and workflows do not invoke retired browser content preflight

### tests/mvp-assets.test.ts

Removed CI step-name/cache-path string locks; real acquisition-stage ordering and option validation remain.

- CI produces mandatory set images before isolated verification and caches current asset roots

### tests/integration/duel-session.test.ts

Repeated 100-session loop asserts only disposed state. The retained lifecycle test covers disposal, repeated disposal and invalid use; actual leak measurements are deferred.

- reclaims one hundred real core sessions

### tests/integration/headless-controller.test.ts

Eight seeded opening-prompt runs duplicate the retained real prompt/action test, production shuffle coverage, and complete chapter/programmed duels.

- reaches a supported human prompt for a bounded randomized production matrix

### tests/integration/rules-profile-placement.test.ts

Pure bundled-pair selection is covered in unit/runtime tests; real MR3 and MR5 placement tests remain.

- selects the Link-free profile for the bundled pair

### e2e/e2e-acceptance/card-list-dialog.spec.ts

Over-maximum red halo is already checked before and during hover in maximum-lock/stale-draft acceptance.

- an over-maximum entry halos red

### e2e/e2e-acceptance/full-height-field.spec.ts

The removed reduced-motion case only counts unchanged controls. Actual motion, geometry, hit-testing and semantics checks remain.

- phase reduced motion changes no semantics

### e2e/e2e-global/deck-editor.spec.ts

Menu-only startup smoke duplicates the fuller root-route and native browser journeys.

- default route shows the main menu, not the deck editor

### e2e/e2e-global/deck-select-layout.spec.ts

The locator filters to text 1 and then asserts text 1; copy rendering has meaningful retained component coverage.

- copies chip

### e2e/e2e-global/story.spec.ts

Seeded aborted outcome duplicates the real surrender/abort journey and the handoff reducer coverage.

- an aborted duel recovers without granting a reward

### tests/unit/decks/catalog-fixture.test.ts

Deleted the file. Checks only a fixture shape; production catalog/filter/mapper tests consume that fixture and assert actual behavior.

- contains unique OCG-shaped review cards across every major family

### tests/unit/story/collection-grouping.test.ts

Constant rarity-order pin is implied by retained literal grouped-order outputs in both directions.

- runs from the most common tier to the rarest

### tests/unit/decks/ocg-card-mapper.test.ts

Four literal mask values duplicate exhaustive comparison with the vendored runtime in ocg-mask-parity.test.ts.

- keeps local masks aligned with vendored OCG values

### tests/unit/agents-doc-trunk.test.ts

Deleted the file. prose substring checks do not enforce behavior; the executable import-boundary check is retained in domain-boundaries.test.ts

- names main as the only long-lived branch
- keeps the machine-enforced boundary section
- supersedes only the topology half of ADR-022

### tests/unit/selected-content-fixture.test.ts

Deleted the file. static source/fixture string assertions only; executable readiness/content behavior is covered elsewhere

- does not prepare hosted releases or migrate legacy saves
- keeps test startup and user JSON fault hooks out of production configuration
- keeps one real user owner and same-store production repository factory
- restricts raw user JSON mutations to fixed test fault operations

### tests/unit/create-node-runtime.test.ts

Deleted the file. mock-only private factory wiring; real worker behavior is covered by duel-worker-runtime.test.ts and node-worker-thread.test.ts

- loads normalized catalog/scripts, derived manifest and duel-core strings without hosted originals

### tests/unit/deck-sources-node.test.ts

Deleted the file. active source/load/validation claims are stronger in chapter-one-decks.test.ts; remaining tests preserve obsolete archetype fixtures outside current bundled decks

- loadDeckSources returns one source per catalog entry
- webview source adapter bundles no deck payloads; installed packages supply them
- every bundled deck parses and validates against its constraints
- no bundled deck runs more than three copies of a card
- burning-abyss has 40 main and 15 extra
- nekroz has a Kaleidoscope-capable 40/15 split
- all four legacy archetype fixtures keep a full Extra Deck
- shaddoll has 40 main and 15 extra
- spellbook has 40 main and 15 extra

### tests/unit/content-setup.test.ts

- parser accepts exactly one chapter-01 — identity round-trip of fixture through parser; it asserts no transformation or rejection behavior

### tests/unit/content-tooling-gates.test.ts

- native build verifies the webview artifact without PWA tooling — three exact package-script string checks; no execution or invariant beyond the referenced-command validation retained below

### tests/unit/core-gate.test.ts

- non-native execution blocks without consulting network or legacy stores — fetch mock is never connected to loadCoreStartup; same storage-unavailable gate is exercised by the following missing-Tauri-storage test

### tests/unit/deck-parser.test.ts

- loads the exact locked MVP matchup — obsolete matchup literal; current Chapter 1 deck sources and complete active-deck validation are covered by chapter-one-decks.test.ts

### tests/unit/dialog-chrome.test.ts

Deleted the file. - uses the VariantB panel values without legacy or backdrop styles — brittle CSS source-string assertions for aesthetic declarations
- keeps blur on the backdrop instead of the chamfered panel — brittle CSS source-string assertions for aesthetic declarations
- gives loading status text the gold Forum treatment without a chamfer — brittle CSS source-string assertions for aesthetic declarations
- preserves result and error title semantics — source-string style declarations do not test rendered semantics or user-observable behavior

### tests/unit/duel-field.test.ts

- graveyard stack keeps its face-up top card — only checks definedness for the same fixture and property whose exact public label and code are asserted by graveyard stacks still expose their top card

### tests/unit/duel-phase-label.test.ts

- every phase has a label — The production map is Readonly<Record<DuelPhase, string>>, so the strict typecheck already requires every phase key. This test only rechecks those keys, not their label values. Literal label-output tests remain.

### tests/unit/phase-transitions.test.ts

- still maps the engine's end phase to the end slot — exact duplicate mapping assertion already included in maps every engine phase to a slot
- still maps the endPhase choice to the end slot — exact duplicate mapping assertion already included in maps global choices to slots

### tests/unit/reviewed-card-pool.test.ts

- pool of the real Chapter 1 decks has 16 codes — the retained Chapter 1 test asserts the exact pool set, which entails cardinality 16
- every bundled deck code is in the pool — the retained Chapter 1 test asserts exact equality between reviewedCardPool and both exact active deck lists

### tests/unit/set-image-acquisition.test.ts

- keeps downloader free of a local JPEG cache path — source-text scan only; live fetch/provider-boundary/retry/size tests remain

### tests/unit/shell-routes.test.ts

- parses the free-play menu — same route parse already covered by parses every known hash
- parses free-play decks and one deck — same route parses already covered by parses every known hash
- parses the story deck routes — same route parses already covered by parses every known hash
- parses both collection routes — same route parses already covered by parses every known hash
- keeps the duel session route — same route parse already covered by parses every known hash
- keeps admin — same route parse already covered by parses every known hash

### tests/unit/global-styles.test.ts

- duel field is not height-capped on small screens — single stale negative CSS literal; no meaningful runtime/architecture behavior
- feedback target and default field line are teal; attack stays danger — palette literals; semantic color states are already asserted by actionable/selected/unavailable state tests
- the action/phase badge at the opponent hand position (item 26) is gone from the stylesheet — stale negative source-string check for a removed selector
- card entries hover-scale 1.35 and list interaction states scale 1.6 — exact aesthetic transform literals; no behavior check
- hand item transform-origin is bottom for player, top for opponent; field origin is centre — exact aesthetic transform-origin literals
- hand viewport reserves clip headroom for the fan arc — exact measured CSS coefficient literal; layout behavior belongs in browser evidence

### tests/component/MenuDialog.test.ts

Deleted the file. Its sole test pins only ui-dialog-title; menu behavior and dialog semantics are covered by integration tests.

- marks its existing title with the shared dialog title class

### tests/component/DuelErrorDialog.test.ts

Deleted the file. Its sole test pins a class token; BattleFacade verifies the dialog role and heading.

- marks its existing danger title with the shared dialog title class

### tests/component/DuelResultDialog.test.ts

Duplicates the win heading assertion and checks only a shared class token.

- marks its existing verdict with the shared dialog title class

### tests/component/SettingsDialog.test.ts

Checks only a shared class token; dialog behavior and heading content remain covered.

- marks its existing title with the shared dialog title class

### tests/component/deck-editor/card-catalog.test.ts

The test reads source CSS for spacing; it does not validate layout in jsdom.

- keeps token spacing before results when a truncation notice is visible

### tests/component/deck-editor/catalog-scrollbar.test.ts

Both assert CSS source declarations. Browser geometry assertions exist in e2e-global/deck-editor.spec.ts, although that suite is not in active configs yet.

- the native results scrollbar is hidden by scoped host rules
- result rows are sized to the tile rather than to the card name

### tests/component/deck-editor/card-tile-art.test.ts

These inspect CSS source or jsdom markup without proving rendered geometry; browser geometry assertions exist in e2e-global/deck-editor.spec.ts (not currently collected by active configs).

- the tile image is styled to fill its rectangle
- the tile stacks its children in a single named grid area
- the placeholder fills the same rectangle as the art
- keeps every card name on one ellipsized line

### tests/component/deck-editor/deck-editor-shell.test.ts

The first two inspect CSS declarations; the remaining three assert composition/presence or DOM topology without proving rendered layout. Browser geometry assertions exist in e2e-global/deck-editor.spec.ts (not currently collected by active configs).

- owns stage height through parent grid tracks instead of header subtraction
- gives the deck name the header's remaining width

### tests/component/deck-editor/deck-workspace-selectors.test.ts

Inspects CSS source; browser scrollbar geometry is covered in e2e-global/deck-editor.spec.ts, not currently collected by active configs.

- reserves its native scrollbar gutter before overflow

### tests/component/deck-editor/variant-b-panels.test.ts

Deleted the file. Every test only asserts class names or CSS declarations; no user-visible behavior is exercised.

- marks library, workspace, and catalog roots as chamfered glass panels
- marks every editor dialog as a chamfered dialog panel with a dialog title
- keeps context and tap-target menus unchamfered
- %s leaves panel paint to shared primitives
- %s keeps everyday menu chrome square and token-driven

### tests/component/deck-editor/installed-catalog-boot.test.ts

Tests the helper against synthetic markup rather than application behavior.

- required-only image assertion rejects fallback %s

### tests/component/deck-editor/installed-catalog.test.ts

Deleted the file. Its only catalog exclusion claim duplicates token-cards.test.ts, which asserts the exact excluded token code.

- offers only installed non-token cards

### tests/component/deck-editor/deck-library.test.ts

Asserts absence of a retired selector and no user-visible behavior.

- the status text row is gone

### tests/component/deck-editor/card-preview-pane.test.ts

The first asserts only child presence and the second only DOM order; browser geometry/containment is covered in e2e-global/deck-editor.spec.ts (not currently collected by active configs).

- panes read preview, deck, catalog left to right

### tests/component/deck-select/mobile-layout.test.ts

Inspects CSS declarations; keep actual narrow/wide ordering and back-control behavior tests.

- declares capped centered auto-fit tiles and a single mobile column

### tests/component/deck-select/seat-panel.test.ts

Inspects CSS declarations; keep rendered player/opponent seat and docked-list behavior tests.

- declares the approved twin-column pane and grid parameters

### tests/component/deck-select/deck-select-screen.test.ts

Inspects CSS declarations and does not validate rendered layout.

- filter stretches to the pane edge and the column keeps three rows

### tests/component/story/story-card-tile.test.ts

Checks only that an art element exists; other story tests cover tile content and image behavior.

- renders the whole card, not a crop

### tests/component/story/choice-list.test.ts

Both inspect CSS source declarations rather than rendered behavior.

- the shared list is one centred column of large buttons
- the danger style uses the token, not a raw colour

### tests/component/story/shop-set-tiles.test.ts

Inspects CSS source; jsdom cannot establish grid geometry.

- grid is four columns on a wide screen

### tests/component/story/StoryOverlays.test.ts

Inspects CSS source only; retain the separate dialog role/name and focus/action tests.

- keeps blur on the backdrop and panel paint on VariantB primitives

### tests/component/story/StoryApp.test.ts

Duplicates the direct prologue entry route test.

- starts prologue without a second visual-novel menu

### tests/component/story/NarrativeScreen.test.ts

The first repeats the narrative text assertion; the second inventories controls without testing their behavior, which adjacent tests do.

- exposes the narrative line through its data-cy
- utility bar offers history, auto, skip, ui toggle and menu only

### tests/component/PromptDialog.test.ts

Checks only a shared class token; prompt control hosting, modal persistence, focus, and submit behavior are covered separately.

- marks its nested title with the shared dialog title class

Additional deletions remove orphaned imports/helpers, an unattached fetch mock, and four exact command-body assertions. The dynamic npm-reference validation remains. Formatting merges one surviving import; no executable code was added.

## Complete file inventory

Each row accounts for all test declarations in that file. Kept groups were reviewed for distinct observable behavior or an explicit contract. Browser tests under `e2e-global` were reviewed but are not collected by the current runner configurations. Rust counts are source declarations; conditional compilation and ignored tests affect runtime counts.

| File | Before | Removed | Retained | Group rationale |
|---|---:|---:|---:|---|
| `e2e/e2e-acceptance/card-list-dialog.spec.ts` | 12 | 1 | 11 | Browser acceptance behavior: rendered layout, input, accessibility, and release-boundary outcomes. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `e2e/e2e-acceptance/full-height-field.spec.ts` | 14 | 1 | 13 | Browser acceptance behavior: rendered layout, input, accessibility, and release-boundary outcomes. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `e2e/e2e-acceptance/hand-zoom.spec.ts` | 4 | 0 | 4 | Browser acceptance behavior: rendered layout, input, accessibility, and release-boundary outcomes. |
| `e2e/e2e-acceptance/harness.spec.ts` | 3 | 0 | 3 | Browser acceptance behavior: rendered layout, input, accessibility, and release-boundary outcomes. |
| `e2e/e2e-global/admin-console.spec.ts` | 4 | 0 | 4 | Production-browser journeys: routing, persistence, gameplay/story/deck interaction, and responsive behavior. |
| `e2e/e2e-global/asset-root-urls.spec.ts` | 1 | 0 | 1 | Production-browser journeys: routing, persistence, gameplay/story/deck interaction, and responsive behavior. |
| `e2e/e2e-global/deck-editor.spec.ts` | 23 | 1 | 22 | Production-browser journeys: routing, persistence, gameplay/story/deck interaction, and responsive behavior. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `e2e/e2e-global/deck-select-layout.spec.ts` | 8 | 1 | 7 | Production-browser journeys: routing, persistence, gameplay/story/deck interaction, and responsive behavior. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `e2e/e2e-global/duel-portrait.spec.ts` | 5 | 0 | 5 | Production-browser journeys: routing, persistence, gameplay/story/deck interaction, and responsive behavior. |
| `e2e/e2e-global/duel-smoke.spec.ts` | 47 | 0 | 47 | Production-browser journeys: routing, persistence, gameplay/story/deck interaction, and responsive behavior. |
| `e2e/e2e-global/scrollbar-brand.spec.ts` | 3 | 0 | 3 | Production-browser journeys: routing, persistence, gameplay/story/deck interaction, and responsive behavior. |
| `e2e/e2e-global/story-duel.spec.ts` | 8 | 0 | 8 | Production-browser journeys: routing, persistence, gameplay/story/deck interaction, and responsive behavior. |
| `e2e/e2e-global/story-header.spec.ts` | 3 | 0 | 3 | Production-browser journeys: routing, persistence, gameplay/story/deck interaction, and responsive behavior. |
| `e2e/e2e-global/story-map.spec.ts` | 3 | 0 | 3 | Production-browser journeys: routing, persistence, gameplay/story/deck interaction, and responsive behavior. |
| `e2e/e2e-global/story-shop.spec.ts` | 1 | 0 | 1 | Production-browser journeys: routing, persistence, gameplay/story/deck interaction, and responsive behavior. |
| `e2e/e2e-global/story-stage-sizing.spec.ts` | 2 | 0 | 2 | Production-browser journeys: routing, persistence, gameplay/story/deck interaction, and responsive behavior. |
| `e2e/e2e-global/story.spec.ts` | 17 | 1 | 16 | Production-browser journeys: routing, persistence, gameplay/story/deck interaction, and responsive behavior. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `e2e/e2e-native/installed-content.spec.ts` | 1 | 0 | 1 | Native webview/IPC behavior: host startup, commands, resources, and persistence integration. |
| `src-tauri/src/native_commerce.rs` | 0 | 0 | 0 | Native Rust contract, validation, filesystem, and error-boundary behavior. |
| `src-tauri/src/native_diagnostics.rs` | 0 | 0 | 0 | Native diagnostic/error reporting and actionable context behavior. |
| `src-tauri/src/native_io_trace.rs` | 0 | 0 | 0 | Native Rust contract, validation, filesystem, and error-boundary behavior. |
| `src-tauri/src/native_mod_import.rs` | 0 | 0 | 0 | Native Rust contract, validation, filesystem, and error-boundary behavior. |
| `src-tauri/src/native_mods.rs` | 0 | 0 | 0 | Native Rust contract, validation, filesystem, and error-boundary behavior. |
| `src-tauri/src/native_package_manager.rs` | 0 | 0 | 0 | Native Rust contract, validation, filesystem, and error-boundary behavior. |
| `src-tauri/src/native_startup.rs` | 0 | 0 | 0 | Native Rust contract, validation, filesystem, and error-boundary behavior. |
| `src-tauri/src/native_startup/maintenance.rs` | 0 | 0 | 0 | Native Rust contract, validation, filesystem, and error-boundary behavior. |
| `src-tauri/src/native_storage.rs` | 0 | 0 | 0 | Native Rust contract, validation, filesystem, and error-boundary behavior. |
| `src-tauri/src/native_user_data.rs` | 0 | 0 | 0 | Native user-data persistence, serialization, atomicity, and recovery behavior. |
| `src-tauri/src/scoped_files.rs` | 0 | 0 | 0 | Native Rust contract, validation, filesystem, and error-boundary behavior. |
| `tests/asset-delivery-contracts.test.ts` | 15 | 1 | 14 | Shared tooling, compatibility, architecture, or security boundary behavior. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/asset-delivery-profiles.test.ts` | 36 | 0 | 36 | Shared tooling, compatibility, architecture, or security boundary behavior. |
| `tests/asset-delivery-release-version.test.ts` | 1 | 0 | 1 | Shared tooling, compatibility, architecture, or security boundary behavior. |
| `tests/asset-delivery-repairs.test.ts` | 2 | 0 | 2 | Shared tooling, compatibility, architecture, or security boundary behavior. |
| `tests/catalog.test.ts` | 1 | 0 | 1 | Shared tooling, compatibility, architecture, or security boundary behavior. |
| `tests/component/AdminConsole.test.ts` | 17 | 0 | 17 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/AppBoardMapping.test.ts` | 2 | 0 | 2 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/AppChrome.test.ts` | 40 | 0 | 40 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/AppLocalDecks.test.ts` | 12 | 0 | 12 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/AppShell.test.ts` | 47 | 0 | 47 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/BattleFacade.test.ts` | 19 | 0 | 19 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/CardActionChips.test.ts` | 14 | 0 | 14 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/CardControl.test.ts` | 10 | 0 | 10 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/CardPreviewPanel.test.ts` | 4 | 0 | 4 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/DeckPicker.test.ts` | 12 | 0 | 12 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/DuelErrorDialog.test.ts` | 1 | 1 | 0 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/DuelField.test.ts` | 188 | 0 | 188 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/DuelFieldToggle.test.ts` | 5 | 0 | 5 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/DuelHud.test.ts` | 5 | 0 | 5 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/DuelRail.test.ts` | 9 | 0 | 9 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/DuelResultDialog.test.ts` | 10 | 1 | 9 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/FieldActionBar.test.ts` | 12 | 0 | 12 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/FieldBoard.test.ts` | 4 | 0 | 4 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/FloatingFieldWindow.test.ts` | 15 | 0 | 15 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/FreePlayMatchSetup.test.ts` | 25 | 0 | 25 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/FreePlayUniqueOwner.test.ts` | 1 | 0 | 1 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/FullControlToggle.test.ts` | 5 | 0 | 5 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/HandBand.test.ts` | 14 | 0 | 14 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/HandZoomOverlay.test.ts` | 22 | 0 | 22 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/InstallContentScreen.test.ts` | 3 | 0 | 3 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/LoadingOverlay.test.ts` | 2 | 0 | 2 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/MainMenuScreen.test.ts` | 12 | 0 | 12 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/MaterialSelectDialog.test.ts` | 7 | 0 | 7 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/MenuDialog.test.ts` | 1 | 1 | 0 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/OverlayScrollbar.test.ts` | 6 | 0 | 6 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/PhaseBar.test.ts` | 9 | 0 | 9 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/ProjectedChoiceMenu.test.ts` | 4 | 0 | 4 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/PromptContextMessage.test.ts` | 3 | 0 | 3 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/PromptControls.test.ts` | 17 | 0 | 17 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/PromptDialog.test.ts` | 7 | 1 | 6 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/SettingsDialog.test.ts` | 8 | 1 | 7 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/StackControl.test.ts` | 5 | 0 | 5 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/StackControlPending.test.ts` | 2 | 0 | 2 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/StoryDuelHandoff.test.ts` | 13 | 0 | 13 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/StoryMenuEntry.test.ts` | 9 | 0 | 9 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/ZoneListDialog.test.ts` | 42 | 0 | 42 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/card-preview-scroll-reset.test.ts` | 1 | 0 | 1 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/collection-image-teardown.test.ts` | 3 | 0 | 3 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/core-menu.test.ts` | 4 | 0 | 4 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/advanced-card-search.test.ts` | 5 | 0 | 5 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/advanced-search-load-error.test.ts` | 1 | 0 | 1 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/advanced-search-load-lifecycle.test.ts` | 3 | 0 | 3 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/advanced-search-loader-generation.test.ts` | 2 | 0 | 2 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/card-catalog.test.ts` | 3 | 1 | 2 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/deck-editor/card-preview-pane.test.ts` | 5 | 1 | 4 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/deck-editor/card-tile-art.test.ts` | 8 | 4 | 4 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 4 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/deck-editor/catalog-index-wiring.test.ts` | 3 | 0 | 3 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/catalog-infinite-scroll.test.ts` | 10 | 0 | 10 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/catalog-scrollbar.test.ts` | 3 | 2 | 1 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 2 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/deck-editor/catalog-type-input.test.ts` | 3 | 0 | 3 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/click-semantics.test.ts` | 3 | 0 | 3 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-autosave.test.ts` | 12 | 0 | 12 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-click-move.test.ts` | 6 | 0 | 6 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-context-menu.test.ts` | 7 | 0 | 7 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-create-failure.test.ts` | 1 | 0 | 1 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-crud.test.ts` | 1 | 0 | 1 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-delete-failure.test.ts` | 3 | 0 | 3 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-editor-a11y.test.ts` | 3 | 0 | 3 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-editor-blocked.test.ts` | 1 | 0 | 1 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-editor-shell.test.ts` | 9 | 2 | 7 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 2 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/deck-editor/deck-entry.test.ts` | 1 | 0 | 1 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-favourites.test.ts` | 2 | 0 | 2 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-history-order.test.ts` | 3 | 0 | 3 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-history-ui.test.ts` | 2 | 0 | 2 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-library-images.test.ts` | 8 | 0 | 8 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-library-order.test.ts` | 5 | 0 | 5 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-library-rename.test.ts` | 4 | 0 | 4 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-library-toolbar.test.ts` | 4 | 0 | 4 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-library.test.ts` | 20 | 1 | 19 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/deck-editor/deck-migration-error.test.ts` | 1 | 0 | 1 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-ownership-legality.test.ts` | 3 | 0 | 3 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-page-actions.test.ts` | 4 | 0 | 4 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-reorder.test.ts` | 6 | 0 | 6 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-route.test.ts` | 5 | 0 | 5 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-save-conflict.test.ts` | 2 | 0 | 2 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-validation-ui.test.ts` | 7 | 0 | 7 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/deck-workspace-selectors.test.ts` | 3 | 1 | 2 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/deck-editor/deck-zone-grid.test.ts` | 9 | 0 | 9 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/default-deck.test.ts` | 5 | 0 | 5 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/delete-dialog-focus.test.ts` | 1 | 0 | 1 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/editor-context.test.ts` | 10 | 0 | 10 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/editor-import.test.ts` | 6 | 0 | 6 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/editor-tile-images.test.ts` | 3 | 0 | 3 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/installed-catalog-boot.test.ts` | 3 | 1 | 2 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/deck-editor/installed-catalog.test.ts` | 1 | 1 | 0 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/deck-editor/installed-image-teardown.test.ts` | 1 | 0 | 1 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/keyboard-shortcuts.test.ts` | 4 | 0 | 4 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/load-deck-dialog.test.ts` | 9 | 0 | 9 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/missing-card-placeholder.test.ts` | 2 | 0 | 2 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/owned-only-catalog.test.ts` | 7 | 0 | 7 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/pointer-drag.test.ts` | 10 | 0 | 10 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/portrait-layout.test.ts` | 12 | 0 | 12 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/quantity-badge.test.ts` | 2 | 0 | 2 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/token-cards.test.ts` | 1 | 0 | 1 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/variant-b-panels.test.ts` | 5 | 5 | 0 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 5 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/deck-editor/ydk-export.test.ts` | 4 | 0 | 4 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-editor/ydk-import.test.ts` | 6 | 0 | 6 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-select/compact-layout.test.ts` | 9 | 0 | 9 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-select/deck-dialogs.test.ts` | 9 | 0 | 9 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-select/deck-select-screen.test.ts` | 29 | 1 | 28 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/deck-select/deck-tile-menu.test.ts` | 11 | 0 | 11 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-select/deck-tile.test.ts` | 23 | 0 | 23 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-select/hover-previews.test.ts` | 26 | 0 | 26 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/deck-select/mobile-layout.test.ts` | 6 | 1 | 5 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/deck-select/seat-panel.test.ts` | 10 | 1 | 9 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/installed-free-play.test.ts` | 1 | 0 | 1 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/jsdom-storage.test.ts` | 1 | 0 | 1 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/prompt-selection-limit.test.ts` | 1 | 0 | 1 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/semantic-image-readiness.test.ts` | 2 | 0 | 2 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/shell-card-image-status.test.ts` | 2 | 0 | 2 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/shell/StartupRoot.test.ts` | 8 | 0 | 8 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/shell/toast-host.test.ts` | 2 | 0 | 2 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/BattleHandoff.test.ts` | 3 | 0 | 3 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/BoosterOpening.test.ts` | 5 | 0 | 5 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/BoosterOpeningScreen.test.ts` | 3 | 0 | 3 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/IllustratedMap.test.ts` | 8 | 0 | 8 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/NarrativeScreen.test.ts` | 11 | 2 | 9 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 2 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/story/OutcomeProgression.test.ts` | 4 | 0 | 4 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/ShopBrowse.test.ts` | 7 | 0 | 7 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/ShopCardList.test.ts` | 9 | 0 | 9 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/ShopGreeting.test.ts` | 6 | 0 | 6 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/ShopSell.test.ts` | 6 | 0 | 6 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/StoryApp.test.ts` | 23 | 1 | 22 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/story/StoryEventMedia.test.ts` | 5 | 0 | 5 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/StoryOverlays.test.ts` | 9 | 1 | 8 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/story/StoryPlayback.test.ts` | 5 | 0 | 5 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/StoryTopBar.test.ts` | 4 | 0 | 4 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/TitleAndLoad.test.ts` | 3 | 0 | 3 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/booster-open-all.test.ts` | 12 | 0 | 12 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/booster-reveal.test.ts` | 13 | 0 | 13 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/cancel-controls.test.ts` | 2 | 0 | 2 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/card-preview-host.test.ts` | 2 | 0 | 2 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/card-zoom-inspector.test.ts` | 12 | 0 | 12 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/choice-list.test.ts` | 11 | 2 | 9 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 2 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/story/collection-screen.test.ts` | 12 | 0 | 12 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/installed-story.test.ts` | 3 | 0 | 3 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/pre-battle-deck-picker.test.ts` | 27 | 0 | 27 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/save-integrity.test.ts` | 10 | 0 | 10 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/sell-confirmation.test.ts` | 6 | 0 | 6 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/set-list-rarity-sort.test.ts` | 8 | 0 | 8 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/shop-set-tiles.test.ts` | 11 | 1 | 10 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/component/story/single-pack-reveal.test.ts` | 7 | 0 | 7 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. |
| `tests/component/story/story-card-tile.test.ts` | 8 | 1 | 7 | Rendered component behavior, lifecycle, accessibility, privacy, and cross-component wiring. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/content-browser-run.test.ts` | 2 | 1 | 1 | Shared tooling, compatibility, architecture, or security boundary behavior. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/desktop-setup.test.ts` | 4 | 0 | 4 | Shared tooling, compatibility, architecture, or security boundary behavior. |
| `tests/images.test.ts` | 3 | 0 | 3 | Shared tooling, compatibility, architecture, or security boundary behavior. |
| `tests/integration/active-duel-dependencies.test.ts` | 1 | 0 | 1 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. |
| `tests/integration/chapter-one-duel.test.ts` | 1 | 0 | 1 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. |
| `tests/integration/cir-mill-chain-prompt.test.ts` | 1 | 0 | 1 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. |
| `tests/integration/custom-deck-duel.test.ts` | 2 | 0 | 2 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. |
| `tests/integration/duel-replay-restore.test.ts` | 4 | 0 | 4 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. |
| `tests/integration/duel-session.test.ts` | 5 | 1 | 4 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/integration/falco-facedown-special-summon.test.ts` | 1 | 0 | 1 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. |
| `tests/integration/field-spell-activation.test.ts` | 1 | 0 | 1 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. |
| `tests/integration/gy-trigger-chain-window.test.ts` | 2 | 0 | 2 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. |
| `tests/integration/headless-controller.test.ts` | 3 | 1 | 2 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/integration/installed-runtime-wasm.test.ts` | 5 | 0 | 5 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. |
| `tests/integration/installed-runtime.test.ts` | 2 | 0 | 2 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. |
| `tests/integration/node-worker-thread.test.ts` | 7 | 0 | 7 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. |
| `tests/integration/programmed-duel.test.ts` | 1 | 0 | 1 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. |
| `tests/integration/real-wasm-smoke.test.ts` | 2 | 0 | 2 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. |
| `tests/integration/rules-profile-placement.test.ts` | 3 | 1 | 2 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/integration/spellbook-duel-progression.test.ts` | 1 | 0 | 1 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. |
| `tests/integration/startup-io-gate.test.ts` | 1 | 0 | 1 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. |
| `tests/integration/worker-runtime.test.ts` | 4 | 0 | 4 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. |
| `tests/integration/xyz-detach-overlay-address.test.ts` | 3 | 0 | 3 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. |
| `tests/integration/xyz-overlay-progression.test.ts` | 1 | 0 | 1 | Cross-module and engine integration behavior, including lifecycle and failure boundaries. |
| `tests/mvp-assets.test.ts` | 4 | 1 | 3 | Shared tooling, compatibility, architecture, or security boundary behavior. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/paths.test.ts` | 2 | 0 | 2 | Shared tooling, compatibility, architecture, or security boundary behavior. |
| `tests/profile-sync-selection-race.test.ts` | 1 | 0 | 1 | Shared tooling, compatibility, architecture, or security boundary behavior. |
| `tests/run-lock.test.ts` | 3 | 0 | 3 | Shared tooling, compatibility, architecture, or security boundary behavior. |
| `tests/shop-set-fetch.test.ts` | 7 | 0 | 7 | Shared tooling, compatibility, architecture, or security boundary behavior. |
| `tests/sources.test.ts` | 5 | 0 | 5 | Shared tooling, compatibility, architecture, or security boundary behavior. |
| `tests/strings.test.ts` | 1 | 0 | 1 | Shared tooling, compatibility, architecture, or security boundary behavior. |
| `tests/tar.test.ts` | 2 | 0 | 2 | Shared tooling, compatibility, architecture, or security boundary behavior. |
| `tests/transform.test.ts` | 5 | 0 | 5 | Shared tooling, compatibility, architecture, or security boundary behavior. |
| `tests/unit/acceptance-scenario.test.ts` | 2 | 0 | 2 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/active-card-text-manifest.test.ts` | 1 | 0 | 1 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/active-duel-dependencies.test.ts` | 3 | 0 | 3 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/active-image-manifest.test.ts` | 3 | 0 | 3 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/admin-actions.test.ts` | 7 | 0 | 7 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/agents-doc-trunk.test.ts` | 3 | 3 | 0 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. Applied deletion ledger removes 3 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/app-build-identity.test.ts` | 8 | 0 | 8 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/application-bootstrap.test.ts` | 3 | 0 | 3 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/auto-placement.test.ts` | 8 | 0 | 8 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/auto-response.test.ts` | 21 | 0 | 21 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/battle-contracts.test.ts` | 17 | 0 | 17 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/battle-runtime-input.test.ts` | 6 | 0 | 6 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/battle/selectable-decks.test.ts` | 10 | 0 | 10 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/board-stack-top-visibility.test.ts` | 1 | 0 | 1 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/capped-response-body.test.ts` | 4 | 0 | 4 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/card-action-label.test.ts` | 4 | 0 | 4 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/card-frame.test.ts` | 11 | 0 | 11 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/card-list-dialog-model.test.ts` | 13 | 0 | 13 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/card-mapping.test.ts` | 6 | 0 | 6 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/card-preview.test.ts` | 18 | 0 | 18 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/card-visibility.test.ts` | 2 | 0 | 2 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/cards.test.ts` | 9 | 0 | 9 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/chapter-authoring.test.ts` | 7 | 0 | 7 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/chapter-one-decks.test.ts` | 5 | 0 | 5 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/chapter-one-image-lock.test.ts` | 3 | 0 | 3 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/chapter-set-media.test.ts` | 2 | 0 | 2 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/chapter-source-policy.test.ts` | 3 | 0 | 3 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/commerce/content.test.ts` | 7 | 0 | 7 | Commerce-domain purchasing, inventory, pack opening, and collection behavior. |
| `tests/unit/commerce/runtime.test.ts` | 7 | 0 | 7 | Commerce-domain purchasing, inventory, pack opening, and collection behavior. |
| `tests/unit/commerce/source-export.test.ts` | 3 | 0 | 3 | Commerce-domain purchasing, inventory, pack opening, and collection behavior. |
| `tests/unit/content-setup-authoring.test.ts` | 8 | 0 | 8 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/content-setup-files.test.ts` | 21 | 0 | 21 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/content-setup-runtime.test.ts` | 11 | 0 | 11 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/content-setup.test.ts` | 21 | 1 | 20 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/content-tooling-gates.test.ts` | 3 | 1 | 2 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/contracts.test.ts` | 22 | 0 | 22 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/core-gate.test.ts` | 5 | 1 | 4 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/create-node-runtime.test.ts` | 1 | 1 | 0 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/data-cy-coverage.test.ts` | 26 | 0 | 26 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/deck-catalog.test.ts` | 5 | 0 | 5 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/deck-editor/click-intent.test.ts` | 4 | 0 | 4 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/deck-editor/deck-library-tiles.test.ts` | 13 | 0 | 13 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/deck-editor/editor-layout.test.ts` | 6 | 0 | 6 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/deck-editor/focus-trap.test.ts` | 1 | 0 | 1 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/deck-editor/result-window.test.ts` | 5 | 0 | 5 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/deck-editor/tap-targets.test.ts` | 8 | 0 | 8 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/deck-order-projection.test.ts` | 12 | 0 | 12 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/deck-parser.test.ts` | 9 | 1 | 8 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/deck-select/order-deck-tiles.test.ts` | 8 | 0 | 8 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/deck-sources-node.test.ts` | 9 | 9 | 0 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. Applied deletion ledger removes 9 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/decks/canonical-sort-matrix.test.ts` | 1 | 0 | 1 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/card-ownership.test.ts` | 3 | 0 | 3 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/catalog-fixture.test.ts` | 1 | 1 | 0 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/decks/deck-buildable-cards.test.ts` | 3 | 0 | 3 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/deck-catalog-index.test.ts` | 7 | 0 | 7 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/deck-catalog-performance.test.ts` | 9 | 0 | 9 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/deck-catalog-ritual-filter.test.ts` | 1 | 0 | 1 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/deck-catalog.test.ts` | 15 | 0 | 15 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/deck-grid-plan.test.ts` | 5 | 0 | 5 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/deck-history.test.ts` | 10 | 0 | 10 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/deck-library-order.test.ts` | 2 | 0 | 2 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/deck-model.test.ts` | 27 | 0 | 27 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/deck-repository-context.test.ts` | 7 | 0 | 7 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/deck-resolver-integration.test.ts` | 1 | 0 | 1 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/deck-resolver.test.ts` | 3 | 0 | 3 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/deck-validation.test.ts` | 5 | 0 | 5 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/installed-gameplay-cards.test.ts` | 1 | 0 | 1 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/ocg-card-mapper.test.ts` | 4 | 1 | 3 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/decks/ocg-mask-parity.test.ts` | 1 | 0 | 1 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/ownership-validation.test.ts` | 11 | 0 | 11 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/packaged-catalog.test.ts` | 8 | 0 | 8 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/published-deck-validation.test.ts` | 1 | 0 | 1 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/runtime-catalog.test.ts` | 15 | 0 | 15 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/sqlite-deck-repository.test.ts` | 15 | 0 | 15 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/starter-deck.test.ts` | 8 | 0 | 8 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/ydk-adapter.test.ts` | 4 | 0 | 4 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/decks/ydk-history.test.ts` | 4 | 0 | 4 | Deck-domain parsing, mapping, catalog legality, persistence, and editor behavior. |
| `tests/unit/dialog-chrome.test.ts` | 4 | 4 | 0 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. Applied deletion ledger removes 4 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/dom-feedback-controller.test.ts` | 6 | 0 | 6 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/domain-boundaries.test.ts` | 39 | 0 | 39 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/domain-chunk-closure.test.ts` | 10 | 0 | 10 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/domain-fixture-inputs.test.ts` | 1 | 0 | 1 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/download-diagnostics.test.ts` | 2 | 0 | 2 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/drag-ghost-physics.test.ts` | 15 | 0 | 15 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/drop-target.test.ts` | 7 | 0 | 7 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/duel-deck-selection.test.ts` | 20 | 0 | 20 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/duel-field-geometry.test.ts` | 14 | 0 | 14 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/duel-field.test.ts` | 38 | 1 | 37 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/duel-phase-label.test.ts` | 3 | 1 | 2 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/duel-priority.test.ts` | 3 | 0 | 3 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/duel-rail-status.test.ts` | 2 | 0 | 2 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/duel-restore-plan.test.ts` | 4 | 0 | 4 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/duel-rules-profile.test.ts` | 6 | 0 | 6 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/duel-seed.test.ts` | 2 | 0 | 2 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/duel-session.test.ts` | 4 | 0 | 4 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/duel-state-projector.test.ts` | 76 | 0 | 76 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/duel-store.test.ts` | 24 | 0 | 24 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/duel-worker-attachment.test.ts` | 10 | 0 | 10 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/duel-worker-client.test.ts` | 23 | 0 | 23 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/duel-worker-runtime.test.ts` | 24 | 0 | 24 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/end-turn-automation.test.ts` | 8 | 0 | 8 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/field-navigation.test.ts` | 11 | 0 | 11 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/floating-window-position.test.ts` | 7 | 0 | 7 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/format-duel-presentation-event.test.ts` | 3 | 0 | 3 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/format-selection-status.test.ts` | 16 | 0 | 16 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/generate-shop-sets.test.ts` | 1 | 0 | 1 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/global-styles.test.ts` | 61 | 6 | 55 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. Applied deletion ledger removes 6 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/hand-activation-choices.test.ts` | 1 | 0 | 1 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/headless-lifecycle.test.ts` | 5 | 0 | 5 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/headless-reconciliation.test.ts` | 13 | 0 | 13 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/image-content-lock.test.ts` | 9 | 0 | 9 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/image-download-cli.test.ts` | 1 | 0 | 1 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/immutable-choice-id-set.test.ts` | 2 | 0 | 2 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/installed-assets.test.ts` | 2 | 0 | 2 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/installed-battle-images.test.ts` | 12 | 0 | 12 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/installed-card-image-source.test.ts` | 3 | 0 | 3 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/installed-duel-command.test.ts` | 3 | 0 | 3 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/installed-free-play.test.ts` | 3 | 0 | 3 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/installed-gameplay.test.ts` | 3 | 0 | 3 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/installed-images.test.ts` | 2 | 0 | 2 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/installed-runtime-receipt-validation.test.ts` | 1 | 0 | 1 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/installed-worker-deck-validation.test.ts` | 1 | 0 | 1 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/interaction-session.test.ts` | 14 | 0 | 14 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/interaction-spec.test.ts` | 52 | 0 | 52 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/material-list.test.ts` | 3 | 0 | 3 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/message-classification.test.ts` | 4 | 0 | 4 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/native-content-clean.test.ts` | 1 | 0 | 1 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/ocgcore-adapter.test.ts` | 6 | 0 | 6 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/off-field-target-list.test.ts` | 13 | 0 | 13 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/opponent-policy.test.ts` | 19 | 0 | 19 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/opponent-position-concealment.test.ts` | 1 | 0 | 1 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/pending-placement.test.ts` | 9 | 0 | 9 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/persisted-ui-state.test.ts` | 7 | 0 | 7 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/persisted-ui-store.test.ts` | 9 | 0 | 9 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/perspective.test.ts` | 2 | 0 | 2 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/phase-transitions.test.ts` | 6 | 2 | 4 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. Applied deletion ledger removes 2 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/placement-candidates.test.ts` | 8 | 0 | 8 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/presentation-command.test.ts` | 5 | 0 | 5 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/programmed-scenarios.test.ts` | 3 | 0 | 3 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/programmed-transcript.test.ts` | 3 | 0 | 3 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/progressive-release-media.test.ts` | 1 | 0 | 1 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/prompt-context-message.test.ts` | 24 | 0 | 24 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/prompt-control-family.test.ts` | 1 | 0 | 1 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/prompt-registry-visibility.test.ts` | 1 | 0 | 1 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/prompt-registry.test.ts` | 38 | 0 | 38 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/prompt-selection.test.ts` | 6 | 0 | 6 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/prompt-surface.test.ts` | 15 | 0 | 15 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/replay-opponent-policy.test.ts` | 3 | 0 | 3 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/resolve-duel-decks.test.ts` | 12 | 0 | 12 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/reviewed-card-pool.test.ts` | 4 | 2 | 2 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. Applied deletion ledger removes 2 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/runtime-manifest.test.ts` | 5 | 0 | 5 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/runtime-snapshot-root-containment.test.ts` | 1 | 0 | 1 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/selected-content-fixture.test.ts` | 4 | 4 | 0 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. Applied deletion ledger removes 4 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/selected-hand-zoom.test.ts` | 9 | 0 | 9 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/semantic-release-preparation.test.ts` | 7 | 0 | 7 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/set-image-acquisition.test.ts` | 6 | 1 | 5 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/set-image-manifest.test.ts` | 11 | 0 | 11 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/settle-once.test.ts` | 2 | 0 | 2 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/shared-svelte-ui.test.ts` | 3 | 0 | 3 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/shell-routes.test.ts` | 22 | 6 | 16 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. Applied deletion ledger removes 6 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/shell-settings-concurrency.test.ts` | 3 | 0 | 3 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/shell-settings.test.ts` | 10 | 0 | 10 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/shell-store.test.ts` | 15 | 0 | 15 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/shell/free-play-deck-actions.test.ts` | 9 | 0 | 9 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/shell/free-play-deck-tiles.test.ts` | 4 | 0 | 4 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/shell/free-play-opponents.test.ts` | 2 | 0 | 2 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/shell/handoff-coordinator.test.ts` | 23 | 0 | 23 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/shell/session-saves.test.ts` | 3 | 0 | 3 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/shell/sqlite-application-service.test.ts` | 13 | 0 | 13 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/shell/story-battle-request.test.ts` | 2 | 0 | 2 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/stage-frame.test.ts` | 10 | 0 | 10 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/stage-layout.test.ts` | 10 | 0 | 10 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/storage/app-content-boundary.test.ts` | 3 | 0 | 3 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/application-bootstrap-io.test.ts` | 3 | 0 | 3 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/asset-restructure.test.ts` | 15 | 0 | 15 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/battle-preference-presence.test.ts` | 9 | 0 | 9 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/chapter-banlist.test.ts` | 2 | 0 | 2 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/content-modules.test.ts` | 5 | 0 | 5 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/content-queries.test.ts` | 6 | 0 | 6 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/critical-snapshot.test.ts` | 4 | 0 | 4 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/download-links.test.ts` | 3 | 0 | 3 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/freeplay-inputs.test.ts` | 21 | 0 | 21 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/fresh-checkpoint.test.ts` | 9 | 0 | 9 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/global-set-contracts.test.ts` | 4 | 0 | 4 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/json-user-data.test.ts` | 11 | 0 | 11 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/json-user-reset.test.ts` | 3 | 0 | 3 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/live-media-cancellation.test.ts` | 1 | 0 | 1 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/live-media-leases.test.ts` | 1 | 0 | 1 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/manual-content-controller.test.ts` | 17 | 0 | 17 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/manual-content-safety.test.ts` | 3 | 0 | 3 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/media-image-bounds.test.ts` | 1 | 0 | 1 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/memory-user-state.test.ts` | 2 | 0 | 2 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/mod-composition.test.ts` | 6 | 0 | 6 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/native-default-content.test.ts` | 1 | 0 | 1 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/native-io-trace.test.ts` | 5 | 0 | 5 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/native-io-wire-contract.test.ts` | 1 | 0 | 1 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/new-game-independence.test.ts` | 3 | 0 | 3 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/normalized-package-source.test.ts` | 12 | 0 | 12 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/package-contracts.test.ts` | 18 | 0 | 18 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/package-export.test.ts` | 14 | 0 | 14 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/package-import.test.ts` | 16 | 0 | 16 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/package-lifecycle.test.ts` | 15 | 0 | 15 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/package-preflight.test.ts` | 7 | 0 | 7 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/package-readiness.test.ts` | 5 | 0 | 5 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/preferences-persistence.test.ts` | 7 | 0 | 7 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/production-user-callers.test.ts` | 3 | 0 | 3 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/restore-unknown-outcome.test.ts` | 3 | 0 | 3 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/retired-deck-api-boundary.test.ts` | 2 | 0 | 2 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/retired-progressive-browser.test.ts` | 5 | 0 | 5 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/retired-runtime-api-boundary.test.ts` | 3 | 0 | 3 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/retired-shell-battle-preferences.test.ts` | 2 | 0 | 2 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/retired-shell-installer-api.test.ts` | 4 | 0 | 4 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/retired-story-api-boundary.test.ts` | 4 | 0 | 4 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/retired-story-playback-api.test.ts` | 2 | 0 | 2 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/sqlite-image-source.test.ts` | 7 | 0 | 7 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/sqlite-repositories.test.ts` | 16 | 0 | 16 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/startup-diagnostics.test.ts` | 3 | 0 | 3 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/startup-io-trace.test.ts` | 11 | 0 | 11 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/startup-percentage.test.ts` | 2 | 0 | 2 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/storage-client-close.test.ts` | 6 | 0 | 6 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/story-backup-structure.test.ts` | 3 | 0 | 3 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/story-inputs.test.ts` | 5 | 0 | 5 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/user-data-backup.test.ts` | 9 | 0 | 9 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/user-data-contracts.test.ts` | 8 | 0 | 8 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/user-data-download.test.ts` | 2 | 0 | 2 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/user-data-size-safety.test.ts` | 4 | 0 | 4 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/user-data-store.test.ts` | 6 | 0 | 6 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/storage/user-persistence-owner.test.ts` | 15 | 0 | 15 | Storage contracts, validation, atomic writes, and native boundary behavior. |
| `tests/unit/story/auto-flip.test.ts` | 6 | 0 | 6 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/card-ownership.test.ts` | 6 | 0 | 6 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/collection-cards.test.ts` | 6 | 0 | 6 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/collection-grouping.test.ts` | 7 | 1 | 6 | Story-domain rules, collection/progression state, and user-visible content behavior. Applied deletion ledger removes 1 audited low-value or redundant declaration(s); retained count reflects the remaining reviewed cases. |
| `tests/unit/story/contrast.test.ts` | 5 | 0 | 5 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/credit-at-open.test.ts` | 8 | 0 | 8 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/encounter-deck.test.ts` | 9 | 0 | 9 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/event-chain.test.ts` | 2 | 0 | 2 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/installed-shop-set-data.test.ts` | 4 | 0 | 4 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/modded-save-composition.test.ts` | 1 | 0 | 1 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/module-progress.test.ts` | 6 | 0 | 6 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/new-game-grant.test.ts` | 9 | 0 | 9 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/opened-card-quantities.test.ts` | 7 | 0 | 7 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/pre-battle-decks.test.ts` | 16 | 0 | 16 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/pre-battle-tiles.test.ts` | 6 | 0 | 6 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/save-generation-errors.test.ts` | 1 | 0 | 1 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/save-generations.test.ts` | 7 | 0 | 7 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/sell-impact.test.ts` | 10 | 0 | 10 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/shop-data.test.ts` | 8 | 0 | 8 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/shop-pack-value.test.ts` | 2 | 0 | 2 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/shop-rarity-index.test.ts` | 1 | 0 | 1 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/shop-set-data.test.ts` | 9 | 0 | 9 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/shop-set-fold.test.ts` | 6 | 0 | 6 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/sqlite-story-save.test.ts` | 16 | 0 | 16 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/story-boundaries.test.ts` | 4 | 0 | 4 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/story-deck-context.test.ts` | 9 | 0 | 9 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/story-deck-repository-concurrency.test.ts` | 1 | 0 | 1 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/story-deck-repository.test.ts` | 34 | 0 | 34 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/story-decks.test.ts` | 11 | 0 | 11 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/story-handoff.test.ts` | 11 | 0 | 11 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/story-playback-settings.test.ts` | 5 | 0 | 5 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/story-playback.test.ts` | 6 | 0 | 6 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/story-read-log-concurrency.test.ts` | 2 | 0 | 2 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/story-read-log.test.ts` | 6 | 0 | 6 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/story-release-adapter.test.ts` | 2 | 0 | 2 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/story-release.test.ts` | 7 | 0 | 7 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/story-state.test.ts` | 46 | 0 | 46 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/story/zoom-window-position.test.ts` | 8 | 0 | 8 | Story-domain rules, collection/progression state, and user-visible content behavior. |
| `tests/unit/sum-selection.test.ts` | 5 | 0 | 5 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/toast-store.test.ts` | 6 | 0 | 6 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/ui-settings-store.test.ts` | 8 | 0 | 8 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/unit/zone-list.test.ts` | 11 | 0 | 11 | Focused unit behavior for a domain rule, boundary, parser, contract, or utility. |
| `tests/verify-assets.test.ts` | 1 | 0 | 1 | Shared tooling, compatibility, architecture, or security boundary behavior. |
| `tests/vite-config.test.ts` | 1 | 0 | 1 | Shared tooling, compatibility, architecture, or security boundary behavior. |

Totals: **487 files** (476 TypeScript, 11 Rust); **3839** declaration sites before, **93** removed, **3746** retained.
