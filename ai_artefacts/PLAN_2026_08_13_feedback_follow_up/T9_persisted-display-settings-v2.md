# T9: Persisted display settings v2

**Plan:** `./ai_artefacts/PLAN_2026_08_13_feedback_follow_up.md`
**Depends:** T8
**Commit outcome:** Zone outline/count toggles default on, affect presentation only, persist immediately under `ygo.ui.v2`; legacy v1 yields full defaults.

## Context (self-contained)

- Goal: Let users hide dashed footprints + every field count together; remember choices without persisting unrelated session settings.
- This slice: Schema/store/App/settings dialog/board attrs/CSS + reload acceptance land atomically.
- Out of scope here: persist HUD/workspace/auto settings, migration of decks/window coords, collapse/sort/scroll state, Worker/domain changes.
- Assumptions: new key `ygo.ui.v2`; old `ygo.ui.v1` ignored; v1 payload under v2 key → complete v2 defaults; display defaults both true.

## Requirements

- Add UI settings + setters: `showZoneOutlines`, `showZoneCounts`.
- Persist only these 2 under `PersistedUiState.settings`; existing deck/window branches stay.
- Valid v2 leaf validation independent. Malformed setting leaf → that leaf default; malformed root/JSON/wrong version → full defaults.
- One authoritative App flow: hydrate UI display flags from persisted store; each handler updates UI store + persisted store in same fn.
- Existing settings reset must also stay synchronized: App reset handler calls `uiSettings.reset()` then `persistedUi.setDisplaySettings(DEFAULT_PERSISTED_UI_STATE.settings)` in same fn.
- Board attrs exact `data-zone-outlines`, `data-zone-counts` strings.
- Outline false hides dashed footprint only. Counts false hides `.duel-field-stack__count` + both hand count badges. IDs, names, focus, legal/selected/drop halos remain.
- Every new settings row element gets unique `data-cy`.

## Inputs

- `src/app/stores/ui-settings-store.ts`, `persisted-ui-state.ts`, `persisted-ui-store.ts`, `src/app/App.svelte`.
- `src/app/components/SettingsDialog.svelte`, `DuelFieldErrorBoundary.svelte`, `DuelField.svelte`, `duel-field/FieldBoard.svelte`.
- `tests/unit/ui-settings-store.test.ts`, `persisted-ui-state.test.ts`, `persisted-ui-store.test.ts`; `tests/component/AppChrome.test.ts`, `DuelField.test.ts`.
- `docs/ADR/020_ADR_browser_persisted_ui_state_v2.md`.
- `ai_artefacts/manual_test_checklist.md` — append/update only T9 human checks; preserve all other sections.
- **From Depends:** FieldBoard renders square zones, stack count `.duel-field-stack__count`, hand count selectors; full shell + acceptance harness/reload scenario functional.

## Exact API

```ts
export interface PersistedDisplaySettings {
  readonly showZoneOutlines: boolean;
  readonly showZoneCounts: boolean;
}

export interface PersistedUiState {
  readonly version: 2;
  readonly windows: {
    readonly zoneList: PersistedWindowPosition | null;
    readonly confirm: PersistedWindowPosition | null;
  };
  readonly decks: { readonly player: DeckId; readonly opponent: DeckId };
  readonly settings: PersistedDisplaySettings;
}

export const PERSISTED_UI_STATE_KEY = "ygo.ui.v2";
```

`PersistedUiStore` adds:

```ts
setDisplaySettings(settings: PersistedDisplaySettings): void;
```

`UiSettingsStore` adds `setShowZoneOutlines(value)` + `setShowZoneCounts(value)`; defaults true.

Settings copy exact:

- `Show zone outlines` — `Draw the dashed square footprint of every zone.`
- `Show card counts` — `Show the number of cards in Deck, Extra Deck, GY, Banished and both hands.`

## TDD

1. **Red** — pure schema/store/default tests; component toggle isolation; Chromium localStorage+reload.
2. **Green** — schema/store/App/dialog/attrs/CSS together.
3. **Refactor** — remove v1 comments/test fixtures; do not genericize persistence.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| `defaults outlines and counts on` | UI + persisted defaults | both true |
| `sets each UI display flag independently` | setter calls | only named leaf changes; frozen state |
| `loads valid v2 leaves independently` | valid state | decks/windows/settings retained |
| `loads legacy v1 as complete defaults` | old key + v1 payload | default decks/windows/settings; no throw |
| `falls back malformed setting leaves independently` | one bad bool | bad leaf default; good leaf retained |
| `setDisplaySettings preserves decks/windows` | store call | branches unchanged; one complete write |
| `renders exact settings rows` | dialog | labels/descriptions/check state/callbacks |
| `hides only outline/count visuals` | toggles false | dashed border/counts hidden; a11y/action halos intact |
| `persists across reload` | Chromium localStorage | both remain false after page reload |
| `reset persists display defaults` | false→reset→reload | both true before + after reload; unrelated defaults restored |

## Impl steps

- [ ] 1. Rewrite persisted/UI/store unit fixtures to v2; add all red cases, including unsupported version=3.
- [ ] 2. Add `PersistedDisplaySettings`, v2 default/key/parser/writer; legacy key intentionally unread.
- [ ] 3. Add `setDisplaySettings`; preserve immutable full-state writes + storage failure swallowing.
- [ ] 4. Extend UiSettings state/defaults/store setters.
- [ ] 5. Hydrate UI display leaves from initial `$persistedUi.settings`; add paired handlers in App.
- [ ] 6. Add SettingsDialog props/rows + exact copy; wire paired App callbacks + synchronized reset handler.
- [ ] 7. Thread two flags through ErrorBoundary→DuelField→FieldBoard; add exact data attrs.
- [ ] 8. Add scoped CSS using actual `.duel-field-stack__count` + hand count classes; never hide semantic root/label.
- [ ] 9. Add component + acceptance reload tests; clear both v1/v2 keys in test cleanup.

## Outputs

- Modified stores/App/dialog/field/styles/tests/acceptance.
- Public storage key/schema exact above.
- User-visible one-time reset: old v1 deck/window prefs intentionally not migrated.

## Validation

- [ ] `npx vitest run tests/unit/ui-settings-store.test.ts tests/unit/persisted-ui-state.test.ts tests/unit/persisted-ui-store.test.ts` → exit 0.
- [ ] `npx vitest run tests/component/AppChrome.test.ts tests/component/DuelField.test.ts tests/unit/data-cy-coverage.test.ts` → exit 0.
- [ ] `npm run typecheck && npm run lint` → exit 0.
- [ ] `npx playwright test --config=playwright.acceptance.config.ts --project=chromium e2e-acceptance/full-height-field.spec.ts --grep "zone settings"` → exit 0.
- [ ] manual check — toggles leave focus/legality/zone names intact; reset via site data works.
- [ ] app functional — `npm run build` exits 0.
- [ ] commit msg draft: `feat(settings): persist field display toggles in v2`
