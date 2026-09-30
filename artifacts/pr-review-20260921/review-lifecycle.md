# Lifecycle / race-condition PR review

## Review

- R1. Status: **done**. Source review only; no source edits, staging, remote mutation, subagents, test execution.
- R2. Scope: PRs #31, #40, #46, #48, #49, #61, #63. Exact heads verified as Git commits with `git cat-file -t`.
- R3. Base comparison: every PR branches from `456551dc1cf8fc4e9fdb754095f3a8279f5b2c37`. `origin/main` currently `2d721a5`; intervening main changes touch Deck Editor / install-screen UI only. `git merge-tree` found no overlap conflict for reviewed production or test files.
- R4. Correct: all seven patches address stated lifecycle bug without found correctness blocker. Verdict: **Approve** each.
- R5. Blocker: none.
- R6. Note: full-gate CI red treated as external unresolved signal per task. Parent owns test / CI diagnosis; approvals below remain code verdicts, not full-CI attestation.

## Assumptions

- A1. `artifacts/pr-review-20260921/pr-N.diff` defines PR patch. Exact production / caller state read with `git show <headRefOid>:<path>`.
- A2. Missing `/home/aron/Projects/ascencio/plan.md` plus `/home/aron/Projects/ascencio/progress.md` accepted as absent inputs: both reads returned `ENOENT: no such file or directory`.
- A3. Graphify skipped because task states prior query proved unavailable.
- A4. Dirty local work ignored. All code evidence came from Git objects, PR artifacts, `origin/main`; no workspace source content used for verdicts.

## PR #31 — fix(delivery): restore missing objects on idempotent publish

- P31-1. Verdict: **Approve**.
- P31-2. SHA: `e0cbc6a813047f0496621545e15add7d7b296151`.
- P31-3. Correct: idempotent branch now validates every local file against manifest, verifies remote immutable bytes, conditionally recreates missing object, then verifies manifest before returning. `scripts/lib/asset-delivery/progressive-publisher.ts:229-267,269-283,312-332`.
- P31-4. Correct: divergent existing bytes never overwritten. `putIfAbsent` remains conditional; `verifyImmutable` maps size / missing GET / hash / byte mismatch to `PUBLISH_IMMUTABLE_CONFLICT`. `scripts/lib/asset-delivery/progressive-publisher.ts:229-258`. Matches ADR-092 D3 at `docs/ADR/092_ADR_immutable_per_file_content_delivery.md:20`.
- P31-5. Correct: regression deletes published file, retries identical candidate, asserts status `idempotent` plus restored key. `tests/progressive-publisher.test.ts:301-314`.
- P31-6. Actual diff snippet:

```ts
for (const file of candidate.manifest.files) {
  const key = `content/files/${file.version}/${file.path}`;
  await ensureImmutable(
    transport,
    key,
    await candidateFileBytes(root, run, file),
  );
}
```

- P31-7. Test cmd for parent: `node --test tests/progressive-publisher.test.ts`.
- P31-8. Residual risk, low: fake S3 test covers missing file, not missing manifest. Same `ensureImmutable` helper handles both at `progressive-publisher.ts:326-330`, reducing gap.
- P31-9. Residual risk, low: concurrent delete between successful `head` plus `get` can produce `PUBLISH_IMMUTABLE_CONFLICT` instead of restoration. Safe failure; no divergent overwrite. Live R2 behavior remains unproven, consistent with ADR-092 C2.

## PR #40 — fix(content): cancel rejected install responses

- P40-1. Verdict: **Approve**.
- P40-2. SHA: `c67e02f702c5d491363716f3d5704daa1a73695b`.
- P40-3. Correct: non-OK / redirected response with body now awaits body cancellation before fixed sanitized `CONTENT_NETWORK_FAILED`. Cancellation failure logs fixed string, never remote data. `src/content/install/verified-fetch.ts:29-37`.
- P40-4. Correct: success-stream read failure retains existing reader cancellation / lock release at `src/content/install/verified-fetch.ts:38-62`; patch aligns rejection path with existing cleanup semantics.
- P40-5. Correct: test uses open `ReadableStream`, HTTP 503, asserts exact failure code plus one cancellation. `tests/unit/verified-fetch-cancellation.test.ts:6-33`.
- P40-6. Actual diff snippet:

```ts
if (!response.ok || response.redirected || !response.body) {
  if (response.body)
    try {
      await response.body.cancel();
    } catch {
      console.warn("CONTENT_RESPONSE_CANCEL_FAILED");
    }
  throw failure("CONTENT_NETWORK_FAILED");
}
```

