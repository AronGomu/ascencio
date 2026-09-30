# Content integrity review

State: **done · APPROVED after review fixes**. Scope: worker F1–F6. Full-repo acceptance **not claimed**.

## Review

- R1. **Fixed · high · recovery/cleanup race.** `src/content/storage/progressive-content-store.ts:606–642`: recovery held per-job lock; cleanup held different lifecycle/download locks. Enumeration could read running job, await manifest validation, then recreate paused job after delete-all cleared jobs/manifests. Recreated orphan made subsequent enumeration fail integrity checks. Deterministic regression failed before fix: `AssertionError: expected [ { request: { …(4) }, …(1) } ] to deeply equal []`. Fix: atomic IDB readwrite compare/put; omit concurrently deleted rows from enumeration (`:529–533,629–636`). Test: `tests/unit/progressive-storage.test.ts:565–604`. Red → green; full regressions green.
- R2. **Fixed · medium · browser fixture isolation.** `e2e-content/installer.spec.ts:21–52,430,458`: API fixtures previously booted live Shell on initial navigation/reload/new-page recovery. Fixture bootstrap/routes also hardcoded port4402. Added context-routed same-origin blank document; derive delivery origin from Playwright baseURL. Real Cache/IDB, page close/reopen, paused-job recovery, orphan receipt, atomic-abort assertions unchanged (`:184–220,356–451`). Port4511 + unique optimizer cache alone: targeted 2/3 passed; full 9/10 passed, remaining failure during dynamic import. Blank fixture: **10/10 passed**. Local trace showed `net::ERR_NETWORK_CHANGED`; exact underlying network cause remains unproven. No independent claim of reproduced Shell-induced DB corruption.
- R3. **Correct · approval security.** `src/service-worker.ts:22–42,74–88`: active registration or scope-keyed activation marker requires exact build/API approval. Marker written during activation, not partial precache. Marker namespace excluded from shell-cache cleanup. `tests/unit/service-worker-install.test.ts:50–88` covers failed precache retry, interrupted pre-activation retry, lost registration after activation, active legacy worker. Reviewed `core-update-approval.ts` validation; no new approval bypass found.
- R4. **Correct · repair integrity/generation.** `src/shell/application/content-actions.ts:224–235,277–299,377–427,573–609`: repair eligibility binds selected immutable manifest + sequence; install/resume share completion. Selected receipt verified again; stale epoch/aborted operation disposes preparation; generation mismatch prevents repair-success publication; same-release branch never invokes selector activation/save migration. Download lock excludes selector activation/cleanup (`application-selector.ts:75–86`). Real-store tests retain media, selection, Story generation while fetching only damaged required file (`tests/unit/content-recovery.test.ts:115–154`). No remaining concrete regression found.
- R5. **Correct · decoded caps/cancellation.** `src/content/storage/progressive-storage-validation.ts:94–134`: counts decoded chunks, enforces cap + expected size, cancels rejected reader, releases lock, preserves original failure if cancellation rejects. SHA-256 verification remains in `progressive-content-store.ts:352–358`. Non-OK response body cancelled (`:113–118`). New tests exercise real localhost gzip decoding, hidden transport encoding, exactly-once overflow cancellation, truncation, cancellation failure (`tests/unit/progressive-response.test.ts:12–112`).
- R6. **Correct · strict corruption handling.** Store opening no longer enumerates jobs (`progressive-content-store.ts:646–663`); job discovery still validates persisted rows (`:511–526`). Corrupt historical rows remain unchanged until explicit cleanup. Healthy current content remains readable (`tests/unit/content-recovery.test.ts:156–192`). No corrupt-row quarantine/drop added.
- R7. **Blocker · integration gate only.** Worktree typecheck fails pre-existing `tests/fixtures/node-duel-worker-harness.ts:96`: `tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'.` Fixture untouched. Parent reports user-owned root correction; integrate reviewed paths without overwriting correction, rerun root `npx tsc --noEmit`.

## Validation

- V1. Initial focused Vitest: **8 files / 100 tests passed**.
- V2. Added concurrency regression: **1 failed** before fix; focused recovery checks **2 passed** after fix.
- V3. Final expanded Vitest: **23 files / 317 tests passed**, 46.40s.
- V4. Legacy installer Chromium: **10 passed**, 48.1s. Dedicated port4511; `.tmp/content-review/vite-cache`; `preserveSymlinks`; parent checkout fs allowlist. No dependency installation/live content fetch. Evidence: `/home/aron/Projects/ascencio/artifacts/codebase-audit/content-review-evidence/browser/`.
- V5. Owned-path ESLint passed; reviewer-touched Prettier passed after one indentation correction; `git diff --check` passed; staged diff empty.
- V6. `npx tsc --noEmit`: failed only baseline fixture error quoted in R7. Full CORE Chromium consent suite, production build, whole-repo gates not rerun.

