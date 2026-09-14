## Assumptions
- A1. `/home/aron/projects/ascencio/plan.md` + `progress.md` absent. Reviewed T8 ticket/report + ledger instead: `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T8_semantic-preparation.md`, `artifacts/IMPLEMENTATION-REPORT-T8.md`, `artifacts/IMPLEMENTATION-LEDGER-T4-through-T11.md`.
- A2. Review target = worktree diff vs `5a3ba36`. No edits beyond this review artifact.

## Review
- C1 Correct: owned semantic composition exists. `src/shell/release-validation.ts:35-72` calls Cards consistency, Decks validator/ruleset, Story validation/continuity, Battle validation. `src/shell/adapters/progressive-release-data.ts:131-181` maps selected chapter union into `allowedCardCodes`; Worker rejects non-union deck cards at `src/battle/worker/decks/resolve-duel-decks.ts:56-65`.
- C2 Correct: fresh WASM + frozen Worker gate exist. `src/shell/adapters/progressive-release-data.ts:299-309` slices WASM per `load`; `src/battle/worker/create-browser-runtime.ts:21-51` SHA-256 checks exact frozen WASM before init.
- C3 Correct: Content sibling semantic imports gone. `src/content/install/verify-gameplay.ts:1-8` imports only Content-local modules. Focused boundary test passes.

- B1 Blocker — high: optional media reads unbounded. `src/shell/adapters/progressive-release-media.ts:23-72` starts every `reader.readFile` immediately; no queue/active counter exists. Five simultaneous `images.acquire` calls create five concurrent reads. Violates T8 contract `Read/decode concurrency <=4`. Fix: shared four-slot queue around media read + Blob URL creation; abort queued req with exact `DOMException("The operation was aborted.", "AbortError")`.
- B2 Blocker — high: prepared release not pinned to staged identity. `src/shell/application/prepared-release.ts:26-34,72` passes input `content` ref into media then returns same ref. `src/shell/adapters/progressive-release-media.ts:44-47` lazily reads mutable `staged.manifestVersion`. Runtime caller can mutate `(candidate.content as { manifestVersion: string }).manifestVersion` after successful preparation; next image/map acquire reads another release. Fix: validate + clone/freeze `StagedContent` once before every adapter call; return same frozen copy.
- B3 Blocker — high: Shell Content restriction bypassed via type re-export laundering. `src/shell/application/legacy-content.ts:1-16` re-exports Content public types; non-owner UI imports wrapper, e.g. `src/shell/screens/FreePlayMatchSetup.svelte:8`, `src/shell/cards/installed-card-image-source.ts:6-10`. `tests/unit/domain-boundaries.test.ts:101-123` treats Shell→Shell as legal before Content ownership check. This defeats requirement only `src/shell/application/**` + `src/shell/adapters/**` import/own Content contracts. Fix: remove `legacy-content.ts` Content re-exports; move consumers needing Content values into adapters/application APIs, then add AST negative test for re-export laundering.
- N1 Note — medium: `dispose()` revokes active URLs, later lease `release()` revokes same URL again. `src/shell/adapters/progressive-release-media.ts:62-67,100-105`. `dispose()` clears `active` but lease-local `released` stays false. Fix: centralize per-URL release state so adapter dispose marks leases released; each URL revokes once.

## Validation
- V1 Passed: `npx vitest run tests/unit/semantic-release-preparation.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose` → `53 passed`.
- V2 Passed: `node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts` → `26 pass`, `0 fail`.
- V3 Passed: `git diff --check 5a3ba36` → exit `0`.
- V4 Note: focused tests omit B1/B2/N1. `tests/unit/semantic-release-preparation.test.ts:256-383` has no concurrent media, post-prepare staged mutation, or dispose-then-lease-release assertion.

## Residual risks
- K1 T9 must not activate prepared candidates before B1–B3 fixed. T8 contract failure reaches lazy runtime media + boundary enforcement.
- K2 No unleased media cache exists. Zero unused entries means 32 MiB/64-entry cache cap vacuously holds; no cache abstraction needed.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Concrete B1-B3 blockers and N1 note cite exact paths/lines; C1-C3 attest verified semantics, selected-card gate, frozen WASM, and Content import removal."
    }
  ],
  "changedFiles": [
    "artifacts/REVIEW-T8-preparation.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "npx vitest run tests/unit/semantic-release-preparation.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "53 passed"
    },
    {
      "command": "node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts",
      "result": "passed",
      "summary": "26 pass, 0 fail"
    },
    {
      "command": "git diff --check 5a3ba36",
      "result": "passed",
      "summary": "exit 0"
    }
  ],
  "validationOutput": [
    "Focused Vitest passes but lacks concurrency, mutable-staged-identity, and post-dispose lease tests.",
    "Producer/publisher focused Node suite passes."
  ],
  "residualRisks": [
    "B1: unlimited optional media reads violate <=4 contract.",
    "B2: mutable returned StagedContent can retarget lazy media reads.",
    "B3: Shell Content ownership restriction bypasses through re-export wrapper.",
    "N1: dispose then lease.release invokes duplicate URL revoke."
  ],
  "noStagedFiles": true,
  "diffSummary": "T8 diff adds Shell semantic preparation, producer validation, Content boundary rules, and tests vs 5a3ba36.",
  "reviewFindings": [
    "blocker-high: src/shell/adapters/progressive-release-media.ts:23-72 - no shared four-slot media read/decode limiter.",
    "blocker-high: src/shell/application/prepared-release.ts:26-34,72 and src/shell/adapters/progressive-release-media.ts:44-47 - mutable StagedContent reference can retarget lazy media reads.",
    "blocker-high: src/shell/application/legacy-content.ts:1-16 - Content type re-export launders non-owner Shell consumer access.",
    "note-medium: src/shell/adapters/progressive-release-media.ts:62-67,100-105 - lease release after dispose revokes same URL twice."
  ],
  "manualNotes": "T9 activation deferred per T8 plan. Do not demand final selector here."
}
```