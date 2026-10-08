import assert from "node:assert/strict";
import test from "node:test";
import { openLocalStorage } from "../src/storage/create-storage-client.ts";

test("production storage fails closed without the native Tauri runtime", async () => {
  assert.deepEqual(await openLocalStorage(), {
    kind: "failed",
    error: { code: "STORAGE_UNAVAILABLE" },
  });
});
