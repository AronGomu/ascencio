# T11: Card preview panel

**Plan:** `./artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
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
- ~~Under `64rem` viewport width the panel moves below the field and caps at `18rem` tall.~~ **Superseded 2026-08-09 — see "Breakpoint correction" below. The panel stacks below the field under `79rem` (1264px), still capped at `18rem` tall.**

### Breakpoint correction (amended 2026-08-09 — the parent did this arithmetic, do not re-derive)

Assumption A12's `64rem` stacking breakpoint is **not achievable** and shipping it fails an existing e2e gate. The numbers:

- `main { width: min(120rem, calc(100% - 2rem)) }` (`src/styles/app.css:139`).
- `.duel-field` adds `1rem` padding per side; `.duel-field-board` keeps `min-width: 52rem` (832px) so every field target stays ≥44px — a T4 invariant that outranks avoiding a scrollbar.
- Side by side, the field column is `mainWidth − 22rem panel − 1rem gap`, and its content box is that minus `2rem` of field padding.

| Viewport | `main` | field column | board box | fits 832px? |
| --- | --- | --- | --- | --- |
| VP-01 1366 | 1334 | 966 | 934 | yes |
| VP-04 1024 | 992 | 624 | 592 | **no — overflows by 240px** |

`e2e/duel-smoke.spec.ts` asserts `scrollWidth <= clientWidth + 1` for every viewport at `width >= 1024`, and `VP-04` is exactly 1024. A `64rem` breakpoint therefore leaves the panel beside the field at VP-04 and fails that gate.

Solving `mainWidth − 352 − 16 − 32 >= 832` gives `mainWidth >= 1232`, i.e. **viewport >= 1264px = 79rem**. So:

- Stack below `79rem`: `@media (max-width: 79rem) { … }`. VP-01 (1366) and VP-02 (1920) keep the side-by-side layout; VP-04 and everything narrower stack, exactly as they render today.
- Do **not** instead relax or exempt the `>= 1024` no-overflow assertion. It is a T4 invariant and a hard gate.
- If your measured numbers disagree with the table above, trust your measurements over this table, pick the breakpoint that satisfies both constraints, and record it under Assumptions.

## Inputs

- Create: `src/app/presentation/card-preview.ts`, `src/app/components/CardPreviewPanel.svelte`, `tests/unit/card-preview.test.ts`, `tests/component/CardPreviewPanel.test.ts`.
- Delete: `src/app/components/duel-field/CardInspector.svelte`.
- Edit: `src/app/App.svelte`, `src/app/components/DuelField.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/app/components/duel-field/FieldBoard.svelte`, `src/app/components/duel-field/CardControl.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts`, `tests/component/DuelHud.test.ts`, `e2e/duel-smoke.spec.ts`.
- **From Depends (T4):** the board is `width: 100%` inside `.duel-field`, so the field happily shares a grid row. **From Depends (T9):** `CardControl.svelte` no longer has `oninspect` or an inspect button; `DuelField.svelte` and `DuelFieldErrorBoundary.svelte` no longer take `oninspect`; `App.svelte` still holds `inspectedCard`, `inspectHudCard`, `closeCardInspector`, `cardInspectorTrigger`, `findPublicCard`, `isInspectableCard`, `handleGlobalKeydown` and the `<CardInspector … />` render, all serving the HUD and tray path only.
- **From Depends (T10) — drift since this ticket was written (added 2026-08-09; the parent verified each against the shipped code):**
  - The prop chain you are extending with `onpreview` is longer than this ticket assumed. `DuelField.svelte` also has `hitTest: (x, y) => Element | null` and `onplacementintent: (zoneId: PhysicalZoneId) => unknown`; `DuelFieldErrorBoundary.svelte` also has `onplacementintent`; `CardControl.svelte` also has `draggable`, `ondragstart`, `ondragmove`, `ondragend`; `ZoneControl.svelte` also has `dropCandidate`. Thread `onpreview` alongside them, do not replace them.
  - **`CardControl.svelte`'s `pointerdown` is now load-bearing for drag.** It records `pointerOrigin`, and a move beyond 8px starts a drag and suppresses the click. Test-plan row `press reports a visible card` fires the preview on `pointerdown`, which is fine — but your handler must not consume the event, reorder the existing handlers, or disturb `pointerOrigin` / `pointerMoved`. A regression here silently breaks drag-to-play, which has its own e2e test.
  - `section.duel-field` carries `data-dragging` while a drag is active, and `.duel-field[data-dragging="true"] .card-action-chips { pointer-events: none; }` exists. If the preview panel ever needs a pointer-events rule, follow that precedent rather than inventing a new mechanism.
  - **Svelte `bind:this` writes `null`, not `undefined`, on unmount.** T9 shipped a crash from exactly this. Guard element refs with `=== null`. The field's error boundary swallows the error, so the symptom is a blank field with no stack trace.
  - Three e2e gates in the responsive-viewport test must stay green and unweakened: action bar vs board non-intersection, `[data-cy="field-end-turn-button"]` vs board non-intersection, and the `>= 1024` no-horizontal-overflow assertion. Your layout change touches the third directly — see the Breakpoint correction above.
  - **A `@container` query cannot style its own query container**, only descendants. `.duel-field` declares `container: duel-field / inline-size`, so `@container duel-field (...) { .duel-field { … } }` silently no-ops. Use `@media` for `.duel-field` itself.
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

- [x] 1. Create `tests/unit/card-preview.test.ts` with rows one to four; record failure; create `src/app/presentation/card-preview.ts`; re-run to green. — red: `Cannot find module '../../src/app/presentation/card-preview.ts'`; green: `npx vitest run tests/unit/card-preview.test.ts` → 4 passed.
- [x] 2. Create `tests/component/CardPreviewPanel.test.ts` (`// @vitest-environment jsdom`) with rows five to ten; record failures. — red: `Failed to resolve import "../../src/app/components/CardPreviewPanel.svelte"`.
- [x] 3. Create `src/app/components/CardPreviewPanel.svelte`: root `aside.card-preview-panel[data-cy="card-preview-panel"][aria-label="Card preview"]`, containing `div.card-preview-panel__art[data-cy="card-preview-art"]` with an `img[data-cy="card-preview-image"]` and `div.card-preview-panel__copy` with `h2[data-cy="card-preview-name"]` and `div[data-cy="card-preview-text"]`. — green: `npx vitest run tests/component/CardPreviewPanel.test.ts` → 6 passed.
- [x] 4. In that component, copy the lease lifecycle from `CardInspector.svelte`: a `synchronizeImageLease(library, code)` reactive call, `onDestroy(() => imageLease?.release())`, and `useFallbackImage` swapping to `placeholderUrl` on error. — lease lifecycle copied; rows `panel leases the image` / `releases on change` / `releases on destroy` pass.
- [x] 5. In that component, render `p[data-cy="card-preview-empty"]` with the text `Hover a card to see its details.` when `preview === null`, and render nothing else in that state. — row `panel shows the empty state` passes.
- [x] 6. In `src/styles/app.css`, add `.duel-row { display: grid; grid-template-columns: minmax(0, 1fr) 22rem; gap: 1rem; align-items: stretch; }` and `@media (max-width: 79rem) { .duel-row { grid-template-columns: minmax(0, 1fr); } .card-preview-panel { max-height: 18rem; } }`. **The breakpoint is `79rem`, not the `64rem` this step originally said** — see the Breakpoint correction in Requirements; `64rem` fails the `>= 1024` no-overflow e2e gate at VP-04. Validate: at VP-01 the field and panel share a row with no horizontal overflow; at VP-04 the panel is stacked below and the field is full width. — `.duel-row` + `@media (max-width: 79rem)` added. Verified in chromium: the responsive test now asserts panel-beside-field at VP-01/VP-02 and panel-stacked-below with a full-width field at VP-04/05/06/07, and `assertNoPageWideHorizontalOverflow` passes at every viewport.
- [x] 7. In `src/styles/app.css`, add `.card-preview-panel { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: .75rem; min-width: 0; padding: 1rem; border: 1px solid var(--border); border-radius: .9rem; background: color-mix(in srgb, var(--surface) 94%, transparent); }`, `.card-preview-panel__art img { display: block; width: 100%; max-height: 22rem; object-fit: contain; border-radius: .5rem; }`, `.card-preview-panel__copy { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: .35rem; min-height: 0; }`, `.card-preview-panel [data-cy="card-preview-text"] { min-height: 0; overflow-y: auto; padding-right: .4rem; color: var(--muted); white-space: pre-wrap; }`. — `src/styles/app.css` `.card-preview-panel` rules added; `npx vitest run tests/unit/global-styles.test.ts` still green.
- [x] 8. In `src/app/components/duel-field/CardControl.svelte`, add `export let onpreview: (card: BoardCardView) => void = () => undefined;` and call it from `onpointerenter`, from `pointerDown`, and from `onfocusin` on the article — each guarded by `if (card.code !== undefined) onpreview(card);`. — `npm run test:component` 120 passed incl. `press reports a visible card` asserting the drag still starts after the preview call.
- [x] 9. In `src/app/components/duel-field/FieldBoard.svelte`, add `export let oncardpreview: (card: BoardCardView) => void = () => undefined;` and pass `onpreview={() => oncardpreview(card)}` to every `CardControl`. — `oncardpreview` forwarded per card; DuelField preview rows green.
- [x] 10. In `src/app/components/DuelField.svelte`, add `export let onpreview: (card: BoardCardView) => void = () => undefined;` and pass `oncardpreview={onpreview}` to `FieldBoard`. — `oncardpreview={onpreview}`; DuelField preview rows green.
- [x] 11. In `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, add the same prop and forward it. — `onpreview` forwarded through the boundary; `npm run typecheck` 0 errors.
- [x] 12. In `src/app/App.svelte`, add `let previewCard: CardPreviewView | null = null;` and `function previewFieldCard(card: BoardCardView): void { const next = cardPreviewForCode(card.code, ACTIVE_CARD_TEXTS); if (next !== null) previewCard = next; }`. — `previewFieldCard` added; `npm run typecheck` 0 errors.
- [x] 13. In `src/app/App.svelte`, wrap the duel-field block and the new panel in `<div class="duel-row" data-cy="duel-row"> … <CardPreviewPanel preview={previewCard} imageLibrary={imagesMatchRuntime ? imageLibrary : null} placeholderUrl={imageLibrary?.placeholderUrl ?? DEFAULT_CARD_PLACEHOLDER} /> </div>`, keeping the `{:else if $duel.snapshot}` field-error branch inside the first column. — `.duel-row` wraps the field block and the panel; field-error branch stays in the first column.
- [x] 14. In `src/app/App.svelte`, pass `onpreview={previewFieldCard}` to `DuelFieldErrorBoundary`. — `onpreview={previewFieldCard}` on `DuelFieldErrorBoundary`.
- [x] 15. In `src/app/App.svelte`, repoint the HUD path: change `inspectHudCard(card, trigger)` to a `previewHudCard(card: PublicCard)` that calls `cardPreviewForCode(card.code, ACTIVE_CARD_TEXTS)` and assigns `previewCard`; keep passing it as `oninspect` to `DuelHud` so `DuelHud.svelte` and `CardTray.svelte` need no change, ignoring the trigger argument. — `previewHudCard(card: PublicCard)` wired as `oninspect`; `DuelHud.svelte`/`CardTray.svelte` untouched.
- [x] 16. In `src/app/App.svelte`, delete `inspectedCard`, `cardInspectorTrigger`, `closeCardInspector()`, `isInspectableCard()`, `findPublicCard()`, the `CardInspector` import and its render block, the `inspectedCard` maintenance inside `afterUpdate`, and the `handleGlobalKeydown` function together with the `<svelte:window onkeydown={handleGlobalKeydown} />` element. — all symbols removed; `npm run lint` reports 0 problems (no unused symbols).
- [x] 17. Delete `src/app/components/duel-field/CardInspector.svelte`. — `src/app/components/duel-field/CardInspector.svelte` deleted; repo-wide grep for `CardInspector` in `src/` returns nothing.
- [x] 18. In `src/styles/app.css`, delete the `.card-inspector` rules, remove `.card-inspector` from the shared panel-chrome selector list, and delete the `@media (max-width: 38rem) { .card-inspector { … } }` block. — repo grep `card-inspector` in `src/styles/app.css` → no match.
- [x] 19. Add rows eleven to fifteen to `tests/component/DuelField.test.ts`. — rows eleven to fifteen added to `tests/component/DuelField.test.ts`.
- [x] 20. Run `npx vitest run tests/unit/card-preview.test.ts tests/component/CardPreviewPanel.test.ts tests/component/DuelField.test.ts` to green. — `npx vitest run tests/unit/card-preview.test.ts tests/component/CardPreviewPanel.test.ts tests/component/DuelField.test.ts` → 68 passed.
- [x] 21. Run `npm run test:component`; update `tests/component/DuelHud.test.ts` only where it asserted the inspector opened — the HUD's own `Inspect …` buttons keep their labels and still fire `oninspect`. — `npm run test:component` → 10 files, 120 passed; removed the `CardInspector` describe block and import from `tests/component/DuelHud.test.ts`.
- [x] 22. In `e2e/duel-smoke.spec.ts`, add the two e2e rows as one new test, and delete or repoint any assertion that expected a `card-inspector` region. — added `hovering a hand card fills the preview panel sharing the field row`; no `card-inspector` assertion existed in `e2e/duel-smoke.spec.ts` (grep returned nothing) so nothing needed repointing.
- [x] 23. Run e2e to green — validate: `--project=chromium` full spec 0 failures **run twice** (the duel seed is random per run, see Environment), plus `--project=firefox-smoke` green. Pay particular attention to `responsive field compositions contain controls across supported viewports`: it carries all three gates your layout change can break (action bar vs board, corner button vs board, and `>= 1024` no horizontal overflow). — chromium full spec run 1 → `18 passed (48.6s)`; run 2 → `17 passed, 1 skipped (1.1m)` (the skip is the drag test's own seed-dependent `test.skip`, re-run separately `--repeat-each=6` → `6 passed`). `firefox-smoke` → `1 passed`. `responsive field compositions …` green in both runs.
- [x] 24. Run `npx vitest run tests/unit/data-cy-coverage.test.ts` to green. — `npx vitest run tests/unit/data-cy-coverage.test.ts` → passed.
- [x] 25. Confirm the new `duel-row` layout did not reintroduce horizontal overflow — validate: the VP-01 and VP-04 branches of the responsive test pass, and `assertNoPageWideHorizontalOverflow` passes at every viewport. — the VP-01 and VP-04 branches of the new panel-layout assertion pass, and `assertNoPageWideHorizontalOverflow` passes at all six viewports in both chromium runs.

## Outputs

- Files created: `src/app/presentation/card-preview.ts`, `src/app/components/CardPreviewPanel.svelte`, two test files.
- Files deleted: `src/app/components/duel-field/CardInspector.svelte`.
- Files edited: `src/app/App.svelte`, `src/app/components/DuelField.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/app/components/duel-field/FieldBoard.svelte`, `src/app/components/duel-field/CardControl.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts`, `tests/component/DuelHud.test.ts`, `e2e/duel-smoke.spec.ts`.
- Public API: `cardPreviewForCode`, `CardPreviewView`; `onpreview` on the field prop chain.
- Migrate / config: none.

## Validation

- [x] `npx vitest run tests/unit/card-preview.test.ts tests/component/CardPreviewPanel.test.ts` passes — 10 passed.
- [x] `npm run test:unit && npm run test:component` passes — 451 passed (44 files) + 120 passed (10 files).
- [x] `npm run typecheck && npm run lint` passes — `623 FILES 0 ERRORS 0 WARNINGS`; eslint 0 problems.
- [x] `npm run format` then `npm run format:check` passes — `All matched files use Prettier code style!`
- [x] `npx vitest run tests/unit/data-cy-coverage.test.ts` passes — passed.
- [x] e2e green: chromium full spec twice + firefox-smoke (webkit-smoke env-blocked, note it, do not treat as failure) — chromium 18/18 then 17 passed + 1 seed-skip (drag re-run 6/6); firefox-smoke 1 passed. webkit-smoke still env-blocked: `MiniBrowser: error while loading shared libraries: libatk-1.0.so.0` outside a nix closure — standing environment gap, not a code defect.
- [x] all three responsive gates still green and unweakened: action bar vs board, corner button vs board, and `>= 1024` no horizontal overflow — `responsive field compositions contain controls across supported viewports` passed in both full chromium runs with the action-bar/board, End-turn-button/board and `>= 1024` no-overflow assertions untouched (only added assertions).
- [x] drag-to-play still works — `dragging a hand card onto a highlighted zone plays it` passes in both chromium runs (your `pointerdown` preview handler shares that event) — `dragging a hand card onto a highlighted zone plays it` passed in chromium run 1 and 6/6 under `--repeat-each=6`; run 2 hit its own pre-existing seed-dependent `test.skip`.
- [ ] `npm run check` passes end to end — run the full gate. (Note: T8 still follows this ticket in execution order, so this is the last *feature* ticket but not the last commit.) — `npm run check:headless` exit 0; `npm run test:component` 120 passed; `npm run build` exit 0 (`build:verify` ok, 70 runtime files); `npm run build:reproducible` `{"status":"ok","files":107}`; `npm run test:e2e` run per project — chromium and firefox-smoke green, webkit-smoke env-blocked as above, so the single umbrella `npm run check` command cannot return 0 in this sandbox for a reason that predates this ticket.
- [ ] manual check: `npm run dev`, hover each hand card and watch the panel fill; hold the pointer down on a field monster and confirm the same; confirm long effect text scrolls inside the panel without stretching the field; shrink the window below 79rem and confirm the panel drops beneath the field — not executed by the worker; the human steps are written up in `artifacts/manual_test_checklist.md` under `## T11 card-preview-panel`.
- [ ] app functional — every feedback item shipped so far is visible in one session — not verified by the worker beyond the automated gates; deferred to the manual checklist.
- [x] commit msg draft: `feat(app): show hovered card art and text in a preview panel` — `feat(app): show hovered card art and text in a preview panel`.

