import type { InstalledGameplay } from "../../src/content/index.ts";
import { cardCode } from "../../src/cards/index.ts";
import { legacyCollectionInputs } from "../../src/shell/adapters/legacy-collection.ts";
import {
  createStoryMigrationPort,
  type GenerationSaveRepository,
  type StoryBinding,
} from "../../src/story/saves/index.ts";
import { storyBindingFixture, storyReleaseFixture } from "./story-release.ts";
import { installedDuelGameplayFixture } from "./installed-duel-gameplay.ts";
import type { StoryState } from "../../src/story/model/story-state.ts";
import type { StorySlotKey } from "../../src/story/saves/index.ts";
let clocks = new WeakMap<IDBFactory, () => number>();
let generations = new WeakMap<IDBFactory, Promise<GenerationSaveRepository>>();
export function resetStorySessionFixture(): void {
  generations = new WeakMap();
  clocks = new WeakMap();
}
export function storyInputs(
  gameplay: InstalledGameplay = installedDuelGameplayFixture(),
) {
  const input = legacyCollectionInputs(gameplay);
  const release = {
    revision: 1,
    chapters: [
      {
        ...storyReleaseFixture().chapters[0]!,
        cardCodes: [
          ...new Set([
            ...gameplay.cards.map((c) => c.code),
            ...gameplay.sets.flatMap((s) => s.cards.map((c) => c.code)),
            ...gameplay.decks.flatMap((d) => [
              ...d.main,
              ...d.extra,
              ...d.side,
            ]),
          ]),
        ].map(cardCode),
        sets: input.sets,
        decks: gameplay.decks,
        opponents: gameplay.opponents,
        defaults: gameplay.defaults,
      },
    ],
  };
  return { release, cards: input.cards };
}
/** Explicit schema6 fixture generation; legacy repository tests remain independent. */
export function createStorySaveRepository(
  factory: IDBFactory,
  now: () => number = Date.now,
) {
  clocks.set(factory, now);
  let own: Promise<GenerationSaveRepository> | null = null;
  const open = (): Promise<GenerationSaveRepository> => {
    if (own !== null) return own;
    let existing = generations.get(factory);
    if (!existing) {
      const port = createStoryMigrationPort(factory, () =>
        clocks.get(factory)!(),
      );
      existing = port
        .prepare(null, storyInputs().release)
        .then((seal) => port.repository(seal.generationId));
      generations.set(factory, existing);
    }
    own = existing;
    return existing;
  };
  return {
    read: (slot: StorySlotKey) => open().then((repo) => repo.read(slot)),
    write: (
      slot: StorySlotKey,
      state: StoryState,
      expected: number | null,
      story: StoryBinding = storyBindingFixture(),
    ) => {
      const snapshot = structuredClone(state),
        binding = structuredClone(story);
      clocks.set(factory, now);
      return open().then((repo) =>
        repo.write(slot, snapshot, expected, binding),
      );
    },
    list: () => open().then((repo) => repo.list()),
    clear: (slot: StorySlotKey) => open().then((repo) => repo.clear(slot)),
  };
}
export function storyAppProps(
  gameplay: InstalledGameplay = installedDuelGameplayFixture(),
) {
  return {
    ...storyInputs(gameplay),
    saves: createStorySaveRepository(globalThis.indexedDB),
  };
}

export function storyShellProps() {
  const { release, cards, saves } = storyAppProps();
  return { storyRelease: release, storyCards: cards, saves };
}
