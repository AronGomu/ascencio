# T14: Battle dialogs adopt VariantB (shared dialog chrome)

**Plan:** `./artifacts/PLAN_2026_09_02_duel_field_feedback.md` (§ Basilica residual pass, T13–T17)
**Depends:** T13
**Commit outcome:** shared dialog chrome in `src/styles/app.css` renders VariantB — chamfered opaque panel, gold-line edge, blurred backdrop, gold Forum title — so every duel dialog (menu, result, prompt, error, settings) plus inheriting consumers (`DropConfirmDialog`, `ShellSettingsDialog`) wear it; behavior, legality colors, data-cy names unchanged.

## Context (self-contained)

- Goal: apply Basilica Slate VariantB (chamfered panels, gold-line edges, gold Forum dialog titles) to residual surfaces.
- This slice: dialog chrome. The six battle dialog components carry **no** `<style>` blocks — their chrome lives in shared `src/styles/app.css` (`.dialog-backdrop` `app.css:464`, `.dialog-panel` `app.css:474`, `.loading-overlay` `app.css:420`). Real edit target = `app.css` rules + class/markup touch-ups in `src/battle/app/components/`.
- Out of scope here: duel HUD components (PhaseBar, LP, PromptControls strip, DuelRail); `--field-*` mat palette; prompt logic `src/battle/app/prompts/`; dialog open/close/focus behavior, props, `data-cy`; `src/deck-editor/`, `src/story/` (T15/T16).
- Inheritance ruling (logged in plan assumptions): `.dialog-panel`/`.dialog-backdrop` are also consumed by `src/battle/app/components/duel-field/DropConfirmDialog.svelte:43,48` and `src/shell/screens/ShellSettingsDialog.svelte:13,15`. Both are **dialogs, not HUD** — they inherit VariantB deliberately. Owner's HUD exclusion covers HUD chrome, not dialog chrome.
- Assumptions in force: tokens retuned brand-wide (T13); cascade rule (T13): competing declarations must be deleted, not out-classed.

## Requirements

- Restyle `app.css` shared rules:
  - `.dialog-panel` — becomes VariantB: composition of T13 `.ui-dialog-panel` + `.ui-chamfer` values. Since these are global rules already, apply values **in the rule** (background `var(--surface-panel)`, border `1px solid var(--gold-line)`, `border-radius: 0`, clip-path chamfer polygon) and **delete** `border-radius: var(--radius-lg)` / `background: var(--surface-strong)` / `border: 1px solid var(--border)`.
  - `.dialog-backdrop` — add `backdrop-filter: blur(12px)` (backdrop only — never on the chamfered panel; DESIGN.md → Glass, Chromium clip bug).
  - `.loading-overlay` — gold Forum treatment for its status text; no chamfer (no panel box) unless it renders one.
- Dialog title elements in the 5 titled components (`MenuDialog`, `DuelResultDialog`, `PromptDialog`, `DuelErrorDialog`, `SettingsDialog`) gain `ui-dialog-title` class (markup-only edit). `LoadingOverlay` has no title element — exempt.
- Error dialog title keeps `--danger` color (state semantics over brand — override after `ui-dialog-title`); panel chrome still VariantB.
- Result verdict text stays `--accent` with glow.
- No raw color literals (note: `tests/unit/global-styles.test.ts` raw-literal guard does **not** cover `src/battle/` — discipline is manual there; `app.css` itself is guarded).
- No `data-cy` changes; no exported prop changes.

## Inputs

