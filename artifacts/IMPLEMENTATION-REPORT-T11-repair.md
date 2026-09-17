# T11 repair — retry3

State: **DONE / CHECKED — browser114, headless115, native core116 GREEN on frozen source; independent acceptance pending**.

Baseline: `f3f3c541fd912717bc743d7a6508c3ebda7c5e82` (accepted T10). Parent routing: vanished Astra/high retry2 → Astra/high retry3 (same effort). Sole root writer; no subagents, staging, commit, push, publication, deploy, system apply.

## Current evidence

| ID | Gate | Actual result | Evidence |
| --- | --- | --- | --- |
| E1 | Final exact `npm run check:headless` | PASS exit0: 220 legacy, 2732 unit, 54 integration; type0/four existing warnings; format/lint/vendor/assets/snapshot pass on frozen source | `115-headless-retry3.log`, `.exit` = 0 |
| E2 | Final native `npm run test:core` | PASS exit0: 11/11 Chromium,35.8s; root/subpath source-only, activation/save/update/media/CORE proofs retained | `116-core-retry3.log`, `.exit` = 0; `native-core-retry3/` JSON/screenshots/traces |
| E3 | Canonical cross-era sort + shop consumers | PASS: 40/40; includes original four-Extra-subtype matrix/undo/redo, 14 cases | `28-sort-printing-contracts.log`, `.exit` = 0 |
| E4 | Focused legacy browser repair | GREEN final cases: illegal deck, Worker fail-closed, stage desktop; cache-only warning/placeholders; canonical sort | `43-focused-after-memo.log` (three cases pass; warning newline RED retained), `45-missing-media-final.log` (1/1), `24-focused.log` (sort pass) |
| E5 | Exact `npm run check:browser` completed before image/Shell fixes | FAIL exit1: 131 passed, 7 failed, 1 pre-existing conditional skip / 139. Components1238/build/budgets/reproducibility passed. Acceptance stage not reached | `44-check-browser.log`, `.exit` = 1; `full-browser-retry2/e2e.json`, `e2e-output/` |
| E6 | Native image/instrumentation repair slice | 7/9 PASS: mounted lease lifecycle, two preview cases, real activation/cancel without skip, Story zero Worker/runtime GET, Chromium/Firefox smoke. Library hover rows and WebKit warning still failed on that snapshot | `75-native-images.log`, `.exit` = 1; `native-images/e2e.json`, `e2e-output/` |
| E7 | Final shared/Library/Shell components + aggregate components | Focused100 PASS166/166; exact106 component stage PASS1269/1269 across138 files. Earlier eager expectation and intermittent FreePlay failure no longer fail this stage | `100-pending-hover-green.log`; `106-browser-frozen.log` |
| E8 | Native repaired seams / unchanged performance |93:8/10 (Library + Chromium/Firefox/WebKit + DF-16 + three pointer cases pass).96:4/5 (activation + other pointer cases pass).101:2/2 final Library + field-hand geometry. No skips in these runs | `93-`, `96-`, `101-` logs/exits; corresponding native JSON/output |
| E9 | Interrupted exact `npm run check:browser` | NO COMPLETION: log stops111/139 after1269 components/build/budgets/reproducibility PASS; three completed setup failures; next case112 context closed during runner loss; no106 exit/stage summary | `106-browser-frozen.log`; `retained-interrupted106-output/`; `109-trace-call-mapping.json` |
| E10 | Retry3 focused test-only batch | PASS14/14 in6.1m, seven cases repeated twice, zero skips; EndTurn/activation/keyboard plus adjacent geometry/phase/focus | `113-native-retry3-focused-final.log`, `.exit`=0; `native-retry3-focused-final/` |
| E11 | Retry3 exact `npm run check:browser` | PASS exit0:1269 components,139/139 E2E,41/41 acceptance; zero skips; build/budgets/reproducibility pass | `114-browser-retry3.log`, `.exit`=0; `full-browser-retry3/` stage JSON/output |

## Implementation scope

I1. Domain E2E uses actual canonical progressive required install, seal, semantic prepare, selector activation, schema6 save repositories, readiness reload. No selector/save-generation bypass.

I2. Existing test-only runtime consolidation preserves complete canonical DTO/WASM/scripts/texts/cards/Story/media references. Verified optional-media profile reuse copies only digest/path/size-checked optional Cache/file rows. Real download scenarios remain real.

