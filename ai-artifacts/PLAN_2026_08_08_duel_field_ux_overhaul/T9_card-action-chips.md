# T9: Hover action chips and orange halo

**Plan:** `./ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
**Depends:** T6
**Commit outcome:** `FieldActionMenu.svelte` is deleted; an actionable card wears an orange halo and reveals tiny fixed-size action chips floating above it on hover or focus, with no `Inspect` and no `Close actions` entries.

## Context (self-contained)

- Goal: turn the app from a panel stack into a field-first duel client. Feedback items 11 and 12.
- Today a click on an actionable card dispatches `openMenu`, and `DuelField.svelte` renders a fixed-position 18rem `FieldActionMenu` anchored with `getBoundingClientRect`, a `ResizeObserver`, and `window` resize/scroll listeners. The menu lists the engine's full labels (`Activate Mystical Space Typhoon`), plus `Inspect …` and `Close actions`.
- This slice: replace all of that with chips rendered inside the card, revealed by CSS on hover / focus-within / pinned state, labelled by the choice's `action` rather than its engine text.
- Out of scope here: drag and drop (T10), preview panel (T11). `CardInspector` stays reachable from the HUD trays until T11.
- Assumptions in force: A8 (orange halo covers actionable cards and zones), A9 (chips are intentionally smaller than the 44px pointer-target guidance; the card's own 44px target and the keyboard path stay intact), A14 (`Special Summon` and `Change Position` keep two words).

## Requirements

- Chip label comes from `choice.action`, never from `choice.label`. Full engine label stays as the chip's `title` and accessible name.
- No `Inspect` chip, no `Close actions` chip, and no `Inspect` button on the card.
- Chips are fixed size: `height: 1.15rem`, `min-width: 3.4rem`, `font-size: .55rem`.
- Chips float above the card, overlapping its top edge by `0.35rem` so moving the pointer from card to chip never crosses a hover gap.
- Chips are invisible until the card is hovered, contains focus, or is the pinned `session.menuTarget`.
- Only actionable cards get chips and only actionable cards get the halo.
- Halo colour is orange (`--warning`) for actionable cards and actionable zones; the selected state keeps its existing lime treatment.
- Keyboard: `Enter`/`Space` on the card target pins the chips and moves focus to the first chip; `ArrowLeft` / `ArrowRight` move between chips; `Escape` unpins and returns focus to the card target.
- Choosing a chip dispatches exactly one `{ type: "chooseChoice", choiceId, key: spec.key }` and unpins.

## Inputs

- Create: `src/app/presentation/card-action-label.ts`, `src/app/components/duel-field/CardActionChips.svelte`, `tests/unit/card-action-label.test.ts`, `tests/component/CardActionChips.test.ts`.
- Delete: `src/app/components/duel-field/FieldActionMenu.svelte`.
- Edit: `src/app/components/DuelField.svelte`, `src/app/components/duel-field/FieldBoard.svelte`, `src/app/components/duel-field/CardControl.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/app/App.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts`.
- **From Depends (T6):** `FieldActionBar.svelte` owns Confirm/Cancel/global choices and is gated by `fieldActionBarRequired(spec)`; `SelectionDock.svelte` is gone. `DuelField.svelte` already imports `FieldActionBar` and (from T7) `EndTurnButton`, and (from T8) `FieldStatusPills` / `LifePointsPill` with props `phase`, `hasPriority`, `lifePoints`.
- Read only: `src/app/prompts/interaction-session.ts` — keep using the existing `openMenu` / `closeMenu` actions and `session.menuTarget`; the reducer already refuses `openMenu` for targets absent from the spec and ignores repeat opens. `src/duel/contracts/player-prompt.ts` — the `ChoiceAction` union has exactly eighteen members.

## Exact API to create

```ts
// src/app/presentation/card-action-label.ts
import type { ChoiceAction } from "../../duel/contracts/player-prompt.ts";

