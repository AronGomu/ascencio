# T9: Hover action chips and orange halo

**Plan:** `./artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
**Depends:** T6
**Commit outcome:** `FieldActionMenu.svelte` is deleted; an actionable card wears an orange halo and reveals tiny fixed-size action chips floating above it on hover or focus, with no `Inspect` and no `Close actions` entries.

## Context (self-contained)

- Goal: turn the app from a panel stack into a field-first duel client. Feedback items 11 and 12.
- Today a click on an actionable card dispatches `openMenu`, and `DuelField.svelte` renders a fixed-position 18rem `FieldActionMenu` anchored with `getBoundingClientRect`, a `ResizeObserver`, and `window` resize/scroll listeners. The menu lists the engine's full labels (`Activate Mystical Space Typhoon`), plus `Inspect …` and `Close actions`.
- This slice: replace all of that with chips rendered inside the card, revealed by CSS on hover / focus-within / pinned state, labelled by the choice's `action` rather than its engine text.
- Out of scope here: drag and drop (T10), preview panel (T11). `CardInspector` stays reachable from the HUD trays until T11.
- Assumptions in force: A8 (orange halo covers actionable cards and zones), A9 (chips are intentionally smaller than the 44px pointer-target guidance; the card's own 44px target and the keyboard path stay intact), A14 (`Special Summon` and `Change Position` keep two words).

## Requirements

- Chip label comes from `choice.action`, never from `choice.label`. Full engine label stays as the chip's `title` and accessible name.
- No `Inspect` chip, no `Close actions` chip, and no `Inspect` button on the card.
- Chips are fixed size: `height: 1.15rem`, `min-width: 3.4rem`, `font-size: .55rem`.
- Chips float above the card, overlapping its top edge by `0.35rem` so moving the pointer from card to chip never crosses a hover gap.
- Chips are invisible until the card is hovered, contains focus, or is the pinned `session.menuTarget`.
- Only actionable cards get chips and only actionable cards get the halo.
- Halo colour is orange (`--warning`) for actionable cards and actionable zones; the selected state keeps its existing lime treatment.
- Keyboard: `Enter`/`Space` on the card target pins the chips and moves focus to the first chip; `ArrowLeft` / `ArrowRight` move between chips; `Escape` unpins and returns focus to the card target.
- Choosing a chip dispatches exactly one `{ type: "chooseChoice", choiceId, key: spec.key }` and unpins.

## Inputs

- Create: `src/app/presentation/card-action-label.ts`, `src/app/components/duel-field/CardActionChips.svelte`, `tests/unit/card-action-label.test.ts`, `tests/component/CardActionChips.test.ts`.
- Delete: `src/app/components/duel-field/FieldActionMenu.svelte`.
- Edit: `src/app/components/DuelField.svelte`, `src/app/components/duel-field/FieldBoard.svelte`, `src/app/components/duel-field/CardControl.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/app/App.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts`, `tests/unit/global-styles.test.ts`, `e2e/duel-smoke.spec.ts`.
  (The last two were listed in `## Outputs` but missing from this Edit list — a ticket-internal inconsistency, corrected 2026-08-09. Editing them is **in scope**. The plan's own risk list is explicit: every ticket that changes a selector fixes its own e2e assertions in the same commit, never deferred.)
