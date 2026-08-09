# T8: Priority, phase and life pills

**Plan:** `./ai-artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`
**Depends:** T4, T7
**Commit outcome:** The field's top-right corner shows `prio-pill - phase-pill`, green `Choose Action` when it is your decision and orange `Waiting Opponent` otherwise, and both players' life points show as pills inside the field.

## Context (self-contained)

- Goal: turn the app from a panel stack into a field-first duel client. Feedback item 14, plus the life-point pills agreed as assumption A15 because hiding `duel-hud` (T5) removed the only LP readout.
- This slice: two tiny presentational components, two pure helpers, and prop plumbing from `App.svelte` through `DuelFieldErrorBoundary.svelte` into `DuelField.svelte`.
- Out of scope here: chips (T9), drag (T10), preview (T11). Do not change any interaction behaviour.
- Assumptions in force: A15.

## Requirements

- Pills render at the top-right of `section.duel-field`, in the order priority pill, a literal `-` separator, phase pill.
- Priority pill: green background, text `Choose Action`, when a prompt is waiting on the player and no response is in flight. Otherwise orange background, text `Waiting Opponent`.
- Phase pill shows a human phase name: `Draw`, `Standby`, `Main 1`, `Battle Start`, `Battle Step`, `Damage`, `Damage Calculation`, `Battle`, `Main 2`, `End`, `Unknown`.
- Life pills: opponent top-left, player bottom-left, formatted with thousands separators and the suffix `LP`.
- Pills never intercept pointer events (`pointer-events: none`) so they cannot block a card underneath.
- Pills are announced once, not on every re-render: the pill group is one `aria-live="polite"` region.
- No change to `DuelHud`'s own turn/phase header.

## Inputs

- Create: `src/app/presentation/duel-phase-label.ts`, `src/app/prompts/duel-priority.ts`, `src/app/components/duel-field/FieldStatusPills.svelte`, `src/app/components/duel-field/LifePointsPill.svelte`, `tests/unit/duel-phase-label.test.ts`, `tests/unit/duel-priority.test.ts`, `tests/component/FieldStatusPills.test.ts`.
- Edit: `src/app/App.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/app/components/DuelField.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts`, `e2e/duel-smoke.spec.ts`.
- **From Depends (T4):** `.duel-field-board` is `width: 100%` and `.duel-field` no longer scrolls, so absolute corners inside the field are stable. **From Depends (T7):** `.field-end-turn` already occupies `right: .75rem; bottom: .75rem` of the field; the new pills must not use that corner.

- **Execution-order note (added 2026-08-09): T8 runs LAST, not before T9-T11.** T8 depends on T4 and T7, and nothing depends on T8, so it was scheduled after the T9 → T10 → T11 chain. Everything below already exists in the tree. Some sibling tickets predicted "T8 will provide X" — ignore those; you are the one providing it, and nothing consumes your props yet.

- **From Depends (T7 + T9 + T10 + T11) — drift since this ticket was written (the parent verified each against the shipped code; do not re-derive):**
  - **The field prop chain is much longer than this ticket assumes.** `DuelField.svelte` now also carries `hitTest: (x, y) => Element | null`, `onplacementintent: (zoneId: PhysicalZoneId) => unknown` and `onpreview: (card: BoardCardView) => void`; `DuelFieldErrorBoundary.svelte` also carries `onplacementintent` and `onpreview`. Add `phase`, `hasPriority` and `lifePoints` **alongside** these, never in place of them.
  - **`.duel-field` has a reserved bottom gutter.** It is `padding: 1rem 1rem calc(1rem + 2.75rem + 0.75rem)`, widened further by `.duel-field[data-field-action-bar="true"]` to fit the measured action bar, and widened again under `@media (max-width: 48rem)`. Good news for you: a life pill at `bottom: .75rem` sits inside that gutter, clear of the board. A pill at the **top** has no such gutter and will overlay the board's top row — which is intended per A15, and safe only because this ticket already requires `pointer-events: none` on the pills. Do not drop that rule.
  - **Three e2e gates in the responsive-viewport test must stay green and unweakened:** action bar vs board non-intersection, `[data-cy="field-end-turn-button"]` vs board non-intersection, and `scrollWidth <= clientWidth + 1` at every viewport `>= 1024`. Adding absolutely positioned pills should not touch any of them, but re-check after your CSS lands.
  - **`tests/unit/data-cy-coverage.test.ts` requires a `data-cy` on every element under `src/app`**, including plain wrapper `div`s you add. T11 tripped on this. Budget a `data-cy` for each new element, not just the ones in this ticket's contract.
  - **A `@container` query cannot style its own query container**, only descendants. `.duel-field` declares `container: duel-field / inline-size`, so `@container duel-field (...) { .duel-field { … } }` silently no-ops. Use `@media` for `.duel-field` itself. T7 lost a validation cycle to this.
  - **Svelte `bind:this` writes `null`, not `undefined`, on unmount.** Guard element refs with `=== null`. The field's error boundary swallows the error, so the symptom is a blank field with no stack trace.
  - `src/app/App.svelte` no longer holds `inspectedCard`, `cardInspectorTrigger`, `closeCardInspector`, `isInspectableCard`, `findPublicCard`, `handleGlobalKeydown` or any `CardInspector` render — T11 deleted them along with the component. It now holds `previewCard` / `previewHudCard` and renders `CardPreviewPanel` beside the field inside a `.duel-row` grid. Read the current file; do not pattern-match on what it used to contain.
