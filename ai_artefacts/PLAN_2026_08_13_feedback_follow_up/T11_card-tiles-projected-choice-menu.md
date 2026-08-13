# T11: Card tiles + projected choice menu

**Plan:** `./ai_artefacts/PLAN_2026_08_13_feedback_follow_up.md`
**Depends:** T10
**Commit outcome:** One 144px physical tile per card address has approved zoom/name/badge/actions; duplicate projected choices remain individually keyboard-answerable through one menu.

## Context (self-contained)

- Goal: Match approved physical-card presentation without dropping legal answers or fabricating `InteractionChoice`s.
- This slice: Tile visuals, browse actions + local Details, duplicate-choice menu. Target selection/max behavior remains old until T13.
- Out of scope here: collapse/dismiss split, exact-single change, ranges/hard max/stale validation.
- Assumptions: one address = one tile. 1 target choice activates/toggles directly. >1 opens menu; all opaque IDs survive. `Details` only previews card.

## Requirements

- Tile width 144px; image ratio 421/614; base gap 8px; top/body clearance supports 1.60 zoom.
- Name below image; opacity 0 while hover/focus/selected zoom. Selected checkmark. Full source badge outside art 5px above.
- First origin left 42%; last right 42%; middle center 42%.
- Legal green; selected/normal hover orange; unavailable red deferred T13.
- Browse click itself never selects/pins. Projected action menu only if choices exist; below art with −2 CSS px unscaled seam; min action height 34px.
- `Activate effect` label comes from projected action mapping. `Details` calls `onpreview`; emits no engine choice.
- Hidden identity: empty alt, no face lease, no identity text/menu label leak.
- `CardActionChips` field variant must remain byte-for-byte behavior/placement/focus compatible.

## Inputs

- `src/app/components/duel-field/ZoneListEntryTile.svelte`, `CardActionChips.svelte`, `ZoneListDialog.svelte`.
- `tests/component/ZoneListDialog.test.ts`, `CardActionChips.test.ts`; image-cache/lease fixtures.
- `docs/ADR/015_ADR_halo_semantics_legal_versus_selected.md`, `021_ADR_card_list_dialog_modes_and_selection.md`.
- `ai-artifacts/PROTOTYPE_SPEC_card-list-dialog.md` §§4.4–4.8,5.
- `ai_artefacts/manual_test_checklist.md` — append/update only T11 human checks; preserve all other sections.
- **From Depends:** browse shell owns ordering/first-last positions; `OffFieldTargetEntry.choices` groups multiple IDs/address; `src/app/acceptance/card-list-dialog-scenarios.ts` exports browse fixtures + resolver; dedicated acceptance config.

## Exact APIs

`CardActionChips.svelte` adds:

```ts
export let variant: "field" | "list" = "field";
export let ondetails: (() => void) | null = null;
```

Field default keeps current markup/tabindex/above placement.

Create `ProjectedChoiceMenu.svelte`:

```ts
export let entryId: string;
export let cardLabel: string;
export let zoneLabel: string;
export let choices: readonly InteractionChoice[];
export let selectedChoiceIds: readonly ChoiceId[];
export let disabledChoiceIds: ReadonlySet<ChoiceId>;
export let onchoose: (choice: InteractionChoice) => void;
export let ondismiss: () => void;
```

Menu: natural Tab entry, ArrowUp/Down, Home/End, Escape returns focus to tile trigger; each choice `aria-pressed`; no ID rewritten.

`ZoneListEntryTile` adds `first`, `last`, `ondetails`; target unavailable set may default empty for T13.

## TDD

1. **Red** — menu keyboard/ID tests; tile lease/privacy/visual semantics; Chromium dimensions/seam/edge interactions.
2. **Green** — component/menu + list-scoped CSS.
3. **Refactor** — keep field chip variant regression green; no fake Details choice.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `renders full source label above art and name below` | mixed visible target | exact full label/name structure |
| `keeps hidden identity private` | hidden entry | alt empty; no face lease/name leak |
| `renders one tile for duplicate choices` | 2 IDs same address | 1 tile; 2 menu buttons |
| `keeps every duplicate ChoiceId answerable` | choose second | callback exact second object/id |
| `supports menu keyboard and focus return` | keys/Escape | focus order/Home/End; trigger restored |
| `browse card never selects` | image/tile click | no pressed/checkmark/choice callback |
| `renders projected browse actions + Details` | legal action | action emits choice; Details only preview |
| `preserves field CardActionChips` | default variant | current placement/tabindex/focus tests unchanged |
| `matches tile geometry` | Chromium | width144±.5; gap8±.5; hover ratio1.60±.02; name opacity0 |
| `keeps action seam + edge menu clickable` | first/last | rendered gap −4..0px; inside usable dialog |

## Impl steps

- [x] 1. Add `ProjectedChoiceMenu.test.ts`; extend tile/chips component tests; prove red.
- [x] 2. Implement menu with focused trigger ref contract + unique dynamic `data-cy` per choice.
- [x] 3. Add narrow `variant/ondetails` to CardActionChips; retain default field output.
- [x] 4. Restructure ZoneListEntryTile: badge, art, checkmark, name, browse action area; preserve lease/fallback/privacy.
- [x] 5. For target 1 choice, keep direct target button. For >1, tile trigger opens ProjectedChoiceMenu; pass all IDs.
- [x] 6. Pass first/last from display order in ZoneListDialog; wire Details to existing preview callback only.
- [x] 7. Replace tile/list action CSS with exact dimensions/origins/zoom/seam; scope all list overrides.
- [x] 8. Add duplicate/action/edge acceptance scenarios + Chromium tests.

## Outputs

- Created: `ProjectedChoiceMenu.svelte` + component test.
- Modified: tile/dialog/chips/styles/tests/acceptance.
- Public APIs exactly above.
- No Worker/validator/persistence changes.

## Validation

- [x] `npx vitest run tests/component/ProjectedChoiceMenu.test.ts tests/component/CardActionChips.test.ts tests/component/ZoneListDialog.test.ts` → exit 0.
- [x] `npm run typecheck && npm run lint` → exit 0.
- [x] `npx playwright test --config=playwright.acceptance.config.ts --project=chromium e2e-acceptance/card-list-dialog.spec.ts --grep "tile|action|choice menu|zoom"` → exit 0.
- [ ] manual keyboard check — duplicate menu reaches every choice, Escape returns focus, Details emits no response.
- [x] app functional — `npm run build` exits 0; existing field action-chip smoke green.
- [x] commit msg draft: `feat(card-list): render physical cards and projected choice menu` (`a1a356f7da3799f25887dd675828f7eff7d93707`)
