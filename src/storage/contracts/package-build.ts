import type { PackageId, PackageManifest, StorageResult } from "./package.ts";

export interface PackageBuildSpec {
  readonly schemaVersion: 1;
  readonly packages: readonly {
    readonly manifest: PackageManifest;
    readonly sourceRoot: string;
  }[];
}

export interface DownloadLinks {
  readonly schemaVersion: 1;
  readonly links: readonly {
    readonly packageId: PackageId;
    readonly title: string;
    readonly url: string | null;
  }[];
}

export interface ExportReceipt {
  readonly packageId: PackageId;
  readonly version: string;
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly missingOptionalMedia: readonly string[];
  readonly excludedSetMemberships: readonly {
    readonly setId: string;
    readonly setName: string;
    readonly sourceSetCode: string | null;
    readonly cardCode: number;
    readonly sourceCardName: string;
    readonly reason: "missing-catalog-card";
    readonly printings: readonly {
      readonly printingCode: string;
      readonly sourceRarity: string;
      readonly sourceRarityCode: string;
    }[];
  }[];
  readonly inventoryOnlyScripts: readonly {
    readonly name: string;
    readonly reason: "missing-catalog-definition";
  }[];
  readonly rarityWarnings: readonly {
    readonly sourceRarity: string;
    readonly rarity: string;
    readonly reason: "lossy-presentation-tier";
  }[];
}

export type ExportPackages = (
  root: string,
  spec: PackageBuildSpec,
) => Promise<StorageResult<readonly ExportReceipt[]>>;
