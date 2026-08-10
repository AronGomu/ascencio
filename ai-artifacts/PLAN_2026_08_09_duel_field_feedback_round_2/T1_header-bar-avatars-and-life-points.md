# T1: Duel header bar with avatars and life points

**Plan:** `./ai-artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md`
**Depends:** none
**Commit outcome:** The top row of the app is a duel header carrying the opponent avatar + LP on the left, your avatar + LP on the right, and a gear icon button that opens the menu; the in-field life-point pills are deleted.

## Context (self-contained)

- Goal: ship 17 duel-field feedback items. This slice is item 1.
- This slice: the app currently renders `src/app/components/AppMenubar.svelte`, a bare `<header class="app-menubar">` holding one right-justified `Settings` text button. Life points render *inside* the board as two absolutely positioned pills (`src/app/components/duel-field/LifePointsPill.svelte`). The user wants that top row to become a real duel header: avatar + life points per player, and the settings button turned into a gear icon that keeps its position.
- Out of scope here: the card preview panel position (T2), the phase strip (T3), anything inside `duel-field-board`, real character art, settings persistence.
- Assumptions in force:
  - **A2** UI settings are in-memory for the session.
  - **A3** Avatars reuse the bundled card-back image as their art. The component takes an `avatarUrl` prop per player so real art can be dropped in later without a layout change.
  - **A13** `LifePointsPill.svelte` is deleted, not restyled.

## Requirements

1. New component `src/app/components/DuelHeaderBar.svelte` replaces `src/app/components/AppMenubar.svelte`. Delete `AppMenubar.svelte`.
2. `DuelHeaderBar` renders, left to right: opponent avatar image, opponent life points, a flexible spacer, your avatar image, your life points, gear button.
3. The gear button keeps the existing behaviour and the existing `data-cy` value `app-menubar-settings-button` (it is queried by `onMount` in `src/app/App.svelte` and asserted by `tests/component/AppChrome.test.ts`). Its visible content becomes an inline SVG gear; its accessible name stays `Settings` via `aria-label`.
4. Life points render as `{value.toLocaleString()} LP`. When `lifePoints` is `null` (no snapshot yet) render `—` and no numeric text.
5. Avatar `src` comes from the `avatarUrl` prop. When the prop is an empty string, render the inline SVG placeholder constant `DEFAULT_AVATAR_PLACEHOLDER` defined in the component. `alt` is `""` and `aria-hidden="true"` — the accessible name lives on the surrounding group.
6. `src/app/components/duel-field/LifePointsPill.svelte` is deleted. `src/app/components/DuelField.svelte` drops its `lifePoints` prop, its `LifePointsPill` import and the `{#if lifePoints !== null}` block. `src/app/App.svelte` stops passing `lifePoints` to `DuelFieldErrorBoundary` and stops computing `fieldLifePoints`; it passes the same values to `DuelHeaderBar` instead.
7. `src/app/components/duel-field/DuelFieldErrorBoundary.svelte` drops the `lifePoints` prop it forwards.
8. Every rendered element carries a unique kebab-case `data-cy` (project rule, enforced by `tests/unit/data-cy-coverage.test.ts`).

### Exact `data-cy` values

| Element | `data-cy` |
| --- | --- |
| `<header>` root | `duel-header-bar` |
| opponent group `<div>` | `duel-header-player-1` |
| opponent avatar `<img>` | `duel-header-avatar-p1` |
| opponent life points `<p>` | `duel-header-life-points-p1` |
| spacer `<div>` | `duel-header-spacer` |
| your group `<div>` | `duel-header-player-0` |
| your avatar `<img>` | `duel-header-avatar-p0` |
| your life points `<p>` | `duel-header-life-points-p0` |
| gear `<button>` | `app-menubar-settings-button` (unchanged) |
| gear `<svg>` | `duel-header-settings-icon` |

### Exact component contract

```svelte
<!-- src/app/components/DuelHeaderBar.svelte -->
<script lang="ts">
  export let lifePoints: readonly [number, number] | null = null;
  export let selfAvatarUrl = "";
  export let opponentAvatarUrl = "";
  export let onopensettings: () => void;
</script>
```

`App.svelte` call site:

