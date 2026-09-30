# Content/SW implementation · F1–F6

State: **done — impl + targeted checks; fresh review pending**. Worktree: `/home/aron/Projects/ascencio/.tmp/codebase-audit-content`. No staging, commits, pushes, subagents, dependency changes, live downloads, deploys.

## Evidence

- E1. Final regression run: **23 files / 316 tests passed**, `--maxWorkers=2`, 97.96s. Log: `content-evidence/full-green.log`.
- E2. F1 built Chromium: **1 passed**, 22.5s. Failed first precache retained candidate cache → online retry → controlled/offline-ready without approval. Test: `e2e-core/offline-shell.spec.ts:149`. Log/trace: `content-evidence/core-browser.log`, `content-evidence/core-test-results/`.
- E3. F6 current Shell runtime isolation Chromium regression: **passed**. Open Battle v2 DB remained v2; preference retained; no versionchange; Shell receipt valid; installer committed. Log: `content-evidence/e2e-focused.log`.
- E4. F2–F5 red: **30 failed / 38 passed** before fixes. F1 red: **2 failed / 1 passed** after correcting missing build-constant test setup. Logs: `content-evidence/red.log`, `content-evidence/sw-red.log`.
- E5. F6 red reproduced exact stale import error: `Error: page.evaluate: TypeError: Failed to fetch dynamically imported module: http://127.0.0.1:4402/src/battle/storage/installed-runtime-receipt.ts`. Log: `content-evidence/e2e-red.log`.
- E6. Owned ESLint passed. Private local production build passed; SW precache: 70 entries. `git diff --check` passed. `git diff --cached --name-only` empty.

## Implemented

- F1. **Interrupted first install no longer loses exemption.** Active worker or scope-keyed activation marker proves prior installed CORE. Partial candidate caches do not. Marker written during activation, never during precache; prior active legacy workers remain approval-gated. Sources: `src/service-worker.ts:22–42,74–88`, `src/shell/pwa/shell-cache-policy.ts:1–2,30–35`. Unit tests cover partial failure, interruption before activation, prior activated install, active legacy worker.
- F2. **Historical corruption no longer prevents store open/read/recovery.** Strict job validation + lock-protected interruption recovery moved to job enumeration. Corrupt rows still reject list/resume; remain byte-identical until explicit cleanup. Cleanup uses lifecycle/download lock authority, not untrusted job rows. Sources: `src/content/storage/progressive-content-store.ts:511–533,604–650`, `src/shell/application/content-actions.ts:429–445`. Real-store regression verifies healthy current release with missing historical manifest remains readable; explicit delete-all preserves Story generation.
- F3. **Decoded integrity independent of transport length.** Removed `Content-Length` comparison. Decoded streaming cap, final exact byte count, SHA-256 checks retained. Source: `src/content/storage/progressive-storage-validation.ts:101–125`. Local HTTP gzip regression validates real Fetch decoding; hidden-encoding/transport-length case covered.
- F4. **Same-release repair enabled after explicit check detects required-byte loss.** Requires exact selected manifest identity + sequence; uses existing Install action. Download reuses healthy bytes; same-release completion verifies selected receipt, disposes prepared resources, skips selector CAS/save migration. Sources: `src/shell/application/content-actions.ts:224–235,277–299,377–427,553–609`. Real-store tests cover corrupt/evicted required body; only damaged file fetched; media retained; selector/save-generation unchanged. Resume shares repair completion path.
- F5. **Rejected streams cancelled.** Decoded overflow/read failures cancel reader before unlock; cancel failure cannot replace original error. Non-OK HTTP response bodies cancelled too. Sources: `src/content/storage/progressive-storage-validation.ts:116–122`, `src/content/storage/progressive-content-store.ts:113–118`. Tests cover exactly-once cancellation, bounded pulls, malformed/truncated decoded bytes, cancellation rejection.
- F6. **Legacy browser harness uses current Shell seams.** Deleted Battle imports replaced with Shell adapters. Obsolete Battle-v3-upgrade failure/abort tests replaced by current isolation contract, not weakened assertions. Crash-orphan test assertions retained. Sources: `e2e-content/installer.spec.ts:58–62,355–360,429–434,442–535`; ownership evidence: `src/shell/adapters/legacy-installed-runtime-receipt.ts:10–11`, `src/shell/adapters/runtime-activation.ts:4–12`. Legacy suite is not progressive-install acceptance.