I3. Approved shop production change: stable collision-safe JSON four-tuple for canonical regional-printing identity, unique encoded DOM IDs, printing-keyed preview. Every entry, price, economy dispatch retained. Component fixtures gain required keys without changing old IDs/assertions. Additional parent-approved manifest-parsing performance repair documented below.

I4. Test contracts follow selected chapter IDs/cards, emitted hashed fonts, cache-only media, T9 fail-closed save/Worker recovery. Full original→new assertion mapping: `artifacts/T11-REPAIR-EVIDENCE/assertion-mapping.md`.

I5. Original empty component shell deletion is justified by exact original runner failure, not dead-code cleanup: `T11-EVIDENCE/18-check-browser.log`, `Error: No test suite found in file /home/aron/projects/ascencio/tests/component/content-installer.test.ts`. Existing `InstallContentScreen.test.ts` remains.

I6. Parent-approved Deck Library consumer: cropped leases for supplied covers + selected deck rows; full leases only selected deck rows to serve existing synchronous hover resolver. Deduplicate code+variant; maximum4 acquisitions including obsolete unresolved work. Obsolete queued/inflight identities abort; late/obsolete leases release exactly once. Supplied-source missing media stays placeholder; legacy URL fallback only with no source. Not viewport-aware, not hover-only. No whole-catalog/all-deck full preload or full-catalog metadata cloning per image arrival.

I7. Parent-approved Battle internal lease seam: `CardImageLease.subscribe?` delivers immediate URL snapshot then async readiness. Source acquisition only for mounted allowed-code handles; code dedup/refcounts, final-owner release, cancellation, late-result drain. Four physical slots shared across replacement Battle libraries; image identities/leases remain per-library. Existing synchronous legacy libraries/fixtures stay compatible. Seven mounted consumers subscribe/reactively refresh; App visible preview shares ownership; catalog-wide URL pass removed. Public Cards/Battle ports unchanged. Diagnostics now report observed mounted-image statuses, not full inventory; Shell warning remains full inventory.

I8. Explicit parent-approved shared-view exceptions: private hover-art provenance/code invalidates stale art on resolver changes (legacy cropped fallback retained); private hover-list loader refreshes when resolver changes, rejects obsolete key/resolver resolutions, cancels publication after unmount, clears rejected optional hover previews. No shared API widening, acquisition, domain import, DOM mutation or remount. Stable hovered rows/filter/sort/focus retained during same-key image readiness. Parent subsequently approved conservative clearing of cropped imageUrl only while replacement resolver is pending; caller objects are not mutated, current-token result restores ready images. Temporary placeholder rather than possibly revoked URL is intentional.

I9. Parent-approved Shell distinction: ignore only exact `ResizeObserver loop completed with undelivered notifications.` with absent/null `ErrorEvent.error`. Diagnostic remains observable. Actual Error objects—even same message—other ErrorEvents, unhandled rejections, Worker/storage failures still recover/release. Native WebKit regression GREEN93; actual-failure recovery tests retained.

## Repair chronology

| ID | RED / discovery | Narrow correction | State |
| --- | --- | --- | --- |
| C1 | Retry1 `22-duel-sweep-2.log` stops after test14 starts, no exit/result | Retain incomplete log; do not claim sweep pass | Diagnosed |
| C2 | Headless `25-check-headless.log`: `Unexpected empty object pattern` twice | Line-local documented exception for Playwright-required empty fixture dependency destructuring | Full headless GREEN |
| C3 | Headless `26-check-headless.log`: missing required `SetCard.key` in three older component consumers | Add explicit fixture keys, preserve existing data-cy/assertions | 40 focused + full headless GREEN |
| C4 | Illegal deck reason uses accessible label, not inline `40`; stale player-seat selector | Assert exact disabled reason and actual `duel-start-your-deck` | GREEN `43-focused-after-memo.log` |
| C5 | Optional warning obsolete Battle panel; full canonical scan exceeds both 30s and diagnostic 120s | Cache-only placeholder/control/zero-GET contract plus verified parsing memo; original 30s assertion timeout restored; regex accepts actual newline | GREEN `45-missing-media-final.log`; canonical benchmark GREEN |
| C6 | Fatal Worker timeout reaches accepted T9 recovery, disposes Battle | Parent-approved recovery/Main Menu/zero duel/all Workers terminated/selector+save preservation/lease-release assertions | GREEN `43-focused-after-memo.log` |
| C7 | Stage test repairs corrupt slot but does not reload locked Shell | Reload after supported slot repair, unchanged healthy snapshot | GREEN desktop `43-focused-after-memo.log`; all viewports in aggregate |

