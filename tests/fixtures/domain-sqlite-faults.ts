/// <reference lib="webworker" />
import { openBrowserSqliteRuntime as openProductionRuntime } from "../../src/storage/runtime/browser-sqlite.ts";
import type { RuntimeDatabase } from "../../src/storage/runtime/runtime-ports.ts";

const slots = new Set([
  "manual:1",
  "manual:2",
  "manual:3",
  "autosave",
  "checkpoint:pre-duel",
]);
let database: RuntimeDatabase | null = null;
let failDeckWrite = false;
self.addEventListener("message", (event: MessageEvent) => {
  if (!event.data?.domainFixtureFault || event.ports.length !== 1) return;
  event.stopImmediatePropagation();
  const port = event.ports[0]!;
  try {
    if (database === null) throw new Error("Fixture database not ready");
    const operation = event.data.domainFixtureFault;
    if (operation.kind === "snapshot-story") {
      port.postMessage({
        value: database.all(
          "SELECT record_key AS slot, revision, payload_json AS payload FROM user_records WHERE namespace='story' ORDER BY record_key",
        ),
      });
      return;
    }
    if (operation.kind === "fail-deck-write") {
      failDeckWrite = true;
    } else if (
      (operation.kind === "corrupt-story" ||
        operation.kind === "clear-story") &&
      slots.has(operation.slot)
    ) {
      if (operation.kind === "clear-story") {
        database.run(
          "DELETE FROM user_records WHERE namespace='story' AND record_key=?",
          [operation.slot],
        );
      } else {
        if (typeof operation.value !== "string")
          throw new Error("Fixture corruption must be malformed text");
        database.run(
          "INSERT INTO user_records VALUES ('story', ?, 1, ?) ON CONFLICT(namespace, record_key) DO UPDATE SET payload_json=excluded.payload_json",
          [operation.slot, JSON.stringify(operation.value)],
        );
      }
    } else {
      throw new Error("Unknown fixture fault operation");
    }
    port.postMessage({ value: null });
  } catch (error) {
    port.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    port.close();
  }
});

/** Fixed test operations on the actual production user DB. No SQL/RPC backdoor. */
export async function openBrowserSqliteRuntime() {
  const opened = await openProductionRuntime();
  if (opened.kind === "failed" || opened.value.userData.kind === "failed")
    return opened;
  const current = opened.value.userData.value;
  database = current;
  const wrapped: RuntimeDatabase = {
    ...current,
    run(sql, parameters = []) {
      if (
        failDeckWrite &&
        sql.startsWith("INSERT INTO user_records") &&
        parameters[0] === "decks"
      ) {
        failDeckWrite = false;
        throw Object.assign(new Error("Fixture SQLite write failure"), {
          code: "SQLITE_IOERR",
        });
      }
      return current.run(sql, parameters);
    },
  };

  return {
    kind: "ok" as const,
    value: {
      ...opened.value,
      userData: { kind: "ok" as const, value: wrapped },
    },
  };
}