## Changed paths

- P1. `src/content/storage/progressive-content-store.ts`
- P2. `src/content/storage/progressive-storage-validation.ts`
- P3. `src/service-worker.ts`
- P4. `src/shell/application/content-actions.ts`
- P5. `src/shell/pwa/shell-cache-policy.ts`
- P6. `tests/unit/content-actions.test.ts`
- P7. `tests/unit/core-precache.test.ts`
- P8. `tests/unit/progressive-download.test.ts`
- P9. `tests/unit/progressive-storage.test.ts`
- P10. `tests/unit/content-recovery.test.ts` — new
- P11. `tests/unit/progressive-response.test.ts` — new
- P12. `tests/unit/service-worker-install.test.ts` — new
- P13. `e2e-content/installer.spec.ts`
- P14. `e2e-core/offline-shell.spec.ts`

## Commands

Exact final unit cmd:

```sh
npx vitest run tests/unit/progressive-download.test.ts tests/unit/progressive-storage.test.ts tests/unit/progressive-release.test.ts tests/unit/progressive-manifest.test.ts tests/unit/progressive-manifest-memo.test.ts tests/unit/content-installer.test.ts tests/unit/content-storage.test.ts tests/unit/content-runtime-activation.test.ts tests/unit/installed-assets.test.ts tests/unit/installed-gameplay.test.ts tests/unit/installed-images.test.ts tests/unit/manifest-closure-reduction.test.ts tests/unit/verify-gameplay-parity.test.ts tests/unit/chapter-gameplay.test.ts tests/unit/core-precache.test.ts tests/unit/core-update-approval.test.ts tests/unit/core-bootstrap.test.ts tests/unit/application-selector.test.ts tests/unit/application-readiness.test.ts tests/unit/content-actions.test.ts tests/unit/progressive-response.test.ts tests/unit/service-worker-install.test.ts tests/unit/content-recovery.test.ts --maxWorkers=2
```

Exact red cmds:

```sh
npx vitest run tests/unit/progressive-response.test.ts tests/unit/progressive-storage.test.ts tests/unit/content-actions.test.ts --maxWorkers=2
npx vitest run tests/unit/service-worker-install.test.ts --maxWorkers=2
npx playwright test -c playwright.content.config.ts --project=chromium e2e-content/installer.spec.ts --grep 'prepared receipt orphan' --timeout=45000
```

Exact other checks:

```sh
npx vitest run tests/unit/progressive-response.test.ts tests/unit/progressive-storage.test.ts tests/unit/content-actions.test.ts tests/unit/service-worker-install.test.ts tests/unit/core-precache.test.ts tests/unit/core-update-approval.test.ts tests/unit/progressive-download.test.ts tests/unit/application-readiness.test.ts --maxWorkers=2
npx vitest run tests/unit/content-recovery.test.ts --maxWorkers=2
npx vite build --mode private --outDir .tmp/content-worker/core/dist-a
npx playwright test -c .tmp/content-worker/playwright.core.config.ts --project=chromium e2e-core/offline-shell.spec.ts --grep 'failed first precache'
npx playwright test -c playwright.content.config.ts --project=chromium e2e-content/installer.spec.ts --timeout=60000
npx playwright test -c .tmp/content-worker/playwright.config.ts --project=chromium e2e-content/installer.spec.ts --timeout=45000 --max-failures=2
npx playwright test -c .tmp/content-worker/playwright.config.ts --project=chromium e2e-content/installer.spec.ts --grep 'prepared receipt orphan|Shell runtime activation' --timeout=60000
npx playwright test -c .tmp/content-worker/playwright.config.ts --project=chromium e2e-content/installer.spec.ts --grep 'prepared receipt orphan' --timeout=60000
npx tsc --noEmit
npx eslint src/content/storage/progressive-content-store.ts src/content/storage/progressive-storage-validation.ts src/service-worker.ts src/shell/application/content-actions.ts src/shell/pwa/shell-cache-policy.ts tests/unit/content-actions.test.ts tests/unit/core-precache.test.ts tests/unit/progressive-download.test.ts tests/unit/progressive-storage.test.ts tests/unit/progressive-response.test.ts tests/unit/service-worker-install.test.ts tests/unit/content-recovery.test.ts e2e-content/installer.spec.ts e2e-core/offline-shell.spec.ts
git diff --check
git diff --cached --name-only
```

