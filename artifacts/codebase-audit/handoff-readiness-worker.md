# Story handoff readiness — done

## Findings

- F1. **P2 confirmed/fixed: cold module preparation consumed UI assertion clocks.** `tests/component/StoryDuelHandoff.test.ts:153–167` dynamically imports real duel/story entries. Baseline probe: story import **5,596ms**, duel import **9,203ms**. Story 5s DOM wait expired with import pending; later cold-checkpoint `battle-root` 5s wait likewise expired with duel import pending. Worker starts remained **0**. Vite logged **80 transforms** during first story import, **120 transforms** during first duel import. Cause established: cold Vite import pipeline, not evidence of missing app-ready event after resolved modules.
- F2. **Minimal repair:** `tests/component/StoryDuelHandoff.test.ts:290–296` adds `beforeAll` awaiting `Promise.all([loaders.duel(), loaders.story()])`. Real modules resolve before test DOM/start clocks begin. No arbitrary sleep, fake modules, timeout increase, skip, retry, prod edit. Loader invocation/refusal behavior remains intact inside tests; rejection case passes both fixed cold runs.
- F3. **Isolation inspection:** baseline pending imports survived test teardown: story resolved during test 2; test-2/test-3 duel imports resolved during test 4. `cleanup()` does not cancel native imports. Existing teardown clears fixtures, mounted components, localStorage, mock instances/starts (`:308–315`); Testing Library also flushes `act()` then cleans up (`node_modules/@testing-library/svelte/src/vitest.js:4–11`). Shell awaits duel module before building/checkpointing encounter (`src/shell/AppShell.svelte:418–442`); checkpoint rebuild also awaits domain (`:456–478`). This explains downstream zero-start failures without inventing app-readiness defect. Fixed instrumented run: all **13** teardown exits had no pending observed loader imports, starts cleared to **0**. Unrelated isolation defects not ruled out globally.
- F4. **Approved assertions preserved byte-identical.** Existing setup/teardown plus every test body unchanged. Cold-checkpoint deck/collection/default, actual `startDuel` seat proof, absent picker, session hash, emitted surrender, story abort assertions retained at `tests/component/StoryDuelHandoff.test.ts:466–502`. Existing 5s DOM wait (`:216–224`), default start wait (`:318–327`), 30s hook/test config unchanged. Module preparation mounts no shell, seeds no session, starts no duel → checkpoint tests remain cold app-session tests, not cold bundler benchmarks.

## Plan / completion

- [x] P1. Inspect loaders/setup/teardown; verify: source paths in F1–F4, baseline pending-import/transform timings below.
- [x] P2. Bound diagnosis/verification to **3** fresh-process cold suite runs; verify: C1–C3. One baseline red, two fixed greens; no retry-until-pass.
- [x] P3. Preserve other nine approved paths; verify: SHA-256 entry/final comparison across 2,299 source files → only handoff test changed. Scoped types/lint/format plus diff checks pass.

## Cold-run evidence

Cmd cwd: exact-owned copy `/home/aron/Projects/ascencio/.tmp/codebase-audit-test-harness/.tmp/handoff-readiness-51ce/repo`. Node **v26.7.0**, installed Vitest **4.1.10**. Copy contained current tracked source, new storage test, locally copied installed deps; no installs. Original external deps symlink retained. First copy excluded `.vite`/`.vite-temp`; before each next run, copy-owned `.vite` moved outside repo. Each run started new Vitest process, one worker. No shared parent caches touched.

Cmd for C1/C2:
```sh
env -u NODE_OPTIONS DEBUG=vite:transform node node_modules/vitest/vitest.mjs run tests/component/StoryDuelHandoff.test.ts --maxWorkers=1 --reporter=verbose
```

Cmd for C3:
```sh
env -u NODE_OPTIONS node node_modules/vitest/vitest.mjs run tests/component/StoryDuelHandoff.test.ts --maxWorkers=1 --reporter=verbose
```