```svelte
<DuelHeaderBar
  lifePoints={headerLifePoints}
  selfAvatarUrl={imageLibrary?.cardBackUrl ?? ""}
  opponentAvatarUrl={imageLibrary?.cardBackUrl ?? ""}
  onopensettings={openMenu}
/>
```

with

```ts
$: headerLifePoints =
  $duel.snapshot === null
    ? null
    : ([
        $duel.snapshot.players[0].lifePoints,
        $duel.snapshot.players[1].lifePoints,
      ] as const);
```

(`fieldLifePoints` is renamed to `headerLifePoints`; the expression is otherwise identical.)

## Inputs

- `src/app/components/AppMenubar.svelte` — the file being replaced.
- `src/app/App.svelte` — lines that import `AppMenubar`, render `<AppMenubar onopensettings={openMenu} />`, compute `fieldLifePoints`, and pass `lifePoints={fieldLifePoints}` to `DuelFieldErrorBoundary`. Also `onMount` queries `'[data-cy="app-menubar-settings-button"]'` into `menubarTrigger` — keep that selector working.
- `src/app/components/DuelField.svelte` — `export let lifePoints: readonly [number, number] | null = null;`, the `LifePointsPill` import, and the render block:
  ```svelte
  {#if lifePoints !== null}
    <LifePointsPill player={1} lifePoints={lifePoints[1]} />
    <LifePointsPill player={0} lifePoints={lifePoints[0]} />
  {/if}
  ```
- `src/app/components/duel-field/DuelFieldErrorBoundary.svelte` — forwards `lifePoints` through to `DuelField`.
- `src/app/components/duel-field/LifePointsPill.svelte` — to delete.
- `src/styles/app.css` — `.app-menubar` rule (around line 145) and `.life-pill`, `.life-pill.is-opponent`, `.life-pill.is-self` rules (around lines 753-773).
- `src/app/images/card-image-cache.ts` — `CardImageLibrary.cardBackUrl: string` is the avatar source.
- `tests/component/AppChrome.test.ts` — asserts on the menubar and its settings button.
- `tests/component/DuelField.test.ts` — asserts on `life-pill-p0` / `life-pill-p1`; those assertions move or die.
- `tests/unit/data-cy-coverage.test.ts` — the static + rendered `data-cy` gate.
- **From Depends:** none. This is the first ticket.

## TDD

1. **Red** — add `tests/component/DuelHeaderBar.test.ts` with the four tests below and delete the two life-pill tests from `tests/component/DuelField.test.ts`. Run `npm run test:component`; the new file must fail because the component does not exist.
2. **Green** — write `DuelHeaderBar.svelte`, delete `AppMenubar.svelte` and `LifePointsPill.svelte`, rewire `App.svelte`, `DuelField.svelte`, `DuelFieldErrorBoundary.svelte`, move the CSS.
3. **Refactor** — only if needed. Keep green.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `renders both life-point readouts` | render `DuelHeaderBar` with `lifePoints={[8000, 7300]}` | `duel-header-life-points-p0` text is `8,000 LP`; `duel-header-life-points-p1` text is `7,300 LP` |
| `renders an em dash before the first snapshot` | `lifePoints={null}` | both `duel-header-life-points-p0` and `duel-header-life-points-p1` text is `—` |
| `uses the supplied avatar url for both players` | `selfAvatarUrl="a.png"`, `opponentAvatarUrl="b.png"` | `duel-header-avatar-p0` `src` is `a.png`; `duel-header-avatar-p1` `src` is `b.png` |
| `opens settings from the gear button` | click `app-menubar-settings-button` | `onopensettings` called once; the button's accessible name is `Settings`; `duel-header-settings-icon` is present |
| `duel field no longer renders life pills` (edit in `tests/component/DuelField.test.ts`) | render `DuelField` with the existing board fixture | `queryByTestId`-equivalent lookup for `life-pill-p0` and `life-pill-p1` returns `null` |

## Impl steps

