import {
  createCards,
  validateCardConsistency,
  type CardDefinition,
} from "../cards/index.ts";
import {
  PROTOTYPE_RULESET,
  validatePublishedDecks,
} from "../decks/validation/index.ts";
import {
  validateStoryContinuity,
  validateStoryRelease,
  type StoryRelease,
} from "../story/ports/index.ts";
import {
  validateBattleRuntime,
  type BattleRuntimeInput,
} from "../battle/ports/index.ts";

export interface ReleaseValidationInput {
  readonly chapterCards: readonly CardDefinition[];
  readonly runtimeCards: readonly CardDefinition[];
  readonly story: StoryRelease;
  readonly runtime: BattleRuntimeInput;
  readonly previousStory: StoryRelease | null;
}

export interface VerifiedPublishCandidate {
  readonly schemaVersion: 1;
  readonly manifestVersion: string;
  readonly previousManifestVersion: string | null;
  readonly validation: "passed";
}

export function validateReleaseData(input: ReleaseValidationInput): void {
  try {
    validateCardConsistency(input.chapterCards, input.runtimeCards);
    const cards = createCards(input.chapterCards);
    const chapterCodes = cards.all().map(({ code }) => code);
    const storyCodes = [
      ...new Set(
        input.story.chapters.flatMap(({ cardCodes }) => cardCodes.map(Number)),
      ),
    ].sort((left, right) => left - right);
    const allowedCodes = input.runtime.allowedCardCodes.map(Number);
    if (
      JSON.stringify(chapterCodes) !== JSON.stringify(storyCodes) ||
      JSON.stringify(chapterCodes) !== JSON.stringify(allowedCodes)
    )
      throw new Error("CARDS_INVALID_DEFINITION");
    const runtimeCards = createCards(input.runtimeCards).all();
    if (
      runtimeCards.length !== input.runtime.cards.length ||
      input.runtime.cards.length !== input.runtime.texts.length
    )
      throw new Error("CARDS_INVALID_DEFINITION");
    const texts = new Map(input.runtime.texts.map((text) => [text.code, text]));
    for (const runtime of input.runtime.cards) {
      const definition = runtimeCards.find(({ code }) => code === runtime.code);
      const text = texts.get(runtime.code);
      if (
        definition === undefined ||
        text === undefined ||
        JSON.stringify({
          code: definition.code,
          alias: definition.alias,
          setcodes: definition.setcodes,
          type: definition.type,
          level: definition.level,
          attribute: definition.attribute,
          race: definition.race,
          attack: definition.attack,
          defense: definition.defense,
          lscale: definition.lscale,
          rscale: definition.rscale,
          linkMarker: definition.linkMarker,
        }) !== JSON.stringify(runtime) ||
        JSON.stringify({
          code: definition.code,
          name: definition.name,
          description: definition.description,
          strings: definition.strings,
        }) !== JSON.stringify(text)
      )
        throw new Error("CARDS_INVALID_DEFINITION");
    }
    validatePublishedDecks(
      input.story.chapters.flatMap(({ decks }) => decks),
      cards,
      PROTOTYPE_RULESET,
    );
    validateStoryRelease(input.story);
    if (input.previousStory !== null)
      validateStoryContinuity(input.previousStory, input.story);
    validateBattleRuntime(input.runtime);
  } catch (cause) {
    throw new Error("CONTENT_SEMANTIC_INVALID", { cause });
  }
}
