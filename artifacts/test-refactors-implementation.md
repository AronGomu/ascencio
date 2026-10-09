# Test refactor implementation

## Workflow

- [x] Read the Principles section of Poteto Mode.
- [x] Phase A: Frame. Implement the 14 deferred items in `artfifacts/test-refactors-notes.md`, preserving security and recovery coverage. Record existing failures before changing their causes.
- [x] Phase B: Design the workflow. Use disjoint groups for fixtures, browser coverage, and manifest/Rust acceptance. Keep the single main checkout required by AGENTS.md.
- [x] Phase C: Run the loop. Verify each group with its real runner before integration.
- [x] Remove duplicate CI execution and make acceptance startup portable.
- [x] Isolate readiness and share immutable fixture inputs with private mutable state.
- [x] Port useful legacy browser coverage and fix card hit testing.
- [x] Add explicit collection, resource, runner timing, and Rust acceptance commands.
- [x] Repair and verify the published manifest.
- [x] Phase D: Keep the audit trail in `artifacts/test-refactors-decisions.tsv`.
- [x] Phase E: Verify and hand back. Run collection, affected suites, type/lint/format checks, and review each note against the actual diff.

## Contract and target structure

Expensive CI suites execute once. Unit readiness uses explicit fixture roots. Immutable inputs may be cached, while mutation tests own fresh writable state. Browser behavior runs through the native IPC fixture. Resource acceptance measures retained heap, workers, or media resources with stated budgets. Timing evidence separates setup, import, and test execution without claiming a speedup from a shared machine.

The existing fixtures and Playwright configurations already provide the required ownership boundaries. Extend those directly instead of introducing a second test framework. Dedicated acceptance commands stay distinct from ordinary unit checks.

## Throughput checkpoint

The browser migration is the largest unknown because the legacy suite targets retired browser persistence. Three scoped delegates inspect and implement independent groups. The coordinator owns CI, runner commands, collection checks, and resource acceptance. No full suite runs concurrently with timing measurements.

## Verification

Local implementation and affected-suite verification are complete. The Linux resource workflow remains unrun. These checks do not constitute a complete `npm run check` execution.

- Baseline collection was 4 native cases in one file and 39 acceptance cases in four files.
- Final collection reports 76 native cases in eight files, 44 acceptance cases in five files, and two resource cases in two files. Nine legacy specs remain explicitly excluded.
- Complete/incomplete readiness, CORE, and catalog clone isolation tests passed. The separate real-checkout readiness gate passed.
- The app/content HTTP boundary passed all five cases. A source-symlink optimization was rejected by the existing containment guard and reverted.
- Offline sources-only setup now regenerates and verifies the runtime manifest. The strict standalone verifier passed afterward.
- The explicit Rust I/O launcher ran both named ignored tests with tracing and one test thread. An empty test selection cannot pass the launcher.
- The production resource and emitted-font cases passed on Windows. A later resource-only run also proved card image URLs were created and decoded before teardown. Linux workflow execution remains pending.
- Collection rejected a temporary uncollected spec and a temporary `test.only` probe. Both probes were removed.
- Integrated typecheck passed with zero errors and four existing Svelte warnings. Full lint and format checks passed.
- After the final native edits, TypeScript, targeted lint/format, runner collection and `git diff --check` passed again. The owner notes, feedback files and frozen vendor tree remain unchanged.
- The final focused unit run passed 59 cases in five files, including fixture isolation, readiness, CORE, command contracts and retained CSS ownership checks.
- The editor geometry and native deck commit recovery ports each passed all four browser projects. The initial 72-case native run passed 66 cases. Six failures exposed test setup mistakes in desktop versus compact card addition, ownership of catalog scrolling, and dismissal of the mobile rotation notice. A focused run passed all eight deck persistence and Worker cases. The corrected scrollbar case then passed all four profiles. Compact layouts scroll the shell region and intentionally hide the catalog overlay; desktop layouts scroll the catalog and show its overlay. All 76 current native cases have passing execution evidence across the full run and focused reruns. This was not a single clean 76-case run.
- Normal visual acceptance initially passed 41 of 42 cases and exposed the badge placement regression caused by scaling artwork separately. The corrected card-list run passed the badge and accessibility cases; an unforced neighbor click then exceeded its custom five-second timeout without interception. Removing that custom timeout preserved the edge clicks and assertions, and the focused case passed.
- Independent review by `gpt-6.1-sol` found a missing rendered field-card reduced-motion check. Added field and hand hover/focus geometry checks; all three rendered-style cases passed.
- The final 44-case acceptance run passed 43 cases. Its remaining case failed before rendering because Chromium reported `ERR_NETWORK_CHANGED` while fetching localhost JavaScript and CSS. That unchanged case then passed on a focused rerun. All 44 current cases have passing execution evidence; the full run was not a clean 44/44 run.

## Decisions shaped by Poteto principles

- Model the Domain. Collection records distinguish actual runner cases from explicitly uncollected legacy files.
- Prove It Works. Collection uses Playwright, resource checks require decoded images before teardown, and ignored Rust acceptance proves both named tests executed.
- Explain the Number. Timing reports separate overlapping worker durations, and local resource evidence is not presented as a Linux result or a pipeline speedup.
- Type System Discipline. New browser instrumentation exposes typed control and capture contracts rather than untyped window properties.

## Browser migration scope

The ports exercise the current native IPC contract. They do not count the nine remaining legacy files as passing coverage.