- [x] 1. Create `tests/component/DuelHeaderBar.test.ts` with the four `DuelHeaderBar` tests from the table, importing `DuelHeaderBar` from `../../src/app/components/DuelHeaderBar.svelte` and following the `render`/`@testing-library/svelte` style already used in `tests/component/AppChrome.test.ts`.
- [x] 2. In `tests/component/DuelField.test.ts`, delete the assertions that read `life-pill-p0` / `life-pill-p1` and add the `duel field no longer renders life pills` negative test.
- [x] 3. Run `npm run test:component` and confirm the new file fails for "cannot find module".
- [x] 4. Create `src/app/components/DuelHeaderBar.svelte` with the script contract above, a `const DEFAULT_AVATAR_PLACEHOLDER` data-URI SVG circle, and the markup carrying every `data-cy` in the table.
- [x] 5. Give the gear button `aria-label="Settings"`, `type="button"`, `class="secondary duel-header-bar__settings"`, and an inline `<svg viewBox="0 0 24 24" aria-hidden="true" data-cy="duel-header-settings-icon">` gear path.
- [x] 6. Delete `src/app/components/AppMenubar.svelte`.
- [x] 7. Delete `src/app/components/duel-field/LifePointsPill.svelte`.
- [x] 8. In `src/app/App.svelte`, replace the `AppMenubar` import with `DuelHeaderBar`, rename `fieldLifePoints` to `headerLifePoints`, replace `<AppMenubar onopensettings={openMenu} />` with the `DuelHeaderBar` call site shown above.
- [x] 9. In `src/app/App.svelte`, delete `lifePoints={fieldLifePoints}` from the `DuelFieldErrorBoundary` call site.
- [x] 10. In `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, delete the `lifePoints` prop declaration and its forwarding.
- [x] 11. In `src/app/components/DuelField.svelte`, delete the `LifePointsPill` import, the `export let lifePoints` declaration and the `{#if lifePoints !== null}` block.
- [x] 12. In `src/styles/app.css`, replace the `.app-menubar` rule with `.duel-header-bar` (`display: flex; align-items: center; gap: 0.75rem; width: min(120rem, calc(100% - 2rem)); margin-inline: auto; padding-block: 0.75rem;`) plus `.duel-header-bar__spacer { flex: 1 1 auto; }`, `.duel-header-bar__player { display: flex; align-items: center; gap: 0.5rem; }`, `.duel-header-bar__avatar { width: 2.5rem; height: 2.5rem; border-radius: 999px; object-fit: cover; border: 1px solid var(--border); }`, `.duel-header-bar__life { margin: 0; color: var(--warning); font-weight: 800; }`, `.duel-header-bar__settings svg { width: 1.1rem; height: 1.1rem; fill: currentcolor; display: block; }`.
- [x] 13. In `src/styles/app.css`, delete the `.life-pill`, `.life-pill.is-opponent` and `.life-pill.is-self` rules.
- [x] 14. Run `npm run format:check`, `npm run lint`, `npm run typecheck`.
- [x] 15. Run `npm run test:unit` and `npm run test:component`; fix any `data-cy` uniqueness failure by making the offending value unique.

## Outputs

- Added: `src/app/components/DuelHeaderBar.svelte`, `tests/component/DuelHeaderBar.test.ts`.
- Deleted: `src/app/components/AppMenubar.svelte`, `src/app/components/duel-field/LifePointsPill.svelte`.
- Edited: `src/app/App.svelte`, `src/app/components/DuelField.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts`.
- Behaviour change: life points are read from the header, not from inside the board. `DuelField` no longer accepts a `lifePoints` prop.
- Public contract for successors: `DuelHeaderBar` props are `lifePoints: readonly [number, number] | null`, `selfAvatarUrl: string`, `opponentAvatarUrl: string`, `onopensettings: () => void`. The settings trigger keeps `data-cy="app-menubar-settings-button"`.
- No migration, no config change.

## Validation

- [x] `npm run format:check` exits 0
- [x] `npm run lint` exits 0
- [x] `npm run typecheck` exits 0
- [x] `npm run test:unit` exits 0 (includes the `data-cy` coverage gate)
- [x] `npm run test:component` exits 0, including the four new `DuelHeaderBar` tests
- [ ] manual check: `npm run dev`, open the app, confirm two avatars and two LP readouts in the top row and a gear icon on the right that opens the menu (deferred — human manual step, see manual_test_checklist.md)
- [x] app functional — the duel still starts and the board still renders with no LP pills
- [x] commit msg draft: `feat(app): move life points and avatars into a duel header bar`
</content>