Exact final regression command:

```sh
npx vitest run tests/unit/progressive-download.test.ts tests/unit/progressive-storage.test.ts tests/unit/progressive-release.test.ts tests/unit/progressive-manifest.test.ts tests/unit/progressive-manifest-memo.test.ts tests/unit/content-installer.test.ts tests/unit/content-storage.test.ts tests/unit/content-runtime-activation.test.ts tests/unit/installed-assets.test.ts tests/unit/installed-gameplay.test.ts tests/unit/installed-images.test.ts tests/unit/manifest-closure-reduction.test.ts tests/unit/verify-gameplay-parity.test.ts tests/unit/chapter-gameplay.test.ts tests/unit/core-precache.test.ts tests/unit/core-update-approval.test.ts tests/unit/core-bootstrap.test.ts tests/unit/application-selector.test.ts tests/unit/application-readiness.test.ts tests/unit/content-actions.test.ts tests/unit/progressive-response.test.ts tests/unit/service-worker-install.test.ts tests/unit/content-recovery.test.ts --maxWorkers=2
```

Other exact commands:

```sh
npx vitest run tests/unit/content-actions.test.ts tests/unit/progressive-storage.test.ts tests/unit/progressive-download.test.ts tests/unit/content-recovery.test.ts tests/unit/progressive-response.test.ts tests/unit/service-worker-install.test.ts tests/unit/core-precache.test.ts tests/unit/core-update-approval.test.ts --maxWorkers=2
npx vitest run tests/unit/progressive-storage.test.ts --maxWorkers=2 -t 'cannot resurrect'
npx vitest run tests/unit/progressive-storage.test.ts --maxWorkers=2 -t 'cannot resurrect|marks persisted running'
npx playwright test -c .tmp/content-review/playwright.config.ts --project=chromium e2e-content/installer.spec.ts --grep 'atomic IDB abort|prepared receipt orphan|Shell runtime activation' --timeout=45000 --max-failures=2
npx playwright test -c .tmp/content-review/playwright.config.ts --project=chromium e2e-content/installer.spec.ts --timeout=45000 --max-failures=2
npx eslint src/content/storage/progressive-content-store.ts src/content/storage/progressive-storage-validation.ts src/service-worker.ts src/shell/application/content-actions.ts src/shell/pwa/shell-cache-policy.ts tests/unit/content-actions.test.ts tests/unit/core-precache.test.ts tests/unit/progressive-download.test.ts tests/unit/progressive-storage.test.ts tests/unit/progressive-response.test.ts tests/unit/service-worker-install.test.ts tests/unit/content-recovery.test.ts e2e-content/installer.spec.ts e2e-core/offline-shell.spec.ts
npx prettier --check src/content/storage/progressive-content-store.ts tests/unit/progressive-storage.test.ts e2e-content/installer.spec.ts
npx tsc --noEmit
git diff --check
git diff --cached --name-only
```

## Files touched by reviewer

- F1. `src/content/storage/progressive-content-store.ts` — atomic recovery compare/write; deleted-row omission.
- F2. `tests/unit/progressive-storage.test.ts` — lock-authorized cleanup/enumeration race regression.
- F3. `e2e-content/installer.spec.ts` — blank same-origin fixture; configured origin.
- F4. Scratch only: `.tmp/content-review/{vite.config.ts,playwright.config.ts,vite-cache/}`. No tracked tooling/config edits. Browser generated `artifacts/CORE_ACCEPTANCE/T4/installer-core-locked.png` plus evidence directory. Scratch retained: review tools permit read-only bash, expose no deletion tool. Parent may remove reviewer-owned scratch after preserving configs needed for reproduction. No paths removed.

## Assumptions / residual risks

- A1. `graphify query "content installer activation jobs recovery locks bounded stream"` failed: `/bin/bash: line 1: graphify: command not found`. Direct-source fallback used; no installation attempted.
- A2. Marker expresses prior successful activation, not trust against arbitrary same-origin JS/whole-origin deletion. Storage eviction plus lost registration may erase all such evidence; no stronger persistence claim.
- A3. Browser tests validate legacy API semantics, not full live-Shell/progressive-install acceptance. Page close/reopen crash simulation preserved; no claim of OS process kill.
- A4. Full CORE browser approval flow not independently rerun. Worker’s prior first-install Chromium evidence reviewed, not represented as reviewer execution.
- A5. New routine required-byte verification has no production-sized performance benchmark.
- A6. Shared untracked `node_modules` preserved. No staging/commit/push/subagents. Whole-worktree-clean claim not made.