- P40-7. Test cmd for parent: `npx vitest run tests/unit/verified-fetch-cancellation.test.ts tests/unit/content-installer.test.ts`.
- P40-8. Residual risk, low: fixture is WHATWG stream, not Chromium HTTP transport. A transport whose cancellation promise never settles can delay failure; same awaited-cancel pattern already exists for body-read failures at `verified-fetch.ts:51-56`.

## PR #46 — fix(battle): isolate concurrent Worker watchdogs

- P46-1. Verdict: **Approve**.
- P46-2. SHA: `28120fee56620faf76c3b85178122b0f8a655a46`.
- P46-3. Correct: diagnostics now owns `#diagnosticsWatchdog`; prompt response / initialization / restore / surrender continue using `#watchdog`. Diagnostic completion clears only diagnostics timer. `src/battle/app/DuelWorkerClient.ts:117-118,480-483,526-537,699-727`.
- P46-4. Correct: all worker-failure / replacement / shutdown / termination paths clear both timers. `DuelWorkerClient.ts:504-508,558-562,571-585,603-613,681-684`.
- P46-5. Correct: Worker can process diagnostics concurrently in command queue and returns typed `diagnostics` event. Caller evidence: `src/battle/worker/DuelWorkerRuntime.ts:285-301`; worker dispatch chain `src/battle/worker/duel.worker.ts:90-108`.
- P46-6. Correct: regression orders diagnostics request → response command → diagnostics reply → timeout; asserts original Worker termination, replacement, `process_timeout`. `tests/unit/duel-worker-client.test.ts:422-462`.
- P46-7. Actual diff snippet:

```ts
if (event.type === "diagnostics") {
  this.#diagnosticsPending = false;
  this.#clearDiagnosticsWatchdog();
}
```

- P46-8. Test cmd for parent: `npx vitest run tests/unit/duel-worker-client.test.ts`.
- P46-9. Residual risk, low: new regression covers diagnostics-first ordering only. Inverse ordering follows separate clear paths but lacks direct concurrent test.
- P46-10. Residual risk, accepted: any generic Worker `error` clears both timers at `DuelWorkerClient.ts:504-508`; PR description explicitly retains this behavior.

## PR #48 — fix(content): release session lease when reader closes

- P48-1. Verdict: **Approve**.
- P48-2. SHA: `58a308885621d2b52c6c0fd03871ca51f49666cd`.
- P48-3. Correct: pre-acquisition closed check rejects new work; post-acquisition check releases newly won locks if close raced verification. No `await` exists between post-check plus insertion into tracked lease set, so close cannot interleave there. `src/content/storage/content-reader.ts:243-260`.
- P48-4. Correct: `close()` marks closed before releasing tracked leases / closing channel / DB; duplicate close is idempotent. `content-reader.ts:263-270`.
- P48-5. Correct: underlying acquisition releases all partial locks on verification failure. `src/content/storage/content-session-lease.ts:12-15,47-55`.
- P48-6. Correct: regression pauses final verification with real `acquireContentLease` plus lock fixture, closes reader, resolves verification, asserts failed acquisition plus zero held locks. `tests/unit/content-reader-close.test.ts:21-59`.
- P48-7. Actual diff snippet:

```ts
if (this.readerClosed) {
  lease.release();
  throw failure("CONTENT_STORAGE_UNAVAILABLE");
}
```

- P48-8. Test cmd for parent: `npx vitest run tests/unit/content-reader-close.test.ts tests/unit/content-installer.test.ts`.
- P48-9. Residual risk, low: no native Web Locks scheduler evidence. Fixture verifies lease coordination logic, not browser lock timing.
- P48-10. Residual risk, low: direct “call `acquireSession` after completed close” test absent; guard is immediate at `content-reader.ts:245`.

## PR #49 — fix(content): signal cancellation when release is disposed

