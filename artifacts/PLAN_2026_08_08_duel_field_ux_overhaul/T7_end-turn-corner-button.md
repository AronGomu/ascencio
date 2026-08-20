# T7: End turn corner button

**Plan:** `./artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
**Depends:** T6
**Commit outcome:** A persistent orange End turn button sits at the bottom-right of the duel field, enabled only when the engine currently offers an `endPhase` choice, and the action bar no longer duplicates it.

## Context (self-contained)

- Goal: turn the app from a panel stack into a field-first duel client. Feedback item 10.
- This slice: one small component, one CSS button variant, and one filter change in the action bar.
- Engine truth: `endPhase` exists only in `SELECT_IDLE_COMMAND` (labelled `End turn`, emitted when `message.to_ep`) and `SELECT_BATTLE_COMMAND` (labelled `End Battle Phase`, emitted when `message.to_ep`). Both arrive as `spec.globalChoices` entries with `action === "endPhase"`. Every other prompt has none.
- Out of scope here: pills (T8), chips (T9), drag (T10), preview (T11).
- Assumptions in force: A14 (`End turn` keeps two words).

## Requirements

- Button is always mounted inside `section.duel-field`, bottom-right corner, above cards but below dialogs.
- **Hard invariant, inherited from T6 (added 2026-08-09): the corner button must never occlude any board target.** Its bounding box must not intersect `.duel-field-board`'s at any supported viewport, and a legal-action card in the board's bottom-right must stay clickable. See the arithmetic under Impl step 12 — the existing gutter is *conditional on the action bar*, and this button is *always mounted*, so shipping step 9 as written without step 12 reintroduces exactly the regression T6 just repaired.
- Enabled only when a `endPhase` choice exists in the current spec and no response is pending.
- Label is the engine's own choice label (`End turn` in Main Phase, `End Battle Phase` in Battle Phase); with no choice available it reads `End turn` and is disabled.
- Colour is warning orange, distinct from the accent primary and the danger red.
- Clicking dispatches exactly one `{ type: "chooseChoice", choiceId, key: spec.key }`; a second click while pending does nothing.
- `FieldActionBar` no longer renders an `endPhase` button, and does not render at all when `endPhase` was its only reason to exist.
- Disabled state stays announceable: the button keeps its accessible name and gets `aria-disabled` semantics through the native `disabled` attribute.

## Inputs

- Create: `src/app/components/duel-field/EndTurnButton.svelte`, `tests/component/EndTurnButton.test.ts`.
- Edit: `src/app/components/DuelField.svelte`, `src/app/components/duel-field/FieldActionBar.svelte`, `src/app/prompts/interaction-spec.ts`, `src/styles/app.css`, `tests/unit/interaction-spec.test.ts`, `tests/component/DuelField.test.ts`.
- **From Depends (T6):** `src/app/components/duel-field/FieldActionBar.svelte` exists with props `prompt`, `spec`, `session`, `disabled`, `confirmValid`, `validationMessage`, `oninteraction`, renders one button per `spec.globalChoices` value with `` data-cy={`field-action-bar-choice-${choice.id}`} ``, and is gated in `DuelField.svelte` by `{#if prompt && spec && spec.fieldCapable && fieldActionBarRequired(spec)}`. `fieldActionBarRequired(spec: ActiveInteractionSpec): boolean` lives at the bottom of `src/app/prompts/interaction-spec.ts` and currently returns `true` when `spec.globalChoices.size > 0`. `SelectionDock.svelte` no longer exists.

- **From Depends (T6) — the bottom-gutter mechanism, added by T6's repair (updated 2026-08-09, reality drifted from the plan; read this before writing any CSS):**
  T6's first attempt shipped the bar as `position: absolute; bottom: .75rem` inside a `.duel-field` that reserved no space below the board. The bar landed on the player's hand and swallowed every click on a card target; `e2e/duel-smoke.spec.ts:799` timed out at 180 s with 344 pointer-interception retries. The repair added a **measured, conditional bottom gutter**:
  - `FieldActionBar.svelte` measures itself through a `ResizeObserver` (guarded by `typeof ResizeObserver === "undefined"` for jsdom) and surfaces it as a bindable `export let clientHeight = 0;` prop. A literal `bind:clientHeight` on the component does not work — Svelte compiles it to a DOM size binding that needs `ResizeObserver`, which broke 16 jsdom component tests.
  - `DuelField.svelte:371-373` sets `data-field-action-bar={actionBarVisible ? "true" : undefined}` and `style:--field-action-bar-height={...}` on `section.duel-field`; `DuelField.svelte:426` uses `bind:clientHeight={actionBarHeight}` as a plain prop binding.
  - `src/styles/app.css:666` — `.duel-field[data-field-action-bar="true"] { padding-bottom: calc(1rem + max(2.75rem, var(--field-action-bar-height, 0px)) + 0.75rem); }`. Base `.duel-field` padding is `1rem` (`src/styles/app.css:642`).
  - `e2e/duel-smoke.spec.ts` (in the responsive-viewport test, inside the `if ((await dock.count()) > 0)` block) now asserts the bar's `getBoundingClientRect()` does not intersect `.duel-field-board`'s. **This assertion is a hard gate — do not weaken or delete it.**
- Read only: `src/app/prompts/interaction-spec.ts` (`InteractionChoice { id, label, action }`, `ActiveInteractionSpec.key`), `src/app/prompts/interaction-session.ts` (`InteractionSessionAction`).

## Exact API to create

```svelte
<!-- src/app/components/duel-field/EndTurnButton.svelte -->
export let spec: ActiveInteractionSpec | null = null;
export let disabled = false;
export let oninteraction: (action: InteractionSessionAction) => unknown;
```

Add to `src/app/prompts/interaction-spec.ts`:

```ts
export function endPhaseChoice(
  spec: ActiveInteractionSpec | null,
): InteractionChoice | null;
```

Returns the first `spec.globalChoices` value whose `action === "endPhase"`, else `null`.

## data-cy contract added here

`field-end-turn-button`.

## TDD

1. **Red** — add `endPhaseChoice` rows to `tests/unit/interaction-spec.test.ts` and create `tests/component/EndTurnButton.test.ts`; record failures.
2. **Green** — add the helper, the component, the CSS, the bar filter.
3. **Refactor** — none.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `endPhaseChoice finds the choice` | spec with global choices `battlePhase` and `endPhase` | returns the `endPhase` choice |
| `endPhaseChoice returns null without one` | spec with only `battlePhase` | `null` |
| `endPhaseChoice tolerates a null spec` | `null` | `null` |
| `bar not required when endPhase is the only global choice` | `cardAction` spec whose sole global choice is `endPhase` | `fieldActionBarRequired` is `false` |
| `bar still required with another global choice` | `cardAction` spec with `endPhase` and `battlePhase` | `true` |
| `button reads the engine label` | spec with `endPhase` labelled `End Battle Phase` | `[data-cy="field-end-turn-button"]` text is `End Battle Phase` |
| `button falls back to End turn` | `spec: null` | text is `End turn`, `disabled` is `true` |
| `button disabled without an endPhase choice` | spec with only `battlePhase` | `disabled` is `true` |
| `button disabled while pending` | valid spec, `disabled: true` | `disabled` is `true` |
| `click dispatches once` | valid spec, click twice with `disabled` flipped to `true` after the first | `oninteraction` called exactly once with `{ type: "chooseChoice", choiceId, key: spec.key }` |
| `button carries the warning class` | valid spec | element `classList` contains `warning` |
| `bar hides the endPhase choice` | render `FieldActionBar` with `endPhase` and `battlePhase` global choices | `[data-cy^="field-action-bar-choice-"]` count is 1 and it is the `battlePhase` one |
| `field mounts the corner button` | render `DuelField` with any board | `[data-cy="duel-field"] [data-cy="field-end-turn-button"]` matches |

## Impl steps

- [x] 1. Add the first five rows to `tests/unit/interaction-spec.test.ts`; run `npx vitest run tests/unit/interaction-spec.test.ts` and record failures.
- [x] 2. Add `endPhaseChoice` to `src/app/prompts/interaction-spec.ts`.
- [x] 3. Change `fieldActionBarRequired` so the global-choice test ignores `endPhase`: count `[...spec.globalChoices.values()].filter((choice) => choice.action !== "endPhase").length > 0`. Keep the four list kinds returning `true` unconditionally.
- [x] 4. Re-run `npx vitest run tests/unit/interaction-spec.test.ts` to green.
- [x] 5. Create `tests/component/EndTurnButton.test.ts` (`// @vitest-environment jsdom`) with rows six to eleven; record failures.
- [x] 6. Create `src/app/components/duel-field/EndTurnButton.svelte`: compute `$: choice = endPhaseChoice(spec);` and render a single `<button type="button" class="warning field-end-turn" data-cy="field-end-turn-button" disabled={disabled || choice === null || spec === null} onclick={…}>{choice?.label ?? "End turn"}</button>`.
- [x] 7. In that component, the click handler calls `oninteraction({ type: "chooseChoice", choiceId: choice.id, key: spec.key })` and returns early when `choice === null || spec === null`.
- [x] 8. In `src/styles/app.css`, add `button.warning { color: #2b1d00; border-color: transparent; background: var(--warning); }` and `button.warning:hover:not(:disabled) { background: #ffc75c; }` right after the `button.danger` rule.
- [x] 9. In `src/styles/app.css`, add `.field-end-turn { position: absolute; z-index: var(--duel-field-layer-control); right: .75rem; bottom: .75rem; min-height: 2.75rem; padding: .55rem 1rem; }`.
- [x] 10. In `src/app/components/duel-field/FieldActionBar.svelte`, filter the global-choice loop to `[...spec.globalChoices.values()].filter((choice) => choice.action !== "endPhase")`.
- [x] 11. In `src/app/components/DuelField.svelte`, import `EndTurnButton` and render `<EndTurnButton {spec} disabled={pending} {oninteraction} />` as the last child of `section.duel-field`, after the action bar.
- [x] 12. **Make the bottom gutter unconditional (rewritten 2026-08-09 — the original wording of this step was wrong and would have shipped a regression).** The arithmetic, already worked out by the parent — do not re-derive:
  - With the bar present, `padding-bottom = 1rem + max(2.75rem, barHeight) + 0.75rem >= 4.5rem`, while the button's top edge sits `0.75rem + 2.75rem = 3.5rem` above the field's bottom. `3.5rem < 4.5rem`, so the button already clears the board **whenever the bar renders**.
  - With **no** bar — which is the common case, e.g. a `cardAction` spec whose only global choice is `endPhase`, which step 3 of this ticket deliberately makes bar-less — `data-field-action-bar` is absent, `padding-bottom` falls back to the base `1rem`, and the always-mounted button lands **on top of the board's bottom-right zone**. That is the T6 regression, re-created.
  - Fix: give `.duel-field` an unconditional floor for the corner button and keep the bar's measured reserve on top of it. Express the floor once, e.g. `.duel-field { padding-bottom: calc(1rem + 2.75rem + 0.75rem); }` with the `[data-field-action-bar="true"]` rule still winning when the bar is taller. Do not duplicate the magic numbers — hoist them into a custom property if that reads better.
  - Do **not** solve this with `pointer-events`. T6 proved that fails: the interceptor is the button itself, which needs `pointer-events: auto` to be clickable at all.
  - Validate: the step-15 e2e assertion below, plus `npm run test:e2e` green.
  - [x] 12a. Verify the bar and the corner button do not overlap each other either: the bar is `left: 50%` with `max-width: min(52rem, calc(100% - 2rem))`, the button is `right: .75rem`. If they collide at narrow widths, add `@container duel-field (max-width: 40rem) { .field-action-bar { bottom: 4rem; } }` — and if you do, re-check step 12's arithmetic, because a taller stack needs a taller gutter. Validate: responsive e2e green at every viewport. (They did collide at VP-05. Added the bar's `bottom: 4rem` shift, but a `@container` query cannot style the container element against its own size — only descendants — so the paired `.duel-field[data-field-action-bar="true"]` padding-bottom override silently never applied and the bar overlapped the board at VP-05. Moved both declarations under `@media (max-width: 48rem)` instead, which has no such self-query restriction. Verified: chromium `responsive field compositions...` passing on two consecutive runs, see step 16 evidence.)
