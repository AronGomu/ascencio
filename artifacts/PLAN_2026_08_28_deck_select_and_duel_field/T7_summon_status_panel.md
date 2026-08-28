# T7: Persistent summon/selection status panel (item 6)

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`  
**Depends:** T6  
**Commit outcome:** Live "N of M selected" + level-sum "X of Y" panel during every selection prompt

## Context (self-contained)

- Goal: implement the 2026-08-27 owner feedback round on the duel-field right pane. This ticket is item 6 (owner wording, binding): "When trying to summon a monster from the Extra Deck, constantly show a dialogue with the status of the process. Show the number of cards selected and the number that should be selected. If it's for Synchro summons, show the addition to the level and the level it should be equivalent to. For Xyz monsters, specify the summoning condition and say, for example, 'you need two Level 3 monsters and you have X out of the total number of monsters selected.' Do the same for all types of summoning."
- This slice: status **display** only. One pure formatter becomes the single source of truth for the selection-status string; the existing `FieldActionBar` summary and the `ZoneListDialog` target-mode count line both render it; `fieldActionBarRequired` is amended so the bar shows for **all** selection-family prompts ("constantly show").
- Out of scope here: no selection mechanics, no changes to how cards are toggled/selected, no worker or protocol changes, no engine/vendor changes, never edit `feedback.md` or any `feedback*.md`.
- Assumptions in force:
  - Whether Xyz material picks arrive as `selectSum` or plain `selectCard` is engine-decided (plan assumption A8). The owner's literal Xyz sentence ("you need two Level 3 monsters…") is **not derivable** from a plain `selectCard` prompt, which carries only `minimum`/`maximum`. The panel therefore renders the sum/N-of-M data actually present on the prompt, not a reconstructed summoning condition. This is a planning-level amendment to the owner wording; the commit outcome does not promise the literal sentence.
  - T6 is already merged: selection-family prompts (`selectCard`/`selectSum`/`selectUnselectCard`/`selectTribute`) style candidates with `is-selection-candidate` (dashed green) and selected cards with `is-selected` (dashed orange); the Select chip is suppressed; toggling happens through the full-cover `duel-field-card__target` button. None of that is touched here.
  - Production duels are unaffected mechanically: this ticket adds strings and one visibility widening only.

## Requirements

- R1: During **every** selection-family prompt (`prompt.kind` ∈ `selectCard | selectTribute | selectSum | selectUnselectCard`), the field action bar is visible (subject to the existing `fieldCapable` gate in `DuelField.svelte`) and shows a live selection-status line — including at 0 selected, including immediate 1-of-1 selections, including selections whose targets are all off-field.
- R2: The status line always contains the count part: exact requirement → `N of M selected`; range requirement (`minimum ≠ maximum`) → `N selected (choose min–max)`.
- R3: When `prompt.kind === "selectSum"` and `prompt.requiredTotal !== undefined`, the status line appends a sum part: `· sum X of Y` (mode `exact`) or `· sum X of at least Y` (mode `atLeast`), where `X` is the best-fit achievable total of the current selection (rule frozen in the interface contract below) and `Y` is `requiredTotal`.
- R4: The target-mode `ZoneListDialog` count line shows the **same** formatted string as the bar — one formatter, two consumers.
- R5: Non-selection prompts (`counterAllocation`, `order`, card actions, non-field prompts) keep their current bar behavior byte-identical; the legacy `{n} selected` fallback stays for them.
- R6: No dead-end: for an immediate 1-of-1 card selection the bar shows title + status but (as today) no Confirm button; the card click itself answers the prompt. Verified by existing test `"does not render Confirm for an exact singleton card selection, even if mounted directly"` staying green.
- R7: Gates green: `npm run check:headless` and `npm run test:component` (plan A11).

## Inputs

- `src/battle/duel/contracts/player-prompt.ts` — `PlayerPrompt` (lines 84–100: `minimum`, `maximum`, `requiredTotal?`, `sumMode?: "exact" | "atLeast"`, `mandatoryContributions?`), `PromptCard.contribution?`/`alternativeContribution?` (lines 50–62), `PromptContribution` (lines 64–67), `PromptKind`.
- `src/battle/duel/prompt-sum.ts` — `contributionOptions(value?: PromptContribution): readonly number[]` (lines 5–13). Reuse it; do not reimplement.
- `src/battle/app/prompts/interaction-spec.ts` — `fieldActionBarRequired` (lines 247–268: the function to amend), `isImmediateSingleSelection` (lines 205–209), `INTERACTION_SPEC_KINDS` (lines 129–153: all four selection kinds map to `"cardSelection"`).
- `src/battle/app/components/duel-field/FieldActionBar.svelte` — summary block (lines 75–79 render `{session.selectedChoiceIds.length} selected` under `data-cy="field-action-bar-summary"`); confirm-button gate near the bottom (`spec.kind !== "cardAction" && spec.kind !== "nonField" && !((placeSelection || cardSelection) && isImmediateSingleSelection(spec))`) — leave the gate alone.
- `src/battle/app/components/duel-field/ZoneListDialog.svelte` — props `minimum`/`maximum` (lines 32–33); `selectionState` derives `countLabel` via `cardListSelectionState` (lines 84–90); `<output data-cy="zone-list-dialog-selection-count">{selectionState.countLabel}</output>` (lines 252–253).
- `src/battle/app/presentation/card-list-dialog-model.ts` — `cardListSelectionState` and its `countLabel` fallback strings (kept as fallback, not deleted).
- `src/battle/app/components/DuelField.svelte` — `export let prompt: PlayerPrompt | null` (line 90); `submittedChoiceIds` + `validation` (lines 246–251); `actionBarVisible` (lines 260–264); target-mode `<ZoneListDialog mode="target" …>` (lines 1189–1218, `minimum`/`maximum` fed at 1198–1199); `<FieldActionBar …>` (lines 1253–1261).
- `src/battle/app/prompts/prompt-control-family.ts` — kind→family table (context only).
- Tests to read/extend: `tests/component/FieldActionBar.test.ts` (helpers `fieldPrompt`/`specFor`/`mountedChoice`, summary test at line 317), `tests/component/ZoneListDialog.test.ts` (count tests at lines 370, 383), `tests/unit/interaction-spec.test.ts` (`describe("fieldActionBarRequired")` at line 597).
- **From Depends (T6):** selection-family prompts already render every candidate as a toggleable full-cover button (`duel-field-card__target`) with `is-selection-candidate`/`is-selected` classes and no Select chip. T7 reads `session.selectedChoiceIds` state that those toggles maintain; it adds no new toggle surface and changes no class.

## Interface contract (level 5)

Machine-checkable shapes this slice produces or consumes.

- **Produces:** new file `src/battle/app/presentation/format-selection-status.ts`, exact public surface:

  ```ts
  import type { ChoiceId } from "../../duel/contracts/ids.ts";
  import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";

  /** Prompt kinds that render a live selection-status line. */
  export const SELECTION_STATUS_KINDS: ReadonlySet<PlayerPrompt["kind"]>;
  // exactly: new Set(["selectCard", "selectTribute", "selectSum", "selectUnselectCard"])

  /**
   * Single source of truth for the selection-status string shown by
   * FieldActionBar and the target-mode ZoneListDialog.
   * Returns null for any prompt kind outside SELECTION_STATUS_KINDS.
   */
  export function formatSelectionStatus(
    prompt: PlayerPrompt,
    selectedChoiceIds: readonly ChoiceId[],
  ): string | null;
  ```

  String grammar (exact, byte-for-byte):
  - Let `count` = number of ids in `selectedChoiceIds` that match a `prompt.choices[].id` (unknown ids are ignored, duplicates counted once).
  - Count part: `prompt.minimum === prompt.maximum` → `` `${count} of ${prompt.maximum} selected` ``; otherwise → `` `${count} selected (choose ${prompt.minimum}–${prompt.maximum})` `` (U+2013 en dash, matching the existing `countLabel` range string in `card-list-dialog-model.ts`).
  - Sum part, appended only when `prompt.kind === "selectSum"` **and** `prompt.requiredTotal !== undefined`: `` ` · sum ${X} of ${Y}` `` for `sumMode` `"exact"` or unset, `` ` · sum ${X} of at least ${Y}` `` for `"atLeast"`, where `Y = prompt.requiredTotal`. Separator is space–middle-dot–space (` · `), matching `countLabel`.
  - **Best-fit total rule (frozen — ambiguous/dual contributions):** build the option lists `[...(prompt.mandatoryContributions ?? []).map(contributionOptions), ...selectedCards.map(card => contributionOptions({ contribution: card.contribution ?? 0, ...(card.alternativeContribution === undefined ? {} : { alternativeContribution: card.alternativeContribution }) }))]` where `selectedCards` are the `choice.card` of matched selected choices (a matched choice with no `card` contributes `[0]`). Compute the set `T` of all achievable totals (one option per list, summed; empty list set → `T = {0}`). Then:
    - mode `exact`: `X = Y` if `Y ∈ T`; else `X = max{t ∈ T : t < Y}` if any; else `X = min(T)`.
    - mode `atLeast`: `X = min{t ∈ T : t ≥ Y}` if any; else `X = max(T)`.
    This means a dual-level card (e.g. contribution 1 or 7) always displays the option that best serves the target — the panel never blames the player for an ambiguity the engine will resolve in their favor.
  - The function is pure, allocation-only, no imports beyond the two types and `contributionOptions` from `src/battle/duel/prompt-sum.ts`.

- **Produces (component props, additive, default-safe):**

  ```ts
  // FieldActionBar.svelte
  export let selectionStatus: string | null = null;
  // ZoneListDialog.svelte
  export let selectionStatus: string | null = null;
  ```

  Render contracts:
  - `FieldActionBar`: the `data-cy="field-action-bar-summary"` paragraph renders **whenever** `selectionStatus !== null` (even at 0 selected) with text exactly `selectionStatus`; when `selectionStatus === null` it keeps today's behavior exactly (renders only if `session.selectedChoiceIds.length > 0`, text `` `${session.selectedChoiceIds.length} selected` ``).
  - `ZoneListDialog`: `data-cy="zone-list-dialog-selection-count"` renders `selectionStatus ?? selectionState.countLabel`. `cardListSelectionState` itself is untouched (its `validateEnabled`/`unavailableChoiceIds` outputs still drive Confirm gating and max-lock).

- **Produces (visibility widening):** `fieldActionBarRequired(spec: ActiveInteractionSpec): boolean` in `src/battle/app/prompts/interaction-spec.ts` changes to return `true` for **every** `spec.kind === "cardSelection"`: the T16 off-field suppression branch (`spec.kind === "cardSelection" && spec.offFieldChoices.length > 0 → false`) is deleted, and the `case "cardSelection"` arm returns `true` unconditionally. `placeSelection`, `counterAllocation`, `order`, `cardAction`, `nonField`, and the genuine-global-choice early-return keep their current behavior byte-identical. Signature unchanged.

- **Consumes:**
  - `contributionOptions(value?: PromptContribution): readonly number[]` from `src/battle/duel/prompt-sum.ts` — binding, do not redesign.
  - `PlayerPrompt` fields `kind`, `minimum: number`, `maximum: number`, `requiredTotal?: number`, `sumMode?: "exact" | "atLeast"`, `mandatoryContributions?: readonly PromptContribution[]`, `choices[].card?.contribution?: number`, `choices[].card?.alternativeContribution?: number` — read-only, unchanged.
  - `DuelField.svelte` reactive state: `prompt`, `submittedChoiceIds` (line 246–247) — the selected-id source fed to the formatter.

- **Errors:** none thrown. Malformed input degrades: non-selection kind → `null`; `requiredTotal` undefined on a `selectSum` → count part only; empty selection in `exact` mode → `X = 0` (from `T = {0}` via the `min(T)` branch, since no positive achievable total below target exists when nothing is selected and there are no mandatory contributions — with mandatory contributions their totals are in `T` and display accordingly).

- **Invariants:**
  - `formatSelectionStatus` is deterministic and side-effect free; same inputs → same string.
  - Both consumers render the identical string for identical `(prompt, selectedChoiceIds)` — no consumer re-formats.
  - The status line never gates legality: `validation`/`confirmValid` wiring is untouched; presentation state never determines legality (core architecture rule).
  - The widened bar never removes an answer path: Confirm-button gating in `FieldActionBar.svelte` is unchanged, so immediate 1-of-1 selections show status without a Confirm button and are still answered by the card click.
  - `data-cy` set unchanged (`field-action-bar-summary`, `zone-list-dialog-selection-count` reused) → `tests/unit/data-cy-coverage.test.ts` unaffected.

- **Integration links:** none — this slice crosses no process/host/library boundary. All data already crosses the Worker boundary via `PlayerPrompt`; observation is the rendered DOM asserted by component tests.

## TDD

1. **Red** — write the failing tests first:
   - `tests/unit/format-selection-status.test.ts` (new): all formatter cases in the test plan.
   - `tests/unit/interaction-spec.test.ts`: flip the three `fieldActionBarRequired` expectations for card selections to `true`.
   - `tests/component/FieldActionBar.test.ts`: new assertions for always-on status via `selectionStatus` prop; update `"summary counts selections"`.
   - `tests/component/ZoneListDialog.test.ts`: new assertion that a passed `selectionStatus` overrides `countLabel`.
2. **Green** — implement formatter, the two prop/render changes, the `DuelField.svelte` wiring, and the `fieldActionBarRequired` amendment; minimum code to pass.
3. **Refactor** — only if needed; keep green.

## Test plan

Run: `npx vitest run tests/unit/format-selection-status.test.ts tests/unit/interaction-spec.test.ts` and `npx vitest run tests/component/FieldActionBar.test.ts tests/component/ZoneListDialog.test.ts`.

`tests/unit/format-selection-status.test.ts` — build prompts with the same literal shape as `fieldPrompt` in `tests/component/FieldActionBar.test.ts` (id via `promptId`, choices via `choiceId`, `card.contribution` set where needed):

| Test | Input | Expect |
| ---- | ----- | ------ |
| `returns null for a non-selection prompt` | `kind: "yesNo"`, any ids | `null` |
| `exact requirement counts selected of maximum` | `selectCard`, min 2 max 2, 1 known id selected | `"1 of 2 selected"` |
| `zero selected still renders` | `selectCard`, min 1 max 1, `[]` | `"0 of 1 selected"` |
| `range requirement shows the span` | `selectTribute`, min 1 max 3, 2 selected | `"2 selected (choose 1–3)"` |
| `ignores unknown and duplicate ids` | `selectCard` min 2 max 2, ids `[c1, c1, ghost]` | `"1 of 2 selected"` |
| `selectSum exact appends the sum` | `selectSum`, min 1 max 2, `requiredTotal: 8`, `sumMode: "exact"`, selected one card `contribution: 4` | `"1 of 2 selected · sum 4 of 8"` |
| `selectSum atLeast wording` | as above, `sumMode: "atLeast"`, two cards 4+5 selected, min 1 max 3 → range part | `"2 selected (choose 1–3) · sum 9 of at least 8"` |
| `dual contribution picks the best fit` | `selectSum` exact, `requiredTotal: 7`, selected one card `contribution: 1, alternativeContribution: 7` | sum part `"· sum 7 of 7"` |
| `mandatory contributions count into the total` | `selectSum` exact, `requiredTotal: 8`, `mandatoryContributions: [{contribution: 4}]`, nothing selected | `"0 of 2 selected · sum 4 of 8"` (min 1 max 2) |
| `overshoot in exact mode shows nearest total below target` | `selectSum` exact, `requiredTotal: 6`, two selected cards 4+4 (`T = {0,4,8}`) | sum part `"· sum 4 of 6"` |
| `selectSum without requiredTotal renders count only` | `selectSum`, `requiredTotal` undefined, min 1 max 1, none selected | `"0 of 1 selected"` |
| `selectUnselectCard renders count part` | `selectUnselectCard`, min 1 max 1, 1 selected | `"1 of 1 selected"` |

`tests/unit/interaction-spec.test.ts` — existing `describe("fieldActionBarRequired")`:

| Test | Change | Expect |
| ---- | ------ | ------ |
| `is not required when the target list owns the confirmation` (line 598) | rename to `is required even when the target list is open (T7 constant status)` | `toBe(true)` |
| `is not required for a mixed prompt either` (line 613) | rename to `is required for a mixed prompt (T7 constant status)` | `toBe(true)` |
| `is not required for an exact singleton card selection` (line 642) | rename to `is required for an exact singleton card selection (T7 constant status)` | `toBe(true)` |
| `single placement needs no confirm bar` (line 697) | unchanged | `toBe(false)` — placeSelection carve-out survives |
| all other cases in the describe | unchanged | unchanged |

`tests/component/FieldActionBar.test.ts`:

| Test | Input | Expect |
| ---- | ----- | ------ |
| `"summary counts selections"` (line 317, update) | add prop `selectionStatus: "2 of 2 selected"` to the existing render | `[data-cy="field-action-bar-summary"]` text `"2 of 2 selected"` |
| `renders the selection status at zero selected` (new) | `selectCard` min 1 max 1, fresh session (nothing selected), `selectionStatus: "0 of 1 selected"` | summary element exists, text `"0 of 1 selected"`; `[data-cy="field-action-bar-confirm"]` is `null` (immediate single → no dead-end regression) |
| `legacy summary without a selection status` (new) | `selectCounter` spec, session with 1 selected id, `selectionStatus` omitted | summary text `"1 selected"` |
| `"does not render Confirm for an exact singleton card selection, even if mounted directly"` (line 118) | unchanged | stays green |

`tests/component/ZoneListDialog.test.ts` (target-mode render helper already exists in the file — reuse it):

| Test | Input | Expect |
| ---- | ----- | ------ |
| `renders the shared selection status when provided` (new) | target-mode render + `selectionStatus: "1 of 2 selected · sum 4 of 8"` | `[data-cy="zone-list-dialog-selection-count"]` text `"1 of 2 selected · sum 4 of 8"` |
| `"counts a fixed selection as selected of maximum"` (line 370) | unchanged (no `selectionStatus` passed) | stays green — fallback `countLabel` intact |
| `"counts a range selection with its allowed span"` (line 383) | unchanged | stays green |

## Impl steps

- [x] 1. Formatter exists and is fully unit-tested (single source of truth).
  - [x] 1.1 Create `tests/unit/format-selection-status.test.ts` with every case from the test plan above, importing `formatSelectionStatus` and `SELECTION_STATUS_KINDS` from `../../src/battle/app/presentation/format-selection-status.ts` and id builders from `../../src/battle/duel/contracts/ids.ts`. Run `npx vitest run tests/unit/format-selection-status.test.ts` — red (module missing).
  - [x] 1.2 Create `src/battle/app/presentation/format-selection-status.ts` implementing the exact contract in `## Interface contract`: export `SELECTION_STATUS_KINDS`, export `formatSelectionStatus`; import `contributionOptions` from `../../duel/prompt-sum.ts`; compute achievable totals with a `Set<number>` fold over the option lists (mirror the fold shape of `possibleMandatoryTotals` in `src/battle/duel/prompt-sum.ts:99-114` but without the `<= target` filter); apply the best-fit rule verbatim.
  - [x] 1.3 Run `npx vitest run tests/unit/format-selection-status.test.ts` — green. (16 passed)
