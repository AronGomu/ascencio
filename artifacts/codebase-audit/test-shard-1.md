# Test shard 1 audit

## Review

- R1. **Done:** 58/58 assigned files FULL; 16,224 lines. Every source read chunk ≤300 lines; continued through EOF.
- R2. **Finding F1 — P3:** SW ordering assertion compares import position, not approval check.
- R3. **Correct:** production SW currently checks approval before precache installation (`src/service-worker.ts:30–39`). Finding concerns regression oracle, not existing production bypass.
- R4. **Fixed:** none. No edits, tests, probes, commits, staging, subagents.
- R5. **Blocker:** none confirmed. No additional source-confirmed runtime defects.
- R6. **Output:** read-only constraint overrides writes. Report returned for runtime persistence at `/home/aron/Projects/ascencio/artifacts/codebase-audit/test-shard-1.md`.

## Assumptions

- A1. Scope: shard `id: 1` from `artifacts/codebase-audit/remaining-test-shards.json`; inventory frozen at `26da126`, current working bytes reviewed.
- A2. “Source-confirmed” means static trace establishes defect. Mutation/regression execution prohibited.
- A3. `plan.md`, `progress.md` absent. AGENTS read. Graph query failed: `/bin/bash: line 1: graphify: command not found`. Direct inspection substituted.
- A4. Known Node26 JSDOM storage, fixture cleanup, CRC oracle, stale validation envelope, six remaining-source UI findings excluded. Ledger, prior test audits, source-audit findings consulted; report search found no F1 duplicate.

## F1 — P3: SW approval-order assertion measures import position

**Evidence:** `tests/unit/core-update-approval.test.ts:80–93`; `src/service-worker.ts:4,30–39`.

Existing ordering assertion:

```ts
expect(source.indexOf("readCoreApproval")).toBeLessThan(
  source.indexOf("await precache.install(event)"),
);
```

First `"readCoreApproval"` occurrence belongs import at `src/service-worker.ts:4`. Actual awaited approval read occurs at `:31`; refusal guard ends at `:37`.

**Source-derived false-green trace:** move `await precache.install(event)` before approval guard inside install callback → import remains earlier → ordering assertion still passes. Other assertions only require existing strings or forbid unrelated APIs, so remain satisfied.

**Impact:** test explicitly claims approval-before-precache protection without checking executable ordering. Regression could download/cache candidate shell before consent rejection. Current production ordering correct.

**Minimal correction:** compare complete executable call sites within install callback, including refusal guard before installation; reject missing matches explicitly. Prefer behavioral install-handler assertion: pending/absent approval → zero precache calls; matching approval → one call.

**Minimal regression:** reorder installation before approval guard in temporary mutation → corrected check fails; restore production ordering → passes. Mutation not executed.

**Next action:** test owner corrects assertion, validates mutation plus focused suite:

```sh
npx vitest run --maxWorkers=1 tests/unit/core-update-approval.test.ts
```

## Revision checks

- V1. Initial/final observed HEAD identical: `0bbe94e6115221e98a2d505c1e69241c066cde57`.
- V2. Assigned-path diff against initial HEAD empty; scoped working status empty. No integrations changed assigned files during review.
- V3. Five assigned files differ from frozen inventory commit. Current bytes fully read; final diffs inspected:

| ID | File | Integrated change |
|---|---|---|
| D1 | `tests/component/DuelField.test.ts` | Removes obsolete aggregate-unselect expectation |
| D2 | `tests/component/deck-editor/deck-route.test.ts` | Draft preservation, host route-echo regressions |
| D3 | `tests/component/deck-editor/installed-catalog-boot.test.ts` | Installed-art lease replacement/unmount regression |
| D4 | `tests/component/deck-select/deck-tile-menu.test.ts` | Viewport clamping regression |
| D5 | `tests/unit/interaction-session.test.ts` | Authoritative toggle response regression |

- V4. `git diff --cached --name-only` empty. Existing unrelated dirty work preserved; no repo-wide clean claim.
- V5. Static manifest/current-line inventory confirms 58 files, 16,224 lines; every current EOF matches assigned end.

## Coverage ledger

Every row FULL through EOF. PARTIAL: none. UNREAD: none within shard 1.

