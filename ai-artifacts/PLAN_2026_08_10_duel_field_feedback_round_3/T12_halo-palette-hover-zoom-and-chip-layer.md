# T12: Halo palette, hover zoom and chip layering

**Plan:** `./ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
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

- **From Depends (T8):** `CardControl` has `layout="field|hand"` / `.is-hand-item`; hands are scroll viewports.
- **From Depends (T5):** passive `.duel-field-card` pointer hit-testing is already restored.
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

- [ ] 1. Rewrite/add global-style tests above. Run `npm run test:unit -- global-styles` red.
- [ ] 2. Add `selected` prop/class to `ZoneListEntryTile.svelte`; add component tests.
- [ ] 3. Replace actionable orange declarations for zone/card/stack/list with success green. Replace selected lime with warning orange. Add selected list rule after actionable.
- [ ] 4. Replace drop candidate with success border/shadow + green alpha fill. Keep class presentation-only.
- [ ] 5. Replace focus colour with neutral high-contrast. Keep 3 px outline and ≥2 px offset.
- [ ] 6. Replace feedback target/default line/generic feedback border with accent; preserve attack/LP danger branches.
- [ ] 7. Add base root transition and hover/focus transform. For absolute field card compose `translate(-50%,-50%) scale(1.35)`; for T8 normal-flow hand item use `scale(1.35)` only. Set origins exactly.
- [ ] 8. Add list transform/transition plus safe row padding/scroll margin. Ensure T9 `50svh` image cap remains.
- [ ] 9. Add reduced-motion overrides covering card root/list entry, not art rotation; opponent/sideways art must remain oriented even when zoom disabled.
- [ ] 10. Raise `.duel-field-card:is(:hover,:focus-within), .duel-field-card.is-pinned` above normal siblings. Keep chips at menu layer. Do not remove board isolation unless browser hit testing proves parent raise cannot solve it.
- [ ] 11. Add e2e zoom/layer/reduced-motion assertions and run chromium. If transformed cards clip at board edge, tune transform origin/scroll padding, never reduce scale.
- [ ] 12. Create `docs/ADR/015_ADR_halo_semantics_legal_versus_selected.md` using plan contract; link ADR-007/009, no mapping duplication.

## Outputs

- Files edited: `src/styles/app.css`, `src/app/components/duel-field/ZoneListEntryTile.svelte`, `tests/unit/global-styles.test.ts`, `tests/component/DuelField.test.ts`, `tests/component/ZoneListDialog.test.ts`, `e2e/duel-smoke.spec.ts`.
- Public component API: `ZoneListEntryTile.selected:boolean`.
- Files created by doc ticket/set: ADR-015 (listed in index).
- Migration / config/dependencies: none.

## Validation

- [ ] `npm run test:unit -- global-styles` passes
- [ ] `npm run test:component -- DuelField ZoneListDialog` passes
- [ ] `npm run typecheck`, `npm run lint`, `npm run format:check` pass
- [ ] `npm run build` succeeds
- [ ] full chromium e2e passes with pinned command from T5
- [ ] manual hover player hand, opponent hand, field card, list entry: exact zoom direction; halo follows; no clipping
- [ ] manual chip hit test: every chip remains in front/clickable
- [ ] reduced-motion: no zoom, all static semantics intact
- [ ] app functional — no broken path from this slice
- [ ] commit msg draft: `feat(field): align halo semantics and hover layering`