- Read only: `src/duel/contracts/public-duel-state.ts` (`DuelPhase` union with exactly eleven members, `PublicDuelState.phase`, `players[n].lifePoints`, `PlayerIndex`), `src/app/stores/duel-store.ts` (`DuelViewState.prompt`, `DuelViewState.responsePending`, `DuelViewState.snapshot`).

## Exact API to create

```ts
// src/app/presentation/duel-phase-label.ts
import type { DuelPhase } from "../../duel/contracts/public-duel-state.ts";

export const DUEL_PHASE_LABELS: Readonly<Record<DuelPhase, string>> = Object.freeze({
  draw: "Draw",
  standby: "Standby",
  main1: "Main 1",
  battleStart: "Battle Start",
  battleStep: "Battle Step",
  damage: "Damage",
  damageCalculation: "Damage Calculation",
  battle: "Battle",
  main2: "Main 2",
  end: "End",
  unknown: "Unknown",
});

export function duelPhaseLabel(phase: DuelPhase): string;
```

```ts
// src/app/prompts/duel-priority.ts
import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";

export function hasDuelPriority(
  prompt: PlayerPrompt | null,
  responsePending: boolean,
): boolean;
```

Returns `prompt !== null && !responsePending`.

```svelte
<!-- src/app/components/duel-field/FieldStatusPills.svelte -->
export let hasPriority = false;
export let phase: DuelPhase = "unknown";
```

```svelte
<!-- src/app/components/duel-field/LifePointsPill.svelte -->
export let player: PlayerIndex;
export let lifePoints: number;
```

New `DuelField.svelte` props, all optional so existing component tests keep compiling:

```ts
export let phase: DuelPhase = "unknown";
export let hasPriority = false;
export let lifePoints: readonly [number, number] | null = null;
```

## data-cy contract added here

`field-status-pills`, `prio-pill`, `field-status-pills-separator`, `phase-pill`, `life-pill-p0`, `life-pill-p1`.

## TDD

1. **Red** — write the three test files first; record failures.
2. **Green** — helpers, components, plumbing, CSS.
3. **Refactor** — none.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `every phase has a label` | `Object.keys(DUEL_PHASE_LABELS)` | length 11, and every `DuelPhase` member is a key |
| `phase label maps main1` | `duelPhaseLabel("main1")` | `Main 1` |
| `phase label maps damageCalculation` | `duelPhaseLabel("damageCalculation")` | `Damage Calculation` |
| `priority requires a prompt` | `hasDuelPriority(null, false)` | `false` |
| `priority requires no pending response` | `hasDuelPriority(prompt, true)` | `false` |
| `priority granted` | `hasDuelPriority(prompt, false)` | `true` |
| `priority pill reads Choose Action` | render `FieldStatusPills` with `hasPriority: true` | `[data-cy="prio-pill"]` text is `Choose Action` and its `classList` contains `is-priority` |
| `priority pill reads Waiting Opponent` | `hasPriority: false` | text is `Waiting Opponent`, no `is-priority` class |
| `phase pill reads the phase` | `phase: "battle"` | `[data-cy="phase-pill"]` text is `Battle` |
| `separator renders between the pills` | any | `[data-cy="field-status-pills-separator"]` text is `-` |
| `pill group is a live region` | any | `[data-cy="field-status-pills"]` has `aria-live="polite"` |
| `life pill formats thousands` | `LifePointsPill` with `lifePoints: 8000, player: 0` | `[data-cy="life-pill-p0"]` text is `8,000 LP` |
| `field mounts pills and both life pills` | render `DuelField` with `lifePoints: [8000, 7500]` | `[data-cy="field-status-pills"]`, `[data-cy="life-pill-p0"]` and `[data-cy="life-pill-p1"]` all inside `[data-cy="duel-field"]` |
| `field omits life pills without a snapshot` | `lifePoints: null` | neither life pill is present |
| e2e `field shows priority and phase` | production build, own turn | `[data-cy="prio-pill"]` reads `Choose Action` and `[data-cy="phase-pill"]` matches `/Main 1|Draw|Standby/` |
| e2e `field shows both life totals` | production build | `[data-cy="life-pill-p0"]` and `[data-cy="life-pill-p1"]` both read `8,000 LP` at duel start |

