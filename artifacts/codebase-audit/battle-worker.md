# Battle worker — F1–F3 implemented; F4 rejected

## State / scope

- S1. **Done:** F1–F3 impl + regression-first checks. **Review required:** fresh independent reviewer owns next pass. Worktree: `/home/aron/Projects/ascencio/.tmp/codebase-audit-battle`; base HEAD: `456551dc1cf8fc4e9fdb754095f3a8279f5b2c37`.
- S2. **Green:** final focused run → **15 files, 446 tests**. Changed-file Prettier, ESLint, `git diff --check` passed. Chromium 50,000-candidate prompt rendered 256 choice buttons; final candidate submitted.
- S3. **Blocked global type gate:** unchanged `tests/fixtures/node-duel-worker-harness.ts:96` fails `tsc`/`svelte-check`. No changed-file diagnostics. Exact error below.
- S4. Parent decisions: reject F4 after pinned-core source verification; approve minimal announcement-only paging after 50k unpaged Chromium timeout. No vendor/loader/deps/tracked-config edits. No staging, commits, pushes, subagents.

## Semantic verification / fixes

- F1. `PromptRegistry.ts:1162–1164` emits `overlay: true`; `player-prompt.ts:60` already permits literal `true`. `duel-worker-event.ts:419–442` now admits marker, rejects every present value except `true`. Choice-card + context-card producer→parser regressions; concealed identity rejection retained.
- F2. Pinned core subtracts LP cost, emits dedicated payment msg: [operations.cpp:696–752](https://github.com/edo9300/ygopro-core/blob/8e5f4e4f0ab6b8ca750e8e1c91c1a58f407e3272/operations.cpp#L696-L752). Vendored `dist/index.js` reader case 100 returns `{type, player, amount}`; `dist/index.d.ts:1048–1052` agrees. `DuelStateProjector.ts:455–464` now subtracts payment, emits `lifePointsChanged`, never damage. Both seats tested: 8000→7000 payment→5200 damage→5700 recovery→1200 absolute update→0 payment; other seat unchanged. Public state/event parser exercised.
- F3. Pinned core accepts declared card code after opcode filtering, not candidate index: [playerop.cpp:1075–1095](https://github.com/edo9300/ygopro-core/blob/8e5f4e4f0ab6b8ca750e8e1c91c1a58f407e3272/playerop.cpp#L1075-L1095). `PromptRegistry.ts:757–789` retains complete opcode-matching list. `battle-runtime-source.ts:4` admits 50,000 cards. `duel-worker-event.ts:63–65,303–310` now applies separate 50,000 announcement bound; ordinary choices/selection bounds remain 256. Worker still requires exactly one response. Tests cover 257/50,000 legal candidates, final card code, zero/multiple response rejection, ordinary-prompt cap, selection cap, 50,001 rejection.
- F4. **Rejected/unreachable under pinned core; no code/test added.** [playerop.cpp:279–331](https://github.com/edo9300/ygopro-core/blob/8e5f4e4f0ab6b8ca750e8e1c91c1a58f407e3272/playerop.cpp#L279-L331) writes `cancelable || min == 0` at line 308; response parser receives same expression at line 319. Thus `min=0, can_cancel=false` cannot originate from pinned SELECT_CARD processor. Vendor writer distinguishes `[]`→two zero i32 words from `null`→`-1`; this alone does not establish audit's fatal-duel premise. Parent explicitly rejected defensive fix for impossible scenario. Existing cancellation behavior preserved.
- F5. Core SHA above comes from frozen `vendor/ocgcore-wasm/0.1.2/vendor-manifest.json:8`. Primary source fetched read-only via Python `urllib.request`; vendor response source additionally inspected through shipped `dist/index.js.map`. Nothing vendored modified.

## Approved F3 rendering extension

- P1. Before impl: real `PromptControls` in headless Chromium, dev Vite harness. 257 candidates: **511.3ms render**, final response `["card-256"]`. 50,000 candidates: initial `page.goto: Timeout 30000ms exceeded.`; retry `page.waitForFunction: Timeout 120000ms exceeded.`
- P2. Parent approved: announcement-only paging above 256; retain full protocol list; accessible first/previous/next/last controls; prompt-ID reset; disabled-state handling; no search/UI abstraction.
- P3. Impl: `PromptControls.svelte:36–49,81–87,261–306`. Only rendered slice changes. Full prompt still validates/submits original opaque IDs. Other prompt families unchanged.
- P4. After impl: same headless Chromium harness additionally passed prompt through `parseDuelWorkerEvent`; asserted first-page count, last-page count, final response, disabled paging after submit. Output:

```json
{"count":257,"renderMs":229.29999999981374,"buttons":260,"choiceButtons":256,"elements":533,"lastPageChoiceButtons":1,"lastPageAndSubmitMs":397,"response":["card-256"]}
{"count":50000,"renderMs":831.2999999998137,"buttons":260,"choiceButtons":256,"elements":533,"lastPageChoiceButtons":80,"lastPageAndSubmitMs":462,"response":["card-49999"]}
```

- P5. Measurements = synthetic catalog, Chromium dev harness; not production-installed-catalog SLA. Harness used `node --input-type=module`, Vite `createServer({configFile:false,plugins:[svelte()]})`, Playwright `chromium.launch({headless:true})`, actual component mount, two animation frames after `tick()`, accessible-name clicks. Parser + engine-producer coverage resides in persistent unit tests; browser harness itself used synthetic clone-safe prompt, not WASM.

## Changed files / tests

- C1. `src/battle/duel/contracts/duel-worker-event.ts` — overlay validation; announcement-specific candidate bound.
- C2. `src/battle/worker/projection/DuelStateProjector.ts` — LP-payment projection/event.
- C3. `src/battle/app/prompts/PromptControls.svelte` — announcement-only paging.
- C4. `tests/unit/prompt-registry.test.ts:483–605` — six regressions: two overlay producer paths, two marker/privacy paths, two announcement sizes/bounds/responses.
- C5. `tests/unit/duel-state-projector.test.ts:4195–4254` — two LP-sequence regressions, both seats.
- C6. `tests/component/PromptControls.test.ts:79–153` — four regressions: threshold 256 unpaged; 257/50,000 paged/final response; pending/reset/page navigation.
- C7. Final diff: **6 files, 351 insertions, 3 deletions**. No `PromptRegistry.ts` impl change; F4 deliberately untouched.

## Red evidence

- R1. Before src edits:

```sh
npx vitest run tests/unit/prompt-registry.test.ts tests/unit/duel-state-projector.test.ts tests/component/PromptControls.test.ts --maxWorkers=2
```

```text
Test Files  3 failed (3)
Tests  8 failed | 114 passed (122)
AssertionError: expected 8000 to be 7000 // Object.is equality
DuelWorkerEventValidationError: Worker event contains an invalid prompt.choices[0].card.overlay
DuelWorkerEventValidationError: Worker event contains an invalid prompt.contextCard.overlay
DuelWorkerEventValidationError: Worker event contains an invalid prompt.choices length
```

- R2. R1 component suite could not load shared-symlink setup module. `--globals`, `NODE_OPTIONS=--preserve-symlinks --configLoader runner`, in-memory `resolve.preserveSymlinks` alone did not fix it. Exact setup error:

```text
Error: Cannot find module '/@fs/home/aron/Projects/ascencio/node_modules/@testing-library/svelte/src/vitest.js'
```

- R3. In-memory Vitest config with `svelteTesting({autoCleanup:false})` exposed initial component regression: **1 failed, 12 passed**; same `prompt.choices length` error. Test file already owns cleanup.
- R4. Parent-provided scratch-config workaround then ran actual project plugins/setup unchanged. Before paging impl:

```sh
npx vitest run tests/component/PromptControls.test.ts --maxWorkers=2 --config .tmp/vitest-battle.config.ts -t 'pages|paging'
```

```text
Test Files  1 failed (1)
Tests  3 failed | 12 skipped (15)
DuelWorkerEventValidationError: Worker event contains an invalid prompt.choices length
TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Next page"
```

## Green / checks

- V1. Final focused run:

```sh
npx vitest run tests/unit/{prompt-registry,prompt-selection,contracts,duel-state-projector,duel-worker-client,duel-worker-runtime,duel-store,opponent-policy,headless-reconciliation,headless-lifecycle,card-visibility,card-preview,data-cy-coverage,domain-boundaries}.test.ts tests/component/PromptControls.test.ts --maxWorkers=2 --config .tmp/vitest-battle.config.ts
```

```text
Test Files  15 passed (15)
Tests  446 passed (446)
Duration  165.21s
```

- V2. Scratch config below enabled shared-symlink resolution. Removed after checks; recreate only when rerunning isolated worktree checks. Tracked config unchanged.

```ts
import { mergeConfig } from "vitest/config";
import config from "../vitest.config.ts";

export default mergeConfig(config, {
  resolve: { preserveSymlinks: true },
  server: { fs: { allow: ["/home/aron/Projects/ascencio"] } },
});
```

- V3. Intermediate green: direct unit regressions **122 passed**; component suite **15 passed** before final threshold test; data-cy/domain-boundary suites **87 passed**. Broader default-config attempt had **395 passed**, data-cy suite setup failure per R2; superseded by V1.
- V4. One component pending/reset test initially timed out at 30,000ms under load. Scoped nav queries with `within(navigation)` avoided repeated full-grid accessible-name scans; no timeout increase, weaker assertions, or skipped tests. V1 passed.
- V5. Final format/lint/whitespace cmds, exit 0:

```sh
npx prettier --check src/battle/duel/contracts/duel-worker-event.ts src/battle/worker/projection/DuelStateProjector.ts src/battle/app/prompts/PromptControls.svelte tests/unit/prompt-registry.test.ts tests/unit/duel-state-projector.test.ts tests/component/PromptControls.test.ts
npx eslint src/battle/duel/contracts/duel-worker-event.ts src/battle/worker/projection/DuelStateProjector.ts src/battle/app/prompts/PromptControls.svelte tests/unit/prompt-registry.test.ts tests/unit/duel-state-projector.test.ts tests/component/PromptControls.test.ts
git diff --check
```

```text
Checking formatting...
All matched files use Prettier code style!
```

- V6. `npx tsc --noEmit`: first attempt timed out at 180s; retry exited 2 with sole diagnostic:

```text
tests/fixtures/node-duel-worker-harness.ts(96,33): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'Error'.
```

- V7. `npx svelte-check --tsconfig ./tsconfig.json`: same sole error, four unrelated warnings (ShopSellScreen CSS; unused fixture exports). Summary: `svelte-check found 1 error and 4 warnings in 4 files`. Failing fixture byte-identical to HEAD; `git diff -- tests/fixtures/node-duel-worker-harness.ts` empty. No baseline typecheck rerun claimed.
- V8. Final `git diff --cached --name-only` → empty. Final status → six intended modified files, pre-existing untracked `node_modules` symlink. No vendor/package/lockfile/config diffs.

## Assumptions / residuals / next action

- A1. Graphify fallback authorized in task; direct inspection used. Shared `node_modules` symlink preserved.
- A2. Announcement bound follows current runtime 50,000-card cap; future runtime-bound change requires matching protocol-bound review.
- A3. Browser timing evidence uses synthetic short labels + dev build; no full installed-catalog duel or fresh real-WASM run. Core semantics verified against manifest-pinned primary source instead.
- A4. Ordinary prompt bound stays 256. No unrelated protocol/tribute/privacy redesign.
- A5. Removed own scratch files after reading: `.tmp/battle-announce-render.html`, `.tmp/battle-announce-render.ts`, `.tmp/vitest-battle.config.ts`. No other files removed.
- A6. Next action: independent reviewer inspects six-file diff + V1; parent owns unchanged fixture type error, acceptance, commit/merge. Worker performs no further writes after this report.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "F1-F3 fixed in three battle source files. Parent rejected unreachable F4; approved measured announcement-only paging extension. No vendor/loader/deps/tracked-config edits."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Pinned-source semantics, exact red failures, 15-file/446-test green run, Chromium 50k-candidate submission, changed-file format/lint, explicit typecheck residual, empty index."
    }
  ],
  "changedFiles": [
    "src/battle/duel/contracts/duel-worker-event.ts",
    "src/battle/worker/projection/DuelStateProjector.ts",
    "src/battle/app/prompts/PromptControls.svelte",
    "tests/unit/prompt-registry.test.ts",
    "tests/unit/duel-state-projector.test.ts",
    "tests/component/PromptControls.test.ts"
  ],
  "testsAddedOrUpdated": [
    "tests/unit/prompt-registry.test.ts: six producer/parser, privacy, announcement-bound/response regressions",
    "tests/unit/duel-state-projector.test.ts: two LP-sequence regressions",
    "tests/component/PromptControls.test.ts: four announcement paging/threshold/pending/reset regressions"
  ],
  "commandsRun": [
    {
      "command": "npx vitest run tests/unit/prompt-registry.test.ts tests/unit/duel-state-projector.test.ts tests/component/PromptControls.test.ts --maxWorkers=2",
      "result": "failed",
      "summary": "Pre-fix: 8 failed, 114 passed; component setup also blocked by shared-symlink /@fs import."
    },
    {
      "command": "npx vitest run tests/component/PromptControls.test.ts --maxWorkers=2 --config .tmp/vitest-battle.config.ts -t 'pages|paging'",
      "result": "failed",
      "summary": "Pre-fix: 3 failed, 12 skipped; candidate cap and missing page controls reproduced."
    },
    {
      "command": "npx vitest run tests/unit/{prompt-registry,prompt-selection,contracts,duel-state-projector,duel-worker-client,duel-worker-runtime,duel-store,opponent-policy,headless-reconciliation,headless-lifecycle,card-visibility,card-preview,data-cy-coverage,domain-boundaries}.test.ts tests/component/PromptControls.test.ts --maxWorkers=2 --config .tmp/vitest-battle.config.ts",
      "result": "passed",
      "summary": "Final: 15 files, 446 tests; 165.21s. Scratch config recorded in V2, removed after validation."
    },
    {
      "command": "node --input-type=module (isolated Vite/Playwright render probe; P1-P5)",
      "result": "passed",
      "summary": "Post-fix Chromium: 50,000 candidates, 256 visible choices, 831.3ms render, final candidate submitted. Pre-fix 30s/120s timeouts recorded separately."
    },
    {
      "command": "npx prettier --check src/battle/duel/contracts/duel-worker-event.ts src/battle/worker/projection/DuelStateProjector.ts src/battle/app/prompts/PromptControls.svelte tests/unit/prompt-registry.test.ts tests/unit/duel-state-projector.test.ts tests/component/PromptControls.test.ts",
      "result": "passed",
      "summary": "All matched files use Prettier code style."
    },
    {
      "command": "npx eslint src/battle/duel/contracts/duel-worker-event.ts src/battle/worker/projection/DuelStateProjector.ts src/battle/app/prompts/PromptControls.svelte tests/unit/prompt-registry.test.ts tests/unit/duel-state-projector.test.ts tests/component/PromptControls.test.ts",
      "result": "passed",
      "summary": "Exit 0; no diagnostics."
    },
    {
      "command": "npx tsc --noEmit",
      "result": "failed",
      "summary": "Unchanged tests/fixtures/node-duel-worker-harness.ts:96 TS2345; no changed-file diagnostics."
    },
    {
      "command": "npx svelte-check --tsconfig ./tsconfig.json",
      "result": "failed",
      "summary": "Same unchanged fixture error; four unrelated warnings."
    },
    {
      "command": "git diff --check; git diff --cached --name-only; git status --short",
      "result": "passed",
      "summary": "Clean whitespace, empty index; six intended modifications plus pre-existing node_modules symlink."
    }
  ],
  "validationOutput": [
    "Red: expected 8000 to be 7000; invalid prompt.choices[0].card.overlay; invalid prompt.contextCard.overlay; invalid prompt.choices length.",
    "Green: Test Files 15 passed (15); Tests 446 passed (446).",
    "Chromium 50000: choiceButtons=256, lastPageChoiceButtons=80, response=[card-49999]."
  ],
  "residualRisks": [
    "Global typecheck blocked by unchanged fixture TS2345.",
    "Chromium evidence uses synthetic catalog/dev harness, not installed-content production duel.",
    "No fresh real-WASM regression run; pinned primary-source semantics verified.",
    "Independent review required before acceptance/commit/merge."
  ],
  "noStagedFiles": true,
  "diffSummary": "Six files; 351 insertions, 3 deletions. F1/F2 protocol projection fixes; F3 bounded complete announcements with approved paged rendering; twelve added test cases; F4 untouched after disproof.",
  "reviewFindings": [
    "F4 audit claim rejected: pinned processor writes and parses cancelable || min == 0.",
    "No implementation blockers observed in focused checks; independent review pending."
  ],
  "manualNotes": "Scratch files removed; shared node_modules preserved. No stage/commit/push. Worker finished writing; reviewer owns next pass."
}
```