## Canonical-scale performance repair

Parent approved bounded production diagnosis, then exact private memo seam before implementation. No public API or format change.

| ID | Observation | Menu, no Battle Worker | Battle |
| --- | --- | --- | --- |
| M1 | Baseline warning | Not observed at 120338ms | Not observed at 120664ms |
| M2 | Baseline manifest work at cutoff | 1708 reads / hashes / parses | 1665 reads, 1661 hashes / parses |
| M3 | After warning latency | 8993ms | 12420ms |
| M4 | After manifest work | 3331 reads / hashes, 1 parse | 5090 reads / hashes, 1 parse |
| M5 | Legal prompt latency | No Worker constructed | 10784ms baseline → 4260ms after |

Both runs use all 3311 canonical media references. Baseline observations are censored lower bounds, not invented completion times. Metrics count real IDB manifest gets, matching-byte-length SHA calls, exact manifest JSON parses. Same script/prod Chromium profile. Evidence: `34-canonical-media-red.log`, `42-canonical-media-green.log`, `canonical-media-{baseline,after}-metrics.json`; rerun with `T11_METRIC_PHASE=<new-name> npx playwright test -c artifacts/T11-REPAIR-EVIDENCE/canonical-media.config.ts`.

M6. `src/content/storage/progressive-content-store.ts`: one private parsed-manifest+descriptor-index entry per store. Every lookup still reads current IDB row and recomputes SHA-256 after row/version/size validation. Only parsing/index construction reused for verified digest. File receipts, Cache existence, body size/hash, abort checks unchanged. Public `readManifest` returns fresh deep clone; callers cannot poison private index. Alternate digest replaces sole entry; close clears memo; close during digest refuses completion. Each concurrent call captures its verified entry before later awaits, preventing cross-version descriptor mix.

M7. Chronological RED `36-memo-red.log`: `expected \"parsedManifest\" to be called 1 times, but got 12 times`. GREEN `41-memo-regression.log`: 136 tests, including 10 memo tests, storage/download/T9/T10/core approval/Worker/equivalence; type0/four existing warnings; scoped ESLint pass. Corruption, eviction, replaced/wrong-version rows after warm read, nested caller mutation, alternating/concurrent versions, file body/receipt eviction, abort, close-during-digest/reopen covered. Independent performance/security review required.

## Image / browser-warning RED-to-GREEN chronology

| ID | Evidence before production change | Approved repair / actual verification |
| --- | --- | --- |
| N1 | Native44 Library art count0; component52 six acquisition failures | Host image source + bounded owner implemented; component54 31/31. Native75 still exposed hovered-list snapshot issue; do not claim native Library pass from this stage. |
| N2 | Native44 mounted URL inequality; unit55 no-preload/final-owner failures; consumer58 seven readiness failures/seven concealment passes | Battle queue/leases/subscriptions; unit11 cases plus seven readiness/concealment consumers. Regression60 69/69; native75 mounted lifecycle PASS5.6s, two preview cases PASS. |
| N3 | Component62 old hovered revoked URL survives selection change | Private art invalidation (including original URL provenance for legacy fallback), no remount;63 7/7. Source/selection/deck edits, valid hover, filter/sort/focus covered. |
| N4 | Native75 Library still art0; component87 pointer-enter-before-click reproduces1/8 failure | `hoverList` shadows fresh `restList` while pointer stays on tile. Refresh hover resolver via token;89 165/165 shared/Library/Shell. Diagnostic86 confirms real URLs acquired while stale dock has0 art after return; no Shell/media-source change made. |
| N5 | Native44/75 WebKit stops before picker; exact RO diagnostic observed; component81 four warning-retention failures | Exact warning/no Error-object guard;85 43/43. Fixture accounting corrected for existing menu-read leases; active mounted lease retained, real failures release. Native93 and full114 WebKit PASS. |
| N6 | Component71 eager-acquire setup fails; all other1258 pass | App hidden-hover test now asserts no pre-mount acquisition, one known-code acquisition shared by card/preview, no additional hidden lookup. Native/other acquisition assertions unchanged. |
| N7 | Native44 Story counter undefined | Init script registered after fixture's first document; hash navigation does not run it. Reload before measurement; native75 passes original zero Worker/runtime GET assertions. |
| N8 | Native44 conditional hand-activation skip;93 manual walker races auto-chain response | Bounded real prompt walk/restart uses existing manual-prompt UI settings, not seeded/injected engine state.96 activation/cancel + three placement cases pass. Field-set case uses pure presence probe, restores original UI auto settings before measured set;101 passes. Original widget/opaque-response assertions retained; no `test.skip` remains in duel smoke source. |
| N9 | RED98: old cropped blob URL retained while replacement hover resolver pending | Parent-approved presentation-row copies clear imageUrl across hovered Main/Extra/Side, preserve keyed text/focus and caller objects. Obsolete success/rejection/token removal/unmount covered; GREEN100 166/166; native101 Library PASS7.9s. |
| N10 | RED93: separate geometry samples differ4.648681640625px during120ms focus transition | Wait actual native transform settlement, keep original2px assertion plus atomic diagnostic. Native101 settled/atomic bottom deltas both0.624755859375px; full chip hit-test and opaque-response assertions pass. No CSS/budget/timeout changes. |

