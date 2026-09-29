import type {
  PackageId,
  StorageFailure,
  StorageResult,
} from "../contracts/package.ts";

export function isQuota(value: unknown): boolean {
  return (
    value instanceof Error &&
    (value.name === "QuotaExceededError" ||
      /SQLITE_FULL|quota/i.test(value.message))
  );
}
export function packageDatabaseFailure(
  error: unknown,
  packageId?: PackageId,
): StorageResult<never> {
  const details = packageId ? { packageId } : {};
  if (error instanceof Error && error.name === "AbortError")
    return failed("OPERATION_CANCELLED");
  const native = error as {
    resultCode?: unknown;
    errcode?: unknown;
    code?: unknown;
  } | null;
  const resultCode = native?.resultCode ?? native?.errcode;
  const primary =
    typeof resultCode === "number" ? resultCode & 0xff : undefined;
  if (primary === 13 || native?.code === "SQLITE_FULL" || isQuota(error))
    return failed("STORAGE_QUOTA_EXCEEDED", details);
  // Known non-corruption failures must not accuse package bytes of corruption.
  if (
    (primary !== undefined &&
      [3, 5, 6, 7, 8, 9, 10, 14, 23].includes(primary)) ||
    (typeof native?.code === "string" &&
      /^(?:SQLITE_(?:IOERR|CANTOPEN|READONLY|BUSY|LOCKED|NOMEM|PERM|AUTH)(?:_.*)?|EACCES|EPERM|ENOENT|EIO)$/.test(
        native.code,
      ))
  )
    return failed("STORAGE_UNAVAILABLE", details);
  return failed("PACKAGE_INTEGRITY_FAILED", details);
}

export function userDatabaseFailure(error: unknown): StorageResult<never> {
  if (error instanceof Error && error.name === "AbortError")
    return failed("OPERATION_CANCELLED");
  const native = error as {
    resultCode?: unknown;
    errcode?: unknown;
    code?: unknown;
  } | null;
  const resultCode = native?.resultCode ?? native?.errcode;
  const primary =
    typeof resultCode === "number" ? resultCode & 0xff : undefined;
  if (primary === 13 || native?.code === "SQLITE_FULL" || isQuota(error))
    return failed("STORAGE_QUOTA_EXCEEDED");
  if (
    (primary !== undefined &&
      [3, 5, 6, 7, 8, 9, 10, 14, 23].includes(primary)) ||
    (typeof native?.code === "string" &&
      /^(?:SQLITE_(?:IOERR|CANTOPEN|READONLY|BUSY|LOCKED|NOMEM|PERM|AUTH)(?:_.*)?|EACCES|EPERM|ENOENT|EIO)$/.test(
        native.code,
      ))
  )
    return failed("STORAGE_UNAVAILABLE");
  return failed("USER_DATA_INVALID");
}
function failed(
  code: StorageFailure["code"],
  details: Omit<StorageFailure, "code"> = {},
): StorageResult<never> {
  return { kind: "failed", error: { code, ...details } };
}
