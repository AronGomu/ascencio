import type {
  PackageDependency,
  PackageId,
  PackageManifest,
  PackageType,
  StorageFailure,
  StorageResult,
} from "../contracts/package.ts";

const MANIFEST_KEYS = [
  "packageId",
  "packageType",
  "version",
  "schemaVersion",
  "dependencies",
  "createdAt",
] as const;
const DEPENDENCY_KEYS = ["packageId", "requirement", "version"] as const;
const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const CHAPTER_ID = /^chapter-(0[1-9]|[1-9][0-9]+)$/;

export function parsePackageManifest(
  value: unknown,
): StorageResult<PackageManifest> {
  if (!exactRecord(value, MANIFEST_KEYS)) return invalid();
  const packageId = parsePackageId(value.packageId);
  const packageType = parsePackageType(value.packageType);
  const version = parseVersion(value.version);
  if (
    packageId === null ||
    packageType === null ||
    version === null ||
    value.schemaVersion !== 1 ||
    !validTimestamp(value.createdAt) ||
    !denseArray(value.dependencies)
  )
    return invalid();
  if (typeFor(packageId) !== packageType) return invalid();

  const dependencies: PackageDependency[] = [];
  for (const dependency of value.dependencies) {
    if (!exactRecord(dependency, DEPENDENCY_KEYS)) return invalid();
    const dependencyId = parsePackageId(dependency.packageId);
    const dependencyVersion = parseVersion(dependency.version);
    if (
      dependencyId === null ||
      dependencyVersion === null ||
      (dependency.requirement !== "exact" &&
        dependency.requirement !== "minimum") ||
      dependencyId === packageId
    )
      return invalid();
    dependencies.push({
      packageId: dependencyId,
      requirement: dependency.requirement,
      version: dependencyVersion,
    });
  }
  const ids = dependencies.map(({ packageId }) => packageId);
  if (new Set(ids).size !== ids.length || !lexicallySorted(ids))
    return invalid();
  if (!validDependencyShape(packageId, dependencies)) return invalid();

  return {
    kind: "ok",
    value: Object.freeze({
      packageId,
      packageType,
      version,
      schemaVersion: 1,
      dependencies: Object.freeze(
        dependencies.map((dependency) => Object.freeze(dependency)),
      ),
      createdAt: value.createdAt,
    }),
  };
}

export function orderPackages(
  selected: readonly PackageManifest[],
  installed: readonly PackageManifest[],
): StorageResult<readonly PackageManifest[]> {
  const selectedIds = selected.map(({ packageId }) => packageId);
  const installedIds = installed.map(({ packageId }) => packageId);
  if (
    new Set(selectedIds).size !== selectedIds.length ||
    new Set(installedIds).size !== installedIds.length
  )
    return failed("PACKAGE_DUPLICATE");

  const rawCandidate = new Map(installed.map((item) => [item.packageId, item]));
  for (const item of selected) rawCandidate.set(item.packageId, item);
  if (hasCycle(rawCandidate)) return failed("PACKAGE_DEPENDENCY_CYCLE");

  const parsedSelected = parseAll(selected);
  if (parsedSelected.kind === "failed") return parsedSelected;
  const parsedInstalled = parseAll(installed);
  if (parsedInstalled.kind === "failed") return parsedInstalled;

  const candidate = new Map(
    parsedInstalled.value.map((item) => [item.packageId, item]),
  );
  for (const item of parsedSelected.value) candidate.set(item.packageId, item);

  for (const manifest of [...candidate.values()].sort(comparePackage)) {
    for (const dependency of manifest.dependencies) {
      const resolved = candidate.get(dependency.packageId);
      if (resolved === undefined)
        return {
          kind: "failed",
          error: {
            code: "PACKAGE_DEPENDENCY_MISSING",
            packageId: dependency.packageId,
            requiredBy: manifest.packageId,
          },
        };
      if (!compatible(resolved.version, dependency))
        return {
          kind: "failed",
          error: {
            code: "PACKAGE_DEPENDENCY_INCOMPATIBLE",
            packageId: dependency.packageId,
            requiredBy: manifest.packageId,
          },
        };
    }
  }

  return {
    kind: "ok",
    value: Object.freeze([...parsedSelected.value].sort(comparePackage)),
  };
}