| ID | Variant | Result | Vitest timings |
|---|---|---|---|
| C1 | Entry source + copy-only timing probes | **10 passed, 3 failed**, exit 1 | 43.84s total; transform 24.11s; setup 8.10s; import 5.92s; tests 20.85s; env 8.08s |
| C2 | Preparation fix + same copy-only probes | **13 passed**, exit 0 | 24.04s total; transform 18.82s; setup 3.73s; import 3.64s; tests 13.56s; env 2.61s |
| C3 | Preparation fix, probes removed | **13 passed**, exit 0 | 25.18s total; transform 18.71s; setup 2.69s; import 3.09s; tests 16.62s; env 2.30s |

C1 trace, milliseconds from module-local probe epoch:
```text
367ms test=1 story import:start
394ms test=1 wait:story-map-screen:start
5441ms test=1 wait:story-map-screen:FAIL duration=5045ms pending=story hash=#/story starts=0
5539ms test=1 afterEach:end pending=story starts=0
5962ms test=2 story import:end duration=5596ms
7302ms test=2 duel import:start
8346ms test=2 afterEach:end pending=duel starts=0
8496ms test=3 wait:battle-root:start
8576ms test=3 duel import:start
13503ms test=3 wait:battle-root:FAIL duration=5006ms pending=duel hash=#/duel/session/77777777-2222-4333-8444-555555555555 starts=0
13519ms test=3 afterEach:end pending=duel starts=0
16504ms test=4 duel import:end duration=9203ms
16509ms test=4 duel import:end duration=7932ms
```

C1 exact errors:
```text
AssertionError: waiting for data-cy="story-map-screen": expected null not to be null
AssertionError: expected 0 to be greater than 0
AssertionError: waiting for data-cy="battle-root": expected null not to be null
```

C1 transform interval anchors:
```text
2026-09-23T13:41:31.947Z vite:transform 6.44ms /src/story/index.ts
2026-09-23T13:41:32.772Z vite:transform 802.71ms /src/story/StoryApp.svelte
2026-09-23T13:41:37.438Z vite:transform 14.63ms /src/story/collection/collection-cards.ts
2026-09-23T13:41:38.808Z vite:transform 5.79ms /src/battle/index.ts
2026-09-23T13:41:47.981Z vite:transform 2.22ms /src/battle/BattleFacade.svelte?svelte&type=style&lang.css
```

- T1. C2 preparation: start **29ms**, story resolved **6,764ms** (6,732ms import), duel resolved **8,296ms** (8,265ms import), preparation ended **8,296ms**, first `beforeEach` **8,340ms**. Both imports still exceed original 5s DOM budget; moving their actual completion before assertions fixes failure without extending waits.
- T2. C2 first story-map DOM wait **279ms**, first battle-root **128ms**; all battle-root waits **52–128ms**. Worker started before corresponding teardown; zero pending observed loader imports at all 13 teardown exits. C1's first working warm battle-root wait was **123ms** → similar UI latency after modules become available.
- T3. C3 first handoff **1,828ms**, seat case **597ms**, cold chosen-deck restore **112ms**, improved cold-checkpoint start/outcome case **302ms**. All 13 tests executed; none skipped. C3 used uninstrumented source; subsequent sole change expanded Vitest import formatting. Programmatic Prettier normalization proved executed C3 source equals final source. No fourth runtime run.
- T4. Timing is import/transform evidence, not performance benchmark. Instrumentation/load contention can change wall time; no claim every pending millisecond is transform CPU. Independent uninstrumented C3 validates behavior after repair. Two fixed cold passes are bounded supporting evidence, not universal flake-free certification.

## Focused quality / preservation

