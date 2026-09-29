import { describe, expect, it } from "vitest";
import { packageReadiness } from "../../../src/shell/adapters/package-readiness.ts";
import type {
  ActivePackage,
  PackageId,
  PackageStack,
} from "../../../src/storage/index.ts";

function active(packageId: PackageId): ActivePackage {
  const packageType = packageId.startsWith("chapter-") ? "chapter" : packageId;
  return {
    packageId,
    packageType,
    version: "1.0.0",
    schemaVersion: 1,
    dependencies: [],
    createdAt: "2026-09-24T00:00:00.000Z",
    fileKey: `/imports/${packageId}.sqlite`,
    bytes: 1024,
    sha256: "a".repeat(64),
  } as ActivePackage;
}

function stack(...packageIds: PackageId[]): PackageStack {
  return { generation: 3, packages: packageIds.map(active) };
}

const firstThree = [
  "duel-core",
  "card-library",
  "freeplay",
] as const satisfies readonly PackageId[];

describe("packageReadiness", () => {
  it("makes Free Play and Deck Builder ready without any chapter", () => {
    expect(packageReadiness(stack(...firstThree))).toEqual({
      freeplay: true,
      deckBuilder: true,
      newGame: false,
      missing: ["chapter-01"],
    });
  });

  it.each(firstThree)("reports missing %s in canonical order", (missing) => {
    const packages = firstThree.filter((packageId) => packageId !== missing);
    expect(packageReadiness(stack(...packages))).toEqual({
      freeplay: false,
      deckBuilder: false,
      newGame: false,
      missing: [missing, "chapter-01"],
    });
  });

  it("reports every absent package in dependency order", () => {
    expect(packageReadiness(stack())).toEqual({
      freeplay: false,
      deckBuilder: false,
      newGame: false,
      missing: ["duel-core", "card-library", "freeplay", "chapter-01"],
    });
  });

  it("enables New Game only when chapter-01 is present", () => {
    expect(packageReadiness(stack(...firstThree, "chapter-01"))).toEqual({
      freeplay: true,
      deckBuilder: true,
      newGame: true,
      missing: [],
    });
  });

  it("fails closed for duplicate or malformed active identities", () => {
    const malformed = active("card-library") as ActivePackage & {
      sha256: string;
    };
    Object.assign(malformed, { sha256: "not-a-sha" });
    expect(
      packageReadiness({
        generation: 3,
        packages: [
          active("duel-core"),
          active("duel-core"),
          malformed,
          active("freeplay"),
        ],
      }),
    ).toEqual({
      freeplay: false,
      deckBuilder: false,
      newGame: false,
      missing: ["duel-core", "card-library", "chapter-01"],
    });
  });
});
