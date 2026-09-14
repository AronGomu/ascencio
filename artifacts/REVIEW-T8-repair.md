# T8 repair independent acceptance

State: **done — accepted**. No in-scope blocker remains.

## Review

- R1. **Correct:** rights/provenance chain now binds every declared metadata input by exact file path + SHA-256. `metadata` cannot use tree/future approval; live CLI also binds parsed canonical inventory digest before transport creation (`scripts/lib/asset-delivery/publication-approval.ts:4-18,32-51`; `scripts/lib/asset-delivery/content-publish-cli.ts:22-66,127-142`). Denied metadata test stops before transport (`tests/progressive-publisher.test.ts:631-664`); schema test rejects metadata tree approval (`tests/asset-delivery-contracts.test.ts:1167-1220`).
- R2. **Correct:** immutable file bytes receive local length/hash checks before PUT. Full source/object/semantic verification reruns inside retry callback immediately before each pointer CAS; inventory/manifest/pointer/predecessor identities must equal entry snapshot (`scripts/lib/asset-delivery/progressive-publisher.ts:249-325`). Source, semantic, object, pointer, valid-candidate replacement, transport-factory provenance, upload provenance tests all assert no pointer PUT (`tests/progressive-publisher.test.ts:556-700,897-1026`).
- R3. **Correct:** Battle-owned async gate hashes copied vendor-manifest + WASM bytes against frozen SHA-256 values (`src/battle/ports/frozen-battle-executable.ts:1-23`). Producer gates same WASM bytes later passed into `parseBattleRuntimeInput` (`scripts/lib/asset-delivery/progressive-semantic-validation.ts:240-260`); preparation gates required bytes before readiness (`src/shell/adapters/progressive-release-data.ts:190-200`). Wrong self-consistent executable fixtures fail before transport/readiness (`tests/progressive-publisher.test.ts:844-895`; `tests/progressive-producer.test.ts:677-702`; `tests/unit/semantic-release-preparation.test.ts:511-516`). Pure sync `validateReleaseData` intentionally remains hash-free; no custom SHA impl demanded.
- R4. **Correct:** predecessor traversal is iterative. Normalized-run cycle detection, strict decreasing sequence, 4096-release cap, 64-GiB cumulative declared payload/envelope cap apply before payload object hash reads; object size gets stat-checked before read (`scripts/lib/asset-delivery/progressive-producer.ts:336-404,437-451`; `scripts/lib/asset-delivery/progressive-history.ts:3-24`). Boundary/equal/increasing/cycle integration tests pass (`tests/progressive-producer.test.ts:628-675,705-776`).
- R5. **Correct:** staged identity gets `structuredClone`, complete shape validation, nested `chapterIds` freeze before first await; returned release uses same frozen snapshot (`src/shell/application/prepared-release.ts:25-40,70-78,89-114`). Mutation + malformed-input tests prove pinned lazy reads plus zero pre-validation I/O (`tests/unit/semantic-release-preparation.test.ts:390-445`).

## Original finding disposition

