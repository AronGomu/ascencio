# Source-cache test type correction — done

## Evidence

- E1 `npx tsc --noEmit` — exit 0; no output. Captured red: `artifacts/codebase-audit/content-integrated-typecheck.log`, seven TS errors.
- E2 `node --test tests/sources.test.ts` — exit 0; `tests 24`, `pass 24`, `fail 0`, `cancelled 0`, `skipped 0`, `todo 0`, `duration_ms 10510.491995`.
- E3 `npx prettier --check tests/sources.test.ts` — exit 0; `Checking formatting...` / `All matched files use Prettier code style!`
- E4 `npx eslint tests/sources.test.ts` — exit 0; no output.
- E5 `git diff --check` — exit 0; no output.
- E6 `git diff --numstat -- tests/sources.test.ts` — `11\t7\ttests/sources.test.ts`.
- E7 `git diff --cached --name-only` — empty; no staged files. No root repo staging/commit performed.
- E8 Node SHA-256 comparison against `artifacts/codebase-audit/baseline.json` — before/after: `{"baselineFiles":64,"mismatches":[]}`. Baseline manifest SHA-256 unchanged: `347d5cfb18a576566c841e406196e463d9aa3a1bd9edd1c6ffecd798145c5faa`.
- E9 Test teardown removed generated `.tmp/sources-test-*` fixtures; final prefix scan: `0` remaining. No standalone scratch files created.

## Changes

- C1 `tests/sources.test.ts:96`, `:214`, `:262` — omit absent `sparsePaths` via conditional spread. Present values unchanged; production API untouched.
- C2 `tests/sources.test.ts:182`, `:229` — narrow `command` before `includes`; undefined remains rejected. Assertions not weakened.
- C3 Existing tests updated only; no tests added. Only code edit: `tests/sources.test.ts`. Additional deliverable: `artifacts/codebase-audit/source-types-worker.md`.

## Assumptions

- A1 Existing captured red accepted per task; rerunning red unnecessary.
- A2 Required validation scope: TypeScript compiler, source-cache tests, scoped Prettier/ESLint, diff checks. Full `npm run typecheck` / `svelte-check` not rerun.

## Residual risks / review

- R1 Fresh independent reviewer required; pending parent review gate. No impl blockers found.
- R2 Graph query attempted first: `graphify query "tests/sources.test.ts source-cache regression tests"`; unavailable: `/bin/bash: line 1: graphify: command not found`. Direct scoped inspection used.
- R3 Existing dirty work preserved. Baseline directory entry without hash cannot prove descendant identity via manifest; no edits made there.

## Exact diff

```diff
diff --git i/tests/sources.test.ts w/tests/sources.test.ts
index 813cd52..8c701cf 100644
--- i/tests/sources.test.ts
+++ w/tests/sources.test.ts
@@ -93,7 +93,7 @@ for (const offline of [true, false]) {
         name: "source",
         repository: upstream,
         ref: "main",
-        sparsePaths,
+        ...(sparsePaths === undefined ? {} : { sparsePaths }),
       };
       const events: { operation: string; args?: string[] }[] = [];
       t.mock.method(process.stderr, "write", (chunk: string) => {
@@ -177,8 +177,10 @@ for (const offline of [true, false]) {
         /[Ss]ource cache is .*invalid/,
       );
       assert.ok(
-        commands.every(([command]) =>
-          ["rev-parse", "config", "--no-optional-locks"].includes(command),
+        commands.every(
+          ([command]) =>
+            command !== undefined &&
+            ["rev-parse", "config", "--no-optional-locks"].includes(command),
         ),
       );
       assert.deepEqual(await parentState(directory), before);
@@ -209,7 +211,7 @@ for (const sparsePaths of [undefined, ["cards"]]) {
           name: "source",
           repository: directory,
           ref: "f".repeat(40),
-          sparsePaths,
+          ...(sparsePaths === undefined ? {} : { sparsePaths }),
         },
         true,
       ),
@@ -222,8 +224,10 @@ for (const sparsePaths of [undefined, ["cards"]]) {
     );
     assert.deepEqual(await parentState(directory), before);
     assert.ok(
-      commands.every(([command]) =>
-        ["rev-parse", "config", "--no-optional-locks"].includes(command),
+      commands.every(
+        ([command]) =>
+          command !== undefined &&
+          ["rev-parse", "config", "--no-optional-locks"].includes(command),
       ),
     );
   });
@@ -255,7 +259,7 @@ for (const sparsePaths of [undefined, ["cards"]]) {
       name: "source",
       repository: upstream,
       ref: commit,
-      sparsePaths,
+      ...(sparsePaths === undefined ? {} : { sparsePaths }),
     };
     const synced = await syncRepository(root, definition, false);
     assert.equal(synced.revision.commit, commit);
```
