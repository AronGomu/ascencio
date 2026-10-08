# Reproducible native content inputs

These files are source inputs, not downloaded media or generated release outputs.
They supply the inputs omitted during the readable-content migration:

- Card library: original card-set authoring and set-index evidence, reviewed shop
  definitions, normalized catalog configuration, set memberships and booster recipes.
- Chapter 1: original authoring/policy evidence, normalized configuration, decks,
  opponents, story documents and the original available SVG map.

The source inputs preserve the repository's original authoring documents and map.
Set memberships follow the chapter correction policy and the pinned Project
Ignis catalog. Provider rarity labels remain alongside canonical rarities.
`content/packages.json` defines the package identities.

`npm run setup` copies these to ignored package-owned acquisition roots while
preserving existing edits. Edit these tracked sources for changes intended to
survive a fresh clone, then regenerate and review a new immutable release version.
The acquired catalog, scripts and artwork remain outside Git.
