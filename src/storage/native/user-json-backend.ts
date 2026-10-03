import { invokeNative as invoke } from "./invoke.ts";
import type { StorageResult } from "../contracts/package.ts";
import type { UserJsonBackend } from "../json/user-data-store.ts";

export function nativeUserJsonBackend(): UserJsonBackend {
  let sessionId: string | null = null;
  const read = async () => {
    const opened = await invoke<{ sessionId: string; source: string | null }>(
      "native_user_json_open",
    );
    sessionId = opened.sessionId;
    return opened.source;
  };
  return {
    read,
    async write(source, expected) {
      const args = {
        sessionId,
        source,
        expectedRevision:
          expected === null
            ? 0
            : (JSON.parse(expected) as { revision: number }).revision,
      };
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await invoke<StorageResult<void>>(
            "native_user_json_commit",
            args,
          );
        } catch {
          /* Retry exact bytes/revision; native receipt makes acknowledgement idempotent. */
        }
      }
      const error = new Error("Native user save outcome is unknown");
      error.name = "UserWriteOutcomeUnknown";
      throw error;
    },
    async close() {
      if (sessionId !== null) {
        await invoke("native_user_json_close", { sessionId });
        sessionId = null;
      }
    },
  };
}
