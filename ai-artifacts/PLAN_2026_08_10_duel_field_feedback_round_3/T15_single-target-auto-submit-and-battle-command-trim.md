# T15: Single-target auto-submit and battle-command trim

**Plan:** `./ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
**Depends:** T10
**Commit outcome:** Any exact-one target selection submits on click with no confirm step; battle decisions use card/phase controls only and never open a duplicate dialog/action bar for phase transitions.

## Context (self-contained)

- Goal: ship all 30 items of `feedback.md`.
- Covers items 10 and 11; unblocks item 29/T16.
- Current card selection always dispatches `toggleChoice`; `fieldActionBarRequired` always shows confirmation for `cardSelection`. Current `promptSurface` can route a phase-only `battleCommand` to generic dialog because it has no mounted target. FieldActionBar filters only `endPhase`, so it duplicates Main 2.
- Out of scope: changing prompt constraints/engine encoder; auto-resolving no-choice prompts; off-field target list content (T16); phase strip geometry (T10).
- Assumption **A12** is broader than the item wording: **any target prompt** with `minimum===1 && maximum===1` submits immediately. Multi-select still toggles and confirms. Card actions already direct; place prompts already mostly direct and are normalised here.

## Requirements

- Pure helper recognises exact singleton by constraints, not prompt title/kind/card count.
- Clicking a legal mounted card or zone in an exact 1/1 selection dispatches `chooseChoice` once. It does not mutate local selected state or render Confirm.
- Attack-target `selectCard` follows same path as effect-target `selectCard`/`selectTribute`.
- 0/1, 1/2, 2/2, counter and order prompts keep current draft/confirm behaviour.
- Phase-transition actions are exactly `battlePhase`, `mainPhase2`, `endPhase` and are owned by T10 `PhaseStrip`/End button. FieldActionBar never renders/counts them.
- `battleCommand` uses `PromptSurface="field"` whenever field is rendered, even if its only choices are Main2/End; no `PromptDialog`.
- Battle attack card actions stay card chips; Main2/End stay phase strip. No second battle-command decision surface.
- Workspace mode remains an explicit diagnostic override and routes prompt to docked controls.
- Existing response validation/pending guard ensures double click cannot post twice.

## Inputs

- `src/app/components/DuelField.svelte:282-305` — `activateCard`; cardSelection toggles. `:307-314` — place zone direct when max=1. `:124-134` / `:520-530` — action-bar visibility.
- `src/app/prompts/interaction-spec.ts:177-194` — `nonEndPhaseGlobalChoiceCount`, `fieldActionBarRequired`; `:196-204` — end choice.
- `src/app/prompts/prompt-surface.ts:12-17` — chain special-case then `fieldCapable`; phase-only battle falls through to dialog.
- `src/app/components/duel-field/FieldActionBar.svelte:34-36` — filters only endPhase; `:220-248` — Confirm condition.
- `src/app/prompts/interaction-session.ts` — `chooseChoice`, `toggleChoice`, `confirm` already encode correct command; do not add a bypass.
- `tests/unit/interaction-spec.test.ts`, `tests/unit/prompt-surface.test.ts`, `tests/component/DuelField.test.ts`, `tests/component/FieldActionBar.test.ts`, `tests/component/PhaseStrip.test.ts`.
- **From Depends (T10):** there is no end chip; selectors are `field-phase-chip-main2` and `field-end-turn-button`.
- T15 lands before T14: hide current `FieldActionBar` for exact singleton. T14 later wraps that same bar; it must preserve this visibility predicate so no empty floating confirm window appears.

## API design

In `interaction-spec.ts`:

```ts
const PHASE_TRANSITION_ACTIONS = new Set<ChoiceAction>([
  "battlePhase",
  "mainPhase2",
  "endPhase",
]);

export function isPhaseTransitionChoice(
  choice: Pick<InteractionChoice, "action">,
): boolean;

