import type { CriticalRelease } from "../contracts/critical-snapshot.ts";

export interface PreparedContentDescriptor {
  readonly sessionId: string;
  readonly generation: number;
  readonly metadataBytes: number;
  readonly metadataSha256: string;
  readonly engineBytes: number;
  readonly engineSha256: string;
  readonly vendorManifest: string;
  readonly packages: readonly Pick<
    CriticalRelease["packages"][number],
    "packageId" | "version" | "bytes" | "sha256"
  >[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function boundedSize(value: unknown, maximum: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= maximum
  );
}
function hash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

/** Both native IPC receipts and development HTTP descriptors enter here. */
export function parseContentDescriptor(
  value: unknown,
): PreparedContentDescriptor {
  if (
    !isRecord(value) ||
    typeof value.sessionId !== "string" ||
    !/^[a-zA-Z0-9-]{1,64}$/.test(value.sessionId) ||
    typeof value.generation !== "number" ||
    !Number.isSafeInteger(value.generation) ||
    value.generation < 0 ||
    !boundedSize(value.metadataBytes, 256 * 1024 * 1024) ||
    !boundedSize(value.engineBytes, 16 * 1024 * 1024) ||
    !hash(value.metadataSha256) ||
    !hash(value.engineSha256) ||
    typeof value.vendorManifest !== "string" ||
    value.vendorManifest.length > 256 * 1024 ||
    !Array.isArray(value.packages) ||
    value.packages.length === 0 ||
    value.packages.length > 64
  )
    throw new Error("STARTUP_DESCRIPTOR_INVALID");
  const packages = value.packages.map((pack: unknown) => {
    if (
      !isRecord(pack) ||
      typeof pack.packageId !== "string" ||
      !/^[a-z][a-z0-9-]{0,63}$/.test(pack.packageId) ||
      typeof pack.version !== "string" ||
      pack.version.length > 64 ||
      !boundedSize(pack.bytes, 128 * 1024 * 1024) ||
      !hash(pack.sha256)
    )
      throw new Error("STARTUP_DESCRIPTOR_INVALID");
    return {
      packageId: pack.packageId,
      version: pack.version,
      bytes: pack.bytes,
      sha256: pack.sha256,
    };
  });
  if (
    new Set(packages.map((pack) => pack.packageId)).size !== packages.length ||
    packages.reduce((total, pack) => total + pack.bytes, 0) > 256 * 1024 * 1024
  )
    throw new Error("STARTUP_DESCRIPTOR_INVALID");
  return {
    sessionId: value.sessionId,
    generation: value.generation,
    metadataBytes: value.metadataBytes,
    metadataSha256: value.metadataSha256,
    engineBytes: value.engineBytes,
    engineSha256: value.engineSha256,
    vendorManifest: value.vendorManifest,
    packages,
  };
}
