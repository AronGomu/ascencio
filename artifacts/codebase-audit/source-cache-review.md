# Source-cache review — approved with changes

## Review

R1. **Correct:** canonical worktree-root check precedes mutations; ancestor-discovered repo rejected. Existing invalid cache never deleted. Evidence: `scripts/lib/sources.ts:62–76,107–146`; fixture regressions `tests/sources.test.ts:72–125` pass offline/online × sparse/full, preserving parent HEAD, branch, index, config, source bytes.

R2. **Correct:** exact expected origin required; tracked/staged/untracked/ignored changes rejected before mutations. `--no-optional-locks` avoids validation-time index refresh. Evidence: `scripts/lib/sources.ts:77–100`; `tests/sources.test.ts:128–189` covers ten rejection cases, state preservation, read-only command sequence.

R3. **Fixed — medium:** mismatched offline pin previously rejected only after `sparse-checkout`, violating invalid-cache preservation. Disposable-fixture repro: `node --test --test-name-pattern='mismatched pin' tests/sources.test.ts` → 0/2 pass; both cases changed `.git/config`, adding `[extensions]` / `worktreeConfig = true`. Exact failure: `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`. Fix: validate offline HEAD against requested pin inside pre-mutation validation (`scripts/lib/sources.ts:101–106`). Regression asserts pin-specific rejection cause, unchanged state, read-only commands (`tests/sources.test.ts:191–229`). Final suite: 24/24 pass.

R4. **Correct — ignored-file compatibility:** tracked files matching `.gitignore` remain valid. Strengthened full/sparse clone-reuse fixtures include tracked `cards/catalog.cdb` matching `*.cdb`, plus genuinely excluded `other/source.txt`; online/offline reuse succeeds, expected bytes/layout verified (`tests/sources.test.ts:231–286`). Untracked ignored DB remains rejected (`tests/sources.test.ts:128–189`). Broad ignored-file rejection intentionally also rejects harmless local artifacts; no allowlist introduced.

R5. **Correct — minimality:** reviewer production delta = six-line offline preflight check. Reviewer test delta = two pin-preservation cases, meaningful sparse/ignored-pattern fixture coverage. Existing online update behavior retained; early pin check applies offline only. No config/vendor/dependency/other dirty-file edits; no staging/commit/push/subagents.

R6. **Blocker:** none remaining within reviewed scope. Verdict: **approved with changes**. Next human action: none required for review completion; commit decision remains parent-owned.

## Validation

V1. `graphify query "scripts/lib/sources.ts source cache cleanliness ignored files"` → exit 127, `/bin/bash: line 1: graphify: command not found`. Scoped source/test inspection used instead.

V2. Initial `node --test tests/sources.test.ts` → 22 tests, 22 pass, 0 fail. Worker self-attestation not used as acceptance evidence.

V3. Red `node --test --test-name-pattern='mismatched pin' tests/sources.test.ts` → 2 tests, 0 pass, 2 fail; concrete config mutation documented in R3.

V4. Final exact command: `set -o pipefail; node --test tests/sources.test.ts 2>&1 | sed '/^{"timestamp":/d'` → exit 0; 24 tests, 24 pass, 0 fail, 0 skipped. Filter suppresses structured Git telemetry only; `pipefail` preserves test exit status.

V5. `node_modules/.bin/prettier --check scripts/lib/sources.ts tests/sources.test.ts` → exit 0; `All matched files use Prettier code style!`

V6. `node_modules/.bin/eslint scripts/lib/sources.ts tests/sources.test.ts` → exit 0; no diagnostics.

V7. `git diff --check` → exit 0; no diagnostics. `git diff --cached --name-only` → empty.

V8. Read-only Node assertions independently compared baseline HEAD, all baseline status entries, every non-null baseline SHA256, staging, fixture residue. Actual output: `PASS: 65 baseline statuses; 64 baseline file hashes; HEAD unchanged; staged files 0; fixture residues 0.` Baseline directory entry has null SHA256; its contents lack independent baseline hash proof.

V9. Tests mutate only generated `.tmp/sources-test-*` fixture repos. Fixtures use local upstreams, disposable parent repos, canonical-path-checked cleanup (`tests/sources.test.ts:25–70`). No production asset sync/network run. Own fixture dirs removed by test hooks; no scratch logs created.

## Files touched

F1. `scripts/lib/sources.ts` — early offline pin validation.

F2. `tests/sources.test.ts` — two regression cases; full/sparse compatibility fixture strengthening.

F3. `artifacts/codebase-audit/source-cache-review.md` — requested review deliverable. Ticket, worker report, baseline, unrelated user work untouched.

## Assumptions

A1. Scope = two-file source-cache diff plus authorized report; supporting ticket/caller reads establish requirements, ignored-byte relevance. No broader asset pipeline redesign.

