# T3: In-field phase strip and repositioned End turn

**Plan:** `./ai-artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md`
**Depends:** none
**Commit outcome:** Six phase chips render in the board's free centre band, split left/right by the shared extra monster zones; the current phase carries a blue halo, engine-offered transitions are clickable and the rest are greyed; End turn moves to the right edge between the two banished zones; the top-right status pills are deleted.

## Context (self-contained)

- Goal: ship 17 duel-field feedback items. This slice is items 10 and 15.
- This slice: today `src/app/components/duel-field/FieldStatusPills.svelte` renders a `Choose Action | Waiting Opponent` pill plus a phase pill absolutely positioned top-right of the field. `src/app/components/duel-field/EndTurnButton.svelte` renders a bottom-pinned orange button. There is no way to change phase except that button and the `Enter Battle Phase` / `Enter Main Phase 2` entries in `FieldActionBar`'s global-choice row.
- Out of scope here: the preview status line (T2 owns it), the header (T1), auto-response (T4), anything about stacks.
- Assumptions in force:
  - **A13** `FieldStatusPills.svelte` is deleted, not restyled. Its test file goes with it.
  - **A15** the End turn button survives alongside the strip's `End` chip; item 10 asks for both.

## Board geometry facts you must respect

`src/field/duel-field-layout.ts` positions zones in a 1280x720 normalised space. Converted to percentages of the board:

| Zone | x range | y range |
| --- | --- | --- |
| p1 main monster row | 34.4% – 74.2% | 34.7% – 50.6% |
| p0 main monster row | 34.4% – 74.2% | 65.3% – 81.1% |
| shared extra monster left | 46.1% – 52.5% | 50.0% – 65.8% |
| shared extra monster right | 53.9% – 60.3% | 50.0% – 65.8% |
| p1 banished | 88.3% – 94.7% | 34.7% – 50.6% |
| p0 banished | 88.3% – 94.7% | 65.3% – 81.1% |

The only band with no zone outside the two extra monster zones is **y 51% – 64%**, for **x < 46.1%** and **x > 60.3%**. The phase strip and the End turn button must live inside that band and inside those x ranges. This is not cosmetic: the previous plan lost hours to a field overlay swallowing pointer events aimed at card targets. The container is `pointer-events: none`; only the chips and the button are `pointer-events: auto`.

## Requirements

1. New module `src/app/prompts/phase-transitions.ts` exporting:
   ```ts
   export type PhaseSlot = "draw" | "standby" | "main1" | "battle" | "main2" | "end";

   export const PHASE_SLOTS_LEFT: readonly PhaseSlot[];   // ["draw", "standby", "main1"]
   export const PHASE_SLOTS_RIGHT: readonly PhaseSlot[];  // ["battle", "main2", "end"]
   export const PHASE_SLOT_LABELS: Readonly<Record<PhaseSlot, string>>;
   //   draw: "Draw", standby: "Standby", main1: "Main 1",
   //   battle: "Battle", main2: "Main 2", end: "End"

   /** Which chip the engine's current phase lights up. `null` for "unknown". */
   export function phaseSlotForDuelPhase(phase: DuelPhase): PhaseSlot | null;

   /** Chips the engine is currently offering to move to, keyed by slot. */
   export function phaseSlotChoices(
     spec: ActiveInteractionSpec | null,
   ): ReadonlyMap<PhaseSlot, InteractionChoice>;
   ```
   `phaseSlotForDuelPhase` mapping: `draw→draw`, `standby→standby`, `main1→main1`, `battleStart|battleStep|damage|damageCalculation|battle→battle`, `main2→main2`, `end→end`, `unknown→null`.
   `phaseSlotChoices` walks `spec.globalChoices.values()` and maps `action === "battlePhase" → "battle"`, `"mainPhase2" → "main2"`, `"endPhase" → "end"`. First match per slot wins. Returns an empty map when `spec` is `null`.
