import type { IoCategory } from "../contracts/io-trace.ts";

function queryCategory(request: unknown): IoCategory {
  if (typeof request !== "object" || request === null) return "gameplay";
  const query = request as Record<string, unknown>;
  if (query.kind === "module-query") return queryCategory(query.query);
  if (query.kind === "scripts") return "scripts";
  if (query.kind === "config") return "config";
  if (query.kind === "set-image") return "media";
  if (query.kind === "asset")
    return query.packageId === "duel-core" &&
      ["engine/ocgcore.sync.wasm", "engine/vendor-manifest.json"].includes(
        String(query.path),
      )
      ? "engine"
      : "media";
  return "gameplay";
}

export function nativeCommandCategory(
  command: string,
  args?: Record<string, unknown> | number[] | Uint8Array | ArrayBuffer,
): IoCategory {
  if (command.startsWith("native_startup_log_")) return "diagnostics";
  if (command.startsWith("native_live_media_")) return "media";
  if (command === "native_startup_engine") return "engine";
  if (
    [
      "native_startup_close",
      "native_startup_cancel",
      "native_user_json_close",
    ].includes(command)
  )
    return "maintenance";
  if (command === "native_content_query")
    return queryCategory(args && "request" in args ? args.request : undefined);
  if (command.startsWith("native_user_json_")) return "user-data";
  if (
    [
      "native_content_status",
      "native_package_stack",
      "native_package_acquire",
    ].includes(command)
  )
    return "registry";
  if (
    command.startsWith("native_import_") ||
    [
      "native_package_remove",
      "native_package_cleanup",
      "native_package_release",
      "open_content_folder",
      "native_content_location",
      "native_critical_maintenance",
      "native_startup_repair",
      "native_mods_choose_root",
      "native_mods_import",
    ].includes(command)
  )
    return "maintenance";
  // A new command must not silently escape the critical-read gate.
  return "gameplay";
}
