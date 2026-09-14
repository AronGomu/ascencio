# T7 runtime security/concurrency review

**Next human action:** Fix B1 first: verify `wasmBinary` SHA-256 against frozen `ocgcore.sync.wasm` digest inside Worker before `OcgCoreAdapter.initialize`.

**State:** `blocked` — 4 contract defects found. Review-only; no source edits.

## Review

### Blockers

- B1. **High · frozen engine identity not enforced at Worker trust boundary.** `parseBattleRuntimeInput` checks only `ArrayBuffer` type/size plus declared `[11,0]`; `validateBattleRuntime` checks only declared core version (`src/battle/ports/battle-runtime-source.ts:94-99,291-297`). Worker then executes supplied bytes before comparing runtime-reported version (`src/battle/worker/create-browser-runtime.ts:45-68`). Arbitrary ABI-compatible WASM reporting `[11,0]` can bypass frozen `ocgcore-wasm@0.1.2` identity → rules tampering/Worker DoS. T7 requires frozen vendor identity/version check (`artifacts/PLAN_2026_09_13_content_module_rearchitecture/T7_battle-runtime.md:85`). Minimal fix: hash `input.wasmBinary` in Worker, compare constant `7415337a6f88653b38e10faa3a087c0a5ab64dd27a7d7cf8a1e6872747c5c265` before initialization. Add test: one-byte-mutated real WASM rejects before `OcgCoreAdapter.initialize`; exact frozen WASM reaches ready.
- B2. **High · shutdown accepts stale non-disposal events.** `replace()` begins `#shutdownWorker()` without incrementing generation (`src/battle/app/DuelWorkerClient.ts:347-357,591-619`). `#receive()` checks generation/worker only, then applies/emits `ready`, `prompt`, `result`, errors while shutdown remains pending (`src/battle/app/DuelWorkerClient.ts:439-519`). Thus already-queued event from Worker being disposed can mutate store under stale generation, violating abort/dispose late-event rule. Minimal fix: process `disposed` acknowledgement first; ignore every other event while `#shutdown !== null`. Add test: call `replace()`, emit `ready` plus `prompt` before `disposed`, assert no listener emission/state change, then assert disposal resolves plus new Worker initializes normally.
- B3. **Medium · binding public contract omits `InitializeRuntimeCommand`.** Ticket declares interface in `src/battle/ports/battle-runtime-source.ts` through public `src/battle/ports/index.ts` (`artifacts/PLAN_2026_09_13_content_module_rearchitecture/T7_battle-runtime.md:54-82`). Impl defines it only in internal `src/battle/duel/contracts/duel-command.ts:26-29`; ports export list omits it (`src/battle/ports/index.ts:1-14`). Minimal fix: define/export interface from runtime port, import it into internal command union. Add exact export inventory/type-compat test.
- B4. **Medium · actual engine version mismatch loses required error code.** Post-initialization version comparison throws plain `Error` outside `runDuelRuntimeInitializationStage` (`src/battle/worker/create-browser-runtime.ts:60-68`). `toDuelError` maps plain errors to `engine_error` (`src/battle/worker/duel-errors.ts:101-111,142-151`), not preserved `engine_initialization_failed` required by T7 (`artifacts/PLAN_2026_09_13_content_module_rearchitecture/T7_battle-runtime.md:85`). Minimal fix: keep actual-version comparison inside engine initialization stage or throw typed `DuelOperationError`. Add mismatch regression asserting exact code plus no ready event.

### Correct

- C1. Semantic DTO parsing is bounded, dense, duplicate-rejecting, deeply rebuilt/frozen except transferable buffer; decimal `race` remains string (`src/battle/ports/battle-runtime-source.ts:71-288`). `race → bigint`, `linkMarker → link_marker` occur Worker-side only (`src/battle/worker/create-browser-runtime.ts:103-144`).
- C2. Full support catalog stays distinct from chapter allowlist; both seats combine before `assertInstalledCardPool`, before core session creation (`src/battle/worker/decks/resolve-duel-decks.ts:50-83,111-125`). Real-WASM test confirms both-seat rejection plus support-only token availability (`tests/integration/installed-runtime-wasm.test.ts:46-108`).
- C3. Fresh-buffer/replacement path aborts pending source load, transfers one WASM buffer, pins snapshot ID (`src/battle/app/DuelWorkerClient.ts:152-224,591-599`). Focused client tests passed, including detach/reload/late-load cases (`tests/unit/duel-worker-client.test.ts:598-655`).
- C4. Concealment path remains Worker-projected. Opponent list absent from emitted events; hidden cards avoid image resolution in existing tests (`tests/unit/duel-worker-runtime.test.ts:954-987`, `tests/component/DuelHud.test.ts:58-61,131-134`). Optional art removed from engine support check (`src/battle/worker/decks/resolve-duel-decks.ts:91-108`).
- C5. Vendor source unchanged vs `86631c9`; `npm run vendor:verify` reports `ocgcore-wasm`, `0.1.2`, 21 files. Real Chromium run reached Worker ready → prompt → surrender, detached sender buffer, 1/1 passed.

