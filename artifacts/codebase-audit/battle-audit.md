# Battle audit — checkpoint

## Review

- R1. **Done: actionable findings. Partial: coverage.** Parent steering ended audit before remaining src/tests review. No clean-audit claim.
- R2. **Correct:** focused checks passed: **14 files, 356 tests**. Existing tests miss producer → browser-validator mismatches below.
- R3. **Fixed:** none. Src, tests, user dirty files preserved. Runtime saves report.

## Findings

### F1 — P1: Overlay-selection prompts terminate browser duel

**Evidence:** `src/battle/worker/protocol/PromptRegistry.ts:1162–1164` emits `card.overlay: true`. `src/battle/duel/contracts/duel-worker-event.ts:400–420` excludes `overlay` from exact-key allowlist.

**Repro:** Human receives `SELECT_CARD` with `location: MONSTER | OVERLAY`. Pass generated prompt through `parseDuelWorkerEvent`.

Observed:
```text
Worker event contains an invalid prompt.choices[0].card.overlay
```

Client treats parser rejection as fatal Worker failure.

**Minimal fix:** Allow optional `overlay`; validate present value strictly equals `true`. Test real producer output through event parser. Test context-card path too.

**Regression cmd:**
```sh
npx vitest run tests/unit/contracts.test.ts tests/unit/prompt-registry.test.ts tests/unit/duel-worker-client.test.ts
```

**Coverage gap:** Existing Xyz integration calls controller/DOM directly; inspected section never crosses browser event parser (`tests/integration/xyz-detach-overlay-address.test.ts:97–139`).

### F2 — P1: LP payments never update projected LP

**Evidence:** `src/battle/worker/projection/DuelStateProjector.ts:443–471` handles damage, recovery, absolute LP updates; no `PAY_LIFE_POINTS` case. Engine exports payment msg separately; vendor contract specifies `player`, `amount` (`vendor/ocgcore-wasm/0.1.2/dist/index.d.ts:1048–1052`).

**Repro:** Fresh projector → apply `{type:100, player:0, amount:1000}`.

Observed:
```text
LP COST: actual 8000 expected 7000
```

LP-cost activation leaves HUD wrong. Subsequent damage/recovery uses stale total.

**Minimal fix:** Subtract payment amount; emit `lifePointsChanged`, not damage. Test payment → damage → recovery.

**Regression cmd:**
```sh
npx vitest run tests/unit/duel-state-projector.test.ts tests/unit/headless-reconciliation.test.ts
```

### F3 — P1: Legal card-announcement lists exceed browser protocol limit

**Evidence:** `src/battle/worker/protocol/PromptRegistry.ts:757–789` emits all opcode-matching catalog cards. `src/battle/duel/contracts/duel-worker-event.ts:68` caps prompt choices at 256. Runtime input permits 50,000 cards (`src/battle/ports/battle-runtime-source.ts:4`).

**Repro:** Dependencies contain 257 ordinary monsters. Build `ANNOUNCE_CARD` with truthy opcode expression `[1n]`; parse emitted prompt.

Observed:
```text
choices 257
Worker event contains an invalid prompt.choices length
```

Any supported announcement matching >256 loaded cards terminates browser duel. Large installed-catalog behavior needs browser regression; truncating list would remove legal choices.

**Minimal fix:** Separate announcement candidate bound from response/card-selection bound. Permit bounded complete announcement list; retain one-choice response. Check rendering cost before adopting full runtime maximum.

**Regression cmd:**
```sh
npx vitest run tests/unit/contracts.test.ts tests/unit/prompt-registry.test.ts tests/component/PromptControls.test.ts
```

### F4 — P2: Valid empty selection encoded as cancellation

**Evidence:** `src/battle/worker/protocol/PromptRegistry.ts:949–957` accepts zero selections when `minimum === 0`, then unconditionally encodes empty selection as `null`. Adjacent wire-contract comment specifies `null` → cancellation sentinel `-1`.

**Repro:** `SELECT_CARD`, `min:0`, `max:1`, `can_cancel:false`; call `resolve([])`.

Observed:
```text
EMPTY: { type: 5, indicies: null }
```

