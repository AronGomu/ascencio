# T7: Stack top-card face

**Plan:** `./artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md`
**Depends:** T2, T6
**Commit outcome:** A graveyard or banished pile that holds at least one publicly known card renders that card's art behind its name and count, so the pile reads as the last card that entered it.

## Context (self-contained)

- Goal: ship 17 duel-field feedback items. This slice is item 11.
- This slice: `src/app/components/duel-field/StackControl.svelte` renders a bare `<div>` with the zone's short name (`GY`, `deck`, `extra`, `banished`) and its count. `src/field/board-view-model.ts`'s `createStacks` already computes `publicCards = collection.filter(cardIdentityVisible)` and `top = publicCards.at(-1)`, and exposes `topCardLabel`. The art is never shown. The user wants the pile to keep its name and count **and** show the last card that entered it.
- Out of scope here: the zone list dialog (T8), the deck's own contents (T9/T10 — a deck stack has no public cards and must keep showing nothing), clicking a stack (T8).
- Assumptions in force:
  - **A10** a stack never fires a choice directly.
- **From Depends (T6):**
  - `src/app/components/duel-field/StackControl.svelte` already declares `export let actionable = false;` and renders `class:is-actionable={actionable}` + `data-actionable`. It is still a `<div role="group">` with `data-cy={\`field-stack-${stack.id}\`}`, `data-field-target={stack.targetId}`, `data-stack-id`, `data-stack-zone` and a `positionStyle` string built from `stack.x/y/width/height`.
  - `src/app/components/duel-field/FieldBoard.svelte` passes `actionable={!disabled && spec?.stackChoices.has(stack.targetId) === true}` in its `{#each board.stacks …}` loop.
  - `ActiveInteractionSpec.stackChoices` exists.
- **From Depends (T2):** `BoardStackView` carries `readonly topCardCode?: CardCode`, populated from the same `top` record that produces `topCardLabel`. `StackControl` already declares `export let onpreview: () => void = () => undefined;` fired on `onpointerenter` / `onfocusin`.

## Requirements

1. `src/app/components/duel-field/StackControl.svelte` gains the image plumbing `CardControl.svelte` already uses:
   ```ts
   export let imageLibrary: Pick<CardImageLibrary, "lease"> | null = null;
   export let placeholderUrl = "";
   ```
   plus the one-lease-at-a-time pattern copied from `CardControl.svelte`: `activeImageLibrary`, `activeImageCode`, `imageLease`, `renderedImageUrl`, a `synchronizeImageLease(library, code, fallbackUrl)` reactive call and `onDestroy(() => imageLease?.release())`. The leased code is `stack.topCardCode`.
2. When `stack.topCardCode !== undefined`, render an `<img>` inside a new `.duel-field-stack__art` wrapper **behind** the existing name and count. When it is `undefined`, render neither the wrapper nor the image; the pile looks exactly as it does today.
3. The name and count stay visible and legible over the art: the art wrapper is absolutely positioned, `inset: 0`, `z-index: 0`, `opacity: 0.85`; the name and count get `position: relative; z-index: 1` and a text shadow.
4. Accessibility: the `<img>` carries `alt=""` and `aria-hidden="true"`. `stack.label` already ends with `, top card <name>` when a top card exists, so the group's accessible name is already correct — do not change it.
5. `src/app/components/duel-field/FieldBoard.svelte` passes `{imageLibrary}` and `{placeholderUrl}` into `StackControl`. Both already exist as `FieldBoard` props.
6. The deck pile must show nothing: `createStacks` returns `[]` for `stackCollection(player, "deck")` today, so `topCardCode` is `undefined` for every deck stack and requirement 2 already covers it. Add an explicit test rather than relying on that being obvious.
7. Every new rendered element carries a unique kebab-case `data-cy`.

### Exact `data-cy` values

| Element | `data-cy` |
| --- | --- |
| art wrapper `<div>` | `` `stack-control-art-${stack.id}` `` |
| art `<img>` | `` `stack-control-image-${stack.id}` `` |

(The existing `stack-control-name-${stack.id}` and `stack-control-count-${stack.id}` values are unchanged.)

## Inputs

- `src/app/components/duel-field/StackControl.svelte` — full file.
- `src/app/components/duel-field/CardControl.svelte` — the lease block to copy:
  ```ts
  function synchronizeImageLease(
    library: Pick<CardImageLibrary, "lease"> | null,
    code: number | undefined,
    fallbackUrl: string,
  ): void {
    if (library !== activeImageLibrary || code !== activeImageCode) {
      imageLease?.release();
      activeImageLibrary = library;
      activeImageCode = code;
      imageLease = library !== null && code !== undefined ? library.lease(code) : null;
    }
    renderedImageUrl = imageLease?.url ?? fallbackUrl;
  }
  ```
  and its `useFallbackImage(event)` error handler.
