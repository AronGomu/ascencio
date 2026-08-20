# T6: Field action bar replaces selection dock

**Plan:** `./artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
**Depends:** T5
**Commit outcome:** `SelectionDock.svelte` is deleted and a compact `FieldActionBar` pinned inside the duel field carries Confirm, Cancel, counter steppers, order controls, validation text and global choices.

## Context (self-contained)

- Goal: turn the app from a panel stack into a field-first duel client. Feedback item 9 says remove `selection-dock`.
- This slice: replace the wide three-column dock with a small bar floating at the bottom of the field. The dock is the only place Confirm/Cancel, counter `+`/`−`, order `↑`/`↓`, the validation message and non-card global choices exist, so those affordances move rather than disappear (assumption A4).
- Out of scope here: the corner End turn button (T7) — `endPhase` stays in this bar for now so it never becomes unreachable; hover chips (T9); drag (T10).
- Assumptions in force: A4, A11.

## Requirements

- `src/app/components/duel-field/SelectionDock.svelte` deleted, along with every `.selection-dock*` rule in `src/styles/app.css` and their two media-query entries.
- `FieldActionBar.svelte` renders inside `section.duel-field`, pinned bottom-centre.
- **Hard invariant (amended 2026-08-09, see "Known defect" below): the bar must never occlude any board target.** Its bounding box must not intersect `.duel-field-board`'s bounding box at any supported viewport. A card the engine offers as a legal action must stay clickable while the bar is on screen.
- Button labels are unchanged: `Confirm selection`, `Confirm allocation`, `Confirm order`, `Confirm placement`, `Confirm`, `Cancel`.
- Counter allocation keeps its `−`/value/`+` group per choice; order keeps its `↑`/`↓` per row. Both lists live inside a `max-height: 9rem; overflow: auto` scroller so the bar stays compact.
- The bar renders only when it has something to offer: `spec.kind` is one of `cardSelection`, `placeSelection`, `counterAllocation`, `order`, or `spec.globalChoices` is non-empty.
- The bar never renders for a `nonField` spec — those go to the T5 prompt dialog.
- Selected-choice summary is a count (`2 selected`), not a comma list, so the bar stays one line.

## Inputs

- Delete: `src/app/components/duel-field/SelectionDock.svelte`.
- Create: `src/app/components/duel-field/FieldActionBar.svelte`, `tests/component/FieldActionBar.test.ts`.
- Edit: `src/app/components/DuelField.svelte`, `src/styles/app.css`, `src/app/prompts/interaction-spec.ts`, `tests/component/DuelField.test.ts`, `tests/unit/interaction-spec.test.ts`, `e2e/duel-smoke.spec.ts`.
  (`interaction-spec.ts` + its unit test were missing from this list in the original ticket while "Exact API to create" and "Outputs" both require them — a ticket-internal inconsistency, corrected 2026-08-09. Adding `fieldActionBarRequired` there is **in scope**, not drift.)
- **From Depends (T5):** `section.duel-field` carries `data-cy="duel-field"` and `data-prompt-kind`; non-field prompts already render in `[data-cy="prompt-dialog"]` and never reach the field; `promptSurface()` in `src/app/prompts/prompt-surface.ts` returns `"field"` only when `spec.fieldCapable` is true.
- Read only, and copy the behaviour verbatim from the deleted dock: `dispatch(action)` wraps `oninteraction({ ...action, key: spec.key })`; `move(choice, offset)` dispatches `{ type: "moveChoice", choiceId, toIndex: session.order.indexOf(choice.id) + offset }`; the `+`/`−` buttons dispatch `{ type: "adjustAllocation", choiceId, delta }` and disable on `allocatedTotal >= spec.constraints.maximum` or `(session.allocations.get(choice.id) ?? 0) >= (choice.allocationMaximum ?? 0)`; `confirmLabel()` maps `counterAllocation → "Confirm allocation"`, `order → "Confirm order"`, `placeSelection → "Confirm placement"`, `cardSelection → "Confirm selection"`, `cardAction`/`nonField` → `"Confirm"`; `choicesInPromptOrder(spec)` rebuilds order from `prompt.choices`.
- Read only: `src/app/prompts/interaction-session.ts` (`InteractionSession`, `InteractionSessionAction`, `interactionSessionChoiceIds`), `src/app/prompts/interaction-spec.ts` (`ActiveInteractionSpec`, `InteractionChoice`).

## Exact API to create

```svelte
<!-- src/app/components/duel-field/FieldActionBar.svelte -->
export let prompt: PlayerPrompt;
export let spec: ActiveInteractionSpec;
export let session: InteractionSession;
export let disabled = false;
export let confirmValid = false;
export let validationMessage = "";
export let oninteraction: (action: InteractionSessionAction) => unknown;
```

Add an exported helper so the render condition is testable without a DOM:

```ts
// bottom of src/app/prompts/interaction-spec.ts
export function fieldActionBarRequired(spec: ActiveInteractionSpec): boolean;
```

Returns `true` when `spec.kind` is `cardSelection`, `placeSelection`, `counterAllocation` or `order`, or when `spec.globalChoices.size > 0`; `false` otherwise (that is, `cardAction` with no global choices, and `nonField`).

## data-cy contract added here

`field-action-bar`, `field-action-bar-title`, `field-action-bar-summary`, `field-action-bar-list`, `` `field-action-bar-row-${choiceId}` ``, `` `field-action-bar-decrement-${choiceId}` ``, `` `field-action-bar-allocation-${choiceId}` ``, `` `field-action-bar-increment-${choiceId}` ``, `` `field-action-bar-up-${choiceId}` ``, `` `field-action-bar-down-${choiceId}` ``, `` `field-action-bar-choice-${choiceId}` ``, `field-action-bar-confirm`, `field-action-bar-cancel`, `field-action-bar-validation`.

## Known defect on resume (amended 2026-08-09 — read this first)

Steps 1-16 and 18 are already implemented in the working tree, uncommitted. **Step 17 (`npm run test:e2e`) is RED and the cause is a real interaction regression, not a flaky test.** Do not relax the test.

Verified facts, already checked by the parent — do not re-derive:

- `src/styles/app.css:954` — `.field-action-bar { position: absolute; bottom: 0.75rem; left: 50%; transform: translateX(-50%); z-index: var(--duel-field-layer-control); }`.
- `src/styles/app.css:642` — `.duel-field { position: relative; padding: 1rem; overflow-x: auto; }`. Its only child of substance is `.duel-field-board` (`src/styles/app.css:659`: `width: 100%; min-width: 52rem; aspect-ratio: 16 / 9;`).
- There is **no gutter below the board**. `bottom: 0.75rem` therefore places the bar *on top of the board's bottom row* — which is the player's hand, the most-clicked region on the field.
- `pointer-events: none` on `.field-action-bar` with `pointer-events: auto` on `.field-action-bar > *` (`src/styles/app.css:970-977`) is **already applied and is not sufficient**: the element that intercepts is a global-choice `<button>`, which is a direct child and therefore has `pointer-events: auto`.

Failing test: `e2e/duel-smoke.spec.ts:799` *"responsive field compositions contain controls across supported viewports"*, times out at 180 s. It clicks `field.locator("[data-field-target][aria-label^='Legal action']").first()`. Playwright call log:

```
attempting click on  button.duel-field-card__target [data-cy="field-card-target-card-1"]
  <button class="secondary compact-button"
          data-cy="field-action-bar-choice-…-choice-9-shuffle">Shuffle Deck</button>
  from <section class="field-action-bar" data-cy="field-action-bar" aria-label="Field decision">
  subtree intercepts pointer events
  ... 344 × retrying
