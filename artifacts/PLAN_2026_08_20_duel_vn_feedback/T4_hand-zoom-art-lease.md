# T4: Hand-zoom art lease

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T1
**Commit outcome:** Hovering a hand card shows that card's real art in the zoom overlay instead of the "Image unavailable" placeholder.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is `feedback-duel.md` item 2.
- This slice: the zoom overlay resolves its own image the way every mounted card already does — through a lease on `CardImageLibrary` — and the dead prop that caused the placeholder is deleted.
- Out of scope here: the action buttons above the zoom (T8), click-to-pin (T9), any change to the image cache itself.
- Assumptions in force: the duel's verified image pipeline stays the only image path inside a duel; nothing here touches `src/battle/app/images/card-image-cache.ts`.

## Requirements

- `HandZoomOverlay` renders the leased art for a face-up card, the card back for a hidden card, and the placeholder only when the library genuinely has no image for that code.
- The lease is released when the previewed code changes and on destroy, matching `CardControl`'s discipline.
- The `imageUrls` prop is removed from `DuelField`, `FieldBoard` and `HandBand`, because no caller ever passed it — its absence is the bug.

## Inputs

- `src/battle/app/components/duel-field/HandZoomOverlay.svelte` — takes `export let imageUrl: string;` today and renders it directly at `.hand-zoom-overlay__art`.
- `src/battle/app/components/DuelField.svelte`
  - line 85: `export let imageUrls: ReadonlyMap<number, string> = EMPTY_IMAGE_URLS;` — declared, never passed by any caller (`grep -rn "imageUrls" src/` returns only `DuelField.svelte`, `FieldBoard.svelte`, `HandBand.svelte`).
  - lines 1043-1045: `imageUrl={handZoom.card.image.kind === "back" ? resolvedCardBackUrl : (imageUrls.get(handZoom.card.image.code) ?? resolvedPlaceholderUrl)}` — always the placeholder branch.
  - line 86: `export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;` — the working path, already passed down to `CardControl`.
- `src/battle/app/components/duel-field/CardControl.svelte` lines 44-125 — the lease pattern to copy: `synchronizeImageLease(library, code)` releasing the previous lease, `onDestroy(() => imageLease?.release())`, and `useFallbackImage` on `onerror`.
- `src/battle/app/components/duel-field/FieldBoard.svelte:114` and `src/battle/app/components/duel-field/HandBand.svelte:62` — the two other `imageUrls.get(...)` fallbacks to delete.
- `tests/component/HandZoomOverlay.test.ts` — the existing component test to extend.

## From Depends

- T1 changed documentation only; `src/` is unchanged from `main`.

## TDD

1. **Red** — extend `tests/component/HandZoomOverlay.test.ts` with `renders the leased art for a known card` and `releases the lease when the card changes`, passing a fake `imageLibrary` whose `lease(code)` returns `{ url: "blob:test-<code>", release: vi.fn() }`.
2. **Green** — give `HandZoomOverlay` an `imageLibrary` prop and the lease lifecycle; change `DuelField` to pass `imageLibrary` and `cardBackUrl`/`placeholderUrl` instead of a resolved `imageUrl`.
3. **Refactor** — delete the `imageUrls` prop and its three read sites.

## Test plan

| Test                                                 | Input                             | Expect                                                                |
| ---------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------- |
| `renders the leased art for a known card`            | fake library leasing code `12345` | `[data-cy="hand-zoom-overlay-image-<id>"]` `src` is `blob:test-12345` |
| `renders the card back for a hidden card`            | `card.image.kind === "back"`      | `src` equals the passed `cardBackUrl`, and `lease` was never called   |
| `falls back to the placeholder when no lease exists` | library returns `null`            | `src` equals the passed `placeholderUrl`                              |
| `releases the lease when the card changes`           | rerender with a different card    | the first lease's `release` was called exactly once                   |
| `releases the lease on destroy`                      | unmount                           | `release` called                                                      |

## Impl steps

- [ ] 1. Add the failing tests above to `tests/component/HandZoomOverlay.test.ts`; run `npx vitest run tests/component/HandZoomOverlay.test.ts`.
- [ ] 2. In `HandZoomOverlay.svelte`, replace `export let imageUrl: string;` with `export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null; export let cardBackUrl: string; export let placeholderUrl: string;`.
- [ ] 3. Copy the lease lifecycle from `CardControl.svelte:110-127` into `HandZoomOverlay.svelte`: a reactive `synchronizeImageLease(imageLibrary, card.image.kind === "back" ? undefined : card.image.code)`, plus `onDestroy(() => imageLease?.release())`.
- [ ] 4. Compute `renderedImageUrl = card.image.kind === "back" ? cardBackUrl : (imageLease?.url ?? placeholderUrl)` and bind it to the `<img>`; keep an `onerror` handler that falls back to `placeholderUrl`.
- [ ] 5. In `DuelField.svelte`, change the `<HandZoomOverlay …>` invocation (line ~1039) to pass `{imageLibrary}`, `cardBackUrl={resolvedCardBackUrl}` and `placeholderUrl={resolvedPlaceholderUrl}` instead of `imageUrl`.
- [ ] 6. Delete `export let imageUrls` from `DuelField.svelte` (line 85), `FieldBoard.svelte` (line 35) and `HandBand.svelte` (line 22), plus `EMPTY_IMAGE_URLS` and the `{imageUrls}` forwards at `DuelField.svelte:993`, `FieldBoard.svelte:238,264`.
- [ ] 7. In `FieldBoard.svelte:114` and `HandBand.svelte:62`, change `cardImageUrl` to return `placeholderUrl` for a face-up card with no lease (the `CardControl` lease still supplies the real art).
- [ ] 8. Re-run the component tests, then `npx vitest run tests/component` for the field components.

## Outputs

- Files touched: `src/battle/app/components/duel-field/HandZoomOverlay.svelte`, `src/battle/app/components/DuelField.svelte`, `src/battle/app/components/duel-field/FieldBoard.svelte`, `src/battle/app/components/duel-field/HandBand.svelte`, `tests/component/HandZoomOverlay.test.ts`.
- Behaviour change: hand-zoom art is real; a dead prop is gone from three components.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/component/HandZoomOverlay.test.ts` passes
- [ ] `npx vitest run tests/component` passes
- [ ] `npm run check:headless` passes
- [ ] manual: hover a hand card in a duel — the zoom shows the card's art
- [ ] app functional — mounted field and hand cards still render art
- [ ] commit msg draft: `fix(hand-zoom): the overlay leases its own art instead of reading a map nobody fills`
