# Test shard 2 audit

## Review

- R1. **Done:** 57/57 assigned ranges FULL; **16,213 lines**. Every assigned read ≤300 lines; continued through EOF.
- R2. **Findings:** F1 P2 stale assertion; F2 P2 false-green perf gate; F3 P3 false-green teardown assertion.
- R3. **Correct:** conflict regression preserves unsaved draft (`tests/component/deck-editor/deck-save-conflict.test.ts:37–45`). Streaming regressions assert bounded pulls, cancellation, unlocked body (`tests/unit/progressive-response.test.ts:55–98`).
- R4. **Fixed:** none. No edits, tests, probes, commits, staging, subagents.
- R5. **Blocker:** resolve F1 before component-suite acceptance; resolve F2/F3 before relying on claimed perf/teardown evidence.
- R6. **Output:** READ ONLY overrides artifact writes. Runtime persistence destination: `/home/aron/Projects/ascencio/artifacts/codebase-audit/test-shard-2.md`. Path absent at final check.

## Assumptions

- A1. Inventory exactly shard `id: 2`, `inventoryCommit: "26da126"`, from `artifacts/codebase-audit/remaining-test-shards.json`; current working bytes reviewed.
- A2. Findings source-confirmed; failure traces below **not executed**.
- A3. `plan.md`, `progress.md` absent. AGENTS read. Graph-first attempt failed: `/bin/bash: line 1: graphify: command not found`. Static inspection substituted.
- A4. Prior ledger, initial audits, remaining-source reports, test audits consulted. Known Node26 storage, producer/publisher cleanup, CRC, validation-envelope, six UI findings excluded.
- A5. F1 concerns missed test update after accepted Decks F4 fix—not duplicate product defect.

## F1 — P2: ownership assertion contradicts integrated repair behavior

**Evidence:** `tests/component/deck-editor/editor-import.test.ts:168–196`; `src/deck-editor/components/DeckZoneGrid.svelte:234–247`; `src/deck-editor/components/CardTile.svelte:10–11,71–74`.

Test renders deck containing unowned card, requires:

```ts
expect(tile?.disabled).toBe(true);
```

Integrated grid passes `unavailable`, not `disabled`. `CardTile` defaults `disabled = false`; unavailable styling remains independent.

**Source-derived result:** mounted tile remains enabled → assertion fails. Old assertion also demands behavior accepted Decks F4 intentionally removed: ownership deficit must not prevent inspection/removal.

**Minimal correction:** rename case; require enabled tile plus `unavailable` class. Assert removal/inspection remains usable. Keep ownership-add restrictions unchanged.

**Validation required, not run:**

```sh
npx vitest run tests/component/deck-editor/editor-import.test.ts tests/component/deck-editor/deck-zone-grid.test.ts
```

## F2 — P2: DF-16 measures idle frames instead of update→paint

**Evidence:** `e2e/duel-smoke.spec.ts:4964–4983,4994–5015,6254–6277`.

Test waits for one historical state event, clears long tasks, collects 30 “update→paint” samples using `measureTwoFrameLatency()`. Helper records clock, waits two animation frames; dispatches no update. Recorded `eventPaints` durations never feed percentile gate.

Contract requires accepted public event → paint measurement: `docs/architecture/05-presentation/duel-field-performance-baseline.md:18–30`; migration criteria corroborate `docs/DUEL_FIELD_DOM_IMPLEMENTATION_PLAN.md:884,899–900`.

**Source-derived false-green:** expensive state processing occurs before sample window → long-task history cleared → idle frame samples satisfy thresholds despite slow updates. Input sampling also repeatedly focuses same first target without restoring focus elsewhere (`:6266–6277`).

**Minimal correction:** each measured iteration must cause distinct accepted public update; correlate ingress timestamp with rendered revision plus paint. Require 30 corresponding samples. Collect long tasks during actual update workload. Alternate focus targets for input samples.

**Minimal regression:** controlled slow accepted-update path must fail update percentile/long-task gate; idle-frame timing must not substitute. No threshold relaxation.

## F3 — P3: navigation resets URL capture before teardown assertion

**Evidence:** `e2e/duel-smoke.spec.ts:1344–1349`; capture initialization `:169–189`.

Destroy check navigates to `about:blank`, then requires `window.__duelCapture.imageUrls.active.size === 0`. Init script creates fresh capture with empty active set in new document. Assertion examines new page—not former duel’s cleanup.

Production cleanup contract exists independently: `src/battle/app/App.svelte:432–442` aborts image work, releases preview, disposes library. Lease release reaches URL revocation through `src/battle/app/images/semantic-image-leases.ts:50–55,97–109` and `src/shell/adapters/progressive-release-media.ts:81–93`.

**Source-derived false-green:** former document retains tracked URLs before navigation → new document starts empty capture → destroy assertion passes irrespective of app teardown. Earlier restart assertions remain useful; defect concerns final destroy check only.

**Minimal correction:** unmount duel through same-document shell navigation. Preserve capture identity; assert prior duel URLs revoked/no longer active. Allow unrelated destination-page leases.

**Minimal regression:** suppressed teardown cleanup must fail final lifecycle assertion without document replacement.

## Revision checks

- V1. Initial/final HEAD: `0bbe94e6115221e98a2d505c1e69241c066cde57`.
- V2. Final owned-path diff against initial HEAD: empty. No integrated changes during this review.
- V3. Compared with frozen `26da126`, owned delta: `tests/component/deck-editor/deck-save-conflict.test.ts:38–42`, five added assertions. Current file fully read; delta inspected.
- V4. `git diff --cached --name-only`: empty. Existing unrelated dirty work preserved. No repo-wide clean claim.
- V5. Tests/runtime probes deliberately not run. Findings establish static contradictions/oracle failures, not observed execution results.

