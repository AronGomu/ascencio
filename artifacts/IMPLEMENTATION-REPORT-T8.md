# T8 — Shell semantic release preparation

**Next:** independent review inspect `artifacts/T8-EVIDENCE/green-vitest.log`, `green-node.log`, and producer/publisher diff.

**State:** done · implementation complete · independent review pending · no commit/stage/push/deploy/real endpoint.

## Evidence

- E1. RED captured before implementation: Vitest exit `1` with missing `prepared-release.ts`; Node exit `1`, 21/23 passed, 2 intended continuity/stamp failures. `artifacts/T8-EVIDENCE/red-*.{log,exit}`.
- E2. Exact ticket GREEN: Vitest 53/53; Node producer/publisher 26/26. Prior root Node suite 198/198; affected Cards/Decks/Story/Battle/Content/Shell Vitest 78/78.
- E3. `npm run typecheck` exit `0`, 0 errors plus 4 pre-existing warnings. Scoped ESLint/Prettier, `git diff --check`, vendor diff, staging checks exit `0`.
- E4. `npm run build:app` passes. `npm run build:verify` retains `Error: shell initial JavaScript exceeds its production budget: 118072 > 115000 bytes`; isolated HEAD `5a3ba36` reproduction is worse at `130862 > 115000`, so T8 does not introduce budget failure.
- E5. Fake live CLI trace passes 1/1 with injected S3 transport and no real endpoint. Graph update not run per task because known external Gemini `429 RESOURCE_EXHAUSTED`; graph backend unchanged.

## Implementation

- I1. `src/shell/release-validation.ts:20-57` exposes exact pure producer contract. It composes `validateCardConsistency`, `validatePublishedDecks` with `PROTOTYPE_RULESET`, `validateStoryRelease`, optional `validateStoryContinuity`, and `validateBattleRuntime`; any rejection becomes `CONTENT_SEMANTIC_INVALID`.
- I2. `src/shell/application/prepared-release.ts:14-87` plus progressive data/media adapters verify selected required bytes, pin one read per path, build Cards/Editor/Story/Battle inputs, scope allowed cards to selected chapters, return fresh WASM per load, and make optional media absence return `null`.
- I3. Content→Decks dependency plus Deck-owned token/zone/quantity checks left `src/content/install/verify-gameplay.ts`; Shell legacy gate now invokes Decks validator. Boundary config/tests require Content zero outgoing sibling imports and limit Shell→Content to application/adapters.
- I4. Producer pack and verify invoke actual semantic composition over frozen staged objects. Runs record exact `previous-release.json` identity plus informational `validation.json`; verifier recomputes semantics/source freshness and validates official continuity recursively.
- I5. Publisher always re-verifies candidate with current sources, binds predecessor manifest digest to remote pointer CAS, preserves idempotence, and ignores no caller stamp. Live CLI validates approval/config/credential presence before creating injected transport.

## Semantic coverage

- S1. Cards: chapter/runtime metadata and text exactness; identical duplicate dedup; conflicts reject.
- S2. Decks: unsupported token, wrong Main/Extra zone, quantity and copy limit through owned validator/ruleset.
- S3. Story: lexical chapter/default composition, references, map/set metadata, previous-release continuity.
- S4. Battle: runtime/WASM/scripts/strings validity, full runtime support versus selected chapter `allowedCardCodes`, fresh `ArrayBuffer` per load.
- S5. Media: manifest membership/role/MIME required; local bytes optional; acquisition errors degrade to `null`; leases revoke once.

## Assumptions

- A1. T9 remains sole owner of activation, selected-release lifecycle, and save mutation. T8 prepares candidates only.
- A2. Accepted predecessor is current HEAD `5a3ba36f5f165d3a4db24574e1bdaaf46ac551f6`; no baseline files were staged or committed.
- A3. Existing legacy Content wire parsers remain structural compatibility APIs; semantic sibling composition now occurs in Shell adapters/public pure validator.
- A4. Optional media corruption/unreadability intentionally maps to `null`; abort remains `DOMException("The operation was aborted.", "AbortError")`.

## Silent-failure audit

- F1. No added `|| true`, redirected ignored failure, or unobserved rejecting Promise.
- F2. `progressive-release-media.ts` catch revokes created URL, rethrows abort, maps optional-media read/decode failure to contract-required `null`.
- F3. Progressive data/producer parse catches map malformed private causes to `APP_REQUIRED_INPUT_FAILED`, `CONTENT_SEMANTIC_INVALID`, or `CONTENT_INVALID_MANIFEST`; no raw path/remote text escapes.
- F4. Publisher/CLI catches distinguish 404/precondition/retry classes or return fixed public code; non-matching failures propagate.

