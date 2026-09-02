# T13: Retune brand tokens + add VariantB CSS primitives

**Plan:** `./artifacts/PLAN_2026_09_02_duel_field_feedback.md` (§ Basilica residual pass, T13–T17)
**Depends:** none
**Commit outcome:** tokens carry owner-approved VariantB values; shared `.ui-chamfer` / `.ui-glass-panel` / `.ui-dialog-title` primitives exist and are guard-tested; main menu renders with new values.

## Context (self-contained)

- Goal: apply Basilica Slate VariantB "Chamfered Plaques" (chamfered glass panels, gold-line edges, gold Forum dialog titles) to dialogs, deck editor panels, story overlays.
- This slice: foundation. Token values + reusable primitives every later ticket consumes. No component edits.
- Out of scope here: any `.svelte` file except none; duel HUD; deck select; `--field-*` mat palette; `--legal`/`--danger`/`--selected` semantics; `vendor/`.
- Assumptions in force: brand-wide retune — main menu inherits new chamfer/glass/gold (plan `## Assumptions`).

## Requirements

- Retune 4 token values, add 1 new token, in `src/styles/tokens.css`.
- Add 4 opt-in primitives to `src/styles/primitives.css` (var() references only — file rule, header comment). Dialogs are **opaque** (`.ui-dialog-panel`, `--surface-panel`); only non-dialog panels/overlay cards are translucent (`.ui-glass-panel`) — matches approved prototype VariantB, where `.dialog` kept `--surface-panel` and only `.panel`/`.overlay-card` got `--glass-strong`.
- No raw color literal outside `tokens.css` (guard: `tests/unit/global-styles.test.ts`).
- Never combine `backdrop-filter` and `clip-path` chamfer on same element (DESIGN.md → Glass, Chromium paints blur outside clip). `.ui-chamfer` therefore carries no `backdrop-filter`.

## Inputs

- `src/styles/tokens.css` (current: `--chamfer: 10px`, `--glass: rgba(150, 175, 215, 0.055)`, `--glass-strong: rgba(150, 175, 215, 0.1)`, `--gold-line: rgba(211, 178, 104, 0.5)`)
- `src/styles/primitives.css` (existing `.ui-button`/`.ui-panel` conventions)
- `src/styles/app.css:260-305` (`.main-menu__entries button` — existing chamfer consumer, must keep rendering)
- `tests/unit/global-styles.test.ts` (raw-literal guard)
- PDDR `docs/feature/PDDR-basilica_residual_ui.md` Decision 5 (param source of truth)

## Interface contract (level 5)

- **Produces** — `src/styles/tokens.css` diffs, verbatim:

```css
--glass: rgba(150, 175, 215, 0.02);
--glass-strong: rgba(150, 175, 215, 0.036);
--gold-line: rgba(211, 178, 104, 0.6);
--chamfer: 6px;
--ls-display: 0.16em;
```

- **Produces** — `src/styles/primitives.css` additions, verbatim:

```css
.ui-chamfer {
  border-radius: 0;
  clip-path: polygon(
    var(--chamfer) 0,
    100% 0,
    100% calc(100% - var(--chamfer)),
    calc(100% - var(--chamfer)) 100%,
    0 100%,
    0 var(--chamfer)
  );
}

.ui-glass-panel {
  background: var(--glass-strong);
  border: 1px solid var(--gold-line);
}

.ui-dialog-panel {
  background: var(--surface-panel);
  border: 1px solid var(--gold-line);
  box-shadow: none;
}

.ui-dialog-title {
  font-family: var(--font-display);
  font-weight: 400;
  letter-spacing: var(--ls-display);
  text-transform: uppercase;
  text-align: center;
  color: var(--accent);
}

.ui-dialog-title::after {
  content: "";
  display: block;
  width: 3.5rem;
  height: 1px;
  background: var(--gold-line);
  margin: 0.5rem auto 0;
}
```

- **Consumes:** existing token names above (values only change; no rename, no deletion).
- **Errors:** n/a (CSS). Guard test failure = raw literal outside tokens.css.
- **Invariants:** class names are the API — T14/T15/T16 bind to `.ui-chamfer`, `.ui-glass-panel`, `.ui-dialog-panel`, `.ui-dialog-title` verbatim. `.ui-chamfer` never gains `backdrop-filter`. All values in `rem`/`px` as written. **Cascade rule:** `app.css` imports `primitives.css` first, so any equal-specificity rule in `app.css` or a Svelte `<style>` block wins — consumers must **delete** the competing declaration (`background`, `border`, `border-radius`), not merely add the class.
- **Integration links:** n/a (same-process CSS).

## TDD

1. **Red** — extend `tests/unit/global-styles.test.ts` (or sibling `tests/unit/variantb-primitives.test.ts`): assert `primitives.css` contains selectors `.ui-chamfer`, `.ui-glass-panel`, `.ui-dialog-panel`, `.ui-dialog-title` and `tokens.css` contains `--chamfer: 6px` + `--ls-display: 0.16em`. Fails now. (Import-order guard — app.css imports primitives.css after tokens.css — already exists in `global-styles.test.ts`; keep green.)
2. **Green** — apply the verbatim diffs above.
3. **Refactor** — none expected.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| primitives present | read `src/styles/primitives.css` | 4 selectors exist, var()-only |
| tokens retuned | read `src/styles/tokens.css` | 5 values match contract verbatim |
| raw-literal guard | `npm run test:unit` | `global-styles.test.ts` green |
| menu still chamfered | `npm run dev`, open main menu | buttons cut 6px, gold edges visible |

## Impl steps

- [ ] 1. Red test (selectors + token values).
- [ ] 2. Edit `src/styles/tokens.css` (4 retunes + `--ls-display`).
- [ ] 3. Append primitives to `src/styles/primitives.css`.
- [ ] 4. `npm run test:unit` green; eyeball main menu in dev server.

## Validation

- [ ] tests pass: `npm run test:unit`
- [ ] manual check: main menu at 6px chamfer reads right (assumption gate — wrong → surface-scoped vars, report, do not revert values)
- [ ] no silent-failure swallow added: `none` (CSS only)
- [ ] app functional — `npm run check:headless`
- [ ] commit msg draft: `feat(styles): retune tokens + VariantB primitives per owner-approved basilica residual params`
