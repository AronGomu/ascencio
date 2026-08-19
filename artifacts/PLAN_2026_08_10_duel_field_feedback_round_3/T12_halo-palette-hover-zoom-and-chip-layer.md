# T12: Halo palette, hover zoom and chip layering

**Plan:** `./artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
**Depends:** T5, T8
**Commit outcome:** Green means legal, orange means selected/list-hover, teal means transient feedback, focus is neutral; cards and list entries zoom 1.35× in 120 ms; action chips remain hit-testable above every card/zone.

## Context (self-contained)

- Goal: ship all 30 items of `feedback.md`.
- Covers items 5, 17 and 25; supplies the palette needed by items 18/29.
- Round-2 colours are reversed: actionable uses orange `var(--warning)` and selected uses lime. Feedback also reuses orange. Fix semantics in CSS only; engine choices/classes remain authority.
- `.duel-field-board { isolation:isolate }` plus positioned card z-index means a chip child's high z-index cannot escape a lower parent stacking context. Raise hovered/focused/pinned **card parent**, not only chip.
- Out of scope: drag ghost (T13), actual target-list selection (T16), window layering (T14), new legality logic.
- Assumptions **A9/A10**: green legal; orange selected; green-filled drop target; neutral keyboard focus; teal feedback; orange list hover. Hover scale exactly `1.35`, duration `120ms`, ease-out; hand origin bottom, field origin centre; halo follows; reduced motion removes transform/transition.

## Requirements

- Legal/actionable card, zone, stack and list entry = green (`var(--success)`) outline/halo.
- Selected card, zone and list entry = orange (`var(--warning)`) outline/halo, overriding plain legal green.
- Drop candidate = green outline + translucent green fill, visually distinct from plain legal.
- Keyboard focus = neutral high-contrast outline (`var(--ink)`/white), independent of legal/selected colours.
- Transient feedback target, generic feedback badge and non-attack field line = teal (`var(--accent)`). Attack line remains danger/red; LP feedback remains danger.
- List pointer hover = orange, whether or not entry is legal. Hover never changes selection state.
- Field/hand cards and zone-list entries scale to `1.35` on pointer hover or focus-within over `120ms ease-out`.
- Scale applies to card root, not only art, so border/halo follows it. Existing opponent/sideways rotation stays on art and composes correctly.
- Hand cards transform from centre-bottom and grow inward/upward for player, centre-top/downward for opponent; non-hand field cards use centre. List entries use centre.
- Zoomed entry/card is not clipped by its list/hand viewport: add scroll padding/block padding; do not disable intended scrolling.
- `prefers-reduced-motion:reduce` disables scale and transition while leaving static halos.
- Hovered/focused/pinned/action-menu card parent rises above normal cards/stacks/zones. `document.elementFromPoint()` at every visible chip centre resolves the chip/button, not a later sibling.
- No DOM portal or dependency.

## Inputs

- **From Depends (T8), as shipped in `3f0e437`:** `CardControl` has `layout="field|hand"` / `.is-hand-item`; hands render through `HandBand.svelte` (`field-hand-band-p{player}`) whose viewport is `overflow-x:auto` with `overscroll-behavior-x:contain`. Hand cards are normal-flow at a fixed `4.5rem`, so a hovered hand card can be clipped by that viewport — this is exactly the case Impl step 8 / Requirements "not clipped by its list/hand viewport" must handle. The arrows and the viewport carry `tabindex="-1"` deliberately; do not change that. The band root uses `data-feedback-zone-id`, not `data-zone-id`.
- **From Depends (T5):** passive `.duel-field-card` pointer hit-testing is already restored.
- **From T9 (`eb431e9`):** the duel lives in a fixed `100svh` shell — `<main>.is-duel-viewport` is `overflow:hidden`, `.duel-field` may be `overflow:auto`, stacking breakpoint 79rem, `.field-action-bar` now on `.duel-field-stage`. A 1.35× zoom near a board edge cannot rely on page scroll to reveal itself. `.zone-list-entry > img` is capped at `max-height:50svh; object-fit:contain` — keep that cap (Impl step 8).
- **From T10 (`c8e007b`) and T11 (`033af59`):** the phase strip now contains the End turn button in its right group, anchored `right:1%` in both split and continuous modes because centring put it over `p0:mainMonster:4`/`p0:graveyard`. Your z-index/layer changes must not put a hovered card or chip under the strip, nor the strip over a chip the user must click. `PhaseStrip` takes an `extraMonsterZones` prop; when false the board has 32 zones and no `shared:extraMonster:*` targets, so any e2e that assumes those exist must handle both profiles.
- **From T6 (`ced9383`):** identity comes from `isProjectedCardIdentityKnown`; a known face-down card still renders `hidden: true` with back art. Zoom must not reveal art for a hidden card.

### Environment facts for validation

- Playwright is chromium-only on this host. Run browser checks as:
  `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers npx playwright test --project=chromium`
  Bare `npm run check` cannot exit 0 here (`playwright.config.ts` includes an unsupported `webkit-smoke` project). Use `npm run check:headless` plus the explicit Chromium invocation.
- Known flake: Vitest integration occasionally dies with `Worker exited unexpectedly`. Re-run once before diagnosing.
- Known flake: the duel seed is random per run; re-run a failing Chromium walker twice before diagnosing.
- The app opens on a deck picker (T3); e2e must go through it as the existing specs do.
- `src/styles/app.css:956-976` — actionable/drop orange; `:990-1010` — selected lime, focus orange, feedback orange; `:1022-1060` — line/badge colours; `:1097-1104` — list actionable/chips; `:1160-1196` — card transforms/rotations; `:1232-1254` — chips z-index and reveal.
- `src/app/components/duel-field/ZoneListEntryTile.svelte` — has `choices`/`is-actionable`, no selected prop.
- `src/app/components/duel-field/CardControl.svelte` — root state classes and art rotations.
- `tests/unit/global-styles.test.ts` currently explicitly expects orange actionable halo; invert/update it.
- `tests/component/DuelField.test.ts`, `tests/component/ZoneListDialog.test.ts`, existing responsive/action-chip e2e path.
- `docs/ADR/007...010` define target authority/selection/phase but no palette; new ADR-015 records semantics without duplicating target mapping.

## State precedence

CSS precedence from strongest semantic override to base:

1. disabled removes legal cursor/halo;
2. selected orange replaces actionable green;
3. drop-candidate green fill replaces plain legal treatment;
4. focus adds separate neutral outer outline;
5. feedback adds independent teal transient class/line;
6. hover zoom/list-orange is ephemeral and never mutates classes.

Add `selected = false` prop to `ZoneListEntryTile` now; T16 wires it. Root `class:is-selected={selected}`.

## TDD

1. **Red** — update static CSS-contract tests before styles.
2. **Green** — declarations/state prop/parent layer.
3. **Refactor** — centralise RGB mixes via vars only if current style supports it; no design-token abstraction beyond used states.

## Test plan

Update `tests/unit/global-styles.test.ts` with exact rule-block assertions:

- actionable zone/card/stack/list contain `var(--success)`, not `var(--warning)`;
- selected zone/card/list contain `var(--warning)`, not success;
- drop candidate contains success border/shadow and nontransparent background;
- navigation focus outline contains neutral colour, not success/warning;
- feedback target/default line/generic badge use `var(--accent)`; attack remains `var(--danger)`;
- card/list transition contains `transform 120ms ease-out` and hover scale `1.35`;
- hand item transform-origin bottom; opponent hand top; field centre;
- reduced-motion block contains `transform:none` and `transition:none` for zoom targets;
- hovered/focused/pinned card parent z-index exceeds normal card layer; chips retain menu/top layer.

Extend `tests/component/ZoneListDialog.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| selected state class | `selected:true` tile/dialog fixture | root `.is-selected` plus `.is-actionable` when choices exist |
| unselected legal state | choices, false | actionable only |

