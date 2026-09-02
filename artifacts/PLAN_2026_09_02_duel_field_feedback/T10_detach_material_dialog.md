# T10: Detach/overlay cost selection uses a visual card dialog

**Plan:** `./artifacts/PLAN_2026_09_02_duel_field_feedback.md`
**Depends:** none
**Commit outcome:** Activating an effect that detaches XYZ material opens a card-selection dialog showing every valid material with art; player picks visually.

## Context (self-contained)

- Goal: owner feedback `feedback.md` § Duel Field item 12 — "When activating an ability that ask you to detach a material, always show dialog for card selection with all valid target to detach."
- This slice: UI-side routing of overlay-material prompt choices into a visual dialog. **No worker change needed** (red-team verified: `PromptCard` already carries `code` when the engine reveals it, `PromptRegistry.ts:1158`).
- Out of scope here: non-overlay global choices (keep current `PromptDialog` for them), projector changes (`DuelStateProjector.ts:771-776` overlay skip stays — materials intentionally absent from `board.cards`).
- Assumptions in force: A8 — applies to `selectCard`/`selectTribute` prompts whose choices are overlay cards; acceptance centers on the detach case.

## Requirements

- A `cardSelection`-kind spec whose global choices include overlay cards (`choice.card.overlay === true`) presents those choices in a visual dialog (art tile grid), not the plain text `PromptDialog` list.
- Dialog honors the prompt's min/max selection constraints and confirm/cancel semantics identical to current `PromptDialog` submission.
- Concealed material (no `code` on the choice card) renders the card back — never a leaked identity (core architecture rule).
- Reuse `ZoneListDialog` target mode / `ZoneListEntryTile` visuals where they fit; a new focused component is acceptable per file design policy if reuse contorts.

## Inputs

- Routing today: `src/battle/field/card-mapping.ts:34-88` `resolvePromptChoiceBoardTarget` → overlay card returns `{ kind: "nonField", reason: "target_not_mounted" }` → `interaction-spec.ts` puts choice in `globalEntries` — at BOTH sites: `:326` and `:336`. The mapping change must divert overlay choices at both, else choices reaching `:326` still land in `globalChoices` (`:350`) and bypass the dialog. → `PromptDialog` (`App.svelte:1584`).
- `PromptCard` shape: `{ location: "monster", overlay: true, code?, controller, sequence, … }` (`PromptRegistry.ts:1145-1164`, `toPromptCard`).
- Visual building blocks: `ZoneListDialog.svelte` (target mode, tested in `tests/component/ZoneListDialog.test.ts`), `ZoneListEntryTile.svelte` (`is-selected` support at `:92`), `CardImageLibrary.lease(code)` for art.
- Constraints source: `ActiveInteractionSpec` selection bounds (min/max) as `PromptDialog`/`FieldActionBar` consume them today — read `interaction-spec.ts` for the exact field names (`validatePromptSelection` in `prompts/prompt-selection.ts` is the validator).
- Materials list precedent (read-only browse): `material-list.ts`, `DuelField.svelte:293-294`.

## Interface contract (level 5)

- **Produces:**
  - `interaction-spec.ts`: overlay-bearing global choices are exposed distinctly, exact addition to `ActiveInteractionSpec`:
    ```ts
    readonly overlayChoices: ReadonlyMap<string, InteractionChoice>; // choiceId → choice, card.overlay === true
    ```
    populated in `mapPromptToInteractionSpec` wherever a choice with `choice.card?.overlay === true` would enter `globalEntries` (both `interaction-spec.ts:326` and `:336`); such choices go to `overlayChoices` INSTEAD of `globalEntries`. Widening the frozen public surface? — check `tests/unit/domain-boundaries.test.ts` frozen export list; `ActiveInteractionSpec` is battle-internal, expected no freeze impact.
  - New component `src/battle/app/components/duel-field/MaterialSelectDialog.svelte`: props (exact):
    ```ts
    export let choices: readonly InteractionChoice[];
    export let minSelections: number;
    export let maxSelections: number;
    export let imageLibrary: Pick<CardImageLibrary, "lease"> | null;
    export let cardBackUrl: string;
    export let disabled: boolean;
    export let onconfirm: (choiceIds: readonly string[]) => void;
    export let oncancel: (() => void) | null; // null when prompt is mandatory
    ```
    Root `data-cy="material-select-dialog"`; tiles `data-cy={`material-select-tile-${choice.id}`}`; confirm `data-cy="material-select-confirm"`; cancel `data-cy="material-select-cancel"`.
  - `App.svelte`/`DuelField.svelte` mount: when active spec has `overlayChoices.size > 0`, render `MaterialSelectDialog` instead of routing those choices to `PromptDialog`; submission path reuses the existing interaction-session `toggleChoice`/`confirm` actions (same `dispatchInteraction` contract).
- **Consumes:** `InteractionChoice` (unchanged), `PromptCard.overlay/code`, `validatePromptSelection(spec, choiceIds)` for enablement of confirm.
- **Errors:** invalid selection count → confirm disabled (no new error path); mandatory prompt (`cancelable === false` per spec field) → no cancel button.
- **Invariants:** no `code` rendered for concealed materials (card back via `cardBackUrl`); dialog is presentation only — legality stays engine-side; every element carries unique `data-cy` (`data-cy-coverage.test.ts`).
- **Integration links:** trigger effect activation requiring detach (worker engine `selectCard` over overlay cards) → dispatch `prompt` worker event → receive `mapPromptToInteractionSpec` → `overlayChoices` populated → observe dialog visible with N tiles; confirm → `respond` → engine proceeds (integration test asserts the duel advances past the cost).

## TDD

1. **Red** — unit: `mapPromptToInteractionSpec` routes overlay choices to `overlayChoices` not `globalEntries`; component: dialog renders tiles/constraints/back-for-concealed; integration: XYZ detach cost surfaces dialog data.
2. **Green** — spec field + component + mount.
3. **Refactor** — keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| unit interaction-spec | selectCard prompt, 2 overlay choices w/ code | `overlayChoices.size === 2`, `globalChoices` without them |
| unit interaction-spec | overlay choice without code | still routed, `code` undefined |
| component MaterialSelectDialog | 3 choices, min 1 max 1 | picking 2nd deselects 1st or confirm disabled until exactly 1 (match `validatePromptSelection`) |
| component MaterialSelectDialog | concealed choice | tile img src == cardBackUrl |
| component | mandatory prompt | no cancel button |
| integration | XYZ effect with detach cost | prompt maps to overlay choices; response with chosen id accepted by engine |

## Impl steps

- [ ] 1. Red unit tests on spec mapping.
- [ ] 2. Spec field + mapping change.
- [ ] 3. Component (red component tests first).
- [ ] 4. Mount + wiring; `data-cy` coverage.
- [ ] 5. Integration test with an XYZ deck preset.

## Validation

- [ ] `npm run check:headless`; component gate (NOT in check:headless): `npx vitest run tests/component/MaterialSelectDialog.test.ts tests/component/DuelField.test.ts`
- [ ] manual check: XYZ monster effect → dialog with material art → detach resolves
- [ ] silent-failure sites: none
- [ ] app functional
- [ ] commit msg draft: `feat(duel-field): visual material-select dialog for overlay costs`
