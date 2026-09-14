import type { CoreStartup, CoreFetch } from "../core/core-gate.ts";

export async function loadCoreStartup(
  fetch: CoreFetch,
  appBaseUrl: string,
  indexedDB: IDBFactory | undefined,
): Promise<CoreStartup> {
  const { bootstrapApplication } = await import("./application-bootstrap.ts");
  return bootstrapApplication(fetch, appBaseUrl, indexedDB);
}
