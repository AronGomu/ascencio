# T7: End turn corner button

**Plan:** `./ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
**Depends:** T6
**Commit outcome:** A persistent orange End turn button sits at the bottom-right of the duel field, enabled only when the engine currently offers an `endPhase` choice, and the action bar no longer duplicates it.

## Context (self-contained)

- Goal: turn the app from a panel stack into a field-first duel client. Feedback item 10.
- This slice: one small component, one CSS button variant, and one filter change in the action bar.
- Engine truth: `endPhase` exists only in `SELECT_IDLE_COMMAND` (labelled `End turn`, emitted when `message.to_ep`) and `SELECT_BATTLE_COMMAND` (labelled `End Battle Phase`, emitted when `message.to_ep`). Both arrive as `spec.globalChoices` entries with `action === "endPhase"`. Every other prompt has none.
- Out of scope here: pills (T8), chips (T9), drag (T10), preview (T11).
- Assumptions in force: A14 (`End turn` keeps two words).

## Requirements

- Button is always mounted inside `section.duel-field`, bottom-right corner, above cards but below dialogs.
- Enabled only when a `endPhase` choice exists in the current spec and no response is pending.
- Label is the engine's own choice label (`End turn` in Main Phase, `End Battle Phase` in Battle Phase); with no choice available it reads `End turn` and is disabled.
- Colour is warning orange, distinct from the accent primary and the danger red.
- Clicking dispatches exactly one `{ type: "chooseChoice", choiceId, key: spec.key }`; a second click while pending does nothing.
- `FieldActionBar` no longer renders an `endPhase` button, and does not render at all when `endPhase` was its only reason to exist.
- Disabled state stays announceable: the button keeps its accessible name and gets `aria-disabled` semantics through the native `disabled` attribute.

## Inputs

- Create: `src/app/components/duel-field/EndTurnButton.svelte`, `tests/component/EndTurnButton.test.ts`.
- Edit: `src/app/components/DuelField.svelte`, `src/app/components/duel-field/FieldActionBar.svelte`, `src/app/prompts/interaction-spec.ts`, `src/styles/app.css`, `tests/unit/interaction-spec.test.ts`, `tests/component/DuelField.test.ts`.
- **From Depends (T6):** `src/app/components/duel-field/FieldActionBar.svelte` exists with props `prompt`, `spec`, `session`, `disabled`, `confirmValid`, `validationMessage`, `oninteraction`, renders one button per `spec.globalChoices` value with `` data-cy={`field-action-bar-choice-${choice.id}`} ``, and is gated in `DuelField.svelte` by `{#if prompt && spec && spec.fieldCapable && fieldActionBarRequired(spec)}`. `fieldActionBarRequired(spec: ActiveInteractionSpec): boolean` lives at the bottom of `src/app/prompts/interaction-spec.ts` and currently returns `true` when `spec.globalChoices.size > 0`. `SelectionDock.svelte` no longer exists.
- Read only: `src/app/prompts/interaction-spec.ts` (`InteractionChoice { id, label, action }`, `ActiveInteractionSpec.key`), `src/app/prompts/interaction-session.ts` (`InteractionSessionAction`).

## Exact API to create

```svelte
<!-- src/app/components/duel-field/EndTurnButton.svelte -->
export let spec: ActiveInteractionSpec | null = null;
export let disabled = false;
export let oninteraction: (action: InteractionSessionAction) => unknown;
```

Add to `src/app/prompts/interaction-spec.ts`:

```ts
export function endPhaseChoice(
  spec: ActiveInteractionSpec | null,
): InteractionChoice | null;
```

Returns the first `spec.globalChoices` value whose `action === "endPhase"`, else `null`.

## data-cy contract added here

`field-end-turn-button`.

## TDD

1. **Red** — add `endPhaseChoice` rows to `tests/unit/interaction-spec.test.ts` and create `tests/component/EndTurnButton.test.ts`; record failures.
2. **Green** — add the helper, the component, the CSS, the bar filter.
3. **Refactor** — none.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `endPhaseChoice finds the choice` | spec with global choices `battlePhase` and `endPhase` | returns the `endPhase` choice |
| `endPhaseChoice returns null without one` | spec with only `battlePhase` | `null` |
| `endPhaseChoice tolerates a null spec` | `null` | `null` |
| `bar not required when endPhase is the only global choice` | `cardAction` spec whose sole global choice is `endPhase` | `fieldActionBarRequired` is `false` |
| `bar still required with another global choice` | `cardAction` spec with `endPhase` and `battlePhase` | `true` |
| `button reads the engine label` | spec with `endPhase` labelled `End Battle Phase` | `[data-cy="field-end-turn-button"]` text is `End Battle Phase` |
| `button falls back to End turn` | `spec: null` | text is `End turn`, `disabled` is `true` |
| `button disabled without an endPhase choice` | spec with only `battlePhase` | `disabled` is `true` |
| `button disabled while pending` | valid spec, `disabled: true` | `disabled` is `true` |
| `click dispatches once` | valid spec, click twice with `disabled` flipped to `true` after the first | `oninteraction` called exactly once with `{ type: "chooseChoice", choiceId, key: spec.key }` |
| `button carries the warning class` | valid spec | element `classList` contains `warning` |
| `bar hides the endPhase choice` | render `FieldActionBar` with `endPhase` and `battlePhase` global choices | `[data-cy^="field-action-bar-choice-"]` count is 1 and it is the `battlePhase` one |
| `field mounts the corner button` | render `DuelField` with any board | `[data-cy="duel-field"] [data-cy="field-end-turn-button"]` matches |

## Impl steps

- [ ] 1. Add the first five rows to `tests/unit/interaction-spec.test.ts`; run `npx vitest run tests/unit/interaction-spec.test.ts` and record failures.
- [ ] 2. Add `endPhaseChoice` to `src/app/prompts/interaction-spec.ts`.
- [ ] 3. Change `fieldActionBarRequired` so the global-choice test ignores `endPhase`: count `[...spec.globalChoices.values()].filter((choice) => choice.action !== "endPhase").length > 0`. Keep the four list kinds returning `true` unconditionally.
- [ ] 4. Re-run `npx vitest run tests/unit/interaction-spec.test.ts` to green.
- [ ] 5. Create `tests/component/EndTurnButton.test.ts` (`// @vitest-environment jsdom`) with rows six to eleven; record failures.
- [ ] 6. Create `src/app/components/duel-field/EndTurnButton.svelte`: compute `$: choice = endPhaseChoice(spec);` and render a single `<button type="button" class="warning field-end-turn" data-cy="field-end-turn-button" disabled={disabled || choice === null || spec === null} onclick={…}>{choice?.label ?? "End turn"}</button>`.
- [ ] 7. In that component, the click handler calls `oninteraction({ type: "chooseChoice", choiceId: choice.id, key: spec.key })` and returns early when `choice === null || spec === null`.
- [ ] 8. In `src/styles/app.css`, add `button.warning { color: #2b1d00; border-color: transparent; background: var(--warning); }` and `button.warning:hover:not(:disabled) { background: #ffc75c; }` right after the `button.danger` rule.
- [ ] 9. In `src/styles/app.css`, add `.field-end-turn { position: absolute; z-index: var(--duel-field-layer-control); right: .75rem; bottom: .75rem; min-height: 2.75rem; padding: .55rem 1rem; }`.
- [ ] 10. In `src/app/components/duel-field/FieldActionBar.svelte`, filter the global-choice loop to `[...spec.globalChoices.values()].filter((choice) => choice.action !== "endPhase")`.
- [ ] 11. In `src/app/components/DuelField.svelte`, import `EndTurnButton` and render `<EndTurnButton {spec} disabled={pending} {oninteraction} />` as the last child of `section.duel-field`, after the action bar.
- [ ] 12. Confirm the bar and the corner button do not overlap: the bar is `left: 50%` with `max-width: min(52rem, calc(100% - 2rem))`, the button is `right: .75rem`. If they collide at narrow widths, add `@container duel-field (max-width: 40rem) { .field-action-bar { bottom: 4rem; } }` and nothing else.
- [ ] 13. Run `npx vitest run tests/component/EndTurnButton.test.ts tests/component/FieldActionBar.test.ts` to green.
- [ ] 14. Add the last two test-plan rows to `tests/component/DuelField.test.ts` and run it.
- [ ] 15. Run `npm run test:e2e`. The existing `field.getByRole("button", { name: "End turn", exact: true })` lookups keep working because the button lives inside the field; fix any test that assumed the label came from the action bar.
- [ ] 16. Run `npx vitest run tests/unit/data-cy-coverage.test.ts` to green.

## Outputs

- Files created: `src/app/components/duel-field/EndTurnButton.svelte`, `tests/component/EndTurnButton.test.ts`.
- Files edited: `src/app/prompts/interaction-spec.ts`, `src/app/components/DuelField.svelte`, `src/app/components/duel-field/FieldActionBar.svelte`, `src/styles/app.css`, `tests/unit/interaction-spec.test.ts`, `tests/component/DuelField.test.ts`.
- Public API: `endPhaseChoice(spec)`.
- Migrate / config: none.

## Validation

- [ ] `npx vitest run tests/unit/interaction-spec.test.ts tests/component/EndTurnButton.test.ts` passes
- [ ] `npm run test:unit && npm run test:component` passes
- [ ] `npm run typecheck && npm run lint` passes
- [ ] `npm run format` then `npm run format:check` passes
- [ ] `npm run test:e2e` passes
- [ ] manual check: `npm run dev`, confirm the orange End turn button sits in the field's bottom-right, is disabled during the opponent's turn, reads `End Battle Phase` inside the Battle Phase, and ends the turn on one click
- [ ] app functional — turns can still be ended, action bar still handles everything else
- [ ] commit msg draft: `feat(field): add a persistent end turn control to the field corner`
