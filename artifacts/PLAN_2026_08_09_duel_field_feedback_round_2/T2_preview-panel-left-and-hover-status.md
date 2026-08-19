# T2: Preview panel on the left, hover everywhere, status line

**Plan:** `./artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md`
**Depends:** T1
**Commit outcome:** The card preview column renders to the left of the board, every hoverable field surface (including face-down cards and stacks) updates it, and it gains a status line under the card text that later tickets fill with the current action state.

## Context (self-contained)

- Goal: ship 17 duel-field feedback items. This slice is items 2 and 3, plus the display surface that item 16 needs.
- This slice: `src/app/components/CardPreviewPanel.svelte` currently renders to the **right** of the board inside `.duel-row` (`grid-template-columns: minmax(0, 1fr) 22rem`) and only updates when a *face-up* board card is hovered — `CardControl.svelte`'s `reportPreview()` bails out when `card.code === undefined`. Stacks never update it. The panel shows art, name and scrollable text and nothing else.
- Out of scope here: the zone list dialog (T8), what the status line says during a chain (T11), the phase strip (T3), any change to how card text is sourced.
- Assumptions in force:
  - **A13** the in-field status pills are deleted in T3; this ticket only adds the status *surface*, it does not remove the pills.
- **From Depends (T1):** `src/app/components/DuelHeaderBar.svelte` exists and owns the life-point readouts. `src/app/components/duel-field/LifePointsPill.svelte` is deleted and `DuelField.svelte` no longer has a `lifePoints` prop. Do not reintroduce either.

## Requirements

1. `.duel-row` in `src/styles/app.css` becomes `grid-template-columns: 22rem minmax(0, 1fr)` and the `CardPreviewPanel` is moved **before** the field block in `src/app/App.svelte`'s `.duel-row` markup, so the preview is the left column in both DOM and visual order. The existing `@media (max-width: 79rem)` collapse to `minmax(0, 1fr)` stays; under that breakpoint the preview stacks **above** the field (which is what moving it first in the DOM already gives).
2. New module `src/app/presentation/preview-status.ts` exporting:
   ```ts
   export interface CardPreviewStatus {
     readonly text: string;
     /** Renders the animated three-dot "thinking" indicator after `text`. */
     readonly thinking: boolean;
   }
   export function previewStatusFor(
     prompt: PlayerPrompt | null,
     responsePending: boolean,
   ): CardPreviewStatus | null;
   ```
   Rules, in order:
   - `responsePending === true` → `{ text: "Waiting for the engine", thinking: true }`
   - `prompt === null` → `{ text: "Opponent is acting", thinking: true }`
   - otherwise → `{ text: prompt.title, thinking: false }`
   T11 extends this function; do not add chain-specific text here.
3. `CardPreviewPanel.svelte` gains `export let status: CardPreviewStatus | null = null;` and renders it **under** the card text block, inside the panel, whether or not a card is previewed. The three-dot indicator is three `<span>`s animated by CSS keyframes; when `prefers-reduced-motion: reduce` matches, the dots are rendered but the animation is suppressed by the media query (no JS branch).
4. Hovering a **face-down / hidden** board card updates the preview to a hidden-card view instead of leaving the previous card up. Add to `src/app/presentation/card-preview.ts`:
   ```ts
   export const HIDDEN_CARD_PREVIEW: CardPreviewView = Object.freeze({
     code: 0 as CardCode,
     name: "Face-down card",
     description: "No information is available for this card.",
   });
   ```
   `CardControl.svelte`'s `reportPreview()` stops guarding on `card.code !== undefined` and always calls `onpreview(card)`. `App.svelte`'s `previewFieldCard(card)` becomes: if `card.code === undefined` set `previewCard = HIDDEN_CARD_PREVIEW`, else resolve as today. `CardPreviewPanel` must not attempt an image lease when `preview.code === 0`; it renders `placeholderUrl` instead. Guard: `code !== undefined && code > 0` in `synchronizeImageLease`.
