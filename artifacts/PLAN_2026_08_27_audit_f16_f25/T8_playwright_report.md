# T8 — Untrack `playwright-report/index.html` (audit F21, issue #21)

## Context

`.gitignore:6` ignores `playwright-report/`, yet `git ls-files playwright-report` still lists
`playwright-report/index.html` — a 520 KB file committed in `9bee31e`, tracked in spite of the ignore rule
(ignore rules do not apply to already-tracked paths).

`.github/workflows/ci.yml:75`–`:87` uploads `playwright-report/` on failure. No HTML reporter is configured,
so a CI run writes no report there and the uploaded artifact contains only this stale committed file —
evidence of a run from months ago, presented as evidence of the run that just failed.

## Requirements

- R1. `playwright-report/index.html` is no longer tracked.
- R2. The working-tree file is left alone (`--cached` only); no local artifact is destroyed.
- R3. `.gitignore` keeps ignoring the directory — no change needed there, confirm it.
- R4. Do not add a reporter, do not touch `ci.yml`. Configuring reporting is a separate decision.

## Inputs

- `git ls-files playwright-report`
- `.gitignore` (line 6)
- `.github/workflows/ci.yml` (`:75`–`:87`, context only)
- `playwright.config.ts` (context only: confirm no HTML reporter is configured)

## TDD

No product code changes; git state is the evidence.

## Test plan

- `git ls-files playwright-report` prints nothing after the change.
- `npm run check:headless` green (nothing should depend on the file; if something does, report it).

## Impl steps

- [x] Confirm the file is tracked and its size. verify: `git ls-files -s playwright-report` output
- [x] `git rm --cached playwright-report/index.html`. verify: file still on disk, no longer in `git ls-files`
- [x] Confirm `.gitignore` already covers it. verify: `git check-ignore -v playwright-report/index.html`

## Outputs

- One deletion-from-index commit; report quotes `git ls-files playwright-report` (empty) and the
  `check-ignore` line.

## Validation

- [x] `git ls-files playwright-report` empty
- [x] `test -f playwright-report/index.html` still true (working copy intact)
- [x] `npm run check:headless` exit 0
- [x] Commit touches exactly one path
