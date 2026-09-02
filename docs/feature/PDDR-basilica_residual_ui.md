# PDDR: basilica_residual_ui

Question: how do residual surfaces — duel HUD, dialogs, deck editor panels,
story overlays — wear Basilica Slate (glass, chamfers, Forum phase markers)?
Deck select excluded (own prototype/ADR-064). Source of truth: DESIGN.md +
`src/styles/tokens.css` (commit `f219695`).

## Assumptions

- Branch: UI (visual/hierarchy question, no state model at stake).
- Standalone host chosen over integrated route: pass spans 4 domains
  (battle/deck-editor/story/shell); one in-app route cannot host all
  four without cross-domain prototype wiring. Mocks mirror real component
  names: PhaseBar, PromptControls, DuelRail, MenuDialog, DuelResultDialog,
  PromptDialog, DuelErrorDialog, DeckLibrary, DeckWorkspace,
  ValidationIssues, PauseOverlay, SaveLoadOverlay, OverlayShell.
- Duel mat untouched — `--field-*` green stays game surface (DESIGN.md).
- Legality colors untouched: `--legal`, `--danger` semantics never repainted.

## Decision 1: variant axis

- CHOSEN: 3 variants differing in how ceremonial gold/glass/chamfer is spent,
  same content + tokens across all.
  - VariantA "Quiet Glass" — flat `--glass` panels, `--line-soft` hairlines,
    blur 8px, gold only on active phase underline + primary action.
  - VariantB "Chamfered Plaques" — `--glass-strong` panels chamfered 45°,
    `--gold-line` edges, active phase = solid gold plaque, centered gold
    dialog titles with rule.
  - VariantC "Inscribed Rules" — square opaque `--surface-panel`, 2px gold
    top rule per panel, Forum inscription headers, phase bar as interpunct
    text line, active phase = glowing gold word.
- WHY: the open question in DESIGN.md is spend of gold/chamfer, not palette;
  variants isolate that spectrum (quiet → ceremonial → inscriptional).
- NOT CHOSEN: color-direction variants (brand already fixed); per-domain
  divergent styles (violates one-brand modular monolith).
- PARAMS: see Decision 2.
- DATE: 2026-09-02

## Decision 2: adjustable params

- CHOSEN: chamfer 0–18px (default 10px = `--chamfer`), glass opacity
  0–0.2 (default 0.055, glass-strong derived ×1.8 cap 0.3), gold-line
  opacity 0.1–1 (default 0.5), display letterspacing 0.06–0.30em
  (default 0.20em), selection color select: amber `#ffd580` (current) /
  ice blue `#9bd1ff` / legal green `#7ee2a8` / ghost white `#eaf6ff`.
- WHY: selection-vs-gold ambiguity is a named open risk ("selection moves,
  not gold") — prototype lets owner judge amber against gold live; other
  params are the tunable primitives of the glass/chamfer system.
- NOT CHOSEN: font choice params (type is committed), radius params
  (angular geometry is committed).
- DATE: 2026-09-02

## Decision 3: surfaces mocked

- CHOSEN: 4 tabs — Duel HUD (LP blocks, PhaseBar, prompt strip, duel log
  rail over green mat), Dialogs (menu / result / prompt choice / error),
  Deck Editor (library, main-deck zone grid 40 slots, catalog search,
  validation issues), Story Overlays (pause + save/load over blurred scrim).
- WHY: exactly the residual list from DESIGN.md; deck select excluded per
  request.
- NOT CHOSEN: card zoom inspector, drag ghost, shop — not named residual,
  add later if pass extends.
- DATE: 2026-09-02

## Decision 4: scope cut — duel HUD excluded

- CHOSEN: duel HUD removed from prototype and from the residual pass plan.
  Residual scope is now: dialogs, deck editor panels, story overlays.
- WHY: owner instruction 2026-09-02.
- NOT CHOSEN: keeping HUD tab as reference — dead scope invites accidental
  styling of game chrome.
- DATE: 2026-09-02

## Decision 5: variant + params

- CHOSEN: VariantB "Chamfered Plaques" — glass-strong chamfered panels,
  gold-line edges, centered gold dialog titles with rule, chamfered menu
  buttons.
- WHY: owner choice 2026-09-02 with exact params.
- NOT CHOSEN: VariantA Quiet Glass (too quiet), VariantC Inscribed Rules
  (owner passed).
- PARAMS: chamfer 6px; glass opacity 0.02 (glass-strong derived 0.036);
  gold-line opacity 0.6; display letterspacing 0.16em; selection color
  amber #ffd580 kept — no gold ambiguity flagged.
- DATE: 2026-09-02

## Decision 6: story overlay scrim

- CHOSEN: scrim `color-mix(in srgb, var(--bg-deep) 55%, transparent)` +
  `backdrop-filter: blur(6px)` on `.overlay-backdrop` only.
- WHY: prototype-faithful — approved prototype used `rgba(4,9,18,0.55)`
  (= `--bg-deep` at 0.55) + blur 6px. Coherence review caught ticket
  drift to blur 12px / `--bg`; corrected to prototype values.
- NOT CHOSEN: current shipped scrim (`--bg-deeper` 85%, no blur) — heavier,
  hides scene art; blur 12px — not what owner saw.
- PARAMS: blur 6px; scrim alpha 0.55 on --bg-deep.
- DATE: 2026-09-02
