# Tooling follow-up — R6/R7

State: **done · checked · fresh review required**. Private browser acceptance: **blocked by missing real inputs; not executed**.

## Evidence / exact appended delta

- D1 R6 ownership: `scripts/lib/content-built-scratch.ts:25–43` exclusively creates fixed scratch; existing dirs rejected. `:46–61` permits recursive cleanup only for real dir, regular marker, exact per-run token. Parent/scratch/marker symlinks rejected. Focused equivalent of approved core helper avoids changing preceding reviewed patch.
- D2 R6 lifecycle: `playwright.content-built.config.ts:2–5,40–45` generates token, invokes setup before subpath build, uses nested `dist` for build/preview. `scripts/content-built-setup.ts:10–13` claims scratch. `scripts/content-built-teardown.ts:10–14` requires same token. Owner marker stays outside Vite output.
- D3 R6 consumer alignment: `e2e-content/built-installer.spec.ts:11` changes only `.tmp/t6-installed-built-subpath` → `.tmp/t6-installed-built-subpath/dist`. Supervisor explicitly approved this one-line built-spec alignment; no-edit restriction applies Content-owned `e2e-content/installer.spec.ts`.
- D4 R7 acquisition: `scripts/lib/shop-set-fetch.ts:9–23` passes `AbortSignal.timeout(15_000)`, reads through existing `readCappedResponseBody` with 8MiB ceiling, parses bounded bytes, retains fold/error behavior. `scripts/generate-shop-sets.ts:10,391` imports/calls extracted fn. No generator execution, live acquisition, dataset rewrite, helper edits.
- D5 Delta vs preceding reviewed patch: **9 paths only**. Modified: `playwright.content-built.config.ts` (+5/−1), `scripts/content-built-teardown.ts` (+9/−20), `scripts/generate-shop-sets.ts` (+1/−12), `e2e-content/built-installer.spec.ts` (+1/−1). Added: `scripts/content-built-setup.ts`, `scripts/lib/content-built-scratch.ts`, `scripts/lib/shop-set-fetch.ts`, `tests/content-built-scratch.test.ts`, `tests/shop-set-fetch.test.ts`.
- D6 Before/after SHA-256 comparison passed for all **16 preceding reviewed paths**, plus `e2e-content/installer.spec.ts`. Includes prior dirty package/CI/tsconfig/core helper changes. No deps/vendor/config churn beyond requested private harness config. Root main package/CI untouched.

## Tests / red → green

- T1 R6 red: `node --test tests/content-built-scratch.test.ts` → **0 passed, 3 failed**. Both unsafe-teardown regressions reported exact `AssertionError [ERR_ASSERTION]: Missing expected rejection.` Config regression exposed absent pre-build ownership claim. Only disposable roots touched.
- T2 R7 red after behavior-preserving fetch extraction: `node --test --test-name-pattern='bounded shop|15-second|timeout remains|retains HTTP' tests/shop-set-fetch.test.ts` → **1 passed, 3 failed**. Missing signal exposed; no live fetch. `node --test --test-name-pattern='declared oversized|chunked shop' tests/shop-set-fetch.test.ts` → **0 passed, 2 failed**, exact `AssertionError [ERR_ASSERTION]: Missing expected rejection.`
- T3 Final focused coverage: **16 tests**: nine ownership/lifecycle tests, seven fake-fetch tests. R6 covers ordinary artifact/unmarked dirs, pre-build refusal, actual disposable Vite build, marker survival, configured preview args, exact/foreign/missing token, failed build, concurrent claims, stale claim, symlink parent/dir/marker. R7 covers valid fold/URL, declared/chunked cap cancellation, exact cap, timeout through headers/body, HTTP errors, malformed JSON.
- T4 Fixture limit: subprocesses execute copied production setup/teardown. Configured subpath command runs in disposable root; fake `npm` delegates to installed real Vite for tiny HTML fixture; fake `npx` records preview args, never starts app/browser. Build-failure fixture exits 7. No private fixture substitute or browser/private-pass claim.
- T5 Final Node regression batch → **36 passed, 0 failed**. Existing core scratch, packaged verification, content preflight, MVP asset gate coverage retained. Vitest gate contracts → **2 passed**.
- T6 Final scoped Prettier/ESLint/strict tsc → **passed across nine appended paths**. `git diff --check` passed. Protected installer/helper/vendor diff empty. Staged set empty.

## Exact final validation commands

