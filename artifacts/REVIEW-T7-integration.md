## Review

### Assumptions
- A1. `plan.md` + `progress.md` requested by task absent at repo root (`ENOENT`). Reviewed T7 ticket/report/ledger instead: `artifacts/PLAN_2026_09_13_content_module_rearchitecture/T7_battle-runtime.md`, `artifacts/IMPLEMENTATION-REPORT-T7.md`, `artifacts/IMPLEMENTATION-LEDGER-T4-through-T11.md`.

### Blocker
- B1. **High — startup/heap comparison not attested apples-to-apples.** `artifacts/IMPLEMENTATION-REPORT-T7.md:38-44` claims semantic Node startup/heap below legacy baseline. `artifacts/T7-EVIDENCE/commands.json:3-60` records no command/script for either measurement; only output JSON exists (`baseline-measurement.log:1`, `semantic-measurement.log:1`). Browser harness proves interval excludes Shell adapter load: `source.load()` completes at `e2e-content/t7-runtime.spec.ts:80`; timer starts only at :120. Adapter performs 256 card shards, 256 text shards, 256 script shards, globals, strings, WASM reads + parse at `src/shell/adapters/legacy-battle-runtime.ts:73-220`. Thus reported Worker-only duration cannot support startup/heap regression claim for product initialization. Fix: record reproducible legacy + semantic cmds/scripts; measure same interval from `BattleRuntimeSource.load()` start through Worker `ready`; capture same process/browser heap metric. Then update report numbers/claim.

### Correct
- C1. **Battle Content isolation holds.** `tests/unit/domain-boundaries.test.ts` runtime scan passed; `src/battle/` has zero resolved Content imports. Shell owns legacy Content translation: `src/shell/AppShell.svelte:90-105`, `src/shell/adapters/legacy-battle-runtime.ts:56-220`. Battle receives semantic ports only: `src/battle/BattleFacade.svelte:5-18`, `src/battle/app/App.svelte:116-117`.
- C2. **Whole support/pool split correct.** Adapter loads full runtime card/text/script support, derives chapter pool from `gameplay.cards` at `src/shell/adapters/legacy-battle-runtime.ts:61-65,150-209`. Worker validates support before both-seat pool at `src/battle/worker/decks/resolve-duel-decks.ts:57-63`. Real-WASM test proves support-only card available to engine yet rejected for player + opponent: `tests/integration/installed-runtime-wasm.test.ts:46-98`.
- C3. **Required read error path correct.** Source maps failed session/read/decode to `APP_REQUIRED_INPUT_FAILED`: `src/shell/adapters/legacy-battle-runtime.ts:67-80,224-229`. Client emits same Shell-visible failure: `src/battle/app/DuelWorkerClient.ts:192-219`; regression at `tests/unit/duel-worker-client.test.ts:657-675`.
- C4. **WASM/replay source contract correct.** Client transfers one buffer, pins snapshot across replacement, aborts stale loads: `src/battle/app/DuelWorkerClient.ts:152-224`. Test checks fresh detached buffers plus exact snapshot after replacement: `tests/unit/duel-worker-client.test.ts:598-630`. Exact runtime source test checks fresh buffers/same snapshot: `tests/integration/installed-runtime-wasm.test.ts:34-44`.
- C5. **Optional art no runtime HTTP fallback.** Production Shell image adapter reads installed asset only, returns `null` status on missing/corrupt/unreadable: `src/shell/cards/installed-card-image-source.ts:66-102`. Battle semantic library only calls injected `CardImageSource`: `src/battle/app/images/card-image-cache.ts:74-132`. No production instantiation of retained legacy `CardImageCache` found.
- C6. **Native browser Worker evidence real enough for transport path.** Chromium test loads actual Shell adapter, generated runtime files, vendored WASM, browser Worker; asserts ready → prompt → surrender + detached buffer: `e2e-content/t7-runtime.spec.ts:73-145`; evidence identifies Worker URL and 14,794 cards/13,549 scripts: `artifacts/T7-EVIDENCE/real-browser-runtime.json:21-34`.
- C7. **Preservation scope holds.** `git diff --check 86631c9` passed. Vendor diff empty. `npm run vendor:verify` passed `ocgcore-wasm@0.1.2`, 21 files. No staged files.

### Note
- N1. **Accepted transitional seam.** Shell legacy adapter still translates installed Content until T9 selector/lifecycle composition. Parent explicitly allows it. It stays under `src/shell/adapters/`; Battle has no raw Content dependency. Do not block T7 on this seam.
- N2. Focused validation rerun passed: 79 tests (`battle-runtime-input`, `duel-worker-client`, `installed-runtime-wasm`, domain boundaries); exact ticket set rerun passed 46 tests; `npm run vendor:verify` passed; `npm run typecheck` passed 0 errors, 4 known warnings. Full `npm run lint` remains failed per existing `.tmp/worktrees/core-integrate` inferred TS-root conflict; not rerun.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "B1 concrete high-severity attestation blocker; C1-C7 verified source/test evidence with paths and lines."
    }
  ],
  "changedFiles": [
    "artifacts/REVIEW-T7-integration.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git diff --check 86631c9 && npx vitest run tests/unit/battle-runtime-input.test.ts tests/unit/duel-worker-client.test.ts tests/integration/installed-runtime-wasm.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose",
      "result": "passed",
      "summary": "79 tests passed; diff check passed"
    },
    {
      "command": "npx vitest run tests/unit/card-visibility.test.ts tests/integration/installed-runtime-wasm.test.ts tests/unit/domain-boundaries.test.ts --reporter=verbose && npm run vendor:verify && npm run typecheck",
      "result": "passed",
      "summary": "46 tests passed; vendor 21 files; typecheck 0 errors, 4 warnings"
    },
    {
      "command": "npm run lint",
      "result": "failed",
      "summary": "Not rerun; T7 evidence records existing inferred TS config-root failure"
    }
  ],
  "validationOutput": [
    "V1 79 focused tests passed.",
    "V2 46 ticket tests passed; vendor verification passed; typecheck 0 errors.",
    "V3 browser evidence confirms real Worker/WASM ready-prompt-result and transferred WASM detachment.",
    "V4 performance baseline claim lacks reproducible apples-to-apples evidence."
  ],
  "residualRisks": [
    "B1: startup/heap attestation invalid until same-interval reproducible measurements include semantic source assembly.",
    "N2: full lint remains blocked by existing .tmp/worktrees/core-integrate inferred TS config-root conflict."
  ],
  "noStagedFiles": true,
  "diffSummary": "T7 working diff removes Battle Content coupling, adds Shell semantic runtime adapter, transfers runtime DTO/WASM to Worker, migrates tests and consumers.",
  "reviewFindings": [
    "B1 high: artifacts/IMPLEMENTATION-REPORT-T7.md:38-44 startup/heap baseline claim is not apples-to-apples or reproducible.",
    "N1 accepted: src/shell/adapters/legacy-battle-runtime.ts:55 legacy Shell translation remains allowed until T9.",
    "C1-C7: runtime isolation, pool enforcement, read errors, replay buffer reload, image behavior, browser Worker, vendor preservation verified."
  ],
  "manualNotes": "Next: rerun legacy and semantic initialization benchmark from BattleRuntimeSource.load start through Worker ready; save exact commands and same-metric outputs before accepting B1."
}
```