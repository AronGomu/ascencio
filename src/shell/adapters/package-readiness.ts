import type {
  ActivePackage,
  ModeReadiness,
  PackageId,
  PackageStack,
} from "../../storage/index.ts";

const REQUIRED = [
  "duel-core",
  "card-library",
  "freeplay",
  "chapter-01",
] as const satisfies readonly PackageId[];
const FREEPLAY_REQUIRED = REQUIRED.slice(0, 3);

export function packageReadiness(stack: PackageStack): ModeReadiness {
  const grouped = new Map<PackageId, ActivePackage[]>();
  for (const active of stack.packages) {
    const existing = grouped.get(active.packageId) ?? [];
    existing.push(active);
    grouped.set(active.packageId, existing);
  }
  const present = new Set<PackageId>();
  for (const packageId of REQUIRED) {
    const matches = grouped.get(packageId);
    if (matches?.length === 1 && validActivePackage(matches[0]!, packageId))
      present.add(packageId);
  }
  const missing = Object.freeze(
    REQUIRED.filter((packageId) => !present.has(packageId)),
  );
  const freeplay = FREEPLAY_REQUIRED.every((packageId) =>
    present.has(packageId),
  );
  return Object.freeze({
    freeplay,
    deckBuilder: freeplay,
    newGame: freeplay && present.has("chapter-01"),
    missing,
  });
}

function validActivePackage(
  active: ActivePackage,
  packageId: (typeof REQUIRED)[number],
): boolean {
  const packageType = packageId === "chapter-01" ? "chapter" : packageId;
  return (
    active.packageId === packageId &&
    active.packageType === packageType &&
    active.schemaVersion === 1 &&
    /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(active.version) &&
    typeof active.fileKey === "string" &&
    active.fileKey.length > 0 &&
    Number.isSafeInteger(active.bytes) &&
    active.bytes > 0 &&
    /^[a-f0-9]{64}$/.test(active.sha256)
  );
}
