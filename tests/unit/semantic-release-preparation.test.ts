import { describe, expect, it } from "vitest";
import {
  validateReleaseData,
  type ReleaseValidationInput,
} from "../../src/shell/release-validation.ts";
import { OCG_TYPE } from "../../src/cards/classification/index.ts";
import {
  storyCardsFixture,
  storyReleaseFixture,
} from "../fixtures/story-release.ts";
import { TEST_RUNTIME_INPUT } from "../fixtures/installed-gameplay.ts";

type Mutable<T> = T extends number | string | boolean | null | ArrayBuffer
  ? T
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T;
function fixture(): Mutable<ReleaseValidationInput> {
  const cards = storyCardsFixture().all();
  return structuredClone({
    chapterCards: cards,
    runtimeCards: cards,
    story: storyReleaseFixture(),
    runtime: {
      ...TEST_RUNTIME_INPUT,
      cards: cards.map(
        ({
          code,
          alias,
          setcodes,
          type,
          level,
          attribute,
          race,
          attack,
          defense,
          lscale,
          rscale,
          linkMarker,
        }) => ({
          code,
          alias,
          setcodes,
          type,
          level,
          attribute,
          race,
          attack,
          defense,
          lscale,
          rscale,
          linkMarker,
        }),
      ),
      texts: cards.map(({ code, name, description, strings }) => ({
        code,
        name,
        description,
        strings,
      })),
      allowedCardCodes: cards.map(({ code }) => code),
    },
    previousStory: null,
  }) as Mutable<ReleaseValidationInput>;
}

describe("retained pure release semantic validation", () => {
  it("validates complete Cards, Decks, Story and Battle inputs without a browser content store", () => {
    expect(() => validateReleaseData(fixture())).not.toThrow();
  });
  it("accepts an independent story content identity and preserves it across releases", () => {
    const input = fixture();
    input.story.chapters[0]!.document!.contentId =
      "independent-content" as never;
    expect(() => validateReleaseData(input)).not.toThrow();
    input.previousStory = structuredClone(input.story);
    expect(() => validateReleaseData(input)).not.toThrow();
  });
  it.each<[string, (value: Mutable<ReleaseValidationInput>) => void]>([
    [
      "unsupported token",
      (v) => {
        v.chapterCards[0]!.type |= OCG_TYPE.TOKEN;
        v.runtimeCards[0]!.type = v.chapterCards[0]!.type;
        v.runtime.cards[0]!.type = v.chapterCards[0]!.type;
      },
    ],
    [
      "wrong main/extra zone",
      (v) => {
        v.chapterCards[0]!.type |= OCG_TYPE.FUSION;
        v.runtimeCards[0]!.type = v.chapterCards[0]!.type;
        v.runtime.cards[0]!.type = v.chapterCards[0]!.type;
      },
    ],
    [
      "copy limit",
      (v) => {
        v.story.chapters[0]!.decks[0]!.main.splice(0, 4, 1, 1, 1, 1);
      },
    ],
    [
      "chapter/runtime text mismatch",
      (v) => {
        v.runtime.texts[0]!.name = "Mismatch";
      },
    ],
    [
      "chapter/runtime record mismatch",
      (v) => {
        v.runtime.cards[0]!.attack = 1234;
      },
    ],
    [
      "chapter card missing from runtime support",
      (v) => {
        v.runtime.cards.shift();
      },
    ],
    [
      "unknown deck card",
      (v) => {
        v.story.chapters[0]!.decks[0]!.main[0] = 999999;
      },
    ],
    [
      "normal card in Extra",
      (v) => {
        v.story.chapters[0]!.decks[0]!.extra = [1];
      },
    ],
    [
      "set references unavailable card",
      (v) => {
        v.story.chapters[0]!.sets[0]!.cards[0]!.code = 999999 as never;
      },
    ],
    [
      "missing starter default",
      (v) => {
        v.story.chapters[0]!.defaults.starterDeckId = "missing";
      },
    ],
    [
      "missing opponent default",
      (v) => {
        v.story.chapters[0]!.defaults.opponentId = "missing";
      },
    ],
    [
      "invalid opponent deck reference",
      (v) => {
        v.story.chapters[0]!.opponents[0]!.deckId = "missing";
      },
    ],
    [
      "story content identity changes across releases",
      (v) => {
        v.previousStory = structuredClone(v.story);
        v.story.chapters[0]!.document!.contentId = "different-content" as never;
      },
    ],
    [
      "allowed pool differs from chapter cards",
      (v) => {
        v.runtime.allowedCardCodes.pop();
      },
    ],
    [
      "conflicting duplicate chapter definition",
      (v) => {
        const second = structuredClone(v.story.chapters[0]!);
        second.id = "chapter-02";
        second.decks[0]!.name = "Conflict";
        v.story.chapters.push(second);
      },
    ],
    [
      "duplicate opponent across chapters",
      (v) => {
        const second = structuredClone(v.story.chapters[0]!);
        second.id = "chapter-02";
        second.opponents[0]!.name = "Conflict";
        v.story.chapters.push(second);
      },
    ],
  ])("owned negative parity: %s", (_name, mutate) => {
    const input = fixture();
    mutate(input);
    expect(() => validateReleaseData(input)).toThrow(
      "CONTENT_SEMANTIC_INVALID",
    );
  });
  it("deduplicates identical chapter definitions without widening the allowed pool", () => {
    const input = fixture();
    input.story.chapters.push({
      ...structuredClone(input.story.chapters[0]!),
      id: "chapter-02",
    });
    expect(() => validateReleaseData(input)).not.toThrow();
    expect(input.runtime.allowedCardCodes).toHaveLength(14);
  });
  it("maps any owned validator failure to CONTENT_SEMANTIC_INVALID", () => {
    expect(() =>
      validateReleaseData({
        chapterCards: [],
        runtimeCards: [],
        story: { revision: 1, chapters: [] },
        runtime: {} as never,
        previousStory: null,
      }),
    ).toThrow("CONTENT_SEMANTIC_INVALID");
  });
});

it.each([
  "starter default",
  "opponent default",
  "opponent deck ref",
  "set card ref",
  "duplicate deck",
  "duplicate opponent",
])("Story owner directly rejects %s without Content parser", async (name) => {
  const { validateStoryRelease } =
    await import("../../src/story/ports/index.ts");
  const story = fixture().story;
  const chapter = story.chapters[0]!;
  if (name === "starter default") chapter.defaults.starterDeckId = "missing";
  if (name === "opponent default") chapter.defaults.opponentId = "missing";
  if (name === "opponent deck ref") chapter.opponents[0]!.deckId = "missing";
  if (name === "set card ref")
    chapter.sets[0]!.cards[0]!.code = 999999 as never;
  if (name === "duplicate deck")
    chapter.decks.push({ ...chapter.decks[0]!, name: "Conflict" });
  if (name === "duplicate opponent")
    chapter.opponents.push({ ...chapter.opponents[0]!, name: "Conflict" });
  expect(() => validateStoryRelease(story)).toThrow("STORY_RELEASE_INVALID");
});

it("conflicting duplicate chapter card definition rejects before readiness", () => {
  const input = fixture();
  input.chapterCards.push({
    ...input.chapterCards[0]!,
    name: "Conflicting duplicate",
  });
  expect(() => validateReleaseData(input)).toThrow("CONTENT_SEMANTIC_INVALID");
});