## Assumptions

- A1. Missing requested `/home/aron/projects/ascencio/plan.md` plus `/home/aron/projects/ascencio/progress.md` (`ENOENT`). Review used T7 ticket, impl report, evidence inventory, actual diff vs `86631c9`.
- A2. Public `BattleRuntimeSource` is untrusted at Battle boundary because contract exposes injectable source plus requires Worker-side validation. Shell Content integrity checks do not satisfy B1 for arbitrary source impls.

## Residual risks

- R1. Full `npm run lint` remains env-blocked: `No tsconfigRootDir was set, and multiple candidate TSConfigRootDirs are present`. Existing scoped lint evidence passes; not treated as full-lint pass.
- R2. Existing full installer browser path remains preflight-blocked by `CONTENT_INVALID_MANIFEST` / `ASSET_INTEGRITY_FAILED` for unrelated cropped art. Optional art does not reject T7 product runtime.
- R3. Prior malformed runtime-acceptance JSON report provides no attestation. Direct source inspection plus native Chromium rerun passed; product not rejected for report serialization failure.
- R4. Browser harness directly posts Worker commands; it proves native Worker/WASM transport, not B2 client shutdown race. B2 needs added client regression.

## Evidence

- E1. Exact ticket Vitest: 5 files, 61/61 passed.
- E2. Client/runtime/privacy-focused Vitest: 4 files, 67/67 passed.
- E3. Native Chromium: 1/1 passed in 7.6s.
- E4. Typecheck: 0 errors, 4 existing Svelte warnings.
- E5. `git diff --check 86631c9` passed; vendor diff empty; staging empty before report write.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "B1-B4 provide severity, concrete file:line evidence, minimal fixes, and required regression tests; R1-R4 record residual risks."
    }
  ],
  "changedFiles": [
    "artifacts/REVIEW-T7-runtime.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "npx vitest run tests/unit/battle-runtime-input.test.ts tests/unit/card-visibility.test.ts tests/unit/domain-boundaries.test.ts tests/integration/installed-runtime.test.ts tests/integration/installed-runtime-wasm.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "E1. 5 files, 61 tests passed."
    },
    {
      "command": "npx vitest run tests/unit/duel-worker-client.test.ts tests/unit/duel-worker-runtime.test.ts tests/unit/installed-battle-images.test.ts tests/unit/resolve-duel-decks.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "E2. 4 files, 67 tests passed."
    },
    {
      "command": "env -u CONTENT_RUN npx playwright test -c playwright.content.config.ts --project=chromium e2e-content/t7-runtime.spec.ts --reporter=line",
      "result": "passed",
      "summary": "E3. Native Chromium Worker/WASM test passed 1/1 in 7.6s."
    },
    {
      "command": "npm run vendor:verify",
      "result": "passed",
      "summary": "E4. ocgcore-wasm 0.1.2; 21 files verified."
    },
    {
      "command": "npm run typecheck",
      "result": "passed",
      "summary": "E5. 0 errors; 4 existing warnings."
    }
  ],
  "validationOutput": [
    "V1. Exact T7 suite: Test Files 5 passed; Tests 61 passed.",
    "V2. Runtime/client suite: Test Files 4 passed; Tests 67 passed.",
    "V3. Chromium: 1 passed (7.6s).",
    "V4. Vendor: status ok, package ocgcore-wasm, version 0.1.2, files 21.",
    "V5. Typecheck: svelte-check found 0 errors and 4 warnings in 3 files."
  ],
  "residualRisks": [
    "R1. Full lint blocked by unrelated duplicate TS config root under .tmp/worktrees/core-integrate.",
    "R2. Full installer browser path blocked by unrelated malformed/integrity-failing old bundle.",
    "R3. Malformed acceptance JSON is non-evidence; direct Chromium evidence passed.",
    "R4. Native harness bypasses DuelWorkerClient, so B2 remains untested."
  ],
  "noStagedFiles": true,
  "diffSummary": "Read-only review of T7 actual 54-path diff vs 86631c9. No source edits; review artifact only.",
  "reviewFindings": [
    "B1 high: src/battle/ports/battle-runtime-source.ts:94-99,291-297 and src/battle/worker/create-browser-runtime.ts:45-68 - arbitrary ABI-compatible WASM lacks frozen digest check.",
    "B2 high: src/battle/app/DuelWorkerClient.ts:347-357,439-519 - non-disposal events remain accepted during shutdown.",
    "B3 medium: src/battle/ports/index.ts:1-14 - required public InitializeRuntimeCommand omitted.",
    "B4 medium: src/battle/worker/create-browser-runtime.ts:60-68 - actual version mismatch maps to engine_error instead of engine_initialization_failed."
  ],
  "manualNotes": "Review blocked on B1-B4. Real Chromium Worker runtime itself passed; unrelated lint/bundle/report gaps not misreported as product failures."
}
```
