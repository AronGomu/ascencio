import type { CardCode, CardImageVariant } from "../contracts.ts";
export interface CardImageLease {
  readonly url: string;
  subscribe?(listener: (url: string) => void): () => void;
  release(): void;
}
export interface CardImageSource {
  acquire(
    code: CardCode,
    variant: CardImageVariant,
    signal: AbortSignal,
  ): Promise<CardImageLease | null>;
}
