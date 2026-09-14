import type { ShellApplication } from "./shell-application.ts";
import type {
  ShellGameplay,
  ShellBootstrap,
  ShellSession,
} from "./installed-inputs.ts";
export { loadCoreStartup } from "../application/core-startup.ts";
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
      readonly gameplay: ShellGameplay;
      readonly reader: ShellSession | null;
      readonly generation: number;
    };

export interface CoreStartup {
  readonly application?: ShellApplication;
  readonly bootstrap: ShellBootstrap | null;
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
