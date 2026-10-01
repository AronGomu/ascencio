# Remote issue resolution — 2026-10-01

Baseline: `f235e9499fd616599d85a025a3ccc1d48f88b988` on `main`. All 25 open GitHub issues inspected, including existing discussions and current implementation. Three read-only review agents; primary agent sole writer.

## Assumptions and owner decisions

A1. Existing unrelated workspace documentation, images and artifacts remain untouched. ADR-104 is pending architecture, not shipped behavior.

A2. Owner confirmed packs 100 DP and roughly 20 DP expected pack resale: Common 1, Rare 2, Super Rare 5, Ultra Rare 20, all special tiers 50 DP. One-DP tolerance (<=21) preserves ordinary boosters. Nine-card draws are unchanged. Singles retain the existing four-times ladder multiplier.

A3. Existing collection quantities remain unchanged; their displayed resale values follow the new ladder. All installed printing provenance remains intact. Runtime pack projection folds duplicate printing rows. In the measured 75-set Chapter 1 input, 22 sets remain eligible.

## Issue dispositions

| Issue | Disposition | Evidence / resolution |
|---|---|---|
| [#1](https://github.com/AronGomu/ascencio/issues/1) | Repaired | Ignore native Rust build output in ESLint; format/lint/typecheck pass. |
| [#2](https://github.com/AronGomu/ascencio/issues/2) | Repaired | Serialize create/delete preconditions, require the exact accepted deck, preserve rollback and idempotent deletion; repository tests pass. |
| [#3](https://github.com/AronGomu/ascencio/issues/3) | Discarded: obsolete | Obsolete after the native content migration. The unversioned Cache Storage loader no longer exists; StoryApp constructs shop data from the installed chapter release. No browser cache repair is applicable. Source: `src/story/StoryApp.svelte`, `src/story/shop/data/shop-set-data.ts`. |
| [#4](https://github.com/AronGomu/ascencio/issues/4) | Repaired | Packs 100 DP; resale 1/2/5/20/50 DP; native base-printing fold; expected resale <=21 DP eligibility, including cross-set valuations. |
| [#5](https://github.com/AronGomu/ascencio/issues/5) | Repaired | Retain explicit-request download gate, restore success notice, replace retired IndexedDB test expectations. |
| [#6](https://github.com/AronGomu/ascencio/issues/6) | Discarded: obsolete | Obsolete after replacement of the IndexedDB deck repository with injected native user-data services. Current startup refusal coverage verifies an error screen and zero legacy IndexedDB opens/deletions. Source: `src/decks/deck-repository-context.ts`, `tests/component/deck-editor/deck-editor-blocked.test.ts`. |
| [#7](https://github.com/AronGomu/ascencio/issues/ 7) | Validated: already resolved | Verified the existing 300-card result ceiling, refinement notice and sentinel removal. Focused result-window/component tests pass. The historical spent-copies implementation has since changed; closure is based on current bounded rendering and regression coverage. Source: `src/deck-editor/layout/result-window.ts`, `src/deck-editor/components/CardCatalog.svelte`. |
| [#8](https://github.com/AronGomu/ascencio/issues/8) | Validated: already resolved | Verified current scoped card/prompt identifiers. Rendered-document data-cy uniqueness tests pass for catalog, deck zones and field/workspace prompt mounts. Source: `tests/unit/data-cy-coverage.test.ts`, `src/deck-editor/components/CardTile.svelte`. |
| [#9](https://github.com/AronGomu/ascencio/issues/9) | Validated: already resolved | Verified current recursive format globs and TypeScript inclusion of scripts, tests and nested E2E suites. TypeScript listFilesOnly includes the acceptance specs and config; typecheck passes with zero errors. Source: `package.json`, `tsconfig.json`. |
| [#10](https://github.com/AronGomu/ascencio/issues/10) | Validated: already resolved | Verified separate application and acceptance output directories. Fresh native production build passes its verifier, including single-entry and no-acceptance-harness checks. Source: `vite.config.ts`, `playwright.acceptance.config.ts`, `scripts/verify-native-build.ts`. |
| [#11](https://github.com/AronGomu/ascencio/issues/11) | Validated: already resolved | Verified mandatory 10% domain headroom in the native build verifier, called by build and aggregate browser checks. Fresh npm run build passes. Source: `scripts/verify-native-build.ts`, `package.json`. |
| [#12](https://github.com/AronGomu/ascencio/issues/12) | Validated + regression | Player-slot allow-list retained; added checkpoint-only native-repository menu regression. |
| [#13](https://github.com/AronGomu/ascencio/issues/13) | Validated: already resolved | Spread-before-slice optimization remains in appendDuelLog. Existing log-contract tests pass. Independent local benchmark measured about 9.57 microseconds per capped append; timing is machine-dependent, not a committed threshold. Source: `src/battle/app/stores/duel-store.ts`, `tests/unit/duel-store.test.ts`. |
| [#14](https://github.com/AronGomu/ascencio/issues/14) | Validated: already resolved | Reproducible-build outputs now live under generated/build/reproducible-a and generated/build/reproducible-b. git check-ignore confirms both are covered by generated/. Source: `scripts/verify-reproducible-build.ts`, `.gitignore`. |
| [#15](https://github.com/AronGomu/ascencio/issues/15) | Validated: already resolved | Verified corrected privacy exception, battle directory inventory, context paths and explicit divergent-checklist notice. Agent-document and domain-boundary tests pass. Owner-authored feedback and existing documentation work were preserved. Source: `AGENTS.md`, `tests/unit/agents-doc-trunk.test.ts`, `tests/unit/domain-boundaries.test.ts`. |
| [#16](https://github.com/AronGomu/ascencio/issues/16) | Validated + test repair | Streamed 8MiB caps and tracked pins retained; point image-lock tests at current package-owned assets. |
| [#17](https://github.com/AronGomu/ascencio/issues/17) | Validated: already resolved | Existing board memo is keyed by snapshot, card text and prompt identity. The AppBoardMapping counter regression passes, and DuelField passes 201 component tests. Source: `src/battle/app/App.svelte`, `tests/component/AppBoardMapping.test.ts`. |
| [#18](https://github.com/AronGomu/ascencio/issues/18) | Validated: already resolved | Already fixed in 8c4380e9 and retained: blocked admin operations produce an error, never Cleared. Current AdminConsole/admin-action component tests pass; original IndexedDB deletion path is retired. Source: `src/shell/screens/AdminConsole.svelte`, `tests/component/AdminConsole.test.ts`. |
| [#19](https://github.com/AronGomu/ascencio/issues/19) | Validated + test repair | Dead supportedCodes surface already removed; replace retired bundled-preset assertions with native ownership expectations. |
| [#20](https://github.com/AronGomu/ascencio/issues/20) | Validated: already resolved | Already fixed in 8142a7de: one ACCEPTANCE_SCENARIO_IDS tuple derives both union and membership set. Runtime tests pass; an in-memory TypeScript mutation removing card-list-stale rejects a retained typed consumer. Source: `src/battle/app/acceptance/acceptance-scenario.ts`, `tests/unit/acceptance-scenario.test.ts`. |
| [#21](https://github.com/AronGomu/ascencio/issues/21) | Validated: already resolved | Already fixed in eea29eb4. git ls-files playwright-report returns no tracked files. Current acceptance HTML reports are explicitly generated under ignored generated/tests, which CI archives. Source: `playwright.acceptance.config.ts`, `.github/workflows/ci.yml`. |
| [#22](https://github.com/AronGomu/ascencio/issues/22) | Validated: already resolved | Already fixed in 07ef4660: assets:verify chains assets:images:verify. Current aggregate verification passes, reporting 14,794 catalog images, 14,579 archived images, 215 unavailable upstream and zero failures. Tracked image-pin regression coverage also verifies rejection of changed bytes. Source: `package.json`, `scripts/verify-images.ts`, `tests/unit/image-content-lock.test.ts`. |
| [#23](https://github.com/AronGomu/ascencio/issues/23) | Validated: already resolved | Original correction shipped in ca1f428c. Current durable checklist no longer contains the retired T14-T17 steps or the stale free-play menu / Start a match instructions. No unrelated checklist history was rewritten for this review. Source: `artifacts/manual_test_checklist.md`. |
| [#24](https://github.com/AronGomu/ascencio/issues/24) | Repaired | Vitest/coverage 4.1.11 and compatible transitive updates; clean npm ci and audit report zero vulnerabilities. |
| [#25](https://github.com/AronGomu/ascencio/issues/25) | Validated: already resolved | Already fixed in 1e01ddc7. ZoneListEntryTile chooses the placeholder for visible identity and card back for concealed identity. Both explicit null-image-library regressions in ZoneListDialog pass. Source: `src/battle/app/components/duel-field/ZoneListEntryTile.svelte`, `tests/component/ZoneListDialog.test.ts`. |

## Validation

All commands used Node 26 through `mise exec node@26 --` after detecting the shell default was Node 24.

V1. Fourteen directly affected unit/component files: **192 passed**.

V2. Ten additional issue regression suites: **409 passed** (caps/pins, scenario registry, boundaries, data-cy, board mapping, field, zone lists, admin and native freeplay inputs).

V3. Generator acquisition regression: **1 passed**, after replacing its obsolete fetch mock with a real Response.

V4. `npm ci`, `npm audit --package-lock-only`: **zero vulnerabilities**. Vitest and coverage minima 4.1.11 are kept aligned.

V5. `npm run build`: **passed**, including native package exclusions and mandatory domain budget headroom. `npm run format:check`, `npm run lint`, `npm run typecheck`: **passed**; Svelte reports 4 existing warnings and zero errors.

V6. `npm run assets:verify`: **passed**. Independent review confirmed all 1,627 full and 1,627 cropped image pins; one-byte mutations fail validation.

V7. Independent correctness review: no blocking findings. All 784 ordered printing pairs match acquisition/runtime fold policies.

## Aggregate check limitations

The full repository baseline is not green. Before repairs, unit results were 41 failed / 2864 passed / 7 skipped across 26 failed files. After issue repairs, the broad run reported 28 failed / 2882 passed / 7 skipped across 21 failed files; one of these (generator Response mock) was then repaired and its focused rerun passed. Broad tests were not rerun solely to alter the summary count.

`npm run check:headless` passes formatting, lint and typecheck, then stops at four pre-existing legacy failures (104 tests pass):

L1. `tests/content-browser-run.test.ts`: missing/unsafe CONTENT_RUN legacy preflight expectations.

L2. `tests/mvp-assets.test.ts`: CI source-acquisition ordering expectation.

L3. `tests/vite-config.test.ts`: expected only `**/.tmp/**`, while the current watcher also ignores generated/native outputs.

Broader Story suites report 694 passing tests, three pre-existing StoryMenuEntry failures and one pre-battle fixture suite error. No physical-device acceptance or full browser E2E run is claimed.

Remaining broad-unit failing cases (captured after repairs, before the generator mock repair):

F1. ` tests/unit/content-setup-authoring.test.ts [ tests/unit/content-setup-authoring.test.ts ]`

F2. ` tests/unit/duel-rules-profile.test.ts > bundled Chapter 1 pair matrix`

F3. ` tests/unit/decks/ownership-validation.test.ts > the granted starter deck`

F4. ` tests/unit/decks/packaged-catalog.test.ts [ tests/unit/decks/packaged-catalog.test.ts ]`

F5. ` tests/unit/decks/starter-deck.test.ts > the bundled starter list`

F6. ` tests/unit/story/pre-battle-decks.test.ts > a brand-new save's first encounter`

F7. ` tests/unit/active-image-manifest.test.ts > active image manifest > manifest covers every code of every bundled deck`

F8. ` tests/unit/active-image-manifest.test.ts > active image manifest > manifest has no missing images for the bundled decks`

F9. ` tests/unit/chapter-one-decks.test.ts > Chapter 1 bundled prerequisites > browser and Node adapters expose only two new decks, never legacy IDs or their exclusive reviewed codes`

F10. ` tests/unit/chapter-one-decks.test.ts > Chapter 1 bundled prerequisites > each active deck is exact 40/0/0, source-selected, buildable and runtime-supported under current quantities`

F11. ` tests/unit/chapter-one-decks.test.ts > Chapter 1 bundled prerequisites > legacy new-game and new-library starter agree; all three personas explicitly use DM practice`

F12. ` tests/unit/chapter-source-policy.test.ts > Chapter 1 source normalization > retains every included printing in the exact approved 75-set, 1627-code pool`

F13. ` tests/unit/chapter-source-policy.test.ts > Chapter 1 source normalization > rejects unapproved correction: extra alias`

F14. ` tests/unit/chapter-source-policy.test.ts > Chapter 1 source normalization > rejects unapproved correction: duplicate conflicting alias`

F15. ` tests/unit/chapter-source-policy.test.ts > Chapter 1 source normalization > rejects unapproved correction: malformed code`

F16. ` tests/unit/chapter-source-policy.test.ts > Chapter 1 source normalization > rejects unapproved correction: unknown key`

F17. ` tests/unit/content-setup.test.ts > content setup > source copy and approved policy remain explicit incomplete inputs`

F18. ` tests/unit/create-node-runtime.test.ts > Node runtime package-owned sources > loads normalized catalog/scripts, derived manifest and duel-core strings without hosted originals`

F19. ` tests/unit/deck-parser.test.ts > YDK parsing > loads the exact locked MVP matchup`

F20. ` tests/unit/deck-sources-node.test.ts > bundled deck sources > loadDeckSources returns one source per catalog entry`

F21. ` tests/unit/deck-sources-node.test.ts > bundled deck sources > browser and Node source adapters contain identical text per id`

F22. ` tests/unit/deck-sources-node.test.ts > bundled deck sources > every bundled deck parses and validates against its constraints`

F23. ` tests/unit/deck-sources-node.test.ts > bundled deck sources > no bundled deck runs more than three copies of a card`

F24. ` tests/unit/generate-shop-sets.test.ts > writes acquired shop sets only to package-owned authoring`

F25. ` tests/unit/programmed-scenarios.test.ts > programmed integration specification > requires executed evidence for every supported coverage row`

F26. ` tests/unit/programmed-scenarios.test.ts > programmed integration specification > keeps deterministic inputs explicit and non-zero`

F27. ` tests/unit/programmed-scenarios.test.ts > programmed integration specification > identifies executable transcripts separately from planned scenarios`

F28. ` tests/unit/reviewed-card-pool.test.ts > reviewed card pool > pool of the real Chapter 1 decks has 16 codes`

F29. ` tests/unit/reviewed-card-pool.test.ts > reviewed card pool > every bundled deck code is in the pool`

F30. ` tests/unit/semantic-release-preparation.test.ts > retained pure release semantic validation > owned negative parity: story content identity mismatch`

F31. ` tests/unit/shell/free-play-deck-tiles.test.ts > freePlayDeckTile > describes an immutable installed chapter deck an AI owns`

F32. ` tests/unit/storage/manual-content-safety.test.ts > manual lifecycle composition safety > remount only subscribes and refreshes persistent controller; conflicts disable native controls`

F33. ` tests/unit/storage/new-game-independence.test.ts > New Game independence > loads authoritative accepted packages read-only under an acquired generation lease`

F34. ` tests/unit/storage/storage-client-close.test.ts > SQLite storage client close > terminates injected transport when close RPC rejects while preserving error`

## Residual outside the original issue scope

R1. Singles are purchased at a selected printing tier while collection resale resolves the highest installed tier for a code. The existing cross-set singles valuation mismatch remains; pack eligibility accounts for cross-set resale and does not have that mismatch.

R2. Graphify semantic refresh requires an unavailable LLM API key. Code-only incremental refresh succeeded (313 files); documentation/image semantic refresh remains pending. It reported an existing Svelte-parser partial-extraction warning.

## Manual acceptance

Three new unchecked owner steps are appended to `artifacts/manual_test_checklist.md` for pricing, unavailable promo packs and explicit diagnostics downloads. Existing feedback files and unrelated owner work remain unchanged.
