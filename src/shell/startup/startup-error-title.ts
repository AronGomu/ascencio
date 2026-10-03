import type { StartupDiagnostic } from "../../storage/index.ts";

/** Detailed codes and source locations remain in the log and copied error. */
export function startupErrorTitle(diagnostic: StartupDiagnostic): string {
  if (diagnostic.code.startsWith("BASE_"))
    return "Game content verification failed";
  if (diagnostic.code.startsWith("ENGINE_"))
    return "Duel engine could not be loaded";
  if (diagnostic.code.startsWith("MOD_")) return "Mod could not be loaded";
  if (
    diagnostic.code.startsWith("USER_DATA_") ||
    diagnostic.code.startsWith("USER_SAVE_")
  )
    return "Saved data could not be loaded";
  if (diagnostic.code === "APP_ALREADY_OPEN")
    return "Application is already open";
  if (diagnostic.code === "OPERATION_CANCELLED") return "Startup interrupted";
  return "Startup preparation failed";
}
