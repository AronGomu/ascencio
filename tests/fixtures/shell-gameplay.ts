import type { ShellGameplay } from "../../src/shell/core/installed-inputs.ts";
import {
  installedGameplayFixture,
  battlePresentationFixture,
  fixtureCollectionInputs,
  installedEditorCatalog,
  TEST_RUNTIME_SOURCE,
  type FixtureGameplay,
} from "./installed-gameplay.ts";

export function shellGameplayFixture(
  overrides: Parameters<typeof installedGameplayFixture>[0] = {},
): ShellGameplay {
  return semanticShellGameplay(installedGameplayFixture(overrides));
}

export function semanticShellGameplay(
  gameplay: FixtureGameplay,
): ShellGameplay {
  const collection = fixtureCollectionInputs(gameplay);
  return {
    identity: "fixture-1",
    chapterIds: gameplay.chapterIds,
    presentation: battlePresentationFixture(gameplay),
    ...collection,
    decks: gameplay.decks,
    opponents: gameplay.opponents,
    defaults: gameplay.defaults,
    battle: TEST_RUNTIME_SOURCE,
    editor: (images) => installedEditorCatalog(gameplay, images),
    images: async () => ({
      cardUrls: new Map(),
      setUrls: new Map(),
      dispose() {},
    }),
    cardImages: async () => installedEditorCatalog(gameplay).images,
  };
}
