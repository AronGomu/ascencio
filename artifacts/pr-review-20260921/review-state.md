# PR Review State

## Review

- S1 State: **done**. Read-only review of PRs #26, #27, #33, #41, #50, #51, #52 at exact head SHAs. Reviewed committed objects only; ignored dirty worktree as PR content.
- S2 Correct: all seven heads contain one commit over common base `456551dc1cf8fc4e9fdb754095f3a8279f5b2c37`. `git diff origin/main...<head>` matched supplied PR file sets. `git merge-tree --write-tree origin/main <head>` returned `0` for every head. Current `origin/main` = `2d721a50177994fb5003cf90b012e67a19842623`; intervening changes touch unrelated deck-editor/install-content files.
- S3 Correct: `git diff --check 456551dc1cf8fc4e9fdb754095f3a8279f5b2c37..<head>` passed for every PR.
- S4 Blocker: none.
- S5 Fixed: none; review-only task.
- S6 Note: CI not adjudicated here. Parent owns full-gate investigation. Verdicts below are code verdicts, independent from CI state.
- S7 Note: requested `/home/aron/Projects/ascencio/plan.md` plus `/home/aron/Projects/ascencio/progress.md` do not exist (`ENOENT`). Review proceeded from `AGENTS.md`, supplied metadata/diffs, exact Git objects, full changed prod files, relevant callers/tests.

## PR #26 — Approve

SHA: `ebc5f7fc09fe3e9ba3ef602ddef53bcc3bb5da54`

- A1 Correct: ready local row now derives key, label, displayed lists, start selection from same immutable `resolveDeck` snapshot. Prevents list/load revision race from showing rev 3 while starting rev 4. Evidence: `src/battle/decks/installed-selectable-decks.ts:43-65`; start consumers match `selection` by key in `src/battle/app/App.svelte:735-756`.
- A2 Correct: regression creates stale listed rev 3 plus loaded rev 4, then asserts key/name/list/start payload all use rev 4. Evidence: `tests/unit/installed-free-play.test.ts:105-145`.
- A3 Note [low]: invalid result still lacks loaded deck snapshot by contract (`src/decks/deck-resolver.ts:42-47`), so concurrently changed invalid rows can retain listed key/name/lists while showing latest validation error. No wrong duel can start because `selection` stays `null`; remaining UI inconsistency lacks coverage. `updatedAt` intentionally remains list-time value at `src/battle/decks/installed-selectable-decks.ts:65`.

Actual diff snippet:

```diff
+    const ready = resolved.type === "ready" ? resolved.deck : null;
@@
-        key: `local:${record.id}:${record.revision}`,
-        label: record.name,
+        key: `local:${ready?.ref.deckId ?? record.id}:${ready?.ref.revision ?? record.revision}`,
+        label: ready?.name ?? record.name,
@@
-          main: Object.freeze([...record.main]),
+          main: ready?.main ?? Object.freeze([...record.main]),
```

Target test cmd (not run; parent testing separately):

```bash
npx vitest run tests/unit/installed-free-play.test.ts tests/component/installed-free-play.test.ts tests/component/FreePlayMatchSetup.test.ts
```

## PR #27 — Approve

SHA: `7dfac2aa5b192da92c04442f75901d439a49c4a3`

- B1 Correct: save computes timestamp inside same read-write transaction from persisted `current.updatedAt`, not original creation time. Clock rollback cannot decrease stored modification order. Evidence: `src/decks/indexeddb-deck-repository.ts:214-240`; list sorts descending by `updatedAt` at `src/decks/indexeddb-deck-repository.ts:123-139`.
- B2 Correct: fake-IDB regression moves injected clock from Jan 3 to Jan 2 after creation, then verifies saved timestamp stays Jan 3. Evidence: `tests/unit/decks/indexeddb-deck-repository.test.ts:202-228`.
- B3 Note [low]: repository assumes callers preserve immutable `createdAt`; `save` does not explicitly compare it with persisted record. Existing app callers save loaded records, so reviewed path remains valid.

Actual diff snippet:

```diff
-        updatedAt: latestTimestamp(deck.createdAt, this.#now()),
+        updatedAt: latestTimestamp(current.updatedAt, this.#now()),
```