- P49-1. Verdict: **Approve**.
- P49-2. SHA: `f3cbb4e76bf9a294ad85c695990abdb086367536`.
- P49-3. Correct: media lifetime gets own controller; each actual cache read receives union of caller signal plus lifetime signal. Disposal sets `disposed` before aborting, then revokes active URLs. `src/shell/adapters/progressive-release-media.ts:28-30,58-85,132-138`.
- P49-4. Correct: caller abort contract preserved. Catch rethrows caller abort through `checkAbort(signal)`; release-lifetime cancellation becomes existing `null` result. `progressive-release-media.ts:99-105,142-145`.
- P49-5. Correct: production reader checks provided signal before cache DB read plus each stream-read iteration. `src/content/storage/progressive-content-store.ts:204-217,220-237`; `src/content/storage/progressive-storage-validation.ts:95-140`.
- P49-6. Correct: regression captures adapter-provided signal, disposes release, asserts aborted signal plus null acquisition. `tests/unit/progressive-release-media.test.ts:50-87`.
- P49-7. Actual diff snippet:

```ts
const bytes = await reader.readFile(
  manifestVersion,
  file.path,
  AbortSignal.any([signal, lifetime.signal]),
);
```

- P49-8. Test cmd for parent: `npx vitest run tests/unit/progressive-release-media.test.ts tests/unit/progressive-storage.test.ts`.
- P49-9. Residual risk, accepted: production `reader.read()` is not synchronously interrupted by signal. Abort is observed at next loop checkpoint; stalled Cache stream can remain pending. PR description disclaims synchronous interruption.
- P49-10. Residual risk, low: queued acquisitions wait on caller signal, not lifetime signal. Disposal still makes each resumed acquisition return null before starting read (`progressive-release-media.ts:74-79`), but queued promises drain only as four active slots leave.

## PR #61 — fix(content): honor cancellation before activation commit

- P61-1. Verdict: **Approve**.
- P61-2. SHA: `cb4e8e786f2d962b4ce7abb5cba710058c639273`.
- P61-3. Correct: progress callback runs synchronously inside `emit`; second `signal.throwIfAborted()` sits immediately after `activating` notification, before `commitInstall`. `src/content/create-content-installer.ts:154-161,365-370`.
- P61-4. Correct: abort catch persists job as `paused`, returns paused result; activation generation remains unchanged. `create-content-installer.ts:382-400`.
- P61-5. Correct: regression aborts from real activating callback, asserts paused result, no complete phase, generation 0 / current null. `tests/unit/content-installer.test.ts:339-357`.
- P61-6. Actual diff snippet:

```ts
signal.throwIfAborted();
emit({ phase: "activating" });
signal.throwIfAborted();
await commitInstall(
```

- P61-7. Test cmd for parent: `npx vitest run tests/unit/content-installer.test.ts`.
- P61-8. Residual risk, accepted: commit is atomic non-cancellable boundary once `commitInstall` starts. Abort arriving during IndexedDB transaction does not stop commit; ADR-085 D3 requires one generation-CAS activation rather than partial cancellation.
- P61-9. Residual risk, low: fixture uses local fake IndexedDB / storage. Native browser timing around activation transaction remains unproven.

## PR #63 — fix(shell): settle all started story clears before reset returns

- P63-1. Verdict: **Approve**.
- P63-2. SHA: `fbd4d6a0819c8c560d84321e85c98907919cdc82`.
- P63-3. Correct: all five clear promises start through map; `Promise.allSettled` prevents early reset rejection while another destructive clear still runs. First rejection in stable slot order is rethrown after settlement. `src/shell/admin/admin-actions.ts:90-99`.
- P63-4. Correct: production `GenerationSaveRepository.clear` is async and each call owns transaction settlement / abort before resolving or rejecting. `src/story/saves/generation-repository.ts:194-215`.
- P63-5. Correct: regression injects immediate rejected clear plus delayed clear, confirms reset remains unsettled until delayed clear resolves, confirms original error identity. `tests/unit/admin-actions.test.ts:185-221`.
- P63-6. Actual diff snippet:

```ts
const results = await Promise.allSettled(
  STORY_SLOT_KEYS.map((slot) => saves.clear(slot)),
);
const failure = results.find(
  (result): result is PromiseRejectedResult => result.status === "rejected",
);
```

- P63-7. Test cmd for parent: `npx vitest run tests/unit/admin-actions.test.ts`.
- P63-8. Residual risk, accepted: reset remains non-atomic; one failed slot can coexist with cleared slots. Patch fixes promise lifecycle only.
- P63-9. Residual risk, low: test uses synthetic repo rather than native concurrent IndexedDB transactions.

## Validation evidence

