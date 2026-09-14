import type { CardCode, CardImageVariant } from "../contracts.ts";
export interface CardImageLease {
  readonly url: string;
  release(): void;
}
export interface CardImageSource {
  acquire(
    code: CardCode,
    variant: CardImageVariant,
    signal: AbortSignal,
  ): Promise<CardImageLease | null>;
}
