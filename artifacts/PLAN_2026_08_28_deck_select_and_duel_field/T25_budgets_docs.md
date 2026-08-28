# T25: Budgets + checklist + glossary + docs

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`
**Depends:** T21, T22, T24 — and the whole duel-field track (T1–T10) merged first: this is the single closing gate for both rounds, so the byte budgets measured here cover battle-domain growth too.
**Commit outcome:** Full gate green — `npm run check:headless`, `npm run build:verify` (budgets re-measured where the new shared chunk and the duel-field changes moved bytes), full e2e; `artifacts/manual_test_checklist.md`, `docs/GLOSSARY.md`, `docs/architecture/architecture.md` and the design doc's status current. Round closable.

## Context (self-contained)

- Goal: implement validated deck-selection design (`docs/deck-selection-screen-design.md`) — this slice closes the round: machine gates, budgets, durable docs.
- This slice: verification + documentation only. Code changes limited to what a failing gate demands (and each such fix stays minimal).
- Out of scope here: new features, colour-blind/contrast pass (stays logged debt), retiring the plan artifacts (owner does that at round end).
- Assumptions in force: T20-T24 landed, and T1-T10 (duel field / right pane) landed; `src/deck-select/` is imported by shell, deck-editor and story — its bytes count into each domain closure measured by `scripts/verify-browser-build.ts`; budget thresholds are code, raised only deliberately with the measurement quoted (repo precedent: the `T11 2026-08-20` and `T21 2026-08-15` comments already in that file — earlier rounds' ticket ids, unrelated to this plan's T11/T21).

## Requirements

- Gates, in order, each output captured:
  1. `npm run check:headless` — format, lint, typecheck, legacy/unit/integration, vendor/assets/snapshot verify.
  2. `npm run test:component`
  3. `npm run build && npm run build:verify` — if a domain closure or shell budget trips: quote the exact failure line, re-measure, and raise that one ceiling in `scripts/verify-browser-build.ts` using the file's own formula precedent (`ceil(measured/25_000) * 25_000 * 1.15`) with a dated comment naming this plan's commit — or shrink the chunk if the overshoot is accidental (an eager import of `src/battle/index.ts` from deck-select would be a bug, not a budget problem; check `shell initial JavaScript` specifically).
  4. `npm run test:e2e` — full Playwright suite, desktop + any narrow-viewport specs added in T20/T24.
- `artifacts/manual_test_checklist.md` (durable, never retired): replace the free-play match-setup, deck-library and story pre-battle step lists with steps for the new screen. Cover at minimum: pick deck each seat, opponent persona change + persistence across reload, one-duel opponent deck override, favourite star (free play local + preset, story save), default badge, illegal deck disabled with reason (story), kebab rename/duplicate/delete (free play + library), dblclick open, `/` `↑↓` `Enter` `f` shortcuts, hover decklist float (duel start), docked panel + art float (library), narrow-viewport pinned-first + sticky Start, story locked opponent caption.
- `artifacts/manual_test_checklist.md`, duel-field half: the T1-T10 tickets each appended their own steps as they landed. Here, only reconcile — dedupe entries the two tracks wrote for the same screen, and verify every appended step still describes shipped behavior. Do not rewrite duel-field steps that are already correct (D2).
- `docs/GLOSSARY.md` (per `make-glossary-aron` duty): add/update entries — Deck tile, Seat halo (blue/red/teal/gold semantics), Kebab menu, Opponent persona (Practice Bot / Blaze Circuit / Vault Warden), Pinned-first (mobile), Duel Start screen, Deck Builder Library screen. Inline definitions, no artifact links.
- `docs/architecture/architecture.md`: add `src/deck-select/` to the map — shared presentational domain, public entry, who imports it (shell, deck-editor, story), what it never imports. Cite the landed commit SHA range, not plan files (H6).
- `docs/deck-selection-screen-design.md` + `docs/deck-selection-screen-design.html`: update §Status & scope — no longer "No real Svelte/TypeScript component exists yet"; name the replacing component and the commit SHA. Both files together (their own header rule).
- If `graphify` CLI works in the environment: `graphify . --update` to refresh `graphify-out/`; if the CLI is broken (it was at plan time — `uv` wrapper missing binary), skip and note as residual.
- Residual risks to log in the final report: colour-only semantics (no contrast/colour-blind pass — pre-existing flagged debt now extended to this screen); story kebab management deferred (T24 assumption); graphify staleness if skipped.

## Inputs

- `scripts/verify-browser-build.ts` — budget table (~line 381), formula precedent in comments.
- `artifacts/manual_test_checklist.md` — current structure; edit sections in place.
- `docs/GLOSSARY.md`, `docs/architecture/architecture.md`, `docs/deck-selection-screen-design.md`/`.html`.
- `~/.claude/skills/make-glossary-aron/SKILL.md` — glossary format rules; read before editing the glossary.
- **From Depends:** T20-T24 commits on the branch; every suite already green per-ticket — this ticket proves them green together.

## TDD

Verification ticket — no new behavior. Red/green = the gates themselves: run, capture, fix minimal, re-run.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| headless gate | `npm run check:headless` | exit 0 |
| component suite | `npm run test:component` | exit 0 |
| build + budgets | `npm run build && npm run build:verify` | exit 0 (after any deliberate measured raise) |
| e2e | `npm run test:e2e` | exit 0 |
| docs consistency | `git grep -n "FreePlayDeckSeat" src/ docs/architecture/` | no live references to the deleted component |

## Impl steps

- [ ] 1. `npm run check:headless` → capture; fix minimal if red; re-run to green.
- [ ] 2. `npm run test:component` → green.
- [ ] 3. `npm run build && npm run build:verify` → green (budget handling per Requirements 3; quote measurement in any raised line's comment).
- [ ] 4. `npm run test:e2e` → green.
- [ ] 5. Update `artifacts/manual_test_checklist.md` per Requirements (deck-select sections rewritten; duel-field sections reconciled only).
- [ ] 6. Read `make-glossary-aron` skill; update `docs/GLOSSARY.md`.
- [ ] 7. Update `docs/architecture/architecture.md` (+ deck-select domain) and both design-doc twins' status.
- [ ] 8. Attempt `graphify . --update`; note outcome either way.
- [ ] 9. Final gate re-run: `npm run check:headless && npm run test:component && npm run build:verify` → all green, outputs captured.

## Outputs

- Edited: `artifacts/manual_test_checklist.md`, `docs/GLOSSARY.md`, `docs/architecture/architecture.md`, `docs/deck-selection-screen-design.md`, `docs/deck-selection-screen-design.html`, possibly `scripts/verify-browser-build.ts` (measured budget lines only).
- No public API change.

## Validation

- [ ] all four gate commands exit 0, outputs captured verbatim
- [ ] checklist/glossary/architecture/design-status updated, no durable link to `artifacts/` plan files (H6)
- [ ] app functional end to end: free play, library, story all on the new screen; duel field still runs the T1-T10 behavior (no regression from the merged budgets/doc pass)
- [ ] commit msg draft: `chore(docs): close the deck-selection round with green gates and current docs`