## Assumptions (worker, 2026-08-09)

1. **Breakpoint kept at `79rem`.** Measured layout agrees with the ticket's table: at VP-01 (1366) the field column is 966px and the board content box 934px ≥ 832px, at VP-04 (1024) the panel stacks and the full-width field's content box is 960px ≥ 832px. No horizontal overflow at any of the six responsive viewports.
2. **`data-cy="card-preview-copy"` added to `div.card-preview-panel__copy`.** Not in the ticket's data-cy contract, but `tests/unit/data-cy-coverage.test.ts` requires every element under `src/app` to declare a `data-cy`, and step 7's CSS needs the wrapper.
3. **`previewCard` is cleared on a worker/session generation change** — it takes the slot the deleted `inspectedCard = null` occupied inside `afterUpdate`. Without it the panel's image lease survives a duel restart, its object URL is active in both DF-16 resource snapshots, and `obsoleteObjectUrlOverlap` → `objectUrlLeak` fails a hard gate. "Content persists after the pointer leaves" is preserved within a duel; only a new duel resets the panel.
4. **`previewHudCard` guards with `if (next !== null)`**, mirroring step 12's `previewFieldCard`, so a hidden card never clears the panel (Requirements bullet 5).
5. **`.duel-row` wraps both field branches.** The `{#if duelBoard}` / `{:else if $duel.snapshot}` pair is nested inside one `{#if duelBoard || $duel.snapshot}`, so the row mounts for the field-error branch too and that branch stays in the first column as step 13 requires.
6. **The responsive e2e test gained one assertion, and none were weakened.** A `duel-row` layout check now asserts panel-beside-field above 1264px and panel-stacked-below-a-full-width-field at or under it, at every viewport in `RESPONSIVE_VIEWPORTS`.
7. **Residual risk (not fixed, out of scope):** `src/app/components/duel-field/DuelHud.svelte:190` still carries `aria-controls="card-inspector"`, now pointing at an id that no longer exists. `DuelHud.svelte` is deliberately outside this ticket's edit list.

