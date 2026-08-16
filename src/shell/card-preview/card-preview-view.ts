/** What the shared preview panel renders. Battle's branded `CardCode` narrows
    to `number`, so the duel keeps its brand while the deck editor — which has
    no duel vocabulary — passes a plain code. */
export interface CardPreviewView {
  readonly code: number;
  readonly name: string;
  readonly description: string;
}

/** Anything that can lease an object URL for a card code. The duel's
    `CardImageLibrary` satisfies it; a domain without an image cache passes
    `null` and uses `staticImageUrl` instead. */
export interface CardPreviewImageSource {
  lease(code: number): { readonly url: string; release(): void };
}
