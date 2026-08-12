# T8: Hand band and pagination

**Plan:** `./ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
**Depends:** T7
**Commit outcome:** Both hands lose their zone rectangle, span exactly the five spell/trap columns, render at most ten cards per page, and expose arrow plus native horizontal-scroll navigation.

## Context (self-contained)

- Goal: ship all 30 items of `feedback.md`.
- Covers items 6, 7, 13 and 15: no hand rectangle; 10-card cap with arrows/scroll; hand width equals S/T zones 1–5; pile column attaches to zone 5.
- Current hand is one oversized `StandardFieldZoneLayout` (`x=640`, width `720/1280`). Hand cards are absolute children of the board using `handOffset`, so no scroll container exists. Implement a dedicated hand-band renderer; do not fake scrolling by shifting global board coordinates.
- Out of scope: hover zoom (T12), drag physics (T13), whole-page responsive fit (T9), changing stack/central field coordinates after T7.
- Assumptions **A7/A8**: 44 px hit-target floor and board `min-width:52rem` stay. Five-zone span is only 462 design px after T7, so ten 72-unit cards cannot all fit side-by-side. "At most 10" means page size 10; native horizontal scrolling reaches cards inside a page when viewport is narrower. Arrows change 10-card pages. No overlapping pointer targets.

## Requirements

- Hand visible span equals S/T1 left edge through S/T5 right edge: x centre `640/1280`, width `(830 + 41 - (450 - 41)) / 1280 = 462/1280` after T7.
- No hand zone border, background, label or `ZoneControl` is rendered.
- Player band sits at the bottom, opponent band at the top. Opponent card order/orientation mirrors player order.
- `HAND_PAGE_SIZE = 10`. At most ten `CardControl` instances per player hand are mounted at once, even with a larger hand.
- Left/right arrow buttons change the page by ten and are disabled at the corresponding end. They remain ≥44×44 px.
- Each page's viewport has `overflow-x:auto`, `overscroll-behavior-x:contain`, keyboard/native wheel/trackpad scrolling, and a visible thin scrollbar. Cards are fixed at at least 44 px wide; no target shrinks to fit.
- Page index clamps when cards leave the hand. A prompt/snapshot update cannot leave an empty page selected. When keyboard nav moves `activeTarget` to a hand card on another page, derive its sorted hand index and switch page before FieldBoard's post-`tick()` focus query.
- Player page order is ascending engine sequence left→right. Opponent display is mirrored right→left; its semantic/DOM order remains sequence order so screen readers hear engine order.
- Existing preview, click, keyboard, action-chip and drag callbacks still reach the same `BoardCardView`/choice. Hand cards remain in `board.cards`; renderer changes, but nav keeps explicit sequence neighbors: player ArrowLeft/Right = sequence −/+1; mirrored opponent = sequence +/−1. Player Right and opponent Left cross 9→10 and trigger page sync.
- Attach pile column with the same 13-design-px edge gap as adjacent central zones: after T7 Zone 5 centre `830`, Deck/GY centre becomes `925` (`95` centre step); Banished centre becomes `1020`, one more `95` step. Both players mirror vertically with the same x values. Hand ends at S/T5 outer edge `871`; Deck/GY left edge `884`; exact gap `13`.

## Inputs

- **From Depends (T7), as actually shipped in `1e87e63`:** central x centres `450,545,640,735,830` (hoisted to module const `CENTRAL_COLUMN_X` in `duel-field-layout.ts`); card/zone width `82` design units; `BoardZoneView.accessibleLabel` and `BoardStackView.accessibleLabel` exist and carry the owner-aware spoken name while `label` carries the short visible text; visible hand label is `Hand`; Extra x is `330`, matching Field x.
- **Also from T7, affects Impl step 8:** `neighborInDirection` in `board-view-model.ts` no longer uses `NAV_ALIGNMENT_EPSILON` for *vertical* moves. Vertical alignment is now horizontal span overlap, `|Δx| < (widthOrigin + widthCandidate) / 2`; horizontal moves still require an exact row match. That is what makes the shared Extra Monster Zones reachable (42/42 targets). Your hand-sequence horizontal override must not regress that — re-run `npm run test:unit -- field-navigation` and keep the `keeps every field target reachable with arrow keys alone` test green.
- **From T6, as shipped in `ced9383`:** `board-view-model.ts`, `zone-list.ts`, `card-preview.ts`, `CardTray.svelte` and `DuelHud.svelte` now decide identity through `isProjectedCardIdentityKnown(card)` (code presence) rather than geometric `isCardIdentityVisible`. A known face-down card still renders `hidden: true` with back art. Do not reintroduce geometric visibility checks in presentation code — `grep -Rni "isCardIdentityVisible" src/app src/field` must stay empty.
- Board fixtures live in `tests/fixtures/board-public-states`; T6 added a `concealedStateCard` helper there for cards the projector could never attest. Any hand fixture you add for an opponent must use it, not a raw code.

### Environment facts for validation

- Playwright is chromium-only on this host. Run browser checks as:
  `PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers npx playwright test --project=chromium`
  Bare `npm run check` cannot exit 0 here because `playwright.config.ts` includes a `webkit-smoke` project unsupported on this machine. Use `npm run check:headless` plus the explicit Chromium invocation instead.
- Known flake: Vitest integration occasionally dies with `Worker exited unexpectedly` and no assertion failure. Re-run once before diagnosing.
- Known flake: the duel seed is random per run; re-run a failing Chromium walker twice before diagnosing.
- `src/field/duel-field-layout.ts:129-136` before T7 — Deck/GY x `1030`, Banished x `1130`; hand x `640`, y `42/678`, width `720/1280`, height `72/720`. T7 leaves pile/hand positions for this ticket.
- `src/field/board-view-model.ts:190-229` — maps player and opponent hand cards; player uses `handOffset(card.sequence, handCount)` and opponent placeholders use the same helper; `:483-486` adds hand cards to spatial nav.
- `board-view-model.ts` near bottom — `handOffset(sequence,count)` gives distinct virtual x values. HandBand no longer renders from them, but spatial up/down nav still needs virtual geometry; rename to `handNavigationOffset` or retain with a comment.
- `src/app/components/duel-field/FieldBoard.svelte:173-183` — renders all zones including hand; `:195-222` renders all cards through `CardControl`.
- `src/app/components/duel-field/CardControl.svelte:51` — global absolute `positionStyle`; `:182-205` article.
- `src/styles/app.css:935-943` — visible player hand rectangle and transparent opponent exception; both become obsolete.
- `src/styles/app.css:910-919` — all cards are absolute; hand-item override must be more specific.
- `tests/unit/duel-field.test.ts:228-246` — hand mapping/privacy.
- `tests/component/DuelField.test.ts:1540+` — hand preview/drag callbacks; helpers locate hand card article/target.

## API design

New `src/field/hand-pagination.ts`:

```ts
export const HAND_PAGE_SIZE = 10;

