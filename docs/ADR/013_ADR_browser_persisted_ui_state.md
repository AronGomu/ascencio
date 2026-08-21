# ADR-013: Browser-Persisted Duel UI State

> Status: superseded by [`ADR-020`](020_ADR_browser_persisted_ui_state_v2.md)
> Decided: 2026-08-10
> Superseded: 2026-08-13
> Owners: browser UI state architecture
> Commit: `5eac0b5` — T3, T14

## Context

Runtime snapshots use IndexedDB/Cache Storage. Round-2 interaction settings are intentionally memory-only under ADR-009. Round 3 needs only the chosen deck pair plus independent positions for zone-list and confirm windows across reloads.

## Decision

1. Use `localStorage` key `ygo.ui.v1`.
2. Payload repeats `version:1`; key version separates future schemas, payload version rejects copied/malformed data.
3. Persist only deck pair and two window top-left positions.
4. Coordinates are CSS pixels local to the visible duel-field boundary. ADR-017 clamps them after measurement/resize.
5. Missing key, invalid JSON, non-object root or wrong version yields full defaults.
6. Unknown deck id falls back independently for that field. Invalid/nonfinite window position falls back independently to `null`.
7. Reads and writes never throw. Missing storage, `SecurityError` or quota failure leaves in-memory state functional.
8. Deck selection writes immediately. Window dragging writes final clamped position on pointerup; a later resize writes only a changed clamp.
9. No migration, expiry, cross-tab sync or persistence of ADR-009 settings.

```ts
export const PERSISTED_UI_STATE_KEY = "ygo.ui.v1";

export interface PersistedUiState {
  readonly version: 1;
  readonly windows: {
    readonly zoneList: { readonly x: number; readonly y: number } | null;
    readonly confirm: { readonly x: number; readonly y: number } | null;
  };
  readonly decks: {
    readonly player: DeckId;
    readonly opponent: DeckId;
  };
}
```

## Alternatives rejected

- **IndexedDB.** Excess async/transaction machinery for one tiny preference object.
- **One key per value.** No atomic schema/version boundary.
- **Persist every UI setting.** Contradicts ADR-009 session-setting choice and expands migration work.
- **Viewport-relative positions.** Windows are constrained by field, not browser; field-local px plus clamp is explicit.
- **Normalised coordinates.** Harder to reason about measured window bounds and not needed for two clamped windows.

## Consequences

- Storage is preference-only, never duel authority.
- Corruption/privacy-mode storage failures are nonfatal and unit-testable with small stubs.
- Old coordinates may be stale after layout changes; ADR-017 clamp is mandatory.
- Clearing site data resets pair/positions to starter/default centre with no game-data loss.
