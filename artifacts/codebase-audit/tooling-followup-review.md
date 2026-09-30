# Tooling follow-up review — R6/R7

State: **done · R6 approved · R7 approved**. No reviewer source fixes. **Real private browser acceptance remains blocked by missing inputs.**

## Review

- R1 **Correct · R6 · prior High/P1 resolved.** `scripts/lib/content-built-scratch.ts:25–43` exclusively creates fixed scratch; existing dirs cannot gain ownership. `playwright.content-built.config.ts:40–45` runs setup before subpath build; build/preview target nested `dist`. `.content-built-owner` stays outside Vite output (`scripts/lib/content-built-scratch.ts:40`). Actual copied setup + disposable real Vite build passed (`tests/content-built-scratch.test.ts:104–199`), including refusal before build starts when scratch exists.
- R2 **Correct · R6 cleanup · approved.** `scripts/lib/content-built-scratch.ts:46–61` requires real dir, regular marker, exact per-run token before recursive removal. Parent/dir/marker symlinks fail closed. Config generates token (`playwright.content-built.config.ts:2–5`); production setup/teardown consume it (`scripts/content-built-setup.ts:10–13`, `scripts/content-built-teardown.ts:10–14`). Nine tests passed: ordinary artifact marker, unmarked dir, stale/concurrent claims, foreign/missing/malformed token, symlinks, failed build, matching-token cleanup. Fixtures only; real `.tmp/t6-installed-built-subpath` never touched.
- R3 **Correct · R6 consumer · approved.** `e2e-content/built-installer.spec.ts:11` changes only output path to `.tmp/t6-installed-built-subpath/dist`; emitted-byte checks still read matching build tree. Matches explicitly authorized one-line scope. Content-owned `e2e-content/installer.spec.ts` unchanged.
- R4 **Correct · R7 · prior Low/P3 resolved.** `scripts/lib/shop-set-fetch.ts:9–23` passes `AbortSignal.timeout(15_000)`, caps response bytes at 8MiB before decoding/JSON parsing, preserves HTTP error + fold behavior. Generator uses extracted fn (`scripts/generate-shop-sets.ts:10,391`); no generator execution. Seven fake-fetch tests passed: URL/fold, declared/chunked overflow cancellation, exact cap, stalled headers/body, HTTP error, malformed JSON (`tests/shop-set-fetch.test.ts:20–158`). Existing capped-reader + fold/data regressions also passed.
- R5 **Correct · prior F2/F3/F5 approvals retained; F4 deterministic wiring remains integration-qualified.** Current prior patch reinspected against initial review: exclusive core ownership (`scripts/lib/core-source-scratch.ts:26–64`), current asset roots + producer/verifier CI steps (`.github/workflows/ci.yml:29–47`), deterministic/private gate separation (`package.json:48–55`, `playwright.content-fixture.config.ts:6–9`), packaged byte verification (`scripts/lib/browser-content-verification.ts:10–34`). Prior 20 Node regressions + 2 gate-contract tests reran green. No old regression found. Initial review's integrated Chromium evidence not rerun here; no new full-browser/full-CI approval.
- R6 **Blocker · private acceptance · original missing inputs persist.** Root `generated/asset-delivery/current.json` selects `generated/asset-delivery/runs/d99ee74f-da25-4e18-aa61-265feffed264`; its `candidate.json` remains missing. Root `generated/runtime/current/manifest.json` + `generated/assets/current/manifest.json` also missing. Independent read-only `verifyBundle(root, run)` failed exactly: `AssetDeliveryError: ASSET_REFERENCE_MISSING`. Preflight still requires these inputs (`scripts/verify-content-browser-run.ts:15–29`). This blocks private acceptance, not R6/R7 source approval.
- R7 **Fixed by reviewer:** none. No concrete defect requiring source/test edits established.

## Delta / files touched

- D1 Follow-up scope: nine paths — `playwright.content-built.config.ts`, `scripts/content-built-setup.ts`, `scripts/content-built-teardown.ts`, `scripts/lib/content-built-scratch.ts`, `e2e-content/built-installer.spec.ts`, `scripts/generate-shop-sets.ts`, `scripts/lib/shop-set-fetch.ts`, `tests/content-built-scratch.test.ts`, `tests/shop-set-fetch.test.ts`. Four tracked modifications + five additions; matches worker report.
- D2 Compared initial `tooling-review.md` dispositions with follow-up report + actual current files/diffs. Prior 16-file byte-preservation claim remains worker hash attestation; removed baseline prevents independently repeating that historical comparison. Current prior implementation independently reinspected/tested instead.
- D3 Reviewer retained only this report. Initial worker/reviewer artifacts untouched. No staging, commit, push, deps, subagents, live acquisition, dataset rewrite, real private gate, or real scratch deletion. Final staged set empty. Final disposable follow-up fixture count: **0**. No reviewer scratch retained.

