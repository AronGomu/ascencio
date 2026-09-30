# Story / shell audit — checkpoint

State: **partial audit; five actionable findings**. Parent steering ended inspection before remaining files. No edits, commits, staging, subagents. Runtime persists this report.

## Review

- R1 Correct: checkpoint write/read-back verification precedes duel routing; duplicate results rejected. Evidence: `src/shell/handoff/handoff-coordinator.ts:79-115,151-157`.
- R2 Correct: generation writes snapshot inputs before awaits; revision compare/write share IDB tx. Evidence: `src/story/saves/generation-repository.ts:68-136`.
- R3 Correct: domain lease waits pending save ops before release. Evidence: `src/shell/application/application-readiness.ts:79-105`.
- R4 Fixed: none. Read-only audit.
- R5 Blocker: F1–F2 expose progress-loss paths. Resolve before release acceptance.
- R6 Note: findings below verified through source traces. Bug-specific UI repros not executed.

## Findings

### F1 — P1: returning from story deck editor starts fresh run

**Evidence:** `src/story/StoryApp.svelte:204-213` treats `storyEntryIntent === null` as `"new-game"`. `src/shell/shell-store.ts:52-64` clears entry intent upon leaving story. Deck navigation saves current run before leaving (`StoryApp.svelte:927-945`), but shell return carries neither resume state nor Continue intent (`src/shell/AppShell.svelte:567-575,1004-1005,1058-1063`). Hydration never resumes this fresh state: `applyEntryIntent()` returns unless screen remains `"title"` (`StoryApp.svelte:298-303`).

**Repro:** advance story, change wallet/deck → open Decks → return to Story via return control or browser Back. Story starts beat 0 with starter grant, 1000 DP. Existing save remains until subsequent save/checkpoint replaces it.

**Minimal fix:** explicit resume intent for editor→story return. Preserve intentional fresh direct-entry behavior separately. Resume newest player slot after hydration.

**Regression:** extend shell-level round-trip test: advance/buy → editor/save → return → assert beat, wallet, collection, edited deck preserved.

```bash
npx vitest run --maxWorkers=1 tests/component/StoryMenuEntry.test.ts tests/component/deck-editor/editor-context.test.ts
```

### F2 — P1: quota failure destroys recoverable in-memory story session

**Evidence:** `src/shell/core/session-saves.ts:8-18` escalates every `{ kind: "failed" }` result into shell recovery, including `{ reason: "quota" }`. `src/shell/AppShell.svelte:223-249` immediately routes Home, tears down domain, clears installed inputs. Story’s inline save-failure/retry handling consequently loses its session (`src/story/StoryApp.svelte:845-879,881-911`).

**Repro:** start story, make unsaved progress, fill browser storage, click Save. Quota result triggers shell recovery instead of retaining current story for retry. Unsaved progress disappears; persisted snapshot remains older.

**Minimal fix:** preserve domain for recoverable quota/write refusals. Return typed failure to existing story UI; reserve global recovery for fatal input/storage loss requiring teardown.

**Regression:** inject quota failure through production `sessionSaves` wrapper; assert story stays mounted, current state survives, retry succeeds. Existing fixture-only StoryApp tests bypass this wrapper.

```bash
npx vitest run --maxWorkers=1 tests/component/core-menu.test.ts tests/component/story/StoryApp.test.ts
```

### F3 — P2: empty load slots fabricate progress instead of refusing load

**Evidence:** `src/story/screens/LoadScreen.svelte:62-123` always renders occupied manual/autosave controls, independent of repository contents. `src/story/StoryApp.svelte:770-779` falls back to reducer when requested slot is absent. Reducer invents `"narrative"` at beat 18 or `"map"` (`src/story/model/story-reducer.ts:128-136`).

**Repro:** keep autosave only → menu Load → choose nonexistent manual slot. App invents narrative progress rather than loading autosave or refusing. Load entry starts from empty initial state, so fabricated run can contain no decks/collection. Deleting manual slot, reopening Load exposes same false occupied control.

**Minimal fix:** pass hydrated slot status/summaries into LoadScreen/LoadOverlay. Disable absent/incompatible slots. Remove production fallback that fabricates state.

**Regression:** empty manual + occupied autosave → manual disabled; valid autosave restores exact contents. Repeat after deletion/remount.

```bash
npx vitest run --maxWorkers=1 tests/component/story/TitleAndLoad.test.ts tests/component/StoryMenuEntry.test.ts tests/component/story/StoryApp.test.ts
```

### F4 — P2: stale story-deck lookup redirects newer route

**Evidence:** `src/shell/AppShell.svelte:624-645` increments `storyDeckToken` only when entering story deck context. Leaving for free-play/null returns before token increment (`:627-629`). Pending story lookup still passes token check, then navigates Home if no save (`:632-637`) or assigns stale editor context (`:638`). Teardown also lacks story-deck token invalidation (`:853-873`).