```

### Fix contract

Satisfy the amended hard invariant in Requirements: **the bar's bounding box must not intersect `.duel-field-board`'s bounding box.**

Recommended approach (you may pick another that satisfies the invariant — log the choice under Assumptions):

- Keep the bar pinned bottom-centre of `section.duel-field` and **reserve a gutter below the board equal to the bar's live height**. The bar's height is dynamic (it wraps, and the counter/order scroller adds up to `9rem`), so a hard-coded reserve is wrong. Measure it: `bind:clientHeight` on the bar in `DuelField.svelte`, expose it as a custom property on `section.duel-field` (e.g. `style:--field-action-bar-height={...}`), and give the field `padding-bottom: calc(1rem + var(--field-action-bar-height, 0px) + 0.75rem)` only while the bar renders.
- Reserving unconditionally is not acceptable — an empty gutter must not appear when no bar is on screen.

Constraints the fix must not break (all currently asserted by `e2e/duel-smoke.spec.ts:799`):

- `.duel-field-board` aspect ratio stays between 1.7 and 1.85.
- Every `[data-field-target]` stays `>= 44px` in both dimensions.
- At `>= 1024px` viewport width the field still has no horizontal overflow.
- `assertRectInsideViewport` still passes for the bar at every responsive viewport.

### Regression test required

Add to `e2e/duel-smoke.spec.ts`, inside the existing `if ((await dock.count()) > 0)` block at ~line 888, an assertion that the bar and the board do not intersect — read both `getBoundingClientRect()`s and assert `barRect.top >= boardRect.bottom - 1`. Message must name the viewport. This is the guard that stops the overlay from silently coming back in T7/T9.

## TDD

1. **Red** — write `tests/unit/interaction-spec.test.ts` additions for `fieldActionBarRequired` and `tests/component/FieldActionBar.test.ts`; record failures.
2. **Green** — add the helper, the component, swap it into `DuelField.svelte`, delete the dock.
3. **Refactor** — delete dead CSS in the same commit; `npm run lint` must be clean.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `bar required for card selection` | spec `kind: "cardSelection"`, no global choices | `true` |
| `bar required for counter allocation` | spec `kind: "counterAllocation"` | `true` |
| `bar required for order` | spec `kind: "order"` | `true` |
| `bar required for place selection` | spec `kind: "placeSelection"` | `true` |
| `bar required when a card action has global choices` | `kind: "cardAction"` with one global choice | `true` |
| `bar not required for a bare card action` | `kind: "cardAction"`, `globalChoices.size === 0` | `false` |
| `bar not required for non-field specs` | `kind: "nonField"` | `false` |
| `confirm dispatches with the spec key` | render bar, `confirmValid: true`, click `[data-cy="field-action-bar-confirm"]` | `oninteraction` called once with `{ type: "confirm", key: spec.key }` |
| `confirm blocked while invalid` | `confirmValid: false` | confirm button disabled and `aria-describedby` points at `[data-cy="field-action-bar-validation"]` |
| `cancel only when cancelable` | `spec.constraints.cancelable: false` | `[data-cy="field-action-bar-cancel"]` absent |
| `counter increment dispatches` | counter spec, click `[data-cy="field-action-bar-increment-c1"]` | one `{ type: "adjustAllocation", choiceId: "c1", delta: 1 }` |
| `counter decrement disabled at zero` | allocation 0 | decrement disabled |
| `order move up dispatches the new index` | order spec, click `[data-cy="field-action-bar-up-c2"]` where `c2` is index 1 | one `{ type: "moveChoice", choiceId: "c2", toIndex: 0 }` |
| `global choices are buttons` | spec with global choice `g1` labelled `Enter Battle Phase` | `[data-cy="field-action-bar-choice-g1"]` exists; clicking dispatches `{ type: "chooseChoice", choiceId: "g1" }` |
| `summary counts selections` | two selected ids | `[data-cy="field-action-bar-summary"]` text is `2 selected` |
| `bar is inside the field` | render `DuelField` with a `cardSelection` spec | `[data-cy="duel-field"] [data-cy="field-action-bar"]` matches |
| `dock is gone` | render `DuelField` with the same spec | `container.querySelector(".selection-dock")` is `null` |

## Impl steps

- [x] 1. Append the seven `fieldActionBarRequired` rows to `tests/unit/interaction-spec.test.ts`; run `npx vitest run tests/unit/interaction-spec.test.ts` and record the failure. Evidence: 7 failures (`fieldActionBarRequired is not a function`), 19 passed / 26 total.
- [x] 2. Add `fieldActionBarRequired` to `src/app/prompts/interaction-spec.ts` exactly as specified; re-run to green. Evidence: `npx vitest run tests/unit/interaction-spec.test.ts` → 26 passed (26).
- [x] 3. Create `tests/component/FieldActionBar.test.ts` (`// @vitest-environment jsdom`) with the eight component rows; record failures. Evidence: red run failed to resolve `FieldActionBar.svelte` import (component did not exist yet).
- [x] 4. Create `src/app/components/duel-field/FieldActionBar.svelte` with the props above; root is `section.field-action-bar[data-cy="field-action-bar"][aria-label="Field decision"][aria-busy={disabled}]`. Evidence: file created, matches root selector.
- [x] 5. In the bar, render the title as `p[data-cy="field-action-bar-title"]` holding `spec.title`, and the summary as `p[data-cy="field-action-bar-summary"]` holding `` `${session.selectedChoiceIds.length} selected` `` — only when that length is above zero. Evidence: `tests/component/FieldActionBar.test.ts` "summary counts selections" passes.
- [x] 6. In the bar, render the counter list for `spec.kind === "counterAllocation"` and the ordered list for `spec.kind === "order"`, copying the dispatch behaviour listed under Inputs, inside `div[data-cy="field-action-bar-list"]`. Evidence: "counter increment dispatches", "order move up dispatches the new index" pass.
- [x] 7. In the bar, render one button per `spec.globalChoices` value using `` data-cy={`field-action-bar-choice-${choice.id}`} `` and class `secondary compact-button`. Evidence: "global choices are buttons" passes.
- [x] 8. In the bar, render Confirm and Cancel only when `spec.kind !== "cardAction" && spec.kind !== "nonField"`, reusing `confirmLabel()` and the `cancelable` guard. Evidence: "confirm dispatches with the spec key", "cancel only when cancelable" pass.
- [x] 9. In the bar, render `p[data-cy="field-action-bar-validation"][id="field-action-bar-validation"]` when `!confirmValid && validationMessage`. Evidence: "confirm blocked while invalid" passes.
- [x] 10. In `src/styles/app.css`, delete every `.selection-dock`, `.selection-dock__list`, `.selection-dock__row`, `.selection-dock__actions`, `.selection-dock h3`, `.selection-dock p` rule and remove `.selection-dock` from the `@container duel-field (max-width: 48rem)` and `@media (max-width: 48rem)` blocks (delete the container block if it becomes empty). Evidence: `grep -n "selection-dock" src/styles/app.css` → no matches.
- [x] 11. In `src/styles/app.css`, add `.field-action-bar { position: absolute; z-index: var(--duel-field-layer-control); bottom: .75rem; left: 50%; display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; max-width: min(52rem, calc(100% - 2rem)); padding: .45rem .6rem; border: 1px solid var(--border); border-radius: .7rem; background: color-mix(in srgb, var(--surface-strong) 94%, transparent); box-shadow: 0 .6rem 1.6rem rgb(0 0 0 / .4); transform: translateX(-50%); }`. Evidence: rule present in `src/styles/app.css`.
- [x] 12. In `src/styles/app.css`, add `.field-action-bar p { margin: 0; font-size: .8rem; }`, `.field-action-bar [data-cy="field-action-bar-list"] { display: grid; gap: .3rem; max-height: 9rem; overflow: auto; width: 100%; }` and `.field-action-bar [data-cy="field-action-bar-validation"] { color: var(--danger); width: 100%; }`. Evidence: rules present in `src/styles/app.css`.
- [x] 13. In `src/app/components/DuelField.svelte`, replace the `SelectionDock` import with `FieldActionBar` and `fieldActionBarRequired`, and change the render guard to `{#if prompt && spec && spec.fieldCapable && fieldActionBarRequired(spec)}`. Evidence: `grep -n "FieldActionBar\|fieldActionBarRequired" src/app/components/DuelField.svelte` shows import and guard.
- [x] 14. Delete `src/app/components/duel-field/SelectionDock.svelte`. Evidence: `git rm src/app/components/duel-field/SelectionDock.svelte`.
- [x] 15. Run `npx vitest run tests/component/FieldActionBar.test.ts tests/component/DuelField.test.ts`; update the two DuelField cases that click `Confirm allocation` and `Confirm order` if their queries relied on dock markup, and add the last two rows of the test plan. Evidence: both cases passed unmodified (role-based queries, no dock markup dependency); added "renders the field action bar inside the field and never a selection dock" to `tests/component/DuelField.test.ts`; `npx vitest run tests/component/FieldActionBar.test.ts tests/component/DuelField.test.ts` → 46 passed (46).
- [x] 16. In `e2e/duel-smoke.spec.ts`, replace `field.locator(".selection-dock")` with `field.locator('[data-cy="field-action-bar"]')`, and replace the `[data-cy="selection-dock"]` assertions introduced in T5 with `[data-cy="field-action-bar"]`. Evidence: `grep -n "selection-dock" e2e/duel-smoke.spec.ts` → no matches; `grep -n "field-action-bar" e2e/duel-smoke.spec.ts` → 3 matches.
- [x] 18. Run `npx vitest run tests/unit/data-cy-coverage.test.ts` to green. Evidence: 8 passed (8).
- [x] 19. Reserve a board-clear gutter for the bar per the Fix contract above — validate: `.field-action-bar` no longer overlaps `.duel-field-board`, proven by step 21's e2e assertion. Evidence: step 21's `barRect.top >= boardRect.bottom - 1` assertion runs at every `RESPONSIVE_VIEWPORTS` entry and passes in both full chromium runs.
  - [x] 19a. In `DuelField.svelte`, measure the bar height (`bind:clientHeight`) and expose it on `section.duel-field` — validate: `grep -n "field-action-bar-height" src/app/components/DuelField.svelte` matches. Evidence: `373:  style:--field-action-bar-height={actionBarVisible`; the height is bound out of `FieldActionBar` via `bind:clientHeight={actionBarHeight}`, and `section.duel-field` also carries `data-field-action-bar` while the bar renders.
  - [x] 19b. In `src/styles/app.css`, apply the conditional `padding-bottom` on `.duel-field` and drop the now-pointless `pointer-events` workaround comment if the overlay is gone — validate: `grep -n "field-action-bar-height" src/styles/app.css` matches. Evidence: `.duel-field[data-field-action-bar="true"] { padding-bottom: calc(1rem + max(2.75rem, var(--field-action-bar-height, 0px)) + 0.75rem); }` at `src/styles/app.css:667`; the `.field-action-bar { pointer-events: none }` comment and the `.field-action-bar > * { pointer-events: auto }` rule are deleted.
  - [x] 19c. No empty gutter when the bar is absent — validate: component test asserting `.duel-field` has no bar-reserve padding with a `cardAction`-only spec. Evidence: `reserves no gutter when a card action spec renders no action bar` asserts `data-field-action-bar` absent and `--field-action-bar-height` empty; green.
