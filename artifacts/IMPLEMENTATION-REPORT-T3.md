Routing: `openai-codex/gpt-5.6-terra`, thinking high (requested; runtime model selection unavailable to worker).

# T3 implementation report

## State

blocked — T2 hard dependency absent. No T3 source/test edits made.

## Evidence

- E1. `src/cards/index.ts` missing (`test -e src/cards/index.ts` exit 1).
- E2. `src/cards/contracts.ts` missing.
- E3. `src/cards/images/index.ts` missing.
- E4. `src/cards/ports/card-image-source.ts` missing.
- E5. Current Deck Select imports legacy Decks card semantics: `src/deck-select/deck-select-contracts.ts:1`, `src/deck-select/DecklistPanel.svelte:2`.

T3 R2 requires T2 `CardImageSource`; R4 requires T2 `Cards` classification. T3 scope excludes T2 impl. Creating substitute contracts would widen scope, risk contract divergence.

## Changed files

- C1. `artifacts/IMPLEMENTATION-REPORT-T3.md` — blocker report only.

## Commands + exit codes

- C1. `graphify query "T3 shared presentation current T2 contracts card preview scrollbar geometry deck select shell exports"` — exit 0. Graph found current Shell preview/scrollbar, Deck Select, Battle presentation paths.
- C2. `git status --short && git diff --cached --name-only` — exit 0. Existing unrelated dirty files preserved; staged file list empty.
- C3. `find src -type f | sort | grep -E '(^src/cards/|card-image-source|card-image|card-frame|card-preview)'` — exit 0. Only legacy `src/decks/card-frame.ts`; no `src/cards/` files.
- C4. `test -e src/cards/index.ts` — exit 1. Required T2 entry absent.
- C5. `git diff --cached --quiet` — exit 0. No staged files.

## Validation evidence

- V1. Exact ticket Vitest command — not run. Blocked before T3 red/green phase; current tests target legacy Shell paths, so no valid T3 contract test can compile without T2.
- V2. `npm run typecheck` — not run. Blocked before implementation; no T3 source change exists to validate.
- V3. No new failure handling added. No source edits.
- V4. T3 R1–R5 not evidenced. Required predecessor interfaces missing.

## Assumptions

- A1. T2 must create `src/cards/index.ts`, `src/cards/contracts.ts`, `src/cards/images/index.ts`, `src/cards/ports/card-image-source.ts` per T3 contract.
- A2. Implementing those files here violates requested T3-only scope.

## Unresolved risks

- R1. T3 cannot remove Shell preview/scrollbar exports safely until hosts can consume T2 image/cards contracts.
- R2. Rewiring Deck Select now would require legacy `decks/card-frame.ts`, violating R4.

## Requested parent decision

Apply T2 first or provide cwd containing T2 contracts. Then rerun T3 from D1/P1.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "not-satisfied",
      "evidence": "Blocked by absent T2 contracts required by T3 R2 and R4; no scope-widening implementation made."
    }
  ],
  "changedFiles": [
    "artifacts/IMPLEMENTATION-REPORT-T3.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "graphify query \"T3 shared presentation current T2 contracts card preview scrollbar geometry deck select shell exports\"",
      "result": "passed",
      "summary": "Located legacy shared views and consumers."
    },
    {
      "command": "test -e src/cards/index.ts",
      "result": "failed",
      "summary": "Required T2 public entry absent."
    },
    {
      "command": "git diff --cached --quiet",
      "result": "passed",
      "summary": "No staged files."
    },
    {
      "command": "npx vitest run tests/component/OverlayScrollbar.test.ts tests/component/deck-editor/card-preview-pane.test.ts tests/component/deck-editor/catalog-scrollbar.test.ts tests/unit/card-preview.test.ts tests/unit/card-visibility.test.ts tests/unit/data-cy-coverage.test.ts tests/unit/shared-svelte-ui.test.ts --reporter=verbose",
      "result": "not-run",
      "summary": "Blocked before T3 implementation by missing T2 contracts."
    },
    {
      "command": "npm run typecheck",
      "result": "not-run",
      "summary": "Blocked before T3 implementation by missing T2 contracts."
    }
  ],
  "validationOutput": [
    "MISSING src/cards/index.ts",
    "MISSING src/cards/contracts.ts",
    "MISSING src/cards/images/index.ts",
    "MISSING src/cards/ports/card-image-source.ts",
    "git diff --cached --quiet exit=0"
  ],
  "residualRisks": [
    "T3 R1-R5 remain unimplemented pending T2.",
    "Existing unrelated dirty files preserved."
  ],
  "noStagedFiles": true,
  "diffSummary": "Blocker report only; no T3 source or test change.",
  "reviewFindings": [
    "blocker: src/cards/index.ts - required T2 Cards and image contract entry absent."
  ],
  "manualNotes": "Parent must apply T2 or provide T2-complete cwd before T3 resumes."
}
```