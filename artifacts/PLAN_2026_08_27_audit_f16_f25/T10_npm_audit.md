# T10 — Clear the four dev-only npm advisories (audit F24, issue #24)

## Context

`npm audit --package-lock-only` at HEAD reports 4 vulnerabilities (1 moderate, 3 high):

- `brace-expansion` (high ×2)
- `nanoid` 3.3.16 (high)
- `postcss` ≤ 8.5.22 (moderate, GHSA-fxqj-rqcc-2cmp)
- `undici` 7.0.0–7.28.0 (high, 5 advisories)

All are `dev: true`; `npm audit --omit=dev` reports 0, so production dependencies (`idb`, `svelte`) are clean.
`npm audit fix` reports a fix is available for all four.

## Requirements

- R1. `npm audit --package-lock-only` reports 0 vulnerabilities afterwards.
- R2. Lockfile-only change where possible. If a fix requires a `package.json` range bump, take it only for a
  dev dependency and only within a semver-compatible bump; a breaking major is out of scope — report it as a
  residual instead.
- R3. Never `npm audit fix --force`.
- R4. Install and the full headless suite still pass afterwards. A green audit with a broken install is a
  failed ticket.

## Inputs

- `package.json`, `package-lock.json`
- `npm audit --package-lock-only` output at HEAD (above)

## TDD

Dependency maintenance; evidence is command output.

## Test plan

- `npm audit --package-lock-only` → 0 vulnerabilities.
- `npm ci` succeeds.
- `npm run test:unit` and `npm run check:headless` green.

## Impl steps

- [x] Capture the before state. verify: `npm audit --package-lock-only` tail quoted — `4 vulnerabilities (1 moderate, 3 high)`; brace-expansion 5.0.7, nanoid 3.3.16, postcss 8.5.18, undici 7.28.0, all `dev: true`; `--omit=dev` → `found 0 vulnerabilities`
- [x] `npm audit fix` (no `--force`). verify: exit status + summary quoted — `EXIT=0`, `changed 4 packages, and audited 248 packages`, `found 0 vulnerabilities`
- [x] Inspect the diff: which packages moved, whether `package.json` changed. verify: `git diff --stat` + version deltas in report — `package-lock.json | 28 ++++++-------` (1 file changed, 14 insertions, 14 deletions); `package.json` untouched, so R2's dev-range case did not apply. brace-expansion 5.0.7→5.0.9, nanoid 3.3.16→3.3.18, postcss 8.5.18→8.5.26, undici 7.28.0→7.29.0 — all still `dev: true`
- [x] `npm ci`. verify: exit 0 — `added 247 packages, and audited 248 packages in 4s`, `found 0 vulnerabilities`, `EXIT=0`; lockfile unchanged by the reinstall
- [x] Full headless run. verify: exit 0 — `npm run check:headless` `EXIT=0` (vendor:verify, assets:verify, snapshot:verify all `"status": "ok"`). Also `npm run test:component` `EXIT=0` — `Test Files 102 passed (102)`, `Tests 921 passed (921)`

## Outputs

- Clean audit; report quotes before/after audit summaries and the package version deltas.

## Validation

- [x] `npm audit --package-lock-only` reports 0 vulnerabilities — `found 0 vulnerabilities`, `AUDIT_EXIT=0`
- [x] `npm ci` exit 0
- [x] `npm run check:headless` exit 0 — plus `npm run test:component` exit 0 (not covered by `check:headless`)
- [x] `git diff --stat` limited to `package-lock.json` (+ `package.json` only if R2's dev-range case applied) — `1 file changed, 14 insertions(+), 14 deletions(-)`, `package-lock.json` only; `package.json` unchanged
