# Independent tooling review — F2–F5

State: **done**. **F2/F3/F5 approved independently. F4 deterministic wiring approved with Content integration; full/private gate acceptance blocked.** No reviewer source fixes required. No full-CI claim.

## Review

- R1 **Correct · F2 · approved.** `scripts/lib/core-source-scratch.ts:26–45` creates scratch exclusively; existing dirs never gain ownership. `:48–64` requires real dir, regular marker, exact per-run token before removal. `.tmp` symlinks rejected (`:20–23`). `playwright.core.config.ts:4–5`, `scripts/core-source-only-server.ts:15–18,41–78`, `scripts/core-source-only-teardown.ts:10–15` share token across setup/server/teardown. Independent disposable probes exercised actual server copy-failure cleanup, unowned-dir preservation, cross-process matching/foreign-token teardown, actual Playwright config → HTTP fixture server → global teardown. All passed; no installation invoked. Existing six regression tests also passed.
- R2 **Correct · F3 · approved source/workflow fix.** `.github/workflows/ci.yml:29–47` caches current roots, includes producer/input identities, runs `assets:sets && assets:sets:verify` before isolated headless gate. Archive paths corrected (`:78,94`). Roots match `scripts/lib/asset-roots.ts:1–44`; producer consumes tracked chapter/shop/provider evidence (`scripts/download-set-images.ts:42–85`, `scripts/lib/chapter-content-source.ts:29–87`). Verifier checks actual bytes against tracked lock (`scripts/verify-set-images.ts:33–58`). Workflow contract passed (`tests/mvp-assets.test.ts:44–86`). Cold-cache acquisition/CI not run: live downloads prohibited.
- R3 **Correct · F4 · deterministic wiring approved, integration-dependent.** `package.json:48–55` routes standard browser gate through core + deterministic installer suite. `playwright.content-fixture.config.ts:6–9` selects installer only. `tests/unit/content-tooling-gates.test.ts:6–26` asserts execution chain/private separation; 2/2 Vitest passed. Tooling worktree still contains old installer spec; do not integrate that file. Independent browser execution used already-integrated root Content reviewer fix, inherited tooling fixture selection, port4512, unique Vite cache: **10/10 passed**, real Chromium Cache/IDB. No installer edits. This proves deterministic selected suite, not literal unintegrated worktree `npm run test:content:fixtures`, full `check:browser`, or core production-browser suite.
- R4 **Correct · F5 · approved.** `scripts/verify-browser-build.ts:121–128` verifies source bundle then independently verifies packaged output. `scripts/lib/browser-content-verification.ts:10–34` retains filename closure; each packaged object checked against expected SHA-256 + length. Guarded streaming/path/identity checks come from `scripts/lib/asset-delivery/source-files.ts:43–108,119–124`. Tests passed for real verified producer bundle + mutated packaged ZIP, all four object classes, truncation, missing/extra files (`tests/browser-build-verification.test.ts:34–111`). Independent additional probe held SHA-256 correct, supplied wrong expected byte count → rejected; length check independently exercised.
- R5 **Blocker · F4 private execution · missing verified inputs.** `scripts/verify-content-browser-run.ts:10–31` fails closed for missing/unsafe run, verifies bundle before browser launch, requires legacy manifests. Root current pointer still targets absent `generated/asset-delivery/runs/d99ee74f-da25-4e18-aa61-265feffed264/candidate.json`. Independent read-only verification failed exactly: `AssetDeliveryError: ASSET_REFERENCE_MISSING`. Root `generated/runtime/current/manifest.json` + `generated/assets/current/manifest.json` also absent; T7 reads these paths directly (`e2e-content/t7-runtime.spec.ts:19,59–63`). No synthetic substitute/private-pass claim. Owner must recover complete immutable run + matching legacy trees before private acceptance.
- R6 **Blocker · High/P1 · additional pre-existing private-harness ownership risk, report-only.** `scripts/content-built-teardown.ts:11–24` treats static `PRIVATE_DEPLOYMENT_ONLY.txt` artifact text as ownership, then recursively removes `.tmp/t6-installed-built-subpath`. Independent test copied production teardown into disposable root, created unrelated `user.txt` beside ordinary artifact marker, invoked teardown: `user.txt` was deleted. No real project data touched. Setup also builds directly into fixed path without exclusive claim (`playwright.content-built.config.ts:36–39`); installed Vite defaults to emptying in-root output dirs (`node_modules/vite/dist/node/chunks/node.js:13195–13201,32753–32762`). New private command reaches this existing harness (`package.json:50`). **Do not run the private built gate against an existing directory. Extend exclusive token-bound ownership to its setup and teardown before enabling it.** Outside requested core F2 repair; no unrequested rewrite applied.
- R7 **Note · Low/P3 · existing uncapped upstream response, report-only.** `scripts/generate-shop-sets.ts:385–392` uses `fetch(url)` without timeout, unbounded `response.json()`. A stalled or oversized upstream response can hang or exhaust the generator. No network repro; static evidence. Follow-up: bounded response reader + timeout + fake-fetch regressions. Existing primitive: `scripts/lib/capped-response-body.ts:16–45`.
- R8 **Fixed by reviewer:** none. No concrete regression requiring edits established in reviewed 16-file implementation. R6/R7 remain explicit, unpatched follow-ups.