- [x] 13. Run `npx vitest run tests/component/EndTurnButton.test.ts tests/component/FieldActionBar.test.ts` to green.
- [x] 14. Add the last two test-plan rows to `tests/component/DuelField.test.ts` and run it. (Also updated one pre-existing assertion — "renders one named semantic board..." expected zero buttons on an inactive board; the corner button's new always-mounted requirement makes that one disabled button, not zero.)
- [x] 15. Extend the existing bar/board non-intersection assertion in `e2e/duel-smoke.spec.ts` to cover the corner button too — assert `[data-cy="field-end-turn-button"]`'s rect does not intersect `.duel-field-board`'s at every responsive viewport, message naming the viewport. Unlike the bar's, this one is **not** wrapped in a presence check: the button is always mounted. Validate: assertion present and green. (Found and fixed a real bug while validating: the step-12a container-query override for `.duel-field`'s padding-bottom never matched — a `@container` query cannot style the container element against its own size, only descendants — so it silently fell back to the base formula and the bar overlapped the board at VP-05. Fixed by moving that pairing to a `@media (max-width: 48rem)` query instead.)
- [x] 16. Run e2e to green — validate: `--project=chromium` full spec 0 failures **run twice** (the duel seed is random per run, see Environment), plus `--project=firefox-smoke` green. The existing `field.getByRole("button", { name: "End turn", exact: true })` lookups keep working because the button lives inside the field; fix any test that assumed the label came from the action bar. (chromium: 16/16 passed both runs, foreground, ~1.3-1.4m each; firefox-smoke: 1/1 passed. webkit-smoke environment-blocked per ticket, not attempted, noted as standing gap. No existing test needed fixing — "End turn" lookups still resolve since the button lives inside `section.duel-field`.)
- [x] 17. Run `npx vitest run tests/unit/data-cy-coverage.test.ts` to green.

