# T1 — Cap the response body the image downloaders buffer (audit F16a, issue #16)

## Context

`scripts/download-images.ts:231` and `scripts/download-set-images.ts:155` both do
`new Uint8Array(await response.arrayBuffer())` with no size ceiling. A hostile or broken upstream that
streams an endless `content-type: image/jpeg` body drives the acquisition process to memory exhaustion.
The audit measured this against a local endless-body server replicating the exact call site (same headers,
same `AbortSignal.timeout(15_000)`, Node v24.18.0):

```
{"outcome":"threw","name":"TimeoutError","message":"The operation was aborted due to timeout","ms":15007,"peakRssMb":15775}
```

15.7 GB RSS in one 15 s window. `ArrayBuffer` bytes are external memory, so V8's heap limit never
intervenes. CI runs `npm run assets:mvp -- --concurrency 8 --requests-per-second 8` on `ubuntu-latest`
(`.github/workflows/ci.yml:40`), where an OOM kill is realistic.

The in-repo precedent is one directory over: `scripts/sync-engine.ts:16` declares
`MAX_PACKAGE_BYTES = 20 * 1024 * 1024`, checks `content-length` before reading (`:64`) and re-checks the
buffered length after (`:155`). Card art is far smaller than an engine tarball, so this ticket picks its own
ceiling rather than reusing that constant's value.

## Requirements

- R1. Both download call sites refuse a response whose declared `content-length` exceeds a named byte cap,
  before any body is read.
- R2. Both call sites refuse a body that exceeds the cap while streaming, so a chunked response with no
  `content-length` cannot blow past it either. Buffering the whole body first and measuring afterwards does
  not satisfy this — that is the bug.
- R3. Failure is loud and specific: the record fails with an error naming the cap and the file, and joins the
  existing failure reporting of each script (which already sets a non-zero exit code).
- R4. No change to concurrency, retry, timeout, caching, manifest or acceptance behaviour.
- R5. The cap is a named module constant in each script, in the style of `MAX_PACKAGE_BYTES`, with a comment
  saying what it protects against. Pick a value that clears the largest legitimate asset by a wide margin —
  measure the largest file in `generated/card-images/archive/full` and `generated/set-images` and say what
  you measured in the comment.

## Inputs

- `scripts/download-images.ts` (call site at `:231`; failure handling around `:208`+; cached branch ~`:165`)
- `scripts/download-set-images.ts` (call site at `:155`; sequential loop at `:63`)
- `scripts/sync-engine.ts` (precedent: `:16`, `:64`, `:155`)
- `scripts/lib/images.ts` (`isJpeg`, size helpers)
- `tests/unit/` — find the existing tests for these scripts before writing new ones; put new tests where the
  sibling coverage already lives.

## TDD

Red first, in a unit test:

- `refuses a response whose content-length exceeds the cap without reading the body`
- `refuses a streamed body that exceeds the cap`
- `accepts a body at or below the cap`

Drive them against the smallest extracted seam — if the reading logic is currently inline in a loop, extract
exactly the read-with-cap step into an exported function in the same file (or `scripts/lib/`) and test that.
Do not restructure the surrounding script beyond that extraction.

## Test plan

- New unit tests above, green.
- `npm run test:unit` green.
- `npm run check:headless` green (it runs `assets:verify` against the real local archive, so a regression in
  these scripts' shared helpers shows up there).

## Impl steps

- [x] Measure the largest legitimate file in `generated/card-images/archive/full` and `generated/set-images`;
      record both numbers in the ticket report. verify: command output quoted
      - `find generated/card-images/archive/full -type f -printf '%s %p\n' | sort -rn | head -1`
        → `330480 generated/card-images/archive/full/101305088.jpg` (14,579 files)
      - `find generated/set-images -type f -printf '%s %p\n' | sort -rn | head -1`
        → `152797 generated/set-images/dark-crisis.jpg` (50 images + manifest.json)
- [x] Write the failing tests. verify: run them, they fail for the right reason
      - `tests/unit/capped-response-body.test.ts` →
        `Error: Cannot find module '../../scripts/lib/capped-response-body.ts'`
- [x] Add the cap constant + streamed read to `scripts/download-images.ts`. verify: tests go green
      - `MAX_IMAGE_BYTES = 8 * 1024 * 1024`; seam `scripts/lib/capped-response-body.ts`
      - `npx vitest run tests/unit/capped-response-body.test.ts` → `4 passed`; `npx tsc --noEmit` clean
- [x] Add the same to `scripts/download-set-images.ts`. verify: tests go green
      - `MAX_SET_IMAGE_BYTES = 8 * 1024 * 1024`; `downloadSetImage` now takes the file name
      - `npm run test:unit` → `Test Files 145 passed`, `Tests 1685 passed`
- [x] Confirm failure path reports the file and cap and keeps the existing non-zero exit. verify: test asserts it
      - file + cap: test asserts `result.error` contains `101305088.jpg` / `dark-crisis.jpg` and `8192`
      - non-zero exit: `too-large` maps to each script's pre-existing `failed` result, and the
        code that turns `failed` into `process.exitCode = 1` is unchanged in both scripts.
        Not covered by an executing test — both scripts run on import via top-level await and a
        run lock, so asserting the exit code would mean restructuring them, which the ticket forbids.

## Outputs

- Capped read in both downloaders, unit-tested.
- Report states: chosen cap value, largest measured asset, extracted seam (if any).

## Validation

- [x] `npm run test:unit` exit 0 — `Test Files 145 passed (145)`, `Tests 1685 passed (1685)`
- [x] `npm run check:headless` exit 0 — `check:headless exit=0`; `assets:verify` `"status": "ok"`
      (14,794 image records), `assets:sets:verify` `"status": "ok"` (50 sets, 0 missing),
      `snapshot:verify` `"status": "ok"`
- [x] New tests fail when the cap check is reverted (prove non-vacuous; revert locally, run, restore)
      - reverted seam body to `new Uint8Array(await response.arrayBuffer())` →
        `Tests 2 failed | 2 passed (4)`, both failing with `Error: body read past the pull budget`
      - restored → `4 passed`
- [x] `git diff --stat` touches only `scripts/` and the test file
      - `scripts/download-images.ts | 17 +`, `scripts/download-set-images.ts | 26 +`
      - untracked additions: `scripts/lib/capped-response-body.ts`, `tests/unit/capped-response-body.test.ts`
