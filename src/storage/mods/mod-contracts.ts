import type { PackageId } from "../contracts/package.ts";
import type { StartupDiagnostic } from "../contracts/startup-diagnostic.ts";
export type ModEntityKind =
  | "cards"
  | "scripts"
  | "sets"
  | "decks"
  | "opponents"
  | "limits"
  | "stories"
  | "config";
export interface ModEntitySource {
  readonly kind: ModEntityKind;
  readonly packageId: PackageId;
  readonly operation: "add" | "override";
  readonly id: string;
  readonly path: string;
  /** Named prior writers, each required by this manifest's dependency graph. */
  readonly resolves: readonly string[];
}
export interface ModManifest {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly version: string;
  readonly contentApi: 1;
  readonly base: readonly {
    readonly packageId: PackageId;
    readonly version: string;
  }[];
  readonly dependencies: readonly {
    readonly id: string;
    readonly version: string;
  }[];
  readonly entities: readonly ModEntitySource[];
  readonly media: readonly {
    readonly packageId: PackageId;
    readonly id: string;
    readonly path: string;
    readonly mime: string;
    readonly operation: "add" | "override";
    readonly resolves: readonly string[];
  }[];
}
export interface LoadedMod {
  readonly manifest: ModManifest;
  readonly files: readonly { readonly path: string; readonly value: unknown }[];
  readonly sha256: string;
}
export interface ModLoadResult {
  readonly mods: readonly LoadedMod[];
  readonly diagnostics: readonly StartupDiagnostic[];
  readonly droppedDiagnostics: number;
}
export interface ContentComposition {
  readonly identity: string;
  readonly requiredMods: readonly {
    readonly id: string;
    readonly version: string;
    readonly sha256: string;
  }[];
}