2. New component `src/app/components/duel-field/PhaseStrip.svelte`:
   ```svelte
   <script lang="ts">
     export let phase: DuelPhase = "unknown";
     export let spec: ActiveInteractionSpec | null = null;
     export let disabled = false;
     export let oninteraction: (action: InteractionSessionAction) => unknown = () => false;
   </script>
   ```
   - Renders two groups: `PHASE_SLOTS_LEFT` in the left group, `PHASE_SLOTS_RIGHT` in the right group.
   - A chip is a `<button type="button">` when `phaseSlotChoices(spec)` has its slot **and** `!disabled`; otherwise a `<span>`.
   - Classes: `is-current` when the slot equals `phaseSlotForDuelPhase(phase)`; `is-available` when it is in `phaseSlotChoices(spec)`; neither otherwise.
   - Clicking an available chip dispatches `oninteraction({ type: "chooseChoice", choiceId: choice.id, key: spec.key })`.
   - The group container carries `role="group"` and `aria-label="Duel phases"` on the outer wrapper only (one `aria-label` for the strip, not per group).
   - Each chip's accessible name is `` `${PHASE_SLOT_LABELS[slot]} phase` `` plus `, current` when current and `, available` when available, via `aria-label`.
3. `src/app/components/DuelField.svelte` renders `<PhaseStrip {phase} {spec} disabled={pending} {oninteraction} />` and deletes the `<FieldStatusPills {hasPriority} {phase} />` line, the `FieldStatusPills` import and the `export let hasPriority = false;` prop.
4. `src/app/components/duel-field/DuelFieldErrorBoundary.svelte` drops the `hasPriority` prop. `src/app/App.svelte` drops `hasPriority={hasDuelPriority(...)}` from the `DuelFieldErrorBoundary` call site and drops the now-unused `hasDuelPriority` import. **Keep `src/app/prompts/duel-priority.ts` and `tests/unit/duel-priority.test.ts`** — T11 uses `hasDuelPriority` again.
5. Delete `src/app/components/duel-field/FieldStatusPills.svelte` and `tests/component/FieldStatusPills.test.ts`.
6. `EndTurnButton` is repositioned by CSS only; its markup, props and `data-cy` stay exactly as they are.
7. `src/styles/app.css`:
   - Delete `.field-status-pills`, `.field-status-pills-separator`, `.prio-pill`, `.prio-pill.is-priority`, `.field-phase-pill` and the shared `.prio-pill, .field-phase-pill` rule.
   - Add the phase strip rules listed in the impl steps.
   - Replace the `.field-end-turn` positioning with `position: absolute; right: 1%; top: 57.5%; transform: translateY(-50%); z-index: var(--duel-field-layer-control);`.
   - Remove the `.duel-field[data-field-action-bar="true"]` bottom-padding floor term that only existed to clear the old bottom-pinned End turn button **only if** it no longer has an effect; if `FieldActionBar` still pins to the bottom, leave that rule untouched.
8. Every new rendered element carries a unique kebab-case `data-cy`.

### Exact `data-cy` values

| Element | `data-cy` |
| --- | --- |
| strip wrapper `<div>` | `field-phase-strip` |
| left group `<div>` | `field-phase-strip-left` |
| right group `<div>` | `field-phase-strip-right` |
| each chip | `` `field-phase-chip-${slot}` `` — `field-phase-chip-draw`, `-standby`, `-main1`, `-battle`, `-main2`, `-end` |

## Inputs

- `src/app/components/DuelField.svelte` — the `<FieldStatusPills {hasPriority} {phase} />` line, the `FieldStatusPills` import, `export let hasPriority = false;`, `export let phase: DuelPhase = "unknown";`, `<EndTurnButton {spec} disabled={pending} {oninteraction} />`, and the `dispatch()` helper.
- `src/app/components/duel-field/FieldStatusPills.svelte` — to delete.
- `src/app/components/duel-field/EndTurnButton.svelte` — read only; `endPhaseChoice(spec)` shows how to find the `endPhase` global choice.
- `src/app/components/duel-field/DuelFieldErrorBoundary.svelte` — `hasPriority` forwarding.
- `src/app/App.svelte` — `hasPriority={hasDuelPriority($duel.prompt, $duel.responsePending)}` on the `DuelFieldErrorBoundary` call site and the `hasDuelPriority` import.
- `src/app/prompts/interaction-spec.ts` — `ActiveInteractionSpec`, `InteractionChoice`, `endPhaseChoice`, and `globalChoices: ReadonlyMap<ChoiceId, InteractionChoice>`.
- `src/app/prompts/interaction-session.ts` — `InteractionSessionAction`, whose `chooseChoice` variant is `{ type: "chooseChoice"; choiceId: ChoiceId; key: InteractionKey }`.
- `src/duel/contracts/public-duel-state.ts` — `DuelPhase` union.
- `src/app/presentation/duel-phase-label.ts` — existing labels; the strip uses its **own** `PHASE_SLOT_LABELS`, do not repurpose `DUEL_PHASE_LABELS`.
- `src/styles/app.css` — rules around lines 718-751 (`.field-status-pills` block) and the `.field-end-turn` rule.
- `tests/component/DuelField.test.ts`, `tests/component/FieldStatusPills.test.ts`, `tests/component/EndTurnButton.test.ts`, `tests/unit/data-cy-coverage.test.ts`.
- **From Depends:** none.

