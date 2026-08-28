# T6: Selection prompts: dashed green candidates, orange selected, no green fill / select button (item 5)

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`
**Depends:** T2, T4
**Commit outcome:** Valid targets dashed green border; click toggles dashed orange; green art-fill + select chip gone for selection prompts

## Context (self-contained)

- Goal: implement the 2026-08-27 owner feedback round on the duel field / right pane. This ticket is item 5, owner wording (binding): "When I'm selecting cards to summon an XYZ or any other monster from the extra deck, I see a green card appear when I hover over the monster on the field. Remove that, and also remove the select button. Instead, add a dashed border around all the valid targets, and when you click on one of those targets for the effects, change the dashed border from green to orange to show that it's selected."
- This slice: restyles field-card selection candidates (dashed green, no glow/fill), selected candidates (dashed orange), and suppresses the card-mounted Select chip for selection-family prompts. `cardAction` prompts (idle/battle/chain) keep today's green ring + chips exactly as they are.
- Out of scope here: status panel (T7), pile/stack halo (T8), zone styling, hover-scale removal (T1 does that separately — do not depend on it, and do not add any new hover effect), `ZoneListDialog` / target-list chips (T16 off-field answering surface — its Select chips stay), hand-zoom overlay styling, `feedback.md` (never edit). No engine, worker, or contract changes.
- Assumptions in force:
  - T2 is merged: `CardActionChips` is card-mounted and bottom-anchored; its API (`choices`, `layout`, `dataCyScope`) and class names (`card-action-chips`, `card-action-chip`) are unchanged. This ticket only gates *whether* `CardControl` renders it.
  - Red-team finding (binding): styling `.is-actionable` alone would leak the dashed look onto idle activation prompts, because `cardChoices` is populated for BOTH `cardAction` and `cardSelection` families (`src/battle/app/prompts/interaction-spec.ts:129-152`). The new look must key off the interaction kind, not off actionability.
  - Red-team finding (binding): the invisible full-cover `duel-field-card__target` button is the sole click/keyboard toggle surface and the `aria-pressed` carrier. It STAYS. "Remove the select button" means the Select CHIP only.

## Requirements

- Given a `cardSelection`-family prompt (`selectCard`, `selectTribute`, `selectSum`, `selectUnselectCard` — the four kinds mapped to `"cardSelection"` in `INTERACTION_SPEC_KINDS`, `src/battle/app/prompts/interaction-spec.ts:129-152`), When a field card is a valid target, Then its card root carries class `is-selection-candidate` and its art wears a dashed green border with NO box-shadow glow and NO fill.
- Given a selection candidate, When the player clicks (or keyboard-activates) it and the prompt is not immediate-single, Then the existing toggle flow marks it `.is-selected` and the dashed border turns orange; a second activation toggles it back to dashed green.
- Given a `cardSelection`-family prompt, When a candidate card renders, Then no `CardActionChips` element is mounted on it (no Select chip on hover, focus, or pin).
- Given a `cardAction`-family prompt (`idleCommand`, `battleCommand`, `chain`), When a card is actionable, Then nothing changes: solid green ring + glow (`.is-actionable` rule), chips mounted and revealed on hover/focus/pin as today.
- Given `counterAllocation` prompts, Then they also keep today's look (they are not `cardSelection`).
- Given any candidate, When hovered, Then no new scale/glow/hover effect is introduced by this ticket's rules — the only visual states are dashed-green and dashed-orange.
- The invisible `duel-field-card__target` button remains rendered for every actionable card, keeps `aria-pressed` for `cardSelection`, and remains the activation surface.
- All `data-cy` values unchanged; no elements added or removed other than the gated `CardActionChips`.

## Inputs

- `src/battle/app/components/duel-field/CardControl.svelte` — card root `<article class="duel-field-card">` with `class:is-actionable={actionable}` / `class:is-selected={selected}` (lines ~258-282); props `interactionKind: ActiveInteractionSpec["kind"] | null = null`, `actionable`, `selected`, `choices` (lines ~22-28); target button + chips block at lines ~307-336.

  **The gate in this block is NOT what is on `main` — T4 rewrote it before this ticket.** Post-T4 state you edit against, verbatim:

  ```svelte
  {#if actionable || localActions.length > 0}
    {#if actionable}
      <button class="duel-field-card__target" … />
    {/if}
    {#if choices.length > 0 || localActions.length > 0}
      <CardActionChips choices={actionable ? choices : []} {localActions} … />
    {/if}
  {/if}
  ```

  Do not restore the pre-T4 `{#if actionable}` / `{#if choices.length > 0}` gates. If the file still shows those, T4 has not landed — stop and report.
- `src/battle/app/components/duel-field/FieldBoard.svelte:296-320` — passes `interactionKind={!disabled && spec?.cardChoices.has(card.targetId) === true ? spec.kind : null}`, `actionable`, `selected={selectedTargets.has(card.targetId)}`, `choices={spec?.cardChoices.get(card.targetId) ?? []}`. No change needed here; read-only input.
- `src/battle/app/prompts/interaction-spec.ts:129-152` — `INTERACTION_SPEC_KINDS` maps `selectCard | selectTribute | selectSum | selectUnselectCard → "cardSelection"`; `idleCommand | battleCommand | chain → "cardAction"`.
- `src/battle/app/components/DuelField.svelte:484-494` — `activateCard` switch: `case "cardSelection"` dispatches `chooseChoice` when immediate-single else `toggleChoice`. Unchanged; this is the toggle flow the styling reflects.
- `src/styles/app.css`:
  - `1395-1401` — `.duel-field-zone.is-actionable, .duel-field-card.is-actionable .duel-field-card__art { border-color: var(--success); box-shadow: 0 0 0 3px …, 0 0 10px …; }` (the green ring+glow that reads as fill).
  - `1571-1576` — `.duel-field-zone.is-selected, .duel-field-card.is-selected .duel-field-card__art { border-color: var(--warning); box-shadow: 0 0 0 3px color-mix(in srgb, var(--selected) 78%, transparent); }`.
  - `2404-2409` — chips reveal: `.duel-field-card.is-actionable:hover .card-action-chips, …:focus-within …, .is-pinned … { display: flex; }` (untouched; chips simply won't exist for selection cards).
- `src/styles/tokens.css:39-44` — `--legal: #7ee2a8; --success: var(--legal); --selected: #ffd580; --warning: var(--selected);`.
- Tests: `tests/component/CardControl.test.ts` (render helper `renderCard` lines 41-53), `tests/component/DuelField.test.ts` (`fieldPrompt`/`mountedChoice`/`renderInteractive` helpers lines 202-269; selectCard tests at 858-932).
- `e2e/duel-smoke.spec.ts` — inspected: contains no selection-styling or Select-chip assertions (only deck `<select>` dropdowns); no e2e change needed.
- **From Depends (T4):** `CardControl.svelte` carries prop `export let localActions: readonly LocalCardAction[] = [];` where `interface LocalCardAction { id: string; label: string; onSelect: () => void }` lives in `src/battle/app/presentation/local-card-action.ts`. `CardActionChips` renders those after the prompt choices as chips with class `card-action-chip--local` and `data-cy` `` `${prefix}card-action-chip-local-${action.id}` ``. The only local action wired today is `{ id: "materials", label: "Materials", onSelect }` on xyz hosts with `materials.length > 0`. **Local action chips stay visible during selection prompts** — they are an inspect affordance, not the Select button the owner asked to remove, and detach selection needs material inspection. This ticket suppresses prompt choices only.
- **From Depends (T2):** `CardActionChips.svelte` at `src/battle/app/components/duel-field/CardActionChips.svelte` — props verbatim: `cardId: string; cardLabel: string; choices: readonly InteractionChoice[]; disabled?: boolean; onchoose: (choice: InteractionChoice) => void; ondismiss: () => void; variant?: "field" | "list"; layout?: "row" | "stack"; ondetails?: (() => void) | null; dataCyScope?: string`; instance method `focusFirstChip(): void`; root class `card-action-chips`, chip class `card-action-chip`; bottom-anchored on the card. Do not modify this component.

## Interface contract (level 5)

Machine-checkable shapes this slice produces or consumes.

- **Produces (frozen contract C5 — T7 consumes these class semantics; do not rename):**

  New card-root class, derived in `CardControl.svelte` from the existing prop — no new prop, no API change:

  ```svelte
  class:is-selection-candidate={interactionKind === "cardSelection"}
  ```

  Invariant: `is-selection-candidate` ⇒ `is-actionable` (FieldBoard only passes non-null `interactionKind` when `actionable` is true; both derive from `spec.cardChoices.has(card.targetId)`).

  Chip wiring, verbatim (replaces T4's `choices={actionable ? choices : []}` on the `<CardActionChips …/>` invocation; the surrounding `{#if choices.length > 0 || localActions.length > 0}` gate T4 left is **unchanged**):

  ```svelte
  choices={actionable && interactionKind !== "cardSelection" ? choices : []}
  ```

  Suppressing at the prop, not at the gate, is deliberate: it keeps T4's Materials chip mounted on a selection candidate while every prompt choice (the Select chip) disappears. `CardActionChips` renders **no DOM at all** when both `choices` and `localActions` are empty — T4 committed that guard and the test `"renders nothing when there are no prompt choices and no local actions"` in `tests/component/CardActionChips.test.ts`. Verify that test exists before starting; if it does not, T4 has not landed — stop and report.

  CSS, verbatim, appended to `src/styles/app.css` immediately after the `.is-selected` rule that ends at line 1576:

  ```css
  /* Item 5: selection candidates wear a dashed outline instead of the solid
     legality ring — the glow above reads as a green-filled card at field
     scale. `box-shadow: none` overrides the `.is-actionable` glow; the same
     dashed weight in orange is the selected state, so selection reads as a
     colour change, never a shape change. cardAction prompts never carry
     `.is-selection-candidate` and keep the solid ring. */
  .duel-field-card.is-selection-candidate .duel-field-card__art {
    border: 3px dashed var(--success);
    box-shadow: none;
  }

  .duel-field-card.is-selection-candidate.is-selected .duel-field-card__art {
    border-color: var(--selected);
    box-shadow: none;
  }
  ```

  Specificity check (must hold): `.duel-field-card.is-selection-candidate.is-selected .duel-field-card__art` (0,4,1) beats `.duel-field-card.is-selected .duel-field-card__art` (0,3,1) at line 1574, and `.duel-field-card.is-selection-candidate .duel-field-card__art` (0,3,1) ties `.duel-field-card.is-actionable .duel-field-card__art` (line 1396) but wins by source order (later). Do not reorder existing rules.

- **Consumes (binding, unchanged):**
  - `export let interactionKind: ActiveInteractionSpec["kind"] | null = null;` (`CardControl.svelte:22`), values from `ActiveInteractionKind = "cardAction" | "cardSelection" | "placeSelection" | "counterAllocation" | "order" | "nonField"`.
  - `CardActionChips` props as listed under Inputs — pass-through unchanged.
  - Toggle flow `DuelField.svelte:489-493` — `case "cardSelection": if (isImmediateSingleSelection(spec)) dispatch({ type: "chooseChoice", choiceId: choice.id }); else dispatch({ type: "toggleChoice", choiceId: choice.id });` — unchanged.
  - `aria-pressed={interactionKind === "cardSelection" ? selected : undefined}` on `duel-field-card__target` (`CardControl.svelte:312`) — unchanged.
- **Errors:** none — pure render/CSS slice; no new failure path.
- **Invariants:**
  - `is-selection-candidate` present ⇔ `interactionKind === "cardSelection"` (never for `cardAction`, `counterAllocation`, `placeSelection`, `order`, `nonField`, or `null`).
  - `CardActionChips` mounted ⇔ `(actionable && choices.length > 0) || localActions.length > 0` (T4's gate, unchanged by this ticket).
  - Prompt-choice chips rendered ⇔ `actionable && choices.length > 0 && interactionKind !== "cardSelection"`. A `cardSelection` candidate therefore shows **no** Select chip; it still shows a Materials chip when the card is an xyz host with materials.
  - `duel-field-card__target` mounted ⇔ `actionable` (exactly as before this ticket).
  - No `:hover` rule added by this ticket.
  - Existing rules at app.css 1395-1401 and 1571-1576 are byte-identical after this ticket (override-by-new-rule, not edit — zones and cardAction cards still use them).
- **Integration links:** trigger `src/battle/app/components/duel-field/CardControl.svelte` target-button `onclick={activate}` → dispatch `onactivate` → `DuelField.svelte:484` `activateCard` → `dispatch({ type: "toggleChoice", … })` → receive session reducer marks choice selected → observe `FieldBoard.svelte:307` `selected={selectedTargets.has(card.targetId)}` → `.is-selected` class → dashed orange border (component test asserts the class flip).

## TDD

1. **Red** — write the four tests below first; the two new CardControl tests and the new DuelField test fail against current code (`is-selection-candidate` absent; chips mounted for selection prompts).
2. **Green** — apply the two `CardControl.svelte` edits and the CSS block.
3. **Refactor** — none expected; keep green.

## Test plan

Run: `npx vitest run tests/component/CardControl.test.ts tests/component/DuelField.test.ts`

| Test | Input | Expect |
| ---- | ----- | ------ |
| `CardControl.test.ts` › new describe `"CardControl selection candidacy"` › `"a cardSelection candidate carries the dashed-candidate class and mounts no chips"` | `render(CardControl, { card: makeCard(), layout: "hand", placement: null, imageUrl: "/back.webp", imageLibrary: null, actionable: true, interactionKind: "cardSelection", choices: [{ id: choiceId("c1"), label: "Select", action: "select" }] })` | `article.classList.contains("is-selection-candidate") === true`; `document.querySelector(".card-action-chips") === null`; `document.querySelector(".duel-field-card__target") !== null` and has `aria-pressed="false"` |
| same describe › `"a cardAction card keeps chips and never carries the candidate class"` | same render but `interactionKind: "cardAction"`, choices `[{ id: choiceId("c1"), label: "Activate effect", action: "activate" }]` | `classList.contains("is-selection-candidate") === false`; `document.querySelector(".card-action-chips") !== null` |
| same describe › `"a cardSelection candidate still shows a local Materials chip"` (guards the T4 handoff) | same render as the first row plus `localActions: [{ id: "materials", label: "Materials", onSelect: () => {} }]` | `document.querySelector(".card-action-chips") !== null`; `document.querySelector(".card-action-chip--local") !== null`; no chip whose text is `"Select"` — assert `screen.queryByRole("button", { name: "Select" }) === null` |
| `DuelField.test.ts` › `"a multi-pick selection prompt shows dashed candidates, no chips, and toggles is-selected on activation"` (add near the selectCard tests at line 858) | `renderInteractive(fieldPrompt("selectCard", [mountedChoice("select", "Select monster")], { minimum: 1, maximum: 2 }))`; find `card = screen.getByRole("button", { name: /Legal.*Select The Legendary Fisherman/ })`; `article = card.closest(".duel-field-card")` | before activation: `article.classList.contains("is-selection-candidate") === true`, `is-selected === false`, `article.querySelector(".card-action-chips") === null`; `card.focus(); await user.keyboard("{Enter}")` → `is-selected === true`, `card.getAttribute("aria-pressed") === "true"`, `harness.commands` still `[]` (toggle, not submit); `{Enter}` again → `is-selected === false` |
| existing `DuelField.test.ts:891` `"makes native Enter and Space activation submit an exact singleton choice directly"` | unchanged input | still passes unchanged — it asserts `is-actionable`/`is-selected` classes and commands only, never chips. If it fails, fix the impl, not the test |
| existing `DuelField.test.ts:934` `"pins the chips on Enter, walks them, and returns focus on Escape"` (idleCommand) | unchanged | still passes — cardAction chips untouched |

`choiceId` is already imported in both test files' import graph (`src/battle/duel/contracts/ids.ts`); add `import { choiceId } from "../../src/battle/duel/contracts/ids.ts";` to `CardControl.test.ts` (currently imports `cardCode, cardInstanceId` from the same module — extend that import). The `InteractionChoice` literal `{ id: choiceId("c1"), label, action }` satisfies the type (all other fields optional).

## Impl steps

- [ ] 1. Red: add failing component tests
  - [ ] 1.1 `tests/component/CardControl.test.ts`: extend the ids import to `import { cardCode, cardInstanceId, choiceId } from "../../src/battle/duel/contracts/ids.ts";`
  - [ ] 1.2 `tests/component/CardControl.test.ts`: append new `describe("CardControl selection candidacy", …)` with the two tests from the Test plan (exact names, exact assertions), rendering `CardControl` directly with `actionable: true` and the stated `interactionKind`/`choices` props (reuse `makeCard()`; pass `layout: "hand"` and `placement: null` like `renderCard` does)
  - [ ] 1.3 `tests/component/DuelField.test.ts`: after the test ending at line ~932 (`spaceHarness` block), add test `"a multi-pick selection prompt shows dashed candidates, no chips, and toggles is-selected on activation"` per the Test plan row (`userEvent.setup()` + `renderInteractive` + `{ minimum: 1, maximum: 2 }` override)
  - [ ] 1.4 Run `npx vitest run tests/component/CardControl.test.ts tests/component/DuelField.test.ts` — expect exactly the 3 new tests failing
- [ ] 2. Green: derive the candidate class and gate the chips in `CardControl.svelte`
  - [ ] 2.1 `src/battle/app/components/duel-field/CardControl.svelte`, `<article>` class directives (~line 265): insert `class:is-selection-candidate={interactionKind === "cardSelection"}` on the line directly after `class:is-actionable={actionable}`
  - [ ] 2.2 same file, chips block (~line 324, post-T4 shape): leave the `{#if choices.length > 0 || localActions.length > 0}` gate untouched; on the `<CardActionChips …/>` invocation change `choices={actionable ? choices : []}` to `choices={actionable && interactionKind !== "cardSelection" ? choices : []}`. Every other attribute, incl. `{localActions}`, stays byte-identical
- [ ] 3. Green: dashed border styles
  - [ ] 3.1 `src/styles/app.css`: immediately after the closing `}` of the `.duel-field-zone.is-selected, .duel-field-card.is-selected .duel-field-card__art` rule (line 1576), insert the CSS block quoted verbatim in the Interface contract (comment + two rules). Touch no existing rule
- [ ] 4. Verify gates
  - [ ] 4.1 Run `npx vitest run tests/component/CardControl.test.ts tests/component/DuelField.test.ts` — all pass
  - [ ] 4.2 Run `npm run test:component` — green
  - [ ] 4.3 Run `npm run check:headless` — green (types, lint, boundaries, data-cy coverage)

## Outputs

- Files touched: `src/battle/app/components/duel-field/CardControl.svelte`, `src/styles/app.css`, `tests/component/CardControl.test.ts`, `tests/component/DuelField.test.ts`
- Behavior change: selection-family field candidates render dashed green (no glow/fill), dashed orange when selected; their Select chip is gone; click/keyboard toggle unchanged. `cardAction` prompts visually unchanged.
- Public API: none — no prop, no export, no `data-cy` change. New CSS class `is-selection-candidate` is frozen for T7 (contract C5).
- Migrate/config: none.

## Validation

- [ ] tests pass: `npx vitest run tests/component/CardControl.test.ts tests/component/DuelField.test.ts` then `npm run test:component` then `npm run check:headless` — all exit 0
- [ ] manual check: `npm run dev`, start a duel, reach an extra-deck summon material prompt — candidates show dashed green border only (no green fill on hover or rest), clicking one turns its border dashed orange, clicking again reverts, no Select chip appears on hover/focus; a normal main-phase idle prompt still shows solid green ring + chips
- [ ] no silent-failure swallow on a path this slice adds: none — slice adds no `|| true`, empty catch, output redirection, or fire-and-forget
- [ ] app functional — no broken path from this slice (selection prompts still answerable via card click, keyboard Enter/Space, and target list)
- [ ] commit msg draft: `fix(duel): dash selection candidates green/orange, drop select chip and green fill (item 5)`
