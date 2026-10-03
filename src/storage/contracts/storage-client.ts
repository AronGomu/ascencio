import type {
  ChapterConfig,
  CardLibraryConfig,
  DuelCoreConfig,
  FreeplayConfig,
} from "./package-payloads.ts";
import type { CardDefinition } from "../../cards/index.ts";
import type { DeckCardLists } from "../../decks/contracts/index.ts";
import type { StoryDocument } from "../../story/ports/index.ts";
import type { PackageId, PackageManifest, StorageResult } from "./package.ts";
import type { GlobalSet } from "./global-set.ts";
import type { UserDataStore } from "./user-data.ts";
import type { ReadyRequirement } from "./startup.ts";
import type { ContentComposition } from "../mods/mod-contracts.ts";

export interface ActivePackage extends PackageManifest {
  readonly fileKey: string;
  readonly bytes: number;
  readonly sha256: string;
}
export interface PackageStack {
  readonly generation: number;
  readonly packages: readonly ActivePackage[];
}
export interface ImportProgress {
  readonly operationId: string;
  readonly phase: "copying" | "validating" | "committing" | "complete";
  readonly fileName: string;
  readonly copiedBytes: number;
  readonly totalBytes: number;
}
export interface ModeReadiness {
  readonly freeplay: boolean;
  readonly deckBuilder: boolean;
  readonly newGame: boolean;
  readonly missing: readonly PackageId[];
}
export interface RemovePackageResult {
  readonly stack: PackageStack;
  readonly cleanupPending: boolean;
}
export interface PackageStore {
  current(): Promise<StorageResult<PackageStack>>;
  importPackages(
    files: readonly File[],
    expectedGeneration: number,
    signal: AbortSignal,
    progress: (event: ImportProgress) => void,
  ): Promise<StorageResult<PackageStack>>;
  verifyInstalled(signal: AbortSignal): Promise<StorageResult<PackageStack>>;
  removePackage(
    packageId: PackageId,
    expectedGeneration: number,
  ): Promise<StorageResult<RemovePackageResult>>;
  cleanupUnused(): Promise<
    StorageResult<{
      readonly removedFiles: number;
      readonly remainingFiles: number;
    }>
  >;
  acquireSession(): Promise<
    StorageResult<{
      readonly generation: number;
      release(): Promise<void>;
    }>
  >;
}

export type DirectContentQuery =
  | {
      readonly kind: "cards";
      readonly locale: string;
      readonly afterCode: number;
      readonly limit: number;
    }
  | {
      readonly kind: "card-search";
      readonly locale: string;
      readonly prefix: string;
      readonly limit: number;
    }
  | { readonly kind: "config"; readonly packageId: PackageId }
  | {
      readonly kind: "scripts";
      readonly afterName: string;
      readonly limit: number;
    }
  | { readonly kind: "decks"; readonly packageId: PackageId }
  | { readonly kind: "opponents"; readonly packageId: PackageId }
  | { readonly kind: "limits"; readonly packageId: PackageId }
  | { readonly kind: "sets"; readonly packageId: "card-library" }
  | {
      readonly kind: "story";
      readonly packageId: PackageId;
      readonly contentId: string;
    }
  | {
      readonly kind: "asset";
      readonly packageId: PackageId;
      readonly path: string;
    }
  | { readonly kind: "set-image"; readonly setId: string };

export type ContentQuery =
  | DirectContentQuery
  | {
      readonly kind: "module-query";
      readonly packageId: PackageId;
      readonly query: Extract<
        DirectContentQuery,
        { kind: "cards" | "scripts" | "sets" | "set-image" }
      >;
    };

export interface QueryMap {
  readonly "module-query":
    | QueryMap["cards"]
    | QueryMap["scripts"]
    | QueryMap["sets"]
    | QueryMap["set-image"];
  readonly cards: readonly CardDefinition[];
  readonly "card-search": readonly number[];
  readonly config:
    DuelCoreConfig | CardLibraryConfig | FreeplayConfig | ChapterConfig;
  readonly scripts: readonly {
    readonly name: string;
    readonly source: string;
  }[];
  readonly decks: readonly (DeckCardLists & {
    readonly id: string;
    readonly name: string;
  })[];
  readonly opponents: readonly {
    readonly id: string;
    readonly name: string;
    readonly line: string;
    readonly deckId: string;
    readonly policyId: "basic";
  }[];
  readonly limits: readonly (readonly [number, 0 | 1 | 2])[];
  readonly sets: readonly GlobalSet[];
  readonly story: StoryDocument | null;
  readonly asset: { readonly mime: string; readonly bytes: Uint8Array } | null;
  readonly "set-image": {
    readonly mime: string;
    readonly bytes: Uint8Array;
  } | null;
}
export interface ContentQueries {
  mediaRevision?(
    request: Extract<DirectContentQuery, { kind: "asset" | "set-image" }>,
    signal: AbortSignal,
  ): Promise<string | null>;
  query<Q extends ContentQuery>(
    request: Q,
    signal: AbortSignal,
  ): Promise<StorageResult<QueryMap[Q["kind"]]>>;
}
export interface MediaWarning {
  readonly packageId: PackageId;
  readonly path: string;
  readonly reason: "missing" | "corrupt" | "unreadable";
}
export interface LocalStorageClient {
  readonly preparedRequirements?: readonly ReadyRequirement[];
  readonly composition?: ContentComposition;
  readonly packages: PackageStore;
  readonly content: ContentQueries;
  readonly userData: UserDataStore;
  subscribeMediaWarnings(listener: (warning: MediaWarning) => void): () => void;
  close(): Promise<void>;
}
