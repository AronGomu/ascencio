import type { Sha256 } from "./identity.ts";

export type AssetFailureCode =
  | "ASSET_ARGUMENT_INVALID"
  | "ASSET_CONFIG_INVALID"
  | "ASSET_PATH_UNSAFE"
  | "ASSET_PROFILE_CONFLICT"
  | "ASSET_REFERENCE_MISSING"
  | "ASSET_SOURCE_CHANGED"
  | "ASSET_LIMIT_EXCEEDED"
  | "ASSET_NETWORK_FAILED"
  | "ASSET_REVISION_UNAVAILABLE"
  | "ASSET_INTEGRITY_FAILED"
  | "ASSET_LOCAL_CONFLICT"
  | "ASSET_LAYOUT_INCOMPATIBLE"
  | "ASSET_BUSY"
  | "ASSET_DISK_FULL"
  | "ASSET_RECOVERY_REQUIRED";
export interface AssetFailure {
  readonly status: "failed";
  readonly code: AssetFailureCode;
  readonly path: string | null;
}
export interface AssetSuccess {
  readonly status: "ok";
  readonly operation: "scan" | "check" | "promote" | "migrate";
  readonly snapshotSha256: Sha256 | null;
}
export type AssetResult = AssetSuccess | AssetFailure;
