# T8 repair — checked; acceptance pending independent review

**Next:** independent reviewer inspect publisher/preparation repair proof below.

## Evidence

- E1. Exact final ticket commands pass: Vitest **101/101**, producer/publisher **47/47**. `artifacts/T8-REPAIR-EVIDENCE/verification-vitest-final.{log,exit}` and `verification-node.{log,exit}`.
- E2. Prior behavior preserved: legacy **220/220**, affected unit **147/147**, progressive storage **126/126**, component/editor **376/376**, final bootstrap **56/56**. One initial regression command named nonexistent `progressive-content-store.test.ts`; corrected command executed actual four progressive suites. No passing-with-no-tests flag.
- E3. Typecheck **0 errors / 4 inherited warnings**; scoped ESLint/Prettier/vendor/diff/index checks pass. Exact commands/exits/log paths: `commands-run.json`; all retained intermediate exits: `all-retained-command-exits.json` under repair evidence.
- E4. Production app/build verification now passes: Shell **95987 / 115000 bytes**. Inherited `118072 > 115000`; intermediate repair `123081 > 115000`; both failures preserved, not hidden. Lazy bootstrap split prevents eager installer/gameplay dependencies. No budget-limit edit; T11 still owns broader delivery/build acceptance.
- E5. Initial snapshot: **2321 regular files**, **2258 unchanged**, **63 intentionally edited/moved**; **44 protected files unchanged**. Complete 76-path repair inventory: `artifacts/T8-REPAIR-EVIDENCE/changed-paths.txt`. Directory symlink `.pi/skills` excluded from regular-file hashing, separately unchanged vs index. No staged files.

## Implemented

- I1. **Publisher B1/B2/E1:** live rights scope includes every declared `playerMetadata.sourceInputs` digest. New `metadata` approval root permits exact normalized repo-relative file+SHA only, never tree/future coverage. Empty provenance fails before transport. Canonical in-memory `inventoryVersion` binds all metadata/rights-influencing fields from CLI approval through publisher entry and every pre-CAS attempt. Upload bytes checked before immutable PUT; full source/semantic/identity verification reruns immediately before each pointer CAS. Manifest/pointer/predecessor/inventory identities must match entry. Fake CLI covers stale predecessor, forged stamp, immutable conflicts, missing provenance, source/semantic/object/pointer mutations, valid replacement candidate, factory/upload provenance changes; exact errors, zero pointer PUTs, opened transport closes once.
- I2. **Publisher B3/B4:** Battle-owned async `validateFrozenBattleExecutable` checks exact frozen vendor manifest SHA-256 and WASM SHA-256 before preparation/pack/verify/publish readiness. Producer hashes the same WASM bytes subsequently parsed, rather than re-reading unchecked bytes. `validateReleaseData` remains synchronous/pure; it does **not** hash bytes. Iterative predecessor verification rejects cycles/equal/increasing sequences, caps complete history at 4096 releases/64 GiB cumulative payload+envelopes, stats object sizes before hash reads. No downloaded migrations, skip, pruning or checkpoint bypass.
- I3. **Preparation B1/B2/N1:** clone/validate/freeze `StagedContent` plus nested `chapterIds` before first awaited read. Returned content is pinned immutable snapshot. Shared four-slot card/map/set read+Blob queue; queued abort exact `DOMException("The operation was aborted.", "AbortError")`. Missing optional bytes remain null. Active URL release centralized; dispose/release revoke once; late disposed reads create no URL. No unused cache.
- I4. **Preparation B3:** `legacy-content.ts` no longer reexports Content types. Content-dependent card adapters, startup, installer sizing/saved refs moved to application/adapters. Shell UI consumes semantic `ShellGameplay`/bootstrap/installer/session/image view models, not raw file/manifest/Content handles. Existing UI markup/layout preserved; installer semantic error copy retained. AST checks cover direct reexport, export-star, renamed import/export, local alias, import-type, multi-hop laundering; model proof excludes raw refs. Legacy compatibility only; T9 activation/save work untouched.
- I5. **Publisher E2:** exhaustive old `5a3ba36:src/content/install/verify-gameplay.ts:1–178` failure inventory, **40 rows**, rightful owner + exact negative tests: `artifacts/T8-REPAIR-EVIDENCE/verifyGameplay-parity.md`. Legacy structural branches remain; direct Story negatives bypass Content parser. Matrix explicitly marks impossible post-parse contentId mismatch rather than pretending branch execution. Final cross-check found required JSON MIME/raw-size parity gap; four RED wrong-MIME/padded >4MiB cases now pass via small Shell pre-read descriptor guard.

