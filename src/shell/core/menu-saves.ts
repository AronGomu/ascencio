import type { GenerationSaveRepository } from "../../story/saves/index.ts";
import type { ShellApplication } from "./shell-application.ts";

/** Menu probes must not retain repositories from a generation selected before a tab update. */
export function menuSaves(
  application: ShellApplication,
): GenerationSaveRepository {
  const run = async <T>(
    read: (repository: GenerationSaveRepository) => Promise<T>,
  ): Promise<T> => {
    const session = await application.acquire(new AbortController().signal);
    try {
      return await read(session.saves);
    } finally {
      await session.close();
    }
  };
  return {
    read: (slot) => run((repo) => repo.read(slot)),
    list: () => run((repo) => repo.list()),
    write(slot, state, expected, story) {
      let snapshot: typeof state, binding: typeof story;
      try {
        snapshot = structuredClone(state);
        binding = structuredClone(story);
      } catch {
        return Promise.resolve({ kind: "failed", reason: "unknown" });
      }
      return run((repo) => repo.write(slot, snapshot, expected, binding));
    },
    clear: (slot) => run((repo) => repo.clear(slot)),
  };
}