**Repro:** open `#/story/decks` with delayed save reads, no save → navigate to `#/free-play` before reads resolve → delayed result redirects newer route Home.

**Minimal fix:** increment token on every context change, before non-story early return; invalidate on teardown. Gate callbacks against current context.

**Regression:** deferred story lookup → navigate away → resolve null/error/context; assert no routing/context mutation.

```bash
npx vitest run --maxWorkers=1 tests/component/AppShell.test.ts tests/component/deck-editor/editor-context.test.ts
```

### F5 — P2: story deck CAS check occurs outside serialization

**Evidence:** commit chain serializes dispatch/persist (`src/story/decks/story-deck-repository.ts:64-97`), but `save()` reads/checks current revision before joining chain (`:165-176`). Two overlapping saves with identical `expectedRevision` both pass, both stamp identical next revision, both persist. Later save silently overwrites earlier save instead of raising conflict. `create()` duplicate check has same placement (`:121-132`).

**Repro:** issue two `repository.save(r, differentDecks, history)` calls without awaiting first. Both inspect revision `r`; queued commits each write revision `r + 1`. Both report success.

**Minimal fix:** move current-record lookup, revision/duplicate checks, stamp, dispatch, persistence into serialized task. Validate actual command acceptance, not merely existence of matching id/revision.

**Regression:** overlapping same-revision saves → exactly one succeeds, second throws `DeckRevisionConflictError`; overlapping duplicate creates → second rejected.

```bash
npx vitest run --maxWorkers=1 tests/unit/story/story-deck-repository.test.ts tests/unit/story/story-deck-context.test.ts
```

## Validation

- V1 Passed: bounded unit rerun — **41 files, 572 tests passed**, 79.98 s.

```bash
npx vitest run --maxWorkers=1 tests/unit/story tests/unit/shell tests/unit/shell-store.test.ts tests/unit/application-readiness.test.ts tests/unit/content-actions.test.ts
```

- V2 Incomplete: initial broad run timed out after 120 s. Output reported failures in `StoryApp.test.ts`, `booster-open-all.test.ts`, `booster-reveal.test.ts`, `StoryDuelHandoff.test.ts`; no final failure diagnostics/totals captured. Cause unverified. Do not treat as established product failures or passing browser coverage.
- V3 Not run: bug-specific regression additions, browser repros, build/type/lint gates. Parent now coordinates test resources.
- V4 Workspace: initial `git status --short` showed existing unstaged/untracked user work, no staged entries. No audit writes. Final status not rechecked.

## Coverage ledger

“Read” means source bodies inspected, including numbered output recovered after truncation. Test execution does **not** imply test-source review.

### Fully read source

| ID | Paths |
|---|---|
| C1 | `src/main.ts`, `src/acceptance-main.ts` |
| C2 | `src/shell/AppShell.svelte`, `src/shell/routes.ts`, `src/shell/shell-store.ts`, `src/shell/release-validation.ts` |
| C3 | All `src/shell/core/*.ts`, `src/shell/handoff/*.ts`, `src/shell/pwa/*.ts` |
| C4 | `src/shell/adapters/{installed-card-image-source,installed-editor-catalog,progressive-release-data,progressive-release-media,story-release}.ts` |
| C5 | `src/shell/application/{application-state,application-service,application-selector,application-locks,application-readiness,application-bootstrap,prepared-release,selected-gameplay,core-update-approval,content-actions}.ts` |
| C6 | `src/story/StoryApp.svelte`, all `src/story/model/*.ts`, `src/story/handoff/story-handoff.ts` |
| C7 | All `src/story/decks/*.ts`, all `src/story/ports/*.ts` |
| C8 | All `src/story/saves/generation-*.ts`, `src/story/saves/{story-migration,story-save-contracts,story-save-repository}.ts` |
| C9 | `src/story/screens/LoadScreen.svelte` |
| C10 | All `src/story/shop/data/*.ts`, `src/story/shop/{auto-flip,opened-card-quantities,sell-impact,shop-screens}.ts` |
| C11 | `src/story/collection/{collection-cards,group-by-rarity}.ts` |

Brace notation identifies exact files read, not wildcard claims about adjacent files.

### Context/config read

- D1 `AGENTS.md`, `docs/story/README.md`, `package.json`, `vitest.config.ts`.
- D2 Narrative router explicitly documents provisional runtime/canon gap. No narrative mismatch findings inferred.

### Searched/inventoried, not source-reviewed

