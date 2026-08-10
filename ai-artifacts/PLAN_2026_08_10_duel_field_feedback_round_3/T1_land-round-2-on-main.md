# T1: Land round 2 on current round-3 plan branch

**Plan:** `./ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
**Depends:** none
**Commit outcome:** `plan/duel-field-feedback-round-3` carries the round-2 commits through `736b374`, every automated gate is green on the merge commit, and the same branch remains checked out.

## Context (self-contained)

- Goal: ship the 30 items of `feedback.md` as duel-field feedback round 3. Four archetype decks and a pre-duel deck picker land first so later UI work is validated on real decks.
- This slice: the base move. Round 2 is complete and pushed on `feat/duel-field-round-2` but was never merged. Every one of the 30 feedback items describes **that branch's** build, so round 3 must not be based on `main` as it stands.
- Out of scope here: any production-code change. This ticket preserves the already-written round-3 planning docs on a temporary plan branch, merges, verifies, branches, then cherry-picks the docs onto round 3. If a gate fails, stop; do not hide a round-2 regression inside setup.
- Assumptions in force: **A2** base is `main` after the merge. **A22** Playwright is chromium-only, foreground, with a pinned browsers path. **A23** the duel seed is random per run, so re-run a failing walker before diagnosing it.

## Requirements

- `main` contains every commit of `feat/duel-field-round-2` up to and including `736b374`.
- The merge is verified: `npm run check:headless`, `npm run test:component`, `npm run build` and the chromium e2e project all pass on the resulting `main` commit.
- A new branch `feat/duel-field-round-3` is created from that `main` commit and checked out.
- `feedback.md` stays unstaged. It was modified before this run and is the plan's input, not its output.
- Current round-3 planning artifacts are committed first on temporary branch `plan/duel-field-round-3`, excluding `feedback.md`; after the round-3 branch exists, that docs-only commit is cherry-picked and the temporary branch is deleted.
- Preflight proves round 2 does not touch the three tracked docs already amended by this plan. Any overlap stops execution instead of inviting conflict resolution.
- No source file is edited by this ticket.

## Inputs

- Branch `feat/duel-field-round-2`, head `736b374` ("docs(handoff): record round 2 outcome, review findings, and residual risks"), tracking `origin/feat/duel-field-round-2`.
- Branch `main`, head `b5702e2` ("docs: add duel field round 2 plan, ADRs 007-010, and interaction model v2"), which is also `origin/main`.
- `ai-artifacts/HANDOFF_2026_08_10_duel_field_feedback_round_2.md` — round 2's verified gate table and the environment facts repeated below.
- `ai-artifacts/manual_test_checklist.md` — 164 steps, of which 22 remain unticked. They are human-at-a-browser checks. The user has accepted them as outstanding; do not block on them and do not tick them.
- **From Depends:** none. This is the first ticket.

## TDD

Not applicable: this ticket introduces no source behaviour. Its red/green gate is branch state plus the existing suite before and after the merge; do not add a test solely for a Git operation.

## Test plan

The existing suite must run green on the merge result.

| Check | Input | Expect |
| ---- | ---- | ---- |
| Planning paths are known | `git status --short` | exactly `feedback.md`, three tracked docs amendments, and named Round-3/GRILL/ADR/HTML artifacts; nothing staged |
| Round-2 does not overlap tracked planning amendments | `git diff --name-only main..feat/duel-field-round-2 -- docs/ADR/010_ADR_in_field_phase_navigation.md docs/README.md docs/architecture/architecture.md feedback.md` | no output |
| Branch is ahead-only | after docs commit on temporary branch, switch back to `main`; run `git log --oneline main..feat/duel-field-round-2` and reverse | 17 commits listed; reverse prints nothing |
| Merge is clean | `git merge --no-ff feat/duel-field-round-2` on `main` | No conflict; if any conflict appears, stop and report rather than resolving it |
| Headless gates | `npm run check:headless` | exit 0 |
| Component tests | `npm run test:component` | 189 passing, 14 files |
| Unit tests | `npm run test:unit` | 557 passing, 53 files |
| Integration tests | `npm run test:integration` | 20 passing |
| Legacy tests | `npm run test:legacy` | 21 passing |
| Build | `npm run build` | exit 0 |
| Chromium e2e | command below | 18 passing |
| Plan survives on correct branch | `git rev-parse --abbrev-ref HEAD`; `git log --oneline -- ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md` | `feat/duel-field-round-3`; docs-only plan commit present |

## Impl steps

- [x] 1. `cd /home/aron/projects/ascencio && git status --short && git diff --cached --quiet` — output contains only unstaged `feedback.md`, tracked ADR-010/docs-index amendments, and untracked named Round-3 plan/GRILL/ADR/HTML paths; nothing staged.
- [x] 2. `git diff --name-only HEAD..feat/duel-field-round-2 -- docs/ADR/010_ADR_in_field_phase_navigation.md docs/README.md docs/architecture/architecture.md feedback.md` — prints nothing, proving round 2 does not overlap planning amendments.
- [x] 3. On `plan/duel-field-feedback-round-3`, stage only planning/docs paths listed in Outputs, explicitly excluding `feedback.md`; `git diff --cached --name-only` lists only those paths; commit `docs(plan): add duel field feedback round 3 plan`; record `git rev-parse HEAD`.
- [x] 4. `git branch --show-current` — prints `plan/duel-field-feedback-round-3`; `git status --short` shows only ` M feedback.md` after docs commit.
- [x] 5. `git log --oneline feat/duel-field-round-2..HEAD^` — prints nothing, proving pre-docs base has no commits absent from round 2 before merge.
- [x] 6. `git merge --no-ff feat/duel-field-round-2 -m "merge: land duel field feedback round 2"` — completes without conflict on `plan/duel-field-feedback-round-3`.
- [x] 7. `npm run check:headless` — exits 0; capture output.
- [x] 8. `npm run test:component` — exits 0; capture output.
- [x] 9. `npm run build` — exits 0; capture output.
- [x] 10. Run chromium e2e, foreground, blocking; command exits 0 with all Chromium tests passing:
      ```bash
      cd /home/aron/projects/ascencio
      timeout 590 nix-shell -p playwright-driver.browsers glib gtk3 nss nspr dbus atk cups \
        libdrm expat libx11 libxcomposite libxdamage libxext libxfixes libxrandr mesa \
        alsa-lib at-spi2-atk at-spi2-core cairo pango xorg.xvfb --run '
      export PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers
      npx playwright test --project=chromium
      '
      ```
      If it fails with `libglib-2.0.so.0: cannot open shared object file`, the `PLAYWRIGHT_BROWSERS_PATH` override is missing — it is not a `-p` list problem. Recreate the path with:
      `S=$(nix-build '<nixpkgs>' -A playwright-driver.browsers --no-out-link) && mkdir -p .tmp/pw-browsers && cd .tmp/pw-browsers && ln -sfn $S/chromium-1217 chromium-1228 && ln -sfn $S/chromium_headless_shell-1217 chromium_headless_shell-1228 && ln -sfn $S/ffmpeg-1011 ffmpeg-1011 && ln -sfn $S/firefox-1511 firefox-1532`
- [x] 11. If a duel-walking e2e test fails, re-run that single test twice with `-g "<test name>"`; criterion is both reruns captured before diagnosing. If none fails, mark complete from full Chromium pass because rerun is not applicable.
- [x] 12. `npm run test:unit` — exits 0; capture output.
- [x] 13. `npm run test:integration` — exits 0; capture output.
- [x] 14. `npm run test:legacy` — exits 0; capture output.
- [ ] 15. `git merge-base --is-ancestor 736b374 HEAD && git branch --show-current && git status --short` — exits 0, prints `plan/duel-field-feedback-round-3`, and shows only unstaged `feedback.md`; plan docs exist on current branch.

## Outputs

- Files committed as docs-only plan commit: `ai-artifacts/GRILL_2026_08_10_duel_field_feedback_round_3/**`, `ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`, its sibling ticket directory and HTML; `docs/ADR/010_ADR_in_field_phase_navigation.md`, ADR-011–018; `docs/README.md`; `docs/architecture/architecture.md`; `docs/deck-selection-architecture.html`; `docs/duel-field-interaction-model-v3.html`. `feedback.md` excluded.
- Repository state: `main` advances by one merge commit; `feat/duel-field-round-3` starts from it and carries one cherry-picked docs-only plan commit; temporary plan branch deleted.
- Behaviour change: none.
- Migration / config: none.

## Validation

- [x] `npm run check:headless` exits 0
- [x] `npm run test:component` exits 0
- [x] `npm run build` exits 0
- [x] chromium e2e passes 18/18 using the command in step 10
- [x] `git log --oneline --grep="^merge: land duel field feedback round 2$" -1` shows merge commit `52eb619`
- [x] `git rev-parse --abbrev-ref HEAD` prints `plan/duel-field-feedback-round-3`
- [ ] `git status --short` shows only ` M feedback.md`
- [x] `git merge-base --is-ancestor 736b374 HEAD` exits 0
- [ ] `git log --oneline origin/plan/duel-field-feedback-round-3..HEAD` prints nothing after push
- [x] app functional — Chromium command exits 0 with all tests passing; no broken path from merge
- [x] `git log --format=%s --all` contains `docs(plan): add duel field feedback round 3 plan` and `merge: land duel field feedback round 2`
