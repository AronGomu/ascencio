import type {
  AsyncPreferencePort,
  StoryReadLogPort,
} from "../../src/storage/index.ts";
import {
  DEFAULT_STORY_PLAYBACK_SETTINGS,
  type StoryPlaybackSettings,
} from "../../src/story/playback/story-playback-settings.ts";

/** Presentation-only ports. Persistence and queues use native SQLite tests. */
export function storyReaderPorts(
  initial: StoryPlaybackSettings = DEFAULT_STORY_PLAYBACK_SETTINGS,
  beats: ReadonlySet<string> = new Set(),
): {
  playback: AsyncPreferencePort<StoryPlaybackSettings>;
  readLog: StoryReadLogPort;
} {
  let settings = { ...initial };
  const read = new Set(beats);
  return {
    playback: {
      read: async () => ({ ...settings }),
      update: async (patch) => {
        settings = { ...settings, ...patch };
        return { kind: "ok", value: { ...settings } };
      },
      flush: async () => ({ kind: "ok", value: undefined }),
    },
    readLog: {
      read: async () => new Set(read),
      markRead: async (id) => {
        read.add(id);
        return { kind: "ok", value: undefined };
      },
      flush: async () => ({ kind: "ok", value: undefined }),
    },
  };
}
