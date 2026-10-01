import type { CoreStartup } from "../core/core-gate.ts";

export async function loadCoreStartup(): Promise<CoreStartup> {
  const { bootstrapApplication } = await import("./application-bootstrap.ts");
  return bootstrapApplication();
}
