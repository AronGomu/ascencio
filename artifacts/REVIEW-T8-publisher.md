# T8 publisher security review

State: **blocked**. Four impl blockers, two evidence gaps.

## Review

- B1. **High — live rights gate omits metadata sources that generate public bytes.** `requireLiveApproval` scopes only `inventory.files` plus `inventory.vendorFiles` (`scripts/lib/asset-delivery/content-publish-cli.ts:37-53`). `playerMetadata.sourceInputs` are excluded despite supplying chapter policy, story, decks, card-set data, corrections, runtime metadata (`scripts/lib/asset-delivery/prepare-player.ts:106-189,292-300`). Those inputs generate published `gameplay.json` plus `story.json` (`scripts/lib/asset-delivery/player-payload.ts:48-56`). Current live test sets `sourceInputs: []` (`tests/progressive-publisher.test.ts:101-104`) → bypass hidden. Fix: bind rights approval to every source digest influencing each published object, including metadata inputs/derived outputs, then add denied-metadata CLI test.
- B2. **High — publisher validation not rerun immediately before pointer write.** Only full semantic/source verification occurs at entry (`scripts/lib/asset-delivery/progressive-publisher.ts:254`). Upload loop plus manifest write follow (`scripts/lib/asset-delivery/progressive-publisher.ts:279-289`), then pointer CAS executes directly (`scripts/lib/asset-delivery/progressive-publisher.ts:290-297`). Source or local candidate mutation during upload can make entry validation stale; absent immutable objects are uploaded without local digest assertion in `putImmutable` (`scripts/lib/asset-delivery/progressive-publisher.ts:226-243`). Fix: re-run `verifyProgressiveRelease(root, run, true)` after immutable uploads, immediately before pointer mutation; require exact manifest/pointer/predecessor identities equal entry snapshot. Add after-manifest mutation tests for source bytes, semantic bytes, object bytes; assert no pointer write.
- B3. **High — shared Battle validator accepts wrong frozen executable bytes.** `validateReleaseData` calls `validateBattleRuntime` (`src/shell/release-validation.ts:92-95`), but validator checks only `[11,0]`, references, scripts, strings, ruleset membership (`src/battle/ports/battle-runtime-source.ts:296-327`). Frozen WASM SHA check exists only later inside Worker (`src/battle/worker/create-browser-runtime.ts:20-51`), after publication. Direct probe accepted one-byte `wasmBinary`; output: `accepted-wasm-sha-input-bytes=1`. Ticket requires pure validation to check frozen vendor identity (`artifacts/PLAN_2026_09_13_content_module_rearchitecture/T8_semantic-preparation.md:433`). Fix: publisher semantic path cryptographically bind exact frozen vendor manifest/WASM bytes before readiness; add wrong-WASM plus wrong-vendor-manifest producer/publisher rejection tests.
- B4. **Medium — recursive predecessor verification lacks safe bound plus sequence integrity.** Cycle set exists (`scripts/lib/asset-delivery/progressive-producer.ts:346-353`), but recursion has no max depth/byte/work budget (`scripts/lib/asset-delivery/progressive-producer.ts:471-477`). Verifier also omits `prior.manifest.releaseSequence < manifest.releaseSequence` at `scripts/lib/asset-delivery/progressive-producer.ts:478-484`; pack enforces this only during creation (`scripts/lib/asset-delivery/progressive-producer.ts:160-168`). Equal-sequence acyclic chains can therefore pass continuity because Story permits nondecreasing revision (`src/story/ports/story-continuity.ts:8-10`), enabling unbounded verification work. Fix: enforce strict predecessor sequence relation plus explicit history depth/work cap; add equal-sequence chain, cycle, cap-boundary, cap+1 tests.
- C1. **Correct — validation stamp not authority.** Verifier recomputes semantic input through `validateProgressiveSemantics` before comparing exact `validation.json` (`scripts/lib/asset-delivery/progressive-producer.ts:486-504`). Forged-stamp test rejects before transport (`tests/progressive-publisher.test.ts:394-405`).
- C2. **Correct — current source freshness includes metadata.** Current candidate verification hashes files, vendor files, plus `playerMetadata.sourceInputs` (`scripts/lib/asset-delivery/progressive-producer.ts:421-451`). Historical recursion intentionally passes `false` (`scripts/lib/asset-delivery/progressive-producer.ts:471-476`) → historical integrity, not obsolete workspace freshness.
- C3. **Correct — predecessor digest binds remote CAS state.** Candidate predecessor digest equals fetched remote pointer manifest digest (`scripts/lib/asset-delivery/progressive-publisher.ts:269-277`); pointer mutation uses fetched ETag (`scripts/lib/asset-delivery/progressive-publisher.ts:290-297`).
- C4. **Correct — idempotence preserved.** Exact current pointer match verifies remote manifest then returns before writes (`scripts/lib/asset-delivery/progressive-publisher.ts:260-267`); test asserts unchanged PUT count (`tests/progressive-publisher.test.ts:254-281`).
- C5. **Correct — shared validator composes owned domain rules.** Calls Cards consistency (`src/shell/release-validation.ts:37`), Decks validator with `PROTOTYPE_RULESET` (`src/shell/release-validation.ts:87-91`), Story release/continuity (`src/shell/release-validation.ts:92-94`), Battle validator (`src/shell/release-validation.ts:95`). No downloaded JS/migration path found in T8 producer diff; Lua/WASM remain declared runtime payload. B3 blocks frozen-byte trust.

