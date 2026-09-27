import type { ShellApplication } from "./sqlite-sessions.ts";
import type { AppUpdateController } from "../application/app-update-controller.ts";
import type { SqliteApplicationStatus } from "../application/sqlite-application-service.ts";
import type { PackageId } from "../../storage/index.ts";
export { loadCoreStartup } from "../application/core-startup.ts";
import { INSTALL_CONTENT_ROUTE, type AppRoute } from "../routes.ts";
import type { UserPersistenceOwner } from "../application/user-persistence-owner.ts";

export type CoreGate =
  | { readonly kind: "checking" }
  | {
      readonly kind: "locked";
      readonly reason:
        "content-required" | "storage-unavailable" | "content-invalid";
      readonly missing?: readonly PackageId[];
    }
  | {
      readonly kind: "ready";
      readonly generation: number;
      readonly missing?: readonly PackageId[];
    };

export interface CoreStartup {
  readonly application?: ShellApplication;
  readonly appUpdates?: AppUpdateController;
  readonly userPersistence?: UserPersistenceOwner;
  readonly applicationStatus?: SqliteApplicationStatus;
  readonly subscribeApplicationStatus?: (
    listener: (status: SqliteApplicationStatus) => void,
  ) => () => void;
  readonly dispose?: () => Promise<void>;
  readonly gate: CoreGate;
}

export type CoreFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export function coreGateMessage(gate: CoreGate): string {
  if (gate.kind === "checking") return "Checking installed content…";
  if (gate.kind === "ready")
    return (gate.missing ?? []).includes("chapter-01")
      ? "Free Play and Deck Builder are ready. New Game requires chapter-01."
      : "Free Play, Deck Builder, and New Game are ready.";
  switch (gate.reason) {
    case "content-required":
      return gate.missing !== undefined && gate.missing.length > 0
        ? `Free Play needs these packages in order: ${gate.missing.join(", ")}.`
        : "Content is required before Free Play can start.";
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
