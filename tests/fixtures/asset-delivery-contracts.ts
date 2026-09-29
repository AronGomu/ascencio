const sha = "a".repeat(64);
const file = { path: "assets/story/test.svg", bytes: 1, sha256: sha };
const profile = { schemaVersion: 1, id: "core", dependsOn: [], rules: [] };
const selected = {
  ...file,
  root: "story",
  sourcePath: "test.svg",
  profile: "dev-only",
  logicalPath: null,
};

/** Source-only schemas retained after archive/publication retirement. */
export const schemaFixtures = {
  "asset-profile": profile,
  "file-digest": file,
  "selected-asset": selected,
  "frozen-inventory": {
    schemaVersion: 1,
    appVersion: "0.1.0",
    profiles: [profile],
    selection: { schemaVersion: 1, profiles: ["core"] },
    files: [selected],
  },
  "migration-plan": {
    schemaVersion: 1,
    files: [
      {
        from: "src/story/assets/test.svg",
        to: file.path,
        bytes: 1,
        sha256: sha,
      },
    ],
  },
};
export const parserNames: Record<keyof typeof schemaFixtures, string> = {
  "asset-profile": "parseAssetProfile",
  "file-digest": "parseFileDigest",
  "selected-asset": "parseSelectedAsset",
  "frozen-inventory": "parseFrozenInventory",
  "migration-plan": "parseMigrationPlan",
};
