# T16: Story overlays adopt VariantB

**Plan:** `./artifacts/PLAN_2026_09_02_duel_field_feedback.md` (§ Basilica residual pass, T13–T17)
**Depends:** T13
**Commit outcome:** every story overlay (pause, save/load, settings, history, load) renders through a VariantB-styled `OverlayShell`: blurred scrim + chamfered glass-strong panel + gold Forum title; focus trap and Escape behavior unchanged.

## Context (self-contained)

- Goal: apply Basilica Slate VariantB (chamfered glass panels, gold-line edges, gold Forum titles) to residual surfaces.
- This slice: story overlay chrome in `src/story/overlays/` (+ `src/story/styles.css` if overlay classes live there). Presentation only.
- Out of scope here: narrative screens' scene rendering, `src/story/content/` (ADR-053 canon), choice/playback logic, save data shapes, screens in `src/story/screens/`.
- Assumptions in force: tokens retuned brand-wide (T13).

## Requirements

- `OverlayShell.svelte` is the single restyle point: `.overlay-backdrop` = scrim `color-mix(in srgb, var(--bg-deep) 55%, transparent)` + `backdrop-filter: blur(6px)` (prototype-faithful — prototype scrim `rgba(4,9,18,0.55)` = `--bg-deep` at 0.55, blur 6px; recorded PDDR Decision 6); `.overlay` panel = `.ui-glass-panel ui-chamfer`; header title = `.ui-dialog-title`.
- `OverlayShell` paints today with `var(--story-panel)` / `var(--story-border)` (defined `src/story/styles.css:16-20` as `--surface-raised` / `--border-light`). **Bypass them in overlay rules — do not repoint the tokens**: `--story-panel` also styles story screens (`styles.css:171`), out of scope.
- Blur lives on `.overlay-backdrop` only; `.overlay` (chamfered) never gets `backdrop-filter` (DESIGN.md → Glass, Chromium clip bug).
- Overlays composing shell (`PauseOverlay`, `SaveLoadOverlay`, `SettingsOverlay`, `HistoryOverlay`, `LoadOverlay`) inherit; touch them only where they duplicate panel chrome locally.
- Save-slot selection highlight stays `--selected` amber (owner kept amber, PDDR Decision 5).
- No `data-cy` changes (values like `story-overlay-${labelId}` are frozen); focus-trap/Escape/`aria-modal` logic untouched.

## Inputs

- files: `src/story/overlays/OverlayShell.svelte` (renders `.overlay-backdrop` `:47` > `.overlay[role=dialog]` `:49` > `header` `:60`; scrim today `color-mix(in srgb, var(--bg-deeper) 85%, transparent)` at `:95`; focus logic in `<script>` — do not touch), overlay components (only `PauseOverlay`, `SettingsOverlay`, `HistoryOverlay` carry local `<style>`; `LoadOverlay` + `SaveLoadOverlay` have none — dedupe sweep is 3 files, not 5), `src/story/styles.css` (tokens `:16-20`; holds no overlay rules).
- **From Depends (T13):** classes verbatim — `.ui-chamfer`, `.ui-glass-panel`, `.ui-dialog-title`; tokens `--chamfer: 6px`, `--glass-strong: rgba(150, 175, 215, 0.036)`, `--gold-line: rgba(211, 178, 104, 0.6)`, `--ls-display: 0.16em`.

## Interface contract (level 5)

- **Produces:** `OverlayShell` `.overlay` element `classList` includes `ui-glass-panel ui-chamfer`; header title element includes `ui-dialog-title`; `<style>` block source: `.overlay-backdrop` rule contains `backdrop-filter: blur(6px)` + `color-mix(in srgb, var(--bg-deep) 55%, transparent)`; `.overlay` rule contains no `backdrop-filter`, no `var(--story-panel)`, no competing `background`/`border`/`border-radius`. Props (`title`, `labelId`, `onclose`, `restoreFocusTo`, `controlsSuspended`), `data-cy` values: unchanged.
- **Consumes:** T13 class names verbatim (binding).
- **Errors:** n/a.
- **Invariants:** blur ∉ chamfered element. Last-opened-modal Escape priority + `trapTabWithin` untouched. Selection amber `#ffd580` via `--selected` only.
- **Integration links:** n/a.

## TDD

1. **Red** — component test: render `OverlayShell`, assert `.overlay` classList has `ui-glass-panel ui-chamfer`, title has `ui-dialog-title`. Blur placement via **source-text** assertion on the `<style>` block (jsdom injects no component CSS — `tests/component/deck-editor/card-tile-art.test.ts:14-17`; computed-style checks are vacuous): `.overlay-backdrop` rule contains `backdrop-filter: blur(6px)`, `.overlay` rule contains none. Fails now.
2. **Green** — restyle shell (+ dedupe overlay-local chrome).
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| shell VariantB | render `OverlayShell` | classes per contract |
| blur placement | source-text read of `OverlayShell` `<style>` | blur(6px) in `.overlay-backdrop` rule only |
| focus trap intact | existing overlay tests | still green, unmodified |
| 5 overlays visual | dev server story route | chamfered gold-edged panels over blurred scene |
| data-cy freeze | `npm run test:unit` | `data-cy-coverage.test.ts` green |

## Impl steps

- [ ] 1. Red shell test.
- [ ] 2. Restyle `OverlayShell` styles (+ `src/story/styles.css` overlay rules if defined there).
- [ ] 3. Sweep `PauseOverlay`/`SettingsOverlay`/`HistoryOverlay` `<style>` blocks for duplicated panel chrome; dedupe onto primitives.
- [ ] 4. Green: component + unit suites.

## Validation

- [ ] tests pass: `npm run test:component && npm run test:unit`
- [ ] manual check: story route → pause, save/load, settings, history, load overlays; Escape + tab-trap still work
- [ ] no silent-failure swallow added: `none`
- [ ] app functional — save/load round-trip works
- [ ] commit msg draft: `feat(story): overlays adopt VariantB chamfered glass per basilica residual pass`
