# T4: Empty stack renders bare zone (name + count only)

**Plan:** `./artifacts/PLAN_2026_09_02_duel_field_feedback.md`
**Depends:** T3 (file-conflict serialization on `StackControl.svelte` + stack CSS — no semantic dependency)
**Commit outcome:** An empty deck/extra/graveyard/banished pile shows only the zone outline, its name and count `0` — no purple gradient, no card cover.

## Context (self-contained)

- Goal: owner feedback `feedback.md` § Duel Field item 2 — empty zones at game start must not show card cover or purple zone; keep name and card number.
- This slice: conditional stack styling on `count === 0`.
- Out of scope here: stack sizing (done in T3), card back asset (T1).
- Assumptions in force: A6 — "purple zone" = `--stack-accent`/`--stack-surface` gradient (`app.css:2235`, `tokens.css:90-91`); "card cover" = the card-back img (already only rendered when `count > 0` for deck/extra per `StackControl.svelte:71-88`); "empty" = `stack.count === 0`.

## Requirements

- `count === 0` → `.duel-field-stack` gets modifier class `is-empty`; empty state drops the gradient/surface background and any border treatment implying a card, keeps the neutral zone outline consistent with `ZoneControl` empty zones (`--field-zone-fill`, `app.css:1468-1488`).
- Name + count remain visible (already unconditional at `StackControl.svelte:89-99` — must stay).
- Non-empty rendering unchanged.

## Inputs

- **From T3:** `StackControl.svelte` now takes `cardWidth`/`cardHeight` props and centers the tile; `positionStyle` is the T3 shape. Build on that file state.
- `src/styles/app.css:2235-2257` stack background; `src/styles/tokens.css:90-91` accent/surface tokens.
- Component tests: `tests/component/DuelField.test.ts:3691` ("an empty pile shows no art"), e2e `duel-smoke.spec.ts:3742-3797`.

## Interface contract (level 5)

- **Produces:**
  - `StackControl.svelte` root: `class:is-empty={stack.count === 0}`.
  - CSS (exact selector): `.duel-field-stack.is-empty { background: var(--field-zone-fill); }` plus removal of any empty-state box-shadow/border that reads as a card. No token changes.
- **Consumes:** `BoardStackView { zone, count, topCardCode?, … }` unchanged.
- **Errors:** none.
- **Invariants:** `__name`/`__count` present at count 0; count text is `0`, not hidden.
- **Integration links:** observe in Chromium at duel start (GY/banished empty): computed `background-image` of `[data-cy="stack-control-p0:graveyard"]`-equivalent contains no gradient.

## TDD

1. **Red** — component test: count 0 → root has `is-empty`, name+count rendered; count > 0 → no `is-empty`.
2. **Green** — class + CSS.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| component StackControl | `count: 0` | `is-empty` class, name + `0` visible, no art element |
| component StackControl | `count: 3`, deck | no `is-empty`, card back img present |
| unit global-styles | stylesheet | `.duel-field-stack.is-empty` rule exists with `--field-zone-fill` |
| e2e | game start | GY + banished show bare zone, deck shows back |

## Impl steps

- [ ] 1. Red tests.
- [ ] 2. `is-empty` class + CSS rule.
- [ ] 3. Update e2e stack snapshots if affected.

## Validation

- [ ] `npm run check:headless`; component gate (NOT in check:headless): `npx vitest run tests/component/StackControl.test.ts tests/component/DuelField.test.ts`
- [ ] manual check: game start — extra (non-empty shows back), GY/banished bare
- [ ] silent-failure sites: none
- [ ] app functional
- [ ] commit msg draft: `fix(duel-field): empty piles render as bare zones, not covered cards`