- [x] 2. Bar shows for every selection-family prompt.
  - [x] 2.1 In `tests/unit/interaction-spec.test.ts` `describe("fieldActionBarRequired")` (line 597), flip and rename the three card-selection cases exactly as the test-plan table says; leave `single placement needs no confirm bar` and every other case untouched. Run `npx vitest run tests/unit/interaction-spec.test.ts` — red.
  - [x] 2.2 In `src/battle/app/prompts/interaction-spec.ts` `fieldActionBarRequired` (lines 247–268): delete the branch `if (spec.kind === "cardSelection" && spec.offFieldChoices.length > 0) return false;` and its T16 comment; change the switch arm so `case "cardSelection": return true;` while `case "placeSelection": return !isImmediateSingleSelection(spec);` stays. Add a one-line comment on the `cardSelection` arm: selection prompts always keep the status bar (feedback item 6); the target window and the bar coexist.
  - [x] 2.3 Run `npx vitest run tests/unit/interaction-spec.test.ts` — green. (57 passed)
- [x] 3. Both surfaces render the shared string.
  - [x] 3.1 In `tests/component/FieldActionBar.test.ts`: update `"summary counts selections"` (line 317) and add the two new tests from the test-plan table (use the existing `fieldPrompt`/`specFor`/`mountedChoice`/`createInteractionSession` helpers; for the counter case reuse the pattern of the existing counter tests at lines 213–261). In `tests/component/ZoneListDialog.test.ts`: add `renders the shared selection status when provided` next to the count tests (line 370 area), passing `selectionStatus` alongside the props the neighbouring target-mode tests already pass. Run `npx vitest run tests/component/FieldActionBar.test.ts tests/component/ZoneListDialog.test.ts` — red.
  - [x] 3.2 In `src/battle/app/components/duel-field/FieldActionBar.svelte`: add `export let selectionStatus: string | null = null;` after `export let contextMessage` (line 18 area); replace the summary block (lines 75–79) with:

        {#if selectionStatus !== null}
          <p data-cy="field-action-bar-summary">{selectionStatus}</p>
        {:else if session.selectedChoiceIds.length > 0}
          <p data-cy="field-action-bar-summary">
            {session.selectedChoiceIds.length} selected
          </p>
        {/if}

  - [x] 3.3 In `src/battle/app/components/duel-field/ZoneListDialog.svelte`: add `export let selectionStatus: string | null = null;` after `export let maximum = 0;` (line 33); change the count output (lines 252–253) to `<output data-cy="zone-list-dialog-selection-count">{selectionStatus ?? selectionState.countLabel}</output>`.
  - [x] 3.4 In `src/battle/app/components/DuelField.svelte`: import `formatSelectionStatus` from `../presentation/format-selection-status.ts` (alongside the existing presentation imports near line 30); add after the `validation` reactive (line 251): `$: selectionStatus = prompt === null ? null : formatSelectionStatus(prompt, submittedChoiceIds);`; pass `{selectionStatus}` to `<FieldActionBar` (line 1253 block) and `{selectionStatus}` to the target-mode `<ZoneListDialog mode="target"` (line 1189 block; browse-mode dialog at line 1219 gets nothing).
  - [x] 3.5 Run `npx vitest run tests/component/FieldActionBar.test.ts tests/component/ZoneListDialog.test.ts` — green. (56 passed)
- [x] 4. Gates.
  - [x] 4.1 Run `npm run check:headless` — exit 0. (EXIT=0; unit 1743 passed, integration 39 passed, legacy pass 23 fail 0)
  - [x] 4.2 Run `npm run test:component` — exit 0. (EXIT=0; 105 files, 980 passed)

## Outputs

- Files touched: `src/battle/app/presentation/format-selection-status.ts` (new), `src/battle/app/prompts/interaction-spec.ts`, `src/battle/app/components/duel-field/FieldActionBar.svelte`, `src/battle/app/components/duel-field/ZoneListDialog.svelte`, `src/battle/app/components/DuelField.svelte`, `tests/unit/format-selection-status.test.ts` (new), `tests/unit/interaction-spec.test.ts`, `tests/component/FieldActionBar.test.ts`, `tests/component/ZoneListDialog.test.ts`.
- Behavior change: field action bar now appears for every selection-family prompt and always carries a live `N of M selected` (+ `sum X of Y` on `selectSum`) line; the target list dialog mirrors the same string. No selection mechanics change.
- Migrate/config: none.

## Validation

- [x] tests pass: `npx vitest run tests/unit/format-selection-status.test.ts tests/unit/interaction-spec.test.ts` (73 passed), `npm run test:component` (980 passed), `npm run check:headless` (EXIT=0) — all exit 0
- [ ] manual check: start a duel, tribute summon a 2-tribute monster → bar shows `0 of 2 selected` before any pick and counts up; trigger a Synchro summon (selectSum) → sum line tracks the level total against the target; an immediate 1-of-1 selection shows the bar with status and no Confirm button, and clicking the card still answers
- [x] no silent-failure swallow on a path this slice adds — `|| true`, empty catch, `>/dev/null 2>&1`, fire-and-forget with no error path: none
- [x] app functional — no broken path from this slice: every previously bar-suppressed selection still answerable (card click / target dialog), Confirm gating unchanged
- [ ] commit msg draft: `feat(duel): keep a live selection/sum status line on every selection prompt (item 6)`
