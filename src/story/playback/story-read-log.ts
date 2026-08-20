/* Which beats this player has read, by beat id. Deliberately not part of
   `StoryState`: the read log belongs to the reader, not to a save slot. A
   load rolls the story back, and skip still has to fast-forward everything
   that was read before the rollback — which is what a save-scoped log would
   throw away. Beat ids rather than indexes, so inserting a beat later does
   not silently mark its neighbours as read. */
export const STORY_READ_LOG_KEY = "ygo.story.read.v1";

interface StoredReadLog {
  readonly version: 1;
  readonly beats: readonly string[];
}

export function readStoryReadLog(
  storage: Pick<Storage, "getItem"> | null = defaultStorage(),
): ReadonlySet<string> {
  if (storage === null) return new Set<string>();
  try {
    const serialized = storage.getItem(STORY_READ_LOG_KEY);
    if (serialized === null) return new Set<string>();
    const parsed: unknown = JSON.parse(serialized);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as StoredReadLog).version !== 1 ||
      !Array.isArray((parsed as StoredReadLog).beats)
    )
      return new Set<string>();
    return new Set(
      (parsed as StoredReadLog).beats.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
    );
  } catch {
    /* An unreadable log costs the player fast-forward, never the session. */
    return new Set<string>();
  }
}

/** The log with one more beat in it. Returns a new set rather than mutating
    the one it was handed, so the caller can treat the log as a value it can
    reassign and compare. */
export function withBeatRead(
  beats: ReadonlySet<string>,
  id: string,
): ReadonlySet<string> {
  if (beats.has(id)) return beats;
  const next = new Set(beats);
  next.add(id);
  return next;
}

export function writeStoryReadLog(
  beats: ReadonlySet<string>,
  storage: Pick<Storage, "setItem"> | null = defaultStorage(),
): void {
  if (storage === null) return;
  try {
    const payload: StoredReadLog = { version: 1, beats: [...beats] };
    storage.setItem(STORY_READ_LOG_KEY, JSON.stringify(payload));
  } catch {
    // Best-effort: storage that refuses the log never interrupts reading.
  }
}

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