## Evidence gaps

- E1. **Medium — fake prod CLI coverage has valid candidate only.** Single CLI transport test reaches `runContentPublish` with broad approval (`tests/progressive-publisher.test.ts:408-493`). Invalid stamp/stale predecessor/immutable conflict tests call `publishProgressiveRelease` directly (`tests/progressive-publisher.test.ts:355-405`), not CLI prod path. Add table-driven live CLI invalid candidates; assert exit `1`, exact stderr, transport closure, zero pointer writes.
- E2. **Medium — parity attestation not exhaustive.** Ticket requires inventory/test for every old verifier branch (`artifacts/PLAN_2026_09_13_content_module_rearchitecture/T8_semantic-preparation.md:21,443-450`). Report offers category summary only (`artifacts/IMPLEMENTATION-REPORT-T8.md:23-29`); focused parity tests cover token, zone, copy limit, text mismatch, duplicate/default/media/ref (`tests/unit/semantic-release-preparation.test.ts:284-369`). Baseline verifier has additional distinct branches (`5a3ba36:src/content/install/verify-gameplay.ts:21-177`) without branch-to-owner/test matrix. Most non-Deck structural checks remain in current verifier (`src/content/install/verify-gameplay.ts:16-153`), but evidence does not prove “each old verifier failure branch.” Add matrix listing old line/condition → owner fn → exact test.

## Validation

- V1. `node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts` → passed, 26/26.
- V2. `npx vitest run tests/unit/semantic-release-preparation.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose` → passed, 53/53.
- V3. `npm run test:legacy` → passed, 198/198.
- V4. `npm run typecheck` → passed, 0 errors; 4 existing warnings.
- V5. `git diff --check 5a3ba36`, staged check, vendor diff → passed; no staged files, no vendor diff.

## Residual risks

- R1. Build budget failure excluded from T8 blocking per task; T11 still must resolve `118072 > 115000`.
- R2. No live R2/deploy executed. Fake S3 only.
- R3. Requested `/home/aron/projects/ascencio/plan.md` plus `/home/aron/projects/ascencio/progress.md` absent (`ENOENT`); review used full T8 ticket, impl report, ledger, evidence, actual diff vs `5a3ba36`.

## Assumptions

A1. None. Findings derive from inspected source/tests/commands.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "B1-B4 provide severity, exact file:line evidence, impact, minimal fix/tests; E1-E2 plus R1-R3 record evidence gaps and residual risks."
    }
  ],
  "changedFiles": [
    "F1. artifacts/REVIEW-T8-publisher.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "id": "C1",
      "command": "graphify query \"T8 publisher release data CLI semantic trust validation predecessor history CAS pointer publication\"",
      "result": "passed",
      "summary": "Graph query returned T8 publisher/validation nodes; output truncated after 63/630 nodes."
    },
    {
      "id": "C2",
      "command": "node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts",
      "result": "passed",
      "summary": "26/26 passed."
    },
    {
      "id": "C3",
      "command": "npx vitest run tests/unit/semantic-release-preparation.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "53/53 passed."
    },
    {
      "id": "C4",
      "command": "npm run test:legacy",
      "result": "passed",
      "summary": "198/198 passed."
    },
    {
      "id": "C5",
      "command": "npm run typecheck",
      "result": "passed",
      "summary": "0 errors; 4 existing warnings."
    },
    {
      "id": "C6",
      "command": "node --input-type=module --eval '<wrong-WASM validateBattleRuntime probe>'",
      "result": "passed",
      "summary": "Probe demonstrated defect: one-byte wasmBinary accepted; output accepted-wasm-sha-input-bytes=1."
    },
    {
      "id": "C7",
      "command": "git diff --check 5a3ba36 && git diff --cached --quiet",
      "result": "passed",
      "summary": "Diff clean; index clean."
    }
  ],
  "validationOutput": [
    "O1. Focused Node: 26 passed, 0 failed.",
    "O2. Focused Vitest: 53 passed, 0 failed.",
    "O3. Legacy Node: 198 passed, 0 failed.",
    "O4. Typecheck: 0 errors, 4 warnings.",
    "O5. Wrong-WASM probe: accepted-wasm-sha-input-bytes=1."
  ],
  "residualRisks": [
    "R1. Existing build budget failure deferred to T11 per task.",
    "R2. No live R2/deploy validation performed.",
    "R3. plan.md/progress.md missing; ticket/report/ledger substituted."
  ],
  "noStagedFiles": true,
  "diffSummary": "Review-only T8 producer/publisher semantic-trust diff vs 5a3ba36; report artifact added, no source/test edits.",
  "reviewFindings": [
    "B1. high: content-publish-cli.ts:37-53 omits playerMetadata.sourceInputs from live rights scope.",
    "B2. high: progressive-publisher.ts:254,279-297 lacks immediate pre-pointer semantic/source rerun.",
    "B3. high: battle-runtime-source.ts:296-327 accepts wrong frozen WASM bytes; publisher trusts it.",
    "B4. medium: progressive-producer.ts:346-353,471-484 lacks lineage work cap and predecessor sequence check.",
    "E1. medium: progressive-publisher.test.ts exercises CLI prod path only for valid candidate.",
    "E2. medium: parity evidence lacks every-old-branch ownership/test matrix."
  ],
  "manualNotes": "Blocked. No source edits, subagents, live endpoint, deploy, stage, commit, or push."
}
```
