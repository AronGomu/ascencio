# Design

<!-- impeccable:design-schema 1 -->

Chosen direction: **Basilica Slate** (owner-picked 2026-09-02; see PRODUCT.md →
Brand Commitments). This file documents the built system, not an aspiration;
`src/styles/tokens.css` is the single source of every value, and this page
explains how to spend them.

## World

A dim basilica at night: blue-black slate ground, translucent blue-tinted
glass panels, rectangular geometry with shallow 45° chamfers, and gold used
the way a church uses it — ceremonially. White carries structure and reading;
gold marks identity, the primary action, and phase/state moments. Serif
throughout: inscriptional capitals for display, a workhorse text serif for
everything else.

## Color

- Ground family: `--bg #08101f` and its slate siblings (`--surface`,
  `--surface-raised`, …) — unchanged from the shipped duel palette on purpose;
  the direction was chosen for kinship with it.
- Gold is the accent, and it is ceremonial: `--accent #d3b268`,
  `--accent-strong #c19a45`, `--accent-deep #8a6f33`, dark warm ink on gold
  `--ink-on-accent #14100a`. Spend it on the wordmark, the primary action,
  phase markers, and focus (`--focus-ring #f6c177`). A screen where gold is
  everywhere has spent its meaning.
- White secondary: `--text #eef1f7` structure and body, `--muted` for support.
- State colors are gameplay semantics, not brand: `--legal` green, `--danger`
  red, `--warning`/`--selected` amber stay untouched; presentation never
  repaints legality.

## Glass

Panels over the ground are translucent, not painted: `--glass`
`rgba(150,175,215,0.055)` and `--glass-strong` `rgba(150,175,215,0.1)`, with
`--line-soft` hairlines and `--gold-line` for ceremonial edges. Overlays that
sit on live content may add `backdrop-filter: blur(12px)`; do not combine
`backdrop-filter` with a `clip-path` chamfer on the same element — Chromium
paints the blur outside the clip.

## Geometry

Angular. Radii are near-square (`--radius-sm 0.15rem`, `--radius-md 0.25rem`,
`--radius-lg 0.4rem`). Featured panels and menu-grade buttons take the 45°
chamfer: `clip-path` polygon cut by `--chamfer` (10px) on the top-left and
bottom-right corners, as `.main-menu__entries button` does. Everyday controls
keep plain square corners; the chamfer is a ceremonial cut, not a default.

## Type

- `--font-display: "Forum"` — Roman inscriptional capitals; display, wordmark,
  menu entries, phase markers. Single 400 weight; letterspace it
  (0.14–0.26em) and uppercase it rather than bolding it.
- `--font-ui: "Source Serif 4"` — variable 400–700, roman + italic; all body,
  controls, and data. Tabular numerals for LP and counts.
- Both faces are self-hosted latin subsets in `public/fonts/`, declared in
  `src/styles/fonts.css` (offline product; no network font fetch). OFL.

## Wordmark

`ASCENCIO` in Forum, letterspaced 0.26em, white with the trailing `CIO` in
gold and a faint gold halo (`text-shadow` from `--accent`). The main menu
(`src/shell/screens/MainMenuScreen.svelte`) is the reference rendering.

## Applying it

- No raw color literals outside `tokens.css` — guard-tested
  (`tests/unit/global-styles.test.ts`). Derive tints with `color-mix` on
  tokens.
- The duel field mat keeps its green table palette (`--field-*`): it is the
  game surface, not chrome. Restyling it is its own decision.
- Residual (not yet given a dedicated pass, inherit tokens only): duel HUD and
  dialogs, deck editor panels, story overlays. Selection amber `#ffd580` sits
  near brand gold; if ambiguity shows up in play, selection moves, not gold.
