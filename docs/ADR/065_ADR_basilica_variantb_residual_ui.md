# ADR-065: Basilica Slate VariantB for residual UI (dialogs, deck editor, story overlays)

Status: accepted 2026-09-02. Owner decision.

## Context

DESIGN.md left residual surfaces token-inherited only: duel HUD + dialogs,
deck editor panels, story overlays. Prototype round (PDDR
`docs/feature/PDDR-basilica_residual_ui.md`) evaluated 3 variants across
those surfaces.

## Decision

- D1. VariantB "Chamfered Plaques" chosen: 45° chamfered panels, gold-line
  edges, centered gold Forum dialog titles with hairline rule.
- D2. Duel HUD excluded from pass and future plan (owner, 2026-09-02).
  Deck select excluded (ADR-064 owns it). `--field-*` mat + legality
  colors untouched.
- D3. Brand tokens retuned in `src/styles/tokens.css`: `--chamfer` 10px→6px,
  `--glass` alpha 0.055→0.02, `--glass-strong` 0.1→0.036, `--gold-line`
  alpha 0.5→0.6; new `--ls-display: 0.16em`. Brand-wide — main menu
  inherits.
- D4. Selection amber `#ffd580` kept; gold ambiguity not flagged in play.
- D5. Dialogs opaque (`--surface-panel` + gold line, primitive
  `.ui-dialog-panel`); non-dialog panels/overlay cards translucent
  (`.ui-glass-panel`). Chamfer via `.ui-chamfer`; never combined with
  `backdrop-filter` on same element (Chromium clip bug, DESIGN.md → Glass).
- D6. Shared dialog chrome (`app.css` `.dialog-panel`/`.dialog-backdrop`)
  restyle also reaches `DropConfirmDialog` + `ShellSettingsDialog` — ruled
  in-scope: dialogs, not HUD.
- D7. Story overlay scrim: `--bg-deep` 55% + blur 6px on backdrop only
  (prototype-faithful; PDDR Decision 6).

## Consequences

- C1. `.ui-chamfer`/`.ui-glass-panel`/`.ui-dialog-panel`/`.ui-dialog-title`
  become the panel API; consumers must delete competing declarations
  (primitives import first → lose equal-specificity cascade).
- C2. Two story-local dialogs (`SellImpactDialog`, story `LoadScreen`)
  keep old chrome — only remaining unstyled dialogs; future owner call.
- C3. jsdom carries no component CSS → visual rules guarded by source-text
  tests + Chromium e2e, not computed styles.