export interface HandPage<T> {
  readonly page: number;
  readonly pageCount: number;
  readonly start: number;
  readonly items: readonly T[];
  readonly canPrevious: boolean;
  readonly canNext: boolean;
}

export function handPage<T>(
  items: readonly T[],
  requestedPage: number,
): HandPage<T>;
```

Rules: page count is `Math.max(1, Math.ceil(items.length / 10))`; requested page clamps to integer `0…pageCount-1`; `items` is frozen `slice(start,start+10)`; empty input yields page 0/count 1/empty/canPrevious false/canNext false.

New `src/app/components/duel-field/HandBand.svelte` props:

```ts
export let player: PlayerIndex;
export let cards: readonly BoardCardView[];
export let zone: BoardZoneView;
export let imageUrls: ReadonlyMap<number, string>;
export let imageLibrary: Pick<CardImageLibrary, "lease"> | null;
export let cardBackUrl: string;
export let placeholderUrl: string;
export let spec: ActiveInteractionSpec | null;
export let selectedTargets: ReadonlySet<BoardTargetId>;
export let activeTarget: BoardTargetId | null;
export let disabled: boolean;
export let pinnedTarget: BoardTargetId | null;
// same card activate/choose/dismiss/drag/preview callbacks as FieldBoard
```

`data-cy`: root ``field-hand-band-p${player}``; previous/next buttons ``field-hand-p${player}-previous`` / `-next`; viewport ``field-hand-p${player}-viewport``; page status ``field-hand-p${player}-page-status``. Root style uses global layout variables from `zone`, with width exactly `462/1280`; no border/background.

Add `layout: "field" | "hand" = "field"` prop to `CardControl`. For `hand`, article gets `.is-hand-item`, omits global `positionStyle`, and is normal-flow `position:relative; flex:0 0 max(2.75rem, calc(72 / 1280 * var(--duel-field-rendered-width)))`. Avoid JS resize measurement: CSS container sizing may use `clamp(2.75rem, 5.625cqw, 4.5rem)` after setting `container-type:inline-size` on `.duel-field-board`; if container units complicate support, use fixed `4.5rem` because horizontal scroll is intended. Target remains min 2.75rem.

## TDD

1. **Red** — pure pagination tests; HandBand component tests; existing field test asserts no hand ZoneControl.
2. **Green** — split renderer, page state, CSS.
3. **Refactor** — rename `handOffset` to nav-specific intent; delete only painted hand-zone CSS after callbacks/nav pass.

## Test plan

New `tests/unit/hand-pagination.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `returns one empty page` | `[]`, page 8 | page 0/count 1/items empty/both false |
| `returns all ten items on one page` | 10 values | 10 items, no arrows enabled |
| `splits eleven items without duplication` | 11 values; page 0/1 | first 10 then last 1; union equals input |
| `clamps a stale page after hand shrink` | 21 values page 2 then 9 values requested page 2 | returned page 0, 9 items |
| `does not mutate input` | frozen array | no throw, same input |

