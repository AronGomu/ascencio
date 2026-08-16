# T6: Zoom gating + known face-down label

**Plan:** `./ai-artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`
**Depends:** none
**Commit outcome:** Face-down cards unknown to the player never hover-zoom; face-down cards the player knows keep zoom + name label at the bottom.

## Context (self-contained)

- Goal: duel feedback round 4 — YGO story duel simulator (Svelte 5). User rules: (a) "pointer over a face-down card that is not revealed/known → do not zoom"; (b) "face-down but known → keep it, make sure it has the name at the bottom".
- This slice: `CardControl` class gating + label condition + CSS zoom selectors. Identity knowledge = `card.code !== undefined` on `BoardCardView` (ADR-014: projected code == local viewer knows identity; `hidden` only means face not visible). Own set cards: `hidden: true`, `code` present. Opponent set/hand placeholders: no `code`.
- Out of scope here: hand hover-zoom overlay (T7 builds on the class added here), preview panel (T11), chips behavior.
- Assumptions in force: field-card zoom = `transform: translate(-50%, -50%) scale(1.35)` on `:hover/:focus-within`; hand-card zoom = `scale(1.35)`; both in `src/styles/app.css`.

## Requirements

- New class `is-identity-known` on `.duel-field-card` when `card.code !== undefined`.
- Zoom CSS (field + hand variants) fires only with `.is-identity-known`.
- Name label (`.duel-field-card__label`, already bottom-anchored) renders when `card.code !== undefined` (today: `{#if !card.hidden}` — misses known face-down, over-shows nothing).

## Inputs

- `src/battle/app/components/duel-field/CardControl.svelte` — `<article class="duel-field-card" …>` class list (`class:is-hidden={card.hidden}` etc.); label block `{#if !card.hidden}<span class="duel-field-card__label" …>{card.label}</span>{/if}`. `card.label` for a known card starts with the card name (`cardAccessibleLabel` in `board-view-model.ts`) — label text itself unchanged.
- `src/styles/app.css` — zoom rules: `.duel-field-card:not(.is-hand-item):not(.is-pinned):is(:hover, :focus-within) { transform: translate(-50%, -50%) scale(1.35); }` (~line 1781) and `.duel-field-card.is-hand-item:not(.is-pinned):is(:hover, :focus-within) { transform: scale(1.35); }` (~line 1808).
- `BoardCardView` in `src/battle/field/board-view-model.ts` — `code?: CardCode`, `hidden: boolean`.
- Existing tests: `tests/component/DuelField.test.ts`, fixtures `tests/fixtures/board-view-model.ts`, `tests/fixtures/board-public-states.ts`.

## TDD

1. **Red** — `tests/component/DuelField.test.ts` (or a new `tests/component/CardControl.test.ts` if a direct-mount pattern is simpler; follow `tests/component/HandBand.test.ts` mount style):
   - test name: `an unknown face-down card is not zoomable and shows no label` — card without `code`, `hidden: true` → article lacks class `is-identity-known`, no `.duel-field-card__label` in DOM.
   - test name: `a known face-down card is zoomable and keeps its name label` — own set card (`code` set, `hidden: true`) → article has `is-identity-known`, label element present with card name text.
   - test name: `a face-up card keeps zoom and label` — regression guard.
2. **Green** — impl below.
3. **Refactor** — none.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| unknown face-down card not zoomable, no label | card w/o code | no `is-identity-known`, no label node |
| known face-down card zoomable + name label | set card w/ code | `is-identity-known` present, label shows name |
| face-up card keeps zoom and label | face-up card w/ code | both present |

## Impl steps

- [ ] 1. Write the three component tests; `npm run test:component`; red.
- [ ] 2. `CardControl.svelte`: add `class:is-identity-known={card.code !== undefined}` to the `<article>`; change label condition to `{#if card.code !== undefined}`.
- [ ] 3. `src/styles/app.css`: insert `.is-identity-known` into both zoom selectors:
      - `.duel-field-card.is-identity-known:not(.is-hand-item):not(.is-pinned):is(:hover, :focus-within) { … }`
      - `.duel-field-card.is-identity-known.is-hand-item:not(.is-pinned):is(:hover, :focus-within) { … }`
      Keep the raised z-index rule (`.duel-field-card:is(:hover, :focus-within)`) ungated — chips/pin flow unaffected.
- [ ] 4. Tests green; run `npm run test:component && npm run test:unit`.
- [ ] 5. `npm run typecheck && npm run lint && npm run format:check`.
- [ ] 6. Manual check: dev duel — hover opponent set card: no zoom, no label; hover own set card: zoom + name; hover opponent hand: nothing.

## Outputs

- Files touched: `src/battle/app/components/duel-field/CardControl.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts` (or new `tests/component/CardControl.test.ts`).
- Behavior: `.duel-field-card.is-identity-known` class is now the zoom gate — T7 reuses `card.code !== undefined` as its overlay gate.
- Migrate/config: none.

## Validation

- [ ] tests pass: `npm run test:component`, `npm run test:unit`
- [ ] manual check: set-card hover matrix above
- [ ] app functional — no broken path from this slice
- [ ] commit msg draft: `fix(field): gate card zoom on known identity and label known face-down cards`
