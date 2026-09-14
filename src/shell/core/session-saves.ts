import type { GenerationSaveRepository } from "../../story/saves/index.ts";

/** Keep domain result unions intact while forwarding I/O failures to Shell recovery. */
export function sessionSaves(
  repository: GenerationSaveRepository,
  onerror: (error: unknown) => void,
): GenerationSaveRepository {
  const observe = <T>(promise: Promise<T>): Promise<T> =>
    promise.then(
      (value) => {
        if (
          value &&
          typeof value === "object" &&
          "kind" in value &&
          (value.kind === "failed" || value.kind === "corrupt")
        )
          onerror(new Error("APP_SAVE_MIGRATION_FAILED"));
        return value;
      },
      (error: unknown) => {
        onerror(error);
        throw error;
      },
    );
  return {
    read: (slot) => observe(repository.read(slot)),
    write: (...args) => observe(repository.write(...args)),
    list: () => observe(repository.list()),
    clear: (slot) => observe(repository.clear(slot)),
  };
}
