const sha = "a".repeat(64);
const file = { path: "assets/story/test.svg", bytes: 1, sha256: sha };
/** Source-only schemas retained after archive/publication retirement. */
export const schemaFixtures = {
  "file-digest": file,
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
  "file-digest": "parseFileDigest",
  "migration-plan": "parseMigrationPlan",
};