Extend `tests/component/DuelField.test.ts`: selected target gets `.is-selected`; legal unselected target gets only `.is-actionable`; passive preview remains.

E2E existing actionable-card path:

- capture root bounding rect before/after `.hover()`; after width/height within 2% of `1.35×` (wait >120 ms);
- halo/art rect scales with root;
- for each visible action chip, `elementFromPoint(center)` is chip or descendant;
- emulate reduced motion and repeat: bounds unchanged within 1 px, chips still usable;
- zone-list entry hover turns orange via computed border and grows 1.35×.

## Impl steps

- [x] 1. Rewrite/add global-style tests above. Run `npm run test:unit -- global-styles` red. — Evidence: added 8 new assertions to `tests/unit/global-styles.test.ts`; ran red against unmodified CSS before implementing, then green after (`npx vitest run tests/unit/global-styles.test.ts` → 17/17 passed post-impl).
- [x] 2. Add `selected` prop/class to `ZoneListEntryTile.svelte`; add component tests. — Evidence: `export let selected = false;` + `class:is-selected={selected}` added; two new tests in `tests/component/ZoneListDialog.test.ts` ("selected tile gets is-selected...", "unselected legal tile gets only is-actionable") pass.
- [x] 3. Replace actionable orange declarations for zone/card/stack/list with success green. Replace selected lime with warning orange. Add selected list rule after actionable. — Evidence: `src/styles/app.css` `.is-actionable`/`.is-selected` blocks now use `var(--success)`/`var(--warning)` respectively; `global-styles.test.ts` "actionable halo is green"/"selected halos are orange" pass.
- [x] 4. Replace drop candidate with success border/shadow + green alpha fill. Keep class presentation-only. — Evidence: `.duel-field-zone.is-drop-candidate` now `border-color: var(--success)` + `rgb(126 226 168 / …)` fill; test "drop candidate is green with a translucent fill" passes.
- [x] 5. Replace focus colour with neutral high-contrast. Keep 3 px outline and ≥2 px offset. — Evidence: `outline: 3px solid var(--ink); outline-offset: 2px;` (added `--ink: #ffffff` to `:root`, previously referenced but undefined); test "keyboard focus is a neutral outline" passes.
- [x] 6. Replace feedback target/default line/generic feedback border with accent; preserve attack/LP danger branches. — Evidence: `.is-feedback-target`, `.field-lines line`, `.duel-field-feedback` now `var(--accent)`; `.field-lines.is-attack`/`.is-life-points` untouched (`var(--danger)`); test passes.
- [x] 7. Add base root transition and hover/focus transform. For absolute field card compose `translate(-50%,-50%) scale(1.35)`; for T8 normal-flow hand item use `scale(1.35)` only. Set origins exactly. — Evidence: `.duel-field-card { transition: transform 120ms ease-out; transform-origin: center; }`; field-card hover rule composes `translate(-50%,-50%) scale(1.35)`; hand-item hover rule is `scale(1.35)` with `transform-origin: center bottom` (player) / `center top` (`.is-opponent`); unit tests + e2e zoom-ratio assertions pass.
- [x] 8. Add list transform/transition plus safe row padding/scroll margin. Ensure T9 `50svh` image cap remains. — Evidence: `.zone-list-entry` gets `transition`/`transform-origin`/hover `scale(1.35)`; `.duel-field-hand-band__viewport`/`.zone-list-dialog__entries` get `scroll-padding-inline` + directional block padding (player top-heavy, opponent bottom-heavy) sized to the zoom growth; `.zone-list-entry > img { max-height: 50svh }` untouched; e2e T12 test confirms no clipping (chip fully hit-testable after zoom) and `responsive field compositions…`/`zone-list preview image never exceeds half the viewport height` still pass.
- [x] 9. Add reduced-motion overrides covering card root/list entry, not art rotation; opponent/sideways art must remain oriented even when zoom disabled. — Evidence: dedicated `@media (prefers-reduced-motion: reduce)` block resets `transition`/`transform` on card root and list entry (mirroring the base rule's `:not(.is-pinned)` scope for correct specificity); `.duel-field-card__art` rotation rules untouched; e2e "reduced motion keeps hand card bounds unchanged on hover" passes.
- [x] 10. Raise `.duel-field-card:is(:hover,:focus-within), .duel-field-card.is-pinned` above normal siblings. Keep chips at menu layer. Do not remove board isolation unless browser hit testing proves parent raise cannot solve it. — Evidence: added `--duel-field-layer-card-raised: 35` and the exact selector from this step; board `isolation: isolate` untouched; e2e chip `elementFromPoint` hit-test passes for every visible chip.
- [x] 11. Add e2e zoom/layer/reduced-motion assertions and run chromium. If transformed cards clip at board edge, tune transform origin/scroll padding, never reduce scale. — Evidence: new e2e test `T12: field/hand cards zoom 1.35x on hover…` in `e2e/duel-smoke.spec.ts`; full chromium suite green (25/25, `PLAYWRIGHT_BROWSERS_PATH=... npx playwright test --project=chromium`). Deviation: scale is scoped `:not(.is-pinned)` rather than plain `:focus-within` — the pin flow moves focus onto a chip sitting just above the card's own edge, and zooming while that chip holds focus pushed it above the (non-scrolling) viewport, failing the pre-existing `assertRectInsideViewport` chip-containment check; excluding the pinned state (not reducing scale) fixes it. A `:has()`-scoped alternative was tried first and reverted — its selector-invalidation cost slowed the keyboard-only full-duel e2e walker (200-iteration loop) from ~4.5min to a 5min timeout; the class-based `:not(.is-pinned)` exclusion is behaviourally equivalent for this codebase (pin is the only path that puts focus on a chip while the card itself isn't hovered) and costs nothing extra to match.
- [x] 12. Create `docs/ADR/015_ADR_halo_semantics_legal_versus_selected.md` using plan contract; link ADR-007/009, no mapping duplication. — Evidence: file already exists at that path, committed by the doc ticket in `5eac0b5`, and its palette/precedence/zoom/layering contract matches the implementation verbatim (verified by reading it end-to-end). No edit needed.