- [x] 20. Add the component-level guard to `tests/component/DuelField.test.ts` — validate: `npx vitest run tests/component/DuelField.test.ts` green with the new case. Evidence: `npx vitest run tests/component/DuelField.test.ts tests/component/FieldActionBar.test.ts` → 48 passed (48), including the two new gutter cases.
- [x] 21. Add the bar-vs-board non-intersection assertion to `e2e/duel-smoke.spec.ts:~888` per the Fix contract — validate: assertion present and green in the run below. Evidence: `barRect.top` asserted `>= boardRect.bottom - 1` with a viewport-labelled message inside the `field-action-bar` block.
- [x] 17. Run e2e to green — validate: `--project=chromium` full spec 0 failures **run twice** (the duel seed is random per run, see Environment), plus `--project=firefox-smoke` green. Evidence: two consecutive `16 passed` chromium runs plus `1 passed` firefox-smoke, transcripts in 17a-17c.
  - [x] 17a. `responsive field compositions contain controls across supported viewports` passes. Evidence: `npx playwright test --project=chromium -g "responsive field compositions contain controls across supported viewports"` → `✓ 1 [chromium] › e2e/duel-smoke.spec.ts:799:1 … (3.9s)`, `1 passed (6.5s)`. Previously this timed out at 180 s with 344 intercept retries.
  - [x] 17b. Full chromium spec passes, two consecutive runs. Evidence: run 1 `16 passed (2.1m)`, run 2 `16 passed (46.8s)`; the random-seed duel walk (`e2e/duel-smoke.spec.ts:1190`) took 1.6m then 21.7s, so the two runs walked different games.
  - [x] 17c. `firefox-smoke` passes. Evidence: `npx playwright test --project=firefox-smoke` → `✓ 1 [firefox-smoke] › e2e/duel-smoke.spec.ts:213:1 … (1.6s)`, `1 passed (4.5s)`. `webkit-smoke` stays environment-blocked: the WPE binary dies with `error while loading shared libraries: libatk-1.0.so.0` under the chromium nix closure, matching the standing gap recorded in Environment. Not a code defect.

