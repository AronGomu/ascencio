# T11: Card preview panel

**Plan:** `./ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
**Depends:** T4, T9
**Commit outcome:** A 22rem panel sits beside the duel field at the same height, showing the art and scrollable effect text of whichever card you hover or hold, and `CardInspector.svelte` is deleted.

## Context (self-contained)

- Goal: turn the app from a panel stack into a field-first duel client. Feedback items 17 and 18.
- This slice: the last feature. It also retires the modal card inspector, whose only remaining entry points are the HUD card list and the card trays; both now feed the panel instead.
- Out of scope here: nothing downstream. This ticket closes the plan.
- Assumptions in force: A12 (fixed `22rem` column, content sticky after the pointer leaves, stacks below the field under `64rem`), A13 (name and effect text come from `__ACTIVE_CARD_TEXTS__`).

## Requirements

- Panel renders on the same grid row as the duel field, stretched to the same height.
- Top of the panel is the card art; bottom is a scrollable effect-text region that never pushes the panel taller than the field.
- Hovering a field card, pressing and holding it, or focusing it, fills the panel.
- Content persists after the pointer leaves, so the text stays readable while you move to the panel.
- Cards whose identity is hidden never populate the panel and never clear it.
- With nothing previewed yet, the panel shows a neutral empty state.
- The panel is presentation only: no buttons, no interaction, never focusable, never blocking a click.
- `CardInspector.svelte` and every symbol that existed only to serve it are gone.
- Under `64rem` viewport width the panel moves below the field and caps at `18rem` tall.

## Inputs

- Create: `src/app/presentation/card-preview.ts`, `src/app/components/CardPreviewPanel.svelte`, `tests/unit/card-preview.test.ts`, `tests/component/CardPreviewPanel.test.ts`.
- Delete: `src/app/components/duel-field/CardInspector.svelte`.
- Edit: `src/app/App.svelte`, `src/app/components/DuelField.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/app/components/duel-field/FieldBoard.svelte`, `src/app/components/duel-field/CardControl.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts`, `tests/component/DuelHud.test.ts`, `e2e/duel-smoke.spec.ts`.
- **From Depends (T4):** the board is `width: 100%` inside `.duel-field`, so the field happily shares a grid row. **From Depends (T9):** `CardControl.svelte` no longer has `oninspect` or an inspect button; `DuelField.svelte` and `DuelFieldErrorBoundary.svelte` no longer take `oninspect`; `App.svelte` still holds `inspectedCard`, `inspectHudCard`, `closeCardInspector`, `cardInspectorTrigger`, `findPublicCard`, `isInspectableCard`, `handleGlobalKeydown` and the `<CardInspector … />` render, all serving the HUD and tray path only.
- Read only: `src/app/images/card-image-cache.ts` (`CardImageLibrary.lease(code)` returns `{ url, release() }`; leases must be released on destroy and whenever the code changes — copy the `synchronizeImageLease` pattern from the file you are deleting), `src/duel/contracts/ids.ts` (`CardCode`), `src/field/board-view-model.ts` (`BoardCardView.code` is present only when the identity is visible).

## Exact API to create

```ts
// src/app/presentation/card-preview.ts
import type { CardCode } from "../../duel/contracts/ids.ts";

export interface CardPreviewText {
  readonly name: string;
  readonly description?: string;
}

export interface CardPreviewView {
  readonly code: CardCode;
  readonly name: string;
  readonly description: string;
}

