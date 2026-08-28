export type DeckSelectMode = "duel-start" | "library";
export type DeckSelectScope = "free-play" | "story";
export type DeckSort = "modified" | "name";

export interface DeckCounts {
  readonly main: number;
  readonly extra: number;
  readonly side: number;
}

/** One deck as any grid/list/seat renders it. Pure view model — hosts map
    domain records into this; deck-select never reads storage. */
export interface DeckTileModel {
  /** Stable id, unique per rendered document; data-cy suffix. */
  readonly key: string;
  readonly name: string;
  readonly counts: DeckCounts;
  /** Meta line: "Updated <date>" | "Bundled" | block reason for illegal. */
  readonly meta: string;
  readonly coverImageUrl: string | null;
  readonly legal: boolean;
  /** Why illegal; null when legal. */
  readonly blockReason: string | null;
  readonly bundled: boolean;
  /** AI owner name → 🔒 badge + never deletable; null otherwise. */
  readonly lockedBy: string | null;
  readonly favourite: boolean;
  readonly isDefault: boolean;
  readonly deletable: boolean;
  /** ISO timestamp for "modified" sort; null sorts last within its rank. */
  readonly updatedAt: string | null;
}

export interface DecklistRow {
  readonly code: number;
  readonly name: string;
}

export interface DecklistView {
  readonly main: readonly DecklistRow[];
  readonly extra: readonly DecklistRow[];
  readonly side: readonly DecklistRow[];
}

export interface OpponentView {
  readonly id: string;
  readonly name: string;
  /** One-line tagline under the name. */
  readonly line: string;
  /** Story: true → portrait not a control, deck card shows "🔒 Set by the story". */
  readonly locked: boolean;
}
