# T3: Xyz material stack rendered behind host card (item 1a)

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`  
**Depends:** none  
**Commit outcome:** Materials visible offset right behind xyz monster, Duel Links style.

## Context (self-contained)

- Goal: implement the 2026-08-27 owner feedback round on the duel field. This ticket covers the first half of item 1 (owner wording, binding): "For xyz monsters. Show the material attached behind the card by putting behind (x-index) and slightly moved to the right from the last material or xyz monster if no material left. Do same as duelink book." — i.e. Duel Links style: each material peeks out to the right, stacked under the host, lower z-index.
- This slice: pure rendering. Materials are already fully projected into the board view model (`BoardCardView.materials`) but never rendered on the field — only `DuelHud.svelte:213-229` lists them today. This ticket makes them visible on the field card itself, for both players.
- Out of scope here: NO dialog, NO browse action, NO detach flow (sibling T4 owns those). NO pointer handlers on materials — they are non-interactive here (`pointer-events: none`); interaction arrives in a later ticket. Never edit `feedback.md`. Do not modify `src/battle/field/board-view-model.ts` — the `materials` field and `BoardMaterialView` type already exist and are frozen for this ticket.
- Assumptions in force:
  - `card.materials` is populated by `mapSnapshotToBoard` (`src/battle/field/board-view-model.ts:380-393`) in projector order; sequence values are present but the array order is not guaranteed sorted, so render order sorts by `sequence` explicitly.
  - Host card `aria-label` already announces material count (`board-view-model.ts:718-730`), so material elements are decorative (`aria-hidden="true"`); no new accessible name is needed.
  - `tests/unit/data-cy-coverage.test.ts` enforces `data-cy` presence + uniqueness on every rendered element; `material.id` is unique per document (`material:{instanceId}` when visible, `hidden-material:{snapshotId}:{hostInstanceId}:{sequence}` when hidden), so suffixing with it satisfies uniqueness.

## Requirements

- Every field card with `card.materials.length > 0` renders one material element per entry, both players, all monster zones (main + EMZ).
- Materials sit visually **behind** the host card art and each successive material is shifted further **right** (screen-space right for both players), Duel Links style.
- Material face: `identityVisible && code !== undefined` → card art (leased through the existing `CardImageLibrary` mechanism, placeholder fallback); otherwise the card back.
- Materials render in ascending `sequence` order (sequence 0 nearest the host, highest sequence furthest right).
- Materials are non-interactive: `pointer-events: none`, no handlers, no tab stop.
- Every new element carries a unique `data-cy`.
- Gates green: `npm run check:headless` and `npm run test:component` (plan gate A11).

## Inputs

- `src/battle/app/components/duel-field/CardControl.svelte` — host card render site. `<article class="duel-field-card" data-cy={`field-card-${card.id}`}>` contains `.duel-field-card__art` (absolute, `inset: 0`), an optional label, an optional target button. Props today include `card: BoardCardView`, `imageUrl: string`, `imageLibrary: Pick<CardImageLibrary, "lease"> | null`.
- `src/battle/field/board-view-model.ts:47-54` — `BoardMaterialView` (read-only, do not edit):

  ```ts
  export interface BoardMaterialView {
    readonly id: string;
    readonly instanceId?: CardInstanceId;
    readonly sequence: number;
    readonly identityVisible: boolean;
    readonly code?: CardCode;
    readonly label: string;
  }
  ```

- `src/battle/field/board-view-model.ts:84` — `BoardCardView.materials: readonly BoardMaterialView[]`.
- `src/battle/app/components/duel-field/StackControl.svelte:20-38,49-68` — the canonical per-component image-lease pattern to copy verbatim (`activeImageLibrary` / `activeImageCode` / `imageLease` / `synchronizeImageLease` / `onDestroy(() => imageLease?.release())` / `useFallbackImage`).
- `src/battle/app/components/duel-field/FieldBoard.svelte` — owns `export let cardBackUrl: string;` and `export let placeholderUrl: string;` (lines 36-37) and instantiates `<CardControl>` for field cards at lines 297-320.
- `src/styles/app.css` — card positioning mechanism: `.duel-field-zone, .duel-field-stack, .duel-field-card` (line 1327) are `position: absolute; left: var(--field-x); top: var(--field-y); width: var(--field-width); height: var(--field-height); transform: translate(-50%, -50%);`. `CardControl.fieldPositionStyle` sets `--field-width: ${placement.width * (72 / 104)}px` — i.e. `--field-width` **is the actual card width**, so percentage `translateX` on an `inset: 0` child equals a fraction of card width. `.duel-field-card` has `z-index: var(--duel-field-layer-card)` (=30, `src/styles/tokens.css:103`), which makes the article a stacking context; a negative-z-index child paints above the article's (transparent) background but below `.duel-field-card__art` (positioned, z-auto). `.duel-field-card__art` rules at app.css:2288-2322 (opponent art rotates 180°).
- `tests/component/CardControl.test.ts` — existing harness: jsdom, `@testing-library/svelte`, `makeCard(overrides)` factory (has `materials: []` default), `renderCard(card, onzoomenter)` helper rendering with `layout: "hand"`, `placement: null`, `imageUrl: "/back.webp"`, `imageLibrary: null`.
- `tests/fixtures/board-view-model.ts:120-150` — fixture `ST-07` already carries a host with one visible + one hidden overlay material (reference only; component test builds its own `BoardMaterialView` literals).
- Run cmds: `npm run test:component`, `npm run check:headless` (from repo root).
- **From Depends:** none.

## Interface contract (level 5)

Machine-checkable shapes this slice produces or consumes. Verbatim, copy-pasteable.

- **Produces (frozen contract C2 — sibling T4 consumes these names verbatim, do not rename):**
  - Material root element class: `duel-field-card__material`
  - Material root element `data-cy`: `` `field-card-material-${material.id}` ``
  - Material image `data-cy`: `` `field-card-material-image-${material.id}` ``
  - Offset constant: each successive material is shifted right by **12% of card width** per step (`translateX(calc((var(--material-index) + 1) * 12%))` on the `inset: 0` material element; `--material-index` is set inline as `style={`--material-index: ${index};`}` where `index` is the 0-based position in the sequence-sorted list).
  - New component file `src/battle/app/components/duel-field/MaterialCard.svelte`, props:

    ```ts
    export let material: BoardMaterialView;
    export let index: number; // 0-based position in sequence-sorted order
    export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
    export let cardBackUrl = "";
    export let placeholderUrl = "";
    ```

  - New `CardControl.svelte` props (appended after `imageLibrary`):

    ```ts
    export let cardBackUrl = "";
    export let placeholderUrl = "";
    ```

  - New CSS rules in `src/styles/app.css` (see impl step 4 for exact text): `.duel-field-card__material`, `.duel-field-card__material img`, `.duel-field-card.is-opponent .duel-field-card__material img`.
- **Consumes:** `BoardMaterialView` and `BoardCardView.materials` exactly as declared in `src/battle/field/board-view-model.ts:47-54,84` (quoted under Inputs) — binding, do not redesign. `CardImageLibrary.lease(code: CardCode | number): CardImageLease` with `CardImageLease = { url: string; release(): void }` from `src/battle/app/images/card-image-cache.ts`.
- **Errors:** none new. Image load failure on a face material → `onerror` swaps `src` to `placeholderUrl` (same `useFallbackImage` pattern as StackControl); back-face materials never fail over (static asset). No thrown paths added.
- **Invariants:**
  - Render order: DOM order of `.duel-field-card__material` elements is ascending `material.sequence`; ties cannot occur (engine sequences are unique per host).
  - `index` passed to `MaterialCard` equals the element's position in that sorted list, starting at 0.
  - Materials render only when `card.materials.length > 0`; zero materials → zero material elements (no empty wrapper).
  - Materials paint below `.duel-field-card__art` (z-index `-1` inside the card's own stacking context) and never intercept pointer events (`pointer-events: none`).
  - Offset direction is screen-space right for both players (opponent rows included); only the material **art** rotates 180° for opponent cards, matching `.duel-field-card__art` behaviour.
  - Face choice: `material.identityVisible && material.code !== undefined` → leased art (fallback `placeholderUrl`); otherwise `cardBackUrl`. Hidden material `<img>` gets `alt=""`; visible material `<img>` gets `alt={material.label}`; the root div is `aria-hidden="true"` either way (host label already announces the count).
  - Every lease acquired is released: on code/library change and on component destroy (idempotent — `release()` is already guarded in the cache).
- **Integration links:** none — this slice is main-thread Svelte rendering only; no Worker, storage, or network boundary is crossed.

## TDD

1. **Red** — add `describe("CardControl xyz materials", ...)` to `tests/component/CardControl.test.ts` with the four tests named in the test plan below. They fail: no `.duel-field-card__material` exists yet, and `CardControl` rejects/ignores the new props.
2. **Green** — create `MaterialCard.svelte`, wire it into `CardControl.svelte`, add the CSS, thread the props from `FieldBoard.svelte`.
3. **Refactor** — only if needed. Keep green.

## Test plan

All in `tests/component/CardControl.test.ts`. Helper: extend the file with

```ts
function makeMaterial(
  overrides: Partial<BoardMaterialView> & { id: string; sequence: number },
): BoardMaterialView {
  return {
    identityVisible: false,
    label: "Hidden material",
    ...overrides,
  };
}
```

and a `renderFieldCard(card)` helper mirroring `renderCard` but passing `cardBackUrl: "/back.webp"` and `placeholderUrl: "/placeholder.webp"` explicitly (keep `layout: "hand"`, `placement: null` — material rendering must not depend on layout).

| Test | Input | Expect |
| ---- | ----- | ------ |
| `renders one material element per entry with unique data-cy` | card with 2 materials (ids `material:a`, `material:b`) | `document.querySelectorAll(".duel-field-card__material")` length 2; elements carry `data-cy="field-card-material-material:a"` and `"field-card-material-material:b"` |
| `orders materials by sequence and indexes the offset variable` | materials given **out of order**: `[{id:"material:b",sequence:1},{id:"material:a",sequence:0}]` | DOM order of `.duel-field-card__material` is `material:a` then `material:b`; `getAttribute("style")` contains `--material-index: 0` on the first and `--material-index: 1` on the second (offset direction is carried by the fixed CSS rule `translateX(calc((var(--material-index) + 1) * 12%))`, so ascending index ⇒ further right) |
| `hidden material shows the card back` | 1 material, `identityVisible: false`, no `code` | material `<img data-cy="field-card-material-image-...">` has `src` ending `/back.webp` and `alt=""`; root div has `aria-hidden="true"` |
| `visible material shows art with placeholder fallback` | 1 material, `identityVisible: true`, `code: cardCode(5053103)`, `label: "Right Leg of the Forbidden One"`, `imageLibrary: null` | material `<img>` `src` ends `/placeholder.webp` (no library ⇒ fallback), `alt` is the label; card with `materials: []` renders zero `.duel-field-card__material` elements |

Run: `npx vitest run tests/component/CardControl.test.ts` while iterating; full gates in Validation.

## Impl steps

- [ ] 1. Red: failing component tests
  - [ ] 1.1 In `tests/component/CardControl.test.ts`, import `BoardMaterialView` alongside the existing `BoardCardView` type import, and `cardCode` is already imported. Add the `makeMaterial` helper and `renderFieldCard` helper (exact shapes above), then the `describe("CardControl xyz materials")` block with the four tests from the test plan, asserting exactly the selectors/attributes in the Expect column.
  - [ ] 1.2 Run `npx vitest run tests/component/CardControl.test.ts` — the four new tests fail (no material elements rendered), existing tests stay green.
- [ ] 2. New `MaterialCard.svelte`
  - [ ] 2.1 Create `src/battle/app/components/duel-field/MaterialCard.svelte`:

    ```svelte
    <script lang="ts">
      import { onDestroy } from "svelte";
      import type { BoardMaterialView } from "../../../field/board-view-model.ts";
      import type {
        CardImageLease,
        CardImageLibrary,
      } from "../../images/card-image-cache.ts";

      export let material: BoardMaterialView;
      export let index: number;
      export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
      export let cardBackUrl = "";
      export let placeholderUrl = "";

      let activeImageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
      let activeImageCode: number | undefined;
      let imageLease: CardImageLease | null = null;
      let renderedImageUrl = cardBackUrl;

      $: faceCode =
        material.identityVisible && material.code !== undefined
          ? Number(material.code)
          : undefined;
      $: synchronizeImageLease(
        imageLibrary,
        faceCode,
        faceCode === undefined ? cardBackUrl : placeholderUrl,
      );

      onDestroy(() => imageLease?.release());

      function synchronizeImageLease(
        library: Pick<CardImageLibrary, "lease"> | null,
        code: number | undefined,
        fallbackUrl: string,
      ): void {
        if (library !== activeImageLibrary || code !== activeImageCode) {
          imageLease?.release();
          activeImageLibrary = library;
          activeImageCode = code;
          imageLease =
            library !== null && code !== undefined ? library.lease(code) : null;
        }
        renderedImageUrl = imageLease?.url ?? fallbackUrl;
      }

      function useFallbackImage(event: Event): void {
        const image = event.currentTarget as HTMLImageElement;
        image.onerror = null;
        renderedImageUrl = placeholderUrl;
      }
    </script>

    <div
      class="duel-field-card__material"
      aria-hidden="true"
      style={`--material-index: ${index};`}
      data-material-sequence={material.sequence}
      data-cy={`field-card-material-${material.id}`}
    >
      <img
        src={renderedImageUrl}
        alt={material.identityVisible ? material.label : ""}
        decoding="async"
        onerror={faceCode === undefined ? undefined : useFallbackImage}
        data-cy={`field-card-material-image-${material.id}`}
      />
    </div>
    ```

- [ ] 3. Wire into `CardControl.svelte`
  - [ ] 3.1 In `src/battle/app/components/duel-field/CardControl.svelte`, script block: add `import MaterialCard from "./MaterialCard.svelte";` under the `CardActionChips` import; add after the `export let imageLibrary ...` line:

    ```ts
    export let cardBackUrl = "";
    export let placeholderUrl = "";
    ```

    and with the other reactive statements:

    ```ts
    $: sortedMaterials = [...card.materials].sort(
      (a, b) => a.sequence - b.sequence,
    );
    ```

  - [ ] 3.2 In the same file's markup, insert as the **first** children of `<article class="duel-field-card" ...>` (before the `.duel-field-card__art` div, so materials also precede it in DOM order):

    ```svelte
    {#each sortedMaterials as material, index (material.id)}
      <MaterialCard
        {material}
        {index}
        {imageLibrary}
        {cardBackUrl}
        {placeholderUrl}
      />
    {/each}
    ```

- [ ] 4. CSS
  - [ ] 4.1 In `src/styles/app.css`, insert directly above the `.duel-field-card__art {` rule (line ~2288):

    ```css
    /* Xyz materials fan out Duel Links style: each material is a full-size
       card slid 12% of the card width further right per step, painted at
       z-index -1 so it sits behind the art inside the card's own stacking
       context (the card root's z-index makes it one) yet above the board. */
    .duel-field-card__material {
      position: absolute;
      inset: 0;
      z-index: -1;
      overflow: hidden;
      border: 1px solid
        color-mix(in srgb, var(--field-card-edge) 78%, transparent);
      border-radius: 0.28rem;
      background: var(--surface-strong);
      box-shadow: 0 0.35rem 0.8rem
        color-mix(in srgb, var(--shadow) 32%, transparent);
      transform: translateX(calc((var(--material-index) + 1) * 12%));
      pointer-events: none;
    }

    .duel-field-card__material img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .duel-field-card.is-opponent .duel-field-card__material img {
      transform: rotate(180deg);
    }
    ```

- [ ] 5. Thread props from the board
  - [ ] 5.1 In `src/battle/app/components/duel-field/FieldBoard.svelte`, in the `{#each fieldCards as card (card.id)}` `<CardControl ...>` instantiation (line ~297), add `{cardBackUrl}` and `{placeholderUrl}` alongside the existing `{imageLibrary}` shorthand props. Leave `HandBand.svelte` untouched — hand cards never carry materials, and the new props default to `""`.
- [ ] 6. Green + gates
  - [ ] 6.1 Run `npx vitest run tests/component/CardControl.test.ts` — all tests green.
  - [ ] 6.2 Run `npm run test:component` — green (data-cy coverage in `tests/unit/data-cy-coverage.test.ts` re-verifies presence + uniqueness of the two new `data-cy` values; the ST-07 fixture already renders a host with materials through `DuelField`).
  - [ ] 6.3 Run `npm run check:headless` — green (types, lint, boundaries; new imports stay inside `src/battle/`).

## Outputs

- Files touched: `src/battle/app/components/duel-field/MaterialCard.svelte` (new), `src/battle/app/components/duel-field/CardControl.svelte`, `src/battle/app/components/duel-field/FieldBoard.svelte`, `src/styles/app.css`, `tests/component/CardControl.test.ts`.
- Behavior change: field cards with xyz materials now show each material peeking out to the right behind the host, both players; face art for public materials, card back for hidden ones. Non-interactive.
- Public API change: `CardControl` gains optional `cardBackUrl`/`placeholderUrl` props (defaults `""`, backward-compatible). No domain public entry (`src/battle/index.ts`) changes. No migrations/config.

## Validation

- [ ] tests pass: `npx vitest run tests/component/CardControl.test.ts`, then `npm run test:component`, then `npm run check:headless` — all exit 0.
- [ ] manual check: `npm run dev`, start a duel, summon an Xyz monster (or load a diagnostic state with fixture ST-07-like materials); confirm materials peek out to the right behind the host on both your row and (via opponent play) the opponent's row, hidden materials show the back, and hovering/clicking a material hits the host card, not the material.
- [ ] no silent-failure swallow on a path this slice adds: one kept site — `useFallbackImage` clears `onerror` and swaps to `placeholderUrl` on image load failure, mirroring the existing `CardControl`/`StackControl` pattern; a broken art URL must degrade to a placeholder, not surface an error. No `|| true`, empty catch, or discarded promise added.
- [ ] app functional — duel field renders and plays exactly as before for cards without materials (zero-material cards emit zero new elements).
- [ ] commit msg draft: `feat(duel): render xyz materials fanned behind the host card, Duel Links style`
