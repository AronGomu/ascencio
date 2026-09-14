import type { Cards } from "../../cards/index.ts";
import type { CardImageSource } from "../../cards/images/index.ts";
import type { GenerationSaveRepository } from "../../story/saves/index.ts";
import type { StoryRelease, StoryMedia } from "../../story/ports/index.ts";
import type { ShellGameplay } from "./installed-inputs.ts";

export interface ShellDomainSession {
  readonly generation: number;
  readonly gameplay: ShellGameplay;
  readonly storyRelease: StoryRelease;
  readonly storyCards: Cards;
  readonly storyMedia: StoryMedia;
  readonly images: CardImageSource;
  readonly saves: GenerationSaveRepository;
  close(): Promise<void>;
}
export interface ShellApplication {
  acquire(signal: AbortSignal): Promise<ShellDomainSession>;
  clear(): void;
  close(): void;
  subscribe(listener: () => void): () => void;
}
