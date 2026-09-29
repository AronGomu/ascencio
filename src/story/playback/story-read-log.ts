/* Which beats this player has read, by beat id. Deliberately not part of
   `StoryState`: the read log belongs to the reader, not to a save slot. A
   load rolls the story back, and skip still has to fast-forward everything
   that was read before the rollback — which is what a save-scoped log would
   throw away. Beat ids rather than indexes, so inserting a beat later does
   not silently mark its neighbours as read. */
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