Target test cmd (not run; parent testing separately):

```bash
npx vitest run tests/unit/decks/indexeddb-deck-repository.test.ts
```

## PR #33 — Approve

SHA: `80be82218568c1c78d7d46eb695e157e5ccf0c01`

- C1 Correct: cancellation generation now advances on every deck-world transition, before non-story early return. Delayed Story resolution cannot overwrite synchronously installed Free Play context. Evidence: `src/shell/AppShell.svelte:620-645`.
- C2 Correct: component regression blocks both Story slot reads, navigates to Free Play, releases reads, then verifies no Story banner/deck replaces Free Play. Evidence: `tests/component/deck-editor/editor-context.test.ts:357-383`.
- C3 Note [low]: cancellation is generation-based, not physical abort; stale reads still finish. Guard prevents stale UI mutation. This is acceptable because save API has no abort signal.

Actual diff snippet:

```diff
-    if (world !== "story") return;
     const requested = ++storyDeckToken;
+    if (world !== "story") return;
```

Target test cmd (not run; parent testing separately):

```bash
npx vitest run tests/component/deck-editor/editor-context.test.ts
```

## PR #41 — Approve

SHA: `314f8f657690a0aa79fa15ca16e0acce1a688fb5`

- D1 Correct: write catch now preserves quota classification for native `QuotaExceededError` plus normalized sentinel, maps IDB/closed-connection DOM failures plus `STORY_STORAGE_UNAVAILABLE` to unavailable, leaves semantic `Error` failures unknown. Evidence: `src/story/saves/generation-repository.ts:137-155`; sentinel definitions at `src/story/saves/generation-database.ts:7-24,70-89`.
- D2 Correct: deterministic regression pauses descriptor digest, deletes DB so version-change closes cached connection, resumes, then expects typed unavailable result. Evidence: `tests/unit/story/save-generation-errors.test.ts:14-47`; connection close/reset path at `src/story/saves/generation-database.ts:44-56`.
- D3 Correct: downstream UI already distinguishes quota, unavailable, unknown at `src/story/StoryApp.svelte:351-360`; story deck adapter maps unavailable separately at `src/story/decks/story-deck-context.ts:110-117`.
- D4 Note [low]: added race proof uses `fake-indexeddb`, not native Chromium deletion scheduling. Prod browser timing remains residual, not code defect.

Actual diff snippet:

```diff
-              error instanceof DOMException &&
-              error.name === "QuotaExceededError"
+              (error instanceof DOMException &&
+                error.name === "QuotaExceededError") ||
+              (error instanceof Error &&
+                error.message === "STORY_STORAGE_QUOTA")
                 ? "quota"
-                : "unknown",
+                : error instanceof DOMException ||
+                    (error instanceof Error &&
+                      error.message === "STORY_STORAGE_UNAVAILABLE")
+                  ? "unavailable"
+                  : "unknown",
```

Target test cmd (not run; parent testing separately):

```bash
npx vitest run tests/unit/story/save-generation-errors.test.ts tests/unit/story/save-generations.test.ts tests/unit/story/story-deck-context.test.ts
```

## PR #50 — Approve

SHA: `0208d9ed3303e040afd792ee51627575a57968c1`

- E1 Correct: each synchronous localStorage write rereads latest persisted log, unions caller snapshot, writes monotonic set. Sequential stale sessions no longer erase each other. Evidence: `src/story/playback/story-read-log.ts:53-65`.
- E2 Correct: regression opens two empty snapshots, writes distinct beats from each, then verifies both persist. Evidence: `tests/unit/story/story-read-log-concurrency.test.ts:16-29`.
- E3 Correct: caller updates in-memory `readBeats` before write at `src/story/StoryApp.svelte:505-513`; storage failure remains best-effort, preserving live session behavior.
- E4 Note [medium residual]: localStorage read-modify-write has no cross-tab transaction. Truly overlapping tabs can still lose one write; live tab does not adopt another tab's beat set until reload. PR description states both limits; no native multi-tab regression exists.

Actual diff snippet:

