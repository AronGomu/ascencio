# T6 repair review

Status: **done — clean.**

## Review

- R1. **Correct:** Schema6 parser rejects holes in every array reachable through `StoryBinding`/`StoryState`: `completedChapterIds`, `locations`, `decks`, nullable `openedCards`, deck `main`/`extra`/`side`, `validation.issues`. `src/story/saves/generation-envelope.ts:20-21,48-54,85-98`. Legacy schema1–5 parser untouched; generation parser accepts schema6 only. `src/story/saves/generation-envelope.ts:71-80`; `src/story/saves/story-save-contracts.ts:113-177`.
- R2. **Correct:** Sparse source paths reject at parse, write, migration. Migration test snapshots `generationSaves` plus `generations` before `prepare`, asserts exact source preservation after `Error("STORY_MIGRATION_FAILED")`. `tests/unit/story/save-generations.test.ts:333-405`.
- R3. **Correct:** `verifySeal` clones plus validates before `open()`/IDB lookup. Clone/shape errors return `Error("STORY_MIGRATION_FAILED")`; post-validation DB errors retain `storageError()` mapping. `src/story/saves/story-migration.ts:112-138`; `src/story/saves/generation-database.ts:6-18`.
- R4. **Correct:** Seal validation enforces own plain-record fields, nonblank scalar IDs, positive safe revision, dense bounded slot array, strict slot fields, SHA-256 digest, unique canonical slot order. `src/story/saves/generation-record.ts:111-140`; `src/story/ports/release-value.ts:1-72`.
- R5. **Correct:** Tests cover uncloneable root/function values, malformed top-level scalar fields, sparse/undefined slots, no DB access before semantic refusal, unavailable/quota mapping after valid seal. `tests/unit/story/save-generations.test.ts:408-475`.
- R6. **Blocker:** None.

## Evidence

- E1. Passed: `npx vitest run tests/unit/story/story-release.test.ts tests/unit/story/save-generations.test.ts tests/unit/story/story-save-repository.test.ts tests/component/story/installed-story.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose` → 5 files, 193 tests.
- E2. Passed: scoped ESLint plus Prettier check for 3 save modules plus generation test. Output: `All matched files use Prettier code style!`.
- E3. Passed: `git diff --cached --quiet` → exit 0. No staged files.

## Assumptions

- A1. Scope limited to B1/B2 repair. Existing T6 integration review accepted as clean; unrelated T6/T9 paths not re-reviewed.
- A2. `fake-indexeddb` source-preservation assertions are sufficient focused persistence evidence; no native Chromium rerun requested for parser/error-boundary repair.

## Residual risks

- K1. Native Chromium not rerun. Focused suite uses `fake-indexeddb`; prior browser evidence not revalidated.
- K2. No explicit test mutates non-null seal slot `slot`/`revision`/`digest` scalars. Source validates each at `src/story/saves/generation-record.ts:124-129`; current tests cover null/undefined slot structures plus top-level scalars.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "R1-R6 cite concrete source/test lines; no blocker found."
    }
  ],
  "changedFiles": [
    "artifacts/REVIEW-T6-repair.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "npx vitest run tests/unit/story/story-release.test.ts tests/unit/story/save-generations.test.ts tests/unit/story/story-save-repository.test.ts tests/component/story/installed-story.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "5 files, 193 tests passed."
    },
    {
      "command": "npx eslint src/story/saves/generation-envelope.ts src/story/saves/generation-record.ts src/story/saves/story-migration.ts tests/unit/story/save-generations.test.ts && npx prettier --check src/story/saves/generation-envelope.ts src/story/saves/generation-record.ts src/story/saves/story-migration.ts tests/unit/story/save-generations.test.ts",
      "result": "passed",
      "summary": "Scoped lint passed; Prettier reported all files matched."
    },
    {
      "command": "git diff --cached --quiet",
      "result": "passed",
      "summary": "Exit 0; no staged files."
    }
  ],
  "validationOutput": [
    "E1. Test Files 5 passed; Tests 193 passed.",
    "E2. All matched files use Prettier code style!",
    "E3. git diff --cached --quiet exit=0"
  ],
  "residualRisks": [
    "K1. Native Chromium not rerun; focused persistence tests use fake-indexeddb.",
    "K2. Slot scalar malformed-value coverage is source-verified but not explicit test-table coverage."
  ],
  "noStagedFiles": true,
  "diffSummary": "Review-only. Inspected B1/B2 repair in three save modules plus generation tests; no code edits.",
  "reviewFindings": [
    "R6. No blockers: dense schema6 arrays reject malformed sources without mutation; malformed seals fail semantically before DB access; valid seals retain DB error mapping."
  ],
  "manualNotes": "Focused repair review clean. Existing T6 integration review not repeated."
}
```