## Validation

- V1 `node --version` → `v26.7.0`.
- V2 `node --test tests/core-source-only-server.test.ts tests/browser-build-verification.test.ts tests/mvp-assets.test.ts tests/content-browser-run.test.ts` → **20 passed, 0 failed**.
- V3 `./node_modules/.bin/vitest run tests/unit/content-tooling-gates.test.ts` → **2 passed**.
- V4 `node --test .tmp/tooling-review-probe.test.ts` → final **6 passed**. Five positive verification probes + R6 actual unsafe-teardown characterization. Not six repaired defects; R6 test deliberately confirms remaining problem. Probe created only disposable roots, removed them afterward.
- V5 `./node_modules/.bin/playwright test -c .tmp/tooling-review-browser.config.ts --project=chromium --timeout=45000 --max-failures=2` → **10 passed (1.1m)**. Browser evidence: `/home/aron/Projects/ascencio/artifacts/codebase-audit/tooling-review-evidence/browser/` (21 files). Wrapper inherited `playwright.content-fixture.config.ts`; changed testDir to integrated root `e2e-content`, baseURL/server to port4512, Vite cache to worktree-owned scratch, reporter/output location. Vite served integrated root with `preserveSymlinks` + root fs allowlist; `CONTENT_RUN` empty. Installer spec byte-untouched here.
- V6 `./node_modules/.bin/playwright test -c playwright.content-fixture.config.ts --list --reporter=line` → old worktree **11 cases / 1 file**. `./node_modules/.bin/playwright test -c playwright.core.config.ts --project=chromium --list --reporter=line` → **11 cases / 5 files**. Discovery only, not execution.
- V7 Scoped Prettier/ESLint/strict TypeScript passed; exact command below. Final `git diff --check` passed. `git diff --exit-code -- scripts/lib/sources.ts tests/sources.test.ts e2e-content/installer.spec.ts` passed. `git diff --cached --name-only` empty.
- V8 Root current-pointer `verifyBundle` probe failed as R5. Expected blocker evidence, not successful private acceptance. Legacy manifests independently checked absent.
- V9 Full core browser execution skipped: `scripts/core-source-only-server.ts:66` invokes `npm ci`; installs forbidden. Cold-cache CI/full `check`/private browser suites skipped. Worker’s prior red evidence reviewed; no independent red→green source-fix cycle claimed because reviewer changed no production behavior.

```sh
set -e
mapfile -t ts_files < <({ git diff --name-only -- '*.ts'; git ls-files --others --exclude-standard -- '*.ts'; } | sort -u)
./node_modules/.bin/prettier --check "${ts_files[@]}" package.json tsconfig.json .github/workflows/ci.yml
./node_modules/.bin/eslint "${ts_files[@]}"
./node_modules/.bin/tsc --ignoreConfig --noEmit --target ES2023 --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --skipLibCheck --types node,vite/client,vitest/globals "${ts_files[@]}"
git diff --check
git diff --exit-code -- scripts/lib/sources.ts tests/sources.test.ts e2e-content/installer.spec.ts
test -z "$(git diff --cached --name-only)"
```