- files: `src/styles/app.css` (rules at `:420`, `:464`, `:474`); components in `src/battle/app/components/`: `MenuDialog.svelte` (`:61` `dialog-backdrop`, `:66` `dialog-panel`), `DuelResultDialog.svelte`, `PromptDialog.svelte`, `DuelErrorDialog.svelte`, `SettingsDialog.svelte`, `LoadingOverlay.svelte` (`:7` `.loading-overlay`); inheriting: `duel-field/DropConfirmDialog.svelte`, `src/shell/screens/ShellSettingsDialog.svelte` (read-only — verify inheritance, do not edit).
- **From Depends (T13):** primitives verbatim — `.ui-dialog-panel` (`background: var(--surface-panel); border: 1px solid var(--gold-line); box-shadow: none`), `.ui-chamfer` (clip-path 45° polygon by `--chamfer`), `.ui-dialog-title` (Forum, `--ls-display: 0.16em`, uppercase, centered, gold, `::after` gold rule 3.5rem×1px). Tokens: `--chamfer: 6px`, `--gold-line: rgba(211, 178, 104, 0.6)`, `--surface-panel: #101a2d`. Cascade rule: delete competing declarations.

## Interface contract (level 5)

- **Produces** — `src/styles/app.css` rule blocks, checkable by source text:
  - `.dialog-panel { ... }` contains `background: var(--surface-panel)`, `border: 1px solid var(--gold-line)`, `border-radius: 0`, `clip-path: polygon(` with `var(--chamfer)`; contains neither `border-radius: var(--radius-lg)` nor `var(--surface-strong)` nor `backdrop-filter`.
  - `.dialog-backdrop { ... }` contains `backdrop-filter: blur(12px)`; contains no `clip-path`.
  - 5 titled dialogs: title element `classList` includes `ui-dialog-title`.
- **Consumes:** T13 primitives/tokens verbatim (binding — do not redesign locally).
- **Errors:** n/a (presentation).
- **Invariants:** `aria-modal`, focus trap, Escape handling untouched. `--danger`/`--legal`/`--selected` usages untouched. No element carries both `backdrop-filter` and `clip-path`. No interactive control inside the 6px corner cut. `DropConfirmDialog` + `ShellSettingsDialog` inherit unedited.
- **Integration links:** n/a (same-process presentation).

## TDD

1. **Red** — source-text assertions (jsdom applies no component/app CSS — classList/computed-style tests are vacuous): new `tests/unit/dialog-chrome.test.ts` reads `src/styles/app.css`, asserts `.dialog-panel` block per Produces (contains/not-contains lists above) and `.dialog-backdrop` blur. Component tests: title `classList` contains `ui-dialog-title` for the 5 titled dialogs — extend existing tests for `PromptDialog`, `SettingsDialog`, `DuelResultDialog`; **create** tests for `MenuDialog`, `DuelErrorDialog` (none exist today). Fails now.
2. **Green** — edit `app.css` rules; add title classes in markup.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| panel rule VariantB | read `app.css` `.dialog-panel` block | contains/not-contains per Produces |
| backdrop blur | read `app.css` `.dialog-backdrop` block | `backdrop-filter: blur(12px)`, no `clip-path` |
| titled dialogs | render 5 components | title has `ui-dialog-title`; error title styled by `--danger` |
| data-cy freeze | `npm run test:unit` | `data-cy-coverage.test.ts` green, values unchanged |
| inheritance eyeball | dev server | DropConfirmDialog + ShellSettingsDialog wear VariantB, still usable |

## Impl steps

- [ ] 1. Red: `tests/unit/dialog-chrome.test.ts` + component title tests (2 new files: `MenuDialog`, `DuelErrorDialog`).
- [ ] 2. `app.css`: `.dialog-panel`, `.dialog-backdrop`, `.loading-overlay`.
- [ ] 3. Markup: `ui-dialog-title` on 5 titles; `--danger` override for error title.
- [ ] 4. Green: `npm run test:unit && npm run test:component`.
- [ ] 5. Eyeball DropConfirmDialog (duel drag-drop) + ShellSettingsDialog in dev server.

## Validation

- [ ] tests pass: `npm run test:unit && npm run test:component`
- [ ] manual check: dev server → duel → menu/settings/surrender/error/result/prompt + drop-confirm; shell settings; chamfer + gold edge + blurred backdrop visible; text readable over mat
- [ ] no silent-failure swallow added: `none`
- [ ] app functional — duel playable start→result dialog
- [ ] commit msg draft: `feat(styles): shared dialog chrome adopts VariantB chamfered panel per basilica residual pass`
