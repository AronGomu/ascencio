# T6 integrity review

Status: **blocked** — 2 data-integrity/error-contract blockers.

## Review

- B1 **Blocker · High — malformed sparse binding passes validation, persists, migrates, seals.** `validBinding` checks `completedChapterIds` with `Array.isArray`, `every`, `Set.size` only; sparse array such as `Array(1)` skips `every`, yields `Set.size === length`, therefore passes (`src/story/saves/generation-envelope.ts:45-50`). Runtime probe observed `write` → `{"kind":"written","revision":1}`, `read` → `ready`, `prepare` → resolved sealed generation with 1 slot. Violates invalid/corrupt-slot refusal at `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T6_story-save-generations.md:160`. Minimal fix: require dense arrays before accepting `completedChapterIds` (index-presence check or strict array parser); apply same density rule to schema6 `StoryState` arrays used by `isStoryState`. Tests: sparse `completedChapterIds` write returns typed failure; raw sparse schema6 source makes `prepare` reject `STORY_MIGRATION_FAILED`; source rows remain unchanged.
- B2 **Blocker · Medium — malformed seal leaks wrong errors.** `verifySeal` calls `structuredClone(input)` outside guarded mapping (`src/story/saves/story-migration.ts:112-114`); `validateSealShape` omits scalar validation for `generationId`, `sourceGenerationId`, `revision` (`src/story/saves/generation-record.ts:103-132`), allowing invalid ID into IDB lookup (`src/story/saves/story-migration.ts:116`). Runtime probe observed function `generationId` → raw `DataCloneError` (`"() => {} could not be cloned."`); `undefined` `generationId` → `STORY_STORAGE_UNAVAILABLE`. Contract requires malformed/missing semantic input → `STORY_MIGRATION_FAILED` (`artifacts/PLAN_2026_09_13_content_module_rearchitecture/T6_story-save-generations.md:160`). Minimal fix: clone inside semantic-validation boundary; strictly validate seal scalar fields before IDB calls; map clone/shape failures to `STORY_MIGRATION_FAILED`, DB failures to storage errors. Tests: uncloneable seal plus undefined/invalid generation IDs each reject exact `STORY_MIGRATION_FAILED`.

## Evidence

- E1 Focused suite passed: `npx vitest run tests/unit/story/save-generations.test.ts tests/unit/story/story-release.test.ts tests/unit/story/story-release-adapter.test.ts tests/component/story/installed-story.test.ts tests/unit/story/story-save-repository.test.ts --reporter=verbose` → 5 files, 82 tests passed.
- E2 Runtime Vite/`fake-indexeddb` probe reproduced B1/B2 exactly: `sparse-write: {"kind":"written","revision":1}`; `sparse-read: ready`; `sparse-prepare: resolved slots=1`; `undefined-generationId: STORY_STORAGE_UNAVAILABLE`; `function-generationId: () => {} could not be cloned. (DataCloneError)`.
- E3 Correct paths verified by source/tests: all-five-slot COW, tx source compare, concurrent idempotent prepare, legacy preservation/no grants, beat remap, descriptor-vs-active separation have passing assertions in `tests/unit/story/save-generations.test.ts:62-340`. Native fixture reports 5 slots, unchanged source, index 9, active reopen in `artifacts/T6-EVIDENCE/browser-native-result.json:1-11`.

## Assumptions

- A1 Requested `/home/aron/projects/ascencio/plan.md` plus `/home/aron/projects/ascencio/progress.md` do not exist (`ENOENT`). Full T6 ticket plus impl report used as review authority.
- A2 Parent-approved T9 selector/lease injection deferral treated as out of scope, per task; no finding raised.

## Residual risks

- R1 No native Chromium rerun; targeted unit/component suite plus existing native result inspected. Findings reproduce in Vite SSR with `fake-indexeddb`.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "2 concrete blockers include severity, exact source/ticket lines, runtime reproduction, minimal fixes, required tests."
    }
  ],
  "changedFiles": [
    "artifacts/REVIEW-T6-integrity.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "graphify query \"T6 story save generations migration integrity concurrency source tests ports\"",
      "result": "passed",
      "summary": "Knowledge graph located T6 migration, generation records, ports, fixtures, tests."
    },
    {
      "command": "npx vitest run tests/unit/story/save-generations.test.ts tests/unit/story/story-release.test.ts tests/unit/story/story-release-adapter.test.ts tests/component/story/installed-story.test.ts tests/unit/story/story-save-repository.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "5 files, 82 tests passed."
    },
    {
      "command": "node --input-type=module <inline Vite SSR/fake-indexeddb integrity probe>",
      "result": "passed",
      "summary": "Probe ran successfully; exposed malformed sparse save acceptance plus wrong malformed-seal errors."
    }
  ],
  "validationOutput": [
    "Focused tests: Test Files 5 passed; Tests 82 passed.",
    "Sparse binding: write written, read ready, prepare resolved slots=1.",
    "Malformed seals: undefined generationId -> STORY_STORAGE_UNAVAILABLE; function generationId -> DataCloneError."
  ],
  "residualRisks": [
    "Native Chromium not rerun; existing T6 native result inspected.",
    "T9 selector/lifecycle lease injection intentionally deferred by parent approval."
  ],
  "noStagedFiles": true,
  "diffSummary": "Review-only: production/test source unchanged; review artifact added.",
  "reviewFindings": [
    "blocker high: src/story/saves/generation-envelope.ts:45-50 - sparse completedChapterIds accepted, persisted, migrated, sealed.",
    "blocker medium: src/story/saves/story-migration.ts:112-116 and src/story/saves/generation-record.ts:103-132 - malformed seals leak DataCloneError or misclassify as STORY_STORAGE_UNAVAILABLE."
  ],
  "manualNotes": "plan.md/progress.md absent; T6 ticket and implementation report reviewed instead."
}
```