## Coverage ledger

All ranges below **FULL within assignment**. No assigned PARTIAL/UNREAD ranges.

E2E whole-file status remains **PARTIAL**: assigned `1201–6538` fully read; supplemental `1–340` read; `341–1200` outside assignment, unread here. Remaining 56 files read completely.

| ID | Path | FULL assigned range |
|---|---|---|
| C1 | `e2e/duel-smoke.spec.ts` | 1201–6538 |
| C2 | `tests/component/DuelRail.test.ts` | 1–281 |
| C3 | `tests/component/FreePlayMatchSetup.test.ts` | 1–643 |
| C4 | `tests/component/FreePlayUniqueOwner.test.ts` | 1–28 |
| C5 | `tests/component/FullControlToggle.test.ts` | 1–91 |
| C6 | `tests/component/deck-editor/catalog-scrollbar.test.ts` | 1–80 |
| C7 | `tests/component/deck-editor/deck-crud.test.ts` | 1–31 |
| C8 | `tests/component/deck-editor/deck-editor-blocked.test.ts` | 1–67 |
| C9 | `tests/component/deck-editor/deck-library-order.test.ts` | 1–180 |
| C10 | `tests/component/deck-editor/deck-library-rename.test.ts` | 1–101 |
| C11 | `tests/component/deck-editor/deck-page-actions.test.ts` | 1–112 |
| C12 | `tests/component/deck-editor/deck-reorder.test.ts` | 1–152 |
| C13 | `tests/component/deck-editor/deck-save-conflict.test.ts` | 1–78 |
| C14 | `tests/component/deck-editor/editor-import.test.ts` | 1–198 |
| C15 | `tests/component/story/OutcomeProgression.test.ts` | 1–87 |
| C16 | `tests/component/story/collection-screen.test.ts` | 1–207 |
| C17 | `tests/component/story/set-list-rarity-sort.test.ts` | 1–246 |
| C18 | `tests/unit/active-image-manifest.test.ts` | 1–36 |
| C19 | `tests/unit/app-build-identity.test.ts` | 1–52 |
| C20 | `tests/unit/application-readiness.test.ts` | 1–214 |
| C21 | `tests/unit/card-action-label.test.ts` | 1–65 |
| C22 | `tests/unit/card-list-dialog-model.test.ts` | 1–164 |
| C23 | `tests/unit/chapter-one-image-lock.test.ts` | 1–67 |
| C24 | `tests/unit/content-actions.test.ts` | 1–767 |
| C25 | `tests/unit/content-runtime-activation.test.ts` | 1–133 |
| C26 | `tests/unit/content-setup.test.ts` | 1–531 |
| C27 | `tests/unit/deck-order-projection.test.ts` | 1–282 |
| C28 | `tests/unit/deck-parser.test.ts` | 1–136 |
| C29 | `tests/unit/decks/deck-catalog-performance.test.ts` | 1–257 |
| C30 | `tests/unit/decks/deck-catalog.test.ts` | 1–406 |
| C31 | `tests/unit/decks/installed-gameplay-cards.test.ts` | 1–124 |
| C32 | `tests/unit/decks/runtime-catalog.test.ts` | 1–364 |
| C33 | `tests/unit/dom-feedback-controller.test.ts` | 1–243 |
| C34 | `tests/unit/duel-restore-plan.test.ts` | 1–106 |
| C35 | `tests/unit/duel-worker-attachment.test.ts` | 1–426 |
| C36 | `tests/unit/format-selection-status.test.ts` | 1–224 |
| C37 | `tests/unit/installed-duel-command.test.ts` | 1–44 |
| C38 | `tests/unit/installed-free-play.test.ts` | 1–104 |
| C39 | `tests/unit/installed-runtime-receipt-validation.test.ts` | 1–19 |
| C40 | `tests/unit/pending-placement.test.ts` | 1–161 |
| C41 | `tests/unit/programmed-transcript.test.ts` | 1–142 |
| C42 | `tests/unit/progressive-fixture.test.ts` | 1–338 |
| C43 | `tests/unit/progressive-response.test.ts` | 1–114 |
| C44 | `tests/unit/prompt-selection.test.ts` | 1–230 |
| C45 | `tests/unit/resolve-duel-decks.test.ts` | 1–273 |
| C46 | `tests/unit/reviewed-card-pool.test.ts` | 1–40 |
| C47 | `tests/unit/selected-content-fixture.test.ts` | 1–55 |
| C48 | `tests/unit/selected-hand-zoom.test.ts` | 1–121 |
| C49 | `tests/unit/shared-svelte-ui.test.ts` | 1–91 |
| C50 | `tests/unit/shell-store.test.ts` | 1–205 |
| C51 | `tests/unit/shell/free-play-deck-tiles.test.ts` | 1–147 |
| C52 | `tests/unit/stage-frame.test.ts` | 1–192 |
| C53 | `tests/unit/story/pre-battle-decks.test.ts` | 1–307 |
| C54 | `tests/unit/story/shop-set-data.test.ts` | 1–516 |
| C55 | `tests/unit/story/story-decks.test.ts` | 1–177 |
| C56 | `tests/unit/story/story-release.test.ts` | 1–100 |
| C57 | `tests/unit/zone-list.test.ts` | 1–320 |

## Residual risks

- U1. No runtime validation; platform timing, browser behavior, complete-suite status remain unverified.
- U2. Static full reads do not establish exhaustive bug-freedom. No new findings beyond F1–F3 confirmed.
- U3. Parent next action: correct three test oracles; run focused component/Chromium regressions, including negative controls for F2/F3.
- U4. Report requires runtime persistence at authoritative destination; no direct repo writes performed.