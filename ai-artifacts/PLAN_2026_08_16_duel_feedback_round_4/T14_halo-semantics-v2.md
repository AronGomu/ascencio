# T14: Halo semantics v2

**Plan:** `./ai-artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`
**Depends:** T12
**Commit outcome:** One halo language everywhere: green = actionable/targetable, orange = selected, red = invalid target (list entries + field cards on hover during targeting); neutral cards show no halo on hover.

## Context (self-contained)

- Goal: duel feedback round 4 — YGO story duel simulator (Svelte 5). Halo feedback: "Green = all effects that can trigger or card that can be targeted. Orange = selected. Red = not valid target (hovering/selecting in a zone that also shows invalid cards)." List Dialog feedback #3: "Hovering cards with nothing to interact — no halo. Neutral cards do not have halo."
- Field board is ALREADY green(legal)/orange(selected) — ADR-015. The list dialog violates the language: `.zone-list-entry:hover img` forces orange on every hover (even neutral browse entries), and `.is-unavailable` entries render grayscale/muted instead of red.
- Decision (ADR-031 `docs/ADR/031_ADR_halo_color_semantics_v2.md`, confirmed by grill — `ai-artifacts/GRILL_2026_08_16_duel_feedback_round_4/ANSWERS.md` round 1 Q10): list dialog aligns to field: actionable entry hover/focus = green ring; selected = orange (persisted class, unchanged); unavailable (over-maximum or hard-locked) = red ring; neutral (zero choices) = no ring ever. PLUS field cards: while a card-targeting prompt is active, hovering ANY non-candidate field card shows a red ring — hover-only, never persistent, green/orange field rules untouched.
- Predecessor T12 removed `.zone-list-entry.is-opponent > img` rotation from the same CSS region — apply this ticket on top to avoid merge noise.
- Out of scope here: token value changes (`--legal`, `--selected`, `--danger` exist in `src/styles/tokens.css` — reuse), drop-candidate drag halos, keyboard focus ring (`is-navigation-active` neutral high-contrast stays).
- Assumptions in force: `--danger` token exists (used by `.field-lines.is-attack`); verify with `grep -n "\-\-danger" src/styles/tokens.css`, else use `var(--warning)`-adjacent red token found there.

## Requirements

CSS region `src/styles/app.css` ~lines 1487–1560 (`.zone-list-entry…`) + field-card halo region (~lines 1131–1250):

- Neutral: base `.zone-list-entry:is(:hover, :focus-within)` rules stop applying any border/box-shadow — scope every hover/focus halo rule with `.is-actionable` or `.is-target`.
- Actionable hover/focus (not selected, not unavailable): green — `border-color: var(--success); box-shadow: 0 0 0 3px color-mix(in srgb, var(--legal) 78%, transparent);` replacing today's orange hover (`.zone-list-entry:hover img` rule ~1503–1509).
- Selected: keep existing orange (`.zone-list-entry.is-selected img` rule) — must still win over hover green (source order or specificity; keep the existing "Unavailable exceeds hover/focus specificity" pattern).
- Unavailable: `.zone-list-entry.is-unavailable:not(.is-selected) img` (and its `:hover`/`:focus-within` variants ~1511–1520) switch from grayscale/muted to red ring: `border-color: var(--danger); box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 65%, transparent);` (keep any `cursor`/opacity treatment).
- `is-hover-suppressed` behavior unchanged.
- Field invalid hover: `DuelField.svelte` root `<section class="duel-field">` gains `data-targeting={spec !== null && spec.kind === "cardSelection" ? "true" : undefined}`. CSS: `.duel-field[data-targeting="true"] .duel-field-card:not(.is-actionable):hover .duel-field-card__art { border-color: var(--danger); box-shadow: 0 0 0 2px color-mix(in srgb, var(--danger) 60%, transparent); }`. Hover pseudo-class only — no persisted class. Zoom/label gating (T6) unaffected.

## Inputs

