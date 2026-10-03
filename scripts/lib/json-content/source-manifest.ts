import type { PackageManifest } from "../../../src/storage/contracts/package.ts";
import type { MediaMapping } from "../../../src/storage/contracts/critical-snapshot.ts";

export interface SourceManifest {
  readonly format: "ascencio-readable-pack";
  readonly schemaVersion: 1;
  readonly manifest: PackageManifest;
  readonly config: string;
  readonly cards: readonly string[];
  readonly scripts: readonly { readonly name: string; readonly path: string }[];
  readonly sets: readonly string[];
  readonly decks: readonly string[];
  readonly opponents: readonly string[];
  readonly rules: string;
  readonly stories: readonly string[];
  readonly media: readonly MediaMapping[];
  readonly engine: readonly { readonly path: string; readonly file: string }[];
}