export const CARD_ACTION_LABELS: Readonly<Record<ChoiceAction, string>> = Object.freeze({
  summon: "Summon",
  specialSummon: "Special Summon",
  flipSummon: "Flip",
  setMonster: "Set",
  setSpellTrap: "Set",
  activate: "Activate",
  changePosition: "Change Position",
  attack: "Attack",
  battlePhase: "Battle",
  mainPhase2: "Main 2",
  endPhase: "End turn",
  shuffle: "Shuffle",
  yes: "Yes",
  no: "No",
  pass: "Pass",
  cancel: "Cancel",
  finish: "Finish",
  select: "Select",
});

export function cardActionLabel(action: ChoiceAction): string;
```

```svelte
<!-- src/app/components/duel-field/CardActionChips.svelte -->
export let cardId: string;
export let cardLabel: string;
export let choices: readonly InteractionChoice[];
export let disabled = false;
export let onchoose: (choice: InteractionChoice) => void;
export let ondismiss: () => void;
```

New `CardControl.svelte` props:

```ts
export let choices: readonly InteractionChoice[] = [];
export let pinned = false;
export let onchoose: (choice: InteractionChoice) => void = () => undefined;
export let ondismiss: () => void = () => undefined;
```

`CardControl.svelte` loses: the `oninspect` prop and the `button.duel-field-card__inspect` element.

## data-cy contract added here

`` `card-action-chips-${cardId}` ``, `` `card-action-chip-${choiceId}` ``. Removed: `field-action-menu` and its children, the card inspect button.

## TDD

1. **Red** — write `tests/unit/card-action-label.test.ts` and `tests/component/CardActionChips.test.ts`, and rewrite the four menu-based cases in `tests/component/DuelField.test.ts`; record failures.
2. **Green** — add the label map and chips, rewire `CardControl` / `FieldBoard` / `DuelField`, delete the menu.
3. **Refactor** — delete every anchor helper the menu needed; `npm run lint` must report no unused symbols.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `every choice action has a label` | `CARD_ACTION_LABELS` | key set equals the `ChoiceAction` union, all eighteen |
| `labels stay short` | every value | each value has at most two words |
| `set actions collapse to one word` | `cardActionLabel("setMonster")`, `cardActionLabel("setSpellTrap")` | both `Set` |
| `activate collapses to one word` | `cardActionLabel("activate")` | `Activate` |
| `chips render one button per choice` | two choices | two `[data-cy^="card-action-chip-"]` buttons |
| `chip text is the action word` | choice `{ action: "activate", label: "Activate Mystical Space Typhoon" }` | chip text is `Activate`; `title` and `aria-label` contain the full label |
| `chips exclude inspect and close` | any | no button whose text matches `/inspect|close/i` |
| `chip click reports the choice` | click the first chip | `onchoose` called once with that choice |
| `arrow keys move between chips` | focus first chip, press `ArrowRight` | second chip is `document.activeElement` |
| `escape dismisses` | press `Escape` on a chip | `ondismiss` called once |
| `chips disabled while pending` | `disabled: true` | every chip is `disabled` |
| `actionable card shows chips markup` | render `DuelField` with a `cardAction` spec | `[data-cy^="card-action-chips-"]` exists inside the actionable card article |
| `non-actionable card has no chips` | same render | cards without choices have no chips element |
| `card click pins the chips` | click the card target | dispatched action is `{ type: "openMenu", target: card.targetId }` |
| `chip choice dispatches once` | click a chip | one `{ type: "chooseChoice", choiceId, key }`, no `openMenu` afterwards |
| `no inspect button on the field` | render `DuelField` with an actionable non-`cardAction` spec | no button whose name matches `/^Inspect /` |
| `no dialog menu remains` | any render | `container.querySelector('[role="menu"]')` is `null` |
| `halo is orange` | `src/styles/app.css` text | the `.duel-field-card.is-actionable .duel-field-card__art` rule uses `var(--warning)` and no `--accent` |

## Impl steps

- [ ] 1. Create `tests/unit/card-action-label.test.ts` with rows one to four; record the failure, then create `src/app/presentation/card-action-label.ts` and re-run to green.
- [ ] 2. Create `tests/component/CardActionChips.test.ts` (`// @vitest-environment jsdom`) with rows five to eleven; record failures.
- [ ] 3. Create `src/app/components/duel-field/CardActionChips.svelte`: root `div.card-action-chips[role="group"][data-cy={`card-action-chips-${cardId}`}][aria-label={`${cardLabel} actions`}]`, one `button.card-action-chip[type="button"][data-cy={`card-action-chip-${choice.id}`}][title={choice.label}][aria-label={choice.label}][tabindex="-1"]` per choice whose text is `cardActionLabel(choice.action)`.
- [ ] 4. In that component, handle `onkeydown`: `ArrowRight`/`ArrowDown` focus the next chip, `ArrowLeft`/`ArrowUp` the previous (both wrapping), `Home`/`End` jump to the ends, `Escape` calls `ondismiss()`. Each branch calls `event.preventDefault()`.
- [ ] 5. In `CardActionChips.svelte`, add `export function focusFirstChip(): void { chipsElement?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true }); }` where `chipsElement` is the root `bind:this` target. This codebase runs Svelte 5 in legacy mode (`export let` props, `$:` reactives, `afterUpdate`), so a component-level `export function` is reachable only through an instance binding — the caller must hold one.
- [ ] 6. In `src/styles/app.css`, add `.card-action-chips { position: absolute; z-index: var(--duel-field-layer-menu); bottom: calc(100% - .35rem); left: 50%; display: none; gap: .15rem; padding: .12rem; border-radius: .3rem; background: rgb(8 16 31 / .92); transform: translateX(-50%); }`.
- [ ] 7. In `src/styles/app.css`, add `.duel-field-card.is-actionable:hover .card-action-chips, .duel-field-card.is-actionable:focus-within .card-action-chips, .duel-field-card.is-pinned .card-action-chips { display: flex; }`.
- [ ] 8. In `src/styles/app.css`, add `button.card-action-chip { min-width: 3.4rem; min-height: 1.15rem; height: 1.15rem; padding: 0 .3rem; border-radius: .25rem; color: #2b1d00; background: var(--warning); font-size: .55rem; font-weight: 800; line-height: 1; white-space: nowrap; }` and `button.card-action-chip:hover:not(:disabled) { background: #ffc75c; }`.
- [ ] 9. In `src/styles/app.css`, change the actionable halo rule so `.duel-field-zone.is-actionable, .duel-field-card.is-actionable .duel-field-card__art { border-color: var(--warning); box-shadow: 0 0 0 2px rgb(255 213 128 / .55); }`. Leave the `.is-selected` and `.is-feedback-target` rules untouched.
- [ ] 10. In `src/styles/app.css`, delete the entire `.field-action-menu` rule.
- [ ] 11. In `src/app/components/duel-field/CardControl.svelte`, add the four new props, add `class:is-pinned={pinned}` to the article, delete the `oninspect` prop and the `button.duel-field-card__inspect` element, and render `{#if actionable && choices.length > 0}<CardActionChips cardId={card.id} cardLabel={accessibleLabel} {choices} {disabled} {onchoose} {ondismiss} />{/if}`.
- [ ] 12. In `src/styles/app.css`, delete the now-unused `.duel-field-card__inspect` rule.
- [ ] 13. In `src/app/components/duel-field/CardControl.svelte`, hold the chips instance with `let chips: CardActionChips | undefined;` and `bind:this={chips}` on the `<CardActionChips … />` element, then react to pinning with:

  ```ts
  let wasPinned = false;
  $: if (pinned !== wasPinned) {
    wasPinned = pinned;
    if (pinned) void tick().then(() => chips?.focusFirstChip());
  }
  ```

  Import `tick` from `svelte`. Guard on the transition, not on `pinned` alone, or focus is stolen on every unrelated re-render.