New `tests/component/HandBand.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `mounts at most ten cards` | 12 BoardCardViews | 10 card articles initially; status `Page 1 of 2` |
| `next and previous page preserve card ids` | click next then previous | page 2 contains seq 10/11 only; return has seq 0…9 |
| `disables arrows at boundaries` | 12 cards | previous disabled on page 1, next disabled on page 2 |
| `clamps when cards shrink` | rerender from 12/page 2 to 2 | page 1 of 1, two cards |
| `follows active target across a page boundary` | 11 cards; active target changes from sorted index 9 to 10 | page 2 mounts index 10 before focus lookup |
| `mirrors opponent visual flow without changing DOM sequence` | player 1, three cards | DOM ids remain 0,1,2; root has `.is-opponent`; computed/structural style uses row-reverse or RTL |
| `forwards preview, activation and drag callbacks` | one actionable player card | pointer enter/click/drag invoke callbacks with same card/coords |
| `keeps both arrow targets at least 44px by contract` | rendered | buttons have shared min-size class; browser e2e verifies pixels |

Extend `tests/component/DuelField.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `renders hands through bands and no hand ZoneControl` | ST-01 | both band roots exist; no `zone-control-label-p0:hand`/p1; no `.duel-field-zone[data-zone-kind="hand"]` |
| `attaches pile columns with central-zone spacing` | mapped board | Deck/GY x `925/1280`, Banished x `1020/1280`; no overlap |
| `preserves hand preview and drag integration` | existing tests | same callbacks still pass through HandBand |
| `keyboard navigation crosses player hand page boundary` | p0 active seq 9, ArrowRight | seq 10 becomes active; page 2 mounts; target receives focus |
| `keyboard navigation follows mirrored opponent direction` | p1 active seq 9, ArrowLeft | seq 10 becomes active; page 2 mounts/focuses; ArrowRight from seq 10 returns seq 9 |

