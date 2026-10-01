import { invoke } from "@tauri-apps/api/core";
import type { StorageResult } from "../contracts/package.ts";
import type { UserJsonBackend } from "../json/user-data-store.ts";

export function nativeUserJsonBackend(): UserJsonBackend {
  const read = () => invoke<string | null>("native_user_json_read");
  return {
    read,
    async write(source, expected) {
      try {
        return await invoke<StorageResult<void>>("native_user_json_write", {
          source,
          expected,
        });
      } catch {
        // A lost reply can follow a completed rename. Check before reporting failure.
        try {
          const current = await read();
          if (current === source) return { kind: "ok", value: undefined };
          if (current === expected)
            return { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } };
        } catch {
          /* Retain the uncertain write outcome below. */
        }
        const error = new Error("Native user save outcome is unknown");
        error.name = "UserWriteOutcomeUnknown";
        throw error;
      }
    },
  };
}