## Outputs

- Files edited: `src/styles/app.css`, `src/app/components/duel-field/ZoneListEntryTile.svelte`, `tests/unit/global-styles.test.ts`, `tests/component/DuelField.test.ts`, `tests/component/ZoneListDialog.test.ts`, `e2e/duel-smoke.spec.ts`.
- Public component API: `ZoneListEntryTile.selected:boolean`.
- Files created by doc ticket/set: ADR-015 (listed in index).
- Migration / config/dependencies: none.

## Validation

- [x] `npm run test:unit -- global-styles` passes — Evidence: 17/17 tests pass.
- [x] `npm run test:component -- DuelField ZoneListDialog` passes — Evidence: 235/235 tests pass (both suites, full component run).
- [x] `npm run typecheck`, `npm run lint`, `npm run format:check` pass — Evidence: `svelte-check found 0 errors and 0 warnings`; `eslint .` clean; `prettier --check` — "All matched files use Prettier code style!".
- [x] `npm run build` succeeds — Evidence: `vite build --mode private` + `build:verify` both `"status": "ok"`.
- [x] full chromium e2e passes with pinned command from T5 — Evidence: `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers npx playwright test --project=chromium` → 25/25 passed (2.6m), including the full-duel keyboard walker.
- [ ] manual hover player hand, opponent hand, field card, list entry: exact zoom direction; halo follows; no clipping — not fully covered by e2e (e2e only measured player hand + list entry ratios, not opponent hand or a bare field/zone card); left for manual checklist.
- [x] manual chip hit test: every chip remains in front/clickable — Evidence: e2e T12 test's `document.elementFromPoint()` check on every visible chip centre resolves to the chip/a descendant, for every chip on the actionable card found.
- [ ] reduced-motion: no zoom, all static semantics intact — partially covered (e2e confirms hand-card bounds unchanged under `prefers-reduced-motion: reduce`), but "all static semantics intact" (halo colours under reduced motion) was not runtime-measured; left for manual checklist.
- [x] app functional — no broken path from this slice — Evidence: full chromium e2e suite green including the full preset-duel keyboard-only completion walker (25/25).
- [x] commit msg draft: `feat(field): align halo semantics and hover layering` — used verbatim as the commit message below.