- **From Depends (T6):** `FieldActionBar.svelte` owns Confirm/Cancel/global choices and is gated by `fieldActionBarRequired(spec)`; `SelectionDock.svelte` is gone. `DuelField.svelte` already imports `FieldActionBar` and (from T7) `EndTurnButton`.
- **From Depends (T6 + T7) — the bottom-gutter mechanism (added 2026-08-09; you are unlikely to need to touch it, but do not break it):** `.duel-field` carries an unconditional `padding-bottom: calc(1rem + 2.75rem + 0.75rem)` reserving room for the always-mounted `.field-end-turn` corner button, plus a `.duel-field[data-field-action-bar="true"]` override that widens the gutter to the action bar's measured height (`--field-action-bar-height`, set by `DuelField.svelte` from a `ResizeObserver` inside `FieldActionBar`). Both are widened again inside `@media (max-width: 48rem)`. Two e2e assertions in the responsive-viewport test enforce that neither the bar nor the corner button intersects `.duel-field-board` — **hard gates, do not weaken or delete them.** Note for any CSS you add: a `@container` query **cannot** style its own query container, only descendants; `.duel-field` declares `container: duel-field / inline-size`, so a `@container duel-field (...) { .duel-field { … } }` rule silently no-ops. T7 lost a validation cycle to exactly that.
  (Corrected 2026-08-09: this bullet originally also promised `FieldStatusPills` / `LifePointsPill` "from T8". **T8 has not run yet** — the execution order is T6, T7, T9, T10, T11, T8, because T8 depends on T7 and nothing depends on T8. Do not expect those components to exist and do not create them; they are T8's job.)
- Read only: `src/app/prompts/interaction-session.ts` — keep using the existing `openMenu` / `closeMenu` actions and `session.menuTarget`; the reducer already refuses `openMenu` for targets absent from the spec and ignores repeat opens. `src/duel/contracts/player-prompt.ts` — the `ChoiceAction` union has exactly eighteen members.

## Exact API to create

```ts
// src/app/presentation/card-action-label.ts
import type { ChoiceAction } from "../../duel/contracts/player-prompt.ts";

export const CARD_ACTION_LABELS: Readonly<Record<ChoiceAction, string>> = Object.freeze({
  summon: "Summon",
  specialSummon: "Special Summon",
  flipSummon: "Flip",
  setMonster: "Set",
  setSpellTrap: "Set",
  activate: "Activate",
  changePosition: "Change Position",
  attack: "Attack",
  battlePhase: "Battle",
  mainPhase2: "Main 2",
  endPhase: "End turn",
  shuffle: "Shuffle",
  yes: "Yes",
  no: "No",
  pass: "Pass",
  cancel: "Cancel",
  finish: "Finish",
  select: "Select",
});

export function cardActionLabel(action: ChoiceAction): string;
```

```svelte
<!-- src/app/components/duel-field/CardActionChips.svelte -->
export let cardId: string;
export let cardLabel: string;
export let choices: readonly InteractionChoice[];
export let disabled = false;
export let onchoose: (choice: InteractionChoice) => void;
export let ondismiss: () => void;
```

New `CardControl.svelte` props:

```ts
export let choices: readonly InteractionChoice[] = [];
export let pinned = false;
export let onchoose: (choice: InteractionChoice) => void = () => undefined;
export let ondismiss: () => void = () => undefined;
```

`CardControl.svelte` loses: the `oninspect` prop and the `button.duel-field-card__inspect` element.

## data-cy contract added here

`` `card-action-chips-${cardId}` ``, `` `card-action-chip-${choiceId}` ``. Removed: `field-action-menu` and its children, the card inspect button.

## TDD

1. **Red** — write `tests/unit/card-action-label.test.ts` and `tests/component/CardActionChips.test.ts`, and rewrite the four menu-based cases in `tests/component/DuelField.test.ts`; record failures.
2. **Green** — add the label map and chips, rewire `CardControl` / `FieldBoard` / `DuelField`, delete the menu.
3. **Refactor** — delete every anchor helper the menu needed; `npm run lint` must report no unused symbols.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `every choice action has a label` | `CARD_ACTION_LABELS` | key set equals the `ChoiceAction` union, all eighteen |
| `labels stay short` | every value | each value has at most two words |
| `set actions collapse to one word` | `cardActionLabel("setMonster")`, `cardActionLabel("setSpellTrap")` | both `Set` |
| `activate collapses to one word` | `cardActionLabel("activate")` | `Activate` |
| `chips render one button per choice` | two choices | two `[data-cy^="card-action-chip-"]` buttons |
| `chip text is the action word` | choice `{ action: "activate", label: "Activate Mystical Space Typhoon" }` | chip text is `Activate`; `title` and `aria-label` contain the full label |
| `chips exclude inspect and close` | any | no button whose text matches `/inspect|close/i` |
| `chip click reports the choice` | click the first chip | `onchoose` called once with that choice |
| `arrow keys move between chips` | focus first chip, press `ArrowRight` | second chip is `document.activeElement` |
| `escape dismisses` | press `Escape` on a chip | `ondismiss` called once |
| `chips disabled while pending` | `disabled: true` | every chip is `disabled` |
| `actionable card shows chips markup` | render `DuelField` with a `cardAction` spec | `[data-cy^="card-action-chips-"]` exists inside the actionable card article |
| `non-actionable card has no chips` | same render | cards without choices have no chips element |
| `card click pins the chips` | click the card target | dispatched action is `{ type: "openMenu", target: card.targetId }` |
| `chip choice dispatches once` | click a chip | one `{ type: "chooseChoice", choiceId, key }`, no `openMenu` afterwards |
| `no inspect button on the field` | render `DuelField` with an actionable non-`cardAction` spec | no button whose name matches `/^Inspect /` |
| `no dialog menu remains` | any render | `container.querySelector('[role="menu"]')` is `null` |
| `halo is orange` | `src/styles/app.css` text | the `.duel-field-card.is-actionable .duel-field-card__art` rule uses `var(--warning)` and no `--accent` |

## Impl steps

- [x] 1. Create `tests/unit/card-action-label.test.ts` with rows one to four; record the failure, then create `src/app/presentation/card-action-label.ts` and re-run to green.
- [x] 2. Create `tests/component/CardActionChips.test.ts` (`// @vitest-environment jsdom`) with rows five to eleven; record failures.
- [x] 3. Create `src/app/components/duel-field/CardActionChips.svelte`: root `div.card-action-chips[role="group"][data-cy={`card-action-chips-${cardId}`}][aria-label={`${cardLabel} actions`}]`, one `button.card-action-chip[type="button"][data-cy={`card-action-chip-${choice.id}`}][title={choice.label}][aria-label={choice.label}][tabindex="-1"]` per choice whose text is `cardActionLabel(choice.action)`.
- [x] 4. In that component, handle `onkeydown`: `ArrowRight`/`ArrowDown` focus the next chip, `ArrowLeft`/`ArrowUp` the previous (both wrapping), `Home`/`End` jump to the ends, `Escape` calls `ondismiss()`. Each branch calls `event.preventDefault()`.
- [x] 5. In `CardActionChips.svelte`, add `export function focusFirstChip(): void { chipsElement?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true }); }` where `chipsElement` is the root `bind:this` target. This codebase runs Svelte 5 in legacy mode (`export let` props, `$:` reactives, `afterUpdate`), so a component-level `export function` is reachable only through an instance binding — the caller must hold one.
- [x] 6. In `src/styles/app.css`, add `.card-action-chips { position: absolute; z-index: var(--duel-field-layer-menu); bottom: calc(100% - .35rem); left: 50%; display: none; gap: .15rem; padding: .12rem; border-radius: .3rem; background: rgb(8 16 31 / .92); transform: translateX(-50%); }`.
- [x] 7. In `src/styles/app.css`, add `.duel-field-card.is-actionable:hover .card-action-chips, .duel-field-card.is-actionable:focus-within .card-action-chips, .duel-field-card.is-pinned .card-action-chips { display: flex; }`.
- [x] 8. In `src/styles/app.css`, add `button.card-action-chip { min-width: 3.4rem; min-height: 1.15rem; height: 1.15rem; padding: 0 .3rem; border-radius: .25rem; color: #2b1d00; background: var(--warning); font-size: .55rem; font-weight: 800; line-height: 1; white-space: nowrap; }` and `button.card-action-chip:hover:not(:disabled) { background: #ffc75c; }`.
- [x] 9. In `src/styles/app.css`, change the actionable halo rule so `.duel-field-zone.is-actionable, .duel-field-card.is-actionable .duel-field-card__art { border-color: var(--warning); box-shadow: 0 0 0 2px rgb(255 213 128 / .55); }`. Leave the `.is-selected` and `.is-feedback-target` rules untouched.
- [x] 10. In `src/styles/app.css`, delete the entire `.field-action-menu` rule.
- [x] 11. In `src/app/components/duel-field/CardControl.svelte`, add the four new props, add `class:is-pinned={pinned}` to the article, delete the `oninspect` prop and the `button.duel-field-card__inspect` element, and render `{#if actionable && choices.length > 0}<CardActionChips cardId={card.id} cardLabel={accessibleLabel} {choices} {disabled} {onchoose} {ondismiss} />{/if}`.
- [x] 12. In `src/styles/app.css`, delete the now-unused `.duel-field-card__inspect` rule.
- [x] 13. In `src/app/components/duel-field/CardControl.svelte`, hold the chips instance with `let chips: CardActionChips | undefined;` and `bind:this={chips}` on the `<CardActionChips … />` element, then react to pinning with:

  ```ts
  let wasPinned = false;
  $: if (pinned !== wasPinned) {
    wasPinned = pinned;
    if (pinned) void tick().then(() => chips?.focusFirstChip());
  }
  ```

  Import `tick` from `svelte`. Guard on the transition, not on `pinned` alone, or focus is stolen on every unrelated re-render.
- [x] 14. In `src/app/components/duel-field/FieldBoard.svelte`, drop the `oninspect` prop and pass `choices={spec?.cardChoices.get(card.targetId) ?? []}`, `pinned={pinnedTarget === card.targetId}`, `onchoose`, `ondismiss` through to `CardControl`. Add matching `export let pinnedTarget: BoardTargetId | null = null;`, `export let oncardchoose`, `export let oncarddismiss`.
- [x] 15. In `src/app/components/DuelField.svelte`, delete the `FieldActionMenu` import, the `FieldMenuAnchor` interface, and the variables `anchorElement`, `anchor`, `resizeObserver`, `menuCard`, plus `menuVisible`, `menuChoices`, `updateAnchor()`, `observeAnchor()`, `clearMenuAnchor()`, `inspectMenuCard()` and the `{#if menuVisible …}` block.
- [x] 16. In `src/app/components/DuelField.svelte`, delete the `window.addEventListener("resize", update)` and `window.addEventListener("scroll", update, true)` registrations and their removals in the `onMount` cleanup, and the `const update = …` line.
- [x] 17. In `src/app/components/DuelField.svelte`, simplify `activateCard`: the `cardAction` branch now only dispatches `{ type: "openMenu", target: card.targetId }`; all other branches are unchanged.
- [x] 18. In `src/app/components/DuelField.svelte`, pass `pinnedTarget={session.menuTarget}`, `oncardchoose={(choice) => { dispatch({ type: "chooseChoice", choiceId: choice.id }); }}` and `oncarddismiss={() => dispatch({ type: "closeMenu" })}` to `FieldBoard`, and delete the `oninspect` prop from `DuelField` entirely.
- [x] 19. In `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, delete the `oninspect` prop and stop forwarding it.
- [x] 20. In `src/app/App.svelte`, stop passing `oninspect` to `DuelFieldErrorBoundary` and delete the now-unused `inspectFieldCard()` function. Keep `inspectHudCard`, `inspectedCard` and `CardInspector` — the HUD still uses them until T11.
- [x] 21. Delete `src/app/components/duel-field/FieldActionMenu.svelte`.
- [x] 22. Rewrite these cases in `tests/component/DuelField.test.ts`: `focuses a command menu then returns focus on Escape`, `returns field focus before a command menu action removes its focused node`, `opens command menus on click, never pointerdown, and cancels moved pointers`, `updates anchored menu geometry on resize and scroll` (delete this one outright — there is no anchor any more). Replace them with the chip-based rows from the test plan; the pointer-move cancellation assertion must survive as "a moved pointer does not pin the chips".
- [x] 23. Run `npx vitest run tests/component/DuelField.test.ts tests/component/CardActionChips.test.ts` to green.
- [x] 24. Add the halo row to `tests/unit/global-styles.test.ts` and run it.
- [x] 25. **Rewrite the three `role="menu"` sites in `e2e/duel-smoke.spec.ts` (expanded 2026-08-09 — the parent located all of them, do not go hunting).** Chips are `role="group"`, not `role="menu"`, and their buttons are plain `<button tabindex="-1">`, not `role="menuitem"`. Validate: step 27's e2e runs green.
  - [x] 25a. The responsive-viewport test (~line 953, `const menu = page.getByRole("menu"); await expect(menu).toBeVisible();` then `assertRectInsideViewport(page, menu, …)` and `Escape` → `toHaveCount(0)`). Retarget it at `[data-cy^="card-action-chips-"]`. **`toHaveCount(0)` is wrong for chips**: per steps 6-7 the chips element is always in the DOM and merely `display: none` until hover / focus-within / pinned, so dismissal must be asserted with `toBeHidden()` / `not.toBeVisible()`, never a count.
  - [x] 25b. `MONSTER_SET_ITEM` (~line 1493), currently `` `[role="menuitem"][data-cy$="-${MONSTER_SET_ACTION}"]` ``. The `data-cy$=` suffix match still works unchanged — menu items were `` `field-action-menu-choice-${choice.id}` `` and chips are `` `card-action-chip-${choice.id}` ``, so both end in `-setMonster`. Drop only the `[role="menuitem"]` prefix; keep matching the action id, never the label. That suffix match is what R1 fixed and it must survive: the engine labels `setMonster` and `setSpellTrap` identically as `Set <card>`, and matching the label is exactly what made this walker non-deterministic.
  - [x] 25c. `setHandMonsterWithKeyboard()` (~line 1502-1536). Its contract is unchanged — keyboard-only, inspect every hand card, return `false` when no hand card offers a monster set — but three mechanics move: `keyboardActivate(opener)` now pins the chips and moves focus to the first chip via step 13's `tick()` + `focusFirstChip()`; the walk uses `ArrowRight`/`ArrowDown` (step 4 accepts both, and both wrap); and `Escape` calls `ondismiss` → `closeMenu`, after which the chips are hidden rather than removed. Keep the "wait for focus to land before walking" guard — it is what makes the arrow walk deterministic.
  - [x] 25d. Re-read the whole spec for any remaining `getByRole("menu")` / `menuitem` / `field-action-menu` reference before you run — validate: `grep -n 'getByRole("menu")\|menuitem\|field-action-menu' e2e/duel-smoke.spec.ts` returns nothing.
- [x] 26. Run `npx vitest run tests/unit/data-cy-coverage.test.ts` to green.
- [x] 27. Run e2e to green — validate: `--project=chromium` full spec 0 failures **run twice** (the duel seed is random per run, see Environment), plus `--project=firefox-smoke` green. The keyboard-only duel walker is the slowest test (~78 s of a 180 s budget) and the one step 25 touches most; if it fails, read the failure rather than relaxing the assertion.

## Outputs

- Files created: `src/app/presentation/card-action-label.ts`, `src/app/components/duel-field/CardActionChips.svelte`, two test files.
- Files deleted: `src/app/components/duel-field/FieldActionMenu.svelte`.
- Files edited: `src/app/components/DuelField.svelte`, `src/app/components/duel-field/FieldBoard.svelte`, `src/app/components/duel-field/CardControl.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/app/App.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts`, `tests/unit/global-styles.test.ts`, `e2e/duel-smoke.spec.ts`.
- Public API: `cardActionLabel`, `CARD_ACTION_LABELS`; `CardControl` prop set changed; `DuelField` no longer takes `oninspect`.
- Migrate / config: none.

## Validation

- [x] `npx vitest run tests/unit/card-action-label.test.ts tests/component/CardActionChips.test.ts tests/component/DuelField.test.ts` passes
- [x] `npm run test:unit && npm run test:component` passes
- [x] `npm run typecheck && npm run lint` passes
- [x] `npm run format` then `npm run format:check` passes
- [x] `npx vitest run tests/unit/data-cy-coverage.test.ts` passes
- [x] e2e green: chromium full spec twice + firefox-smoke (webkit-smoke env-blocked, note it, do not treat as failure)
- [x] the T6 bar/board and T7 corner-button/board non-intersection assertions are both still green — chips are `z-index: var(--duel-field-layer-menu)` and overlap the card by design, but nothing else may start covering board targets
- [x] app functional — every idle-command and chain decision is still answerable
- [x] commit msg draft: `feat(field): replace the action menu with hover chips`

## Environment (inlined 2026-08-09 — these cost ~1 h to discover, do not rediscover them)

- **The `ship` skill is not installed here** (`Unknown skill: ship`). Run this ticket's own Requirements → TDD → Impl → Validation loop directly, at the same evidence bar.
- **Playwright runs must be foreground.** They take 1-5 min; the Bash timeout ceiling is 600 s. A previous worker backgrounded them and idled ~40 min.
- **The duel seed is random per run** — `createProductionSeed()` → `crypto.getRandomValues` at `src/worker/DuelWorkerRuntime.ts:328`. "Preset duel" means preset *decks*, not a preset game. A single pass proves nothing for duel-walking tests; run the chromium spec twice.
- **`webkit-smoke` is unrunnable in this sandbox** (WPE wants `libjxl.so.0.8`, nixpkgs ships 0.11, no root). Not a code defect. Validate with `chromium` + `firefox-smoke` only and note webkit as a standing environment gap.
- **`firefox-smoke` only runs the single test at `e2e/duel-smoke.spec.ts:213`**, so anything you add to the responsive-viewport test is chromium-only here.
- **Browsers only launch inside a nix library closure, and chromium/firefox need two *different* invocations.** Do not merge them. Both browser dirs already exist and work. Run from the repo root.

```bash
cd /home/aron/projects/ascencio

# CHROMIUM
timeout 590 nix-shell -p playwright-driver.browsers glib gtk3 nss nspr dbus atk cups \
  libdrm expat libx11 libxcomposite libxdamage libxext libxfixes libxrandr mesa \
  alsa-lib at-spi2-atk at-spi2-core cairo pango xorg.xvfb --run '
export PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-1000/-home-aron-projects-ascencio/e506203b-19ea-467c-ad38-5319790d65e3/scratchpad/pw-browsers
npx playwright test --project=chromium
'
# filtered: append -g "pattern" to the npx line

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
- The chromium browsers dir is deliberately **mismatched-revision symlinks** (`chromium-1228 → chromium-1217`). Tolerated for chromium only. Firefox uses the real version-matched `firefox-1532` in `~/.cache/ms-playwright`.
- `webServer` auto-builds/starts/stops per invocation (`reuseExistingServer: false`), so each command is self-contained — do not hand-start `npm run preview`. The `Port 4202 is in use on a wildcard address` warning is unrelated and ignorable.
- Plain headless works; `--headed` and hand-started Xvfb are dead ends.
- jsdom has **no `ResizeObserver`**. Guard any use with `typeof ResizeObserver === "undefined"`, as `DuelField.observeAnchor()` and `FieldActionBar` already do, or 16 component tests break.

## Working-tree hygiene

These files were dirty **before** this run and must never be staged: `.gitignore`, `README.md`, `docs/README.md`, `docs/architecture/**`, `docs/developer-guide/**`, `docs/duel-field-architecture.html`, `docs/duel-field-validation-references.html`, `playwright.config.ts`, `vite.config.ts`, deleted `test-results/**`, and untracked `.claude/`, `.pi/`, `.pi-subagents/`, `.agents/`, `.agentsystem/`, `.dev/`, `.tmp/`, `CLAUDE.md`, `AGENTS.md`, `context.md`, `.graphifyignore`, `artifacts/HANDOFF_2026_08_09_duel_field_ux_overhaul.md`. Stage explicit paths only — never `git add -A`.

## Manual test checklist duty

`artifacts/manual_test_checklist.md` exists and already carries a `## T6 field-action-bar` section. Append your own `## T{n} {slug}` section with plain unchecked `- [ ]` boxes describing what a human must click to verify this slice. Never touch another ticket's section. If this slice changes behaviour a previous section describes, update that stale entry rather than only appending. Stage this file with your commit.