Legal “select nothing” becomes forbidden cancellation. Core retry becomes terminal failure through projector's `RETRY` branch.

**Minimal fix:** Preserve `[]` for noncancelable zero-minimum selection. Keep explicit cancellation semantics distinct when both actions exist.

**Regression cmd:**
```sh
npx vitest run tests/unit/prompt-registry.test.ts tests/unit/prompt-selection.test.ts tests/unit/opponent-policy.test.ts
```

## Validation

- V1. Inventory: `git ls-files src/battle` → **166 tracked files, 31,607 lines**. No battle-src dirty entries in initial status.
- V2. Broad direct-import unit/component selection → **timeout after 120s**, no completion result. Do not count as passed.
- V3. Focused cmd below → **14 files passed; 356 tests passed; 21.26s**. `board-view-model.test.ts` selector matched no file.
- V4. Read-only `node --input-type=module` probes reproduced F1–F4. No fixture files written.
- V5. `git diff --cached --name-only` → empty.
- V6. Regression cmds above require added assertions; current passing suites do **not** prove fixes.

```sh
npx vitest run tests/unit/{prompt-registry,prompt-selection,contracts,duel-state-projector,duel-worker-client,duel-worker-runtime,duel-store,opponent-policy,headless-reconciliation,headless-lifecycle,card-visibility,card-preview,board-view-model,card-image-cache,snapshot-store}.test.ts --maxWorkers=2
```

## Coverage ledger

### Fully read

Paths relative to repo; brace groups enumerate individually inspected files.

```text
AGENTS.md
package.json
vitest.config.ts

src/battle/BattleFacade.svelte
src/battle/battle-contracts.ts
src/battle/app/App.svelte
src/battle/app/DuelWorkerClient.ts
src/battle/app/stores/duel-store.ts
src/battle/app/prompts/prompt-selection.ts
src/battle/app/presentation/card-preview.ts

src/battle/duel/card-visibility.ts
src/battle/duel/contracts/{duel-command,duel-command-parsing,duel-deck-selection,duel-result,duel-worker-event,player-prompt,public-duel-state}.ts

src/battle/field/{card-mapping,zone-list,material-list,off-field-target-list}.ts
src/battle/ports/{battle-presentation-input,battle-runtime-source,frozen-battle-executable,index}.ts

src/battle/worker/{DuelWorkerRuntime,HeadlessDuelController,duel.worker,duel.worker-browser,worker-thread-bridge-node,runtime-initialization,create-browser-runtime,create-node-runtime}.ts
src/battle/worker/assets/active-duel-dependencies.ts
src/battle/worker/decks/resolve-duel-decks.ts
src/battle/worker/diagnostics/duel-trace.ts
src/battle/worker/engine/{DuelSession,OcgCoreAdapter,engine-constants}.ts
src/battle/worker/opponent/{OpponentPolicy,ReplayOpponentPolicy}.ts
src/battle/worker/projection/DuelStateProjector.ts
src/battle/worker/protocol/{PromptRegistry,message-classification}.ts
```

### Partial reads

- C1. `tests/unit/prompt-registry.test.ts:1–150`.
- C2. `tests/unit/duel-state-projector.test.ts:1–260`.
- C3. `tests/integration/xyz-detach-overlay-address.test.ts:1–160`.
- C4. `vendor/ocgcore-wasm/0.1.2/dist/index.d.ts`: selected msg-contract ranges, approximately 1035–1210, 1360–1400, 1520–1540.

### Search-only / inventory-only

- S1. Tracked battle src: complete path/line-count inventory; unread files receive **no correctness attestation**.
- S2. Tracked tests/E2E: direct battle-import search. `tests/unit`, `tests/component`, `tests/integration` → 153 matching files, including fixtures. Import search misses indirect consumers.
- S3. Tribute/selection test-name searches in `tests/unit/{prompt-registry,prompt-selection}.test.ts`; no full-file test review.
- S4. Executed tests beyond partial-read list were **run, not source-reviewed**.

### Not fully inspected