## Files / integration

- I1 Reviewed 16 implementation paths: `.github/workflows/ci.yml`, `package.json`, `playwright.core.config.ts`, `playwright.content-fixture.config.ts`, `scripts/core-source-only-server.ts`, `scripts/core-source-only-teardown.ts`, `scripts/lib/core-source-scratch.ts`, `scripts/lib/browser-content-verification.ts`, `scripts/verify-browser-build.ts`, `scripts/verify-content-browser-run.ts`, `tests/core-source-only-server.test.ts`, `tests/browser-build-verification.test.ts`, `tests/content-browser-run.test.ts`, `tests/mvp-assets.test.ts`, `tests/unit/content-tooling-gates.test.ts`, `tsconfig.json`.
- I2 Reviewer retained changes: this report + browser evidence only. No production/test integration edits, staging, commits, pushes, installs, live downloads, publication, subagents.
- I3 Root dirty overlap confirmed before/after: `package.json` owns Node `>=26.0.0`, `@types/node` `^26.0.0`; `.github/workflows/ci.yml` owns `node-version: 26`. Worktree still carries baseline Node24 lines. Integrate narrow script/cache/step hunks only; whole-file replacement would regress user edits.
- I4 Removed own disposable probe, browser/Vite wrapper configs, unique cache, duplicate screenshot: `.tmp/tooling-review-probe.test.ts`, `.tmp/tooling-review-browser.config.ts`, `.tmp/tooling-review-vite.config.ts`, `.tmp/tooling-review-vite-cache/`, `artifacts/CORE_ACCEPTANCE/T4/installer-core-locked.png`. Probe roots removed by test hooks. Browser evidence retained. Existing worker T6 report + `node_modules` symlink untouched; no clean-worktree claim.

## Assumptions

- A1 Filesystem trust boundary is project root; no guarantee against malicious concurrent parent/directory replacement. Guards reject existing symlinks + foreign markers. Abrupt interruption may leave owned scratch; later runs deliberately refuse it, never auto-delete.
- A2 Integrated root Content implementation/spec is authorized cross-stream validation input, not an edit target. Browser result qualifies that integrated input only; source-only tooling worktree remains stale for installer cases.
- A3 Graphify attempted first, unavailable: `/bin/bash: line 1: graphify: command not found`. Direct source/diff/runtime inspection used.

## Next actions