## Validation

- V1 `node --version` → `v26.7.0`.
- V2 Node batch below → **36 passed, 0 failed**: 16 R6/R7 tests + 20 prior regressions.
- V3 `./node_modules/.bin/vitest run tests/unit/content-tooling-gates.test.ts tests/unit/capped-response-body.test.ts` → **6 passed**.
- V4 `./node_modules/.bin/vitest run tests/unit/story/shop-set-fold.test.ts tests/unit/story/shop-set-data.test.ts` → **28 passed**.
- V5 Scoped Prettier/ESLint/strict tsc below → **passed** across all 22 changed/added TS paths, plus JSON/workflow format checks. Covers prior patch + appended delta. `git diff --check` passed. Protected-path diff empty; staged set empty.
- V6 Optional additional inline Playwright lifecycle probe **not executed**: tool policy rejected command before execution with `[protected-paths] Bash command references protected path ".env" (bash denied). You can override this by editing ~/.pi/agent/configs/protected-paths.json.` No override/bypass attempted; no probe files created. Existing copied-production subprocess lifecycle + disposable real Vite tests did execute successfully per V2. No claim fresh end-to-end Playwright globalTeardown execution.
- V7 Private-input verification failed as R6. Real private/core browser gates, cold-cache CI, full generator acquisition not run. No reviewer red→green cycle claimed: no behavior edits needed.

```sh
node --test tests/content-built-scratch.test.ts tests/shop-set-fetch.test.ts tests/core-source-only-server.test.ts tests/browser-build-verification.test.ts tests/mvp-assets.test.ts tests/content-browser-run.test.ts
./node_modules/.bin/vitest run tests/unit/content-tooling-gates.test.ts tests/unit/capped-response-body.test.ts
./node_modules/.bin/vitest run tests/unit/story/shop-set-fold.test.ts tests/unit/story/shop-set-data.test.ts

set -e
mapfile -t ts_files < <({ git diff --name-only -- '*.ts'; git ls-files --others --exclude-standard -- '*.ts'; } | sort -u)
./node_modules/.bin/prettier --check "${ts_files[@]}" package.json tsconfig.json .github/workflows/ci.yml
./node_modules/.bin/eslint "${ts_files[@]}"
./node_modules/.bin/tsc --ignoreConfig --noEmit --target ES2023 --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --skipLibCheck --types node,vite/client,vitest/globals "${ts_files[@]}"
git diff --check
git diff --exit-code -- scripts/lib/capped-response-body.ts scripts/lib/shop-set-fold.ts e2e-content/installer.spec.ts vendor
test -z "$(git diff --cached --name-only)"
```

## Assumptions / residual risks

- A1 Trusted project-root filesystem, matching prior review. Guards reject existing symlinks/foreign ownership; no defense claimed against malicious concurrent filesystem replacement or actors able to read/write tokens.
- A2 Interrupted setup/build can leave scratch; subsequent runs deliberately refuse adoption. Failed-build test proves explicit matching-token cleanup, not crash recovery (`tests/content-built-scratch.test.ts:202–222`).
- A3 8MiB ceiling/15s timeout approved as conservative bounds, not measured upstream sizing. Fake fetches validate limits; live provider compatibility unmeasured. Oversized input fails closed (`scripts/lib/shop-set-fetch.ts:10–20`).
- A4 Existing integration caution persists: root `package.json:7,68` owns Node `>=26.0.0`/`@types/node` `^26.0.0`; root CI `:23` uses Node26. Worktree counterparts remain Node24 (`package.json:7,70`, `.github/workflows/ci.yml:23`). Preserve root user hunks; do not replace whole package/workflow files.
- A5 Graphify attempted first; unavailable: `/bin/bash: line 1: graphify: command not found`. Direct source/diff/test inspection used. No graph update needed: no source edits.

## Next action

