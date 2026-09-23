import type { GenerationSaveRepository } from "../../story/saves/index.ts";

/** Quota refusals stay retryable in-domain; fatal I/O failures reach Shell recovery. */
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
          (value.kind === "corrupt" ||
            (value.kind === "failed" &&
              !("reason" in value && value.reason === "quota")))
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