- E1 All remaining scoped source paths inventoried with file listing/line counts.
- E2 Related tests inventoried by pathname; `AppShell`, `StoryApp`, `createApplicationService`, `createHandoffCoordinator` references searched.
- E3 Test titles searched in `tests/component/story/{StoryApp,installed-story,TitleAndLoad}.test.ts`, `tests/unit/story/story-deck-repository.test.ts`, `tests/unit/shell/handoff-coordinator.test.ts`, `tests/unit/application-readiness.test.ts`, `tests/unit/content-actions.test.ts`.
- E4 Related test bodies **not fully read**. Unit results above establish execution only.

### Explicit source coverage gaps

- G1 Shell: `domain-loaders.ts`, `index.ts`, `stage-layout.ts`; all admin/cards/content/screens/settings/toast files.
- G2 Shell adapters: all `legacy-*.ts`, `runtime-activation.ts`.
- G3 Shell application: `core-startup.ts`, `installer-chapter-sizes.ts`, `legacy-content.ts`, `legacy-installer.ts`, `saved-content-refs.ts`, `shell-bootstrap.ts`.
- G4 Story: `README.md`, `index.ts`, `cards/deck-cover.ts`, `collection/CollectionScreen.svelte`; all components, overlays, playback files; `content/prologue.ts`; `saves/index.ts`.
- G5 Story screens: all except `LoadScreen.svelte`. Story shop: all `.svelte` files.
- G6 Styles: `src/story/styles.css`, all `src/styles/*` inventoried only. Assets: three `src/assets/fonts/*.woff2` inventoried only; binaries not validated.
- G7 Related browser/component/unit test bodies remain unreviewed beyond searches above. Cross-domain consumers beyond cited scope not traced exhaustively.

## Assumptions / residual risks

- A1 Source fallback used per task: graphify unavailable, no graph output.
- A2 Findings describe checked working tree, not clean committed baseline. Existing user edits preserved.
- A3 Async races identified from concrete await/control-flow placement; deferred UI repro still needed.
- A4 Full requested audit remains incomplete. No all-code-clean claim.
- A5 Output-path instruction defers to read-only constraint: no report file written directly; runtime persists final response.
- A6 Next action: parent assigns F1–F5 fixes/regressions, coordinates isolated component reruns, resumes G1–G7 coverage.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Five source-evidenced findings F1-F5 include severity, exact file/line references, repro, minimal fix, regression commands."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git status --short",
      "result": "passed",
      "summary": "Initial dirty user work recorded; no staged entries."
    },
    {
      "command": "npx vitest run --maxWorkers=1 tests/unit/story tests/unit/shell tests/unit/shell-store.test.ts tests/unit/application-readiness.test.ts tests/unit/content-actions.test.ts",
      "result": "passed",
      "summary": "41 test files, 572 tests passed."
    },
    {
      "command": "npx vitest run tests/unit/story tests/unit/shell tests/unit/application-readiness.test.ts tests/unit/application-selector.test.ts tests/unit/content-actions.test.ts tests/unit/core-update-approval.test.ts tests/unit/progressive-release.test.ts tests/unit/semantic-release-preparation.test.ts tests/unit/shell-routes.test.ts tests/unit/shell-store.test.ts tests/unit/story-save-presence.test.ts tests/component/story tests/component/AppShell.test.ts tests/component/StoryDuelHandoff.test.ts tests/component/StoryMenuEntry.test.ts tests/component/core-menu.test.ts tests/component/collection-image-teardown.test.ts",
      "result": "failed",
      "summary": "Timed out after 120 seconds; component failures reported, final diagnostics unavailable."
    }
  ],
  "validationOutput": [
    "Test Files 41 passed (41)",
    "Tests 572 passed (572)",
    "Broad run: Command timed out after 120 seconds"
  ],
  "residualRisks": [
    "Audit stopped at parent-requested checkpoint; explicit uninspected paths listed in G1-G7.",
    "Bug-specific UI repros not executed; findings established through source traces.",
    "Broad component failure causes unverified.",
    "No browser, build, typecheck, lint acceptance performed.",
    "Existing user dirty work preserved; final git status not rechecked."
  ],
  "noStagedFiles": true,
  "diffSummary": "No audit edits or staging.",
  "reviewFindings": [
    "F1 P1: src/story/StoryApp.svelte:204-213 - editor return without entry intent starts fresh story.",
    "F2 P1: src/shell/core/session-saves.ts:8-18 - recoverable quota failure triggers destructive session teardown.",
    "F3 P2: src/story/StoryApp.svelte:770-779 - empty slot load fabricates progress.",
    "F4 P2: src/shell/AppShell.svelte:624-645 - stale story-deck lookup can redirect newer route.",
    "F5 P2: src/story/decks/story-deck-repository.ts:165-176 - revision check outside serialized commit permits overlapping stale writes."
  ],
  "manualNotes": "Read-only constraint honored. Runtime must persist this report to authoritative output path. Parent coordinates remaining tests and coverage."
}
```