## Environment (inlined 2026-08-09 — these cost ~1 h to discover, do not rediscover them)

- **The `ship` skill is not installed here** (`Unknown skill: ship`). Run this ticket's own Requirements → TDD → Impl → Validation loop directly, at the same evidence bar.
- **Playwright runs must be foreground.** They take 1-5 min; the Bash timeout ceiling is 600 s. A previous worker backgrounded them and idled ~40 min.
- **The duel seed is random per run** — `createProductionSeed()` → `crypto.getRandomValues` at `src/worker/DuelWorkerRuntime.ts:328`. "Preset duel" means preset *decks*, not a preset game. A single pass proves nothing for duel-walking tests; run the chromium spec twice.
- **`webkit-smoke` is unrunnable in this sandbox** (WPE wants `libjxl.so.0.8`, nixpkgs ships 0.11, no root). Not a code defect. Validate with `chromium` + `firefox-smoke` only and note webkit as a standing environment gap.
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

## Working-tree hygiene

These files were dirty **before** this run and must never be staged: `.gitignore`, `README.md`, `docs/README.md`, `docs/architecture/**`, `docs/developer-guide/**`, `docs/duel-field-architecture.html`, `docs/duel-field-validation-references.html`, `playwright.config.ts`, `vite.config.ts`, deleted `test-results/**`, and untracked `.claude/`, `.pi/`, `.pi-subagents/`, `.agents/`, `.agentsystem/`, `.dev/`, `.tmp/`, `CLAUDE.md`, `AGENTS.md`, `context.md`, `.graphifyignore`. Stage explicit paths only — never `git add -A`.

