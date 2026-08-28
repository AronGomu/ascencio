# T4: Materials as browsable zone: dialog + action button + detach lists (item 1b)

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`
**Depends:** T2, T3
**Commit outcome:** "Materials" action opens ZoneListDialog; detach prompts list materials like any zone

## Context (self-contained)

- Goal: implement the 2026-08-27 owner feedback round on the duel field right pane. This ticket is item 1's second half (owner wording, binding): "And when an effect need to detach materials, show them in the list dialog, exactly like any other zone. In fact, make materials from an xyz act the same as any other zone. Add an action button to look at the materials and open the dialog list."
- This slice: turns the T3 material *visuals* into a browsable/targetable *zone*. Two flows: (a) a "Materials" action button on any card with materials opens `ZoneListDialog` in browse mode listing its materials; (b) a detach-style card-selection prompt whose choices address overlay units lists those materials in the target-mode list dialog exactly like an off-field zone (hand/GY/deck) does today.
- Out of scope here: chip re-anchoring (T2 done), material element visual styling (T3 done), any edit to `feedback.md`, any edit under `vendor/` (engine frozen), any change to browse behaviour of real stacks (deck/extra/GY/banished).
- Assumptions in force:
  - T3 renders material elements with class `duel-field-card__material`, `data-cy={`field-card-material-${material.id}`}`, non-interactive (`pointer-events: none`), from `BoardCardView.materials`. They stay non-interactive — clicking a material element never opens the dialog; only the "Materials" chip does.
  - T2 re-anchored `CardActionChips` bottom-up; its props (`choices`, `layout`, `dataCyScope`) and `.card-action-chips` class names are unchanged and must stay unchanged in meaning.
  - Detach choices arrive today located on the HOST card: `PublicLocation` has no `"overlay"` (`src/battle/duel/contracts/public-duel-state.ts:18-26`) and `engineToPublicLocation` masks the OVERLAY bit (`src/battle/worker/protocol/PromptRegistry.ts:1173` — `switch (location & ~EngineLocation.OVERLAY)`). Nothing UI-side distinguishes a material choice from its host today; this ticket adds a minimal worker-side overlay marker (allowed by the plan for exactly this purpose).
  - Whether `sequence` on an overlay-addressed prompt card means *overlay index* or *host zone sequence* is engine-payload-defined and **unverified**. Impl step 1 verifies it before any UI wiring. Do NOT guess engine semantics.

## Requirements

- R1: every field card with `materials.length > 0` shows a "Materials" chip in its `CardActionChips` row, even when no prompt is active; clicking it opens `ZoneListDialog` listing that card's materials with the same entry tiles as a stack browse.
- R2: the materials browse dialog behaves like a stack browse: draggable floating window, wheel scroll, preview per entry, closes on outside click / Escape / close button, only one list window at a time.
- R3: T3 material elements remain `pointer-events: none`; they are not launchers.
- R4: when a `cardSelection`-family prompt's choices address overlay units (verified via the engine's OVERLAY location bit), those choices appear in the target-mode `ZoneListDialog` as entries with a `MATERIALS` zone badge, selectable/confirmable exactly like hand/GY/deck target entries today.
- R5: if step-1 verification shows the engine payload cannot distinguish individual materials (all overlay choices collapse to one indistinguishable address), keep today's host-card selection behaviour for detach, record the limitation in this ticket's Outputs and in the final report, and still ship R1–R3.
- R6: gates green: `npm run check:headless` and `npm run test:component`. `tests/unit/data-cy-coverage.test.ts` enforces `data-cy` presence/uniqueness on every new element.

## Inputs

- `src/battle/app/components/DuelField.svelte` — `ZoneListState` union at :144-147, `zoneListState` at :149, `synchronizeZoneList` :945-963, `activateStack` :977-993, `closeZoneList`/`dismissZoneList` :999-1035, `isZoneListLauncher` :1046-1054, `browsedStack`-derived `$: openStack` :244, target-mode `ZoneListDialog` instance :1190, browse-mode instance :1220, `FieldBoard` instantiation :1101-1128.
- `src/battle/app/components/duel-field/ZoneListDialog.svelte` — props :25-58, `headerTitle` reactive :80-84, `mode: "browse" | "target"`.
- `src/battle/app/components/duel-field/ZoneListEntryTile.svelte` — props :15-34 (`entry: ZoneListEntry`, `mode`, `zoneBadge`, `zoneLabel`, choices/selection props).
- `src/battle/app/components/duel-field/CardActionChips.svelte` — props :5-22, chip `data-cy={`${dataCyPrefix}card-action-chip-${choice.id}`}`, container `data-cy={`${dataCyPrefix}card-action-chips-${cardId}`}`, `handleKeydown` arrow-nav over `chipButtons()`.
- `src/battle/app/components/duel-field/CardControl.svelte` — `{#if actionable}` block :307, `{#if choices.length > 0}<CardActionChips …>` :324-334.
- `src/battle/app/components/duel-field/FieldBoard.svelte` — `CardControl` instantiation :296-320.
- `src/battle/field/board-view-model.ts` — `BoardTargetId` :26-27, `BoardMaterialView` :47-54 (`{ id: string; instanceId?: CardInstanceId; sequence: number; identityVisible: boolean; code?: CardCode; label: string }`), `BoardCardView` :64-90 (`targetId: `card:${string}``, `player`, `label`, `materials: readonly BoardMaterialView[]`).
- `src/battle/field/zone-list.ts` — `ZoneListEntry` :16-27, `sourcedEntry` builder pattern :103-125.
- `src/battle/field/off-field-target-list.ts` — `OffFieldZoneBadge` :17-18, `OFF_FIELD_ZONE_DISPLAY_ORDER` :20-21, `OffFieldTargetEntry` :23-28, `ZONE_BADGES`/`ZONE_NAMES` :30-45, `offFieldTargetEntries` :65-86, `targetEntry` :88-140.
- `src/battle/app/prompts/interaction-spec.ts` — `InteractionChoice.cardAddress` :43-47, `OFF_FIELD_TARGET_LOCATIONS` :186, off-field classification :318-324, `sanitizeChoice` cardAddress construction :447-455.
- `src/battle/duel/contracts/player-prompt.ts` — `PromptCard` :51-62, `PromptChoice` :75-84.
- `src/battle/worker/protocol/PromptRegistry.ts` — `toPromptCard` :1145-1171 (synthesizes `instanceId` as `p{c}-l{loc}-s{seq}`, :1155-1157), `engineToPublicLocation` :1173-1191.
- `src/battle/worker/HeadlessDuelController.ts`, `tests/integration/xyz-overlay-progression.test.ts` — engine-driving harness: `DuelSession.create` + `HeadlessDuelController` + seeded `answer()` loop, `PROMPT_BUDGET`, `SCENARIOS` incl. `"detaching a material read back from the core"` (player `burning-abyss`, opponent `opponent`, `seed: seedOf(0)`, `policySeed: 1`).
- `tests/fixtures/board-view-model.ts` — `BOARD_VIEW_MODEL_FIXTURES["ST-07"]` has a monster (The Legendary Fisherman) with 2 materials; `tests/component/DuelField.test.ts:81` `board(state)` helper maps it via `mapSnapshotToBoard`.
- **From Depends:**
  - T3 left: material DOM elements class `duel-field-card__material`, `data-cy={`field-card-material-${material.id}`}`, `pointer-events: none`, rendered from `BoardCardView.materials` inside `CardControl`. This ticket never restyles or re-enables them.
  - T2 left: `CardActionChips` anchored bottom-up; public props exactly `cardId`, `cardLabel`, `choices`, `disabled`, `onchoose`, `ondismiss`, `variant`, `layout`, `ondetails`, `dataCyScope`; chip class `card-action-chip`, container class `card-action-chips`. This ticket only *adds* the `localActions` prop (frozen contract C3), changes nothing existing.

## Interface contract (level 5)

Machine-checkable shapes. Verbatim.

- **Produces:**

  1. `src/battle/app/presentation/local-card-action.ts` (new file):

     ```ts
     /** A card-anchored UI action that never answers a prompt: it runs locally. */
     export interface LocalCardAction {
       readonly id: string;
       readonly label: string;
       readonly onSelect: () => void;
     }
     ```

  2. `CardActionChips.svelte` — new prop (append after `dataCyScope`):

     ```ts
     export let localActions: readonly LocalCardAction[] = [];
     ```

     Rendered as `<button>` chips after the prompt-choice chips and before the `Details` chip, one per action, keyed by `action.id`:
     - class: `card-action-chip card-action-chip--local`
     - `data-cy`: `` `${dataCyPrefix}card-action-chip-local-${action.id}` `` (the `-local-` segment is the frozen scheme: prompt chips use choice ids, local chips use action ids; the segment prevents any collision)
     - `title={action.label}`, `aria-label={action.label}`, `tabindex={variant === "field" ? -1 : 0}`, `{disabled}`, `onclick={() => action.onSelect()}`, `onkeydown={handleKeydown}` (arrow-nav includes them automatically via `chipButtons()`), text content `{action.label}`.

  3. `CardControl.svelte` — new prop `export let localActions: readonly LocalCardAction[] = [];` passed through to `CardActionChips`; render gates widened (see Impl 6).

  4. `FieldBoard.svelte` — new prop:

     ```ts
     export let localActionsFor: (card: BoardCardView) => readonly LocalCardAction[] = () => [];
     ```

     `CardControl` receives `localActions={localActionsFor(card)}`.

  5. `DuelField.svelte` — `ZoneListState` union widened (frozen contract C3):

     ```ts
     type ZoneListState =
       | { readonly mode: "browse"; readonly stackId: PhysicalZoneId }
       | { readonly mode: "materials"; readonly hostId: BoardTargetId }
       | { readonly mode: "target"; readonly promptKey: string }
       | null;
     ```

  6. `src/battle/field/material-list.ts` (new file):

     ```ts
     import type { BoardCardView } from "./board-view-model.ts";
     import type { ZoneListEntry } from "./zone-list.ts";

     /** The materials of one host card as browse entries, top-of-stack first
         (array order of `host.materials`). Empty for a card without materials. */
     export function materialListEntries(host: BoardCardView): readonly ZoneListEntry[];
     ```

     Entry mapping (index `i`, material `m`), frozen per entry and as array:
     `{ id: `${host.id}:material:${m.id}`, position: i + 1, controller: host.player, location: "monster", sequence: m.sequence, identityVisible: m.identityVisible, ...(m.identityVisible && m.code !== undefined ? { code: m.code } : {}), label: m.label }`

  7. `ZoneListDialog.svelte` — browse mode with `stack === null` titles from the existing `title` prop instead of `""` (one-line reactive change; target mode untouched).

  8. `src/battle/duel/contracts/player-prompt.ts` — `PromptCard` gains (append after `sequence`):

     ```ts
     /** Present when the engine addressed this card as an overlay unit (Xyz material): the raw location carried LOCATION_OVERLAY. */
     readonly overlay?: true;
     ```

  9. `src/battle/app/prompts/interaction-spec.ts` — `InteractionChoice.cardAddress` gains:

     ```ts
     readonly overlay?: true;
     ```

  10. `src/battle/field/off-field-target-list.ts` — `OffFieldZoneBadge` union gains `"MATERIALS"`; `OFF_FIELD_ZONE_DISPLAY_ORDER` appends `"MATERIALS"` last; `ZONE_NAMES` gains `MATERIALS: "Materials"`. Overlay-marked choices produce `OffFieldTargetEntry` values with `zoneBadge: "MATERIALS"`, `zoneLabel: `${controller === 0 ? "Your" : "Opponent"} Materials``, `id: `target:overlay:${address.controller}:${address.sequence}``. (Applied only if step-1 verification succeeds — see Errors/R5.)

- **Consumes (binding, do not redesign):**
  - `BoardMaterialView { readonly id: string; readonly instanceId?: CardInstanceId; readonly sequence: number; readonly identityVisible: boolean; readonly code?: CardCode; readonly label: string }` (`src/battle/field/board-view-model.ts:47-54`, T3's source of truth).
  - `ZoneListEntry` exactly as declared at `src/battle/field/zone-list.ts:16-27`.
  - `CardActionChips` existing props/classes/`data-cy` scheme (T2): container `` `${dataCyPrefix}card-action-chips-${cardId}` ``, prompt chip `` `${dataCyPrefix}card-action-chip-${choice.id}` ``.
  - `ZoneListDialog` browse-mode props: `stack`, `entries`, `choices`, `onchoose`, `onpreview`, `onclose`, window-shell props (`DuelField.svelte:1220-1237`).
  - Target-mode flow: `offFieldTargets: readonly OffFieldTargetEntry[]` prop into `DuelField`, built by the App seam via `offFieldTargetEntries(spec, snapshot, cardTexts)`.

- **Errors:**
  - `materialListEntries` never throws; host without materials → frozen empty array.
  - "Materials" chip `onSelect` on a host no longer on the board (stale closure): `openMaterialsDialog` looks the host up by `targetId` in the current `board.cards`; not found → no-op (state stays `null`), no throw.
  - Materials-mode dialog with a host whose card left the board on rerender: the derived host resolves to `null` and the dialog unmounts (same pattern as `openStack`). No error surface.
  - Step-1 verification failure path (engine payload cannot distinguish materials): do NOT wire produces-items 8–10 into the UI flow; detach keeps today's host-card behaviour. Record under Outputs as `LIMITATION: engine detach payload indistinguishable; fallback to host-card selection` and report it.

- **Invariants:**
  - Exactly one list window at a time: opening materials mode closes any browse/target list (single `zoneListState` variable already enforces this — keep it single).
  - A live target-mode prompt wins: while `zoneListState.mode === "target"` auto-open is active, `synchronizeZoneList` resets state on prompt change exactly as today; materials mode never survives a prompt change (`synchronizeZoneList` already nulls state on new prompt key — do not special-case).
  - Material elements stay `pointer-events: none` (T3). Only the chip opens the dialog.
  - `CardActionChips` renders **no DOM at all** when `choices.length === 0 && localActions.length === 0 && !(variant === "list" && ondetails !== null)` (step 5.3 guard). T6 relies on this: it passes `choices={[]}` for selection candidates and asserts `.card-action-chips` is absent.
  - A card carries `has-local-actions` ⇔ `localActions.length > 0`; the chips of such a card are revealed on hover/focus even when the card is not actionable (step 6.5 CSS).
  - `materialListEntries` output order = `host.materials` array order; ids unique per rendered document (host id is unique, material id unique within host).
  - `data-cy` uniqueness document-wide (`tests/unit/data-cy-coverage.test.ts`).
  - Worker edit is projection-marker-only: no engine calls change, no vendored file touched, no hidden information added (`overlay?: true` reveals only what the OVERLAY bit already carried; opponent sanitization path untouched).
  - Production shuffle untouched; the new integration test uses the existing deterministic seed configuration (test-only, per project rules).

- **Integration links** (worker → UI, only for the detach half):
  trigger: ygopro-core detach select emits cards with `location & EngineLocation.OVERLAY` → dispatch: `toPromptCard` (`src/battle/worker/protocol/PromptRegistry.ts:1145`) sets `overlay: true` on the `PromptCard`, prompt crosses the Worker boundary as clone-safe `PlayerPrompt` → receive: `sanitizeChoice` (`src/battle/app/prompts/interaction-spec.ts:447`) copies `overlay` into `cardAddress`; classification at :318-324 routes overlay choices into `offFieldChoices` → observe: `offFieldTargetEntries` renders them as `MATERIALS`-badged entries in the auto-opened target-mode `ZoneListDialog` (`DuelField.svelte:1190`); component test asserts the badge and a confirmable selection.

## TDD

1. **Red** — write these failing/characterizing tests first:
   - `tests/integration/xyz-detach-overlay-address.test.ts` › `"a detach prompt addresses overlay units with the OVERLAY location bit and per-material sequences"` — characterization FIRST: drives the engine, records what detach choices actually carry. Written before any worker edit; its assertions pin the verified semantics.
   - `tests/unit/material-list.test.ts` › `"builds one entry per material in host order"`, `"omits code when identity is hidden"`, `"returns a frozen empty list for a card without materials"` — fail (module missing).
   - `tests/component/DuelField.test.ts` › `"opens the materials list from the Materials chip and closes it like a browse list"` — fails (no chip).
2. **Green** — min code per Impl steps below.
3. **Refactor** — only if needed; keep green.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `tests/integration/xyz-detach-overlay-address.test.ts` › overlay address semantics | Scenario cloned from `xyz-overlay-progression.test.ts` `SCENARIOS[0]` (`burning-abyss` vs `opponent`, `seed: seedOf(0)`, `policySeed: 1`, `PROMPT_BUDGET 400`); intercept every prompt where the current `PublicDuelState` has a monster with `overlayMaterials.length > 0` and a choice's raw engine card location carries `EngineLocation.OVERLAY` (capture via a trace/inspection hook on `toPromptCard` input or by asserting on the emitted `PromptCard.overlay`) | At least one such prompt observed; for it, assert whether each choice `sequence` matches a distinct `PublicOverlayMaterial.sequence` of the host (semantics A: per-material) or all choices share the host's zone sequence (semantics B: indistinguishable). Encode the observed semantics as the test's assertion and a comment; semantics B → R5 fallback applies |
| `tests/unit/material-list.test.ts` › entry mapping | `BoardCardView` stub, `materials: [{ id: "m1", sequence: 0, identityVisible: true, code: 46986414 as CardCode, label: "A" }, { id: "m2", sequence: 1, identityVisible: false, label: "Face-down card" }]`, `id: "host"`, `player: 0` | `[{ id: "host:material:m1", position: 1, controller: 0, location: "monster", sequence: 0, identityVisible: true, code: 46986414, label: "A" }, { id: "host:material:m2", position: 2, controller: 0, location: "monster", sequence: 1, identityVisible: false, label: "Face-down card" }]`; result and entries `Object.isFrozen` |
| `tests/unit/material-list.test.ts` › empty | card with `materials: []` | `[]`, frozen |
| `tests/component/CardActionChips.test.ts` › `"renders local action chips after prompt chips and fires onSelect"` | `localActions: [{ id: "materials", label: "Materials", onSelect: vi.fn() }]` plus one prompt choice | button with `data-cy="card-action-chip-local-materials"` exists after the choice chip, class contains `card-action-chip--local`; click fires `onSelect` once; `onchoose` not called |
| `tests/component/DuelField.test.ts` › `"opens the materials list from the Materials chip and closes it like a browse list"` | `render(DuelField, { board: board("ST-07") })` (Fisherman host has 2 materials), no prompt | chip `data-cy` matching `/card-action-chip-local-materials$/` on the host card; click → `ZoneListDialog` visible with 2 `ZoneListEntryTile`s and header containing the host label + `Materials`; Escape/outside click closes it |
| `tests/component/DuelField.test.ts` › `"a card without materials shows no Materials chip"` | same board, a materials-free card | no `card-action-chip-local-materials` inside that card's article |
| `tests/component/ZoneListDialog.test.ts` › `"target mode shows MATERIALS badge entries as selectable targets"` (only if semantics A) | `mode="target"`, `targetEntries` containing one entry with `zoneBadge: "MATERIALS"`, `zoneLabel: "Your Materials"`, one choice | badge text `MATERIALS` rendered; clicking the answer button fires `ontargetchoice` with that choice |
| existing suites | — | `npm run check:headless` and `npm run test:component` fully green, incl. `data-cy-coverage` and `domain-boundaries` |

Run cmds: `npx vitest run tests/unit/material-list.test.ts`, `npx vitest run tests/integration/xyz-detach-overlay-address.test.ts`, `npx vitest run tests/component/DuelField.test.ts tests/component/CardActionChips.test.ts tests/component/ZoneListDialog.test.ts`.

## Impl steps

- [ ] 1. Verify overlay sequence semantics (blocking gate for steps 8–10)
  - [ ] 1.1 Create `tests/integration/xyz-detach-overlay-address.test.ts` by copying the harness skeleton of `tests/integration/xyz-overlay-progression.test.ts` (imports, `beforeAll` adapter/deck/dependency load, `playScriptedDuel`, `answer`, `candidateResponses`, `seededRandom`), keeping only `SCENARIOS[0]` (`"detaching a material read back from the core"`).
  - [ ] 1.2 In the prompt loop, when the current state has a monster with `overlayMaterials.length > 0`, record every `prompt.choices[].card` whose emitted shape will carry the overlay marker (until step 2 lands, temporarily assert on the raw trace via `controller` diagnostics or run once with a local `console.log` in the copied loop — the committed test asserts on `PromptCard.overlay` after step 2). Collect `{ hostSequence: hostMonster.sequence, materialSequences: host.overlayMaterials.map(m => m.sequence), choiceSequences }`.
  - [ ] 1.3 Run `npx vitest run tests/integration/xyz-detach-overlay-address.test.ts` and read the captured data. Decide: **semantics A** (each overlay choice `sequence` maps 1:1 onto a distinct material sequence of one host — materials distinguishable) or **semantics B** (choices indistinguishable). Write the finding as a comment block at the top of the test and pin it with the final assertion (`expect(overlayPromptObservations.length).toBeGreaterThan(0)` plus the semantics assertion). Semantics B → skip steps 8–10 UI wiring, keep the worker marker (harmless, still verified by this test), and record the limitation in Outputs.
- [ ] 2. Worker overlay marker
  - [ ] 2.1 `src/battle/duel/contracts/player-prompt.ts` — in `interface PromptCard` (:51-62), after `readonly sequence: number;` add:
        `/** Present when the engine addressed this card as an overlay unit (Xyz material). */`
        `readonly overlay?: true;`
  - [ ] 2.2 `src/battle/worker/protocol/PromptRegistry.ts` — in `toPromptCard` (:1145), after the `location:` line add:
        `...((card.location & EngineLocation.OVERLAY) !== 0 ? { overlay: true as const } : {}),`
  - [ ] 2.3 Point the step-1 test's committed assertions at `PromptCard.overlay` (no console.log left behind); rerun it green.
- [ ] 3. Materials entry builder
  - [ ] 3.1 Create `src/battle/field/material-list.ts` with `materialListEntries` exactly per contract item 6 (`Object.freeze` each entry and the array; empty input → `Object.freeze([])`).
  - [ ] 3.2 Create `tests/unit/material-list.test.ts` with the three tests from the Test plan; run `npx vitest run tests/unit/material-list.test.ts` green.
- [ ] 4. Local card action type
  - [ ] 4.1 Create `src/battle/app/presentation/local-card-action.ts` with `LocalCardAction` per contract item 1.
- [ ] 5. `CardActionChips` local chips
  - [ ] 5.1 `src/battle/app/components/duel-field/CardActionChips.svelte` — import `type { LocalCardAction } from "../../presentation/local-card-action.ts";` and add `export let localActions: readonly LocalCardAction[] = [];` after `dataCyScope`.
  - [ ] 5.2 In the markup, after the `{#each choices …}` block and before the `{#if variant === "list" && ondetails !== null}` block, add:
        ```svelte
        {#each localActions as action (action.id)}
          <button
            type="button"
            class="card-action-chip card-action-chip--local"
            title={action.label}
            aria-label={action.label}
            tabindex={variant === "field" ? -1 : 0}
            {disabled}
            onclick={() => action.onSelect()}
            onkeydown={handleKeydown}
            data-cy={`${dataCyPrefix}card-action-chip-local-${action.id}`}
            >{action.label}</button
          >
        {/each}
        ```
  - [ ] 5.3 Same file, wrap the whole root `<div class="card-action-chips" …>…</div>` markup in an empty guard so an all-empty chip set mounts nothing at all:
        ```svelte
        {#if choices.length > 0 || localActions.length > 0 || (variant === "list" && ondetails !== null)}
          <div class="card-action-chips" …>…</div>
        {/if}
        ```
        Reason (record it as a comment above the guard): after T6 a selection candidate is passed `choices={[]}` while its gate still sees prompt choices, so without this guard an empty `.card-action-chips` pill stays in the DOM and is revealed on hover by `app.css:2404-2409`. The guard is byte-compatible with every existing caller — today the component is only mounted when `choices.length > 0`.
  - [ ] 5.4 Add the `CardActionChips` component test from the Test plan to `tests/component/CardActionChips.test.ts` (follow existing render pattern in that file); run green.
  - [ ] 5.5 Add a second test to the same file: `"renders nothing when there are no prompt choices and no local actions"` — render with `choices: []`, `localActions: []`, `variant: "field"` → `document.querySelector(".card-action-chips") === null`. This is the assertion T6 depends on; it must be committed here, not there.
- [ ] 6. Thread local actions through `CardControl` and `FieldBoard`
  - [ ] 6.1 `CardControl.svelte` — import the type; add `export let localActions: readonly LocalCardAction[] = [];` after `choices`.
  - [ ] 6.2 `CardControl.svelte` markup :307-335 — change the gate `{#if actionable}` to `{#if actionable || localActions.length > 0}`; keep the `.duel-field-card__target` button inside a nested `{#if actionable}` so a prompt-free card gains chips but no selection button; change the chips gate `{#if choices.length > 0}` to `{#if choices.length > 0 || localActions.length > 0}` and pass `choices={actionable ? choices : []}` plus `{localActions}` into `CardActionChips`.
  - [ ] 6.3 `FieldBoard.svelte` — add prop `export let localActionsFor: (card: BoardCardView) => readonly LocalCardAction[] = () => [];` beside the other card callbacks; in the `{#each fieldCards as card (card.id)}` `CardControl` instantiation (:296) add `localActions={localActionsFor(card)}`.
  - [ ] 6.4 `CardControl.svelte` — add `class:has-local-actions={localActions.length > 0}` on the card root `<article>`, beside `class:is-actionable={actionable}`. Without it the Materials chip is unreachable on a prompt-free xyz host: every reveal rule in `src/styles/app.css:2404-2409` requires `.is-actionable`, which such a card never carries, so the chip would mount and stay `display: none` forever (jsdom ignores the stylesheet, so no component test catches this).
  - [ ] 6.5 `src/styles/app.css` — extend the reveal rule group at :2404-2409 with the two matching selectors, keeping the existing three byte-identical:
        ```css
        .duel-field-card.has-local-actions:hover .card-action-chips,
        .duel-field-card.has-local-actions:focus-within .card-action-chips {
          display: flex;
        }
        ```
        Update the comment above the group to say the chips are mounted for an actionable card **or** a card carrying local actions.
- [ ] 7. Materials browse mode in `DuelField`
  - [ ] 7.1 `DuelField.svelte` — widen `ZoneListState` (:144-147) per contract item 5.
  - [ ] 7.2 Add below `activateStack`:
        ```ts
        function openMaterialsDialog(hostId: BoardTargetId): void {
          if (board.cards.find(({ targetId }) => targetId === hostId) === undefined) return;
          zoneListState =
            zoneListState?.mode === "materials" && zoneListState.hostId === hostId
              ? null
              : { mode: "materials", hostId };
          if (zoneListState !== null) activateWindow("zoneList");
        }
        ```
  - [ ] 7.3 Add derived state after `$: openStack …` (:244): `$: materialsHost = zoneListState?.mode === "materials" ? (board.cards.find(({ targetId }) => targetId === zoneListState.hostId) ?? null) : null;` and `$: materialEntries = materialsHost === null ? [] : materialListEntries(materialsHost);` (import `materialListEntries` from `../../field/material-list.ts` and `LocalCardAction` type).
  - [ ] 7.4 Add the provider fn:
        ```ts
        function cardLocalActions(card: BoardCardView): readonly LocalCardAction[] {
          if (card.materials.length === 0) return [];
          return [{ id: "materials", label: "Materials", onSelect: () => openMaterialsDialog(card.targetId) }];
        }
        ```
        and pass `localActionsFor={cardLocalActions}` into `FieldBoard` (:1101-1128).
  - [ ] 7.5 `isZoneListLauncher` (:1046) — add a materials branch: `state.mode === "materials"` returns `state.hostId === targetId` (so the outside-click that closes the list on its own host does not immediately reopen it; matches the browse pattern).
  - [ ] 7.6 Render the materials dialog: extend the `{:else if openStack !== null}` chain (:1219) with a preceding branch `{:else if materialsHost !== null}` rendering `ZoneListDialog` with `entries={materialEntries}`, `choices={[]}`, `title={`${materialsHost.label} Materials`}`, and the same `imageLibrary`/`cardBackUrl`/`placeholderUrl`/`disabled`/`boundaryElement`/`windowPosition`/`active`/`onactivate`/`onwindowpositionchange`/`onpreview`/`onclose={dismissZoneList}` bindings as the browse instance (:1220-1237); omit `onchoose` (no choices).
  - [ ] 7.7 `ZoneListDialog.svelte` `headerTitle` (:80-84) — change the browse arm from `stack === null ? "" : cardListBrowseTitle(stack.zone)` to `stack === null ? title : cardListBrowseTitle(stack.zone)`.
  - [ ] 7.8 Add the two `DuelField` component tests from the Test plan (use the `board("ST-07")` helper at `tests/component/DuelField.test.ts:81`); run `npx vitest run tests/component/DuelField.test.ts` green.
- [ ] 8. Detach → target-mode materials list (ONLY if step 1 verified semantics A; otherwise check this box with note `skipped: semantics B fallback` and go to step 11)
  - [ ] 8.1 `src/battle/app/prompts/interaction-spec.ts` — `InteractionChoice.cardAddress` (:43-47) gains `readonly overlay?: true;`.
  - [ ] 8.2 `sanitizeChoice` (:447-455) — inside the `cardAddress` object add `...(choice.card!.overlay === true ? { overlay: true as const } : {}),`.
  - [ ] 8.3 Off-field classification (:318-324) — widen the condition to `(OFF_FIELD_TARGET_LOCATIONS.has(choice.cardAddress.location) || choice.cardAddress.overlay === true)`.
- [ ] 9. `MATERIALS` badge entries (semantics A only)
  - [ ] 9.1 `src/battle/field/off-field-target-list.ts` — add `"MATERIALS"` to `OffFieldZoneBadge` (:17-18), append to `OFF_FIELD_ZONE_DISPLAY_ORDER` (:20-21), add `MATERIALS: "Materials"` to `ZONE_NAMES` (:39-45).
  - [ ] 9.2 In `targetEntry` (:88), before the existing `offFieldZoneBadge` gate, add an overlay branch: when `address.overlay === true`, resolve identity from the projection by scanning `snapshot.players[address.controller].monsters` for the host whose `overlayMaterials` contains a material with `sequence === address.sequence` (per verified semantics A; adjust the lookup to the exact verified mapping and say so in a comment), then return a frozen entry `{ id: `target:overlay:${address.controller}:${address.sequence}`, position: address.sequence + 1, controller, location: address.location, sequence: address.sequence, identityVisible, code?, label, zoneBadge: "MATERIALS", zoneLabel: `${address.controller === 0 ? "Your" : "Opponent"} Materials`, choices }` — identity fallback rules identical to the existing body (projected code first, `choices.find(c => c.cardCode)` for controller 0, else `"Face-down card"`).
  - [ ] 9.3 Add unit coverage in `tests/unit/off-field-target-list.test.ts`: `"an overlay-marked choice becomes a MATERIALS entry"` asserting badge, zoneLabel, id scheme, identity resolution (follow the file's existing fixture style).
- [ ] 10. Target-mode dialog coverage (semantics A only)
  - [ ] 10.1 Add `tests/component/ZoneListDialog.test.ts` › `"target mode shows MATERIALS badge entries as selectable targets"` per the Test plan; run green. (No `DuelField` change needed: the T16 auto-open at :959-962 already opens the target list whenever `offFieldTargets.length > 0`.)
- [ ] 11. Gates
  - [ ] 11.1 `npm run test:component` — green.
  - [ ] 11.2 `npm run check:headless` — green (format, lint incl. boundary zones, typecheck, unit incl. `data-cy-coverage` + `domain-boundaries`, integration, vendor/assets/snapshot verify).
  - [ ] 11.3 Update `artifacts/manual_test_checklist.md`: add a step "Xyz monster with materials → Materials chip opens the material list; detach prompt lists materials in the target dialog (or falls back to host selection — note which shipped)".

## Outputs

- Files touched: `src/battle/duel/contracts/player-prompt.ts`, `src/battle/worker/protocol/PromptRegistry.ts`, `src/battle/field/material-list.ts` (new), `src/battle/app/presentation/local-card-action.ts` (new), `src/battle/app/components/duel-field/CardActionChips.svelte`, `CardControl.svelte`, `FieldBoard.svelte`, `src/battle/app/components/DuelField.svelte`, `src/battle/app/components/duel-field/ZoneListDialog.svelte`; semantics-A only: `src/battle/app/prompts/interaction-spec.ts`, `src/battle/field/off-field-target-list.ts`. Tests: `tests/integration/xyz-detach-overlay-address.test.ts` (new), `tests/unit/material-list.test.ts` (new), `tests/component/CardActionChips.test.ts`, `tests/component/DuelField.test.ts`, semantics-A: `tests/unit/off-field-target-list.test.ts`, `tests/component/ZoneListDialog.test.ts`. Plus `artifacts/manual_test_checklist.md`.
- Public API / behavior change: `PromptCard.overlay?: true` (contract widening, additive); `CardActionChips.localActions` + its empty-set guard (component now renders nothing when it has nothing to show); card-root class `has-local-actions` + its two reveal rules; `FieldBoard.localActionsFor`; every card with materials gains a "Materials" chip opening a browse dialog; detach prompts list materials as `MATERIALS` target entries (semantics A) or unchanged (semantics B — record `LIMITATION:` line here if so).
- No migration/config. All frozen public entries (`src/battle/index.ts` etc.) untouched — everything here is battle-internal.

## Validation

- [ ] tests pass: `npx vitest run tests/unit/material-list.test.ts tests/unit/off-field-target-list.test.ts`, `npx vitest run tests/integration/xyz-detach-overlay-address.test.ts`, `npm run test:component`, `npm run check:headless` — all exit 0.
- [ ] manual check: `npm run dev`, start a duel with `burning-abyss`, Xyz Summon, hover the Xyz monster → "Materials" chip → dialog lists materials; trigger a detach → target dialog lists materials (or host fallback per recorded semantics). Materials elements themselves still ignore clicks.
- [ ] no silent-failure swallow on a path this slice adds: `openMaterialsDialog` returning early for a missing host is a deliberate no-op on a stale closure, listed here as the only kept site; no `|| true`, empty catch, or output redirection added.
- [ ] app functional: browse lists, target lists, drag, hand zoom unaffected — covered by the untouched `DuelField.test.ts` suites staying green.
- [ ] commit msg draft: `feat(duel): browse xyz materials as a zone list and target them on detach (#1b)`