Extend responsive chromium e2e in `e2e/duel-smoke.spec.ts`: at each existing viewport, measure both hand band edges against S/T1 and S/T5 zone edges (±2 px); measure S/T5→Deck and M5→GY edge gaps equal to adjacent central-zone gaps (±2 px); measure GY→Banished likewise; both arrows ≥44×44 px; no hand card target below 44×44; `scrollWidth >= clientWidth`; document has no horizontal overflow attributable to hand (board may pan inside `.duel-field`).

## Impl steps

- [x] 1. Write `tests/unit/hand-pagination.test.ts`; run `npm run test:unit -- hand-pagination` red. Evidence: test file created before implementation; ran red then green (see step 2).
- [x] 2. Create `src/field/hand-pagination.ts` with exact rules; re-run green. Evidence: `npx vitest run tests/unit/hand-pagination.test.ts` → 6 passed.
- [x] 3. Write `tests/component/HandBand.test.ts`; run red. Evidence: written before `HandBand.svelte` existed; ran red, then green after implementation (8 passed).
- [x] 4. Add `layout` prop/`.is-hand-item` mode to `CardControl.svelte`; field mode must render byte-for-byte equivalent DOM/style. Evidence: `layout` defaults to `"field"`, `positionStyle`/class list unchanged for that branch; full existing `DuelField.test.ts`/`HandBand.test.ts` suites (100+8) stayed green with no field-mode assertions changed.
- [x] 5. Create `HandBand.svelte`. Sort input by `card.sequence`; `BoardCardView.sequence` added and set from `PublicCard.sequence`/placeholder sequence in `board-view-model.ts`. Evidence: `src/app/components/duel-field/HandBand.svelte` created; `sortedCards = [...cards].sort((l,r)=>l.sequence-r.sequence)`; `BoardCardView.sequence` field added, set in `addCard`/`addHiddenHandPlaceholder`.
- [x] 6. Page kept in local component state (`requestedPage`); reactive `handPage(sortedCards, requestedPage)` clamps via `pageResult`; `activeTarget` match sets `requestedPage = floor(sortedIndex/HAND_PAGE_SIZE)` in `syncPageWithActiveTarget`; `resetScrollOnPageChange` sets `viewportElement.scrollLeft` to `0` (player) or `scrollWidth-clientWidth` (mirrored opponent) after each page change. Evidence: `HandBand.test.ts` "clamps when cards shrink", "follows active target across a page boundary" pass.
- [x] 7. `FieldBoard.svelte` derives `fieldCards`, `playerHandCards`, `opponentHandCards`, `playerHandZone`, `opponentHandZone`; `ZoneControl` loop uses `fieldZones` (hand excluded); two `HandBand`s render; `CardControl` loop uses only `fieldCards`. Evidence: `DuelField.test.ts` "renders hands through bands and no hand ZoneControl" passes.
- [x] 8. Active navigation target/callbacks passed through `HandBand`; one `navigationState` stays in `FieldBoard`. `createNavigation`'s `handHorizontalOverrides` overrides left/right by sequence: p0 `-1/+1`, p1 (mirrored) `+1/-1`; vertical neighbors stay spatial (unchanged `neighborInDirection`). Evidence: `DuelField.test.ts` "keyboard navigation crosses player hand page boundary" and "...follows mirrored opponent direction" (both add explicit 9↔10 boundary assertions) pass; `field-navigation.test.ts` "keeps every field target reachable with arrow keys alone" still passes.
- [x] 9. `duel-field-layout.ts`: hand width now `462/1280`, x/y/height retained; both players' Deck/GY x moved to `925`, Banished x to `1020`, y values unchanged. Evidence: `tests/unit/duel-field.test.ts` (68 tests) passes; `DuelField.test.ts` "attaches pile columns with central-zone spacing" passes (925/1280, 1020/1280, 95-unit step asserted directly).
- [x] 10. Hand x/y no longer used for DOM placement (`HandBand` ignores `card.x`/`card.y`, using CSS flex flow instead); `handNavigationOffset` (renamed from `handOffset`) keeps distinct virtual x per card for up/down spatial nav. Evidence: `board-view-model.ts` `handNavigationOffset` retains per-sequence offset formula; `field-navigation.test.ts` vertical-nav tests (e.g. "keeps horizontal movement row-local so vertical keys reach hand defense cards") pass.
- [x] 11. CSS added: `.duel-field-card.is-hand-item` (normal-flow), `.duel-field-hand-band`/`__row`/`__viewport`/`__arrow` (flex viewport, mirrored `row-reverse`, fixed 44px arrows, `scrollbar-width:thin`); `[data-zone-kind="hand"]` and `[data-zone-id="p1:hand"]` rules deleted. Evidence: `grep -c 'data-zone-kind="hand"' src/styles/app.css` → 0; `tests/unit/global-styles.test.ts` "hand band paints no border or background" passes.
- [x] 12. Unit/component suites run; `DuelField.test.ts` helpers (`handCardArticle`/`handDragTarget`) unchanged and still locate cards correctly inside `HandBand`. Evidence: `npm run test:component` → 215/215 passed (16 files); `npm run test:unit` → 646/646 passed (60 files).
- [x] 13. e2e geometry/min-target assertions added to the responsive-viewport walker (hand-band edges vs S/T1–S/T5, pile centre-pitch vs adjacent central zones, both arrows ≥44px, `scrollWidth>=clientWidth`); full chromium project run. Evidence: `PLAYWRIGHT_BROWSERS_PATH=... npx playwright test --project=chromium` → 21/21 passed.