| ID | Path | Status | Read range |
|---|---|---|---|
| C1 | `tests/component/AdminConsole.test.ts` | FULL | 1–226 |
| C2 | `tests/component/CardControl.test.ts` | FULL | 1–281 |
| C3 | `tests/component/DuelField.test.ts` | FULL | 1–5620 |
| C4 | `tests/component/PhaseBar.test.ts` | FULL | 1–208 |
| C5 | `tests/component/PromptContextMessage.test.ts` | FULL | 1–82 |
| C6 | `tests/component/PromptControls.test.ts` | FULL | 1–524 |
| C7 | `tests/component/PromptDialog.test.ts` | FULL | 1–109 |
| C8 | `tests/component/StackControl.test.ts` | FULL | 1–130 |
| C9 | `tests/component/deck-editor/card-catalog.test.ts` | FULL | 1–103 |
| C10 | `tests/component/deck-editor/catalog-index-wiring.test.ts` | FULL | 1–146 |
| C11 | `tests/component/deck-editor/deck-library-toolbar.test.ts` | FULL | 1–85 |
| C12 | `tests/component/deck-editor/deck-migration-error.test.ts` | FULL | 1–76 |
| C13 | `tests/component/deck-editor/deck-route.test.ts` | FULL | 1–243 |
| C14 | `tests/component/deck-editor/installed-catalog-boot.test.ts` | FULL | 1–154 |
| C15 | `tests/component/deck-editor/owned-only-catalog.test.ts` | FULL | 1–277 |
| C16 | `tests/component/deck-select/deck-tile-menu.test.ts` | FULL | 1–211 |
| C17 | `tests/component/deck-select/mobile-layout.test.ts` | FULL | 1–159 |
| C18 | `tests/component/story/NarrativeScreen.test.ts` | FULL | 1–264 |
| C19 | `tests/component/story/StoryApp.test.ts` | FULL | 1–672 |
| C20 | `tests/component/story/StoryOverlays.test.ts` | FULL | 1–235 |
| C21 | `tests/component/story/booster-reveal.test.ts` | FULL | 1–294 |
| C22 | `tests/component/story/shop-set-tiles.test.ts` | FULL | 1–165 |
| C23 | `tests/unit/admin-actions.test.ts` | FULL | 1–183 |
| C24 | `tests/unit/browser-runtime-assets.test.ts` | FULL | 1–317 |
| C25 | `tests/unit/card-image-cache.test.ts` | FULL | 1–459 |
| C26 | `tests/unit/chapter-gameplay.test.ts` | FULL | 1–331 |
| C27 | `tests/unit/chapter-one-decks.test.ts` | FULL | 1–227 |
| C28 | `tests/unit/content-recovery.test.ts` | FULL | 1–193 |
| C29 | `tests/unit/content-setup-files.test.ts` | FULL | 1–419 |
| C30 | `tests/unit/core-content-transport.test.ts` | FULL | 1–121 |
| C31 | `tests/unit/core-precache.test.ts` | FULL | 1–124 |
| C32 | `tests/unit/core-update-approval.test.ts` | FULL | 1–95 |
| C33 | `tests/unit/deck-catalog.test.ts` | FULL | 1–46 |
| C34 | `tests/unit/deck-select/order-deck-tiles.test.ts` | FULL | 1–116 |
| C35 | `tests/unit/decks/card-ownership.test.ts` | FULL | 1–60 |
| C36 | `tests/unit/decks/catalog-fixture.test.ts` | FULL | 1–32 |
| C37 | `tests/unit/decks/deck-buildable-cards.test.ts` | FULL | 1–23 |
| C38 | `tests/unit/decks/deck-resolver-integration.test.ts` | FULL | 1–39 |
| C39 | `tests/unit/decks/deck-validation.test.ts` | FULL | 1–142 |
| C40 | `tests/unit/decks/packaged-catalog.test.ts` | FULL | 1–97 |
| C41 | `tests/unit/drop-target.test.ts` | FULL | 1–139 |
| C42 | `tests/unit/duel-rail-status.test.ts` | FULL | 1–102 |
| C43 | `tests/unit/duel-seed.test.ts` | FULL | 1–22 |
| C44 | `tests/unit/installed-battle-images.test.ts` | FULL | 1–256 |
| C45 | `tests/unit/interaction-session.test.ts` | FULL | 1–383 |
| C46 | `tests/unit/message-classification.test.ts` | FULL | 1–49 |
| C47 | `tests/unit/ocgcore-adapter.test.ts` | FULL | 1–206 |
| C48 | `tests/unit/off-field-target-list.test.ts` | FULL | 1–355 |
| C49 | `tests/unit/perspective.test.ts` | FULL | 1–12 |
| C50 | `tests/unit/placement-candidates.test.ts` | FULL | 1–175 |
| C51 | `tests/unit/presentation-command.test.ts` | FULL | 1–195 |
| C52 | `tests/unit/progressive-storage.test.ts` | FULL | 1–611 |
| C53 | `tests/unit/shell/session-saves.test.ts` | FULL | 1–71 |
| C54 | `tests/unit/snapshot-copy-plan.test.ts` | FULL | 1–35 |
| C55 | `tests/unit/story-save-presence.test.ts` | FULL | 1–108 |
| C56 | `tests/unit/story/story-playback-settings.test.ts` | FULL | 1–90 |
| C57 | `tests/unit/story/story-playback.test.ts` | FULL | 1–60 |
| C58 | `tests/unit/story/story-read-log.test.ts` | FULL | 1–67 |

## Residual risks

- U1. Static review only. No test pass, browser acceptance, mutation result asserted.
- U2. Supporting src reads targeted; no exhaustive runtime-source re-audit claimed.
- U3. Other shards outside assignment. Known active fixes excluded, not independently accepted.
- U4. F1 remains unfixed; exact next action recorded above.