```sh
set -e
files=(playwright.content-built.config.ts scripts/content-built-setup.ts scripts/content-built-teardown.ts scripts/lib/content-built-scratch.ts scripts/generate-shop-sets.ts scripts/lib/shop-set-fetch.ts tests/content-built-scratch.test.ts tests/shop-set-fetch.test.ts e2e-content/built-installer.spec.ts)
./node_modules/.bin/prettier --check "${files[@]}"
./node_modules/.bin/eslint "${files[@]}"
./node_modules/.bin/tsc --ignoreConfig --noEmit --target ES2023 --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --skipLibCheck --types node,vite/client,vitest/globals "${files[@]}"
node --test tests/content-built-scratch.test.ts tests/shop-set-fetch.test.ts tests/core-source-only-server.test.ts tests/browser-build-verification.test.ts tests/mvp-assets.test.ts tests/content-browser-run.test.ts
./node_modules/.bin/vitest run tests/unit/content-tooling-gates.test.ts
git diff --check
git diff --exit-code -- scripts/lib/capped-response-body.ts e2e-content/installer.spec.ts vendor
test -z "$(git diff --cached --name-only)"
```

## Remaining blocker / assumptions

- R1 Private inputs rechecked read-only under `/home/aron/Projects/ascencio`: `generated/asset-delivery/current.json` selects `generated/asset-delivery/runs/d99ee74f-da25-4e18-aa61-265feffed264`. Its `candidate.json` remains **MISSING**. `generated/runtime/current/manifest.json` remains **MISSING**. `generated/assets/current/manifest.json` remains **MISSING**. No real private gate launched. Required verification remains `scripts/verify-content-browser-run.ts:15–29`.
- R2 Interrupted setup/build may leave scratch. Later runs deliberately refuse existing scratch; no automatic adoption/deletion. Failed-build test demonstrates matching-token cleanup explicitly, not guaranteed teardown after process crash.
- R3 Full private/core browser gates, cold-cache CI, complete generator acquisition unrun. Real upstream payload sizing not measured; 8MiB limit fails closed rather than bypassing cap.

## Assumptions

- A1 Filesystem trust boundary remains trusted project root, matching prior R1 approval. No resistance claimed against malicious concurrent parent/dir replacement or an actor already able to read/write ownership tokens.
- A2 15s timeout follows existing acquisition convention; 8MiB ceiling chosen conservatively for per-set JSON. No retry/config surface added. Fake-fetch fixtures validate declared limits, not live upstream availability.
- A3 Graphify attempted first: `/bin/bash: line 1: graphify: command not found`. Direct source inspection used; graph update unavailable.
- A4 New nested output requires built-spec path alignment. Supervisor approved only that one-line consumer change; Content-owned installer remains byte-identical.

## Workspace / next action