5. Hovering a **stack** updates the preview. `StackControl.svelte` gains `export let onpreview: () => void = () => undefined;` fired from `onpointerenter` and `onfocusin`. `FieldBoard.svelte` gains `export let onstackpreview: (stack: BoardStackView) => void = () => undefined;` and wires it. `DuelField.svelte` gains `export let onstackpreview: (stack: BoardStackView) => void = () => undefined;` and forwards it; `DuelFieldErrorBoundary.svelte` forwards it too. `App.svelte` implements it as: resolve the stack's top public card code via the new `stackTopCode` helper below; if `undefined`, set `HIDDEN_CARD_PREVIEW`, else resolve through `cardPreviewForCode`.
6. `BoardStackView` gains `readonly topCardCode?: CardCode;` in `src/field/board-view-model.ts`, populated in `createStacks` from the same `top` record that already produces `topCardLabel` (`top?.code`). Nothing else consumes it in this ticket; T7 renders it.
7. Every new rendered element carries a unique kebab-case `data-cy`.

### Exact `data-cy` values

| Element | `data-cy` |
| --- | --- |
| status wrapper `<p>` in the preview panel | `card-preview-status` |
| status text `<span>` | `card-preview-status-text` |
| dots wrapper `<span>` | `card-preview-status-dots` |
| each dot `<span>` | `card-preview-status-dot-1`, `-2`, `-3` |

### `stackTopCode` helper

Add to `src/app/presentation/card-preview.ts`:

```ts
/** The code of the last public card in a stack, or `undefined` when nothing in it is public. */
export function stackTopCode(
  stack: { readonly topCardCode?: CardCode },
): CardCode | undefined {
  return stack.topCardCode;
}
```

## Inputs

- `src/app/App.svelte` — the `.duel-row` block (`<div class="duel-row" data-cy="duel-row">` … `<CardPreviewPanel … />` … `</div>`), `previewFieldCard`, `previewCard`, the `DuelFieldErrorBoundary` call site.
- `src/app/components/CardPreviewPanel.svelte` — full file.
- `src/app/components/duel-field/CardControl.svelte` — `reportPreview()` (guards on `card.code !== undefined`), `onpointerenter`, `onfocusin`.
- `src/app/components/duel-field/StackControl.svelte` — full file (39 lines).
- `src/app/components/duel-field/FieldBoard.svelte` — the `{#each board.stacks as stack (stack.targetId)}` block.
- `src/app/components/DuelField.svelte` — the `<FieldBoard … />` call site.
- `src/app/components/duel-field/DuelFieldErrorBoundary.svelte` — prop forwarding.
- `src/app/presentation/card-preview.ts` — `CardPreviewView`, `cardPreviewForCode`.
- `src/field/board-view-model.ts` — `BoardStackView` interface and `createStacks`.
- `src/styles/app.css` — `.duel-row` (around line 221) and `.card-preview-panel*` rules (around lines 228-274).
- `tests/component/CardPreviewPanel.test.ts`, `tests/unit/card-preview.test.ts`, `tests/component/DuelField.test.ts`, `tests/fixtures/board-view-model.ts`.
- **From Depends (T1):** `DuelHeaderBar.svelte` exists; `DuelField` has no `lifePoints` prop; `LifePointsPill.svelte` is gone.

## TDD