## Outputs

- Files created: `src/field/hand-pagination.ts`, `src/app/components/duel-field/HandBand.svelte`, `tests/unit/hand-pagination.test.ts`, `tests/component/HandBand.test.ts`.
- Files edited: `src/field/duel-field-layout.ts`, `src/field/board-view-model.ts`, `src/app/components/duel-field/FieldBoard.svelte`, `CardControl.svelte`, `src/styles/app.css`, `tests/unit/duel-field.test.ts`, `tests/component/DuelField.test.ts`, board fixtures, `e2e/duel-smoke.spec.ts`.
- Public type change: `BoardCardView` gains `sequence`.
- Migration / config: none.

## Validation

- [x] `npm run test:unit -- hand-pagination duel-field field-navigation` passes — 5 files, 189 passed.
- [x] `npm run test:component -- HandBand DuelField` passes — 2 files, 100+8=108 passed (via targeted `vitest run`; `npm run test:component` full run also green at 16/215).
- [x] `npm run typecheck`, `npm run lint`, `npm run format:check` pass — all three exit 0, no errors/warnings.
- [x] `npm run build` succeeds — `vite build --mode private` + `build:verify` both `"status":"ok"`.
- [x] full chromium e2e passes with standard pinned nix/`PLAYWRIGHT_BROWSERS_PATH` command from T5 — 21/21 passed.
- [ ] manual check: 11+ fixture; p0 ArrowRight and p1 ArrowLeft cross card 10→11 onto next page; reverse keys return; arrows/wheel work; no duplicates/focus loss
- [ ] manual check: opponent hand mirrors player hand; cards/backs remain inverted as before
- [ ] manual check: both bands align exactly to S/T1–S/T5; Deck/GY/Banished attach with same margin as central zones
- [x] app functional — no broken path from this slice. Evidence: full `check:headless` gate green (format/lint/typecheck/legacy/unit 646/integration 20/vendor/assets/snapshot), `npm run build` green, full chromium e2e 21/21 green.
- [x] commit msg draft: `feat(field): render paged hands across the spell trap row`
