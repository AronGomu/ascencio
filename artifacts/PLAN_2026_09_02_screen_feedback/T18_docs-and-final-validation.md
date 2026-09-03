# T18: Update durable docs and run final validation

**Plan:** `./artifacts/PLAN_2026_09_02_screen_feedback.md`  
**Depends:** T5, T12, T17  
**Commit outcome:** Manual checklist/glossary match shipped UI; full headless + browser gates prove all four screen slices together.

## Context (self-contained)

Goal: integration closeout. No feature code unless fixing a regression caused by T1–T17. `feedback.md` remains byte-identical. `artifacts/manual_test_checklist.md` is durable by project rule. Out of scope: divergent `ai-artifact/manual_test_checklist.md` (owner decision).

## Requirements

R1. Update `artifacts/manual_test_checklist.md` with human checks for every shipped feedback behavior; retain existing checks not invalidated.
R2. Update `docs/GLOSSARY.md`: remove favourite terminology if present; ensure `default`, `storybar`, `hotspot`, `decklist`, `catalog`, `zone` terms point to current symbols, adding only missing useful terms.
R3. Run format, boundaries, data-cy, all tests, build/reproducibility and browser acceptance.
R4. Verify `feedback.md` byte hash remains baseline `102970d0eadfe43ef1e20f8a51d500c4b217755e` (captured while owner file already differed from HEAD).
R5. Verify no dependency/package/vendor change with explicit path diff.
R6. Run `graphify . --update` after source/doc edits using installed interpreter fallback if CLI absent.

## Inputs

I1. Read all completed T1–T17 diffs, `artifacts/manual_test_checklist.md`, `docs/GLOSSARY.md`, package scripts.
I2. From dependencies: all changed behavior + tests green at ticket scope.

## Interface contract (level 5)

P1. Manual checklist sections use exact current control copy/data states; no links from durable docs to plan/grill artifacts.
P2. Glossary entries: one lowercase word, ≤10-word description, exact source symbol/path.
P3. Final gate commands: `npm run check:headless`; `npm run check:browser`; `npm run build:verify` (already nested but report output); graph update.
E1. Any failing gate: one bounded repair loop for failures caused by this plan; otherwise report exact blocker, never weaken gate.
N1. `sha1sum feedback.md` remains `102970d0eadfe43ef1e20f8a51d500c4b217755e`; agent adds zero bytes to it.

## TDD

1. **Red** — not applicable to doc-only deltas; behavior tests already written red-first in T1–T17. Run targeted test inventory before docs.
2. **Green** — update durable checklist/glossary against verified behavior.
3. **Refactor** — none.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| Headless | whole repo | exit 0 |
| Browser | component/build/E2E/acceptance | exit 0 |
| Manual checklist | T1–T17 behaviors | every observable path represented |
| Glossary | current vocabulary | no favourite entry; exact refs |
| Diff audit | git diff/status | no feedback/vendor/package mutation from plan |

## Impl steps

- [ ] 1. Inventory changed behaviors/selectors and existing manual checks.
- [ ] 2. Update manual checklist immediately after matching evidence.
- [ ] 3. Update glossary terms/refs; no ephemeral links.
- [ ] 4. Run full gates; repair one in-scope failure loop.
- [ ] 5. Update graph and capture final diff/status evidence.

## Validation

- [ ] `npm run check:headless`
- [ ] `npm run check:browser`
- [ ] `npm run build:verify`
- [ ] `git diff --check`
- [ ] `sha1sum feedback.md` prints `102970d0eadfe43ef1e20f8a51d500c4b217755e`.
- [ ] `git diff -- package.json package-lock.json vendor/` prints no plan-caused change.
- [ ] Manual: execute added `artifacts/manual_test_checklist.md` steps.
- [ ] No silent-failure swallow: `rg -n '\|\| true|catch\s*\{\s*\}|>/dev/null 2>&1'` changed source; list justified matches or `none`.
- [ ] App functional: all four screens traversed in Chromium.
- [ ] Commit msg draft: `docs(ux): keep screen-feedback acceptance reproducible`
