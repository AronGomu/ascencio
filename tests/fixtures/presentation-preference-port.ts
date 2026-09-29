import type { AsyncPreferencePort } from "../../src/storage/index.ts";

/** Presentation only. Durable writes and failures use native SQLite tests. */
export function presentationPreferencePort<T extends object>(
  initial: T,
): AsyncPreferencePort<T> {
  let value = structuredClone(initial);
  return {
    read: async () => structuredClone(value),
    async update(patch) {
      value = { ...value, ...structuredClone(patch) };
      return { kind: "ok", value: structuredClone(value) };
    },
    flush: async () => ({ kind: "ok", value: undefined }),
  };
}