| Requirement                        | Collected replacement                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Story save and reload              | `native-journeys.spec.ts` saves a specific beat through the UI and loads that exact beat after reload.                                                                   |
| Deck persistence                   | `native-journeys.spec.ts` creates a named deck, adds a card and checks the saved deck after reload.                                                                      |
| Deck commit recovery               | `native-deck-recovery.spec.ts` rejects an edited deck's native commit, preserves local edits as a copy and verifies the copy after reload.                               |
| Worker boundary                    | `native-journeys.spec.ts` captures actual Worker messages, checks concealed hands and checks one response for the selected prompt.                                       |
| Recovery and keyboard control      | `native-recovery.spec.ts` injects a native checkpoint write failure, proves no duel starts and returns to the map, then exercises field fallback and keyboard surrender. |
| Admin reset and portrait input     | `admin-console.spec.ts` and `duel-portrait.spec.ts` use the native fixture.                                                                                              |
| Painted geometry and accessibility | `native-style-matrix.spec.ts`, `native-editor-layout.spec.ts`, `rendered-style-contracts.spec.ts` and the existing field acceptance matrix.                              |
| Fonts and resource lifetime        | The production resource configuration verifies emitted font bytes and measures real duel teardown.                                                                       |

The legacy fixtures retain SQLite-era setup and direct state injection. Their remaining declaration count is not a native coverage count. The new collection guard records those files explicitly and rejects new omissions.

Drag-ghost source assertions remain because the current acceptance harness does not render a drag ghost. The rendered matrix replaces the field, card-list, scrollbar and editor layout checks. Graphify was unavailable on this host, so source inspection used targeted searches; the graph was not refreshed.

## Notes coverage

| Note | Implementation                                                                                                                                                                | Status                                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1    | CI keeps the isolated headless run and invokes only frontend/browser checks afterward.                                                                                        | Verified configuration and command-contract test.                                 |
| 2    | Explicit collection checks and native ports for portrait, admin, persistence, input, Worker and recovery behavior. Production font/resource checks have dedicated collection. | Collection and ported behavior verified; nine legacy files explicitly excluded.   |
| 3    | Cache validated catalog/chapter and frozen vendor inputs. Clone exposed data and write private fixture roots.                                                                 | Isolation, corruption, storage and setup tests pass.                              |
| 4    | Replace painted scrollbar/motion/layout assertions with collected browser cases. Keep architectural token constraints.                                                        | Rendered geometry, focus, colors, motion and responsive scroll checks pass.       |
| 5    | Explicit complete/incomplete roots in unit tests. Real checkout inspection has its own release command and CI step.                                                           | Unit and release checks pass.                                                     |
| 6    | Wait for Vite client compilation with a separate bounded readiness request before forbidden-path probes.                                                                      | All five containment cases pass.                                                  |
| 7    | Retain dynamic referenced-command validation and existing headless launch behavior test.                                                                                      | Both pass; no stale launch literal remains.                                       |
| 8    | Playwright passes acceptance variables through `webServer.env`.                                                                                                               | Windows acceptance startup exercised.                                             |
| 9    | Reporter separates environment, runner setup, setup imports, collection and test/hooks durations.                                                                             | Real runner report verified; no speedup claimed or isolation disabled.            |
| 10   | Resource gate measures Worker lifetimes, image URLs, decoded images and retained main-thread heap across real duels.                                                          | Local Windows pass; Linux workflow pending.                                       |
| 11   | Explicit trace-enabled serialized Rust acceptance command checks exactly the two intended tests ran.                                                                          | Two cases pass.                                                                   |
| 12   | Regenerate stale manifest and repair sources-only producer ordering.                                                                                                          | Offline setup and strict verifier pass.                                           |
| 13   | Remove the unsupported network-isolation claim from the CORE test name.                                                                                                       | Failure-path behavior remains covered.                                            |
| 14   | Preserve unforced neighbor-click regression. Scale noninteractive artwork while keeping target bounds stable.                                                                 | Unforced clicks pass in both directions; normal and reduced-motion geometry pass. |

The owner requested landing this implementation on `main`. The checkout is already on that branch, so the changes land as a direct commit under the repository's single-trunk policy. No pull request is involved.

## Recovery coverage and remaining limitation

The native checkpoint failure port intentionally asserts fail-closed behavior and return to the map; it does not claim retry succeeds. A focused browser run found that retrying after `STORAGE_CONFLICT` keeps returning to the handoff error. `JsonUserDataStore.#commit` publishes the candidate record into memory and retains it as pending before the native write (`src/storage/json/user-data-store.ts:334`). The failed native commit leaves that checkpoint at revision 1 in memory, while `HandoffCoordinator.begin` retains `ownedRevision` at 0 after the failed write (`src/shell/handoff/handoff-coordinator.ts:148`). A retry therefore expects no record against the already-published in-memory record and fails before it can commit. The failed run's Playwright error context is `generated/tests/native-recovery/native-recovery-failed-nat-ffd97-s-the-encounter-recoverable-chromium-desktop/error-context.md`.

The legacy editor test injects a record-level concurrent update. Advancing the entire native JSON document revision is a different writer conflict and does not model that scenario. Existing lower-level record-conflict coverage remains. The new `native-deck-recovery.spec.ts` instead rejects the actual native commit for an edited deck record, then verifies that preserving local edits as a copy creates a saved deck that survives reload. It targets the deck record's next revision so an earlier autosave-history commit cannot consume the injected failure. All four native projects passed this recovery case (`.tmp/refactor-deck-recovery-targeted.log`).