- N1 Parent: integrate nine-path R6/R7 delta; retain prior scoped approvals, Content-owned installer, root Node26 hunks. No private-pass claim.
- N2 Private-input owner: recover complete immutable run plus matching legacy trees. Inspect existing private scratch without deleting or adopting it. After prerequisites verify, execute `CONTENT_RUN=generated/asset-delivery/runs/<verified-run-id> npm run test:content:legacy`. Do not run the private gate with missing inputs or an unowned existing scratch directory.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Independent path/line review approves R6 exclusive pre-build claim, external owner marker, exact-token teardown and one-line consumer alignment; R7 bounded fetch approved. Original missing private candidate/legacy-input blocker independently reconfirmed. Prior regression batch rerun."
    }
  ],
  "changedFiles": [
    "/home/aron/Projects/ascencio/artifacts/codebase-audit/tooling-followup-review.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "node --test tests/content-built-scratch.test.ts tests/shop-set-fetch.test.ts tests/core-source-only-server.test.ts tests/browser-build-verification.test.ts tests/mvp-assets.test.ts tests/content-browser-run.test.ts",
      "result": "passed",
      "summary": "36 passed, 0 failed; disposable roots only, fake upstream fetches."
    },
    {
      "command": "./node_modules/.bin/vitest run tests/unit/content-tooling-gates.test.ts tests/unit/capped-response-body.test.ts",
      "result": "passed",
      "summary": "6 passed."
    },
    {
      "command": "./node_modules/.bin/vitest run tests/unit/story/shop-set-fold.test.ts tests/unit/story/shop-set-data.test.ts",
      "result": "passed",
      "summary": "28 passed."
    },
    {
      "command": "Scoped Prettier/ESLint/strict tsc, diff/protected-path/staged checks; exact shell block under Validation",
      "result": "passed",
      "summary": "22 TS paths, JSON/workflow format checks green; protected paths untouched; staged set empty."
    },
    {
      "command": "Read-only root current-pointer existence checks and verifyBundle(root, run)",
      "result": "failed",
      "summary": "AssetDeliveryError: ASSET_REFERENCE_MISSING; candidate.json plus both legacy manifests missing. Expected blocker evidence, not private acceptance."
    },
    {
      "command": "Optional inline disposable Playwright config/server/globalTeardown probe",
      "result": "not-run",
      "summary": "Tool protected-path policy rejected before execution; no bypass or probe files. Existing subprocess/Vite lifecycle tests passed."
    },
    {
      "command": "npm run test:content:legacy",
      "result": "not-run",
      "summary": "Real private inputs missing; no synthetic substitute."
    }
  ],
  "validationOutput": [
    "36 Node tests passed; 34 Vitest tests passed.",
    "Scoped format/lint/strict types/diff passed across prior patch plus appended delta.",
    "Real copied setup/teardown and disposable Vite build exercised; preview args asserted by stub, no browser/private-pass claim.",
    "Final staged files empty; disposable follow-up fixture count 0."
  ],
  "residualRisks": [
    "Private candidate.json and both legacy manifests missing; actual private acceptance blocked.",
    "Trusted-root guards do not resist malicious concurrent filesystem replacement/token access.",
    "Interrupted runs can leave scratch; later runs fail closed rather than reclaim it.",
    "Live provider sizing, complete generator acquisition, private/core browser suites and cold-cache CI unrun.",
    "Optional fresh Playwright globalTeardown integration probe blocked by tool policy; no bypass.",
    "Preserve root Node26 package/CI hunks during integration; worktree still contains Node24 baseline."
  ],
  "noStagedFiles": true,
  "diffSummary": "Reviewer source changes: none. Nine-path R6/R7 follow-up approved; prior scoped approvals retained without full-gate expansion. Report only retained.",
  "reviewFindings": [
    "Resolved High/P1 R6: scripts/lib/content-built-scratch.ts:25-61 and playwright.content-built.config.ts:40-45; exclusive claim before Vite, marker outside dist, exact-token recursive cleanup.",
    "Approved consumer alignment: e2e-content/built-installer.spec.ts:11; one-line nested output path only.",
    "Resolved Low/P3 R7: scripts/lib/shop-set-fetch.ts:9-23; 15s timeout, 8MiB bounded decode, preserved fold/errors.",
    "No concrete regression found in prior scoped tooling implementation; focused regression tests pass.",
    "Blocker private acceptance: scripts/verify-content-browser-run.ts:15-29; selected immutable candidate and legacy manifests unavailable."
  ],
  "manualNotes": "No source fixes, staging, commits, pushes, deps, subagents, live acquisition or real private scratch deletion. Initial artifacts untouched. Final report is last reviewer write."
}
```