## RED evidence accuracy

- R1. Pre-edit RED logs capture invalid/mutable staging, unbounded media, duplicate revoke, wrong executable bytes, denied metadata bypass, unchecked upload bytes, missing history budget API, Content type laundering. `red-*.log` plus `.exit` files preserved.
- R2. Initial fake CLI mutation cases stopped at missing metadata-approval schema. Later isolated replay uses **exact initial publisher/producer source**, reconstructed then SHA-matched to pre-edit snapshot before execution. Four pre-CAS mutation tests and equal-sequence-chain test fail against original source. These are retrospective baseline replays, not mislabeled pre-edit RED.
- R3. Reproduce independently: `python3 artifacts/T8-REPAIR-EVIDENCE/replay-baselines.py`. Original source copies, SHA proof, individual failing logs retained. Replay script expects child exit 1; aggregate exit 0 proves reproduction. No root source mutation.

## Assumptions / approved decisions

- A1. Supervisor approved `metadata` file-only rights schema extension. This approves implementation only, not actual asset rights. Owner approval records unchanged.
- A2. Supervisor approved canonical inventory identity through CLI/publisher to block provenance-only mutations with unchanged published bytes. No on-disk schema change.
- A3. Async executable gate chosen to preserve synchronous pure validator signature, avoid custom SHA implementation/package/vendor changes. Ticket clarified explicitly; Worker frozen-WASM guard remains.
- A4. History limit is verification-work boundary, not releaseSequence ceiling: 4096 releases allow over 11 years daily publication; 64 GiB also charges bounded metadata envelopes and every history payload. Cheap helper tests exercise cap/cap+1 and byte boundary without thousands of WASM copies; real forged equal-sequence/cycle fixtures prove integration. Limit exhaustion fails closed; no authority skipped. Metadata envelope reads retain pre-existing 32 MiB per-file bound.
- A5. T9 remains sole owner of activation/save lifecycle. Current compatibility controller preserves existing install UI behavior. Graph quota prevents graph refresh; no retry attempted.

## Silent-failure / cleanup audit

- S1. No added `|| true`, empty catch, ignored redirected failure or unobserved rejecting Promise. Validation redirects retain exact exit files.
- S2. Optional-media catch maps unreadable optional bytes to null, exact abort rethrown. Legacy installer catch maps semantic rejection to fixed `APP_REQUIRED_INPUT_FAILED` copy; no raw paths/remote text leaked. Existing legacy startup catch retains fail-closed gate behavior.
- S3. Replay scratch removed: `.tmp/T8-repair-replay/{publisher.ts,cli.ts,publisher.test.ts,producer.ts,producer.test.ts}` plus directory. Reusable replay script removes its own UUID scratch in `finally`; source originals/logs remain evidence deliverables. `removed-scratch.txt` records first replay cleanup.
- S4. Initial `artifacts/T8-EVIDENCE/`, review reports, `IMPLEMENTATION-REPORT-T8.md`, feedback, package/vendor files untouched. Initial Content verifier/ESLint diffs remain byte-identical to repair-entry snapshot; not attributed to this repair.

## Open gate