Diagnostic86 disables trace/video only in separate diagnostic config; never substitutes for primary gates. Native failed Library artifacts include `RangeError: Invalid string length` while recording failure evidence; JSON/PNG/video retained, no trace completeness claim. Final106 discovers original139 tests; no count reduction.

## Assumptions

A1. Native evidence means installed production-browser Chromium automation on local loopback, not physical-device installation.

A2. Canonical local asset acquisition does not grant publication rights; `publishReady: false` remains.

A3. Parent owns independent review, final acceptance, commit, final HTML, Forgejo PR.

## Residual risks

R1. Exact44 completed failed;106 interrupted without exit. Retry3 consolidated three completed failures before test-only batch;113 passes14/14 twice-repeated cases. Fresh114 exact aggregate exit0:139/139 E2E,41/41 acceptance,zero skips.115 headless/116 core also exit0. Technical gates checked; independent acceptance still pending. Full106 interrupted artifacts preserved; no pass inferred from its partial progress.

R2. Parent approved removing obsolete Battle fatal-heading focus assertion because T9 disposes Battle. Shell recovery lacks explicit keyboard-focus handoff. No equivalent focus coverage claimed; accessibility gap outside this bounded repair. Unrelated focus tests preserved.

R3. Graph index remains stale due known backend quota; no retry requested. Prior T10 strict TDD chronology remains unmet, not rewritten by repair evidence.

R4. Canonical optional scan still reads/hashes current manifest on every read. Bounded parsed-metadata memo removes repeated parse/validation work; independent review must confirm integrity and memory bounds. Full private fixture remains costlier than small native harness. No test/bundle budget weakening.

R5. Four source operations ignoring abort indefinitely occupy all four Battle physical slots. Later optional art stays placeholder until settlement; legal controls remain independent. Cannot promise both physical cap4 and non-starvation against a provider that never settles. Disposed queued work removed; source work is never falsely marked settled. Independent concurrency/security review required.

R6. External Nix compilation overlapped earlier tests (`74-host-load.txt`); DF-16 native44 p95=65.3ms failed unchanged50ms threshold. Native93 same pinned4x-CPU profile passes p95=29.5ms and input p95=17.8ms, zero long tasks; original50/100/50ms thresholds unchanged. No threshold/timing waiver. Full components73 also had one FreePlay re-read polling failure under heavy load; targeted76 passed92/92 without modifying that test. Final114 component stage1269/1269 passes.114 native same pinned profile passes paint32.7ms/input27.1ms, zero long tasks. Timing-only cause of older failures remains uncertain; failures retained.

R7. Library manager cap4 is per mounted manager, including its stale unresolved source replacements; no cross-remount global cap claimed. Library selection has no persisted90-card hard bound. Normal legality is60 Main/15 Extra/15 Side; YDK import max1000; repository accepts arbitrary-length valid-code arrays. Acquisitions deduplicate supplied codes; claim actual selection-scoped behavior, not viewport/90-item enforcement.

R8. Retry3 test setup avoids floating-confirm/menu overlap by reaching next player idle before restart. Keyboard-only setup parks pointer before measured walk to exclude hover overlay. Those mixed-input/stacking behaviors are not production-fixed or claimed accepted. Existing pointer/keyboard adjacent cases and full aggregate pass; independent reviewer must confirm setup changes preserve intended contracts.

## Preservation

P1. Original `artifacts/IMPLEMENTATION-REPORT-T11.md` and inherited diff hash verification passed; previous evidence retained. User files, feedback, vendor, unrelated recovery lanes/artifacts preserved.