## Environment (inlined 2026-08-09 — these cost ~1 h to discover, do not rediscover them)

- **The `ship` skill is not installed here** (`Unknown skill: ship`). Run this ticket's own Requirements → TDD → Impl → Validation loop directly, at the same evidence bar.
- **Playwright runs must be foreground.** They take 1-5 min; the Bash timeout ceiling is 600 s. A previous worker backgrounded them and idled ~40 min.
- **The duel seed is random per run** — `createProductionSeed()` → `crypto.getRandomValues` at `src/worker/DuelWorkerRuntime.ts:328`. "Preset duel" means preset *decks*, not a preset game. A single pass proves nothing for duel-walking tests; run the chromium spec twice.
- **`webkit-smoke` is unrunnable in this sandbox** (WPE wants `libjxl.so.0.8`, nixpkgs ships 0.11, no root). Not a code defect. Validate with `chromium` + `firefox-smoke` only and note webkit as a standing environment gap.
- **`firefox-smoke` only runs the single test at `e2e/duel-smoke.spec.ts:213`**, so anything you add to the responsive-viewport test is chromium-only here.
- **Browsers only launch inside a nix library closure, and chromium/firefox need two *different* invocations.** Do not merge them. Both browser dirs already exist and work. Run from the repo root.

```bash
cd /home/aron/projects/ascencio

# CHROMIUM — corrected 2026-08-09 after a worker lost ~1 h to the older recipe.
# The browsers are ALREADY INSTALLED at the path below; do not run `playwright install`.
# The extra -p entries (libgbm libxcb libxkbcommon systemd) and the explicit
# LD_LIBRARY_PATH are all required: chromium 1228 needs libgbm.so.1, libxcb.so.1,
# libxkbcommon.so.0 and libudev.so.1, and `nix-shell -p` alone does not export a
# library path for prebuilt binaries. Verified working.
timeout 590 nix-shell -p playwright-driver.browsers glib gtk3 nss nspr dbus atk cups \
  libdrm expat libx11 libxcomposite libxdamage libxext libxfixes libxrandr mesa libgbm \
  alsa-lib at-spi2-atk at-spi2-core cairo pango xorg.xvfb libxcb libxkbcommon systemd --run '
LD_LIBRARY_PATH="$(nix-build "<nixpkgs>" -A glib.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A gtk3.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A nss.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A nspr.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A dbus.lib --no-out-link)/lib:$(nix-build "<nixpkgs>" -A atk.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A cups.lib --no-out-link)/lib:$(nix-build "<nixpkgs>" -A libdrm.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A expat.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A xorg.libX11.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A xorg.libXcomposite.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A xorg.libXdamage.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A xorg.libXext.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A xorg.libXfixes.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A xorg.libXrandr.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A mesa.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A libgbm --no-out-link)/lib:$(nix-build "<nixpkgs>" -A alsa-lib.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A at-spi2-atk.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A at-spi2-core.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A cairo.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A pango.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A libxcb --no-out-link)/lib:$(nix-build "<nixpkgs>" -A libxkbcommon --no-out-link)/lib:$(nix-build "<nixpkgs>" -A systemd --no-out-link)/lib"
export LD_LIBRARY_PATH
export PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-1000/-home-aron-projects-ascencio/96d04da1-8a1d-4c99-a486-a78e08224806/scratchpad/pw-browsers
npx playwright test --project=chromium
'
# filtered: append -g "pattern" and/or --repeat-each=N to the npx line
#
# `PLAYWRIGHT_BROWSERS_PATH` MUST be re-exported *inside* the single-quoted
# --run block — the outer shell's exports do not reach it.

# FIREFOX-SMOKE (no PLAYWRIGHT_BROWSERS_PATH override — uses ~/.cache/ms-playwright)
timeout 170 nix-shell -p glib gtk3 dbus nspr nss libx11 libxcb libxcomposite libxdamage \
  libxext libxfixes libxrandr mesa alsa-lib pango cairo atk at-spi2-atk at-spi2-core \
  cups libdrm expat gdk-pixbuf --run '
LD_LIBRARY_PATH="$(nix-build "<nixpkgs>" -A gtk3.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A glib.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A pango.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A cairo.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A at-spi2-core.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A gdk-pixbuf.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A xorg.libX11.out --no-out-link)/lib:$(nix-build "<nixpkgs>" -A alsa-lib.out --no-out-link)/lib"
export LD_LIBRARY_PATH
npx playwright test --project=firefox-smoke
'
```

