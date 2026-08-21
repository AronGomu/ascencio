# ADR-020: Browser-Persisted Duel UI State V2

> Status: accepted; planned
> Decided: 2026-08-13
> Owners: browser preference architecture
> Commit: `41ed12b` — T9
> Supersedes: ADR-013

## Context

V1 persists deck pair + 2 floating-window positions at `ygo.ui.v1`; every setting remains memory-only. Full-height design adds zone-outline + count visibility toggles. User requires both across reloads. Other automation/chrome settings remain session-only.

## Decision

1. New key: `ygo.ui.v2`. Payload repeats `version:2`.
2. Preserve `decks`, `windows.zoneList`, `windows.confirm` branches.
3. Add only:

```ts
interface PersistedDisplaySettings {
  readonly showZoneOutlines: boolean;
  readonly showZoneCounts: boolean;
}
```

4. Both defaults = `true`.
5. Valid v2 validates every deck/window/setting leaf independently. Invalid leaf → leaf default.
6. Missing key, invalid JSON, non-object root, wrong version → complete v2 defaults.
7. Never read/migrate `ygo.ui.v1`. Version-1 payload under v2 key also yields complete v2 defaults. One-time deck/window reset is intentional.
8. Display toggle change writes immediately. Deck + window write timing remains ADR-013 behavior: decks immediate; window pointerup/reclamp.
9. Reads/writes never throw. Missing storage, `SecurityError`, quota failure keep in-memory UI functional.
10. Do not persist `showDuelHud`, `showWorkspace`, `autoPlaceCards`, `autoResolveTrivialPrompts`, dialog alphabetical/collapse/open state, z-order, preview/list scroll offsets.
11. Preference data never affects legality, projection, prompt response, duel result.

```ts
export const PERSISTED_UI_STATE_KEY = "ygo.ui.v2";

export interface PersistedUiState {
  readonly version: 2;
  readonly windows: {
    readonly zoneList: PersistedWindowPosition | null;
    readonly confirm: PersistedWindowPosition | null;
  };
  readonly decks: {
    readonly player: DeckId;
    readonly opponent: DeckId;
  };
  readonly settings: PersistedDisplaySettings;
}
```

## Consequences

- App hydrates only 2 persisted display leaves into `UiSettingsStore`.
- Paired handlers update live settings + complete persisted branch atomically from user action.
- Clearing site data resets everything to defaults without game-data loss.
- Old users lose v1 deck/window preferences once. No hidden migration ambiguity.
- Unit tests cover valid leaves, malformed leaves, legacy/wrong version, throwing storage, full writes.

## Rejected

- Keep `ygo.ui.v1` with version 2 payload → key/schema meaning diverges.
- Migrate v1 deck/window values → contradicts confirmed full-default behavior.
- Persist entire `UiSettingsState` → expands schema + violates session-only automation policy.
- IndexedDB → excessive for tiny prefs.
- One key/value each → no atomic schema boundary.
