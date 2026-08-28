/** A card-anchored UI action that never answers a prompt: it runs locally. */
export interface LocalCardAction {
  readonly id: string;
  readonly label: string;
  readonly onSelect: () => void;
}