## TDD

1. **Red** — add `tests/unit/phase-transitions.test.ts` and `tests/component/PhaseStrip.test.ts`; delete `tests/component/FieldStatusPills.test.ts`; add the negative assertion to `tests/component/DuelField.test.ts`. Run `npm run test:unit && npm run test:component`; the new files must fail.
2. **Green** — implement `phase-transitions.ts` and `PhaseStrip.svelte`, rewire `DuelField.svelte`, `DuelFieldErrorBoundary.svelte`, `App.svelte`, move the CSS.
3. **Refactor** — only if needed. Keep green.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `maps every engine phase to a slot` | each member of `DuelPhase` | `draw/standby/main1/main2/end` map to themselves; `battleStart`, `battleStep`, `damage`, `damageCalculation`, `battle` all map to `"battle"`; `unknown` maps to `null` |
| `maps global choices to slots` | spec whose `globalChoices` hold `battlePhase` + `endPhase` | map has `battle` and `end`, size 2 |
| `returns an empty map for no spec` | `phaseSlotChoices(null)` | `size === 0` |
| `renders six chips` | render `PhaseStrip` with `phase="main1"`, `spec=null` | `field-phase-chip-draw` … `field-phase-chip-end` all present; left group holds 3, right group holds 3 |
| `marks the current phase` | `phase="main1"` | `field-phase-chip-main1` has class `is-current`; `field-phase-chip-draw` does not |
| `battle-family phases light the battle chip` | `phase="damageCalculation"` | `field-phase-chip-battle` has class `is-current` |
| `only offered transitions are buttons` | spec offering `battlePhase` only | `field-phase-chip-battle` is a `BUTTON`; `field-phase-chip-draw` is a `SPAN` |
| `clicking an offered chip dispatches its choice` | spec offering `endPhase` with id `c-end`; click `field-phase-chip-end` | `oninteraction` called once with `{ type: "chooseChoice", choiceId: "c-end", key: spec.key }` |
| `disabled suppresses the buttons` | spec offering `battlePhase`, `disabled={true}` | `field-phase-chip-battle` is a `SPAN`; clicking it dispatches nothing |
| `duel field no longer renders the status pills` | render `DuelField` with the standard fixture | lookups for `field-status-pills`, `prio-pill` and `phase-pill` all return `null`; `field-phase-strip` is present |

## Impl steps