- C1. First intermediate green run: 101 passed, 2 failed — remaining legacy tests expected store-open rejection. Updated those assertions to require open recovery handle + strict list rejection. Next run: 104 passed. Final expanded run: E1.
- C2. Private build initially invoked without `--mode private`; correctly rejected: `Error: Public deployment is not approved; use the explicit private build mode`. Corrected invocation passed. No deployment attempted.
- C3. Core default harness skipped: `scripts/core-source-only-server.ts` invokes `npm ci`. Scratch harness reused local private build + existing `scripts/core-pwa-fixture-server.ts`, root-only F1 test. No dependency installation.
- C4. Scratch configs preserved in `content-evidence/{vite.config.ts,playwright.config.ts,playwright.core.config.ts}` for reproducibility. Original `.tmp/content-worker/` removed after logs/configs/traces moved to evidence. Restoring configs to original scratch location + rerunning private build reproduces root-only CORE setup.

## Residuals / review gate

- R1. **Full legacy Chromium suite not green.** Initial full run timed out at 180s; trace console showed `Failed to load resource: net::ERR_NETWORK_CHANGED` on valid module loads. Scratch-config run: 5 passed, 2 failed before intended assertions; failures: valid `/src/content/index.ts` dynamic import, one `CONTENT_STORAGE_UNAVAILABLE` during installer creation. Focused run: Shell isolation passed; crash-orphan failed at valid content import. No assertion weakening/retry loop added. Final orphan attempt blocked by tooling worker occupying port 4402. Parent explicitly stopped retries; parent/reviewer owns final browser validation. Logs/traces retained under `content-evidence/`.
- R2. **Isolated-worktree tsc fails known baseline fixture:** `tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'.` No owned-path errors reported. Parent confirmed root user-owned fixture correction + successful root typecheck; fixture left untouched. First tsc attempt timed out at 90s; bounded second completed with above error.
- R3. F1 full CORE consent suite not run here; unit consent tests + actual first-install retry Chromium passed. Parent should validate integrated CORE approval flow.
- R4. F4 local refresh now verifies required bytes, beyond prior media inspection. No production-sized performance benchmark claimed. No automatic payload download.
- R5. Corrupt jobs still block job-management discovery/resume deliberately; healthy content reads + explicit content-only cleanup remain usable. No silent dropping/quarantine or origin-wide clear.
- R6. Fresh reviewer required, not launched by worker. Review F1 activation-marker lifecycle, F2 job-list mutation/lock exclusion, F4 same-release completion races, F6 legacy semantics.

## Assumptions

- A1. Graphify unavailable per task → direct-source fallback; no graph/dependency setup.
- A2. ADR-092–094 current progressive lifecycle governs repair; legacy ZIP tests cover compatibility only.
- A3. Activation marker is scope-keyed durable evidence of prior successful CORE installation. Existing active legacy worker supplies equivalent evidence before marker exists. Arbitrary old cache names alone cannot prove completed install.
- A4. Same immutable selected release repair restores bytes, not save schema; selector/save generation must remain unchanged. Different manifest at equal sequence never enables repair through `canInstall`.
- A5. Shared `node_modules` symlink was pre-existing untracked input; preserved. No whole-worktree-clean claim.

## Next action

