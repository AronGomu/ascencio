import type { PersistedUiState } from "../../battle/ports/index.ts";
import type { DeckRepository } from "../../decks/repository/index.ts";
import type {
  AsyncPreferencePort,
  StoryReadLogPort,
} from "../../storage/index.ts";
import type { StoryPlaybackSettings } from "../../story/playback/index.ts";
import type { ShellSettings } from "../settings/index.ts";

export interface UserPreferencePorts {
  readonly shell: AsyncPreferencePort<ShellSettings>;
  readonly battle: AsyncPreferencePort<PersistedUiState>;
  readonly storyPlayback: AsyncPreferencePort<StoryPlaybackSettings>;
  readonly storyReadLog: StoryReadLogPort;
}
export interface ShellUserServices {
  readonly preferences: UserPreferencePorts;
  createDeckRepository(): DeckRepository;
}