- [x] 1. Create `tests/unit/phase-transitions.test.ts` with the three unit cases from the table.
- [x] 2. Create `tests/component/PhaseStrip.test.ts` with the six component cases, following the render style in `tests/component/EndTurnButton.test.ts` (it already builds an `ActiveInteractionSpec` by hand — copy that builder).
- [x] 3. Delete `tests/component/FieldStatusPills.test.ts`.
- [x] 4. Add the `duel field no longer renders the status pills` case to `tests/component/DuelField.test.ts` and delete any existing assertions there that read `field-status-pills`, `prio-pill` or `phase-pill`.
- [x] 5. Run `npm run test:unit && npm run test:component`; confirm the new files fail.
- [x] 6. Create `src/app/prompts/phase-transitions.ts` with the exact exports above.
- [x] 7. Create `src/app/components/duel-field/PhaseStrip.svelte` with the exact prop contract and `data-cy` values above. Use `<svelte:element this={available ? "button" : "span"}>` for the chip, mirroring the pattern already used in `src/app/components/duel-field/ZoneControl.svelte`.
- [x] 8. In `src/app/components/DuelField.svelte`: delete the `FieldStatusPills` import and its render line, delete `export let hasPriority = false;`, import `PhaseStrip` and render `<PhaseStrip {phase} {spec} disabled={pending} {oninteraction} />` immediately after `<FieldBoard … />`.
- [x] 9. Delete `src/app/components/duel-field/FieldStatusPills.svelte`.
- [x] 10. In `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, delete the `hasPriority` prop declaration and its forwarding.
- [x] 11. In `src/app/App.svelte`, delete `hasPriority={…}` from the `DuelFieldErrorBoundary` call site and delete the now-unused `hasDuelPriority` import. Do **not** delete `src/app/prompts/duel-priority.ts`.
- [x] 12. In `src/styles/app.css`, delete the `.field-status-pills`, `.field-status-pills-separator`, `.prio-pill`, `.prio-pill.is-priority` and `.field-phase-pill` rules (both occurrences of `.field-phase-pill`).
- [x] 13. In `src/styles/app.css`, add:
  ```css
  .field-phase-strip {
    position: absolute;
    z-index: var(--duel-field-layer-control);
    top: 51%;
    right: 0;
    left: 0;
    height: 13%;
    display: flex;
    align-items: center;
    pointer-events: none;
  }
  .field-phase-strip__group { display: flex; align-items: center; gap: 0.3rem; position: absolute; }
  .field-phase-strip__group--left { right: 54.5%; }
  .field-phase-strip__group--right { left: 61%; }
  .field-phase-chip {
    pointer-events: none;
    padding: 0.2rem 0.5rem;
    border: 1px solid transparent;
    border-radius: 999px;
    background: rgb(8 16 31 / 0.72);
    color: color-mix(in srgb, var(--muted) 70%, transparent);
    font-size: 0.68rem;
    font-weight: 800;
    white-space: nowrap;
  }
  button.field-phase-chip { pointer-events: auto; cursor: pointer; }
  .field-phase-chip.is-available { color: var(--ink); border-color: var(--border); }
  .field-phase-chip.is-current { box-shadow: 0 0 0 2px var(--accent), 0 0 0.6rem var(--accent); color: var(--ink); }
  ```
- [x] 14. In `src/styles/app.css`, replace the `.field-end-turn` positioning rule with `position: absolute; z-index: var(--duel-field-layer-control); right: 1%; top: 57.5%; transform: translateY(-50%);` keeping its existing colour/size declarations.
- [x] 15. Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:component`.
- [x] 16. Run the chromium e2e suite (see Validation) and fix any pointer-interception failure by shrinking the chips or the band, never by relaxing the test.

### Deviation (orchestrator-approved)

Steps 3/8's literal DOM placement (render `PhaseStrip`/`EndTurnButton` as siblings of `<FieldBoard>` inside `.duel-field`) was replaced by wrapping `<FieldBoard>` together with `<PhaseStrip>`/`<EndTurnButton>` in a new, padding-free `<div class="duel-field-stage" data-cy="duel-field-stage">` inside `.duel-field`. Reason, measured directly against the rendered DOM: `.duel-field` carries its own padding (1rem top/left/right, plus a dynamic bottom gutter reserved for `FieldActionBar`, ~87px when visible), so `.duel-field`'s box (measured 966x628 at a 1366px viewport) is not the board's own box (measured 932x524, matching the `aspect-ratio: 16/9` board). Percentages on `.field-phase-strip`/`.field-end-turn` resolved against `.duel-field` landed 8-13 points off the ticket's own geometry table; End turn (top:57.5%) measurably overlapped `p0:banished`'s target rect by ~25px, confirmed by the `responsive field compositions...` e2e check. `.duel-field-stage` has no padding and (like `.duel-field-board`) tracks the board's `min-width: 52rem` floor, so its box always equals the board's rendered box, matching what `ZoneControl`'s own `--field-x`/`--field-y` percentages already resolve against.

Separately, the ticket's board-geometry table itself proved to have a systematic error: it reported each zone's extent as `center` to `center + full width/height`, but zones render with `transform: translate(-50%, -50%)`, so every true extent is the table's span shifted up/left by half the zone's own size (true_top = stated_top − height/2). Measured true extents at a 1366px viewport (board 932x524): shared extra monster left x [42.90%, 49.30%], right x [50.70%, 57.10%], both y [42.11%, 57.92%]; p1 banished true y [26.75%, 42.65%]; p0 banished true y [57.36%, 73.10%]. The true free gap between the two banished zones is y [42.65%, 57.36%], not the table's stated [51%, 64%]. `.field-phase-strip`'s `top` was changed from the ticket's `51%` to `43.5%` (height stays the ticket's `13%`) and its group boundaries from `54.5%`/`61%` to `60.6%`/`60.6%`; `.field-end-turn`'s `top` was changed from the ticket's `57.5%` to `50%` (all other declarations, including `right: 1%`, unchanged) — all chosen to sit inside the measured true free gap and clear of the true extra-monster-zone columns. Verified green against `responsive field compositions...` (End turn/target overlap check) and the pointer-interception specs, chromium e2e project, 2 consecutive full-suite runs.