export function isImmediateSingleSelection(
  spec: ActiveInteractionSpec,
): boolean {
  return spec.constraints.minimum === 1 && spec.constraints.maximum === 1;
}
```

Do not require `spec.kind === "cardSelection"`; callers apply it only where choosing one mapped target is semantically valid.

Replace `nonEndPhaseGlobalChoiceCount` with `nonPhaseGlobalChoiceCount` filtering all three actions.

`fieldActionBarRequired(spec)`:

- `nonField` false;
- `cardAction` true only if non-phase global choice exists;
- `cardSelection` false when exact singleton and no non-phase global; otherwise true;
- `placeSelection` same;
- `counterAllocation` / `order` true;
- any non-phase global makes true.

## TDD

1. **Red** — helper/action-bar/surface unit matrix, then click component tests.
2. **Green** — helper + two branches/filter.
3. **Refactor** — one shared phase-choice predicate used by spec and bar.

## Test plan

Extend `tests/unit/interaction-spec.test.ts`:

- exact 1/1 true; 0/1,1/2,2/2 false;
- all three transition actions true; attack/select/pass false;
- singleton card/place with only phase globals requires no bar;
- multi card/place requires bar;
- cardAction with only phase globals no bar; genuine `pass`/other global requires bar;
- counter/order remain true.

Extend `tests/unit/prompt-surface.test.ts`:

- phase-only battle + rendered field → field;
- battle with attacks → field;
- battle + field unavailable → dialog;
- battle + workspace → docked;
- unrelated nonfield prompt unchanged.

Extend `tests/component/DuelField.test.ts`:

- attack-target selectCard 1/1 click emits `{type:"chooseChoice",choiceId,key}`, no `.is-selected`, no confirm window;
- effect target 1/1 same;
- place target min=max1 same (tighten old max-only expectation);
- card selection 1/2 toggles, confirm window visible;
- 2/2/multi selection retains counter/validation/Confirm;
- double click while pending dispatches once;
- battleCommand with attack + main2/end: card chip and phase controls exist; `field-action-bar`/PromptDialog absent.

Extend `FieldActionBar.test.ts`: phase transitions never render in global choice group; non-phase global does; exact singleton does not render Confirm if component is directly mounted defensively.

Extend `PhaseStrip.test.ts`: battle Main2/End choices dispatch through existing controls.

E2E walker:

- for `battleCommand`, click attack card chip when desired; to advance click enabled Main2 else End button; assert no prompt dialog/action bar phase duplicate;
- when active prompt has min=max1 and a legal target, one click causes prompt id to change/response pending; never search Confirm;
- deterministic component/browser fixture covers attack target if random deck path does not.

## Impl steps

- [ ] 1. Add unit matrices red.
- [ ] 2. Add `isPhaseTransitionChoice`, `isImmediateSingleSelection`; replace global counter/filter and `fieldActionBarRequired` as specified.
- [ ] 3. In FieldActionBar use shared predicate to filter all phase transitions. Hide Confirm defensively for immediate singleton.
- [ ] 4. In `DuelField.activateCard`, when `spec.kind==="cardSelection" && isImmediateSingleSelection(spec)`, dispatch choose; else toggle. Do not apply helper to counter/order.
- [ ] 5. In `activateZone`, require exact singleton for direct choose; multi toggles. Existing place/card target mapping remains.
- [ ] 6. In `promptSurface`, after workspace/chain add battle special-case: return field when `fieldRendered`, dialog otherwise.
- [ ] 7. Ensure actionBarVisible false leaves no T14 confirm window mounted.
- [ ] 8. Update tests/e2e selectors for T10 End button and run full gates.

## Outputs

- Files edited: `src/app/prompts/interaction-spec.ts`, `prompt-surface.ts`, `src/app/components/DuelField.svelte`, `src/app/components/duel-field/FieldActionBar.svelte`, focused unit/component/e2e tests.
- Public helpers: `isImmediateSingleSelection`, `isPhaseTransitionChoice`.
- Worker/protocol/config: unchanged.

## Validation

- [ ] `npm run test:unit -- interaction-spec prompt-surface` passes
- [ ] `npm run test:component -- DuelField FieldActionBar PhaseStrip` passes
- [ ] `npm run typecheck`, `npm run lint`, `npm run format:check` pass
- [ ] `npm run build` succeeds
- [ ] full chromium e2e passes with pinned command from T5
- [ ] manual: declare attack, click target once, engine advances without confirm
- [ ] manual: battle phase uses chips/Main2/End only, no dialog/bar duplicate
- [ ] app functional — multi-select/cancel/validation unchanged
- [ ] commit msg draft: `feat(field): submit singleton targets immediately`