## Validation

| ID  | Command                                                                                                                  | Result                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| V1  | `npx vitest run tests/unit/semantic-release-preparation.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose` | passed · 53/53                         |
| V2  | `node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts`                                     | passed · 26/26                         |
| V3  | `npm run test:legacy`                                                                                                    | passed · 198/198                       |
| V4  | affected six-file Vitest regression command                                                                              | passed · 78/78                         |
| V5  | typecheck / scoped ESLint / scoped Prettier / diff / vendor / staging                                                    | passed · 0 errors; 4 existing warnings |

## Changed path groups

- C1. Shell: `src/shell/release-validation.ts`, `src/shell/application/{prepared-release,legacy-content}.ts`, `src/shell/adapters/{progressive-release-data,progressive-release-media,legacy-content-api,legacy-gameplay-validation}.ts`, narrowed legacy Shell consumers.
- C2. Producer/publisher: `scripts/lib/asset-delivery/{progressive-semantic-validation,progressive-producer,progressive-publisher,progressive-error,content-publish-cli}.ts`.
- C3. Boundary/ownership: `eslint.config.js`, `src/content/install/verify-gameplay.ts`, `tests/unit/domain-boundaries.test.ts`.
- C4. Tests/fixtures: `tests/unit/semantic-release-preparation.test.ts`, `tests/{progressive-producer,progressive-publisher,asset-delivery-bundle}.test.ts`, `tests/fixtures/{content-runtime-fixture,asset-delivery-bundle}.ts`.
- C5. Tracking: T8 ticket, shared ledger, this report, `artifacts/T8-EVIDENCE/`.

## Residual risks