All chip labels, `data-cy` values, classes, click behaviour, and component props are unchanged from the ticket's spec; only the containing element and the numeric geometry constants noted above differ.

## Outputs

- Added: `src/app/prompts/phase-transitions.ts`, `src/app/components/duel-field/PhaseStrip.svelte`, `tests/unit/phase-transitions.test.ts`, `tests/component/PhaseStrip.test.ts`.
- Deleted: `src/app/components/duel-field/FieldStatusPills.svelte`, `tests/component/FieldStatusPills.test.ts`.
- Edited: `src/app/components/DuelField.svelte`, `src/app/components/duel-field/DuelFieldErrorBoundary.svelte`, `src/app/App.svelte`, `src/styles/app.css`, `tests/component/DuelField.test.ts`.
- Public contract for successors: `PhaseSlot`, `PHASE_SLOTS_LEFT`, `PHASE_SLOTS_RIGHT`, `PHASE_SLOT_LABELS`, `phaseSlotForDuelPhase(phase)`, `phaseSlotChoices(spec)` in `src/app/prompts/phase-transitions.ts`. `DuelField` and `DuelFieldErrorBoundary` no longer accept `hasPriority`. `data-cy` `field-phase-strip`, `field-phase-strip-left`, `field-phase-strip-right`, `field-phase-chip-<slot>`.
- No migration, no config change.

## Validation

- [x] `npm run format:check` exits 0
- [x] `npm run lint` exits 0
- [x] `npm run typecheck` exits 0
- [x] `npm run test:unit` exits 0
- [x] `npm run test:component` exits 0
- [x] chromium e2e exits 0 — the strip must not intercept pointer events aimed at card targets:
  ```bash
  cd /home/aron/projects/ascencio
  timeout 590 nix-shell -p playwright-driver.browsers glib gtk3 nss nspr dbus atk cups \
    libdrm expat libx11 libxcomposite libxdamage libxext libxfixes libxrandr mesa \
    alsa-lib at-spi2-atk at-spi2-core cairo pango xorg.xvfb --run '
  export PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers
  npx playwright test --project=chromium
  '
  ```
  **This exact command was verified green by the orchestrator on 2026-08-10** (`1 passed` on `-g "production bundle initializes"`). Run it verbatim from the repo root.
  - `PLAYWRIGHT_BROWSERS_PATH=.tmp/pw-browsers` is mandatory. That directory holds symlinks to the nix-patched browsers in `/nix/store/8ilw3r312xcs1ylxg4g274rhf2frp9z4-playwright-browsers` under the revision names playwright 1.61 expects (`chromium-1228 -> chromium-1217`). The mismatched revision numbers are deliberate and fine.
  - Without the override, Playwright picks `~/.cache/ms-playwright`, whose binaries are unpatched and die with `libglib-2.0.so.0: cannot open shared object file`. That error means the override is missing, not that the `-p` list is wrong.
  - `playwright-driver.browsers` and `xorg.xvfb` are both required in the `-p` list even though Xvfb is never launched. Do not simplify the list.
  - If `.tmp/pw-browsers` is gone, recreate it: `S=/nix/store/8ilw3r312xcs1ylxg4g274rhf2frp9z4-playwright-browsers` (rebuild with `nix-build '<nixpkgs>' -A playwright-driver.browsers --no-out-link` if the path is garbage-collected), then `mkdir -p .tmp/pw-browsers && cd .tmp/pw-browsers && ln -sfn $S/chromium-1217 chromium-1228 && ln -sfn $S/chromium_headless_shell-1217 chromium_headless_shell-1228 && ln -sfn $S/ffmpeg-1011 ffmpeg-1011 && ln -sfn $S/firefox-1511 firefox-1532`.
  - Run it in the **foreground**, blocking. Runs take 1-5 min; `webServer` builds and starts the preview itself, so do not hand-start `npm run preview`.
  - The duel seed is random per run (`crypto.getRandomValues`). A single pass of a duel-walking test proves little; if a duel-walking test is the one you changed, run the suite 3 times before calling it green.
- [ ] manual check: `npm run dev`; during your Main Phase 1 the `Main 1` chip has a blue halo, `Battle` and `End` are lit and clickable, `Draw` and `Standby` are grey, and End turn sits at the right edge level with the extra monster zones
- [ ] manual check: `npm run dev`; app functional — clicking `Battle` advances the phase and the board stays fully clickable
- [ ] commit msg draft: `feat(field): navigate phases from an in-field phase strip`
</content>
