# Content modules

Cards and chapters are data modules. The application loads installed modules through a registry, validates a complete candidate dependency graph, and changes the active generation atomically. Content operations never edit campaign saves. Native releases seed Duel Core, Card Library, Free Play and Chapter 01 by default; later removals and installed selections persist across restarts.

The existing SQLite package transport is retained. This change adds module composition and campaign contracts; it does not replace content databases with loose files. Mutable user data is JSON/localStorage (ADR-101), separate from the content registry and package bytes.

## Manifest and installed dependencies

Add a recipe entry to `content/packages.json`, with a stable `packageId`, semantic `version`, package `schemaVersion`, timestamp, source directory and sorted dependencies. Build with `npm run content:export`; validate with `npm run content:verify`. Native release preparation is documented in [native-content-release.md](native-content-release.md).

```json
{
  "manifest": {
    "packageId": "chapter-02",
    "packageType": "chapter",
    "version": "1.0.0",
    "schemaVersion": 1,
    "dependencies": [
      {
        "packageId": "card-library",
        "requirement": "minimum",
        "version": "1.0.0"
      }
    ],
    "createdAt": "2026-10-01T00:00:00.000Z"
  },
  "sourceRoot": "assets/content/chapter-02"
}
```

Dependencies mean files that must be installed. A chapter need not depend on previous chapters. If its decks, limits or shop sets reference a card pack, declare that pack as a dependency; reference validation follows the declared dependency closure. Missing/incompatible dependencies, cycles, unsupported APIs and conflicting identities prevent activation. Removal refuses packages referenced by installed dependants. Session leases prevent lifecycle changes during gameplay.

Card additions use IDs such as `card-pack-expansion-one`, type `card-library`, and a dependency on `card-library`. They use the existing card-library source schema: card definitions, locale text, scripts, sets, set membership and media. Distinct cards merge into the catalog. Identical shared definitions/scripts are allowed; differing definitions under the same card/text/script identity and duplicate set IDs are rejected. A new generation invalidates cached metadata and search indexes. Preview images are routed to their owning pack; bulk catalog reads do not load image bytes. Prefix search uses an in-memory sorted index for composed catalogs.

## Campaign prerequisites and completion

A chapter's `config.json` can contain this versioned gameplay contract:

```json
{
  "apiVersion": 1,
  "requiresProgress": [
    { "kind": "chapter-completed", "chapterId": "chapter-01" },
    { "kind": "fact", "id": "chapter-01:choice", "equals": "trust-rin" }
  ],
  "completion": [
    {
      "kind": "fact",
      "id": "chapter-02:location:old-arena:completed",
      "equals": true
    }
  ],
  "choiceBeatId": "chapter02-decision"
}
```

Store that object under the `module` key alongside the chapter's existing title, chapter number, document ID, defaults, sets and map metadata. All requirements are conjunctive. An absent fact fails a requirement even if the expected value is `null`. Facts contain JSON primitives and use namespaced IDs. A module with no completion rules is never automatically declared complete.

The campaign binding records `factsSchemaVersion: 1`, completed chapter IDs, the document ID, and a stable current `beatId`. Recorded facts are:

- `<chapter-id>:choice` — the authored choice ID.
- `<chapter-id>:duel:<encounter-id>:result` — win, loss, abort or failure.
- `<chapter-id>:location:<location-id>:completed` — `true` after completion.
- `<chapter-id>:finished` — `true` on the end screen.

Continue reads the latest supported campaign save. When its current chapter is complete, it selects the first later installed chapter whose prerequisites match. It carries wallet, unopened boosters, collection, decks, completed chapters and all facts into the next chapter, while starting its scene progression afresh. An absent earlier chapter does not prevent this transition. A missing required current chapter reports an error and leaves the save intact. New Game still requires Chapter 01.

Version-6 saves without facts remain readable and retain their original index fallback. New saves resume using scene IDs, so inserting or reordering beats preserves the saved scene. Removing a referenced beat refuses resume; the application does not silently resume a different scene. Unknown facts remain present through saves, chapter transitions and JSON backups.

## Authoring boundaries

Chapter documents support stable document/beat IDs and authored choice/response IDs. Keep IDs stable across compatible module versions; changing a label or inserting a scene does not require changing its ID. Do not reuse an ID for a different card, set, scene or outcome. A breaking module API requires application support rather than a silent reinterpretation of saved data.

This contract composes data within the implemented game vocabulary. Presentation currently supports the existing speakers/backgrounds/character poses, and encounters/map locations use the existing Story model. New mechanics, map node types or presentation kinds still require an application extension and validation. Modules contain data, not executable application plugins.

Implementation anchors: `src/modules/index.ts`, `src/storage/modules/`, `src/shell/application/story-module-selection.ts`, and `src/story/saves/campaign-progress.ts`. The browser and native lifecycle suites test absent previous chapters, dependency-protected removal and cross-pack identities; campaign tests cover save facts, stable scene restoration, JSON backups and chapter transitions.
