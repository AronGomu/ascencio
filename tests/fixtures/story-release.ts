import { cardCode, createCards } from "../../src/cards/index.ts";
import {
  PROLOGUE,
  CHOICE_RESPONSES,
  LATER_ACKNOWLEDGMENTS,
} from "../../src/story/content/prologue.ts";
import type { StoryRelease } from "../../src/story/ports/story-release.ts";
import { installedGameplayFixture } from "./installed-gameplay.ts";

export function storyReleaseFixture(revision = 1): StoryRelease {
  const gameplay = installedGameplayFixture();
  return {
    revision,
    chapters: [
      {
        id: "chapter-01",
        document: {
          schemaVersion: 1,
          contentId: "prototype-prologue-v1",
          ...structuredClone(PROLOGUE),
          choiceResponses: CHOICE_RESPONSES,
          laterAcknowledgments: LATER_ACKNOWLEDGMENTS,
        },
        cardCodes: gameplay.cards.map(({ code }) => cardCode(code)),
        sets: gameplay.sets.map((set) => ({
          id: set.id,
          name: set.name,
          releaseYear: set.releaseYear,
          cards: set.cards
            .filter((card) => gameplay.cards.some((c) => c.code === card.code))
            .map((card) => ({ ...card, code: cardCode(card.code) })),
        })),
        decks: gameplay.decks,
        opponents: gameplay.opponents,
        defaults: gameplay.defaults,
      },
    ],
  };
}
export function storyCardsFixture() {
  return createCards(
    installedGameplayFixture().cards.map(({ code, record, text }) => ({
      ...record,
      ...text,
      code: cardCode(code),
      scope: record.ot,
      images: {
        full: { code: cardCode(code), variant: "full" },
        cropped: { code: cardCode(code), variant: "cropped" },
      },
    })),
  );
}
export const storyBindingFixture = (revision = 1) => ({
  chapterId: "chapter-01",
  contentId: "prototype-prologue-v1" as const,
  revision,
  completedChapterIds: [],
});

type Mutable<T> = T extends string | number | boolean | null | undefined
  ? T
  : { -readonly [P in keyof T]: Mutable<T[P]> };
export function mutableStoryRelease(revision = 1): Mutable<StoryRelease> {
  return structuredClone(
    storyReleaseFixture(revision),
  ) as unknown as Mutable<StoryRelease>;
}