- Q1. In copied cwd: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.readiness.json` → exit **0**. Scratch config extended repo tsconfig; included handoff test, `src/**/*.d.ts`, transitive imports only. No full-repo type run.
- Q2. `node node_modules/eslint/bin/eslint.js tests/component/StoryDuelHandoff.test.ts` → exit **0**.
- Q3. Initial scoped Prettier → exit **1**, `[warn] Code style issues found in the above file. Run Prettier with --write to fix.` Expanded changed Vitest import; final `node node_modules/prettier/bin/prettier.cjs --check tests/component/StoryDuelHandoff.test.ts` → exit **0**, `All matched files use Prettier code style!`.
- Q4. Entry/final SHA-256 comparison: **2,298** other source files byte-identical. Includes all nine protected approved paths: `tests/asset-delivery-bundle.test.ts`, `tests/component/deck-editor/editor-import.test.ts`, `tests/component/story/cancel-controls.test.ts`, `tests/component/story/pre-battle-deck-picker.test.ts`, `tests/progressive-producer.test.ts`, `tests/progressive-publisher.test.ts`, `tests/unit/duel-worker-runtime.test.ts`, `vitest.config.ts`, `tests/component/jsdom-storage.test.ts`. Entire handoff file suffix beginning `beforeEach(async () => {` byte-identical → prior checkpoint repair preserved.
- Q5. `git diff --check` → exit **0**; `git diff --cached --name-only` → empty. `readlink node_modules` unchanged: `/home/aron/Projects/ascencio/node_modules`. No install/lock/config/system/stage/commit/subagent actions.
- Q6. Exact-owned scratch removed after source/hash/quality verification: `/home/aron/Projects/ascencio/.tmp/codebase-audit-test-harness/.tmp/handoff-readiness-51ce`. Included copied deps, instrumentation, logs, cache copies, scratch tsconfig. `.tmp/` empty. Evidence above retained inline.
- Q7. Required graph query attempted first: `graphify query "StoryDuelHandoff test domain loaders dynamic imports setup teardown"` → exit **127**, `/bin/bash: line 1: graphify: command not found`. Direct source inspection substituted.

## Assumptions

- A1. Three-run bound applies across baseline plus fixed cold runs. All 13 handoff cases executed each time; no broader suite during active acceptance/perf matrix.
- A2. Prior review documents external deps-link resolution failure; same local-deps-copy workaround used without spending run budget re-proving environment fault. Original symlink unchanged.
- A3. Component contract proves shell/coordinator reaches mocked Worker `startDuel`, then handles emitted result. No real Worker/WASM/browser proof claimed. Cold session means empty mounted app/coordinator state restored from checkpoint; Vite's module compilation is test-runner preparation.

## Residual risks / next action

- R1. **P2 environment:** external deps-link resolution issue remains outside this repair. Reviewer run fresh local-deps copy or normal local-deps checkout; do not replace existing symlink silently.
- R2. **Bounded verification:** two fixed cold passes establish observed improvement only. Existing **30s** hook budget bounds preparation; extreme compiler starvation may fail hook instead of misleading DOM assertion. No timeout increase warranted.
- R3. **Out of scope:** real browser cold module loading/cancellation, full-repo acceptance, parent-owned TS2345 at `tests/fixtures/node-duel-worker-harness.ts:96`, acceptance/perf matrix not rerun. Baseline cross-test pending imports proven; no separate production isolation diagnosis claimed.
- R4. **Next action:** parent request fresh independent review of this handoff-only delta, confirm protected-path hashes, repeat scoped cold proof as reviewer budget permits. No implementation blocker remains.

## Files touched

- D1. Repo: `tests/component/StoryDuelHandoff.test.ts` — `beforeAll` import plus 8-line preparation/comment block; pre-existing approved repair retained.
- D2. Deliverable: `/home/aron/Projects/ascencio/artifacts/codebase-audit/handoff-readiness-worker.md`.
- D3. Owned scratch only; removed per Q6. No other source/config edits.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "F1–F4 cite exact paths, confirmed P2 cold-import cause, minimal test-only preparation; C1–C3 show red/green with timing; R1–R4 disclose residual risks and fresh-review action."
    }
  ],
  "changedFiles": [
    "tests/component/StoryDuelHandoff.test.ts",
    "/home/aron/Projects/ascencio/artifacts/codebase-audit/handoff-readiness-worker.md"
  ],
  "testsAddedOrUpdated": [
    "tests/component/StoryDuelHandoff.test.ts"
  ],
  "commandsRun": [
    {
      "command": "graphify query \"StoryDuelHandoff test domain loaders dynamic imports setup teardown\"",
      "result": "failed",
      "summary": "Exit 127: graphify unavailable; direct inspection substituted."
    },
    {
      "command": "env -u NODE_OPTIONS DEBUG=vite:transform node node_modules/vitest/vitest.mjs run tests/component/StoryDuelHandoff.test.ts --maxWorkers=1 --reporter=verbose",
      "result": "failed",
      "summary": "C1 baseline, copy-only instrumentation: 10 passed, 3 failed; story 5596ms, duel 9203ms imports exceed UI/start clocks; pending imports survive teardown."
    },
    {
      "command": "env -u NODE_OPTIONS DEBUG=vite:transform node node_modules/vitest/vitest.mjs run tests/component/StoryDuelHandoff.test.ts --maxWorkers=1 --reporter=verbose",
      "result": "passed",
      "summary": "C2 fixed cold run: 13 passed; prep 8267ms before first test, battle-root waits 52–128ms, no pending loader imports at teardown."
    },
    {
      "command": "env -u NODE_OPTIONS node node_modules/vitest/vitest.mjs run tests/component/StoryDuelHandoff.test.ts --maxWorkers=1 --reporter=verbose",
      "result": "passed",
      "summary": "C3 fixed uninstrumented cold run: 13 passed; 25.18s total; improved cold-checkpoint start/outcome case 302ms."
    },
    {
      "command": "node node_modules/typescript/bin/tsc --noEmit -p tsconfig.readiness.json",
      "result": "passed",
      "summary": "Scoped handoff test and transitive imports; exit 0."
    },
    {
      "command": "node node_modules/eslint/bin/eslint.js tests/component/StoryDuelHandoff.test.ts",
      "result": "passed",
      "summary": "Exit 0."
    },
    {
      "command": "node node_modules/prettier/bin/prettier.cjs --check tests/component/StoryDuelHandoff.test.ts",
      "result": "failed",
      "summary": "Initial new Vitest import needs multiline format; repaired only import."
    },
    {
      "command": "node node_modules/prettier/bin/prettier.cjs --check tests/component/StoryDuelHandoff.test.ts",
      "result": "passed",
      "summary": "Final source passes; formatter-normalized C3 executed source equals final bytes."
    },
    {
      "command": "git diff --check; git diff --cached --name-only; readlink node_modules",
      "result": "passed",
      "summary": "Whitespace clean, nothing staged, original deps symlink unchanged."
    }
  ],
  "validationOutput": [
    "V1. Exactly three fresh-process, cache-cold full-file runs: baseline 10/13; fixed 13/13; fixed uninstrumented 13/13. No flaky retry-pass claim.",
    "V2. Baseline pending imports overlap 80 story-interval and 120 duel-interval Vite transforms; unchanged UI clocks fail before imports resolve.",
    "V3. Fixed preparation awaits actual real-domain promises before assertions; existing start/outcome/refusal/checkpoint assertions pass.",
    "V4. 2298 other source files byte-identical, including all nine protected approved paths; all test bodies and existing setup/teardown unchanged.",
    "V5. Scoped types/lint/format/diff pass; owned scratch removed."
  ],
  "residualRisks": [
    "R1. Original external deps symlink resolution workaround remains necessary.",
    "R2. Two fixed cold passes support diagnosis, not universal flake-free guarantee; existing 30s hook limit remains.",
    "R3. Browser Worker/WASM, broader acceptance/perf matrix, parent TS2345 not tested or changed.",
    "R4. Fresh independent review still required."
  ],
  "noStagedFiles": true,
  "diffSummary": "Handoff-only beforeAll readiness preparation; no assertion/timeouts/teardown changes. Ten prior approved fixes preserved. Report plus removed owned scratch.",
  "reviewFindings": [
    "F1. Fixed P2: tests/component/StoryDuelHandoff.test.ts:153–167 cold dynamic imports exceeded UI wait budgets, escaped teardown.",
    "F2. tests/component/StoryDuelHandoff.test.ts:290–296 awaits real domain code before test clock; no production readiness change needed for reproduced failure.",
    "F3. tests/component/StoryDuelHandoff.test.ts:466–502 approved cold-checkpoint actual-start/outcome proof retained byte-identical.",
    "F4. No remaining implementation blocker within assigned handoff-only scope."
  ],
  "manualNotes": "Sole writer; no installs, config edits, commits, staging, subagents. Exactly three runtime runs. Parent owns fresh review."
}
```
