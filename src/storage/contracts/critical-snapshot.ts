import type { CardRow, PackageConfig, SetRow } from "./package-payloads.ts";
import type { PackageManifest } from "./package.ts";
import type { QueryMap } from "./storage-client.ts";
import type { StoryDocument } from "../../story/ports/index.ts";

export interface LocalizedCardText {
  readonly locale: string;
  readonly name: string;
  readonly description: string;
  readonly strings: readonly string[];
}
export interface SnapshotCard {
  readonly definition: CardRow;
  readonly texts: readonly LocalizedCardText[];
}
export interface SnapshotSet extends SetRow {
  readonly cards: QueryMap["sets"][number]["cards"];
}
export interface MediaMapping {
  readonly id: string;
  readonly path: string;
  readonly mime: string;
}
/** Critical metadata only. Media bytes/digests are deliberately absent. */
export interface CriticalSnapshot {
  readonly schemaVersion: 1;
  readonly compilerVersion: 1;
  readonly manifest: PackageManifest;
  readonly config: PackageConfig;
  readonly cards: readonly SnapshotCard[];
  readonly scripts: QueryMap["scripts"];
  readonly sets: readonly SnapshotSet[];
  readonly decks: QueryMap["decks"];
  readonly opponents: QueryMap["opponents"];
  readonly limits: QueryMap["limits"];
  readonly stories: readonly StoryDocument[];
  readonly media: readonly MediaMapping[];
}
export interface CriticalResource {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}
export interface CriticalRelease {
  readonly schemaVersion: 1;
  readonly compilerVersion: 1;
  readonly packages: readonly (CriticalResource & {
    readonly packageId: string;
    readonly version: string;
  })[];
  readonly engine: readonly CriticalResource[];
}