function parseAll(
  manifests: readonly PackageManifest[],
): StorageResult<readonly PackageManifest[]> {
  const parsed: PackageManifest[] = [];
  for (const manifest of manifests) {
    const result = parsePackageManifest(manifest);
    if (result.kind === "failed") return result;
    parsed.push(result.value);
  }
  return { kind: "ok", value: parsed };
}

function validDependencyShape(
  packageId: PackageId,
  dependencies: readonly PackageDependency[],
): boolean {
  const rank = packageRank(packageId);
  if (rank === null) return false;
  if (
    dependencies.some(({ packageId: id }) => {
      const dependencyRank = packageRank(id);
      return dependencyRank === null || dependencyRank >= rank;
    })
  )
    return false;
  const required = predecessorOf(packageId);
  if (required === null) return dependencies.length === 0;
  return dependencies.some(({ packageId: id }) => id === required);
}

function predecessorOf(packageId: PackageId): PackageId | null {
  if (packageId === "duel-core") return null;
  if (packageId === "card-library") return "duel-core";
  if (packageId === "freeplay") return "card-library";
  const chapter = chapterNumber(packageId);
  if (chapter === null) return null;
  if (chapter === 1) return "freeplay";
  return `chapter-${String(chapter - 1).padStart(2, "0")}`;
}

function hasCycle(candidate: ReadonlyMap<PackageId, PackageManifest>): boolean {
  const visiting = new Set<PackageId>();
  const visited = new Set<PackageId>();
  const visit = (packageId: PackageId): boolean => {
    if (visiting.has(packageId)) return true;
    if (visited.has(packageId)) return false;
    visiting.add(packageId);
    const manifest = candidate.get(packageId);
    for (const dependency of manifest?.dependencies ?? [])
      if (candidate.has(dependency.packageId) && visit(dependency.packageId))
        return true;
    visiting.delete(packageId);
    visited.add(packageId);
    return false;
  };
  return [...candidate.keys()].some(visit);
}

function compatible(actual: string, dependency: PackageDependency): boolean {
  return dependency.requirement === "exact"
    ? actual === dependency.version
    : compareVersion(actual, dependency.version) >= 0;
}

function compareVersion(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index]! - rightParts[index]!;
    if (difference !== 0) return difference;
  }
  return 0;
}

function comparePackage(left: PackageManifest, right: PackageManifest): number {
  return packageRank(left.packageId)! - packageRank(right.packageId)!;
}

function packageRank(packageId: PackageId): number | null {
  if (packageId === "duel-core") return 0;
  if (packageId === "card-library") return 1;
  if (packageId === "freeplay") return 2;
  const chapter = chapterNumber(packageId);
  return chapter === null ? null : chapter + 2;
}

function chapterNumber(packageId: string): number | null {
  const match = CHAPTER_ID.exec(packageId);
  if (match === null) return null;
  const chapter = Number(match[1]);
  return Number.isSafeInteger(chapter) ? chapter : null;
}

function parsePackageId(value: unknown): PackageId | null {
  if (value === "duel-core" || value === "card-library" || value === "freeplay")
    return value;
  return typeof value === "string" && chapterNumber(value) !== null
    ? (value as PackageId)
    : null;
}

function parsePackageType(value: unknown): PackageType | null {
  return value === "duel-core" ||
    value === "card-library" ||
    value === "freeplay" ||
    value === "chapter"
    ? value
    : null;
}

function typeFor(packageId: PackageId): PackageType {
  if (packageId === "duel-core") return "duel-core";
  if (packageId === "card-library") return "card-library";
  if (packageId === "freeplay") return "freeplay";
  return "chapter";
}

function parseVersion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = VERSION.exec(value);
  if (match === null) return null;
  return match.slice(1).every((part) => Number.isSafeInteger(Number(part)))
    ? value
    : null;
}

function validTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date.toISOString() === value;
}

function exactRecord<K extends string>(
  value: unknown,
  keys: readonly K[],
): value is Record<K, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const own = Object.keys(value);
  return (
    own.length === keys.length && own.every((key) => keys.includes(key as K))
  );
}

function denseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1)
    if (!Object.hasOwn(value, index)) return false;
  return true;
}

function lexicallySorted(values: readonly string[]): boolean {
  for (let index = 1; index < values.length; index += 1)
    if (values[index - 1]! >= values[index]!) return false;
  return true;
}

function invalid(): StorageResult<never> {
  return failed("PACKAGE_INVALID");
}
function failed(code: StorageFailure["code"]): StorageResult<never> {
  return { kind: "failed", error: { code } };
}