- `src/app/images/card-image-cache.ts` — `CardImageLibrary.lease(code: number): CardImageLease` where `CardImageLease` is `{ url: string; release(): void }`.
- `src/app/components/duel-field/FieldBoard.svelte` — `export let imageLibrary`, `export let placeholderUrl`, the stack loop.
- `src/field/board-view-model.ts` — `createStacks`, `stackCollection`, `cardIdentityVisible`, `BoardStackView.topCardCode` (added in T2), `BoardStackView.topCardLabel`.
- `src/styles/app.css` — the `.duel-field-stack` rule (~line 958) and the `.duel-field-card__art img` rule for the object-fit / border-radius pattern.
- `tests/component/DuelField.test.ts`, `tests/fixtures/board-view-model.ts`, `tests/fixtures/board-public-states.ts`.
- **From Depends (T6) and T2:** listed in Context above.

## TDD

1. **Red** — add the four `DuelField` / `StackControl` cases below. Run `npm run test:component`; they must fail.
2. **Green** — add the image plumbing and the art element, wire `FieldBoard`, add the CSS.
3. **Refactor** — only if needed. Keep green.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `graveyard shows its last public card` | board fixture whose `p0:graveyard` stack has `topCardCode: 1234` and `count: 4`; `imageLibrary` returning `blob:1234` | `stack-control-image-p0:graveyard` `src` is `blob:1234`; `stack-control-name-p0:graveyard` still reads `GY`; `stack-control-count-p0:graveyard` still reads `4` |
| `banished shows its last public card` | same for `p0:banished` | `stack-control-image-p0:banished` present |
| `an empty pile shows no art` | `p1:graveyard` stack with `count: 0`, no `topCardCode` | `stack-control-art-p1:graveyard` absent |
| `the deck never shows art` | `p0:deck` stack with `count: 40` | `stack-control-art-p0:deck` absent |
| `the lease is released on destroy` | render then unmount `DuelField` with a stack that has `topCardCode`; spy on the returned lease's `release` | `release` called exactly once |

## Impl steps

- [x] 1. Add the five cases to `tests/component/DuelField.test.ts`, extending the board fixture in `tests/fixtures/board-view-model.ts` with `topCardCode` values where the table needs them.
- [x] 2. Run `npm run test:component`; confirm the new cases fail.
- [x] 3. In `src/app/components/duel-field/StackControl.svelte`, add the `imageLibrary` and `placeholderUrl` props, the four lease variables, the `synchronizeImageLease` reactive call, `onDestroy(() => imageLease?.release())` and `useFallbackImage`.
- [x] 4. In the same file, render, as the **first** child of the root `<div>`:
  ```svelte
  {#if stack.topCardCode !== undefined}
    <div class="duel-field-stack__art" data-cy={`stack-control-art-${stack.id}`}>
      <img
        src={renderedImageUrl}
        alt=""
        aria-hidden="true"
        decoding="async"
        onerror={useFallbackImage}
        data-cy={`stack-control-image-${stack.id}`}
      />
    </div>
  {/if}
  ```
- [x] 5. In `src/app/components/duel-field/FieldBoard.svelte`, pass `{imageLibrary}` and `{placeholderUrl}` to `StackControl`.
- [x] 6. In `src/styles/app.css`, add:
  ```css
  .duel-field-stack { position: absolute; overflow: hidden; }
  .duel-field-stack__art { position: absolute; z-index: 0; inset: 0; opacity: 0.85; }
  .duel-field-stack__art img { width: 100%; height: 100%; object-fit: cover; border-radius: 0.35rem; display: block; }
  .duel-field-stack__name,
  .duel-field-stack__count { position: relative; z-index: 1; text-shadow: 0 1px 2px rgb(4 9 18 / 0.9); }
  ```
  (`.duel-field-stack` already gets `position: absolute` from the shared `.duel-field-stack, .duel-field-card` rule — add only `overflow: hidden` there rather than duplicating the position.)
- [x] 7. Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:component`.

## Outputs

- Edited: `src/app/components/duel-field/StackControl.svelte`, `src/app/components/duel-field/FieldBoard.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts`, `tests/fixtures/board-view-model.ts`.
- Public contract for successors: `StackControl` accepts `imageLibrary: Pick<CardImageLibrary, "lease"> | null` and `placeholderUrl: string`, and renders `stack-control-art-<id>` / `stack-control-image-<id>` when `stack.topCardCode` is defined. The name and count elements keep their existing `data-cy` values.
- No migration, no config change.

## Validation

- [x] `npm run format:check` exits 0
- [x] `npm run lint` exits 0
- [x] `npm run typecheck` exits 0
- [x] `npm run test:unit` exits 0
- [x] `npm run test:component` exits 0
- [ ] manual check: `npm run dev`, send a monster to the graveyard — the graveyard pile shows that card's art with `GY` and the count still readable on top
- [ ] app functional — the deck and extra deck piles are unchanged, and no image lease leaks (open and restart a duel twice, watch for growing `blob:` URLs in devtools memory)
- [ ] commit msg draft: `feat(field): show the last public card on graveyard and banished piles`
</content>