- N1 Parent: integrate F2/F3/F5 + F4 deterministic wiring narrowly; preserve Node26 user hunks, integrated Content installer fix. R6 does not invalidate independent F2/F3/F5 approvals.
- N2 Authorized runner: execute `npm run test:core`, integrated `npm run test:content:fixtures`, cold-cache CI after installation/download constraints permit. No claim current full browser gate is green.
- N3 Private gate owner: fix R6 scratch ownership first; restore/verify R5 run + legacy trees; then execute `CONTENT_RUN=generated/asset-delivery/runs/<verified-run-id> npm run test:content:legacy`. Do not run until both prerequisites hold.
- N4 Track R7 bounded-fetch follow-up separately. No further reviewer writes after report.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Independent F2-F5 dispositions with exact paths/lines, 20 Node tests, 2 Vitest tests, 6 disposable safety probes, 10 Chromium cases; additional High/P1 private-harness ownership issue reproduced safely, Low/P3 uncapped fetch reported. Private-input and execution limits explicit."
    }
  ],
  "changedFiles": [
    "/home/aron/Projects/ascencio/artifacts/codebase-audit/tooling-review.md",
    "/home/aron/Projects/ascencio/artifacts/codebase-audit/tooling-review-evidence/browser/"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "node --test tests/core-source-only-server.test.ts tests/browser-build-verification.test.ts tests/mvp-assets.test.ts tests/content-browser-run.test.ts",
      "result": "passed",
      "summary": "20 passed, 0 failed."
    },
    {
      "command": "./node_modules/.bin/vitest run tests/unit/content-tooling-gates.test.ts",
      "result": "passed",
      "summary": "2 passed."
    },
    {
      "command": "node --test .tmp/tooling-review-probe.test.ts",
      "result": "passed",
      "summary": "6 disposable probes passed; includes characterization proving remaining unsafe private teardown, not its repair. Probe cleaned afterward."
    },
    {
      "command": "./node_modules/.bin/playwright test -c .tmp/tooling-review-browser.config.ts --project=chromium --timeout=45000 --max-failures=2",
      "result": "passed",
      "summary": "10 Chromium cases passed using integrated root Content spec, tooling fixture selection, port4512, unique cache; no installer edits."
    },
    {
      "command": "Scoped Prettier, ESLint, strict tsc --ignoreConfig, protected-path diff and staged-set checks; exact commands under Validation",
      "result": "passed",
      "summary": "All scoped checks green; no staged files."
    },
    {
      "command": "./node_modules/.bin/playwright test -c playwright.content-fixture.config.ts --list --reporter=line; ./node_modules/.bin/playwright test -c playwright.core.config.ts --project=chromium --list --reporter=line",
      "result": "passed",
      "summary": "11 stale-worktree installer cases; 11 core cases. Listing only."
    },
    {
      "command": "verifyBundle('/home/aron/Projects/ascencio', currentPointer.run)",
      "result": "failed",
      "summary": "AssetDeliveryError: ASSET_REFERENCE_MISSING; candidate.json absent. Both legacy manifests also absent."
    },
    {
      "command": "npm run test:core",
      "result": "not-run",
      "summary": "Harness invokes npm ci; installation prohibited. Token lifecycle separately exercised without installation."
    },
    {
      "command": "npm run test:content:legacy",
      "result": "not-run",
      "summary": "No valid private fixture; additional unsafe fixed-path private harness requires follow-up before execution."
    }
  ],
  "validationOutput": [
    "Node: 20 passed; Vitest: 2 passed; disposable probes: 6 passed.",
    "Integrated deterministic Chromium suite: 10 passed (1.1m).",
    "Scoped format/lint/types/diff passed; protected source/spec paths unchanged; staged set empty.",
    "No private/core/full-CI execution pass claimed."
  ],
  "residualRisks": [
    "High/P1: scripts/content-built-teardown.ts:11-24 authorizes recursive deletion via static artifact marker; reproduced only in disposable fixture. Private gate blocked pending exclusive token-bound ownership.",
    "Current private run candidate.json missing; legacy runtime/data manifests absent.",
    "Full core browser execution and cold-cache CI unrun under no-install/no-download constraints.",
    "Low/P3: scripts/generate-shop-sets.ts:385-392 lacks response cap/timeout; report-only.",
    "Interrupted core runs may leave scratch; trusted-root guards do not promise resistance to malicious concurrent filesystem replacement.",
    "Root package/CI Node26 changes overlap worker paths; narrow integration required."
  ],
  "noStagedFiles": true,
  "diffSummary": "No reviewer source changes. Independently approved F2/F3/F5; F4 deterministic wiring verified with integrated Content spec. Report/evidence retained; own scratch removed. Additional pre-existing private-harness deletion risk reported, not silently fixed.",
  "reviewFindings": [
    "Approved F2: scripts/lib/core-source-scratch.ts:26-64; exclusive token-bound setup/removal plus verified cross-process lifecycle.",
    "Approved F3 source fix: .github/workflows/ci.yml:29-47; current roots and required set-image producer/verifier; cold CI pending.",
    "Approved F4 deterministic wiring with Content integration: package.json:48-55, playwright.content-fixture.config.ts:6-9; 10 Chromium cases passed independently.",
    "Approved F5: scripts/lib/browser-content-verification.ts:10-34; packaged closure, SHA256, byte counts verified independently.",
    "Blocker High/P1: scripts/content-built-teardown.ts:11-24 and playwright.content-built.config.ts:36-39; private fixed-path harness lacks ownership guard.",
    "Blocker private acceptance: scripts/verify-content-browser-run.ts:15-29; required real run/legacy files unavailable.",
    "Note Low/P3: scripts/generate-shop-sets.ts:385-392; uncapped fetch/JSON consumption, unpatched."
  ],
  "manualNotes": "Parent preserve user Node26 package/CI hunks, integrated Content installer spec. Additional private-harness issue scoped follow-up before private execution. No commits, staging, pushes, installs, live downloads, publication, subagents. Final report is last reviewer write."
}
```
