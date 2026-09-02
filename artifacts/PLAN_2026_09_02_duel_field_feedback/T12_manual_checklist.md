# T12: Manual test checklist update for every shipped slice

**Plan:** `./artifacts/PLAN_2026_09_02_duel_field_feedback.md`
**Depends:** T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11 (every shipped slice of this round)
**Commit outcome:** `artifacts/manual_test_checklist.md` covers a human test step for each of the 14 feedback items shipped this round.

## Context (self-contained)

- Goal: AGENTS.md — `artifacts/manual_test_checklist.md` is durable, "the human test steps for every shipped slice, kept current, never retired with a plan". Red-team gap G1: no ticket owned it.
- This slice: documentation closing pass, after all implementation tickets land.
- Out of scope here: `ai-artifact/manual_test_checklist.md` (divergent sibling — owner decision pending, predates this plan); any code change.
- Assumptions in force: checklist format = whatever structure the file already uses (read it first, match style, append per-slice sections; H3 — never clobber).

## Requirements

- One human-executable check per feedback item 1–14, phrased as action → expected observation. Expected behaviors, inlined (self-contained — do not read sibling tickets):

| Item | Action | Expected observation |
| --- | --- | --- |
| 1 | In a card-selection prompt, click a hand card then move the pointer away | Selected card floats enlarged over the field (like hover), orange halo unclipped |
| 2 | Start a duel | Empty GY/banished show bare zone outline + name + count `0`; no purple gradient, no card cover |
| 3 | Look at deck/extra stacks and any face-down card | Real Yu-Gi-Oh! card back image (not teal/purple SVG). Offline/no-asset: SVG fallback, no error |
| 4 | Compare deck/extra/GY/banish tiles to a hand card | Same width and height (±1px by eye) |
| 5 | Look at right pane | Noticeably narrower; avatars/LP/status intact, no wrap breakage |
| 6 | Look above the duel field | Horizontal phase bar; your phases left half, opponent right half, meeting at field vertical middle; End Turn in your half |
| 7 | Compare field size to previous build | Field visibly larger, fills freed width |
| 8 | Hold 5+ cards | Both hands fan in a visible arc (center high, edges lower + rotated), no clipped corners |
| 9 | Normal summon a monster | On resolve, no orange halo remains anywhere |
| 10 | Hover a hand monster with a legal activation; hover a spell | Activate chip appears (spells: Set AND Activate); chip click activates |
| 11 | With Full Control OFF, send a GY-trigger monster (e.g. Scarm) to GY by your own action | Activation prompt appears instead of being skipped |
| 12 | Activate an XYZ effect that detaches material | Dialog lists all valid materials with art (card back for concealed); pick resolves cost |
| 13 | Look at bottom-left of duel field | Full Control checkbox there; tooltip opens toward the field |
| 14 | Duel settings mid-duel → "Download duel log" | `ygo-duel-diagnostics-*.json` downloads, holds prompt/response timeline; button disabled before any trace exists |

- Steps reference visible UI (data-cy names not required — human checklist). If a shipped slice's final behavior differs from this table, the shipped behavior wins — verify against the running build.
- Skipped/blocked tickets (if any) get no checklist entry; note them in the commit message instead.

## Inputs

- **From Depends:** final shipped behavior of T1–T11 (read each ticket's Commit outcome + the actual UI).
- `artifacts/manual_test_checklist.md` current structure.

## Interface contract (level 5)

- **Produces:** appended/updated sections in `artifacts/manual_test_checklist.md`; no other file.
- **Consumes:** n/a (prose).
- **Errors:** n/a.
- **Invariants:** existing checklist entries untouched unless a shipped slice changed their expected observation (e.g., phase bar position steps must be updated, not duplicated).
- **Integration links:** n/a (documentation slice — "observe" = a human can run every new step against the built app).

## TDD

n/a — documentation. Verification = executing the steps once against the dev build.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| manual run-through | each new checklist step | observation matches on current build |

## Impl steps

- [ ] 1. Read current checklist structure.
- [ ] 2. Draft 14 steps + update any stale existing steps (phase bar/rail).
- [ ] 3. Execute each step once in Chromium; fix wording where observation differs.

## Validation

- [ ] every new step executed once against dev build
- [ ] no existing entry lost (diff review)
- [ ] silent-failure sites: n/a
- [ ] commit msg draft: `docs(checklist): human test steps for duel-field feedback round`
