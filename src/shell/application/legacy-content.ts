import type {
  ContentReadPort,
  InstalledGameplay,
} from "../../content/index.ts";
import { installedEditorCatalog } from "../adapters/installed-editor-catalog.ts";
import type { ShellGameplay } from "../core/installed-inputs.ts";
import {
  legacyBattlePresentation,
  createLegacyBattleRuntimeSource,
} from "../adapters/legacy-battle-runtime.ts";
import { legacyCollectionInputs } from "../adapters/legacy-collection.ts";
import { loadLegacyInstalledImages } from "../adapters/legacy-content-api.ts";

/** T9 compatibility composition. Raw Content references stay in closures, never UI models. */
export function createShellGameplay(
  gameplay: InstalledGameplay,
  reader: ContentReadPort | null,
): ShellGameplay {
  const collection = legacyCollectionInputs(gameplay);
  return Object.freeze({
    identity: [
      gameplay.content.catalogSha256,
      gameplay.content.runtime.sha256,
      ...gameplay.content.chapters.map(({ sha256 }) => sha256),
    ].join(":"),
    chapterIds: Object.freeze([...gameplay.chapterIds]),
    presentation: legacyBattlePresentation(gameplay),
    cards: collection.cards,
    sets: collection.sets,
    decks: gameplay.decks,
    opponents: gameplay.opponents,
    defaults: gameplay.defaults,
    battle:
      reader === null
        ? Object.freeze({
            load: async () => {
              throw new Error("APP_REQUIRED_INPUT_FAILED");
            },
          })
        : createLegacyBattleRuntimeSource(reader, gameplay),
    editor: (images) => installedEditorCatalog(gameplay, images),
    async images(signal) {
      return reader === null
        ? Object.freeze({
            cardUrls: new Map<number, string>(),
            setUrls: new Map<string, string>(),
            dispose() {},
          })
        : loadLegacyInstalledImages(reader, gameplay, signal);
    },
    async cardImages(report) {
      if (reader === null) return this.editor().images;
      const { createInstalledCardImageSource } =
        await import("../adapters/installed-card-image-source.ts");
      return createInstalledCardImageSource(reader, gameplay, report);
    },
  } satisfies ShellGameplay);
}