## Outputs

- Files created: `src/app/components/duel-field/EndTurnButton.svelte`, `tests/component/EndTurnButton.test.ts`.
- Files edited: `src/app/prompts/interaction-spec.ts`, `src/app/components/DuelField.svelte`, `src/app/components/duel-field/FieldActionBar.svelte`, `src/styles/app.css`, `tests/unit/interaction-spec.test.ts`, `tests/component/DuelField.test.ts`.
- Public API: `endPhaseChoice(spec)`.
- Migrate / config: none.

## Validation

- [x] `npx vitest run tests/unit/interaction-spec.test.ts tests/component/EndTurnButton.test.ts` passes
- [x] `npm run test:unit && npm run test:component` passes
- [x] `npm run typecheck && npm run lint` passes
- [x] `npm run format` then `npm run format:check` passes
- [x] `npx vitest run tests/unit/data-cy-coverage.test.ts` passes
- [x] e2e green: chromium full spec twice + firefox-smoke (webkit-smoke env-blocked, note it, do not treat as failure)
- [x] corner-button/board non-intersection proven at every responsive viewport by the step-15 assertion, and the T6 bar/board assertion still green
- [x] app functional — turns can still be ended, action bar still handles everything else, and a legal-action card in the board's bottom-right is still clickable with the corner button on screen
- [x] commit msg draft: `feat(field): add a persistent end turn control to the field corner`

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
