import {
  parseCoreBootstrap,
  type OwnedContentReader,
  type ContentResult,
  type CoreBootstrap,
  type InstalledGameplay,
} from "../../content/index.ts";
import { INSTALL_CONTENT_ROUTE, type AppRoute } from "../routes.ts";

export type CoreGate =
  | { readonly kind: "checking" }
  | {
      readonly kind: "locked";
      readonly reason:
        "content-required" | "storage-unavailable" | "content-invalid";
    }
  | {
      readonly kind: "ready";
      readonly gameplay: InstalledGameplay;
      readonly reader: OwnedContentReader | null;
      readonly generation: number;
    };

export interface CoreStartup {
  readonly bootstrap: CoreBootstrap | null;
  readonly gate: CoreGate;
}

export type CoreFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export function coreGateMessage(gate: CoreGate): string {
  if (gate.kind === "checking") return "Checking installed content…";
  if (gate.kind === "ready") return "Installed content is ready.";
  switch (gate.reason) {
    case "content-required":
      return "Content is required before Story or Free Play can start.";
    case "storage-unavailable":
      return "Browser storage is unavailable. Content cannot be verified.";
    case "content-invalid":
      return "Content configuration is invalid. Gameplay remains locked.";
  }
}

export function routeForCoreGate(route: AppRoute, gate: CoreGate): AppRoute {
  if (
    gate.kind === "ready" ||
    route.kind === "home" ||
    route.kind === "install-content"
  )
    return route;
  return INSTALL_CONTENT_ROUTE;
}

export async function loadCoreStartup(
  fetch: CoreFetch,
  appBaseUrl: string,
  indexedDB: IDBFactory | undefined,
  openReader: () => Promise<ContentResult<OwnedContentReader>> = async () => {
    const { openContentReader } =
      await import("../../content/storage/content-reader.ts");
    return openContentReader();
  },
): Promise<CoreStartup> {
  let reader: OwnedContentReader | null = null;
  let transferred = false;
  try {
    const response = await fetch(
      new URL("core-bootstrap.json", appBaseUrl).href,
      {
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
      },
    );
    if (!response.ok) throw new Error("CONTENT_INVALID_MANIFEST");
    const bootstrap = parseCoreBootstrap(await response.json(), appBaseUrl);
    if (bootstrap.delivery === null)
      return {
        bootstrap,
        gate: { kind: "locked", reason: "content-required" },
      };
    if (indexedDB === undefined)
      return {
        bootstrap,
        gate: { kind: "locked", reason: "storage-unavailable" },
      };
    const opened = await openReader();
    if (opened.kind === "failed")
      return {
        bootstrap,
        gate: {
          kind: "locked",
          reason:
            opened.code === "CONTENT_STORAGE_UNAVAILABLE"
              ? "storage-unavailable"
              : "content-invalid",
        },
      };
    reader = opened.value;
    const installed = await reader.current();
    if (installed.kind === "failed")
      return {
        bootstrap,
        gate: {
          kind: "locked",
          reason:
            installed.code === "CONTENT_MISSING"
              ? "content-required"
              : installed.code === "CONTENT_STORAGE_UNAVAILABLE"
                ? "storage-unavailable"
                : "content-invalid",
        },
      };
    if (installed.value.current === null)
      return {
        bootstrap,
        gate: { kind: "locked", reason: "content-required" },
      };
    const { loadInstalledGameplay } =
      await import("../../content/load-installed-gameplay.ts");
    const gameplay = await loadInstalledGameplay(
      opened.value,
      installed.value.current,
    );
    if (gameplay.kind === "failed")
      return {
        bootstrap,
        gate: {
          kind: "locked",
          reason:
            gameplay.code === "CONTENT_MISSING"
              ? "content-required"
              : gameplay.code === "CONTENT_STORAGE_UNAVAILABLE"
                ? "storage-unavailable"
                : "content-invalid",
        },
      };
    transferred = true;
    return {
      bootstrap,
      gate: {
        kind: "ready",
        gameplay: gameplay.value,
        reader: opened.value,
        generation: installed.value.generation,
      },
    };
  } catch {
    return {
      bootstrap: null,
      gate: { kind: "locked", reason: "content-invalid" },
    };
  } finally {
    if (!transferred) reader?.close();
  }
}