```diff
-  storage: Pick<Storage, "setItem"> | null = defaultStorage(),
+  storage: Pick<Storage, "getItem" | "setItem"> | null = defaultStorage(),
@@
-    const payload: StoredReadLog = { version: 1, beats: [...beats] };
+    const merged = new Set(readStoryReadLog(storage));
+    beats.forEach((id) => merged.add(id));
+    const payload: StoredReadLog = { version: 1, beats: [...merged] };
```

Target test cmd (not run; parent testing separately):

```bash
npx vitest run tests/unit/story/story-read-log.test.ts tests/unit/story/story-read-log-concurrency.test.ts tests/component/story/StoryPlayback.test.ts
```

## PR #51 — Approve

SHA: `f4ff999c3cfdb71c2e75fe5d8054c3cc70fa7829`

- F1 Correct: store records field-level pending patch, rebases it over latest readable persisted settings per mutation, clears pending only inside successful `setItem`. Sequential stale stores preserve unrelated fields; repeated quota/read failures preserve unsaved local state. Evidence: `src/shell/settings/shell-settings-store.ts:25-59`.
- F2 Correct: focused tests cover repeated quota failure, latest dirty value, unrelated remote rebase, read/write failure recovery, null storage, two stale live stores. Evidence: `tests/unit/shell-settings-concurrency.test.ts:16-120`.
- F3 Correct: only three typed mutations exist (`src/shell/settings/shell-settings-store.ts:10-14,62-73`); callers use them in `src/shell/screens/FreePlayMatchSetup.svelte:390-398,460-470` plus `src/shell/AppShell.svelte:1155-1157`.
- F4 Note [medium residual]: no atomic cross-tab lock. Two tabs interleaving get/set can still lose updates; no `storage` event updates already-rendered UI. PR description states both limits.

Actual diff snippet:

```diff
+  let pending: Partial<ShellSettings> = {};
+
+  function persist(patch: Partial<ShellSettings>): void {
+    pending = { ...pending, ...patch };
@@
+      const value = Object.freeze({ ...current, ...pending });
@@
+              storage.setItem(key, serialized);
+              pending = {};
```

Target test cmd (not run; parent testing separately):

```bash
npx vitest run tests/unit/shell-settings.test.ts tests/unit/shell-settings-concurrency.test.ts tests/unit/persisted-ui-state.test.ts tests/unit/persisted-ui-store.test.ts
```

## PR #52 — Approve

SHA: `ef353d1c79f70f50779bbc58fc14107ef4cc582c`

- G1 Correct: optimistic revision check now executes within repository serialization task immediately before dispatch. Second save queued behind in-flight save observes committed rev 5, rejects expected rev 4, restores same pre-dispatch state. Evidence: `src/story/decks/story-deck-repository.ts:59-100,168-183`.
- G2 Correct: deterministic regression blocks first persist, queues stale second save, releases first, then verifies conflict actual revision 5 plus retained first edit. Evidence: `tests/unit/story/story-deck-repository-concurrency.test.ts:15-69`.
- G3 Correct: cross-file revision propagation remains coherent. Story context updates persisted save revision only after written result at `src/story/decks/story-deck-context.ts:99-104`; editor maps `DeckRevisionConflictError` to conflict at `src/deck-editor/deck-editor-store.ts:778-806`.
- G4 Note [medium residual]: `create` duplicate check plus `delete` revision check remain outside serialization at `src/story/decks/story-deck-repository.ts:124-140,186-203`. PR explicitly scopes only queued stale saves; save/create/delete interleavings need separate audit.

Actual diff snippet:

```diff
   function commit(
     command: StoryCommand,
     landed: (state: StoryState) => boolean,
+    beforeDispatch?: () => void,
   ): Promise<void> {
@@
+        beforeDispatch?.();
@@
+        () => {
+          const current = find(deck.id);
+          if (current === undefined || current.revision !== expectedRevision)
+            throw new DeckRevisionConflictError(current?.revision ?? null);
+        },
```

Target test cmd (not run; parent testing separately):

```bash
npx vitest run tests/unit/story/story-deck-repository.test.ts tests/unit/story/story-deck-repository-concurrency.test.ts tests/unit/story/story-deck-context.test.ts
```

## Residual risks