## Outputs

- Files created: `src/app/components/duel-field/FieldActionBar.svelte`, `tests/component/FieldActionBar.test.ts`.
- Files deleted: `src/app/components/duel-field/SelectionDock.svelte`.
- Files edited: `src/app/prompts/interaction-spec.ts`, `src/app/components/DuelField.svelte`, `src/styles/app.css`, `tests/unit/interaction-spec.test.ts`, `tests/component/DuelField.test.ts`, `e2e/duel-smoke.spec.ts`.
- Public API: `fieldActionBarRequired(spec)` consumed by `DuelField.svelte` and T7.
- Migrate / config: none.

## Validation

These four passed before the amendment (34 / 407+82 / 0 errors / prettier clean) but steps 19-21 change code, so **re-run all of them** and re-record evidence:

- [x] `npx vitest run tests/unit/interaction-spec.test.ts tests/component/FieldActionBar.test.ts` passes — 34 passed (34), 2 files.
- [x] `npm run test:unit && npm run test:component` passes — unit 407 passed (39 files); component 84 passed (7 files), up from 82 by the two new gutter cases.
- [x] `npm run typecheck && npm run lint` passes — `tsc --noEmit` clean, `svelte-check` `609 FILES 0 ERRORS 0 WARNINGS`, `eslint .` silent.
- [x] `npm run format` then `npm run format:check` passes — format rewrote nothing outside the ticket's files, `format:check` → `All matched files use Prettier code style!`.
- [x] `npx vitest run tests/unit/data-cy-coverage.test.ts` passes — 8 passed (8).
- [x] e2e green: chromium full spec twice + firefox-smoke (webkit-smoke env-blocked, note it, do not treat as failure) — `16 passed (2.1m)`, `16 passed (46.8s)`, `1 passed (4.5s)`; webkit-smoke blocked on `libatk-1.0.so.0`.
- [x] bar/board non-intersection proven at every responsive viewport by the step-21 assertion — the assertion runs once per `RESPONSIVE_VIEWPORTS` entry inside `responsive field compositions contain controls across supported viewports`, green in all three chromium runs.
- [x] app functional — multi-select, counter, order and place prompts all still answerable, and a legal-action card underneath the bar is still clickable. Evidence: `a full preset duel can be completed using keyboard controls only with one response per prompt` walks a whole randomly seeded duel to its end twice, answering every prompt kind the engine raises; `responsive field compositions contain controls across supported viewports` clicks `[data-field-target][aria-label^='Legal action']` and opens its menu at every viewport while the bar is on screen — the exact click that used to be intercepted by `field-action-bar-choice-…-shuffle`.
- [x] commit msg draft: `refactor(field): replace the selection dock with a compact action bar`
