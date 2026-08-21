# T1: Trunk docs and baseline

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** none
**Commit outcome:** `AGENTS.md` describes single-branch trunk development, ADR-045 records why the worktree lanes were retired, and `npm run check:headless` is green on `main`.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one dependency-ordered ticket chain on `main` — duel fixes, an engine encoder-contract fix, replay-based duel recovery, save-owned decks with an ownership invariant, a collection screen, a new shell main menu with Free Play, and the shop/reveal rework.
- This slice: the first commit. It frontloads the human prerequisites and rewrites the repo's own instructions so every later ticket lands on trunk without contradicting `AGENTS.md`.
- Out of scope here: any `src/` change. This ticket touches documentation only.
- Assumptions in force: the deck-editor round-2 work is already merged into `main`; the `duel`, `vn` and `deckbuilder` worktrees are already removed; ADR-022's import boundaries survive untouched and only its branch/worktree topology is retired.

## Requirements

- ~~**TODO(user) — verify before starting**~~ — **resolved by the orchestrator on 2026-08-20, do not re-litigate.** `git log main..deck` prints nothing and `git log origin/main..deck` prints nothing; merge commit `8e182e8` carries deck round 2, and `3fba41a`, `cc42c40`, `994d13e`, `0dbbd35` are all ancestors of `main`. The `duel` and `vn` worktrees are removed. The `deckbuilder` worktree still exists on purpose: the user authorised removing `duel` and `vn` only, so leave it alone and do not run `git worktree remove` on it.
- `AGENTS.md` no longer instructs an agent to commit on `duel`, `deck` or `vn`, and no longer recommends a worktree topology.
- `AGENTS.md` keeps the boundary rules, the file design policy, the HTML element contract, the knowledge-graph section and the technical stack table unchanged in meaning.
- A new ADR records the decision, names what it supersedes in ADR-022, and states explicitly that the import boundaries are unaffected.
- ADR-022 gains a status note pointing at the new ADR for its topology section.

## Inputs

- `AGENTS.md` — sections `### Branch ownership`, `## Three-domain application direction` (the "Recommended parallel topology" and "Exclusive ownership" bullets), and the sentence in `## Purpose and status` that reads "Domain worktree lanes (`duel`, `deck`, `vn`) are open; see ADR-022 for the fork point and workflow."
- `docs/ADR/022_ADR_three_ui_modular_monolith_and_worktree_boundaries.md` — the ADR being partially superseded.
- `docs/ADR/` — highest existing number is 044, so this ADR is **045**.
- `tests/unit/domain-boundaries.test.ts` and `eslint.config.js` — the machine-enforced boundaries that must keep passing untouched.

## TDD

1. **Red** — add `tests/unit/agents-doc-trunk.test.ts` with the two cases below; both fail against the current `AGENTS.md`.
2. **Green** — rewrite the three `AGENTS.md` sections and write ADR-045.
3. **Refactor** — none expected; keep the test green.

## Test plan

| Test                                                              | Input                       | Expect                                                                                              |
| ----------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------- |
| `AGENTS.md names main as the only long-lived branch`              | `readFileSync("AGENTS.md")` | Contains `single long-lived branch`; does **not** match `/worktree lanes/i` or `/Branch ownership/` |
| `AGENTS.md keeps the machine-enforced boundary section`           | `readFileSync("AGENTS.md")` | Still contains `tests/unit/domain-boundaries.test.ts` and `no-restricted-imports`                   |
| `ADR-045 exists and supersedes only the topology half of ADR-022` | ADR-045 text                | Contains `ADR-022`, `topology`, and `import boundaries are unaffected`                              |

## Impl steps

- [x] 1. Run `git log --oneline main..deck` and `git worktree list`; confirm the prerequisite above.
- [x] 2. Create `tests/unit/agents-doc-trunk.test.ts` with the three cases from the test plan, using `readFileSync(join(projectRoot, "AGENTS.md"), "utf8")` — copy the `projectRoot` resolution style from `tests/unit/global-styles.test.ts`.
- [x] 3. Run `npx vitest run tests/unit/agents-doc-trunk.test.ts` and see it fail.
- [x] 4. In `AGENTS.md`, replace the `### Branch ownership` section with a `### Branch model` section stating: one single long-lived branch `main`; every change commits there; module boundaries are enforced by lint and tests, not by branches.
- [x] 5. In `AGENTS.md` `## Purpose and status`, delete the worktree-lane sentence and replace it with a pointer to ADR-045.
- [x] 6. In `AGENTS.md` `## Three-domain application direction`, delete the "Recommended parallel topology" bullet and the "Domain contract changes land in Integration first" bullet; keep the "Exclusive ownership" bullet but reword it as directory ownership rather than branch ownership.
- [x] 7. Write `docs/ADR/045_ADR_single_branch_trunk_development.md` with status `accepted`, decided `2026-08-20`, context (four branches drifted; `deck` sat 9 commits ahead while `main` shipped two feature rounds), decision (single `main`, no worktrees, remotes kept as archive), consequences, and an explicit line that ADR-022's import boundaries are unaffected.
- [x] 8. Add a `> Superseded in part by ADR-045 (branch topology only; the import boundaries stand).` line under the status block of `docs/ADR/022_ADR_three_ui_modular_monolith_and_worktree_boundaries.md`.
- [x] 9. Run `npx vitest run tests/unit/agents-doc-trunk.test.ts` and see it pass.
- [x] 10. Run `npm run format` so the new markdown matches Prettier.

## Outputs

- Files touched: `AGENTS.md`, `docs/ADR/045_ADR_single_branch_trunk_development.md` (new), `docs/ADR/022_ADR_three_ui_modular_monolith_and_worktree_boundaries.md`, `tests/unit/agents-doc-trunk.test.ts` (new).
- Behaviour change: none in the app.
- Migration/config: none.

## Validation

- [x] `npx vitest run tests/unit/agents-doc-trunk.test.ts` passes
- [x] `npm run check:headless` passes
- [x] manual: `git worktree list` shows no domain lane other than `deckbuilder` — i.e. `duel` and `vn` are gone. `deckbuilder` remaining is expected and is **not** a failure; the user has not authorised its removal.
- [x] app functional — no `src/` change, so nothing can regress
- [x] commit msg draft: `docs(repo): single-branch trunk development, ADR-045`
