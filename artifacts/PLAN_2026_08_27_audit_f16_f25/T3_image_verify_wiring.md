# T3 — Chain `assets:images:verify` into `assets:verify` (audit F22, issue #22)

## Context

`package.json:15` reads:

```
"assets:verify": "node scripts/verify-assets.ts && npm run assets:sets:verify",
```

`assets:images:verify` (`"node scripts/verify-images.ts"`, `package.json:17`) is referenced by no other
script. Card-image integrity is therefore verified only inside `assets:mvp`, which CI runs but no `check*`
target does — so `npm run check:headless` locally is weaker than CI by exactly one integrity gate. The
~4,654 shop codes covered by `verify-images.ts` go unchecked locally, and the dev server serves shop art
straight from the archive.

`assets:verify` is inside `check:headless` (`package.json:41`), so this ticket makes every local headless
check cover card art too.

## Requirements

- R1. `assets:verify` runs `assets:images:verify` in addition to what it already runs.
- R2. Ordering keeps the cheapest/most-diagnostic failure first; do not reorder the existing two steps.
- R3. `npm run check:headless` still passes on the current local archive. If it does not, that is a real
  finding — report it with the exact failure rather than weakening the chain.
- R4. package.json only. No script rewrite.

## Inputs

- `package.json` (lines 15–19, 41)
- `scripts/verify-images.ts`
- `.github/workflows/ci.yml` (what CI already runs, for the parity claim)

## TDD

No product behaviour changes; there is no unit seam worth inventing for an npm script chain. Evidence is the
command output instead. If `tests/unit/` already asserts on package.json script wiring, extend that test
instead of skipping this section — check before deciding.

## Test plan

- `npm run assets:verify` output contains the `verify-images.ts` report for shop codes.
- `npm run check:headless` green end to end.

## Impl steps

- [x] Check whether a test already asserts package.json script wiring. verify: grep `package\.json` over `tests/` → "No matches found"; nothing to extend
- [x] Chain `assets:images:verify` into `assets:verify`. verify: `npm run assets:verify` output shows the card-image report
- [x] Run the full headless check. verify: exit 0 — `check:headless exit=0`

## Outputs

- One-line package.json change; report quotes the new `assets:verify` output header proving card art is covered.

## Validation

- [x] `npm run assets:verify` exit 0 and output includes the card-image verification report — `"catalogImages": 14794, "archivedImages": 14579, "providerMissing": 215`, `"status": "ok"`
- [x] `npm run check:headless` exit 0
- [x] `git diff` touches `package.json` only (no test covered script wiring)