- V1. `git diff --check origin/main...<SHA>`: passed for all seven heads; no whitespace errors.
- V2. `git merge-tree $(git merge-base origin/main <SHA>) origin/main <SHA>`: no conflict markers / both-changed sections for all seven heads.
- V3. `git diff --name-only origin/main...<SHA>`: each PR contains only stated production file plus regression test. No unrelated main/UI files belong to PR patch.
- V4. Test execution: not run per task routing; parent runs tests. Commands listed per PR.
- V5. Workspace: pre-existing dirty / untracked files preserved. No source file staged or modified by reviewer.

## Residual risks

- Q1. Full-gate CI remains red; approval assumes parent confirms failures unrelated or resolves them before merge.
- Q2. Browser-native timing remains unproven for WHATWG response cancellation, Web Locks, Cache stream abort checkpoints, IndexedDB activation / concurrent Story clears.
- Q3. PR #31 live R2 semantics / cost remain unproven; idempotent retry now performs HEAD plus GET for every immutable object.
- Q4. No blocking lifecycle, race, watchdog, idempotency, or regression-test defect found in reviewed diffs.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Per-PR verdicts cite exact SHA, production/test path:line evidence, actual diff snippets, test commands, and Q1-Q4 residual risks."
    }
  ],
  "changedFiles": [
    "/home/aron/Projects/ascencio/.pi-subagents/artifacts/outputs/5c8a9cb4-7bec-4d40-b209-fcabcc55777d/artifacts/pr-review-20260921/review-lifecycle.md"
  ],
  "testsAddedOrUpdated": [
    "PR #31: tests/progressive-publisher.test.ts",
    "PR #40: tests/unit/verified-fetch-cancellation.test.ts",
    "PR #46: tests/unit/duel-worker-client.test.ts",
    "PR #48: tests/unit/content-reader-close.test.ts",
    "PR #49: tests/unit/progressive-release-media.test.ts",
    "PR #61: tests/unit/content-installer.test.ts",
    "PR #63: tests/unit/admin-actions.test.ts"
  ],
  "commandsRun": [
    {
      "command": "git cat-file -t <headRefOid>",
      "result": "passed",
      "summary": "All seven headRefOid values resolve to commit objects."
    },
    {
      "command": "git diff --check origin/main...<headRefOid>",
      "result": "passed",
      "summary": "All seven PR diffs pass whitespace validation."
    },
    {
      "command": "git merge-tree $(git merge-base origin/main <headRefOid>) origin/main <headRefOid>",
      "result": "passed",
      "summary": "No merge conflict evidence for any reviewed head."
    },
    {
      "command": "targeted test commands listed in P31-7, P40-7, P46-8, P48-8, P49-8, P61-7, P63-7",
      "result": "not-run",
      "summary": "Parent owns test execution per task."
    }
  ],
  "validationOutput": [
    "V1: diff checks passed for seven exact heads.",
    "V2: merge-tree review found no conflicts against origin/main.",
    "V3: each PR patch is scoped to one production file plus regression test.",
    "V4: exact-head production files and relevant callers inspected with git show."
  ],
  "residualRisks": [
    "Q1: Full-gate CI red; parent diagnosis pending.",
    "Q2: Browser-native cancellation/lock/cache/IndexedDB timing not directly proven.",
    "Q3: Live R2 behavior and added idempotent read cost not directly proven."
  ],
  "noStagedFiles": true,
  "diffSummary": "Reviewed seven independent lifecycle fixes: publish closure repair, rejected-response cancellation, isolated Worker watchdogs, close/acquire lease race, release-lifetime abort, pre-commit cancellation checkpoint, all-settled Story clears.",
  "reviewFindings": [
    "R4: Approve PR #31 at e0cbc6a813047f0496621545e15add7d7b296151; no blocker.",
    "R4: Approve PR #40 at c67e02f702c5d491363716f3d5704daa1a73695b; no blocker.",
    "R4: Approve PR #46 at 28120fee56620faf76c3b85178122b0f8a655a46; no blocker.",
    "R4: Approve PR #48 at 58a308885621d2b52c6c0fd03871ca51f49666cd; no blocker.",
    "R4: Approve PR #49 at f3cbb4e76bf9a294ad85c695990abdb086367536; no blocker.",
    "R4: Approve PR #61 at cb4e8e786f2d962b4ce7abb5cba710058c639273; no blocker.",
    "R4: Approve PR #63 at fbd4d6a0819c8c560d84321e85c98907919cdc82; no blocker."
  ],
  "manualNotes": "Source review read-only. plan.md and progress.md were absent. Parent should gate merge on independent CI diagnosis."
}
```