A2. Expected origin means exact configured URL; URL aliases intentionally fail closed (`scripts/lib/sources.ts:77–84`).

A3. Ordinary trusted Git environment/config/index assumed. Requirement concerns accidental invalid/dirty caches, not adversarial Git metadata or concurrent filesystem replacement.

## Residual risks

S1. Git-status cleanliness is not independent raw-byte attestation. `assume-unchanged`, custom filters, hostile config/environment remain outside scope; `runGit` inherits process environment (`scripts/lib/sources.ts:18–25`), cleanliness relies on status (`scripts/lib/sources.ts:86–95`). No claim of hostile-cache protection.

S2. Canonical path comparison accepts aliases resolving to actual worktree root; no separate symlink policy or concurrent path-replacement protection (`scripts/lib/sources.ts:62–76`). Linked worktrees remain supported (`tests/sources.test.ts:306–331`).

S3. All ignored/untracked artifacts reject cache reuse, even irrelevant files. Safe preservation tradeoff, not selective input validation. Tracked ignore-pattern matches verified compatible in R4; production upstream caches not exercised.

S4. Full-repo build/typecheck/browser suite not run; requested targeted checks passed. Repo remains dirty by design. Null-hash baseline directory content preservation not independently provable from supplied baseline.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "R1–R6 cite source/test locations; R3 identifies, reproduces, fixes medium-severity offline pin preservation defect. Final verdict approved with changes; residual risks S1–S4 explicit."
    }
  ],
  "changedFiles": [
    "scripts/lib/sources.ts",
    "tests/sources.test.ts",
    "artifacts/codebase-audit/source-cache-review.md"
  ],
  "testsAddedOrUpdated": [
    "tests/sources.test.ts:191–229 — offline mismatched-pin preservation, full/sparse",
    "tests/sources.test.ts:231–286 — real sparse exclusion, tracked ignored-pattern DB compatibility"
  ],
  "commandsRun": [
    {
      "command": "graphify query \"scripts/lib/sources.ts source cache cleanliness ignored files\"",
      "result": "failed",
      "summary": "Exit 127: graphify unavailable; scoped direct inspection used."
    },
    {
      "command": "node --test tests/sources.test.ts",
      "result": "passed",
      "summary": "Initial independent validation: 22/22 pass."
    },
    {
      "command": "node --test --test-name-pattern='mismatched pin' tests/sources.test.ts",
      "result": "failed",
      "summary": "Expected red: 0/2 pass; wrong offline pin mutated fixture config before rejection."
    },
    {
      "command": "set -o pipefail; node --test tests/sources.test.ts 2>&1 | sed '/^{\"timestamp\":/d'",
      "result": "passed",
      "summary": "Final: 24/24 pass; zero failures/skips."
    },
    {
      "command": "node_modules/.bin/prettier --check scripts/lib/sources.ts tests/sources.test.ts",
      "result": "passed",
      "summary": "All matched files use Prettier code style!"
    },
    {
      "command": "node_modules/.bin/eslint scripts/lib/sources.ts tests/sources.test.ts",
      "result": "passed",
      "summary": "Exit 0; no diagnostics."
    },
    {
      "command": "git diff --check",
      "result": "passed",
      "summary": "Exit 0; no diagnostics."
    },
    {
      "command": "git diff --cached --name-only",
      "result": "passed",
      "summary": "Empty."
    }
  ],
  "validationOutput": [
    "Final tests: 24 total, 24 pass, 0 fail, 0 skipped.",
    "PASS: 65 baseline statuses; 64 baseline file hashes; HEAD unchanged; staged files 0; fixture residues 0."
  ],
  "residualRisks": [
    "Trusted Git config/environment/index assumed; Git status is not independent raw-byte attestation.",
    "Symlink aliases and concurrent filesystem replacement not separately hardened.",
    "Ignored local artifacts intentionally reject reuse; production upstream caches not exercised.",
    "Full-repo checks skipped; null-hash baseline directory lacks independent content-preservation proof."
  ],
  "noStagedFiles": true,
  "diffSummary": "Approved with changes: six-line early offline pin check; two red/green preservation regressions; stronger sparse/ignored-pattern compatibility coverage.",
  "reviewFindings": [
    "Fixed medium: scripts/lib/sources.ts:101–106 — wrong offline pin previously rejected after sparse-checkout config mutation; preflight now rejects before mutations.",
    "Correct: scripts/lib/sources.ts:62–100 — canonical ownership, expected origin, clean tracked/untracked/ignored status enforced.",
    "No remaining in-scope blockers."
  ],
  "manualNotes": "Sole writer; only authorized source/test paths plus requested report changed. No staging, commit, push, subagents, production-cache mutations, or further writes."
}
```