1. **Red** — add `tests/unit/preview-status.test.ts` and the new cases in `tests/component/CardPreviewPanel.test.ts`, `tests/unit/card-preview.test.ts` and `tests/component/DuelField.test.ts`. Run `npm run test:unit && npm run test:component`; all new cases must fail.
2. **Green** — implement `preview-status.ts`, the panel status block, the hidden-card preview, the stack hover wiring, `topCardCode`, and the CSS column swap.
3. **Refactor** — only if needed. Keep green.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `previewStatusFor reports the engine wait first` | `previewStatusFor(somePrompt, true)` | `{ text: "Waiting for the engine", thinking: true }` |
| `previewStatusFor reports the opponent turn` | `previewStatusFor(null, false)` | `{ text: "Opponent is acting", thinking: true }` |
| `previewStatusFor echoes the prompt title` | `previewStatusFor({ …, title: "Choose a Main Phase action" }, false)` | `{ text: "Choose a Main Phase action", thinking: false }` |
| `panel renders the status under the card text` | render `CardPreviewPanel` with a preview and `status={{ text: "Choose", thinking: false }}` | `card-preview-status-text` text is `Choose`; `card-preview-status-dots` is absent |
| `panel renders thinking dots` | `status={{ text: "Do you respond?", thinking: true }}` | `card-preview-status-dot-1/-2/-3` all present |
| `panel renders the status with no card previewed` | `preview={null}`, `status={{ text: "Opponent is acting", thinking: true }}` | `card-preview-empty` **and** `card-preview-status-text` both present |
| `panel does not lease an image for the hidden preview` | `preview=HIDDEN_CARD_PREVIEW`, `imageLibrary` spy | `imageLibrary.lease` never called; `card-preview-image` `src` is `placeholderUrl` |
| `hovering a face-down field card previews the hidden card` | render `DuelField` with a hidden card, `pointerenter` on it | `onpreview` called with that card (assert on the `BoardCardView` passed) |
| `hovering a stack previews it` | render `DuelField` with the standard board fixture, `pointerenter` on `field-stack-p0:graveyard` | `onstackpreview` called once with the `p0:graveyard` stack |
| `stacks expose the top public card code` | `mapSnapshotToBoard` over a snapshot with two face-up graveyard cards | the `p0:graveyard` stack's `topCardCode` equals the second card's `code` |
| `preview column renders before the field` | render `App`-level markup or assert in e2e | `duel-row`'s first element child carries `data-cy="card-preview-panel"` |

## Impl steps

