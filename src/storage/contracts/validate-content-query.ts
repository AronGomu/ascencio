import type { ContentQuery } from "./storage-client.ts";
import type { PackageId } from "./package.ts";
import { validAssetPath } from "../schema/package-database.ts";

export function validQuery(value: unknown): value is ContentQuery {
  if (!plain(value) || typeof value.kind !== "string") return false;
  switch (value.kind) {
    case "module-query":
      return (
        exact(value, ["kind", "packageId", "query"]) &&
        typeof value.packageId === "string" &&
        (value.packageId === "card-library" ||
          /^card-pack-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.packageId)) &&
        plain(value.query) &&
        ["cards", "scripts", "sets", "set-image"].includes(
          String(value.query.kind),
        ) &&
        validQuery(value.query)
      );
    case "cards":
      return (
        exact(value, ["kind", "locale", "afterCode", "limit"]) &&
        validLocale(value.locale) &&
        safeNonnegative(value.afterCode) &&
        integerBetween(value.limit, 1, 500)
      );
    case "card-search":
      return (
        exact(value, ["kind", "locale", "prefix", "limit"]) &&
        validLocale(value.locale) &&
        typeof value.prefix === "string" &&
        value.prefix.length <= 256 &&
        integerBetween(value.limit, 1, 100)
      );
    case "config":
      return (
        exact(value, ["kind", "packageId"]) && validPackageId(value.packageId)
      );
    case "decks":
    case "opponents":
    case "limits":
      return (
        exact(value, ["kind", "packageId"]) &&
        validPlayPackageId(value.packageId)
      );
    case "scripts":
      return (
        exact(value, ["kind", "afterName", "limit"]) &&
        typeof value.afterName === "string" &&
        value.afterName.length <= 1024 &&
        integerBetween(value.limit, 1, 500)
      );
    case "sets":
      return (
        exact(value, ["kind", "packageId"]) &&
        value.packageId === "card-library"
      );
    case "story":
      return (
        exact(value, ["kind", "packageId", "contentId"]) &&
        validChapterPackageId(value.packageId) &&
        nonemptyBounded(value.contentId, 256)
      );
    case "asset":
      return (
        exact(value, ["kind", "packageId", "path"]) &&
        validPackageId(value.packageId) &&
        validAssetPath(value.path)
      );
    case "set-image":
      return (
        exact(value, ["kind", "setId"]) && nonemptyBounded(value.setId, 256)
      );
    default:
      return false;
  }
}

function validPackageId(value: unknown): value is PackageId {
  return (
    value === "duel-core" ||
    value === "card-library" ||
    (typeof value === "string" &&
      value.length <= 128 &&
      /^card-pack-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) ||
    validPlayPackageId(value)
  );
}
function validPlayPackageId(
  value: unknown,
): value is "freeplay" | `chapter-${string}` {
  return value === "freeplay" || validChapterPackageId(value);
}
function validChapterPackageId(value: unknown): value is `chapter-${string}` {
  return (
    typeof value === "string" && /^chapter-(?:0[1-9]|[1-9][0-9]+)$/.test(value)
  );
}
function validLocale(value: unknown): boolean {
  return nonemptyBounded(value, 64);
}
function nonemptyBounded(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= maximum
  );
}
function safeNonnegative(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
function integerBetween(
  value: unknown,
  minimum: number,
  maximum: number,
): boolean {
  return (
    Number.isSafeInteger(value) &&
    Number(value) >= minimum &&
    Number(value) <= maximum
  );
}
function plain(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exact(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}
