import type { PersistedDisplaySettings } from "../../battle/app/stores/persisted-ui-state.ts";

/** The last pair of decks a free-play match was started with, as the two
    `SelectableDeck` keys the pickers offered. Keys rather than deck contents:
    a stored deck the player has since edited or deleted must fail to resolve
    against today's library, not duel with yesterday's forty cards. */
export interface FreePlayPairing {
  readonly player: string;
  readonly opponent: string;
}

export interface ShellSettings {
  readonly version: 3;
  /** The duel's one-time "this board is rotated" notice on a portrait phone. */
  readonly rotationNoticeDismissed: boolean;
  /** Carried over from the v2 payload so display choices survive the bump. */
  readonly display: PersistedDisplaySettings;
  /** `null` until a free-play match has been started from the match setup. */
  readonly freePlayPairing: FreePlayPairing | null;
  /** The AI opponent free play was last duelled against; `null` = the default
      persona. An id rather than a persona: which personas exist is the
      roster's question, and a renamed one must read as "none remembered". */
  readonly freePlayOpponentId: string | null;
}

const DEFAULT_DISPLAY: PersistedDisplaySettings = Object.freeze({
  showZoneOutlines: true,
  showZoneCounts: true,
  showCardShadows: true,
  showZoneLabels: true,
});

export const DEFAULT_SHELL_SETTINGS: ShellSettings = Object.freeze({
  version: 3,
  rotationNoticeDismissed: false,
  display: DEFAULT_DISPLAY,
  freePlayPairing: null,
  freePlayOpponentId: null,
});