- [ ] 14. In `src/app/components/duel-field/FieldBoard.svelte`, drop the `oninspect` prop and pass `choices={spec?.cardChoices.get(card.targetId) ?? []}`, `pinned={pinnedTarget === card.targetId}`, `onchoose`, `ondismiss` through to `CardControl`. Add matching `export let pinnedTarget: BoardTargetId | null = null;`, `export let oncardchoose`, `export let oncarddismiss`.
- [ ] 15. In `src/app/components/DuelField.svelte`, delete the `FieldActionMenu` import, the `FieldMenuAnchor` interface, and the variables `anchorElement`, `anchor`, `resizeObserver`, `menuCard`, plus `menuVisible`, `menuChoices`, `updateAnchor()`, `observeAnchor()`, `clearMenuAnchor()`, `inspectMenuCard()` and the `{#if menuVisible …}` block.
- [ ] 16. In `src/app/components/DuelField.svelte`, delete the `window.addEventListener("resize", update)` and `window.addEventListener("scroll", update, true)` registrations and their removals in the `onMount` cleanup, and the `const update = …` line.
- [ ] 17. In `src/app/components/DuelField.svelte`, simplify `activateCard`: the `cardAction` branch now only dispatches `{ type: "openMenu", target: card.targetId }`; all other branches are unchanged.
- [ ] 18. In `src/app/components/DuelField.svelte`, pass `pinnedTarget={session.menuTarget}`, `oncardchoose={(choice) => { dispatch({ type: "chooseChoice", choiceId: choice.id }); }}` and `oncarddismiss={() => dispatch({ type: "closeMenu" })}` to `FieldBoard`, and delete the `oninspect` prop from `DuelField` entirely.
- [ ] 19. In `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, delete the `oninspect` prop and stop forwarding it.
- [ ] 20. In `src/app/App.svelte`, stop passing `oninspect` to `DuelFieldErrorBoundary` and delete the now-unused `inspectFieldCard()` function. Keep `inspectHudCard`, `inspectedCard` and `CardInspector` — the HUD still uses them until T11.
- [ ] 21. Delete `src/app/components/duel-field/FieldActionMenu.svelte`.
- [ ] 22. Rewrite these cases in `tests/component/DuelField.test.ts`: `focuses a command menu then returns focus on Escape`, `returns field focus before a command menu action removes its focused node`, `opens command menus on click, never pointerdown, and cancels moved pointers`, `updates anchored menu geometry on resize and scroll` (delete this one outright — there is no anchor any more). Replace them with the chip-based rows from the test plan; the pointer-move cancellation assertion must survive as "a moved pointer does not pin the chips".
- [ ] 23. Run `npx vitest run tests/component/DuelField.test.ts tests/component/CardActionChips.test.ts` to green.
- [ ] 24. Add the halo row to `tests/unit/global-styles.test.ts` and run it.
- [ ] 25. Run `npm run test:e2e`; update the keyboard-only duel test if it navigated the old `role="menu"` (chips are reached with `Enter` then arrows, and are `role="group"` not `role="menu"`).
- [ ] 26. Run `npx vitest run tests/unit/data-cy-coverage.test.ts` to green.

## Outputs

- Files created: `src/app/presentation/card-action-label.ts`, `src/app/components/duel-field/CardActionChips.svelte`, two test files.
- Files deleted: `src/app/components/duel-field/FieldActionMenu.svelte`.
- Files edited: `src/app/components/DuelField.svelte`, `src/app/components/duel-field/FieldBoard.svelte`, `src/app/components/duel-field/CardControl.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/app/App.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts`, `tests/unit/global-styles.test.ts`, `e2e/duel-smoke.spec.ts`.
- Public API: `cardActionLabel`, `CARD_ACTION_LABELS`; `CardControl` prop set changed; `DuelField` no longer takes `oninspect`.
- Migrate / config: none.

## Validation

- [ ] `npx vitest run tests/unit/card-action-label.test.ts tests/component/CardActionChips.test.ts tests/component/DuelField.test.ts` passes
- [ ] `npm run test:unit && npm run test:component` passes
- [ ] `npm run typecheck && npm run lint` passes
- [ ] `npm run format` then `npm run format:check` passes
- [ ] `npm run test:e2e` passes
- [ ] manual check: `npm run dev`, confirm playable cards glow orange while you hold priority, hovering one pops small `Activate` / `Set` / `Summon` chips above it, no `Inspect` or `Close actions` entries exist, and `Enter` then arrow keys reaches the same chips
- [ ] app functional — every idle-command and chain decision is still answerable
- [ ] commit msg draft: `feat(field): replace the action menu with hover chips`