- R1 PR #26: invalid concurrent deck revision can still mix list-time row metadata with load-time validation error; blocked rows cannot start.
- R2 PR #27: `save` trusts caller-preserved `createdAt`; app callers preserve it.
- R3 PR #33: stale I/O completes even though token suppresses stale UI write.
- R4 PR #41: fake-IDB deletion race lacks native Chromium timing proof.
- R5 PR #50: localStorage union is non-transactional across truly overlapping tabs; live read set stays stale.
- R6 PR #51: settings read-modify-write is non-atomic across truly overlapping tabs; no storage-event sync.
- R7 PR #52: create/delete precondition timing remains outside commit queue.
- R8 All PRs: target tests listed but intentionally not run in this review; parent runs tests plus CI investigation.

## Assumptions

- H1 Supplied PR JSON/diff files are metadata aids; exact Git commit objects are authority.
- H2 Missing plan/progress files contain no hidden acceptance constraints because both paths returned `ENOENT`.
- H3 Parent instruction “runs tests separately” means this worker should inspect tests plus provide commands, not execute suites.
- H4 Dirty worktree predates review and is excluded from every PR verdict. `git diff --cached --quiet` returned `0`; no staged files.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Per-PR verdicts cite exact SHA, production/test path:line evidence, actual diff snippets, severity-tagged residual risks, and target test commands."
    }
  ],
  "changedFiles": [
    "/home/aron/Projects/ascencio/.pi-subagents/artifacts/outputs/5c8a9cb4-7bec-4d40-b209-fcabcc55777d/artifacts/pr-review-20260921/review-state.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git show <exact-head-sha>:<changed-production-file>",
      "result": "passed",
      "summary": "Read all seven changed production files from exact PR Git objects; inspected relevant callers and regression tests."
    },
    {
      "command": "git diff --stat origin/main...<exact-head-sha>",
      "result": "passed",
      "summary": "All seven comparisons matched supplied PR file sets."
    },
    {
      "command": "git merge-tree --write-tree origin/main <exact-head-sha>",
      "result": "passed",
      "summary": "Returned 0 for PRs #26, #27, #33, #41, #50, #51, #52."
    },
    {
      "command": "git diff --check 456551dc1cf8fc4e9fdb754095f3a8279f5b2c37..<exact-head-sha>",
      "result": "passed",
      "summary": "No whitespace errors for any reviewed PR."
    },
    {
      "command": "target Vitest commands listed per PR",
      "result": "not-run",
      "summary": "Parent runs tests separately per task routing."
    },
    {
      "command": "git diff --cached --quiet",
      "result": "passed",
      "summary": "Exit 0; review staged no files."
    }
  ],
  "validationOutput": [
    "Seven exact heads verified as commits with common parent 456551dc1cf8fc4e9fdb754095f3a8279f5b2c37.",
    "All seven code verdicts: Approve.",
    "No blocker or request-changes finding.",
    "CI verdict intentionally separate and not assessed by this worker."
  ],
  "residualRisks": [
    "PR #26 invalid-row metadata can remain list-time while validation error is load-time.",
    "PR #41 native Chromium database-deletion timing not exercised.",
    "PRs #50/#51 localStorage read-modify-write remains non-transactional across truly overlapping tabs.",
    "PR #52 create/delete precondition timing remains outside serialization chain.",
    "Target tests not run by this worker; parent owns test and CI evidence."
  ],
  "noStagedFiles": true,
  "diffSummary": "Read-only review artifact only; no source, test, Git index, or remote mutation.",
  "reviewFindings": [
    "PR #26 Approve: ready row and start payload share resolved revision; low residual for invalid-row metadata.",
    "PR #27 Approve: updatedAt anchored to persisted timestamp; low residual for trusted immutable createdAt.",
    "PR #33 Approve: deck-context token advances before leaving Story.",
    "PR #41 Approve: interrupted generation write maps to unavailable while quota/semantic mapping remains distinct.",
    "PR #50 Approve: sequential stale read-log writes union latest persisted beats; cross-tab overlap remains.",
    "PR #51 Approve: settings mutations rebase field patches and retain dirty values through failure; cross-tab overlap remains.",
    "PR #52 Approve: queued stale save checks revision inside serialization chain; create/delete timing remains.",
    "No blockers."
  ],
  "manualNotes": "plan.md and progress.md were absent. Dirty local files were not treated as PR content."
}
```