Gotchas, all learned the hard way:

- `playwright-driver.browsers` **and** `xorg.xvfb` are both empirically required in chromium's `-p` list even though Xvfb is never launched. Drop either and `libglib-2.0.so.0: cannot open shared object file` returns. Do not "simplify" the list.
- `nix-shell -p pkg` does **not** export `LD_LIBRARY_PATH` for prebuilt binaries, and `-A pkg` often resolves to a `-dev` output with no `.so`. Use `-A pkg.out`.
- The chromium browsers dir is a **real `playwright install` tree** at the scratchpad path above (populated 2026-08-09), not the old mismatched-revision symlinks. Firefox uses `~/.cache/ms-playwright`, which holds the version-matched `firefox-1532` and does **not** take the `PLAYWRIGHT_BROWSERS_PATH` override.
- `webServer` auto-builds/starts/stops per invocation (`reuseExistingServer: false`), so each command is self-contained — do not hand-start `npm run preview`. The `Port 4202 is in use on a wildcard address` warning is unrelated and ignorable.
- Plain headless works; `--headed` and hand-started Xvfb are dead ends.
- jsdom has **no `ResizeObserver`**. Guard any use with `typeof ResizeObserver === "undefined"`, as `DuelField.observeAnchor()` and `FieldActionBar` already do, or 16 component tests break.

## Working-tree hygiene

These files were dirty **before** this run and must never be staged: `.gitignore`, `README.md`, `docs/README.md`, `docs/architecture/**`, `docs/developer-guide/**`, `docs/duel-field-architecture.html`, `docs/duel-field-validation-references.html`, `playwright.config.ts`, `vite.config.ts`, deleted `test-results/**`, and untracked `.claude/`, `.pi/`, `.pi-subagents/`, `.agents/`, `.agentsystem/`, `.dev/`, `.tmp/`, `CLAUDE.md`, `AGENTS.md`, `context.md`, `.graphifyignore`, `artifacts/HANDOFF_2026_08_09_duel_field_ux_overhaul.md`. Stage explicit paths only — never `git add -A`.

## Manual test checklist duty

`artifacts/manual_test_checklist.md` exists and already carries a `## T6 field-action-bar` section. Append your own `## T{n} {slug}` section with plain unchecked `- [ ]` boxes describing what a human must click to verify this slice. Never touch another ticket's section. If this slice changes behaviour a previous section describes, update that stale entry rather than only appending. Stage this file with your commit.
