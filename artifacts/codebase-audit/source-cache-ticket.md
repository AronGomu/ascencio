# S1 — Source cache must own its Git worktree

## Routing

A1. Security-sensitive code / parent-repo destructive mutation risk; explicit user Astra/high → openai-codex/gpt-6-astra, thinking high.

## Evidence

E1. scripts/lib/sources.ts:63 uses `git rev-parse --git-dir` with cache directory cwd. Git searches ancestors.
E2. `git -C scripts rev-parse --git-dir --show-toplevel` resolves `/home/aron/Projects/ascencio/.git` and `/home/aron/Projects/ascencio`.
E3. Accepted directory subsequently receives `sparse-checkout`, fetch, forced checkout commands. An existing non-repository child directory can redirect commands into parent project.
E4. Baseline `node --test tests/sources.test.ts`: 3/3 pass; no regression coverage.

## Scope

S1. scripts/lib/sources.ts and focused source-sync regression tests only. No config, dependency, vendor, user dirty-file edits. No actual asset download or upstream mutation.
S2. Fail safely or recognize cache miss before mutating any Git repository whose canonical worktree root differs from expected cache directory. Preserve supported legitimate cache behavior; avoid broad source-sync redesign.
S3. No destructive repro against real checkout. Temporary test repositories only under .tmp; remove only own fixtures after inspecting paths.

## Work

- [x] W1. Add regression exposing ancestor-repository acceptance — `node --test tests/sources.test.ts`: 10 tests, 6 pass, 4 expected failures (offline missing rejection; online parent root accepted); isolated `.tmp/sources-test-*` fixtures only.
- [x] W2. Expanded parent direction: reject invalid existing cache without deleting; reject dirty/untracked cache; validate origin before mutations — expanded red: 22 tests, 10 pass, 12 fail; green: 22/22 pass. Tracked/staged/untracked/ignored bytes plus parent state preserved.
- [x] W3. Exercise offline/online, sparse/full, valid/missing caches, relative paths, linked worktrees — `node --test tests/sources.test.ts`: 22/22 pass after expanded fix, including clean online cache reuse.
- [x] W4. Check changed files only after expanded fix — `node_modules/.bin/prettier --check scripts/lib/sources.ts tests/sources.test.ts`, `node_modules/.bin/eslint scripts/lib/sources.ts tests/sources.test.ts`, `git diff --check`: exit 0.
- [x] W5. Fresh Astra/high review fixed offline pin validation ordering; independent tests 24/24 pass. Evidence: source-cache-review.md.
- [x] W6. Parent reran 24/24 tests, scoped Prettier/ESLint, diff/credential scan, baseline file hashes. Intentional source/test paths committed on main: 6704f2a. No unrelated staged work.