- `src/styles/app.css` list-entry halo rules (grep `zone-list-entry` in file).
- `src/styles/tokens.css` — `--success`, `--legal`, `--warning`, `--selected`, `--danger`.
- `src/battle/app/components/duel-field/ZoneListEntryTile.svelte` — classes: `is-actionable` (choices.length > 0), `is-target`, `is-selected`, `is-unavailable`, `is-hover-suppressed` (no markup change expected).
- Acceptance: `e2e-acceptance/card-list-dialog.spec.ts` + scenarios `card-list-multiple` / `card-list-range` (have min/max → unavailable state reachable by selecting up to maximum), `card-list-browse-six` (neutral browse entries).
- ADR to write/update: `docs/ADR/031_ADR_halo_color_semantics_v2.md` (plan wrote it; verify matches impl). ADR-015 stays as history; 031 supersedes the list-hover clause only.

## TDD

1. **Red** — `e2e-acceptance/card-list-dialog.spec.ts` new tests (pattern: existing `toHaveCSS("border-top-color", …)` assertions in `e2e-acceptance/full-height-field.spec.ts`):
   - test name: `a neutral browse entry shows no halo on hover` — scenario `card-list-browse-six` entry without choices; hover → `box-shadow` computed `none` (assert via `evaluate(getComputedStyle)` since toHaveCSS needs exact string).
   - test name: `an actionable entry halos green on hover` — scenario `card-list-single` (or nearest with choices); hover → border-color equals computed `--success` RGB (resolve token via `page.evaluate`).
   - test name: `an over-maximum entry halos red` — scenario `card-list-range`: select up to maximum, hover an unselected entry → border-color equals `--danger` RGB.
   - test name: `a selected entry stays orange` — select one → border-color equals `--warning` RGB even while hovered.
   - Field-side red: component `tests/component/DuelField.test.ts` — test name: `the field flags an active targeting prompt` — mount with a cardSelection spec → `[data-cy="duel-field"]` has `data-targeting="true"`; with a cardAction spec or no spec → attribute absent. Acceptance (if a field scenario with a cardSelection spec exists or is cheap to add): hover a non-candidate card → art border-color equals `--danger` RGB.
2. **Green** — CSS edits per Requirements.
3. **Refactor** — none.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| neutral browse entry no halo on hover | browse scenario hover | no box-shadow/border tint |
| actionable entry hover green | selectable scenario hover | `--success` border, `--legal` glow |
| over-maximum entry red | range scenario, max selected, hover other | `--danger` ring |
| selected entry stays orange | select + hover | `--warning` ring |
| field flags targeting prompt | cardSelection spec mounted | `data-targeting="true"` on field root |
| non-candidate field card red on hover | targeting active, hover neutral card | `--danger` art ring, gone off-hover |

## Impl steps

- [ ] 1. Write the four acceptance tests; `npx playwright test -c playwright.acceptance.config.ts e2e-acceptance/card-list-dialog.spec.ts`; confirm red set (neutral + red cases fail today; selected/green may partially pass — keep as guards).
- [ ] 2. Rework the CSS region per Requirements (scope hover rules, green hover, red unavailable).
- [ ] 2b. `DuelField.svelte`: add the `data-targeting` attribute; component test green; add the field red-hover CSS rule.
- [ ] 3. Re-run acceptance spec → green. Also `npx playwright test -c playwright.acceptance.config.ts` full run (other specs may assert old orange hover — update them).
- [ ] 4. `npm run format:check && npm run lint && npm run test:component` (component suites asserting classes, not colors, should stay green).
- [ ] 5. Verify `docs/ADR/031_ADR_halo_color_semantics_v2.md` matches final rules; adjust if impl deviated.
- [ ] 6. Manual check: dev duel — browse GY (neutral: no halo), activation candidates on field (green), select target (orange), over-max in multi-select list (red), targeting prompt live: hover a non-candidate field monster → red ring, leaves with the pointer.

## Outputs

- Files touched: `src/styles/app.css`, `src/battle/app/components/DuelField.svelte`, `tests/component/DuelField.test.ts`, `e2e-acceptance/card-list-dialog.spec.ts`, possibly other acceptance specs, `docs/ADR/031_ADR_halo_color_semantics_v2.md`.
- Behavior: visual language unified; one new presentation attribute (`data-targeting`) on the field root.
- Migrate/config: none.

## Validation

- [ ] tests pass: `npx playwright test -c playwright.acceptance.config.ts`
- [ ] manual check: 4-state halo matrix
- [ ] app functional — no broken path from this slice
- [ ] commit msg draft: `feat(field): unify halo semantics — green legal, orange selected, red invalid, neutral bare`