Next parent action: integrate worker patch **including F1–F3 reviewer corrections**; preserve user fixture correction; rerun root typecheck/full required gates. No remaining in-scope source blocker found.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Independent source/test diff review; high-severity cleanup/recovery race reproduced red then fixed at progressive-content-store.ts:629-636; medium-severity fixture isolation fixed at installer.spec.ts:21-52; exact refs, validation, residual risks recorded."
    }
  ],
  "changedFiles": [
    "src/content/storage/progressive-content-store.ts",
    "tests/unit/progressive-storage.test.ts",
    "e2e-content/installer.spec.ts"
  ],
  "testsAddedOrUpdated": [
    "tests/unit/progressive-storage.test.ts:565-604",
    "e2e-content/installer.spec.ts:21-52"
  ],
  "commandsRun": [
    {
      "command": "Exact 23-file Vitest command under Validation",
      "result": "passed",
      "summary": "23 files; 317 tests; 46.40s."
    },
    {
      "command": "npx vitest run tests/unit/progressive-storage.test.ts --maxWorkers=2 -t 'cannot resurrect'",
      "result": "failed",
      "summary": "Intentional red: paused job recreated after lock-authorized cleanup."
    },
    {
      "command": "npx vitest run tests/unit/progressive-storage.test.ts --maxWorkers=2 -t 'cannot resurrect|marks persisted running'",
      "result": "passed",
      "summary": "2 passed after atomic compare/write fix."
    },
    {
      "command": "npx playwright test -c .tmp/content-review/playwright.config.ts --project=chromium e2e-content/installer.spec.ts --timeout=45000 --max-failures=2",
      "result": "passed",
      "summary": "Final isolated-document suite: 10 passed, 48.1s. Prior live-Shell run: 9 passed/1 module-import failure."
    },
    {
      "command": "Exact owned-path ESLint command under Validation",
      "result": "passed",
      "summary": "Exit 0."
    },
    {
      "command": "npx prettier --check src/content/storage/progressive-content-store.ts tests/unit/progressive-storage.test.ts e2e-content/installer.spec.ts",
      "result": "passed",
      "summary": "All matched files use Prettier code style!"
    },
    {
      "command": "npx tsc --noEmit",
      "result": "failed",
      "summary": "Pre-existing TS2345: tests/fixtures/node-duel-worker-harness.ts:96; unrelated fixture untouched."
    },
    {
      "command": "git diff --check; git diff --cached --name-only",
      "result": "passed",
      "summary": "No whitespace errors; no staged paths."
    }
  ],
  "validationOutput": [
    "Test Files 23 passed (23); Tests 317 passed (317)",
    "Chromium: 10 passed (48.1s)",
    "High-severity resurrection race: deterministic red then green",
    "Owned ESLint, reviewer-touched Prettier, diff whitespace checks passed"
  ],
  "residualRisks": [
    "Full-repo typecheck blocked by known unrelated fixture TS2345; parent root correction must be retained.",
    "Full CORE consent/browser suite, production build, whole-repo gates not independently rerun.",
    "Live-Shell module failures observed despite unique optimizer cache; underlying network cause not established. API fixtures now isolated, all assertions retained.",
    "Required-byte refresh performance not production-benchmarked.",
    "Reviewer-owned scratch remains because available editing tools expose no deletion operation; parent cleanup needed."
  ],
  "noStagedFiles": true,
  "diffSummary": "Approved worker F1-F6 after atomic recovery/cleanup-race fix plus isolated, configurable-origin browser fixture. Reviewer changed three source/test paths; tracked tooling/config untouched.",
  "reviewFindings": [
    "Fixed high: progressive-content-store.ts:629-636 — job enumeration could recreate cleared job after delete-all.",
    "Fixed medium: installer.spec.ts:21-52 — live Shell boot polluted API fixture scope; hardcoded port prevented isolated-server validation.",
    "No remaining in-scope source blocker found; integration typecheck baseline blocker explicitly retained."
  ],
  "manualNotes": "Parent integrate original worker patch plus three reviewer corrections. Preserve user-owned root fixture correction. No staging, commits, pushes, dependency installs, live content downloads, deployments, or subagents."
}
```
