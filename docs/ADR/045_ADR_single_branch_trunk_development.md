# ADR-045: Single-Branch Trunk Development

> Status: accepted
> Decided: 2026-08-20
> Owners: repository workflow
> Supersedes in part: ADR-022 — branch/worktree topology only; the import boundaries stand

## Context

ADR-022 opened three domain lanes — `duel`, `deck`, `vn` — each with its own worktree, plus `main` for integration. The lanes did what they promised while three UIs were being built in parallel by separate sessions.

They also drifted. Measured on 2026-08-20: `duel` and `vn` held nothing `main` lacked, while `deck` sat **9 commits ahead** with a dirty worktree on top. Two feature rounds had shipped through `main` in the meantime. `deck` was merged back as `8e182e8` before this decision was applied, so no lane work was lost. Every cross-domain change — and this feedback round is almost entirely cross-domain — paid a rebase tax to buy isolation nobody was using.

The work has also changed shape. The restructure ahead (save-owned decks, an ownership invariant, a new main menu) crosses `src/story/`, `src/decks/`, `src/deck-editor/`, `src/shell/` and `src/battle/` in single commits. A branch model whose unit is the domain cannot express a change whose unit is the feature.

## Decision

One long-lived branch: `main`. No worktrees.

- Every change commits on `main`.
- Remote domain branches stay as an archive; local branches and worktrees are removed once their work is merged.
- `AGENTS.md` documents the branch model, not a lane table.
- **ADR-022's import boundaries are unaffected.** They were never enforced by branches: `eslint.config.js` `no-restricted-imports` zones and `tests/unit/domain-boundaries.test.ts` do that, and both keep running in `check:headless`. Public entries stay `src/shell/index.ts`, `src/story/index.ts`, `src/deck-editor/index.ts`, `src/battle/index.ts`, `src/decks/index.ts`.

## Consequences

- A feature that crosses three domains is one commit, reviewed as one thing.
- No branch can silently accumulate 9 commits of unshipped work again.
- Isolation for risky work now costs an explicit decision (a short-lived branch), rather than being the default nobody asked for.
- Loss: no parallel agent lanes without coordination. Accepted — the drift showed the lanes were serialised in practice anyway.