| Finding | Disposition | Evidence |
|---|---|---|
| Publisher B1 high | Fixed | Metadata source digests enter live scope at `scripts/lib/asset-delivery/content-publish-cli.ts:50-66`; file-only schema at `scripts/lib/asset-delivery/publication-approval.ts:4-18,32-51`; denied case at `tests/progressive-publisher.test.ts:631-664`. |
| Publisher B2 high | Fixed | Upload check at `scripts/lib/asset-delivery/progressive-publisher.ts:295-305`; pre-CAS retry verification + identity comparison at `scripts/lib/asset-delivery/progressive-publisher.ts:308-323`; mutation cases at `tests/progressive-publisher.test.ts:556-629,666-700,897-1026`. |
| Publisher B3 high | Fixed | Async frozen digest gate at `src/battle/ports/frozen-battle-executable.ts:1-23`; producer/preparation calls at `scripts/lib/asset-delivery/progressive-semantic-validation.ts:240-260` + `src/shell/adapters/progressive-release-data.ts:190-200`. |
| Publisher B4 medium | Fixed | Iterative traversal at `scripts/lib/asset-delivery/progressive-producer.ts:336-364`; caps/sequence/cycle at `scripts/lib/asset-delivery/progressive-history.ts:3-24`; tests at `tests/progressive-producer.test.ts:628-675,705-776`. |
| Publisher E1 medium | Fixed | Table-driven live CLI invalid candidates assert exact errors, transport ownership/closure, zero pointer writes at `tests/progressive-publisher.test.ts:702-786`; mutation coverage at `tests/progressive-publisher.test.ts:556-664,960-1026`. |
| Publisher E2 medium | Fixed | 40-row old-line → owner → named-negative matrix at `artifacts/T8-REPAIR-EVIDENCE/verifyGameplay-parity.md:15-58`; structural suite 27/27; semantic suite includes raw JSON MIME + 4-MiB byte caps at `tests/unit/semantic-release-preparation.test.ts:760-788`. |
| Preparation B1 high | Fixed | Shared four-slot queue at `src/shell/adapters/progressive-release-media.ts:28-56,59-100`; card/map/set queue + exact queued abort tests at `tests/unit/semantic-release-preparation.test.ts:447-486,649-691`. |
| Preparation B2 high | Fixed | Pre-await frozen staged snapshot at `src/shell/application/prepared-release.ts:25-40,89-114`; post-call input mutation cannot retarget lazy reads per `tests/unit/semantic-release-preparation.test.ts:390-423`. |
| Preparation B3 high | Fixed | Shell view models use consumer semantics, not Content refs (`src/shell/core/installed-inputs.ts:1-63`); whole-Shell AST scan + direct, renamed, alias, import-type, export-star, multi-hop negatives at `tests/unit/domain-boundaries.test.ts:1128-1241`. |
| Preparation N1 medium | Fixed | One release closure owns active-map deletion + URL revocation (`src/shell/adapters/progressive-release-media.ts:84-93,127-132`); repeated dispose/release revokes once (`tests/unit/semantic-release-preparation.test.ts:488-508`). |

## UI adapter acceptance

- U1. **Correct:** Shell routes consume `ShellGameplay`, `ShellBootstrap`, `ShellInstaller`, `ShellSession`; raw Content values stay inside application/adapters (`src/shell/core/installed-inputs.ts:1-63`; `src/shell/application/core-startup.ts:1-16`; `src/shell/application/legacy-installer.ts:1-47`).
- U2. **Correct:** installer, admin, free-play, editor flows preserve prior UI behavior through semantic wrappers. Installer state/progress/error/oninstalled mapping remains explicit (`src/shell/screens/InstallContentScreen.svelte:15-128`); focused bootstrap/UI regression run passes 56/56.
- U3. **Correct:** lazy split remains. Installer, admin, free-play screen, duel, deck editor stay behind dynamic/loader boundaries (`src/shell/AppShell.svelte:672-696,742-760,766-770,823-837,849-850`). No budget-limit/vendor/package edit found.

## Validation

| ID | Command | Result |
|---|---|---|
| V1 | `graphify query "T8 security repair rights metadata provenance digest transport factory upload pre-CAS retries async Battle gate sequence cycle caps media read queue Content type laundering legacy parity"` | Passed; graph read only, output truncated. Refresh intentionally skipped. |
| V2 | `npx vitest run tests/unit/semantic-release-preparation.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose` | Passed: 2 files, 101/101 tests. |
| V3 | `node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts` | Passed: 47/47 tests. |
| V4 | `npx vitest run tests/unit/verify-gameplay-parity.test.ts --reporter=verbose` | Passed: 27/27 tests. |
| V5 | `npx vitest run tests/component/AppShell.test.ts tests/component/core-menu.test.ts tests/component/content-installer.test.ts tests/unit/core-gate.test.ts --reporter=verbose` | Passed: 4 files, 56/56 tests; only known fixture unused-export warnings. |
| V6 | `node --test --test-name-pattern='metadata approval requires exact normalized path/digest' tests/asset-delivery-contracts.test.ts` | Passed: 1/1 test. |
| V7 | `git diff --check && git diff --cached --quiet && git diff --exit-code -- vendor/ package.json package-lock.json` | Passed: no whitespace error, staged file, vendor/package delta. |

## Blocker