- [x] 1. Create `tests/unit/preview-status.test.ts` with the three `previewStatusFor` cases.
- [x] 2. Add the four new `CardPreviewPanel` cases to `tests/component/CardPreviewPanel.test.ts`.
- [x] 3. Add the `HIDDEN_CARD_PREVIEW` and `stackTopCode` cases to `tests/unit/card-preview.test.ts`, and the `topCardCode` case to whichever test file covers `mapSnapshotToBoard` (`tests/unit/duel-field.test.ts`).
- [x] 4. Add the two hover cases to `tests/component/DuelField.test.ts`.
- [x] 5. Run `npm run test:unit && npm run test:component`; confirm the new cases fail.
- [x] 6. Create `src/app/presentation/preview-status.ts` with `CardPreviewStatus` and `previewStatusFor` exactly as specified.
- [x] 7. In `src/app/presentation/card-preview.ts`, add `HIDDEN_CARD_PREVIEW` and `stackTopCode`.
- [x] 8. In `src/field/board-view-model.ts`, add `readonly topCardCode?: CardCode;` to `BoardStackView` and spread `...(top?.code === undefined ? {} : { topCardCode: top.code })` into the frozen stack object in `createStacks`.
- [x] 9. In `src/app/components/CardPreviewPanel.svelte`, add the `status` prop, render the status block after `.card-preview-panel__copy` (and also when `preview === null`), and change `synchronizeImageLease` to treat `code === 0` as "no lease".
- [x] 10. In `src/app/components/duel-field/CardControl.svelte`, drop the `card.code !== undefined` guard inside `reportPreview()`.
- [x] 11. In `src/app/components/duel-field/StackControl.svelte`, add `export let onpreview: () => void = () => undefined;` and `onpointerenter={onpreview}` / `onfocusin={onpreview}` on the root `<div>`.
- [x] 12. In `src/app/components/duel-field/FieldBoard.svelte`, add `export let onstackpreview: (stack: BoardStackView) => void = () => undefined;` and pass `onpreview={() => onstackpreview(stack)}` in the stack loop.
- [x] 13. In `src/app/components/DuelField.svelte`, add `export let onstackpreview: (stack: BoardStackView) => void = () => undefined;` and forward it to `FieldBoard`.
- [x] 14. In `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, declare and forward `onstackpreview`.
- [x] 15. In `src/app/App.svelte`: import `HIDDEN_CARD_PREVIEW` and `previewStatusFor`; change `previewFieldCard` to set `HIDDEN_CARD_PREVIEW` when `card.code === undefined`; add `previewStackCard(stack: BoardStackView)`; add `$: previewStatus = previewStatusFor($duel.prompt, $duel.responsePending);` and pass `status={previewStatus}` to `CardPreviewPanel`; pass `onstackpreview={previewStackCard}`.
- [x] 16. In `src/app/App.svelte`, move the `<CardPreviewPanel … />` element so it is the **first** child of `<div class="duel-row">`.
- [x] 17. In `src/styles/app.css`, change `.duel-row` to `grid-template-columns: 22rem minmax(0, 1fr);`, and add:
  ```css
  .card-preview-panel__status { margin: 0; display: flex; align-items: center; gap: 0.35rem; color: var(--muted); font-size: 0.82rem; }
  .card-preview-status-dots { display: inline-flex; gap: 0.15rem; }
  .card-preview-status-dots span { width: 0.28rem; height: 0.28rem; border-radius: 999px; background: currentcolor; animation: preview-status-dot 1.2s infinite ease-in-out; }
  .card-preview-status-dots span:nth-child(2) { animation-delay: 0.2s; }
  .card-preview-status-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes preview-status-dot { 0%, 80%, 100% { opacity: 0.15; } 40% { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .card-preview-status-dots span { animation: none; opacity: 0.6; } }
  ```
  Also change `.card-preview-panel` to `grid-template-rows: auto minmax(0, 1fr) auto;` so the status row sits at the bottom.
- [x] 18. Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:component`.

## Outputs

- Added: `src/app/presentation/preview-status.ts`, `tests/unit/preview-status.test.ts`.
- Edited: `src/app/App.svelte`, `src/app/components/CardPreviewPanel.svelte`, `src/app/components/DuelField.svelte`, `src/app/components/duel-field/CardControl.svelte`, `src/app/components/duel-field/StackControl.svelte`, `src/app/components/duel-field/FieldBoard.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/app/presentation/card-preview.ts`, `src/field/board-view-model.ts`, `src/styles/app.css`, plus the four test files.
- Public contract for successors:
  - `previewStatusFor(prompt, responsePending): CardPreviewStatus | null` in `src/app/presentation/preview-status.ts`, with `CardPreviewStatus = { text: string; thinking: boolean }`.
  - `HIDDEN_CARD_PREVIEW` and `stackTopCode(stack)` in `src/app/presentation/card-preview.ts`.
  - `BoardStackView.topCardCode?: CardCode`.
  - `DuelField` / `DuelFieldErrorBoundary` / `FieldBoard` accept `onstackpreview: (stack: BoardStackView) => void`.
  - `CardPreviewPanel` accepts `status: CardPreviewStatus | null`.
  - Preview panel status `data-cy` values: `card-preview-status`, `card-preview-status-text`, `card-preview-status-dots`, `card-preview-status-dot-1|-2|-3`.
- No migration, no config change.

## Validation

- [x] `npm run format:check` exits 0
- [x] `npm run lint` exits 0
- [x] `npm run typecheck` exits 0
- [x] `npm run test:unit` exits 0
- [x] `npm run test:component` exits 0
- [ ] manual check: `npm run dev`; the preview sits left of the board, hovering a face-down card shows `Face-down card`, hovering the graveyard shows its top card, and the status line reads the current prompt title
- [ ] app functional — the board still renders and remains clickable at 1024px width (the preview column must not push a horizontal scrollbar)
- [ ] commit msg draft: `feat(app): move the card preview left and follow every field hover`
</content>
