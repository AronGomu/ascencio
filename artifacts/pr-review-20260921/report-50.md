# PR #50: fix(story): preserve read progress across open sessions

**Approve — no blocking code defect found.** Merge conditional on confirmation plus accepted CI disposition. No merge/close performed.

PR: https://github.com/AronGomu/ascencio/pull/50  
Head: `0208d9ed3303e040afd792ee51627575a57968c1`  
Reviewed integration base: `2d721a50177994fb5003cf90b012e67a19842623`

## Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Three-way integration | Pass | `git merge-tree --write-tree 2d721a50177994fb5003cf90b012e67a19842623 0208d9ed3303e040afd792ee51627575a57968c1` |
| PR-targeted tests | Pass | `validation-50.json` |
| Changed-file ESLint / Prettier | Pass | `validation-50.json` |
| Combined PR tests | 419 passed / 39 files | `combined-locked-tests.log` |
| Combined locked-dep typecheck | Pass, 4 warnings | `combined-locked-typecheck.log` |
| Domain / data-cy boundaries | Pass | `combined-boundaries.log` |
| Combined build | Pass | `combined-build.log` |
| Chromium PWA first-install retry | Pass | `pwa-retry-e2e.log` |
| GitHub full-gate | Failed before tests | `ci-summary-50.json`, `ci-50.log` |

CI error, exact:

```text
downloadCroppedCardImages failed with exit code 1; rerun to resume safely
```

All 42 CI jobs failed in `Regenerate and verify the pinned snapshot`. Full headless/browser gates skipped remotely. Local full repo suite not run; targeted/boundary/build/PWA evidence does not replace every skipped gate.

## Code review

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

## Validation limits

L1. Per-PR snapshots contain exact three-way tree against fetched main. Aggregate contains all 93 distinct changed paths, no textual overlaps. Source files untouched.

L2. First pass reused installed deps. Copied deps fixed Vite symlink resolution; longer timeout fixed publisher-suite interruption. Aggregate `npm ci --offline` restored lockfile-exact deps; typecheck plus all changed Vitest suites passed afterward. Initial TS2345 was local `@types/node` 26 vs locked 24 mismatch, not PR regression.

L3. No full native-engine/browser matrix run. Remaining scenario gaps listed above are residual coverage risks, not observed failures. Remote HEAD/main must be rechecked before any action.