P2. `git diff --cached --quiet` exit0 (`120-no-staged.exit`); no staged files. Final dirty-source inventory: `artifacts/T11-REPAIR-EVIDENCE/source-inventory-retry3.json`; exact frozen source hashes `frozen-retry3-source.sha256` verified117 exit0. Old frozen-source comparison121 proves only `e2e/duel-smoke.spec.ts` changed in retry3; production/tests/fixtures/config from retry2 untouched. Retry3-only diff: `retry3-test-only.diff`. Prior inventory/hashes retained.

P3. Prior commands retained in `commands-retry2.json`;106 explicitly marked interrupted/no exit.63 previously omitted historical invocations recovered with message IDs/timestamps/command hashes; unknown exits remain unrecorded. Retry3 exact gates/exit files: `commands-retry3.json` (focused113, browser114, headless115, core116, preservation/diff/staging117–121). Some historical invocations include edits/inspection: **do not replay archived commands**. Use final standalone gate commands for validation.

P4. Original44 root602MiB output retained in `retained-pre-final-output/`; earlier146MiB/original/retry1 evidence untouched. Interrupted106 full6GiB root output copied to `retained-interrupted106-output/` before retry3 aggregate reused `test-results`. Retry2 checkpoint report retained in `report-retry2-checkpoint.md`. Original report/inherited diff SHA check118 bothOK. No user/source/scratch tree deleted; retry3 created no scratch files. Checkpoint progress retained as requested evidence deliverable.

## Approved post-aggregate batch

- [x] B1. Preserve interrupted106 evidence plus three completed-failure traces/source hash before edits. Validation: `retained-interrupted106-output/`,109 trace mapping/hash checks.106 has NO exit/result; never fabricated.
- [x] B2. Resolve only actually offered chain prompts before original Main2/opponent-turn assertions, using attached-control/current-prompt guards and bounded steps. Validation: native113 EndTurn passes twice; original Main2 presence, one initial End Turn press, opponent-turn transition, phase visibility assertions unchanged. No production/general fixture change.
- [x] B3. Run repaired cases plus adjacent phase/chain/keyboard cases. Validation: focused113 GREEN14/14, `frozen-retry3-source.sha256`. Aggregate106 remains interrupted-before-fix; fresh114 complete evidence still required.

## Retry3 checkpoint chronology (historical states)

C1. Retry2 runner disappeared;106 stops111/139, no exit/stage summary. Never completed. Full6GiB root output retained in `retained-interrupted106-output/`; three completed failures plus interrupted case112 context-close artifact. Frozen source/preservation hashes PASS109.

C2. Trace mapping `109-trace-call-mapping.json`; diagnosis/validation checklist `progress-retry3.md`. Only `e2e/duel-smoke.spec.ts` changed this retry: bounded offered-chain walk before Main2, attached ready-control guard, restart only after next player idle prompt, pointer parked before measured keyboard-only walk. Original behavior assertions/budgets preserved. No production edits. Focused run pending.

C3. Focused111:6/7 PASS; keyboard full duel57 responses, zero duplicates, defense focus, unsurrendered result; activation cancel and four adjacent cases PASS. EndTurn reaches Main2 then final End phase offers another real chain. Same test-only batch now resolves offered End-phase chains after each original EndTurn click, asserting exactly one response per offered prompt; no extra EndTurn click. Focused113 repeat2 next.

C4. Focused113 exit0:14/14 in6.1m (failed3 plus four adjacent cases, repeated twice), no skips.114 exact browser gate running on `frozen-retry3-source.sha256`; reporter retains stage JSON/output under `full-browser-retry3/`. Source stays frozen; PID/command/log/exit names recorded in `commands-retry3.json`.

C5.114 entered139 E2E after component/build/reproducibility stages completed. At11:35 local,7 cases passed. Aggregate still running; final exit pending.

C6.114 complete exit0:1269 components,139/139 E2E,41/41 acceptance, zero skips; build/budgets/reproducibility pass. Full-run DF-16 p95 paint32.7ms/input27.1ms, no long tasks; unchanged50/100/50ms thresholds. Full keyboard63 prompts, zero duplicates, defense focus, unsurrendered result.115 headless then116 core next on same source.

C7.115 exact current-source headless exit0; all stages pass.116 native core next, same frozen source.

C8.116 exact native core exit0:11/11 Chromium35.8s. Current-source gates complete. Scope retry3 remains test-only; inherited approved production changes require independent review.