- B1. None.

## Residual risks

- K1. No live endpoint, real credentials, deploy, publication, or factual asset-rights approval exercised. Fake transport validates code path only.
- K2. T9 activation/save lifecycle remains deferred by scope.
- K3. Graph refresh remains skipped due known quota; source/tests supplied acceptance evidence.

## Files touched

- F1. `artifacts/REVIEW-T8-repair.md` only. No source/test edit, stage, commit, push, live action, vendor/package change, or subagent.

## Assumptions

- A1. Acceptance targets current worktree represented by repair report + original review reports. Existing dirty source belongs reviewed repair; reviewer made no source attribution beyond inspected diff.
- A2. Async Web Crypto digest gate is intended design. Sync `validateReleaseData` remains pure by explicit task direction.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "No remaining blocker. Every original publisher B1-B4/E1-E2 plus preparation B1-B3/N1 finding has source/test disposition with current file:line evidence in artifacts/REVIEW-T8-repair.md."
    }
  ],
  "changedFiles": [
    "artifacts/REVIEW-T8-repair.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "graphify query \"T8 security repair rights metadata provenance digest transport factory upload pre-CAS retries async Battle gate sequence cycle caps media read queue Content type laundering legacy parity\"",
      "result": "passed",
      "summary": "Read-only graph query completed; output truncated. No refresh attempted."
    },
    {
      "command": "npx vitest run tests/unit/semantic-release-preparation.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "2 files, 101/101 tests passed."
    },
    {
      "command": "node --test tests/progressive-producer.test.ts tests/progressive-publisher.test.ts",
      "result": "passed",
      "summary": "47/47 tests passed."
    },
    {
      "command": "npx vitest run tests/unit/verify-gameplay-parity.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "1 file, 27/27 tests passed."
    },
    {
      "command": "npx vitest run tests/component/AppShell.test.ts tests/component/core-menu.test.ts tests/component/content-installer.test.ts tests/unit/core-gate.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "4 files, 56/56 tests passed; known fixture unused-export warnings only."
    },
    {
      "command": "node --test --test-name-pattern='metadata approval requires exact normalized path/digest' tests/asset-delivery-contracts.test.ts",
      "result": "passed",
      "summary": "1/1 test passed."
    },
    {
      "command": "git diff --check && git diff --cached --quiet && git diff --exit-code -- vendor/ package.json package-lock.json",
      "result": "passed",
      "summary": "No whitespace error, staged file, vendor delta, or package delta."
    }
  ],
  "validationOutput": [
    "Focused repair Vitest: 101 passed, 0 failed.",
    "Producer/publisher Node: 47 passed, 0 failed.",
    "Legacy structural parity: 27 passed, 0 failed.",
    "Bootstrap/UI preservation: 56 passed, 0 failed.",
    "Metadata file-only approval: 1 passed, 0 failed."
  ],
  "residualRisks": [
    "No live R2 endpoint, real credential, deployment, publication, or factual asset-rights approval exercised.",
    "T9 activation/save lifecycle remains deferred.",
    "Graph refresh skipped due known quota."
  ],
  "noStagedFiles": true,
  "diffSummary": "Independent read-only acceptance. Added review artifact only; no source/test/vendor/package edits. All 10 original B/E/N findings accepted as repaired.",
  "reviewFindings": [
    "no blockers",
    "publisher B1-B4 fixed: exact metadata rights scope, canonical inventory identity, upload hash checks, per-attempt pre-CAS verification, async frozen executable gate, iterative sequence/cycle/work caps",
    "publisher E1-E2 fixed: invalid live CLI matrix plus exhaustive 40-row legacy ownership/test mapping",
    "preparation B1-B3/N1 fixed: frozen staged input before await, shared four-slot media queue, exact abort, single revoke, Content-safe Shell models/AST boundaries",
    "UI adapters preserve bootstrap/installer/free-play/editor behavior; lazy boundaries remain"
  ],
  "manualNotes": "Accepted current T8 repair. Pure synchronous validateReleaseData intentionally remains hash-free; Battle-owned async validateFrozenBattleExecutable performs exact vendor/WASM SHA-256 checks before publish/prepared readiness."
}
```