- W1 Removed own `.tmp/tooling-followup-baseline.json` after final hash comparison. Test hooks removed every owned `.tmp/content-built-test-*` fixture; final count **0**. Existing artifacts/node_modules symlink/prior uncommitted patch retained.
- W2 No staging, commits, subagents, installs, live network, publication, real private browser invocation. `git diff --cached --name-only` empty; no clean-worktree claim.
- N1 Fresh reviewer: review nine appended paths, rerun final commands. Prior 16 paths preserved byte-for-byte.
- N2 Private-input owner: recover complete immutable run plus matching legacy trees. After fresh review, inspect any pre-existing private scratch without deleting it, verify real inputs, then run `CONTENT_RUN=generated/asset-delivery/runs/<verified-run-id> npm run test:content:legacy`. Do not launch private gate before prerequisites hold.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "R6 exclusive fixed-path ownership, token-bound teardown, nested Vite output, approved one-line built-spec alignment; R7 bounded 8MiB acquisition with 15s timeout. Nine appended paths only; preceding 16-file patch and Content installer verified byte-identical."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "R6/R7 red failures captured; 16 new tests green; final 36 Node tests plus 2 Vitest contracts passed; nine-file strict tsc, format, lint, diff and staged checks passed. Exact commands, fixture limits and private-input blocker recorded."
    }
  ],
  "changedFiles": [
    "playwright.content-built.config.ts",
    "scripts/content-built-setup.ts",
    "scripts/content-built-teardown.ts",
    "scripts/lib/content-built-scratch.ts",
    "e2e-content/built-installer.spec.ts",
    "scripts/generate-shop-sets.ts",
    "scripts/lib/shop-set-fetch.ts",
    "tests/content-built-scratch.test.ts",
    "tests/shop-set-fetch.test.ts"
  ],
  "testsAddedOrUpdated": [
    "tests/content-built-scratch.test.ts: nine disposable ownership/lifecycle regressions",
    "tests/shop-set-fetch.test.ts: seven fake-fetch acquisition regressions",
    "e2e-content/built-installer.spec.ts: output path aligned only; actual private browser test not run"
  ],
  "commandsRun": [
    {
      "command": "node --test tests/content-built-scratch.test.ts (before R6 implementation)",
      "result": "failed",
      "summary": "Expected red: 0 passed, 3 failed; unsafe teardown and unguarded command reproduced solely in disposable roots."
    },
    {
      "command": "node --test --test-name-pattern='bounded shop|15-second|timeout remains|retains HTTP' tests/shop-set-fetch.test.ts (before R7 hardening)",
      "result": "failed",
      "summary": "Expected red: 1 passed, 3 failed; timeout signal absent."
    },
    {
      "command": "node --test --test-name-pattern='declared oversized|chunked shop' tests/shop-set-fetch.test.ts (before R7 hardening)",
      "result": "failed",
      "summary": "Expected red: 0 passed, 2 failed; uncapped responses accepted."
    },
    {
      "command": "node --test tests/content-built-scratch.test.ts tests/shop-set-fetch.test.ts tests/core-source-only-server.test.ts tests/browser-build-verification.test.ts tests/mvp-assets.test.ts tests/content-browser-run.test.ts",
      "result": "passed",
      "summary": "36 passed, 0 failed; 16 new tests."
    },
    {
      "command": "./node_modules/.bin/vitest run tests/unit/content-tooling-gates.test.ts",
      "result": "passed",
      "summary": "2 passed."
    },
    {
      "command": "Nine-path Prettier, ESLint, strict tsc; exact final shell block above",
      "result": "passed",
      "summary": "All nine appended files passed."
    },
    {
      "command": "Before/after SHA-256 comparison for 16 reviewed paths plus e2e-content/installer.spec.ts",
      "result": "passed",
      "summary": "All 17 byte-identical; temporary manifest removed afterward."
    },
    {
      "command": "git diff --check; git diff --exit-code -- scripts/lib/capped-response-body.ts e2e-content/installer.spec.ts vendor; test -z \"$(git diff --cached --name-only)\"",
      "result": "passed",
      "summary": "No whitespace errors, protected-path edits, or staged files."
    },
    {
      "command": "Read-only current-pointer and candidate/legacy manifest existence checks under /home/aron/Projects/ascencio",
      "result": "passed",
      "summary": "Confirmed selected run candidate.json and both legacy manifests remain missing."
    },
    {
      "command": "npm run test:content:legacy",
      "result": "not-run",
      "summary": "Missing verified private run and legacy trees; fresh review required. No private gate launch."
    }
  ],
  "validationOutput": [
    "Final Node batch: 36 passed, 0 failed.",
    "Vitest gate contracts: 2 passed.",
    "Scoped format/lint/strict types/diff: passed.",
    "Prior 16 paths plus installer SHA-256 unchanged; staged set empty.",
    "Disposable real Vite fixture proves marker survival; preview stub checks args only, no browser/private-pass claim."
  ],
  "residualRisks": [
    "Private current run candidate.json and both legacy manifests missing; real private gate remains blocked.",
    "Trusted-root ownership guards do not promise resistance to malicious concurrent filesystem replacement.",
    "Interrupted runs may leave scratch; future runs refuse rather than reclaim it.",
    "Full private/core browser gates, cold-cache CI and live generator acquisition unrun.",
    "8MiB per-set ceiling selected without live upstream sizing; oversized inputs fail closed."
  ],
  "noStagedFiles": true,
  "diffSummary": "Nine appended paths: four modified, five new. R6 safe scratch lifecycle and nested output; R7 extracted bounded fetch. Preceding reviewed 16-file patch preserved byte-for-byte.",
  "reviewFindings": [
    "R6 implemented; fresh independent review required.",
    "R7 implemented; fresh independent review required.",
    "Private acceptance blocker persists: missing immutable run candidate plus matching legacy manifests."
  ],
  "manualNotes": "Supervisor approved only one-line built-installer output-path alignment. Content installer remains untouched. No staging, commits, installs, subagents, live acquisition or real private gate. Own temporary baseline manifest and disposable fixtures removed."
}
```