Parent: apply only P1–P14; keep new tests. Run required fresh review, integrated typecheck, isolated-port legacy Chromium suite. Evidence sufficient for checked-level independent review; browser gaps remain explicit.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "F1-F6 narrow fixes across 5 owned source files and 9 test files; no foreign worker paths, dependency/config changes, selector/save schema changes, automatic downloads, origin-wide clearing, or corrupt-row dropping."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Red failures, final 23-file/316-test green run, real first-install retry Chromium pass, Shell/Battle isolation Chromium pass, exact commands, retained logs/traces, changed paths, unstaged proof, and explicit incomplete browser/typecheck evidence. Fresh review remains required."
    }
  ],
  "changedFiles": [
    "src/content/storage/progressive-content-store.ts",
    "src/content/storage/progressive-storage-validation.ts",
    "src/service-worker.ts",
    "src/shell/application/content-actions.ts",
    "src/shell/pwa/shell-cache-policy.ts",
    "tests/unit/content-actions.test.ts",
    "tests/unit/core-precache.test.ts",
    "tests/unit/progressive-download.test.ts",
    "tests/unit/progressive-storage.test.ts",
    "tests/unit/content-recovery.test.ts",
    "tests/unit/progressive-response.test.ts",
    "tests/unit/service-worker-install.test.ts",
    "e2e-content/installer.spec.ts",
    "e2e-core/offline-shell.spec.ts"
  ],
  "testsAddedOrUpdated": [
    "tests/unit/content-actions.test.ts",
    "tests/unit/core-precache.test.ts",
    "tests/unit/progressive-download.test.ts",
    "tests/unit/progressive-storage.test.ts",
    "tests/unit/content-recovery.test.ts",
    "tests/unit/progressive-response.test.ts",
    "tests/unit/service-worker-install.test.ts",
    "e2e-content/installer.spec.ts",
    "e2e-core/offline-shell.spec.ts"
  ],
  "commandsRun": [
    { "command": "Exact final 23-file Vitest command in Commands, --maxWorkers=2", "result": "passed", "summary": "23 files; 316 tests; 97.96s." },
    { "command": "Exact red Vitest commands in Commands", "result": "failed", "summary": "F2-F5: 30 failed/38 passed. F1: 2 failed/1 passed before impl." },
    { "command": "npx vitest run tests/unit/content-recovery.test.ts --maxWorkers=2", "result": "passed", "summary": "3 real-store recovery/repair tests." },
    { "command": "npx vite build --mode private --outDir .tmp/content-worker/core/dist-a", "result": "passed", "summary": "Private production build; SW 70 precache entries." },
    { "command": "npx playwright test -c .tmp/content-worker/playwright.core.config.ts --project=chromium e2e-core/offline-shell.spec.ts --grep 'failed first precache'", "result": "passed", "summary": "1 passed; actual failed first install retries without approval." },
    { "command": "npx playwright test -c .tmp/content-worker/playwright.config.ts --project=chromium e2e-content/installer.spec.ts --grep 'prepared receipt orphan|Shell runtime activation' --timeout=60000", "result": "failed", "summary": "Shell isolation passed; orphan test blocked by valid-module network import failure." },
    { "command": "Legacy full-browser commands in Commands", "result": "failed", "summary": "Initial timeout; bounded retry 5 passed/2 failed before assertions. ERR_NETWORK_CHANGED trace evidence; one storage-open failure." },
    { "command": "Final focused orphan command in Commands", "result": "failed", "summary": "Port 4402 occupied by tooling worker; no test executed. Parent stopped retries." },
    { "command": "npx tsc --noEmit", "result": "failed", "summary": "Known isolated fixture TS2345 at tests/fixtures/node-duel-worker-harness.ts:96; parent root fix preserved." },
    { "command": "Exact owned-path ESLint command in Commands", "result": "passed", "summary": "Exit 0." },
    { "command": "git diff --check; git diff --cached --name-only", "result": "passed", "summary": "No whitespace errors; no staged paths." }
  ],
  "validationOutput": [
    "Test Files 23 passed (23); Tests 316 passed (316)",
    "F1 Chromium: 1 passed (22.5s)",
    "F6 focused Chromium: 1 passed, 1 failed; passing test validates current Shell runtime/Battle DB isolation",
    "Real-store repair fetched only damaged required file; media, selector, Story generation retained",
    "Historical corrupt job metadata preserved until explicit cleanup; healthy selected bytes remain readable",
    "Owned lint exit 0; private build exit 0; staged diff empty"
  ],
  "residualRisks": [
    "Fresh reviewer required; parent owns integrated validation.",
    "Full legacy Chromium suite incomplete due environment/network/storage-open failures; final retry port-conflicted.",
    "Isolated tsc baseline fixture error; parent reports root correction and passing root typecheck.",
    "Full CORE consent/browser suite not executed; actual interrupted-first-install retry passed.",
    "Required-byte verification during refresh not production-performance-benchmarked."
  ],
  "noStagedFiles": true,
  "diffSummary": "14 owned source/test paths changed; F1-F6 implemented; 3 new unit-test files. Evidence outside worktree source, scratch removed, shared node_modules preserved.",
  "reviewFindings": [
    "Required fresh review pending; no independent final review claimed.",
    "No known remaining F1-F5 failure in final targeted suite; F6 browser completeness remains explicit residual."
  ],
  "manualNotes": "Parent steering honored: no more environment retries, no port interference. Removed owned .tmp/content-worker directory after preserving logs/configs/traces under /home/aron/Projects/ascencio/artifacts/codebase-audit/content-evidence. No staging/commit/push."
}
```
