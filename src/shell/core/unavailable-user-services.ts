import type { PersistedUiState } from "../../battle/ports/index.ts";
import type { StorageResult } from "../../storage/index.ts";
import type { StoryPlaybackSettings } from "../../story/playback/index.ts";
import type { ShellSettings } from "../settings/index.ts";
import type { ShellUserServices } from "./user-services.ts";

const unavailable = <T>(): Promise<StorageResult<T>> =>
  Promise.resolve({
    kind: "failed",
    error: { code: "STORAGE_UNAVAILABLE" },
  });

export function unavailableUserServicesForTests(): ShellUserServices {
  return Object.freeze({
    preferences: Object.freeze({
      shell: preference<ShellSettings>(),
      battle: preference<PersistedUiState>(),
      storyPlayback: preference<StoryPlaybackSettings>(),
      storyReadLog: Object.freeze({
        read: async () => new Set<string>(),
        markRead: unavailable,
        flush: unavailable,
      }),
    }),
    createDeckRepository: () => {
      throw new Error("USER_DATA_UNAVAILABLE");
    },
  });
}

function preference<T extends object>() {
  return Object.freeze({
    read: async () => {
      throw new Error("STORAGE_UNAVAILABLE");
    },
    update: unavailable<T>,
    flush: unavailable<void>,
  });
}