- G1. `src/battle/app/components/`, `app/images/`, `app/acceptance/`, remaining `app/prompts/`, `app/presentation/`, `app/stores/`.
- G2. `src/battle/components/`, `decks/`, `storage/`, `duel/presets/`, remaining `duel/contracts/`, `duel/prompt-sum.ts`.
- G3. Remaining `src/battle/field/`, Worker asset loaders/manifests, diagnostics/error helpers, seed/loading helpers, protocol text/sum helpers, entry exports.
- G4. Almost all test source; browser/E2E execution; production asset-backed integration scenarios.
- G5. Hot-loop review incomplete. No measured optimization finding.

## Assumptions / residual risks

- A1. Graph fallback authorized by parent: `graphify` unavailable, graph output absent. Not reattempted.
- A2. Audit targets current working tree, including user-owned dirty tests/config. No edits.
- A3. F1–F4 reproduced at protocol/projector boundary; no fresh real-WASM/browser reproductions.
- A4. Double-tribute probe also rejected one `release_param:2` card for `min:2`; core semantic verification unfinished → not promoted to finding.
- A5. Parent checkpoint request superseded full-scope completion. Remaining dirs need separate review.

**Next action:** Parent assign F1–F4 corrective tests/impl. Preserve scoped findings; retain coverage gaps.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Four actionable findings with severity, exact source locations, reproduction scenarios, observed probe output, minimal fixes, regression commands."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git status --short; git ls-files src/battle",
      "result": "passed",
      "summary": "Inventoried tracked scope; observed existing user dirty paths."
    },
    {
      "command": "git ls-files src/battle | xargs wc -l",
      "result": "passed",
      "summary": "166 tracked files; 31,607 lines."
    },
    {
      "command": "npx vitest run $(git ls-files tests/unit tests/component | xargs grep -l 'src/battle' | grep '\\.test\\.ts$') --maxWorkers=4",
      "result": "failed",
      "summary": "Timed out after 120 seconds; no completed suite result."
    },
    {
      "command": "npx vitest run tests/unit/{prompt-registry,prompt-selection,contracts,duel-state-projector,duel-worker-client,duel-worker-runtime,duel-store,opponent-policy,headless-reconciliation,headless-lifecycle,card-visibility,card-preview,board-view-model,card-image-cache,snapshot-store}.test.ts --maxWorkers=2",
      "result": "passed",
      "summary": "14 files, 356 tests passed; 21.26 seconds. board-view-model selector matched no file."
    },
    {
      "command": "node --input-type=module",
      "result": "passed",
      "summary": "Read-only inline probes reproduced overlay rejection, ignored LP payment, oversized announcement rejection, empty-selection cancellation encoding."
    },
    {
      "command": "git diff --cached --name-only",
      "result": "passed",
      "summary": "Empty output."
    }
  ],
  "validationOutput": [
    "Worker event contains an invalid prompt.choices[0].card.overlay",
    "LP COST: actual 8000 expected 7000",
    "choices 257",
    "Worker event contains an invalid prompt.choices length",
    "EMPTY: { type: 5, indicies: null }",
    "Test Files 14 passed (14); Tests 356 passed (356)"
  ],
  "residualRisks": [
    "Checkpoint audit, not full-scope completion; explicit unread directories recorded.",
    "Almost all test source remains unreviewed.",
    "No fresh browser or real-WASM reproductions for reported defects.",
    "Hot-loop audit incomplete; no measured optimization claims.",
    "Broad test attempt timed out; focused suites passed.",
    "Existing user dirty paths preserved."
  ],
  "noStagedFiles": true,
  "diffSummary": "No source, test, config, or documentation edits. Runtime persists final report.",
  "reviewFindings": [
    "P1: src/battle/duel/contracts/duel-worker-event.ts:400-420 rejects overlay marker emitted by PromptRegistry.ts:1162-1164.",
    "P1: src/battle/worker/projection/DuelStateProjector.ts:443-471 omits LP-payment projection.",
    "P1: src/battle/worker/protocol/PromptRegistry.ts:757-789 can emit announcement choices exceeding duel-worker-event.ts:68 limit.",
    "P2: src/battle/worker/protocol/PromptRegistry.ts:949-957 encodes legal empty selection as cancellation."
  ],
  "manualNotes": "Read-only instruction honored. Return artifact for runtime persistence at configured battle-audit.md path. Parent steering requested checkpoint completion before remaining coverage."
}
```
