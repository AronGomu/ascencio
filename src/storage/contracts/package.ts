export type PackageId =
  "duel-core" | "card-library" | "freeplay" | `chapter-${string}`;
export type PackageType = "duel-core" | "card-library" | "freeplay" | "chapter";

export interface PackageDependency {
  readonly packageId: PackageId;
  readonly requirement: "exact" | "minimum";
  readonly version: string;
}

export interface PackageManifest {
  readonly packageId: PackageId;
  readonly packageType: PackageType;
  readonly version: string;
  readonly schemaVersion: 1;
  readonly dependencies: readonly PackageDependency[];
  readonly createdAt: string;
}

export type StorageCode =
  | "SQLITE_UNAVAILABLE"
  | "APP_ALREADY_OPEN"
  | "APP_SESSION_ACTIVE"
  | "PACKAGE_INVALID"
  | "PACKAGE_SCHEMA_UNSUPPORTED"
  | "PACKAGE_DEPENDENCY_MISSING"
  | "PACKAGE_DEPENDENCY_INCOMPATIBLE"
  | "PACKAGE_DEPENDENCY_CYCLE"
  | "PACKAGE_DUPLICATE"
  | "PACKAGE_IDENTITY_CONFLICT"
  | "PACKAGE_INTEGRITY_FAILED"
  | "PACKAGE_REFERENCED"
  | "PACKAGE_NOT_FOUND"
  | "PACKAGE_SOURCE_INCOMPLETE"
  | "STORAGE_QUOTA_EXCEEDED"
  | "STORAGE_UNAVAILABLE"
  | "STORAGE_CONFLICT"
  | "OPERATION_CANCELLED"
  | "USER_DATA_INVALID"
  | "USER_DATA_TOO_LARGE"
  | "RESTORE_CONFIRMATION_REQUIRED"
  | "RPC_INVALID";

export interface StorageFailure {
  readonly code: StorageCode;
  readonly packageId?: PackageId;
  readonly requiredBy?: PackageId;
  readonly dependants?: readonly PackageId[];
  readonly path?: string;
}

export type StorageResult<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "failed"; readonly error: StorageFailure };
