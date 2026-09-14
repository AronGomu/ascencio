export function testLocks(): LockManager {
  const held = new Map<string, { shared: number; exclusive: boolean }>();
  return {
    async request(
      name: string,
      options: LockOptions,
      callback: (lock: Lock | null) => unknown,
    ) {
      const state = held.get(name) ?? { shared: 0, exclusive: false };
      held.set(name, state);
      const shared = options.mode === "shared";
      if (state.exclusive || (!shared && state.shared > 0)) {
        if (!options.ifAvailable)
          throw new Error("test lock only supports nonqueued contention");
        return await callback(null);
      }
      options.signal?.throwIfAborted();
      if (shared) state.shared++;
      else state.exclusive = true;
      try {
        return await callback({
          name,
          mode: shared ? "shared" : "exclusive",
        } as Lock);
      } finally {
        if (shared) state.shared--;
        else state.exclusive = false;
      }
    },
  } as LockManager;
}
