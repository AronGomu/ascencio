import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERSISTED_UI_STATE,
  PERSISTED_UI_STATE_KEY,
  readPersistedUiState,
  writePersistedUiState,
  type PersistedUiState,
} from "../../src/app/stores/persisted-ui-state.ts";

function validState(): PersistedUiState {
  return {
    version: 1,
    windows: {
      zoneList: { x: 12, y: 34 },
      confirm: { x: 56, y: 78 },
    },
    decks: { player: "nekroz", opponent: "shaddoll" },
  };
}

describe("persisted UI state", () => {
  it("returns defaults when storage is null", () => {
    expect(readPersistedUiState(null)).toEqual(DEFAULT_PERSISTED_UI_STATE);
  });

  it("returns defaults when the key is absent", () => {
    expect(readPersistedUiState({ getItem: () => null })).toEqual(
      DEFAULT_PERSISTED_UI_STATE,
    );
  });

  it("returns defaults for unparseable JSON", () => {
    expect(readPersistedUiState({ getItem: () => "{" })).toEqual(
      DEFAULT_PERSISTED_UI_STATE,
    );
  });

  it("returns defaults for a wrong version", () => {
    expect(
      readPersistedUiState({
        getItem: () => JSON.stringify({ ...validState(), version: 2 }),
      }),
    ).toEqual(DEFAULT_PERSISTED_UI_STATE);
  });

  it("falls back per field for an unknown deck id", () => {
    const persisted = {
      ...validState(),
      decks: { player: "not-a-deck", opponent: "nekroz" },
    };
    expect(
      readPersistedUiState({ getItem: () => JSON.stringify(persisted) }).decks,
    ).toEqual({ player: "mvp-player", opponent: "nekroz" });
  });

  it("drops a window position with a non-finite coordinate", () => {
    const persisted = {
      ...validState(),
      windows: { zoneList: null, confirm: { x: 10, y: "NaN" } },
    };
    expect(
      readPersistedUiState({ getItem: () => JSON.stringify(persisted) }).windows
        .confirm,
    ).toBeNull();
  });

  it("round-trips a valid state", () => {
    let value: string | null = null;
    const storage = {
      getItem: (key: string) => (key === PERSISTED_UI_STATE_KEY ? value : null),
      setItem: (key: string, next: string) => {
        if (key === PERSISTED_UI_STATE_KEY) value = next;
      },
    };
    const state = validState();
    writePersistedUiState(state, storage);
    expect(readPersistedUiState(storage)).toEqual(state);
  });

  it("a throwing setItem does not propagate", () => {
    expect(() =>
      writePersistedUiState(validState(), {
        setItem: () => {
          throw new DOMException("Storage full", "QuotaExceededError");
        },
      }),
    ).not.toThrow();
  });
});