export function cardPreviewForCode(
  code: CardCode | undefined,
  cardTexts: ReadonlyMap<number, CardPreviewText>,
): CardPreviewView | null;
```

Returns `null` when `code` is `undefined`. Otherwise returns the record with `name` defaulting to `` `Card ${code}` `` and `description` defaulting to `"No card text available."`.

```svelte
<!-- src/app/components/CardPreviewPanel.svelte -->
export let preview: CardPreviewView | null = null;
export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
export let placeholderUrl = "";
```

New `DuelField.svelte` / `DuelFieldErrorBoundary.svelte` / `FieldBoard.svelte` / `CardControl.svelte` prop:

```ts
export let onpreview: (card: BoardCardView) => void = () => undefined;
```

## data-cy contract added here

`duel-row`, `card-preview-panel`, `card-preview-art`, `card-preview-image`, `card-preview-name`, `card-preview-text`, `card-preview-empty`. Removed: `card-inspector` and its children.

## TDD

1. **Red** — write `tests/unit/card-preview.test.ts` and `tests/component/CardPreviewPanel.test.ts`, and add the DuelField preview rows; record failures.
2. **Green** — resolver, panel, prop chain, App wiring, then delete the inspector.
3. **Refactor** — remove every orphaned App symbol; `npm run lint` must be clean.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `no code means no preview` | `cardPreviewForCode(undefined, texts)` | `null` |
| `known code resolves name and text` | code present in the map | `{ code, name, description }` from the map |
| `unknown code falls back` | code absent from the map | `name` is `Card <code>`, `description` is `No card text available.` |
| `missing description falls back` | map entry without `description` | `description` is `No card text available.` |
| `panel shows the empty state` | `preview: null` | `[data-cy="card-preview-empty"]` present, `[data-cy="card-preview-name"]` absent |
| `panel shows name and text` | a preview | `[data-cy="card-preview-name"]` holds the name and `[data-cy="card-preview-text"]` holds the description |
| `panel leases the image` | `imageLibrary` stub | `lease` called once with the code; the `img` `src` is the leased url |
| `panel releases the lease on change` | rerender with another code | the first lease's `release` was called once |
| `panel releases the lease on destroy` | unmount | `release` called |
| `panel is inert` | any preview | no `button`, no `a`, no element with `tabindex` |
| `hover reports a visible card` | `pointerenter` on a face-up field card | `onpreview` called once with that `BoardCardView` |
| `press reports a visible card` | `pointerdown` on the same card | `onpreview` called |
| `focus reports a visible card` | `focusin` on the card target | `onpreview` called |
| `hidden cards never report` | `pointerenter` on a face-down or opponent hand card | `onpreview` not called |
| `pointer leave keeps the panel` | `pointerleave` | no call that clears the preview — the component exposes no clear path at all |
| e2e `hovering a hand card fills the preview` | production build | after hovering the first own hand card, `[data-cy="card-preview-name"]` is non-empty and `[data-cy="card-preview-image"]` has a `src` |
| e2e `preview shares the field row` | viewport 1366×768 | the bounding boxes of `[data-cy="duel-field"]` and `[data-cy="card-preview-panel"]` have equal `y` within 2px and equal `height` within 2px |

## Impl steps

- [ ] 1. Create `tests/unit/card-preview.test.ts` with rows one to four; record failure; create `src/app/presentation/card-preview.ts`; re-run to green.
- [ ] 2. Create `tests/component/CardPreviewPanel.test.ts` (`// @vitest-environment jsdom`) with rows five to ten; record failures.
- [ ] 3. Create `src/app/components/CardPreviewPanel.svelte`: root `aside.card-preview-panel[data-cy="card-preview-panel"][aria-label="Card preview"]`, containing `div.card-preview-panel__art[data-cy="card-preview-art"]` with an `img[data-cy="card-preview-image"]` and `div.card-preview-panel__copy` with `h2[data-cy="card-preview-name"]` and `div[data-cy="card-preview-text"]`.
- [ ] 4. In that component, copy the lease lifecycle from `CardInspector.svelte`: a `synchronizeImageLease(library, code)` reactive call, `onDestroy(() => imageLease?.release())`, and `useFallbackImage` swapping to `placeholderUrl` on error.
- [ ] 5. In that component, render `p[data-cy="card-preview-empty"]` with the text `Hover a card to see its details.` when `preview === null`, and render nothing else in that state.
- [ ] 6. In `src/styles/app.css`, add `.duel-row { display: grid; grid-template-columns: minmax(0, 1fr) 22rem; gap: 1rem; align-items: stretch; }` and `@media (max-width: 64rem) { .duel-row { grid-template-columns: minmax(0, 1fr); } .card-preview-panel { max-height: 18rem; } }`.
- [ ] 7. In `src/styles/app.css`, add `.card-preview-panel { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: .75rem; min-width: 0; padding: 1rem; border: 1px solid var(--border); border-radius: .9rem; background: color-mix(in srgb, var(--surface) 94%, transparent); }`, `.card-preview-panel__art img { display: block; width: 100%; max-height: 22rem; object-fit: contain; border-radius: .5rem; }`, `.card-preview-panel__copy { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: .35rem; min-height: 0; }`, `.card-preview-panel [data-cy="card-preview-text"] { min-height: 0; overflow-y: auto; padding-right: .4rem; color: var(--muted); white-space: pre-wrap; }`.
- [ ] 8. In `src/app/components/duel-field/CardControl.svelte`, add `export let onpreview: (card: BoardCardView) => void = () => undefined;` and call it from `onpointerenter`, from `pointerDown`, and from `onfocusin` on the article — each guarded by `if (card.code !== undefined) onpreview(card);`.
- [ ] 9. In `src/app/components/duel-field/FieldBoard.svelte`, add `export let oncardpreview: (card: BoardCardView) => void = () => undefined;` and pass `onpreview={() => oncardpreview(card)}` to every `CardControl`.
- [ ] 10. In `src/app/components/DuelField.svelte`, add `export let onpreview: (card: BoardCardView) => void = () => undefined;` and pass `oncardpreview={onpreview}` to `FieldBoard`.
- [ ] 11. In `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, add the same prop and forward it.
- [ ] 12. In `src/app/App.svelte`, add `let previewCard: CardPreviewView | null = null;` and `function previewFieldCard(card: BoardCardView): void { const next = cardPreviewForCode(card.code, ACTIVE_CARD_TEXTS); if (next !== null) previewCard = next; }`.
- [ ] 13. In `src/app/App.svelte`, wrap the duel-field block and the new panel in `<div class="duel-row" data-cy="duel-row"> … <CardPreviewPanel preview={previewCard} imageLibrary={imagesMatchRuntime ? imageLibrary : null} placeholderUrl={imageLibrary?.placeholderUrl ?? DEFAULT_CARD_PLACEHOLDER} /> </div>`, keeping the `{:else if $duel.snapshot}` field-error branch inside the first column.
- [ ] 14. In `src/app/App.svelte`, pass `onpreview={previewFieldCard}` to `DuelFieldErrorBoundary`.
- [ ] 15. In `src/app/App.svelte`, repoint the HUD path: change `inspectHudCard(card, trigger)` to a `previewHudCard(card: PublicCard)` that calls `cardPreviewForCode(card.code, ACTIVE_CARD_TEXTS)` and assigns `previewCard`; keep passing it as `oninspect` to `DuelHud` so `DuelHud.svelte` and `CardTray.svelte` need no change, ignoring the trigger argument.
- [ ] 16. In `src/app/App.svelte`, delete `inspectedCard`, `cardInspectorTrigger`, `closeCardInspector()`, `isInspectableCard()`, `findPublicCard()`, the `CardInspector` import and its render block, the `inspectedCard` maintenance inside `afterUpdate`, and the `handleGlobalKeydown` function together with the `<svelte:window onkeydown={handleGlobalKeydown} />` element.
- [ ] 17. Delete `src/app/components/duel-field/CardInspector.svelte`.
- [ ] 18. In `src/styles/app.css`, delete the `.card-inspector` rules, remove `.card-inspector` from the shared panel-chrome selector list, and delete the `@media (max-width: 38rem) { .card-inspector { … } }` block.
- [ ] 19. Add rows eleven to fifteen to `tests/component/DuelField.test.ts`.
- [ ] 20. Run `npx vitest run tests/unit/card-preview.test.ts tests/component/CardPreviewPanel.test.ts tests/component/DuelField.test.ts` to green.
- [ ] 21. Run `npm run test:component`; update `tests/component/DuelHud.test.ts` only where it asserted the inspector opened — the HUD's own `Inspect …` buttons keep their labels and still fire `oninspect`.
- [ ] 22. In `e2e/duel-smoke.spec.ts`, add the two e2e rows as one new test, and delete or repoint any assertion that expected a `card-inspector` region.
- [ ] 23. Run `npm run test:e2e` to green.
- [ ] 24. Run `npx vitest run tests/unit/data-cy-coverage.test.ts` to green.

## Outputs

- Files created: `src/app/presentation/card-preview.ts`, `src/app/components/CardPreviewPanel.svelte`, two test files.
- Files deleted: `src/app/components/duel-field/CardInspector.svelte`.
- Files edited: `src/app/App.svelte`, `src/app/components/DuelField.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/app/components/duel-field/FieldBoard.svelte`, `src/app/components/duel-field/CardControl.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts`, `tests/component/DuelHud.test.ts`, `e2e/duel-smoke.spec.ts`.
- Public API: `cardPreviewForCode`, `CardPreviewView`; `onpreview` on the field prop chain.
- Migrate / config: none.

## Validation

- [ ] `npx vitest run tests/unit/card-preview.test.ts tests/component/CardPreviewPanel.test.ts` passes
- [ ] `npm run test:unit && npm run test:component` passes
- [ ] `npm run typecheck && npm run lint` passes
- [ ] `npm run format` then `npm run format:check` passes
- [ ] `npm run check` passes end to end — this is the final ticket, so run the full gate
- [ ] manual check: `npm run dev`, hover each hand card and watch the panel fill; hold the pointer down on a field monster and confirm the same; confirm long effect text scrolls inside the panel without stretching the field; shrink the window below 64rem and confirm the panel drops beneath the field
- [ ] app functional — all eighteen feedback items are visible in one session
- [ ] commit msg draft: `feat(app): show hovered card art and text in a preview panel`