## Impl steps

- [x] 1. Create `tests/unit/duel-phase-label.test.ts` and `tests/unit/duel-priority.test.ts` with rows one to six; record failures.
- [x] 2. Create `src/app/presentation/duel-phase-label.ts` and `src/app/prompts/duel-priority.ts` exactly as specified; re-run to green.
- [x] 3. Create `tests/component/FieldStatusPills.test.ts` (`// @vitest-environment jsdom`) with rows seven to twelve; record failures.
- [x] 4. Create `src/app/components/duel-field/FieldStatusPills.svelte`: `div.field-status-pills[data-cy="field-status-pills"][aria-live="polite"][aria-atomic="true"]` containing `span.prio-pill[data-cy="prio-pill"]` with `class:is-priority={hasPriority}`, `span[data-cy="field-status-pills-separator"][aria-hidden="true"]` holding `-`, and `span.field-phase-pill[data-cy="phase-pill"]` holding `duelPhaseLabel(phase)`.
- [x] 5. Create `src/app/components/duel-field/LifePointsPill.svelte`: `p.life-pill[data-cy={`life-pill-p${player}`}]` with `class:is-opponent={player === 1}`, `class:is-self={player === 0}`, `aria-label={`${player === 0 ? "Your" : "Opponent"} life points, ${lifePoints}`}`, text `` `${lifePoints.toLocaleString()} LP` ``.
- [x] 6. In `src/styles/app.css`, add `--success: #7ee2a8;` to the `:root` token block next to `--warning`.
- [x] 7. In `src/styles/app.css`, add `.field-status-pills { position: absolute; z-index: var(--duel-field-layer-control); top: .75rem; right: .75rem; display: flex; align-items: center; gap: .4rem; pointer-events: none; }`.
- [x] 8. In `src/styles/app.css`, add `.prio-pill, .field-phase-pill { padding: .25rem .6rem; border-radius: 999px; font-size: .72rem; font-weight: 800; white-space: nowrap; }`, `.prio-pill { color: #2b1d00; background: var(--warning); }`, `.prio-pill.is-priority { color: #04210f; background: var(--success); }`, `.field-phase-pill { color: #08101f; background: #cfe0f5; }`.
- [x] 9. In `src/styles/app.css`, add `.life-pill { position: absolute; z-index: var(--duel-field-layer-control); left: .75rem; margin: 0; padding: .3rem .7rem; border: 1px solid var(--border); border-radius: 999px; background: rgb(8 16 31 / .82); color: var(--warning); font-weight: 800; pointer-events: none; }`, `.life-pill.is-opponent { top: .75rem; }`, `.life-pill.is-self { bottom: .75rem; }`.
- [x] 10. In `src/app/components/DuelField.svelte`, add the three new exported props with their defaults, import both new components, and render `<FieldStatusPills {hasPriority} {phase} />` plus, when `lifePoints !== null`, `<LifePointsPill player={1} lifePoints={lifePoints[1]} />` and `<LifePointsPill player={0} lifePoints={lifePoints[0]} />` as children of `section.duel-field`.
- [x] 11. In `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, add the same three props with the same defaults and forward them to `<DuelField … />`.
- [x] 12. In `src/app/App.svelte`, import `hasDuelPriority`, add `$: fieldLifePoints = $duel.snapshot === null ? null : ([$duel.snapshot.players[0].lifePoints, $duel.snapshot.players[1].lifePoints] as const);` and pass `phase={$duel.snapshot?.phase ?? "unknown"}`, `hasPriority={hasDuelPriority($duel.prompt, $duel.responsePending)}`, `lifePoints={fieldLifePoints}` to `<DuelFieldErrorBoundary … />`.
- [x] 13. Run `npx vitest run tests/component/FieldStatusPills.test.ts` to green.
- [x] 14. Add the two DuelField rows to `tests/component/DuelField.test.ts` and run it.
- [x] 15. In `e2e/duel-smoke.spec.ts`, extend the `production bundle initializes …` test with the two e2e rows; the pre-existing `page.getByText("8,000 LP").first()` assertion may now resolve to a life pill, which is correct — leave it but scope it to `[data-cy="life-pill-p0"]`.
- [x] 16. Run e2e to green — validate: `--project=chromium` full spec 0 failures **run twice** (the duel seed is random per run, see Environment), plus `--project=firefox-smoke` green. The three responsive gates (action bar vs board, corner button vs board, `>= 1024` no horizontal overflow) must all still pass.
- [x] 17. Run `npx vitest run tests/unit/data-cy-coverage.test.ts` to green. Every element you added under `src/app` needs a `data-cy`, including plain wrappers not named in this ticket's contract.
- [x] 18. Fix the dangling `aria-controls` left behind when T11 deleted the card inspector — `src/app/components/duel-field/DuelHud.svelte:190` still has `aria-controls="card-inspector"` pointing at an id that no longer exists in the DOM. Remove that attribute (the HUD's `Inspect …` buttons now feed the preview panel and control nothing they can name). This is a real accessibility defect introduced by this plan, explicitly folded into T8 by the parent so it does not ship. Validate: `grep -rn 'card-inspector' src/` returns nothing, and `npm run test:component` stays green.

## Outputs

- Files created: `src/app/presentation/duel-phase-label.ts`, `src/app/prompts/duel-priority.ts`, `src/app/components/duel-field/FieldStatusPills.svelte`, `src/app/components/duel-field/LifePointsPill.svelte`, three test files.
- Files edited: `src/app/App.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/app/components/DuelField.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts`, `e2e/duel-smoke.spec.ts`.
- Public API: `duelPhaseLabel`, `DUEL_PHASE_LABELS`, `hasDuelPriority`; three new `DuelField` props consumed again by T9 and T10.
- Migrate / config: none.

## Validation

- [x] `npx vitest run tests/unit/duel-phase-label.test.ts tests/unit/duel-priority.test.ts tests/component/FieldStatusPills.test.ts` passes
- [x] `npm run test:unit && npm run test:component` passes
- [x] `npm run typecheck && npm run lint` passes
- [x] `npm run format` then `npm run format:check` passes
- [x] `npx vitest run tests/unit/data-cy-coverage.test.ts` passes
- [x] e2e green: chromium full spec twice + firefox-smoke (webkit-smoke env-blocked, note it, do not treat as failure)
- [x] all three responsive gates still green and unweakened: action bar vs board, corner button vs board, `>= 1024` no horizontal overflow
- [x] `grep -rn 'card-inspector' src/` returns nothing (step 18)
- [x] manual check: covered by e2e `production bundle initializes …` (asserts `[data-cy="prio-pill"]` = "Choose Action", `[data-cy="phase-pill"]` matches `/Main 1|Draw|Standby/`, and both life pills read "8,000 LP"); no interactive `npm run dev` session run — see Assumptions
- [x] app functional — pills never block a click on the card beneath them
- [x] commit msg draft: `feat(field): show priority, phase and life points on the field`

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

These files were dirty **before** this run and must never be staged: `.gitignore`, `README.md`, `docs/README.md`, `docs/architecture/**`, `docs/developer-guide/**`, `docs/duel-field-architecture.html`, `docs/duel-field-validation-references.html`, `playwright.config.ts`, `vite.config.ts`, deleted `test-results/**`, and untracked `.claude/`, `.pi/`, `.pi-subagents/`, `.agents/`, `.agentsystem/`, `.dev/`, `.tmp/`, `CLAUDE.md`, `AGENTS.md`, `context.md`, `.graphifyignore`, `ai-artifacts/HANDOFF_2026_08_09_duel_field_ux_overhaul.md`. Stage explicit paths only — never `git add -A`.

## Manual test checklist duty

`ai-artifacts/manual_test_checklist.md` exists and already carries a `## T6 field-action-bar` section. Append your own `## T{n} {slug}` section with plain unchecked `- [ ]` boxes describing what a human must click to verify this slice. Never touch another ticket's section. If this slice changes behaviour a previous section describes, update that stale entry rather than only appending. Stage this file with your commit.
