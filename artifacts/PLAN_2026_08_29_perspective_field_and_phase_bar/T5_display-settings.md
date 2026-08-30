# T5: showCardShadows + showZoneLabels settings

**Plan:** `./artifacts/PLAN_2026_08_29_perspective_field_and_phase_bar.md`
**Depends:** T3
**Commit outcome:** two new persisted display settings — card shadows and zone labels (zone name text only, not LP) — toggleable from the settings dialog, applied via board data-attributes like the existing outline/count toggles.

## Context (self-contained)

- Goal: perspective field ships with shadows and labels on; owner wants both toggleable in-game.
- This slice: settings plumbing end to end, following the `showZoneOutlines` pattern exactly.
- Out of scope here: LP display (DuelRail, untouched — A2); any new visual recipe (T3's shadow is the thing being toggled).
- Assumptions in force: A2.

## Requirements

- Defaults: both `true`.
- "Zone labels" hides the zone name text (`ZoneControl`'s `{zone.label}` span) only. Accessible names (`aria-label`/`accessibleLabel`) are NOT touched — screen-reader output is not a display preference.
- "Card shadows" removes the `.duel-field-card` box-shadow from T3.
- Persisted in `ygo.ui.v2` under `settings` beside `showZoneOutlines`/`showZoneCounts`; unknown/missing keys default `true` (same tolerant read as `persisted-ui-state.ts:78`).
- Applied as `data-card-shadows` / `data-zone-labels` attributes on `.duel-field-board`, mirroring `data-zone-outlines` (`FieldBoard.svelte:212`).

## Inputs

- **From T3:** the shadow rule on `.duel-field-card` in `src/styles/app.css` (single `box-shadow` declaration) — this ticket wraps it in an attribute-gated rule.
- `src/battle/app/stores/ui-settings-store.ts` — `UiSettingsState`, `DEFAULT_UI_SETTINGS`, setter per flag.
- `src/battle/app/stores/persisted-ui-state.ts` — `PersistedDisplaySettings`, `readPersistedUiState`, write path in `persisted-ui-store.ts`.
- `src/battle/app/components/SettingsDialog.svelte` — checkbox rows pattern (`:134-158`).
- `src/battle/app/App.svelte` — wiring `$uiSettings.showZoneOutlines` → DuelFieldErrorBoundary (`:1498-1499`) and settings-dialog handlers.
- `src/battle/app/components/duel-field/DuelFieldErrorBoundary.svelte:53-54`, `DuelField.svelte:134-135`, `FieldBoard.svelte:51-52` — prop chain to extend.
- `src/battle/app/acceptance/AcceptanceHarness.svelte:134-135` — same wiring for the acceptance build.
- `tests/unit/persisted-ui-state.test.ts`, `tests/component/DuelField.test.ts`, SettingsDialog tests.
- Required consumers discovered by typecheck: `src/shell/settings/shell-settings.ts`, `tests/unit/persisted-ui-store.test.ts`, `tests/unit/shell-settings.test.ts`, `tests/component/AppChrome.test.ts` — update only new settings fields/defaults/assertions.

## Interface contract (level 5)

- **Produces:**

```ts
// ui-settings-store.ts additions
readonly showCardShadows: boolean;   // default true
readonly showZoneLabels: boolean;    // default true
setShowCardShadows(value: boolean): void;
setShowZoneLabels(value: boolean): void;

// persisted-ui-state.ts
export interface PersistedDisplaySettings {
  readonly showZoneOutlines: boolean;
  readonly showZoneCounts: boolean;
  readonly showCardShadows: boolean;
  readonly showZoneLabels: boolean;
}
// readPersistedUiState: typeof settings.showCardShadows === "boolean" ? … : true (same for labels)
```

```svelte
<!-- prop chain, all four files -->
export let showCardShadows = true;
export let showZoneLabels = true;
<!-- FieldBoard root -->
data-card-shadows={showCardShadows ? "true" : "false"}
data-zone-labels={showZoneLabels ? "true" : "false"}
```

```css
/* app.css — T3's unconditional shadow becomes: */
.duel-field-board[data-card-shadows="false"] .duel-field-card { box-shadow: none; }
.duel-field-board[data-zone-labels="false"] .duel-field-zone__label { display: none; }
/* ZoneControl's label span is already addressable: data-cy={`zone-control-label-${zone.id}`} (ZoneControl.svelte:80). Add only the class duel-field-zone__label — no second data-cy. */
```

```svelte
<!-- SettingsDialog rows (copy zone-outlines row shape verbatim) -->
data-cy="settings-show-card-shadows-checkbox"  label "Show card shadows"
  description "Draw a soft shadow under every card on the field."
data-cy="settings-show-zone-labels-checkbox"   label "Show zone labels"
  description "Name empty zones on the board. Life points are unaffected."
```

- **Consumes:** `persisted-ui-store.ts` write path exactly as `setShowZoneOutlines` flows today (settings dialog handler → uiSettings store → persisted mirror). Copy the trace of one existing flag; do not invent a new path.
- **Errors:** none; malformed persisted JSON already falls back to defaults.
- **Invariants:**
  - `aria-label` of zones identical with labels on or off.
  - Old persisted payloads (v2 without the new keys) load with both `true` — no version bump.
  - Reset button restores both to `true`.
- **Integration links:** trigger checkbox change in SettingsDialog → dispatch `uiSettings.setShowCardShadows(false)` → persisted write to `localStorage["ygo.ui.v2"]` → observe `data-card-shadows="false"` on `[data-cy="duel-field-board"]` and, after reload, checkbox still unchecked.

## TDD

1. **Red** — persisted-ui-state read/write cases; DuelField/FieldBoard attr passthrough; SettingsDialog row dispatch.
2. **Green** — plumb.
3. **Refactor** — none expected.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| default read | empty storage | both flags `true` |
| tolerant read | v2 payload without new keys | both `true` |
| roundtrip | set `showCardShadows:false`, reread | `false` |
| attr passthrough | FieldBoard `showZoneLabels={false}` | board has `data-zone-labels="false"` |
| label hidden css | (component) board attr false | zone label span not visible; `aria-label` unchanged |
| dialog dispatch | uncheck shadows row | `setShowCardShadows(false)` called; checkbox reflects state |
| reset | after toggles, click reset | both back `true` |

## Impl steps

- [x] 1. Red unit tests (`persisted-ui-state.test.ts` additions). Verify: focused Vitest run failed 9 tests / passed 203, exposing missing flags, attrs, and handlers.
- [x] 2. Stores: state, setters, defaults, tolerant read, persisted mirror. Verify: `npx vitest run tests/unit/persisted-ui-state.test.ts tests/unit/ui-settings-store.test.ts` passed 24 tests.
- [x] 3. Prop chain App → AcceptanceHarness → DuelFieldErrorBoundary → DuelField → FieldBoard; data attrs. Verify: DuelField component test observed `data-card-shadows="false"` and `data-zone-labels="false"`.
- [x] 4. ZoneControl label class/data-cy; CSS gate rules. Verify: component test preserved `aria-label="Your Monster Zone 1"`; `app.css` contains both attribute gates.
- [x] 5. SettingsDialog rows + handlers. Verify: `tests/component/SettingsDialog.test.ts` passed toggle dispatch, checked-state, and reset assertions.
- [x] 6. Green: `npx vitest run tests/unit/persisted-ui-state.test.ts tests/component/DuelField.test.ts tests/unit/data-cy-coverage.test.ts`. Verify: command passed 3 files / 237 tests; pre-existing CardCatalog a11y warning only.

## Validation

- [x] `npm run check:headless` — Verify: command passed; 23 legacy, 1788 unit (+2 skipped), 39 integration; vendor/assets/snapshot all ok; 2 pre-existing Svelte warnings.
- [x] `npm run build` — Verify: command passed; browser build verification reported status ok and all chunk budgets within limits.
- [ ] manual: toggle both in a live duel — shadows vanish, labels vanish, LP + counts + outlines unaffected; reload keeps choices — Verify: no E2E Input path supplied; parent must inline exact Chromium route before manual execution.
- [x] no silent-failure swallow added — `none` expected — Verify: settings diff adds no catch blocks; existing persistence best-effort path unchanged.
- [x] app functional — settings dialog opens/closes clean, reset works — Verify: SettingsDialog component tests passed reset dispatch and existing AppChrome dialog coverage.
- [ ] commit msg draft: `feat(duel): make card shadows and zone labels player-toggleable` — Verify: local commit uses exact message.