- R1. Independent acceptance review remains open; report does not self-accept.
- R2. Existing shell JS budget gate remains red despite T8 reducing measured closure by 12,790 bytes versus isolated HEAD reproduction. Exact logs retained.
- R3. Graph remains stale because required updater was deferred for known external quota failure.
- R4. T9 activation/save lifecycle not implemented by design.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Shell pure release entry and prepareRelease compose Cards, Decks, Story, and Battle validators over pinned required bytes; exact Vitest passes 53/53."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Producer and publisher recompute semantics/source freshness, enforce official continuity and exact predecessor manifest identity; Node suite passes 26/26."
    },
    {
      "id": "criterion-3",
      "status": "satisfied",
      "evidence": "Content has zero outgoing sibling imports; Shell Content imports are restricted to application/adapters; boundary tests pass."
    }
  ],
  "changedFiles": [
    "eslint.config.js",
    "scripts/lib/asset-delivery/content-publish-cli.ts",
    "scripts/lib/asset-delivery/progressive-error.ts",
    "scripts/lib/asset-delivery/progressive-producer.ts",
    "scripts/lib/asset-delivery/progressive-publisher.ts",
    "scripts/lib/asset-delivery/progressive-semantic-validation.ts",
    "src/content/install/verify-gameplay.ts",
    "src/shell/release-validation.ts",
    "src/shell/application/prepared-release.ts",
    "src/shell/application/legacy-content.ts",
    "src/shell/adapters/progressive-release-data.ts",
    "src/shell/adapters/progressive-release-media.ts",
    "src/shell/adapters/legacy-content-api.ts",
    "src/shell/adapters/legacy-gameplay-validation.ts",
    "src/shell/AppShell.svelte",
    "src/shell/admin/AdminConsole.svelte",
    "src/shell/admin/admin-actions.ts",
    "src/shell/cards/installed-card-image-source.ts",
    "src/shell/cards/installed-editor-catalog.ts",
    "src/shell/content/content-error-copy.ts",
    "src/shell/content/installer-chapter-sizes.ts",
    "src/shell/content/saved-content-refs.ts",
    "src/shell/core/core-gate.ts",
    "src/shell/handoff/handoff-request.ts",
    "src/shell/screens/InstallContentScreen.svelte",
    "src/shell/screens/FreePlayMatchSetup.svelte",
    "src/shell/screens/free-play-deck-listing.ts",
    "src/shell/screens/free-play-opponents.ts",
    "tests/unit/semantic-release-preparation.test.ts",
    "tests/unit/domain-boundaries.test.ts",
    "tests/progressive-producer.test.ts",
    "tests/progressive-publisher.test.ts",
    "tests/asset-delivery-bundle.test.ts",
    "tests/fixtures/content-runtime-fixture.ts",
    "tests/fixtures/asset-delivery-bundle.ts",
    "artifacts/PLAN_2026_09_13_content_module_rearchitecture/T8_semantic-preparation.md",
    "artifacts/IMPLEMENTATION-LEDGER-T4-through-T11.md",
    "artifacts/IMPLEMENTATION-REPORT-T8.md",
    "artifacts/T8-EVIDENCE/"
  ],
  "testsAddedOrUpdated": [
    "tests/unit/semantic-release-preparation.test.ts",
    "tests/unit/domain-boundaries.test.ts",
    "tests/progressive-producer.test.ts",
    "tests/progressive-publisher.test.ts",
    "tests/asset-delivery-bundle.test.ts",
    "tests/fixtures/content-runtime-fixture.ts",
    "tests/fixtures/asset-delivery-bundle.ts"
  ],
  "commandsRun": [
    {
      "command": "npx vitest run tests/unit/semantic-release-preparation.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose",
      "result": "failed",
      "summary": "Expected RED: missing prepared-release module; 42 existing boundary tests passed."
    },
    {
      "command": "node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts",
      "result": "failed",
      "summary": "Expected RED: 21/23 passed; continuity and forged semantic-stamp assertions failed."
    },
    {
      "command": "npx vitest run tests/unit/semantic-release-preparation.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "53/53 passed."
    },
    {
      "command": "node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts",
      "result": "passed",
      "summary": "26/26 passed."
    },
    {
      "command": "npm run test:legacy",
      "result": "passed",
      "summary": "198/198 passed after updating prior producer graph/CLI fixtures for required semantic validation and real runtime/WASM."
    },
    {
      "command": "npm run typecheck",
      "result": "passed",
      "summary": "0 errors; 4 pre-existing Svelte/CSS warnings."
    },
    {
      "command": "npm run build:app",
      "result": "passed",
      "summary": "Production app build completed."
    },
    {
      "command": "npm run build:verify",
      "result": "failed",
      "summary": "Existing budget failure: Error: shell initial JavaScript exceeds its production budget: 118072 > 115000 bytes. Isolated HEAD reproduction: 130862 > 115000."
    },
    {
      "command": "node --test --test-name-pattern='live CLI uses rights/config-verified injected SDK transport without real endpoint access' tests/progressive-publisher.test.ts",
      "result": "passed",
      "summary": "1/1 passed using fake injected transport; no real endpoint access."
    },
    {
      "command": "graphify . --update",
      "result": "not-run",
      "summary": "Deferred per task due known external Gemini 429 RESOURCE_EXHAUSTED; graph backend unchanged."
    }
  ],
  "validationOutput": [
    "RED Vitest exit 1; RED Node exit 1 with 2 intended failures.",
    "GREEN exact Vitest 53/53; GREEN exact Node 26/26.",
    "Legacy Node 198/198; affected Vitest 78/78.",
    "Typecheck, scoped ESLint/Prettier, diff/vendor/staging checks exit 0.",
    "Fake live CLI 1/1; current build app passes; known baseline budget gate remains documented."
  ],
  "residualRisks": [
    "Independent review pending; no self-acceptance.",
    "Existing shell initial-JavaScript budget gate remains red: current 118072 > 115000; isolated accepted baseline 130862 > 115000.",
    "Graph updater not run because known external Gemini quota failure; graph remains stale.",
    "T9 activation/save lifecycle remains intentionally out of scope."
  ],
  "noStagedFiles": true,
  "diffSummary": "Shell-owned semantic release composition, pinned adapters, Content import-boundary tightening, producer/publisher semantic freshness and predecessor binding, fake live CLI wiring, real runtime/WASM fixtures, red/green evidence.",
  "reviewFindings": [
    "No known in-scope semantic preparation blocker remains.",
    "Required owned-validator parity, optional-media behavior, continuity, stale predecessor, non-authoritative stamp, and fake transport tests pass.",
    "Independent review required before acceptance or T9 work."
  ],
  "manualNotes": "Sole writer. No subagents, commit, staging, push, deploy, real endpoint, vendor change, T9 activation/save work, or graph backend update."
}
```