- G1. **Independent acceptance review required.** Inspect B1–B4/E1–E2 publisher, B1–B3/N1 preparation repairs, exact logs, source inventory. No live publish/deploy performed. Ledger/ticket acceptance remains unchecked.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Bounded publisher B1-B4/E1-E2 and preparation B1-B3/N1 repairs implemented. Focused Vitest 101/101, Node 47/47; 40-row old-verifier parity matrix; source snapshot protects unrelated work. Acceptance remains pending independent reviewer."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Initial-source SHA inventory, exact original-source replays, RED/GREEN logs+exit files, commands-run.json, exhaustive changed-paths.txt, parity matrix, quality/vendor/build/no-staging/preservation checks retained under artifacts/T8-REPAIR-EVIDENCE/."
    }
  ],
  "changedFiles": [
    "artifacts/IMPLEMENTATION-LEDGER-T4-through-T11.md",
    "artifacts/IMPLEMENTATION-REPORT-T8-repair.md",
    "artifacts/PLAN_2026_09_13_content_module_rearchitecture/T8_semantic-preparation.md",
    "scripts/lib/asset-delivery/content-publish-cli.ts",
    "scripts/lib/asset-delivery/progressive-history.ts",
    "scripts/lib/asset-delivery/progressive-producer.ts",
    "scripts/lib/asset-delivery/progressive-publisher.ts",
    "scripts/lib/asset-delivery/progressive-semantic-validation.ts",
    "scripts/lib/asset-delivery/publication-approval.ts",
    "src/battle/ports/frozen-battle-executable.ts",
    "src/battle/ports/index.ts",
    "src/shell/AppShell.svelte",
    "src/shell/adapters/installed-card-image-source.ts",
    "src/shell/adapters/installed-editor-catalog.ts",
    "src/shell/adapters/legacy-content-api.ts",
    "src/shell/adapters/progressive-release-data.ts",
    "src/shell/adapters/progressive-release-media.ts",
    "src/shell/admin/AdminConsole.svelte",
    "src/shell/admin/admin-actions.ts",
    "src/shell/application/core-startup.ts",
    "src/shell/application/installer-chapter-sizes.ts",
    "src/shell/application/legacy-content.ts",
    "src/shell/application/legacy-installer.ts",
    "src/shell/application/prepared-release.ts",
    "src/shell/application/saved-content-refs.ts",
    "src/shell/application/shell-bootstrap.ts",
    "src/shell/cards/installed-card-image-source.ts",
    "src/shell/cards/installed-editor-catalog.ts",
    "src/shell/content/content-error-copy.ts",
    "src/shell/content/installer-chapter-sizes.ts",
    "src/shell/content/saved-content-refs.ts",
    "src/shell/core/core-gate.ts",
    "src/shell/core/installed-inputs.ts",
    "src/shell/handoff/handoff-request.ts",
    "src/shell/screens/FreePlayMatchSetup.svelte",
    "src/shell/screens/InstallContentScreen.svelte",
    "src/shell/screens/free-play-deck-listing.ts",
    "src/shell/screens/free-play-opponents.ts",
    "tests/asset-delivery-contracts.test.ts",
    "tests/component/AdminConsole.test.ts",
    "tests/component/AppShell.test.ts",
    "tests/component/FreePlayMatchSetup.test.ts",
    "tests/component/FreePlayUniqueOwner.test.ts",
    "tests/component/MainMenuScreen.test.ts",
    "tests/component/StoryDuelHandoff.test.ts",
    "tests/component/StoryMenuEntry.test.ts",
    "tests/component/collection-image-teardown.test.ts",
    "tests/component/content-installer.test.ts",
    "tests/component/core-menu.test.ts",
    "tests/component/deck-editor/deck-delete-failure.test.ts",
    "tests/component/deck-editor/deck-editor-blocked.test.ts",
    "tests/component/deck-editor/deck-editor-shell.test.ts",
    "tests/component/deck-editor/deck-favourites.test.ts",
    "tests/component/deck-editor/deck-library-order.test.ts",
    "tests/component/deck-editor/deck-migration-error.test.ts",
    "tests/component/deck-editor/deck-ownership-legality.test.ts",
    "tests/component/deck-editor/deck-route.test.ts",
    "tests/component/deck-editor/default-deck.test.ts",
    "tests/component/deck-editor/editor-context.test.ts",
    "tests/component/deck-editor/installed-catalog-boot.test.ts",
    "tests/component/deck-editor/installed-catalog.test.ts",
    "tests/component/deck-editor/installed-image-teardown.test.ts",
    "tests/component/deck-editor/owned-only-catalog.test.ts",
    "tests/component/deck-editor/token-cards.test.ts",
    "tests/component/installed-free-play.test.ts",
    "tests/component/shell-card-image-status.test.ts",
    "tests/fixtures/shell-gameplay.ts",
    "tests/progressive-producer.test.ts",
    "tests/progressive-publisher.test.ts",
    "tests/unit/cards.test.ts",
    "tests/unit/core-gate.test.ts",
    "tests/unit/domain-boundaries.test.ts",
    "tests/unit/installed-card-image-source.test.ts",
    "tests/unit/semantic-release-preparation.test.ts",
    "tests/unit/shell/story-battle-request.test.ts",
    "tests/unit/verify-gameplay-parity.test.ts",
    "artifacts/T8-REPAIR-EVIDENCE/"
  ],
  "testsAddedOrUpdated": [
    "tests/asset-delivery-contracts.test.ts",
    "tests/component/AdminConsole.test.ts",
    "tests/component/AppShell.test.ts",
    "tests/component/FreePlayMatchSetup.test.ts",
    "tests/component/FreePlayUniqueOwner.test.ts",
    "tests/component/MainMenuScreen.test.ts",
    "tests/component/StoryDuelHandoff.test.ts",
    "tests/component/StoryMenuEntry.test.ts",
    "tests/component/collection-image-teardown.test.ts",
    "tests/component/content-installer.test.ts",
    "tests/component/core-menu.test.ts",
    "tests/component/deck-editor/deck-delete-failure.test.ts",
    "tests/component/deck-editor/deck-editor-blocked.test.ts",
    "tests/component/deck-editor/deck-editor-shell.test.ts",
    "tests/component/deck-editor/deck-favourites.test.ts",
    "tests/component/deck-editor/deck-library-order.test.ts",
    "tests/component/deck-editor/deck-migration-error.test.ts",
    "tests/component/deck-editor/deck-ownership-legality.test.ts",
    "tests/component/deck-editor/deck-route.test.ts",
    "tests/component/deck-editor/default-deck.test.ts",
    "tests/component/deck-editor/editor-context.test.ts",
    "tests/component/deck-editor/installed-catalog-boot.test.ts",
    "tests/component/deck-editor/installed-catalog.test.ts",
    "tests/component/deck-editor/installed-image-teardown.test.ts",
    "tests/component/deck-editor/owned-only-catalog.test.ts",
    "tests/component/deck-editor/token-cards.test.ts",
    "tests/component/installed-free-play.test.ts",
    "tests/component/shell-card-image-status.test.ts",
    "tests/fixtures/shell-gameplay.ts",
    "tests/progressive-producer.test.ts",
    "tests/progressive-publisher.test.ts",
    "tests/unit/cards.test.ts",
    "tests/unit/core-gate.test.ts",
    "tests/unit/domain-boundaries.test.ts",
    "tests/unit/installed-card-image-source.test.ts",
    "tests/unit/semantic-release-preparation.test.ts",
    "tests/unit/shell/story-battle-request.test.ts",
    "tests/unit/verify-gameplay-parity.test.ts"
  ],
  "commandsRun": [
    {
      "command": "npx vitest run tests/unit/semantic-release-preparation.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose",
      "result": "failed",
      "summary": "exit 1; Expected RED: staged validation/freeze, media concurrency/revoke, frozen bytes failures."
    },
    {
      "command": "node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts",
      "result": "failed",
      "summary": "exit 1; Expected RED: unapproved metadata accepted; changed upload bytes accepted. Initial CLI mutation cases stopped earlier at missing metadata approval schema; exact baseline replay below isolates pre-CAS defect."
    },
    {
      "command": "node --test tests/progressive-producer.test.ts",
      "result": "failed",
      "summary": "exit 1; Expected RED: history-budget API absent before implementation."
    },
    {
      "command": "npx vitest run tests/unit/domain-boundaries.test.ts --reporter=verbose",
      "result": "failed",
      "summary": "exit 1; Expected RED: legacy-content.ts Content type reexports detected."
    },
    {
      "command": "node --test --test-name-pattern='live rights-approved provenance' tests/progressive-publisher.test.ts",
      "result": "failed",
      "summary": "exit 1; Expected RED: factory/upload provenance mutation accepted."
    },
    {
      "command": "npx vitest run tests/unit/domain-boundaries.test.ts --testNamePattern='Shell installer preserves'",
      "result": "failed",
      "summary": "exit 1; Expected RED: moved installer semantic error copy not preserved; fixed."
    },
    {
      "command": "python3 artifacts/T8-REPAIR-EVIDENCE/replay-baselines.py",
      "result": "passed",
      "summary": "exit 0; Passed reproduction: SHA-matched initial publisher fails 4 new mutation tests; initial producer fails equal-sequence-chain rejection. Expected child exits 1, script exit 0. Retrospective baseline replay, not mislabeled pre-edit execution."
    },
    {
      "command": "npx vitest run tests/unit/semantic-release-preparation.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "exit 0; 97/97 passed."
    },
    {
      "command": "node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts",
      "result": "passed",
      "summary": "exit 0; 47/47 passed."
    },
    {
      "command": "npm run test:legacy",
      "result": "passed",
      "summary": "exit 0; 220/220 passed."
    },
    {
      "command": "npx vitest run tests/unit/verify-gameplay-parity.test.ts tests/unit/cards.test.ts tests/unit/battle-runtime-input.test.ts tests/unit/story/story-release.test.ts tests/unit/story/story-release-adapter.test.ts tests/unit/installed-gameplay.test.ts tests/unit/content-installer.test.ts tests/unit/progressive-content-store.test.ts tests/unit/core-gate.test.ts tests/unit/admin-actions.test.ts tests/unit/installed-free-play.test.ts tests/unit/shell/free-play-opponents.test.ts tests/unit/shell/story-battle-request.test.ts tests/unit/installed-card-image-source.test.ts",
      "result": "passed",
      "summary": "exit 0; 13 existing files, 147/147 passed. progressive-content-store.test.ts path did not exist; corrected full storage command below executes actual tests, 126/126."
    },
    {
      "command": "npx vitest run tests/unit/progressive-storage.test.ts tests/unit/progressive-download.test.ts tests/unit/progressive-manifest.test.ts tests/unit/progressive-release.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "exit 0; 4 files, 126/126 passed."
    },
    {
      "command": "npx vitest run tests/component/AppShell.test.ts tests/component/FreePlayMatchSetup.test.ts tests/component/StoryMenuEntry.test.ts tests/component/StoryDuelHandoff.test.ts tests/component/core-menu.test.ts tests/component/shell-card-image-status.test.ts tests/component/collection-image-teardown.test.ts tests/component/deck-editor tests/component/content-installer.test.ts tests/component/AdminConsole.test.ts tests/component/FreePlayUniqueOwner.test.ts tests/component/MainMenuScreen.test.ts tests/component/installed-free-play.test.ts",
      "result": "passed",
      "summary": "exit 0; 66 files, 376/376 passed. Prior focused batch had lazy-import timing failure; await module before ownership assertion, unchanged assertion."
    },
    {
      "command": "npx vitest run tests/component/AppShell.test.ts tests/component/core-menu.test.ts tests/component/content-installer.test.ts tests/unit/core-gate.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "exit 0; 56/56 passed after lazy bootstrap split."
    },
    {
      "command": "npm run typecheck",
      "result": "passed",
      "summary": "exit 0; 0 errors; 4 inherited Svelte/CSS warnings."
    },
    {
      "command": "node artifacts/T8-REPAIR-EVIDENCE/scoped-quality.mjs",
      "result": "passed",
      "summary": "exit 0; Scoped ESLint and Prettier pass; exact expanded argv emitted in log, path inventory retained."
    },
    {
      "command": "npm run vendor:verify",
      "result": "passed",
      "summary": "exit 0; ocgcore-wasm 0.1.2, 21 files verified."
    },
    {
      "command": "npm run build:app",
      "result": "passed",
      "summary": "exit 0; Initial repair build passed before lazy split."
    },
    {
      "command": "npm run build:verify",
      "result": "failed",
      "summary": "exit 1; Intermediate failed: Error: shell initial JavaScript exceeds its production budget: 123081 > 115000 bytes. Inherited pre-repair value was 118072 > 115000; limit unchanged."
    },
    {
      "command": "npm run build:app",
      "result": "passed",
      "summary": "exit 0; Final lazy-boundary app build passed."
    },
    {
      "command": "npm run build:verify",
      "result": "passed",
      "summary": "exit 0; Passed: shell 95987, Worker 139056, Battle 317777, Deck Editor 175480, Story 171170 bytes. No budget-limit edit."
    },
    {
      "command": "python3 artifacts/T8-REPAIR-EVIDENCE/check-preservation.py",
      "result": "passed",
      "summary": "exit 0; 2321 initial regular files: 2258 unchanged, 63 intentionally changed/moved; 44 protected initial evidence/vendor/package/feedback files unchanged; no staged files."
    },
    {
      "command": "git diff --check",
      "result": "passed",
      "summary": "exit 0; Passed."
    },
    {
      "command": "git diff --cached --quiet",
      "result": "passed",
      "summary": "exit 0; Passed; index empty."
    },
    {
      "command": "git diff --check && git diff --cached --quiet && git diff --exit-code -- vendor/ package.json package-lock.json",
      "result": "passed",
      "summary": "exit 0; Passed; no vendor/package/index delta."
    },
    {
      "command": "graphify . --update",
      "result": "not-run",
      "summary": "Known graph backend quota; user forbids retry. No graph query/update attempted."
    },
    {
      "command": "npx vitest run tests/unit/semantic-release-preparation.test.ts --testNamePattern='required JSON descriptor' --reporter=verbose",
      "result": "failed",
      "summary": "exit 1; Expected RED: four wrong-MIME/padded >4MiB JSON fixtures accepted before pre-read guard."
    },
    {
      "command": "npx vitest run tests/unit/semantic-release-preparation.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "exit 0; 101/101 passed, including required JSON MIME/raw-byte-cap parity."
    },
    {
      "command": "npm run typecheck",
      "result": "passed",
      "summary": "exit 0; 0 errors, 4 inherited warnings."
    },
    {
      "command": "node artifacts/T8-REPAIR-EVIDENCE/scoped-quality.mjs",
      "result": "passed",
      "summary": "exit 0; Scoped lint/format pass after final JSON descriptor repair."
    }
  ],
  "validationOutput": [
    "Focused Vitest: 101 passed. Producer/publisher: 47 passed.",
    "Legacy Node: 220 passed. Unit regressions: 147 passed. Progressive storage: 126 passed.",
    "Component/editor: 376 passed. Post-split bootstrap: 56 passed.",
    "Typecheck: 0 errors, 4 inherited warnings. Scoped ESLint/Prettier, vendor verification, diff/index checks passed.",
    "Final production build/budget checks pass; shell 95987 < unchanged 115000.",
    "Initial evidence/source preservation: 2258/2321 initial regular files byte-identical; remaining 63 initial files intentionally edited/moved; 44 protected files unchanged."
  ],
  "residualRisks": [
    "Independent acceptance review still required; T9 activation/save lifecycle unchanged.",
    "No live endpoint, deployment, publication, real credentials or rights approvals exercised; production rights/config/credentials still gate transport.",
    "Graph remains stale because known quota; retry prohibited.",
    "History verification intentionally fails closed beyond 4096 releases or 64 GiB cumulative declared payload+envelope work. No silent pruning/checkpoint/skip; expanding history support requires separately reviewed direction.",
    "T11 retains wider delivery/build acceptance ownership. Inherited budget failure no longer reproduces after lazy boundary split; limits unchanged."
  ],
  "noStagedFiles": true,
  "diffSummary": "76 intentional source/test/tracking/report paths relative to repair-entry snapshot, plus repair evidence. Content-dependent legacy impl moved into application/adapters; UI markup/layout not redesigned. Immutable publication now binds rights-approved inventory and rechecks immediately before CAS; optional media pinned/bounded; frozen executable gate async and explicit.",
  "reviewFindings": [
    "No known in-scope implementation blocker remains; independent reviewer must verify repairs before acceptance.",
    "Synchronous validateReleaseData deliberately validates semantics only; async Battle-owned validateFrozenBattleExecutable checks exact frozen manifest/WASM in preparation and producer/publisher paths.",
    "Initial CLI RED mutation cases were preempted by absent metadata schema; exact SHA-matched initial publisher replay later reproduces all four missing pre-CAS rejections. No false RED-first claim for retrospective replay."
  ],
  "manualNotes": "Sole writer; no subagents/staging/commits/push/live endpoints/deploy/package/vendor/budget-limit changes. Initial T8 report/reviews/evidence and unrelated dirty work preserved. Scratch replay files removed; paths in removed-scratch.txt. Next: independent reviewer opens this report and checks publisher/preparation findings."
}
```
