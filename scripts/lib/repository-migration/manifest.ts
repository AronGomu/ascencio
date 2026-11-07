export interface MigrationManifest {
  version: 1;
  moves: { from: string; to: string; sha256: string }[];
  deletions: string[];
  consumers: {
    path: string;
    replacements: { from: string; to: string }[];
  }[];
  exclusions: string[];
  protectedPathExceptions: { path: string; reason: string }[];
  requiredResources: { path: string; sha256: string }[];
  referenceChecks: {
    text: string;
    paths: string[];
    exceptions: { path: string; reason: string }[];
  }[];
}
